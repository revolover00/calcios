import Decimal from 'decimal.js';
import { CONVERSION_BY_TOKEN } from './constants';
import { mathError, syntax } from './errors';
import { DEFAULT_NUMBER_FORMAT, toSuperscript, type NumberFormatSetting } from './format';

/** Internal decimal arithmetic has guard digits. Display rounding happens only at the edge. */
export const D = Decimal.clone({ precision: 34, rounding: Decimal.ROUND_HALF_UP, maxE: 10000, minE: -10000 });
export type AngleUnit = 'DEG' | 'RAD' | 'GRA';
export type VariableName = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'X' | 'Y' | 'M';
export const VARIABLES: VariableName[] = ['A', 'B', 'C', 'D', 'E', 'F', 'X', 'Y', 'M'];

export interface Rational { n: bigint; d: bigint }
export interface Scalar { decimal: Decimal; exact?: Rational; preferDecimal: boolean }
export interface StoredScalar { decimal: string; numerator?: string; denominator?: string; preferDecimal: boolean }

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

/** Rational results are optional: drop exact representation rather than growing without bound. */
export function rational(n: bigint, d = ONE): Rational | undefined {
  if (d === ZERO) mathError('Division by zero');
  if (d < ZERO) { n = -n; d = -d; }
  const g = gcd(n, d);
  n /= g; d /= g;
  if (absBig(n).toString().length > MAX_EXACT_DIGITS || d.toString().length > MAX_EXACT_DIGITS) return undefined;
  return { n, d };
}

export function makeScalar(value: Decimal.Value, exact?: Rational, preferDecimal = false): Scalar {
  const number = new D(value);
  if (!number.isFinite() || number.abs().gte(LIMIT)) mathError('Result outside the supported range');
  return { decimal: number, exact, preferDecimal };
}

export function scalarFromInteger(value: number | bigint): Scalar {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  return makeScalar(n.toString(), rational(n));
}

export function scalarFromLiteral(literal: string): Scalar {
  if (!/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(literal)) syntax('Invalid number');
  const [base, expText = '0'] = literal.toLowerCase().split('e');
  const exponent = Number(expText);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) mathError('Exponent out of range');
  const [integer, fraction = ''] = base.split('.');
  const digits = `${integer || '0'}${fraction}`;
  let numerator = BigInt(digits || '0');
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
  return { decimal: value.decimal.toString(), numerator: value.exact?.n.toString(), denominator: value.exact?.d.toString(), preferDecimal: value.preferDecimal };
}
export function deserialize(value: StoredScalar): Scalar {
  const exact = value.numerator !== undefined && value.denominator !== undefined
    ? rational(BigInt(value.numerator), BigInt(value.denominator)) : undefined;
  return makeScalar(value.decimal, exact, value.preferDecimal);
}
export function zeroStored(): StoredScalar { return serialize(scalarFromInteger(0)); }

export function negate(a: Scalar): Scalar {
  return makeScalar(a.decimal.neg(), a.exact && rational(-a.exact.n, a.exact.d), a.preferDecimal);
}
export function add(a: Scalar, b: Scalar): Scalar {
  const r = a.exact && b.exact && rational(a.exact.n * b.exact.d + b.exact.n * a.exact.d, a.exact.d * b.exact.d);
  return makeScalar(a.decimal.plus(b.decimal), r, a.preferDecimal || b.preferDecimal);
}
export function subtract(a: Scalar, b: Scalar): Scalar { return add(a, negate(b)); }
export function multiply(a: Scalar, b: Scalar): Scalar {
  const r = a.exact && b.exact && rational(a.exact.n * b.exact.n, a.exact.d * b.exact.d);
  return makeScalar(a.decimal.times(b.decimal), r, a.preferDecimal || b.preferDecimal);
}
export function divide(a: Scalar, b: Scalar): Scalar {
  if (b.decimal.isZero()) mathError('Division by zero');
  const r = a.exact && b.exact && rational(a.exact.n * b.exact.d, a.exact.d * b.exact.n);
  return makeScalar(a.decimal.dividedBy(b.decimal), r, a.preferDecimal || b.preferDecimal);
}
export function power(a: Scalar, b: Scalar): Scalar {
  if (a.decimal.isZero() && b.decimal.lte(0)) mathError('Invalid power');
  if (a.decimal.isNegative() && !b.decimal.isInteger()) mathError('Non-real power');
  if (b.decimal.abs().gt(10000)) mathError('Exponent out of range');
  let exact: Rational | undefined;
  if (a.exact && b.decimal.isInteger() && b.decimal.abs().lte(100)) {
    const exponent = b.decimal.toNumber();
    const e = BigInt(Math.abs(exponent));
    const n = a.exact.n ** e, d = a.exact.d ** e;
    exact = exponent < 0 ? rational(d, n) : rational(n, d);
  }
  return makeScalar(a.decimal.pow(b.decimal), exact, a.preferDecimal || b.preferDecimal);
}
export function factorial(a: Scalar): Scalar {
  if (!a.decimal.isInteger() || a.decimal.isNegative() || a.decimal.gt(69)) mathError('Factorial out of range');
  let result = ONE;
  for (let i = 2n; i <= BigInt(a.decimal.toFixed(0)); i++) result *= i;
  return makeScalar(result.toString(), rational(result));
}
export function combinatoric(a: Scalar, b: Scalar, permutation: boolean): Scalar {
  if (!a.decimal.isInteger() || !b.decimal.isInteger() || a.decimal.isNegative() || b.decimal.isNegative() || b.decimal.gt(a.decimal) || a.decimal.gt('1e10')) mathError('Invalid combination');
  const n = BigInt(a.decimal.toFixed(0));
  let k = BigInt(b.decimal.toFixed(0));
  if (!permutation && k > n - k) k = n - k;
  if (k > 1000n) mathError('Combination is too large');
  let result = ONE;
  for (let i = ONE; i <= k; i++) {
    result *= n - i + ONE;
    if (!permutation) result /= i;
    if (result.toString().length > 101) mathError('Result outside the supported range');
  }
  return makeScalar(result.toString(), rational(result));
}

export function mixedFraction(whole: Scalar, num: Scalar, den: Scalar): Scalar {
  if (den.decimal.isZero()) mathError('Division by zero');
  if (num.decimal.isNegative() || den.decimal.isNegative()) mathError('Invalid mixed fraction');
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

function integerSqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) { const next = (x + n / x) >> 1n; if (next >= x) return x; x = next; }
}
function simpleExact(value: Decimal): Rational | undefined {
  // Do not rationalize arbitrary approximations: recognize only stable simple trig constants.
  const candidates: Rational[] = [{ n: 0n, d: 1n }, { n: 1n, d: 2n }, { n: -1n, d: 2n }, { n: 1n, d: 1n }, { n: -1n, d: 1n }];
  return candidates.find(({ n, d }) => value.minus(new D(n.toString()).div(d.toString())).abs().lt('1e-28'));
}
function exactSqrt(a: Scalar): Rational | undefined {
  if (!a.exact || a.exact.n < ZERO) return undefined;
  const n = integerSqrt(a.exact.n), d = integerSqrt(a.exact.d);
  return n * n === a.exact.n && d * d === a.exact.d ? rational(n, d) : undefined;
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
    // DEG <-> GRA is exact rational (9/10 or 10/9)
    const num = sourceUnit === 'DEG' ? 10 : 9;
    const den = sourceUnit === 'DEG' ? 9 : 10;
    return divide(multiply(value, scalarFromInteger(num)), scalarFromInteger(den));
  }
  const rad = toRadians(value.decimal, sourceUnit);
  const converted = fromRadians(rad, activeUnit);
  return makeScalar(converted, simpleExact(converted), true);
}

export function polarFromRect(x: Scalar, y: Scalar, angle: AngleUnit): { r: Scalar; theta: Scalar } {
  const sumSq = add(multiply(x, x), multiply(y, y));
  const r = makeScalar(sumSq.decimal.sqrt(), exactSqrt(sumSq), true);
  const rawTheta = x.decimal.isZero() && y.decimal.isZero()
    ? new D(0)
    : fromRadians(D.atan2(y.decimal, x.decimal), angle);
  return { r, theta: makeScalar(rawTheta, simpleExact(rawTheta), true) };
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
  if (setting.mode === 'Fix') {
    const rounded = d.toDecimalPlaces(setting.digits);
    return scalarFromLiteral(rounded.toFixed(setting.digits));
  }
  const sig = setting.mode === 'Sci' ? (setting.digits === 0 ? 10 : setting.digits) : 10;
  const rounded = d.toSignificantDigits(sig);
  return makeScalar(rounded, undefined, true);
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

export function applyFunction(
  name: string,
  args: Scalar[],
  angle: AngleUnit,
  options?: { random?: number; numberFormat?: NumberFormatSetting },
): Scalar {
  if (name === 'mfrac') {
    if (args.length !== 3) syntax('Wrong number of arguments');
    return mixedFraction(args[0], args[1], args[2]);
  }
  const two = name === 'frac' || name === 'logb' || name === 'root' || name === 'Pol' || name === 'Rec' || name === 'RanInt';
  if (args.length !== (two ? 2 : 1)) syntax('Wrong number of arguments');
  const a = args[0];
  const x = a.decimal;
  switch (name) {
    case 'frac': return divide(a, args[1]);
    case 'Pol': return polarFromRect(a, args[1], angle).r;
    case 'Rec': return rectFromPolar(a, args[1], angle).x;
    case 'RanInt': return randomInteger(a, args[1], options?.random);
    case 'Rnd': return roundScalar(a, options?.numberFormat);
    case 'abs': return x.isNegative() ? negate(a) : a;
    case 'sqrt':
      if (x.isNegative()) mathError('Square root of a negative number');
      return makeScalar(x.sqrt(), exactSqrt(a), a.preferDecimal);
    case 'cbrt': return makeScalar(x.cbrt(), undefined, a.preferDecimal);
    case 'root': {
      const radicand = args[1].decimal;
      if (x.isZero()) mathError('Zero root index');
      if (radicand.isNegative()) {
        if (!x.isInteger() || !x.mod(2).abs().eq(1)) mathError('Non-real root');
        return makeScalar(radicand.neg().pow(new D(1).div(x)).neg(), undefined, true);
      }
      return makeScalar(radicand.pow(new D(1).div(x)), undefined, true);
    }
    case 'ln': if (x.lte(0)) mathError('Logarithm domain'); return makeScalar(x.ln(), undefined, true);
    case 'log': if (x.lte(0)) mathError('Logarithm domain'); return makeScalar(x.log(10), undefined, true);
    case 'logb': {
      const y = args[1].decimal;
      if (x.lte(0) || x.eq(1) || y.lte(0)) mathError('Logarithm domain');
      return makeScalar(y.ln().div(x.ln()), undefined, true);
    }
    case 'sin': case 'cos': case 'tan': {
      if (name === 'tan' && ((angle === 'DEG' && x.mod(180).abs().eq(90)) || (angle === 'GRA' && x.mod(200).abs().eq(100)))) mathError('Undefined tangent');
      const rad = toRadians(x, angle);
      const result = name === 'sin' ? rad.sin() : name === 'cos' ? rad.cos() : rad.tan();
      const exact = simpleExact(result);
      const rounded = exact ? new D(exact.n.toString()).div(exact.d.toString()) : result;
      return makeScalar(rounded, exact, a.preferDecimal);
    }
    case 'asin': case 'acos': case 'atan': {
      if ((name === 'asin' || name === 'acos') && x.abs().gt(1)) mathError('Inverse trigonometric domain');
      const result = fromRadians(name === 'asin' ? x.asin() : name === 'acos' ? x.acos() : x.atan(), angle);
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
