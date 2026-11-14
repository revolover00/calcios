import { CONSTANT_BY_TOKEN } from './constants';
import { CalculatorError, mathError, syntax } from './errors';
import { completeParentheses } from './expression';
import { normalizeInverseTrigNotation } from './trigNotation';
import {
  formatDecimal, formatResult, formatSymbolicLinear,
  type DecimalMark, type DisplayValue, type NumberFormatSetting,
} from './format';
import {
  D, VARIABLES, add, applyFunction, applyUnitConversion, combinatoric, convertAngleToActive,
  deserialize, divide, dmsToScalar, factorial, fromRadians, makeScalar,
  multiply, negate, polarFromRect, power, randomInteger, rectFromPolar,
  scalarFromInteger, scalarFromLiteral, scalarFromRecurring,
  scalarPi, serialize, subtract, zeroStored,
  type AngleUnit, type Scalar, type StoredScalar, type VariableName,
} from './value';

export type ComplexFormat = 'rect' | 'polar';

export interface Complex {
  re: Scalar;
  im: Scalar;
}

function isNumericalZero(value: Scalar, tolerance: string): boolean {
  if (value.exact) return value.exact.n === 0n;
  if (value.symbolic) return false;
  return value.decimal.abs().lt(tolerance);
}

export interface StoredComplex {
  re: StoredScalar;
  im: StoredScalar;
}

export function zeroStoredComplex(): StoredComplex {
  return { re: zeroStored(), im: zeroStored() };
}

export function serializeComplex(z: Complex): StoredComplex {
  return { re: serialize(z.re), im: serialize(z.im) };
}

export function deserializeComplex(z: StoredComplex): Complex {
  return { re: deserialize(z.re), im: deserialize(z.im) };
}

export function realToComplex(s: Scalar): Complex {
  return { re: s, im: scalarFromInteger(0) };
}

export function addComplex(a: Complex, b: Complex): Complex {
  return { re: add(a.re, b.re), im: add(a.im, b.im) };
}

export function subComplex(a: Complex, b: Complex): Complex {
  return { re: subtract(a.re, b.re), im: subtract(a.im, b.im) };
}

export function negComplex(a: Complex): Complex {
  return { re: negate(a.re), im: negate(a.im) };
}

export function conjComplex(a: Complex): Complex {
  return { re: a.re, im: negate(a.im) };
}

export function mulComplex(a: Complex, b: Complex): Complex {
  return {
    re: subtract(multiply(a.re, b.re), multiply(a.im, b.im)),
    im: add(multiply(a.re, b.im), multiply(a.im, b.re)),
  };
}

export function divComplex(a: Complex, b: Complex): Complex {
  const maxDen = D.max(b.re.decimal.abs(), b.im.decimal.abs());
  if (maxDen.isZero()) mathError('Division by zero');
  if (maxDen.gte('1e45')) {
    // Smith's algorithm avoids intermediate c² + d² overflow for large magnitudes
    const ar = a.re.decimal;
    const ai = a.im.decimal;
    const br = b.re.decimal;
    const bi = b.im.decimal;
    if (br.abs().gte(bi.abs())) {
      const r = bi.div(br);
      const den = br.plus(bi.times(r));
      return {
        re: makeScalar(ar.plus(ai.times(r)).div(den), undefined, true),
        im: makeScalar(ai.minus(ar.times(r)).div(den), undefined, true),
      };
    }
    const r = br.div(bi);
    const den = bi.plus(br.times(r));
    return {
      re: makeScalar(ar.times(r).plus(ai).div(den), undefined, true),
      im: makeScalar(ai.times(r).minus(ar).div(den), undefined, true),
    };
  }
  const denom = add(multiply(b.re, b.re), multiply(b.im, b.im));
  if (denom.decimal.isZero()) mathError('Division by zero');
  const numRe = add(multiply(a.re, b.re), multiply(a.im, b.im));
  const numIm = subtract(multiply(a.im, b.re), multiply(a.re, b.im));
  return { re: divide(numRe, denom), im: divide(numIm, denom) };
}

export function absComplex(a: Complex, angle: AngleUnit): Complex {
  const maxAbs = D.max(a.re.decimal.abs(), a.im.decimal.abs());
  if (maxAbs.isZero()) return realToComplex(scalarFromInteger(0));
  if (maxAbs.gte('1e45')) {
    const hypot = maxAbs.times(
      a.re.decimal.div(maxAbs).pow(2).plus(a.im.decimal.div(maxAbs).pow(2)).sqrt(),
    );
    return realToComplex(makeScalar(hypot, undefined, true));
  }
  const normSq = add(multiply(a.re, a.re), multiply(a.im, a.im));
  return realToComplex(applyFunction('sqrt', [normSq], angle));
}

export function argComplex(a: Complex, angle: AngleUnit): Complex {
  if (a.re.decimal.isZero() && a.im.decimal.isZero()) mathError('Argument of 0 is undefined');
  const halfTurn =
    angle === 'RAD' ? scalarPi() : angle === 'GRA' ? scalarFromInteger(200) : scalarFromInteger(180);
  const quarterTurn = divide(halfTurn, scalarFromInteger(2));

  if (a.re.decimal.isZero()) {
    return realToComplex(a.im.decimal.gt(0) ? quarterTurn : negate(quarterTurn));
  }
  if (a.im.decimal.isZero()) {
    return realToComplex(a.re.decimal.gt(0) ? scalarFromInteger(0) : halfTurn);
  }

  const ratio = divide(a.im, a.re);
  const baseAtan = applyFunction('atan', [ratio], angle);
  if (!baseAtan.preferDecimal) {
    if (a.re.decimal.gt(0)) return realToComplex(baseAtan);
    return realToComplex(a.im.decimal.gte(0) ? add(baseAtan, halfTurn) : subtract(baseAtan, halfTurn));
  }

  const rad = D.atan2(a.im.decimal, a.re.decimal);
  const converted = fromRadians(rad, angle);
  return realToComplex(makeScalar(converted, undefined, true));
}

export function polarPhasor(r: Complex, theta: Complex, angle: AngleUnit): Complex {
  if (!r.im.decimal.isZero() || !theta.im.decimal.isZero()) mathError('Invalid phasor operand');
  const c = applyFunction('cos', [theta.re], angle);
  const s = applyFunction('sin', [theta.re], angle);
  return { re: multiply(r.re, c), im: multiply(r.re, s) };
}

export function expComplex(z: Complex): Complex {
  const cosB = applyFunction('cos', [z.im], 'RAD');
  const sinB = applyFunction('sin', [z.im], 'RAD');
  if (z.re.decimal.isZero()) {
    return { re: cosB, im: sinB };
  }
  const expA = makeScalar(z.re.decimal.exp(), undefined, true);
  return { re: multiply(expA, cosB), im: multiply(expA, sinB) };
}

export function lnComplex(z: Complex): Complex {
  if (z.re.decimal.isZero() && z.im.decimal.isZero()) mathError('Logarithm of 0 is undefined');
  const mod = absComplex(z, 'RAD').re;
  const thetaRad = argComplex(z, 'RAD').re;
  const lnMod = mod.exact && mod.exact.n === 1n && mod.exact.d === 1n
    ? scalarFromInteger(0)
    : makeScalar(mod.decimal.ln(), undefined, true);
  return { re: lnMod, im: thetaRad };
}

export function powComplex(base: Complex, exp: Complex, angle: AngleUnit): Complex {
  const baseIsZero = base.re.decimal.isZero() && base.im.decimal.isZero();
  const expIsZero = exp.re.decimal.isZero() && exp.im.decimal.isZero();
  if (baseIsZero && expIsZero) mathError('0^0');

  if (exp.im.decimal.isZero() && exp.re.decimal.isInteger() && exp.re.decimal.abs().lte(60)) {
    const n = exp.re.decimal.toNumber();
    if (n === 0) return realToComplex(scalarFromInteger(1));
    if (baseIsZero) {
      if (n < 0) mathError('Division by zero');
      return realToComplex(scalarFromInteger(0));
    }
    let acc = realToComplex(scalarFromInteger(1));
    let cur = base;
    let k = Math.abs(n);
    while (k > 0) {
      if (k & 1) acc = mulComplex(acc, cur);
      k >>= 1;
      if (k > 0) cur = mulComplex(cur, cur);
    }
    if (n < 0) return divComplex(realToComplex(scalarFromInteger(1)), acc);
    return acc;
  }

  if (baseIsZero) {
    if (exp.re.decimal.lte(0)) mathError('Invalid power of 0');
    return realToComplex(scalarFromInteger(0));
  }

  // Exact fast-path when base is Euler's constant e: e^(z) = expComplex(z)
  if (base.im.decimal.isZero() && base.re.decimal.eq(new D(1).exp())) {
    return expComplex(exp);
  }

  if (exp.im.decimal.isZero() && base.im.decimal.isZero() && !base.re.decimal.isNegative()) {
    return realToComplex(power(base.re, exp.re));
  }

  if (exp.im.decimal.isZero() && exp.re.exact && exp.re.exact.d === 2n && (exp.re.exact.n === 1n || exp.re.exact.n === -1n)) {
    const sq = sqrtComplex(base, angle);
    return exp.re.exact.n === 1n ? sq : divComplex(realToComplex(scalarFromInteger(1)), sq);
  }

  // General principal complex power: base^exp = exp(exp * ln(base))
  return expComplex(mulComplex(exp, lnComplex(base)));
}

export function sqrtComplex(z: Complex, angle: AngleUnit): Complex {
  if (z.im.decimal.isZero()) {
    if (!z.re.decimal.isNegative()) {
      return realToComplex(applyFunction('sqrt', [z.re], angle));
    }
    return { re: scalarFromInteger(0), im: applyFunction('sqrt', [negate(z.re)], angle) };
  }
  const modS = absComplex(z, angle).re;
  const halfRePlus = divide(add(modS, z.re), scalarFromInteger(2));
  const halfReMinus = divide(subtract(modS, z.re), scalarFromInteger(2));
  const two = scalarFromInteger(2);
  if (z.re.decimal.isNegative()) {
    // The usual sqrt((|z| + Re(z))/2) subtracts nearly equal numbers here;
    // derive the small real component from 2ab = Im(z) instead.
    const imAbs = applyFunction('sqrt', [halfReMinus], angle);
    const re = divide(z.im.decimal.isNegative() ? negate(z.im) : z.im, multiply(two, imAbs));
    return { re, im: z.im.decimal.isNegative() ? negate(imAbs) : imAbs };
  }
  const re = applyFunction('sqrt', [halfRePlus], angle);
  const im = divide(z.im, multiply(two, re));
  return { re, im };
}

function inverseAngleFromRadians(z: Complex, angle: AngleUnit): Complex {
  if (angle === 'RAD') return z;
  const factor = divide(scalarFromInteger(angle === 'DEG' ? 180 : 200), scalarPi());
  return { re: multiply(z.re, factor), im: multiply(z.im, factor) };
}

function complexInverseFunction(name: string, z: Complex, angle: AngleUnit): Complex {
  const zero = scalarFromInteger(0);
  const one = realToComplex(scalarFromInteger(1));
  const i = { re: zero, im: scalarFromInteger(1) };
  const iz = mulComplex(i, z);
  const z2 = mulComplex(z, z);
  if (name === 'asin' || name === 'acos') {
    const ln = lnComplex(addComplex(iz, sqrtComplex(subComplex(one, z2), 'RAD')));
    const asinRad = { re: ln.im, im: negate(ln.re) };
    if (name === 'asin') return inverseAngleFromRadians(asinRad, angle);
    const halfTurn = angle === 'RAD' ? scalarPi() : scalarFromInteger(angle === 'DEG' ? 180 : 200);
    return { re: subtract(divide(halfTurn, scalarFromInteger(2)), inverseAngleFromRadians(asinRad, angle).re),
      im: negate(inverseAngleFromRadians(asinRad, angle).im) };
  }
  if (name === 'atan') {
    const ratio = divComplex(addComplex(one, iz), subComplex(one, iz));
    const ln = lnComplex(ratio);
    const half = scalarFromInteger(2);
    return inverseAngleFromRadians({ re: divide(ln.im, half), im: negate(divide(ln.re, half)) }, angle);
  }
  if (name === 'asinh') {
    return lnComplex(addComplex(z, sqrtComplex(addComplex(z2, one), 'RAD')));
  }
  if (name === 'acosh') {
    const root = mulComplex(
      sqrtComplex(subComplex(z, one), 'RAD'),
      sqrtComplex(addComplex(z, one), 'RAD'),
    );
    return lnComplex(addComplex(z, root));
  }
  if (name === 'atanh') {
    const ln = lnComplex(divComplex(addComplex(one, z), subComplex(one, z)));
    return { re: divide(ln.re, scalarFromInteger(2)), im: divide(ln.im, scalarFromInteger(2)) };
  }
  return mathError(`${name} requires real argument`);
}

function complexTrig(name: string, z: Complex, angle: AngleUnit): Complex {
  const rawX = z.re.decimal;
  const x = name === 'sin' || name === 'cos' || name === 'tan'
    ? angle === 'DEG' ? rawX.times(D.acos(-1)).div(180)
      : angle === 'GRA' ? rawX.times(D.acos(-1)).div(200)
        : rawX
    : rawX;
  const y = z.im.decimal;
  switch (name) {
    case 'sin':
      return {
        re: makeScalar(x.sin().times(y.cosh()), undefined, true),
        im: makeScalar(x.cos().times(y.sinh()), undefined, true),
      };
    case 'cos':
      return {
        re: makeScalar(x.cos().times(y.cosh()), undefined, true),
        im: makeScalar(x.sin().times(y.sinh()).neg(), undefined, true),
      };
    case 'tan':
      return divComplex(complexTrig('sin', z, angle), complexTrig('cos', z, angle));
    case 'sinh':
      return {
        re: makeScalar(x.sinh().times(y.cos()), undefined, true),
        im: makeScalar(x.cosh().times(y.sin()), undefined, true),
      };
    case 'cosh':
      return {
        re: makeScalar(x.cosh().times(y.cos()), undefined, true),
        im: makeScalar(x.sinh().times(y.sin()), undefined, true),
      };
    case 'tanh':
      return divComplex(complexTrig('sinh', z, angle), complexTrig('cosh', z, angle));
    default:
      return mathError(`${name} requires real argument`);
  }
}

type CmplxToken =
  | { type: 'number'; text: string; offset: number }
  | { type: 'recur'; parts: [string, string, string]; offset: number }
  | { type: 'i'; offset: number }
  | { type: 'id'; text: string; offset: number }
  | { type: 'op'; text: string; offset: number }
  | { type: 'dms'; offset: number }
  | { type: 'postfix'; text: string; offset: number }
  | { type: 'open'; offset: number }
  | { type: 'close'; offset: number }
  | { type: 'comma'; offset: number }
  | { type: 'end'; offset: number };

const CMPLX_FUNCS = [
  'Conjg', 'mfrac', 'cbrt', 'root', 'logb', 'arg', 'abs', 'sqrt', 'frac',
  'asinh', 'acosh', 'atanh', 'sinh', 'cosh', 'tanh',
  'asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'ln', 'log',
  'RanInt#', 'RanInt', 'Pol', 'Rec',
  'Intg', 'GCD', 'LCM', 'Int', 'Rnd',
];
const VAR_SET = new Set<string>(VARIABLES);

function tokenizeCmplx(source: string): CmplxToken[] {
  source = normalizeInverseTrigNotation(source);
  const tokens: CmplxToken[] = [];
  let i = 0;
  const kwSorted = [...CMPLX_FUNCS, 'Ran#', 'PreAns', 'Ans', 'nCr', 'nPr'].sort((a, b) => b.length - a.length);
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    const rest = source.slice(i);

    if (rest.startsWith('▸r∠θ')) { tokens.push({ type: 'postfix', text: '▸polar', offset: i }); i += 4; continue; }
    if (rest.startsWith('▸a+bi')) { tokens.push({ type: 'postfix', text: '▸rect', offset: i }); i += 5; continue; }

    const convMatch = rest.match(/^▸conv(?:0[1-9]|[1-3]\d|40)/);
    if (convMatch) {
      tokens.push({ type: 'postfix', text: convMatch[0], offset: i });
      i += convMatch[0].length;
      continue;
    }

    const constMatch = rest.match(/^const(?:0[1-9]|[1-3]\d|40)/);
    if (constMatch) {
      tokens.push({ type: 'id', text: constMatch[0], offset: i });
      i += constMatch[0].length;
      continue;
    }

    const recMatch = rest.match(/^(?:(\d+)\.(\d*)|\.(\d*))r\((\d+)\)/);
    if (recMatch) {
      if (tokens[tokens.length - 1]?.type === 'number' || tokens[tokens.length - 1]?.type === 'recur') {
        syntax('Adjacent numbers are invalid', i);
      }
      const intPart = recMatch[1] ?? '0';
      const nonRep = recMatch[1] !== undefined ? (recMatch[2] ?? '') : (recMatch[3] ?? '');
      tokens.push({ type: 'recur', parts: [intPart, nonRep, recMatch[4]], offset: i });
      i += recMatch[0].length;
      continue;
    }

    const num = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (num) {
      if (tokens[tokens.length - 1]?.type === 'number' || tokens[tokens.length - 1]?.type === 'recur') {
        syntax('Adjacent numbers are invalid', i);
      }
      tokens.push({ type: 'number', text: num[0], offset: i });
      i += num[0].length;
      continue;
    }

    const fn = kwSorted.find((w) => rest.startsWith(w));
    if (fn) {
      tokens.push({ type: fn === 'nCr' || fn === 'nPr' ? 'op' : 'id', text: fn, offset: i });
      i += fn.length;
      continue;
    }

    if (ch === 'i') { tokens.push({ type: 'i', offset: i }); i++; continue; }
    if (VAR_SET.has(ch) || charIsPiOrE(ch)) { tokens.push({ type: 'id', text: ch, offset: i }); i++; continue; }
    if (ch === '°') { tokens.push({ type: 'dms', offset: i }); i++; continue; }
    if (ch === 'ᵈ' || ch === 'ʳ' || ch === 'ᵍ') { tokens.push({ type: 'postfix', text: ch, offset: i }); i++; continue; }
    if (ch === '!' || ch === '%') { tokens.push({ type: 'postfix', text: ch, offset: i }); i++; continue; }
    if ('+-−×÷*/^∠⏨'.includes(ch)) {
      tokens.push({ type: 'op', text: ch === '−' ? '-' : ch, offset: i });
      i++;
      continue;
    }
    if (ch === '(') { tokens.push({ type: 'open', offset: i }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'close', offset: i }); i++; continue; }
    if (ch === ',') { tokens.push({ type: 'comma', offset: i }); i++; continue; }
    syntax(`Unexpected character '${ch}' in CMPLX`, i);
  }
  tokens.push({ type: 'end', offset: source.length });
  return tokens;
}

function charIsPiOrE(ch: string): boolean {
  return ch === 'π' || ch === 'e';
}

export interface CmplxEvalContext {
  angle: AngleUnit;
  variables: Record<VariableName, StoredScalar>;
  varsIm?: Record<VariableName, StoredScalar>;
  cmplxAns: StoredComplex;
  cmplxPreAns?: StoredComplex;
  preAns?: StoredScalar;
  random?: number;
  rng?: () => number;
  numberFormat?: NumberFormatSetting;
}

export function evaluateComplex(
  source: string,
  ctx: CmplxEvalContext,
): { value: Complex; preferredFormat?: ComplexFormat } {
  try {
    const tokens = tokenizeCmplx(completeParentheses(source));
    let pos = 0;
    let parenDepth = 0;
    let preferredFormat: ComplexFormat | undefined;
    const peek = () => tokens[pos];
    const take = () => tokens[pos++];

    function parseExpr(minPrec: number): Complex {
      let left = parsePrefix();
      for (;;) {
        const next = peek();
        if (next.type === 'dms') {
          if (45 < minPrec) break;
          take();
          if (!left.im.decimal.isZero()) mathError('DMS requires real value');
          const parts: Scalar[] = [left.re];
          while (parts.length < 3 && tokens[pos + 1]?.type === 'dms') {
            const cur = peek();
            if (cur.type === 'number') {
              parts.push(scalarFromLiteral((take() as Extract<CmplxToken, { type: 'number' }>).text));
              take();
            } else if (cur.type === 'id' && VAR_SET.has(cur.text)) {
              take();
              take();
              parts.push(deserialize(ctx.variables[cur.text as VariableName]));
            } else {
              break;
            }
          }
          left = realToComplex(dmsToScalar(parts));
          continue;
        }
        if (next.type === 'postfix') {
          if (next.text === '▸polar' || next.text === '▸rect') {
            if (minPrec > 0 || parenDepth > 0 || tokens[pos + 1]?.type !== 'end') {
              syntax('Display conversion allowed only at end of expression', next.offset);
            }
            take();
            preferredFormat = next.text === '▸polar' ? 'polar' : 'rect';
            continue;
          }
          if (40 < minPrec) break;
          take();
          if (!left.im.decimal.isZero()) mathError('Postfix operator requires real value');
          if (next.text === '!') left = realToComplex(factorial(left.re));
          else if (next.text === '%') left = realToComplex(divide(left.re, scalarFromInteger(100)));
          else if (next.text === 'ᵈ') left = realToComplex(convertAngleToActive(left.re, 'DEG', ctx.angle));
          else if (next.text === 'ʳ') left = realToComplex(convertAngleToActive(left.re, 'RAD', ctx.angle));
          else if (next.text === 'ᵍ') left = realToComplex(convertAngleToActive(left.re, 'GRA', ctx.angle));
          else left = realToComplex(applyUnitConversion(left.re, next.text));
          continue;
        }
        let op: string | undefined;
        let prec = 0;
        let implicit = false;
        if (next.type === 'op') {
          op = next.text;
          prec = op === '+' || op === '-' ? 10
            : ['×', '÷', '*', '/'].includes(op) ? 20
            : op === 'nCr' || op === 'nPr' ? 25
            : op === '^' ? 30
            : op === '⏨' ? 32
            : op === '∠' ? 35 : 0;
        } else if (
          next.type === 'number' ||
          next.type === 'recur' ||
          next.type === 'i' ||
          next.type === 'id' ||
          next.type === 'open'
        ) {
          op = '×';
          prec = 23;
          implicit = true;
        }
        if (!op || prec < minPrec || prec === 0) break;
        if (!implicit) take();
        const right = op === '⏨' ? parseSciExp() : parseExpr(op === '^' ? prec : prec + 1);
        const consumed = tokens[pos - 1];
        const rightIsPercent = consumed?.type === 'postfix' && consumed.text === '%';
        switch (op) {
          case '+': left = rightIsPercent ? addComplex(left, mulComplex(left, right)) : addComplex(left, right); break;
          case '-': left = rightIsPercent ? subComplex(left, mulComplex(left, right)) : subComplex(left, right); break;
          case '×': case '*': left = mulComplex(left, right); break;
          case '÷': case '/': left = divComplex(left, right); break;
          case '^': left = powComplex(left, right, ctx.angle); break;
          case 'nCr':
          case 'nPr':
            if (!left.im.decimal.isZero() || !right.im.decimal.isZero()) mathError('Combinatorics requires real integers');
            left = realToComplex(combinatoric(left.re, right.re, op === 'nPr'));
            break;
          case '⏨': {
            if (!right.im.decimal.isZero()) mathError('Scientific exponent must be real');
            left = mulComplex(left, realToComplex(power(scalarFromInteger(10), right.re)));
            break;
          }
          case '∠': left = polarPhasor(left, right, ctx.angle); break;
        }
      }
      return left;
    }

    function parseSciExp(): Complex {
      const next = peek();
      if (next.type === 'op' && (next.text === '+' || next.text === '-')) {
        take();
        const mag = parseSciExp();
        return next.text === '-' ? negComplex(mag) : mag;
      }
      return parseExpr(33);
    }

    function parsePrefix(): Complex {
      const tok = take();
      if (tok.type === 'op' && (tok.text === '+' || tok.text === '-')) {
        const v = parseExpr(30);
        return tok.text === '-' ? negComplex(v) : v;
      }
      if (tok.type === 'op' && tok.text === '⏨') {
        const exp = parseSciExp();
        if (!exp.im.decimal.isZero()) mathError('Scientific exponent must be real');
        return realToComplex(power(scalarFromInteger(10), exp.re));
      }
      if (tok.type === 'number') return realToComplex(scalarFromLiteral(tok.text));
      if (tok.type === 'recur') return realToComplex(scalarFromRecurring(tok.parts[0], tok.parts[1], tok.parts[2]));
      if (tok.type === 'i') return { re: scalarFromInteger(0), im: scalarFromInteger(1) };
      if (tok.type === 'open') {
        parenDepth++;
        const v = parseExpr(0);
        if (peek().type !== 'close') syntax('Expected )', peek().offset);
        take();
        parenDepth--;
        return v;
      }
      if (tok.type === 'id') {
        if (CMPLX_FUNCS.includes(tok.text)) {
          if (peek().type !== 'open') syntax('Expected (', peek().offset);
          take();
          parenDepth++;
          const a1 = parseExpr(0);
          const args = [a1];
          while (peek().type === 'comma') { take(); args.push(parseExpr(0)); }
          if (peek().type !== 'close') syntax('Expected )', peek().offset);
          take();
          parenDepth--;
          if (tok.text === 'frac') {
            if (args.length !== 2) syntax('frac expects 2 args', tok.offset);
            return divComplex(args[0], args[1]);
          }
          if (tok.text === 'mfrac') {
            if (args.length !== 3) syntax('mfrac expects 3 args', tok.offset);
            if (args.some((a) => !a.im.decimal.isZero())) mathError('mfrac requires real arguments');
            return realToComplex(applyFunction('mfrac', [args[0].re, args[1].re, args[2].re], ctx.angle));
          }
          if (tok.text === 'RanInt' || tok.text === 'RanInt#') {
            if (args.length !== 2) syntax(`${tok.text} expects 2 args`, tok.offset);
            if (!args[0].im.decimal.isZero() || !args[1].im.decimal.isZero()) {
              mathError(`${tok.text} requires real arguments`);
            }
            const sample = ctx.rng ? ctx.rng() : ctx.random;
            return realToComplex(randomInteger(args[0].re, args[1].re, sample));
          }
          if (tok.text === 'Pol') {
            if (args.length !== 2) syntax('Pol expects 2 args', tok.offset);
            if (!args[0].im.decimal.isZero() || !args[1].im.decimal.isZero()) {
              mathError('Pol requires real arguments');
            }
            polarFromRect(args[0].re, args[1].re, ctx.angle);
            if (parenDepth === 0) preferredFormat = 'polar';
            return { re: args[0].re, im: args[1].re };
          }
          if (tok.text === 'Rec') {
            if (args.length !== 2) syntax('Rec expects 2 args', tok.offset);
            if (!args[0].im.decimal.isZero() || !args[1].im.decimal.isZero()) {
              mathError('Rec requires real arguments');
            }
            const rect = rectFromPolar(args[0].re, args[1].re, ctx.angle);
            if (parenDepth === 0) preferredFormat = 'rect';
            return { re: rect.x, im: rect.y };
          }
          if (tok.text === 'root' || tok.text === 'logb' || tok.text === 'GCD' || tok.text === 'LCM') {
            if (args.length !== 2) syntax(`${tok.text} expects 2 args`, tok.offset);
            if (!args[0].im.decimal.isZero() || !args[1].im.decimal.isZero()) {
              mathError(`${tok.text} requires real arguments`);
            }
            return realToComplex(applyFunction(tok.text, [args[0].re, args[1].re], ctx.angle));
          }
          if (args.length !== 1) syntax('Expected 1 argument', tok.offset);
          if (tok.text === 'Conjg') return conjComplex(a1);
          if (tok.text === 'arg') return argComplex(a1, ctx.angle);
          if (tok.text === 'abs') return absComplex(a1, ctx.angle);
          if (tok.text === 'sqrt') return sqrtComplex(a1, ctx.angle);
          if (tok.text === 'ln') {
            if (a1.im.decimal.isZero() && a1.re.decimal.gt(0)) {
              return realToComplex(applyFunction('ln', [a1.re], ctx.angle));
            }
            return lnComplex(a1);
          }
          if (tok.text === 'log') {
            if (a1.im.decimal.isZero() && a1.re.decimal.gt(0)) {
              return realToComplex(applyFunction('log', [a1.re], ctx.angle));
            }
            return divComplex(lnComplex(a1), realToComplex(makeScalar(new D(10).ln(), undefined, true)));
          }
          const realInverseOutsideDomain = a1.im.decimal.isZero() && (
            ((tok.text === 'asin' || tok.text === 'acos') && a1.re.decimal.abs().gt(1)) ||
            (tok.text === 'acosh' && a1.re.decimal.lt(1)) ||
            (tok.text === 'atanh' && a1.re.decimal.abs().gt(1))
          );
          if (
            (realInverseOutsideDomain || !a1.im.decimal.isZero()) &&
            ['asin', 'acos', 'atan', 'asinh', 'acosh', 'atanh'].includes(tok.text)
          ) {
            return complexInverseFunction(tok.text, a1, ctx.angle);
          }
          if (['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh'].includes(tok.text) && !a1.im.decimal.isZero()) {
            return complexTrig(tok.text, a1, ctx.angle);
          }
          if (!a1.im.decimal.isZero()) mathError(`${tok.text} requires real argument`);
          return realToComplex(applyFunction(tok.text, [a1.re], ctx.angle, {
            random: ctx.random,
            rng: ctx.rng,
            numberFormat: ctx.numberFormat,
          }));
        }
        if (tok.text === 'Ran#') {
          const sample = ctx.rng ? ctx.rng() : (ctx.random ?? Math.random());
          const safe = Math.max(0, Math.min(0.999, Math.floor(sample * 1000) / 1000));
          return realToComplex(scalarFromLiteral(safe.toFixed(3)));
        }
        const constant = CONSTANT_BY_TOKEN.get(tok.text);
        if (constant) return realToComplex({ ...scalarFromLiteral(constant.value), preferDecimal: true });
        if (tok.text === 'π') return realToComplex(scalarPi());
        if (tok.text === 'e') return realToComplex(makeScalar(new D(1).exp(), undefined, false));
        if (tok.text === 'Ans') return deserializeComplex(ctx.cmplxAns);
        if (tok.text === 'PreAns') {
          if (ctx.cmplxPreAns) return deserializeComplex(ctx.cmplxPreAns);
          return ctx.preAns ? realToComplex(deserialize(ctx.preAns)) : deserializeComplex(ctx.cmplxAns);
        }
        if (VAR_SET.has(tok.text)) {
          const name = tok.text as VariableName;
          return { re: deserialize(ctx.variables[name]), im: deserialize(ctx.varsIm?.[name] ?? zeroStored()) };
        }
      }
      return syntax('Expected complex value', tok.offset);
    }

    if (peek().type === 'end') syntax('Empty expression', 0);
    const value = parseExpr(0);
    if (peek().type !== 'end') syntax('Unexpected token', peek().offset);
    return { value, preferredFormat };
  } catch (err) {
    if (err instanceof CalculatorError) throw err;
    if (err instanceof Error && err.message.startsWith('[DecimalError]')) mathError(err.message);
    throw err;
  }
}

function isFormattedZeroText(text: string): boolean {
  const normalized = text.replace(/,/g, '.').replace(/^[−-]/, '');
  return /^0(?:\.0+)?(?:×10\^0)?$/.test(normalized);
}

function isDisplayZero(d: DisplayValue): boolean {
  return d.type === 'text' && isFormattedZeroText(d.text);
}

export function formatComplexDisplay(
  z: Complex,
  format: ComplexFormat,
  angle: AngleUnit,
  preferExact: boolean,
  numFmt?: NumberFormatSetting,
  decimalMark: DecimalMark = 'Dot',
): string {
  const rawReZero = isNumericalZero(z.re, '1e-24');
  const rawImZero = isNumericalZero(z.im, '1e-24');

  if (format === 'polar') {
    const r = absComplex(z, angle).re;
    const theta = rawReZero && rawImZero ? scalarFromInteger(0) : argComplex(z, angle).re;
    const rStr = (preferExact && formatSymbolicLinear(r)) || formatDecimal(r, numFmt, decimalMark);
    const thStr = (preferExact && formatSymbolicLinear(theta)) || formatDecimal(theta, numFmt, decimalMark);
    return `${rStr}∠${thStr}`;
  }

  const fmtPart = (s: Scalar) => (preferExact && formatSymbolicLinear(s)) || formatDecimal(s, numFmt, decimalMark);
  const reStr = rawReZero ? '0' : fmtPart(z.re);
  const reZero = rawReZero || isFormattedZeroText(reStr);

  const imNeg = z.im.decimal.isNegative();
  const absIm = imNeg ? negate(z.im) : z.im;
  const rawImStr = rawImZero ? '0' : fmtPart(absIm);
  const imZero = rawImZero || isFormattedZeroText(rawImStr);

  if (imZero) {
    return reZero ? formatDecimal(scalarFromInteger(0), numFmt, decimalMark) : reStr;
  }

  const imOne = rawImStr === '1';
  let imBody = 'i';
  if (!imOne) {
    const hasInnerSum =
      !rawImStr.startsWith('(') &&
      (rawImStr.includes('+') || rawImStr.slice(1).includes('−'));
    imBody = hasInnerSum ? `(${rawImStr})i` : `${rawImStr}i`;
  }

  if (reZero) {
    return `${imNeg ? '−' : ''}${imBody}`;
  }
  return `${reStr}${imNeg ? '−' : '+'}${imBody}`;
}

export function formatComplex2D(
  z: Complex,
  format: ComplexFormat,
  angle: AngleUnit,
  preferExact: boolean,
  numFmt?: NumberFormatSetting,
  decimalMark: DecimalMark = 'Dot',
): DisplayValue {
  const rawReZero = isNumericalZero(z.re, '1e-24');
  const rawImZero = isNumericalZero(z.im, '1e-24');
  const fmt = preferExact ? 'exact' : 'decimal';

  if (format === 'polar') {
    const r = absComplex(z, angle).re;
    const theta = rawReZero && rawImZero ? scalarFromInteger(0) : argComplex(z, angle).re;
    return {
      type: 'complex-2d',
      form: 'polar',
      r: formatResult(r, fmt, { numberFormat: numFmt, decimalMark }),
      theta: formatResult(theta, fmt, { numberFormat: numFmt, decimalMark }),
    };
  }

  const reDisp = rawReZero
    ? { type: 'text' as const, text: '0' }
    : formatResult(z.re, fmt, { numberFormat: numFmt, decimalMark });
  const reZero = rawReZero || isDisplayZero(reDisp);

  const imNeg = z.im.decimal.isNegative();
  const absIm = imNeg ? negate(z.im) : z.im;
  const imDisp = rawImZero
    ? { type: 'text' as const, text: '0' }
    : formatResult(absIm, fmt, { numberFormat: numFmt, decimalMark });
  const imZero = rawImZero || isDisplayZero(imDisp);

  if (imZero) {
    return reZero
      ? { type: 'text', text: formatDecimal(scalarFromInteger(0), numFmt, decimalMark) }
      : reDisp;
  }

  if (reZero) {
    return {
      type: 'complex-2d',
      form: 'rect',
      imSign: imNeg ? '−' : '+',
      im: imDisp,
    };
  }

  return {
    type: 'complex-2d',
    form: 'rect',
    re: reDisp,
    imSign: imNeg ? '−' : '+',
    im: imDisp,
  };
}
