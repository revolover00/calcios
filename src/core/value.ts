import Decimal from 'decimal.js';
import { CONVERSION_BY_TOKEN } from './constants';
import { mathError, syntax } from './errors';
import { DEFAULT_NUMBER_FORMAT, toSuperscript, type NumberFormatSetting } from './format';
import {
  addSymbolic, divideSymbolic, exactInverseTrigDegrees, exactTrigDegrees,
  gcdBig, lcmBig, makePiMultiple, multiplySymbolic, negateSymbolic,
  parseRecurringRational, symbolicSqrtRational, symbolicSqrtSurd,
  type SymbolicValue,
} from './symbolic';

/** Internal decimal arithmetic has guard digits. Display rounding happens only at the edge. */
export const D = Decimal.clone({ precision: 34, rounding: Decimal.ROUND_HALF_UP, maxE: 10000, minE: -10000 });
export type AngleUnit = 'DEG' | 'RAD' | 'GRA';
export type VariableName = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'X' | 'Y' | 'M';
export const VARIABLES: VariableName[] = ['A', 'B', 'C', 'D', 'E', 'F', 'X', 'Y', 'M'];

export interface Rational { n: bigint; d: bigint }
export interface Scalar {
  decimal: Decimal;
  exact?: Rational;
  rawUnreduced?: Rational;
  simpUnreduced?: Rational;
  simpFactor?: bigint;
  symbolic?: SymbolicValue;
  preferDecimal: boolean;
}

export type StoredSymbolic =
  | { kind: 'pi'; n: string; d: string }
  | { kind: 'surd'; a: string; b: string; rad: string; d: string }
  | { kind: 'multi-surd'; terms: Array<{ coef: string; rad: string }>; d: string };

export interface StoredScalar {
  decimal: string;
  numerator?: string;
  denominator?: string;
  unreducedN?: string;
  unreducedD?: string;
  simpFactor?: string;
  symbolic?: StoredSymbolic;
  preferDecimal: boolean;
}

const ZERO = 0n;
const ONE = 1n;
const LIMIT = new D('1e100');
const MAX_EXACT_DIGITS = 220;

function absBig(n: bigint): bigint { return n < ZERO ? -n : n; }
function gcd(a: bigint, b: bigint): bigint {
  a = absBig(a); b = absBig(b);
  while (b !== ZERO) [a, b] = [b, a % b];
  return a;
}

export function rational(n: bigint, d = ONE): Rational | undefined {
  if (d === ZERO) mathError('Division by zero');
  if (d < ZERO) { n = -n; d = -d; }
  const g = gcd(n, d);
  n /= g; d /= g;
  if (absBig(n).toString().length > MAX_EXACT_DIGITS || d.toString().length > MAX_EXACT_DIGITS) return undefined;
  return { n, d };
}

export function makeScalar(
  value: Decimal.Value,
  exact?: Rational,
  preferDecimal = false,
  symbolic?: SymbolicValue,
): Scalar {
  const number = new D(value);
  if (!number.isFinite() || number.abs().gte(LIMIT)) mathError('Result outside the supported range');
  if (!number.isZero() && number.abs().lt('1e-99')) {
    return { decimal: new D(0), exact: { n: ZERO, d: ONE }, preferDecimal };
  }
  return { decimal: number, exact, symbolic: exact ? undefined : symbolic, preferDecimal };
}

export function scalarFromInteger(value: number | bigint): Scalar {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  return makeScalar(n.toString(), rational(n));
}

export function scalarPi(): Scalar {
  return makeScalar(D.acos(-1), undefined, false, { kind: 'pi', n: ONE, d: ONE });
}

export function scalarFromLiteral(literal: string): Scalar {
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(literal)) syntax('Invalid number');
  const neg = literal.startsWith('-');
  const unsigned = literal.startsWith('-') || literal.startsWith('+') ? literal.slice(1) : literal;
  const [base, expText = '0'] = unsigned.toLowerCase().split('e');
  const exponent = Number(expText);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) mathError('Exponent out of range');
  const [integer, fraction = ''] = base.split('.');
  const digits = `${integer || '0'}${fraction}`;
  let numerator = BigInt(digits || '0');
  if (neg) numerator = -numerator;
  let denominator = ONE;
  const scale = fraction.length - exponent;
  if (Math.abs(scale) <= MAX_EXACT_DIGITS) {
    if (scale > 0) denominator = 10n ** BigInt(scale);
    else numerator *= 10n ** BigInt(-scale);
  } else {
    return makeScalar(literal, undefined, base.includes('.'));
  }
  return makeScalar(literal, rational(numerator, denominator), base.includes('.'));
}

export function serialize(value: Scalar): StoredScalar {
  let sym: StoredSymbolic | undefined;
  if (value.symbolic?.kind === 'pi') {
    sym = { kind: 'pi', n: value.symbolic.n.toString(), d: value.symbolic.d.toString() };
  } else if (value.symbolic?.kind === 'surd') {
    sym = {
      kind: 'surd',
      a: value.symbolic.a.toString(),
      b: value.symbolic.b.toString(),
      rad: value.symbolic.rad.toString(),
      d: value.symbolic.d.toString(),
    };
  } else if (value.symbolic?.kind === 'multi-surd') {
    sym = {
      kind: 'multi-surd',
      terms: value.symbolic.terms.map((t) => ({ coef: t.coef.toString(), rad: t.rad.toString() })),
      d: value.symbolic.d.toString(),
    };
  }
  return {
    decimal: value.decimal.toString(),
    numerator: value.exact?.n.toString(),
    denominator: value.exact?.d.toString(),
    unreducedN: value.simpUnreduced?.n.toString(),
    unreducedD: value.simpUnreduced?.d.toString(),
    simpFactor: value.simpFactor?.toString(),
    symbolic: sym,
    preferDecimal: value.preferDecimal,
  };
}

export function deserialize(value: StoredScalar): Scalar {
  const exact = value.numerator !== undefined && value.denominator !== undefined
    ? rational(BigInt(value.numerator), BigInt(value.denominator)) : undefined;
  let sym: SymbolicValue | undefined;
  if (value.symbolic?.kind === 'pi') {
    sym = { kind: 'pi', n: BigInt(value.symbolic.n), d: BigInt(value.symbolic.d) };
  } else if (value.symbolic?.kind === 'surd') {
    sym = {
      kind: 'surd',
      a: BigInt(value.symbolic.a),
      b: BigInt(value.symbolic.b),
      rad: BigInt(value.symbolic.rad),
      d: BigInt(value.symbolic.d),
    };
  } else if (value.symbolic?.kind === 'multi-surd') {
    sym = {
      kind: 'multi-surd',
      terms: value.symbolic.terms.map((t) => ({ coef: BigInt(t.coef), rad: BigInt(t.rad) })),
      d: BigInt(value.symbolic.d),
    };
  }
  const s = makeScalar(value.decimal, exact, value.preferDecimal, sym);
  if (value.unreducedN !== undefined && value.unreducedD !== undefined) {
    s.simpUnreduced = { n: BigInt(value.unreducedN), d: BigInt(value.unreducedD) };
  }
  if (value.simpFactor !== undefined) {
    s.simpFactor = BigInt(value.simpFactor);
  }
  return s;
}

export function zeroStored(): StoredScalar { return serialize(scalarFromInteger(0)); }

export function negate(a: Scalar): Scalar {
  return makeScalar(
    a.decimal.neg(),
    a.exact && rational(-a.exact.n, a.exact.d),
    a.preferDecimal,
    a.symbolic && negateSymbolic(a.symbolic),
  );
}

export function add(a: Scalar, b: Scalar): Scalar {
  const pref = a.preferDecimal || b.preferDecimal;
  if (a.exact && b.exact) {
    const r = rational(a.exact.n * b.exact.d + b.exact.n * a.exact.d, a.exact.d * b.exact.d);
    return makeScalar(a.decimal.plus(b.decimal), r, pref);
  }
  const sym = addSymbolic(a, b);
  const ex = sym.exact && rational(sym.exact.n, sym.exact.d);
  return makeScalar(a.decimal.plus(b.decimal), ex, pref, sym.symbolic);
}

export function subtract(a: Scalar, b: Scalar): Scalar { return add(a, negate(b)); }

export function multiply(a: Scalar, b: Scalar): Scalar {
  const pref = a.preferDecimal || b.preferDecimal;
  if (a.exact && b.exact) {
    const r = rational(a.exact.n * b.exact.n, a.exact.d * b.exact.d);
    return makeScalar(a.decimal.times(b.decimal), r, pref);
  }
  const sym = multiplySymbolic(a, b);
  const ex = sym.exact && rational(sym.exact.n, sym.exact.d);
  return makeScalar(a.decimal.times(b.decimal), ex, pref, sym.symbolic);
}

export function divide(a: Scalar, b: Scalar): Scalar {
  if (b.decimal.isZero()) mathError('Division by zero');
  const pref = a.preferDecimal || b.preferDecimal;
  if (a.exact && b.exact) {
    let rawN = a.exact.n * b.exact.d;
    let rawD = a.exact.d * b.exact.n;
    if (rawD < ZERO) { rawN = -rawN; rawD = -rawD; }
    const r = rational(rawN, rawD);
    const out = makeScalar(a.decimal.dividedBy(b.decimal), r, pref);
    if (absBig(rawN).toString().length <= 40 && rawD.toString().length <= 40) {
      out.rawUnreduced = { n: rawN, d: rawD };
    }
    return out;
  }
  const sym = divideSymbolic(a, b);
  const ex = sym.exact && rational(sym.exact.n, sym.exact.d);
  return makeScalar(a.decimal.dividedBy(b.decimal), ex, pref, sym.symbolic);
}

/** Manual step-by-step fraction simplification (▸Simp [factor]) matching Calcios Calcios. */
export function simplifyManualFraction(s: Scalar, factor?: Scalar): Scalar {
  const source = s.simpUnreduced ?? s.rawUnreduced ?? s.exact;
  if (!source) mathError('▸Simp requires an exact fraction');
  let { n, d } = source;
  if (d < ZERO) { n = -n; d = -d; }

  if (factor !== undefined) {
    if (!factor.decimal.isInteger() || factor.decimal.lt(2) || factor.decimal.gte('1e15')) {
      mathError('Invalid simplification factor');
    }
    const k = BigInt(factor.decimal.toFixed(0));
    if (absBig(n) % k !== ZERO || d % k !== ZERO) {
      mathError('Factor does not divide numerator and denominator');
    }
    const out = makeScalar(s.decimal, s.exact, false);
    out.simpUnreduced = { n: n / k, d: d / k };
    out.simpFactor = k;
    return out;
  }

  const g = gcd(n, d);
  if (g <= ONE) {
    return makeScalar(s.decimal, s.exact, false);
  }

  let smallestPrime = g;
  if (g % 2n === ZERO) {
    smallestPrime = 2n;
  } else {
    for (let f = 3n; f * f <= g; f += 2n) {
      if (g % f === ZERO) {
        smallestPrime = f;
        break;
      }
    }
  }

  const out = makeScalar(s.decimal, s.exact, false);
  out.simpUnreduced = { n: n / smallestPrime, d: d / smallestPrime };
  out.simpFactor = smallestPrime;
  return out;
}

function exactBigIntNthRoot(val: bigint, k: number): bigint | null {
  if (val < ZERO || k < 1 || k > 64) return null;
  if (val === ZERO) return ZERO;
  if (val === ONE || k === 1) return val;
  const bitLen = val.toString(2).length;
  let hi = ONE << BigInt(Math.ceil(bitLen / k) + 1);
  let lo = ONE;
  const kBig = BigInt(k);
  while (lo <= hi) {
    const mid = (lo + hi) >> ONE;
    const p = mid ** kBig;
    if (p === val) return mid;
    if (p < val) lo = mid + ONE;
    else hi = mid - ONE;
  }
  return null;
}

function exactRationalNthRoot(r: Rational, k: number): Rational | null {
  if (k < 1 || k > 64) return null;
  if (r.n < ZERO && k % 2 === 0) return null;
  if (absBig(r.n) > 10n ** 36n || r.d > 10n ** 36n) return null;
  const rn = exactBigIntNthRoot(absBig(r.n), k);
  if (rn === null) return null;
  const rd = exactBigIntNthRoot(r.d, k);
  if (rd === null) return null;
  return rational(r.n < ZERO ? -rn : rn, rd) ?? null;
}

function exactRationalLog(base: Scalar, arg: Scalar): Rational | undefined {
  if (arg.exact && arg.exact.n === ONE && arg.exact.d === ONE) {
    return { n: ZERO, d: ONE };
  }
  if (!base.exact && !base.symbolic && !arg.exact && !arg.symbolic) {
    return undefined;
  }
  const raw = arg.decimal.ln().div(base.decimal.ln());
  for (let q = 1; q <= 12; q++) {
    const scaled = raw.times(q);
    const pRound = scaled.round();
    if (scaled.minus(pRound).abs().gt('1e-22')) continue;
    if (pRound.abs().gt(60)) continue;
    const pNum = pRound.toNumber();
    const lhs = pNum >= 0 ? base.decimal.pow(pNum) : new D(1).div(base.decimal.pow(-pNum));
    const rhs = arg.decimal.pow(q);
    const scale = D.max(lhs.abs(), rhs.abs(), new D(1));
    if (lhs.minus(rhs).abs().lte(scale.times('1e-26'))) {
      return rational(BigInt(pNum), BigInt(q));
    }
  }
  return undefined;
}

export function power(a: Scalar, b: Scalar): Scalar {
  try {
    if (a.decimal.isZero() && b.decimal.lte(0)) mathError('Invalid power');
    const pref = a.preferDecimal || b.preferDecimal;

    if (b.decimal.isZero()) {
      return makeScalar(new D(1), { n: ONE, d: ONE }, pref);
    }

    if (b.decimal.abs().gt(10000)) mathError('Exponent out of range');

    if (b.decimal.isInteger() && b.decimal.abs().lte(100)) {
      const exponent = b.decimal.toNumber();
      if (a.exact) {
        const e = BigInt(Math.abs(exponent));
        const n = a.exact.n ** e, d = a.exact.d ** e;
        const exact = exponent < 0 ? rational(d, n) : rational(n, d);
        return makeScalar(a.decimal.pow(b.decimal), exact, pref);
      }
      if ((a.symbolic?.kind === 'surd' || a.symbolic?.kind === 'multi-surd') && Math.abs(exponent) <= 10) {
        let acc: Scalar = scalarFromInteger(1);
        let base: Scalar = a;
        let k = Math.abs(exponent);
        while (k > 0) {
          if (k & 1) acc = multiply(acc, base);
          k >>= 1;
          if (k > 0) base = multiply(base, base);
        }
        return exponent < 0 ? divide(scalarFromInteger(1), acc) : { ...acc, preferDecimal: pref };
      }
    }

    // Odd-denominator rational exponents of negative bases: (-8)^(1/3) = -2, (-8)^(2/3) = 4
    if (a.decimal.isNegative()) {
      if (b.exact && b.exact.d > ONE && b.exact.d % 2n === ONE) {
        const absPow = power(negate(a), b);
        return absBig(b.exact.n) % 2n === ONE ? negate(absPow) : absPow;
      }
      if (!b.decimal.isInteger()) mathError('Non-real power');
    }

    // Fractional powers p/2 -> exact surd^p (e.g. 2^(1/2) = √2, 2^(-1/2) = √2/2, 8^(3/2) = 16√2)
    if (b.exact && b.exact.d === 2n && absBig(b.exact.n) <= 12n && !a.decimal.isNegative()) {
      const sq = applyFunction('sqrt', [a], 'DEG');
      const pInt = Number(b.exact.n);
      const out = pInt === 1 ? sq : power(sq, scalarFromInteger(pInt));
      return { ...out, preferDecimal: pref };
    }

    // Exact rational q-th root raised to p (e.g. 8^(2/3) = 4, (27/8)^(-2/3) = 4/9)
    if (
      a.exact &&
      b.exact &&
      b.exact.d > ONE &&
      b.exact.d <= 60n &&
      absBig(b.exact.n) <= 60n &&
      !a.decimal.isNegative()
    ) {
      const rt = exactRationalNthRoot(a.exact, Number(b.exact.d));
      if (rt) {
        const e = absBig(b.exact.n);
        const rn = rt.n ** e;
        const rd = rt.d ** e;
        const exact = b.exact.n < ZERO ? rational(rd, rn) : rational(rn, rd);
        return makeScalar(a.decimal.pow(b.decimal), exact, pref);
      }
    }

    return makeScalar(a.decimal.pow(b.decimal), undefined, pref);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('[DecimalError]')) mathError('Power overflow');
    throw err;
  }
}

export function factorial(a: Scalar): Scalar {
  try {
    if (!a.decimal.isInteger() || a.decimal.isNegative() || a.decimal.gt(69)) mathError('Factorial out of range');
    let result = ONE;
    for (let i = 2n; i <= BigInt(a.decimal.toFixed(0)); i++) result *= i;
    return makeScalar(result.toString(), rational(result));
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('[DecimalError]')) mathError('Factorial out of range');
    throw err;
  }
}

export function combinatoric(a: Scalar, b: Scalar, permutation: boolean): Scalar {
  if (!a.decimal.isInteger() || !b.decimal.isInteger() || a.decimal.isNegative() || b.decimal.isNegative() || b.decimal.gt(a.decimal) || a.decimal.gte('1e10')) mathError('Invalid combination');
  const n = BigInt(a.decimal.toFixed(0));
  let k = BigInt(b.decimal.toFixed(0));
  if (!permutation && k > n - k) k = n - k;
  const maxResult = 10n ** 100n;
  let result = ONE;
  for (let i = ONE; i <= k; i++) {
    result *= n - i + ONE;
    if (!permutation) result /= i;
    if (result >= maxResult) mathError('Result outside the supported range');
  }
  return makeScalar(result.toString(), rational(result));
}

export function mixedFraction(whole: Scalar, num: Scalar, den: Scalar): Scalar {
  if (den.decimal.isZero()) mathError('Division by zero');
  if (!whole.decimal.isInteger() || !num.decimal.isInteger() || !den.decimal.isInteger()) {
    mathError('Mixed fraction parts must be integers');
  }
  if (num.decimal.isNegative() || den.decimal.lte(0)) mathError('Invalid mixed fraction');
  const fracPart = divide(num, den);
  if (whole.decimal.isNegative()) {
    const absWhole = negate(whole);
    return negate(add(absWhole, fracPart));
  }
  return add(whole, fracPart);
}

export function dmsToScalar(parts: Scalar[]): Scalar {
  if (parts.length < 1 || parts.length > 3) syntax('Invalid DMS value');
  const [deg, min = scalarFromInteger(0), sec = scalarFromInteger(0)] = parts;
  if (parts.length >= 2 && !deg.decimal.isInteger()) syntax('Invalid DMS value');
  if (parts.length === 3 && !min.decimal.isInteger()) syntax('Invalid DMS value');
  if (min.decimal.isNegative() || sec.decimal.isNegative()) mathError('Invalid DMS part');
  const negative = deg.decimal.isNegative();
  const absDeg = negative ? negate(deg) : deg;
  const total = add(absDeg, add(divide(min, scalarFromInteger(60)), divide(sec, scalarFromInteger(3600))));
  const signed = negative ? negate(total) : total;
  return { ...signed, preferDecimal: true };
}

export function primeFactorize(value: Scalar): string {
  const d = value.decimal;
  if (!d.isInteger() || d.lte(0) || d.gte('1e12')) mathError('Prime factorization domain');
  let n = BigInt(d.toFixed(0));
  if (n === 1n) return '1';
  const factors: Array<[bigint, number]> = [];
  const pushFactor = (p: bigint) => {
    let count = 0;
    while (n % p === ZERO) {
      n /= p;
      count++;
    }
    if (count > 0) factors.push([p, count]);
  };
  pushFactor(2n);
  pushFactor(3n);
  let f = 5n;
  while (f * f <= n) {
    pushFactor(f);
    pushFactor(f + 2n);
    f += 6n;
  }
  if (n > 1n) factors.push([n, 1]);
  return factors
    .map(([p, exp]) => (exp === 1 ? p.toString() : `${p.toString()}${toSuperscript(String(exp))}`))
    .join('×');
}

function simpleExact(value: Decimal): Rational | undefined {
  const candidates: Rational[] = [{ n: 0n, d: 1n }, { n: 1n, d: 2n }, { n: -1n, d: 2n }, { n: 1n, d: 1n }, { n: -1n, d: 1n }];
  return candidates.find(({ n, d }) => value.minus(new D(n.toString()).div(d.toString())).abs().lt('1e-28'));
}

export function fromRadians(value: Decimal, angle: AngleUnit): Decimal {
  if (angle === 'RAD') return value;
  return value.times(angle === 'DEG' ? 180 : 200).div(D.acos(-1));
}
export function toRadians(value: Decimal, angle: AngleUnit): Decimal {
  if (angle === 'RAD') return value;
  return value.times(D.acos(-1)).div(angle === 'DEG' ? 180 : 200);
}

export function convertAngleToActive(value: Scalar, sourceUnit: AngleUnit, activeUnit: AngleUnit): Scalar {
  if (sourceUnit === activeUnit) return value;
  if (sourceUnit !== 'RAD' && activeUnit !== 'RAD') {
    const num = sourceUnit === 'DEG' ? 10 : 9;
    const den = sourceUnit === 'DEG' ? 9 : 10;
    return divide(multiply(value, scalarFromInteger(num)), scalarFromInteger(den));
  }
  if (activeUnit === 'RAD' && value.exact) {
    const scaleDen = sourceUnit === 'DEG' ? 180n : 200n;
    const piSym = makePiMultiple(value.exact.n, value.exact.d * scaleDen);
    const rad = toRadians(value.decimal, sourceUnit);
    if (piSym && 'kind' in piSym) return makeScalar(rad, undefined, value.preferDecimal, piSym);
    if (piSym && 'rationalZero' in piSym) return scalarFromInteger(0);
  }
  if (sourceUnit === 'RAD' && value.symbolic?.kind === 'pi') {
    const scaleNum = activeUnit === 'DEG' ? 180n : 200n;
    const r = rational(value.symbolic.n * scaleNum, value.symbolic.d);
    const converted = fromRadians(value.decimal, activeUnit);
    return makeScalar(converted, r, value.preferDecimal);
  }
  const rad = toRadians(value.decimal, sourceUnit);
  const converted = fromRadians(rad, activeUnit);
  return makeScalar(converted, simpleExact(converted), true);
}

export function polarFromRect(x: Scalar, y: Scalar, angle: AngleUnit): { r: Scalar; theta: Scalar } {
  const maxAbs = D.max(x.decimal.abs(), y.decimal.abs());
  let r: Scalar;
  if (maxAbs.isZero()) {
    r = scalarFromInteger(0);
  } else if (maxAbs.gte('1e45')) {
    const scaledHypot = maxAbs.times(
      x.decimal.div(maxAbs).pow(2).plus(y.decimal.div(maxAbs).pow(2)).sqrt(),
    );
    r = makeScalar(scaledHypot, undefined, true);
  } else {
    const sumSq = add(multiply(x, x), multiply(y, y));
    r = applyFunction('sqrt', [sumSq], angle);
  }
  const rawTheta = x.decimal.isZero() && y.decimal.isZero()
    ? new D(0)
    : fromRadians(D.atan2(y.decimal, x.decimal), angle);
  return {
    r: { ...r, preferDecimal: true },
    theta: makeScalar(rawTheta, simpleExact(rawTheta), true),
  };
}

export function rectFromPolar(r: Scalar, theta: Scalar, angle: AngleUnit): { x: Scalar; y: Scalar } {
  const cosVal = applyFunction('cos', [theta], angle);
  const sinVal = applyFunction('sin', [theta], angle);
  return {
    x: { ...multiply(r, cosVal), preferDecimal: true },
    y: { ...multiply(r, sinVal), preferDecimal: true },
  };
}

export function randomInteger(a: Scalar, b: Scalar, random = Math.random()): Scalar {
  if (!a.decimal.isInteger() || !b.decimal.isInteger()) mathError('RanInt requires integers');
  if (a.decimal.gt(b.decimal) || a.decimal.abs().gt('1e10') || b.decimal.abs().gt('1e10')) mathError('RanInt domain');
  const min = BigInt(a.decimal.toFixed(0));
  const max = BigInt(b.decimal.toFixed(0));
  const span = Number(max - min + 1n);
  const clamped = Math.max(0, Math.min(0.999999999999, random));
  const chosen = min + BigInt(Math.floor(clamped * span));
  return scalarFromInteger(chosen);
}

export function roundScalar(a: Scalar, setting: NumberFormatSetting = DEFAULT_NUMBER_FORMAT): Scalar {
  const d = a.decimal;
  if (d.isZero()) return scalarFromInteger(0);
  if (setting.mode === 'Fix' && d.abs().lt('1e10')) {
    const rounded = d.toDecimalPlaces(setting.digits);
    if (rounded.isZero()) return scalarFromInteger(0);
    if (rounded.abs().lt('1e10')) {
      return { ...scalarFromLiteral(rounded.toFixed(setting.digits)), preferDecimal: a.preferDecimal };
    }
  }
  const sig = setting.mode === 'Sci' ? (setting.digits === 0 ? 10 : setting.digits) : 10;
  const rounded = d.toSignificantDigits(sig);
  if (rounded.isZero()) return scalarFromInteger(0);
  const lit = scalarFromLiteral(rounded.toExponential(Math.max(0, sig - 1)));
  return { ...lit, preferDecimal: a.preferDecimal || !lit.exact };
}

export function applyUnitConversion(value: Scalar, token: string): Scalar {
  const conv = CONVERSION_BY_TOKEN.get(token);
  if (!conv) syntax('Unknown conversion');
  if (conv.kind === 'f-to-c') {
    return divide(multiply(subtract(value, scalarFromInteger(32)), scalarFromInteger(5)), scalarFromInteger(9));
  }
  if (conv.kind === 'c-to-f') {
    return add(divide(multiply(value, scalarFromInteger(9)), scalarFromInteger(5)), scalarFromInteger(32));
  }
  const factor = scalarFromLiteral(conv.factor!);
  const out = conv.inverse ? divide(value, factor) : multiply(value, factor);
  return { ...out, preferDecimal: true };
}

function angleScalarToExactDegrees(a: Scalar, angle: AngleUnit): Rational | undefined {
  if (angle === 'DEG' && a.exact) return a.exact;
  if (angle === 'GRA' && a.exact) return rational(a.exact.n * 9n, a.exact.d * 10n);
  if (angle === 'RAD') {
    if (a.exact && a.exact.n === ZERO) return { n: ZERO, d: ONE };
    if (a.symbolic?.kind === 'pi') return rational(a.symbolic.n * 180n, a.symbolic.d);
  }
  return undefined;
}

export function gcdScalar(a: Scalar, b: Scalar): Scalar {
  if (!a.decimal.isInteger() || !b.decimal.isInteger() || a.decimal.abs().gte('1e15') || b.decimal.abs().gte('1e15')) {
    mathError('GCD requires integers within ±10^15');
  }
  const na = BigInt(a.decimal.toFixed(0));
  const nb = BigInt(b.decimal.toFixed(0));
  if (na === ZERO && nb === ZERO) mathError('GCD(0,0) is undefined');
  const g = gcdBig(na, nb);
  return scalarFromInteger(g);
}

export function lcmScalar(a: Scalar, b: Scalar): Scalar {
  if (!a.decimal.isInteger() || !b.decimal.isInteger() || a.decimal.abs().gte('1e15') || b.decimal.abs().gte('1e15')) {
    mathError('LCM requires integers within ±10^15');
  }
  const na = BigInt(a.decimal.toFixed(0));
  const nb = BigInt(b.decimal.toFixed(0));
  if (na === ZERO || nb === ZERO) return scalarFromInteger(0);
  const l = lcmBig(na, nb);
  return makeScalar(l.toString(), rational(l));
}

export function intPartScalar(a: Scalar): Scalar {
  const trunc = a.decimal.truncated();
  if (trunc.abs().lt('1e20')) {
    return scalarFromInteger(BigInt(trunc.toFixed(0)));
  }
  return makeScalar(trunc, undefined, true);
}

export function floorIntgScalar(a: Scalar): Scalar {
  const fl = a.decimal.floor();
  if (fl.abs().lt('1e20')) {
    return scalarFromInteger(BigInt(fl.toFixed(0)));
  }
  return makeScalar(fl, undefined, true);
}

export function quotientRemainder(a: Scalar, b: Scalar): { quotient: Scalar; remainder: Scalar } {
  if (!a.decimal.isInteger() || !b.decimal.isInteger() || a.decimal.lt(0) || b.decimal.lte(0) || a.decimal.gte('1e100') || b.decimal.gte('1e100')) {
    mathError('÷R requires non-negative dividend and positive integer divisor within range');
  }
  const dividend = BigInt(a.decimal.toFixed(0));
  const divisor = BigInt(b.decimal.toFixed(0));
  const q = dividend / divisor;
  const r = dividend % divisor;
  return {
    quotient: makeScalar(q.toString(), rational(q)),
    remainder: makeScalar(r.toString(), rational(r)),
  };
}

export function scalarFromRecurring(intStr: string, nonRepeatStr: string, repeatStr: string): Scalar {
  const r = parseRecurringRational(intStr, nonRepeatStr, repeatStr);
  if (!r) syntax('Invalid recurring decimal');
  const dec = new D(r.n.toString()).div(r.d.toString());
  return makeScalar(dec, rational(r.n, r.d), false);
}

export function applyFunction(
  name: string,
  args: Scalar[],
  angle: AngleUnit,
  options?: { random?: number; rng?: () => number; numberFormat?: NumberFormatSetting },
): Scalar {
  if (name === 'mfrac') {
    if (args.length !== 3) syntax('Wrong number of arguments');
    return mixedFraction(args[0], args[1], args[2]);
  }
  const two =
    name === 'frac' ||
    name === 'logb' ||
    name === 'root' ||
    name === 'Pol' ||
    name === 'Rec' ||
    name === 'RanInt' ||
    name === 'RanInt#' ||
    name === 'GCD' ||
    name === 'LCM';
  if (args.length !== (two ? 2 : 1)) syntax('Wrong number of arguments');
  const a = args[0];
  const x = a.decimal;
  switch (name) {
    case 'frac': return divide(a, args[1]);
    case 'GCD': return gcdScalar(a, args[1]);
    case 'LCM': return lcmScalar(a, args[1]);
    case 'Int': return intPartScalar(a);
    case 'Intg': return floorIntgScalar(a);
    case 'Pol': return polarFromRect(a, args[1], angle).r;
    case 'Rec': return rectFromPolar(a, args[1], angle).x;
    case 'RanInt':
    case 'RanInt#':
      return randomInteger(a, args[1], options?.rng ? options.rng() : options?.random);
    case 'Rnd': return roundScalar(a, options?.numberFormat);
    case 'abs': return x.isNegative() ? negate(a) : a;
    case 'sqrt': {
      if (x.isNegative()) mathError('Square root of a negative number');
      if (a.exact) {
        const sq = symbolicSqrtRational(a.exact.n, a.exact.d);
        if (sq && 'rational' in sq) {
          return makeScalar(x.sqrt(), rational(sq.rational.n, sq.rational.d), a.preferDecimal);
        }
        if (sq && 'kind' in sq) {
          return makeScalar(x.sqrt(), undefined, a.preferDecimal, sq);
        }
      }
      if (a.symbolic?.kind === 'surd') {
        const denested = symbolicSqrtSurd(a.symbolic);
        if (denested?.exact) {
          return makeScalar(x.sqrt(), rational(denested.exact.n, denested.exact.d), a.preferDecimal);
        }
        if (denested?.symbolic) {
          return makeScalar(x.sqrt(), undefined, a.preferDecimal, denested.symbolic);
        }
      }
      return makeScalar(x.sqrt(), undefined, a.preferDecimal);
    }
    case 'cbrt': {
      if (a.exact) {
        const rt = exactRationalNthRoot(a.exact, 3);
        if (rt) {
          return makeScalar(x.cbrt(), rt, a.preferDecimal);
        }
      }
      return makeScalar(x.cbrt(), undefined, a.preferDecimal);
    }
    case 'root': {
      const radScalar = args[1];
      const radicand = radScalar.decimal;
      if (x.isZero()) mathError('Zero root index');
      if (a.exact && a.exact.d === ONE && absBig(a.exact.n) >= ONE && absBig(a.exact.n) <= 60n) {
        const k = Number(absBig(a.exact.n));
        const negIdx = a.exact.n < ZERO;
        if (radicand.isZero()) {
          if (negIdx) mathError('Division by zero');
          return scalarFromInteger(0);
        }
        if (k === 2 && !radicand.isNegative()) {
          const sq = applyFunction('sqrt', [radScalar], angle, options);
          return negIdx ? divide(scalarFromInteger(1), sq) : sq;
        }
        if (radScalar.exact) {
          const rt = exactRationalNthRoot(radScalar.exact, k);
          if (rt) {
            const pref = a.preferDecimal || radScalar.preferDecimal;
            const exact = negIdx ? rational(rt.d, rt.n) : rt;
            const decVal = radicand.isNegative()
              ? radicand.neg().pow(new D(1).div(x)).neg()
              : radicand.pow(new D(1).div(x));
            return makeScalar(decVal, exact, pref);
          }
        }
      }
      if (radicand.isZero()) {
        if (x.isNegative()) mathError('Division by zero');
        return scalarFromInteger(0);
      }
      if (radicand.isNegative()) {
        if (!x.isInteger() || !x.mod(2).abs().eq(1)) mathError('Non-real root');
        return makeScalar(radicand.neg().pow(new D(1).div(x)).neg(), undefined, true);
      }
      return makeScalar(radicand.pow(new D(1).div(x)), undefined, true);
    }
    case 'ln': {
      if (x.lte(0)) mathError('Logarithm domain');
      if (a.exact && a.exact.n === ONE && a.exact.d === ONE) return scalarFromInteger(0);
      const val = x.ln();
      const nearInt = val.round();
      if (nearInt.abs().lte(50) && val.minus(nearInt).abs().lt('1e-26')) {
        const expCheck = nearInt.exp();
        if (expCheck.minus(x).abs().lte(D.max(x, new D(1)).times('1e-26'))) {
          return makeScalar(nearInt, rational(BigInt(nearInt.toFixed(0))), a.preferDecimal);
        }
      }
      return makeScalar(val, undefined, true);
    }
    case 'log': {
      if (x.lte(0)) mathError('Logarithm domain');
      const exactLog = exactRationalLog(scalarFromInteger(10), a);
      if (exactLog) return makeScalar(x.log(10), exactLog, a.preferDecimal);
      return makeScalar(x.log(10), undefined, true);
    }
    case 'logb': {
      const yScalar = args[1];
      const y = yScalar.decimal;
      if (x.lte(0) || x.eq(1) || y.lte(0)) mathError('Logarithm domain');
      const exactLog = exactRationalLog(a, yScalar);
      const val = y.ln().div(x.ln());
      if (exactLog) return makeScalar(val, exactLog, a.preferDecimal || yScalar.preferDecimal);
      return makeScalar(val, undefined, true);
    }
    case 'sin': case 'cos': case 'tan': {
      const exactDeg = angleScalarToExactDegrees(a, angle);
      if (name === 'tan') {
        if (exactDeg && exactDeg.d === ONE && (((exactDeg.n % 180n) + 180n) % 180n) === 90n) {
          mathError('Undefined tangent');
        }
        if ((angle === 'DEG' && x.mod(180).abs().eq(90)) || (angle === 'GRA' && x.mod(200).abs().eq(100))) {
          mathError('Undefined tangent');
        }
      }
      const rad = toRadians(x, angle);
      if (name === 'tan' && rad.cos().abs().lt('1e-30')) {
        mathError('Undefined tangent');
      }
      const raw = name === 'sin' ? rad.sin() : name === 'cos' ? rad.cos() : rad.tan();
      if (exactDeg) {
        const trigSym = exactTrigDegrees(name, exactDeg.n, exactDeg.d);
        if (trigSym?.exact) {
          const ex = rational(trigSym.exact.n, trigSym.exact.d);
          const cleanDec = ex ? new D(ex.n.toString()).div(ex.d.toString()) : raw;
          return makeScalar(cleanDec, ex, a.preferDecimal);
        }
        if (trigSym?.symbolic) {
          return makeScalar(raw, undefined, a.preferDecimal, trigSym.symbolic);
        }
      }
      const fallbackExact = simpleExact(raw);
      const rounded = fallbackExact ? new D(fallbackExact.n.toString()).div(fallbackExact.d.toString()) : raw;
      return makeScalar(rounded, fallbackExact, a.preferDecimal || !fallbackExact);
    }
    case 'asin': case 'acos': case 'atan': {
      if ((name === 'asin' || name === 'acos') && x.abs().gt(1)) mathError('Inverse trigonometric domain');
      const rawRad = name === 'asin' ? x.asin() : name === 'acos' ? x.acos() : x.atan();
      const result = fromRadians(rawRad, angle);
      const degExact = exactInverseTrigDegrees(name, a);
      if (degExact !== null) {
        if (angle === 'DEG') {
          return makeScalar(degExact.toString(), rational(degExact, ONE), false);
        }
        if (angle === 'GRA') {
          const r = rational(degExact * 10n, 9n);
          return makeScalar(result, r, false);
        }
        // RAD -> exact rational multiple of π!
        if (degExact === ZERO) return scalarFromInteger(0);
        const piSym = makePiMultiple(degExact, 180n);
        if (piSym && 'kind' in piSym) {
          return makeScalar(result, undefined, false, piSym);
        }
      }
      return makeScalar(result, simpleExact(result), true);
    }
    case 'sinh': return makeScalar(x.sinh(), undefined, true);
    case 'cosh': return makeScalar(x.cosh(), undefined, true);
    case 'tanh': return makeScalar(x.tanh(), undefined, true);
    case 'asinh': return makeScalar(x.asinh(), undefined, true);
    case 'acosh': if (x.lt(1)) mathError('Inverse hyperbolic domain'); return makeScalar(x.acosh(), undefined, true);
    case 'atanh': if (x.abs().gte(1)) mathError('Inverse hyperbolic domain'); return makeScalar(x.atanh(), undefined, true);
    default: return syntax('Unknown function');
  }
}
