import { CalculatorError, mathError, syntax } from './errors';
import { completeParentheses } from './expression';
import {
  formatDecimal, formatResult, formatSymbolicLinear,
  type DecimalMark, type DisplayValue, type NumberFormatSetting,
} from './format';
import {
  D, VARIABLES, add, applyFunction, deserialize, divide, factorial, fromRadians, makeScalar,
  multiply, negate, power, scalarFromInteger, scalarFromLiteral, scalarPi, serialize, subtract, zeroStored,
  type AngleUnit, type Scalar, type StoredScalar, type VariableName,
} from './value';

export type ComplexFormat = 'rect' | 'polar';

export interface Complex {
  re: Scalar;
  im: Scalar;
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
  const denom = add(multiply(b.re, b.re), multiply(b.im, b.im));
  if (denom.decimal.isZero()) mathError('Division by zero');
  const numRe = add(multiply(a.re, b.re), multiply(a.im, b.im));
  const numIm = subtract(multiply(a.im, b.re), multiply(a.re, b.im));
  return { re: divide(numRe, denom), im: divide(numIm, denom) };
}

export function absComplex(a: Complex, angle: AngleUnit): Complex {
  const normSq = add(multiply(a.re, a.re), multiply(a.im, a.im));
  return realToComplex(applyFunction('sqrt', [normSq], angle));
}

export function argComplex(a: Complex, angle: AngleUnit): Complex {
  if (a.re.decimal.isZero() && a.im.decimal.isZero()) mathError('Argument of 0 is undefined');
  const halfTurn =
    angle === 'RAD' ? scalarPi() : angle === 'GRA' ? scalarFromInteger(200) : scalarFromInteger(180);
  const quarterTurn = divide(halfTurn, scalarFromInteger(2));

  if (a.re.decimal.abs().lt('1e-26')) {
    return realToComplex(a.im.decimal.gt(0) ? quarterTurn : negate(quarterTurn));
  }
  if (a.im.decimal.abs().lt('1e-26')) {
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

export function powComplex(base: Complex, exp: Complex, angle: AngleUnit): Complex {
  if (!exp.im.decimal.isZero()) mathError('Complex exponent unsupported in CMPLX');
  if (!exp.re.decimal.isInteger()) {
    if (base.im.decimal.isZero() && !base.re.decimal.isNegative()) {
      return realToComplex(makeScalar(base.re.decimal.pow(exp.re.decimal), undefined, true));
    }
    mathError('Non-integer power of complex number');
  }
  const n = exp.re.decimal.toNumber();
  if (Math.abs(n) > 60) mathError('Complex power out of range');
  if (n === 0) {
    if (base.re.decimal.isZero() && base.im.decimal.isZero()) mathError('0^0');
    return realToComplex(scalarFromInteger(1));
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
  void angle;
  return acc;
}

export function sqrtComplex(z: Complex, angle: AngleUnit): Complex {
  if (z.im.decimal.isZero()) {
    if (!z.re.decimal.isNegative()) {
      return realToComplex(applyFunction('sqrt', [z.re], angle));
    }
    return { re: scalarFromInteger(0), im: applyFunction('sqrt', [negate(z.re)], angle) };
  }
  const mod = z.re.decimal.pow(2).plus(z.im.decimal.pow(2)).sqrt();
  const rePart = mod.plus(z.re.decimal).div(2).sqrt();
  const imAbs = mod.minus(z.re.decimal).div(2).sqrt();
  const imPart = z.im.decimal.isNegative() ? imAbs.neg() : imAbs;
  return { re: makeScalar(rePart, undefined, true), im: makeScalar(imPart, undefined, true) };
}

type CmplxToken =
  | { type: 'number'; text: string; offset: number }
  | { type: 'i'; offset: number }
  | { type: 'id'; text: string; offset: number }
  | { type: 'op'; text: string; offset: number }
  | { type: 'postfix'; text: '▸polar' | '▸rect' | '!' | '%'; offset: number }
  | { type: 'open'; offset: number }
  | { type: 'close'; offset: number }
  | { type: 'comma'; offset: number }
  | { type: 'end'; offset: number };

const CMPLX_FUNCS = [
  'Conjg', 'mfrac', 'cbrt', 'root', 'logb', 'arg', 'abs', 'sqrt', 'frac',
  'asinh', 'acosh', 'atanh', 'sinh', 'cosh', 'tanh',
  'asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'ln', 'log',
];
const VAR_SET = new Set<string>(VARIABLES);

function tokenizeCmplx(source: string): CmplxToken[] {
  const tokens: CmplxToken[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    const rest = source.slice(i);

    if (rest.startsWith('▸r∠θ')) { tokens.push({ type: 'postfix', text: '▸polar', offset: i }); i += 4; continue; }
    if (rest.startsWith('▸a+bi')) { tokens.push({ type: 'postfix', text: '▸rect', offset: i }); i += 5; continue; }

    const num = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (num) {
      tokens.push({ type: 'number', text: num[0], offset: i });
      i += num[0].length;
      continue;
    }

    const fn = [...CMPLX_FUNCS, 'Ans'].sort((a, b) => b.length - a.length).find((w) => rest.startsWith(w));
    if (fn) {
      tokens.push({ type: 'id', text: fn, offset: i });
      i += fn.length;
      continue;
    }

    if (ch === 'i') { tokens.push({ type: 'i', offset: i }); i++; continue; }
    if (VAR_SET.has(ch) || charIsPiOrE(ch)) { tokens.push({ type: 'id', text: ch, offset: i }); i++; continue; }
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
  cmplxAns: StoredComplex;
}

export function evaluateComplex(
  source: string,
  ctx: CmplxEvalContext,
): { value: Complex; preferredFormat?: ComplexFormat } {
  try {
    const tokens = tokenizeCmplx(completeParentheses(source));
    let pos = 0;
    let preferredFormat: ComplexFormat | undefined;
    const peek = () => tokens[pos];
    const take = () => tokens[pos++];

    function parseExpr(minPrec: number): Complex {
      let left = parsePrefix();
      for (;;) {
        const next = peek();
        if (next.type === 'postfix') {
          if (next.text === '!' || next.text === '%') {
            if (40 < minPrec) break;
            take();
            if (!left.im.decimal.isZero()) mathError('Factorial/% requires real value');
            left = realToComplex(next.text === '!' ? factorial(left.re) : divide(left.re, scalarFromInteger(100)));
            continue;
          }
          take();
          preferredFormat = next.text === '▸polar' ? 'polar' : 'rect';
          continue;
        }
        let op: string | undefined;
        let prec = 0;
        let implicit = false;
        if (next.type === 'op') {
          op = next.text;
          prec = op === '+' || op === '-' ? 10
            : ['×', '÷', '*', '/'].includes(op) ? 20
            : op === '^' ? 30
            : op === '⏨' ? 32
            : op === '∠' ? 35 : 0;
        } else if (next.type === 'number' || next.type === 'i' || next.type === 'id' || next.type === 'open') {
          op = '×';
          prec = 23;
          implicit = true;
        }
        if (!op || prec < minPrec || prec === 0) break;
        if (!implicit) take();
        const right = op === '⏨' ? parseSciExp() : parseExpr(op === '^' ? prec : prec + 1);
        switch (op) {
          case '+': left = addComplex(left, right); break;
          case '-': left = subComplex(left, right); break;
          case '×': case '*': left = mulComplex(left, right); break;
          case '÷': case '/': left = divComplex(left, right); break;
          case '^': left = powComplex(left, right, ctx.angle); break;
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
      if (tok.type === 'i') return { re: scalarFromInteger(0), im: scalarFromInteger(1) };
      if (tok.type === 'open') {
        const v = parseExpr(0);
        if (peek().type !== 'close') syntax('Expected )', peek().offset);
        take();
        return v;
      }
      if (tok.type === 'id') {
        if (CMPLX_FUNCS.includes(tok.text)) {
          if (peek().type !== 'open') syntax('Expected (', peek().offset);
          take();
          const a1 = parseExpr(0);
          const args = [a1];
          while (peek().type === 'comma') { take(); args.push(parseExpr(0)); }
          if (peek().type !== 'close') syntax('Expected )', peek().offset);
          take();
          if (tok.text === 'frac') {
            if (args.length !== 2) syntax('frac expects 2 args', tok.offset);
            return divComplex(args[0], args[1]);
          }
          if (tok.text === 'mfrac') {
            if (args.length !== 3) syntax('mfrac expects 3 args', tok.offset);
            if (args.some((a) => !a.im.decimal.isZero())) mathError('mfrac requires real arguments');
            return realToComplex(applyFunction('mfrac', [args[0].re, args[1].re, args[2].re], ctx.angle));
          }
          if (tok.text === 'root' || tok.text === 'logb') {
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
          if (!a1.im.decimal.isZero()) mathError(`${tok.text} requires real argument`);
          return realToComplex(applyFunction(tok.text, [a1.re], ctx.angle));
        }
        if (tok.text === 'π') return realToComplex(scalarPi());
        if (tok.text === 'e') return realToComplex(makeScalar(new D(1).exp(), undefined, false));
        if (tok.text === 'Ans') return deserializeComplex(ctx.cmplxAns);
        if (VAR_SET.has(tok.text)) return realToComplex(deserialize(ctx.variables[tok.text as VariableName]));
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

export function formatComplexDisplay(
  z: Complex,
  format: ComplexFormat,
  angle: AngleUnit,
  preferExact: boolean,
  numFmt?: NumberFormatSetting,
): string {
  const reZero = z.re.decimal.abs().lt('1e-24');
  const imZero = z.im.decimal.abs().lt('1e-24');

  if (format === 'polar') {
    const r = absComplex(z, angle).re;
    const theta = reZero && imZero ? scalarFromInteger(0) : argComplex(z, angle).re;
    const rStr = (preferExact && formatSymbolicLinear(r)) || formatDecimal(r, numFmt);
    const thStr = (preferExact && formatSymbolicLinear(theta)) || formatDecimal(theta, numFmt);
    return `${rStr}∠${thStr}`;
  }

  const fmtPart = (s: Scalar) => (preferExact && formatSymbolicLinear(s)) || formatDecimal(s, numFmt);
  if (imZero) return reZero ? '0' : fmtPart(z.re);

  const imNeg = z.im.decimal.isNegative();
  const absIm = imNeg ? negate(z.im) : z.im;
  const imOne = absIm.decimal.minus(1).abs().lt('1e-24');
  const imBody = imOne ? 'i' : `${fmtPart(absIm)}i`;

  if (reZero) {
    return `${imNeg ? '−' : ''}${imBody}`;
  }
  const reStr = fmtPart(z.re);
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
  const reZero = z.re.decimal.abs().lt('1e-24');
  const imZero = z.im.decimal.abs().lt('1e-24');
  const fmt = preferExact ? 'exact' : 'decimal';

  if (format === 'polar') {
    const r = absComplex(z, angle).re;
    const theta = reZero && imZero ? scalarFromInteger(0) : argComplex(z, angle).re;
    return {
      type: 'complex-2d',
      form: 'polar',
      r: formatResult(r, fmt, { numberFormat: numFmt, decimalMark }),
      theta: formatResult(theta, fmt, { numberFormat: numFmt, decimalMark }),
    };
  }

  if (imZero) {
    return reZero
      ? { type: 'text', text: '0' }
      : formatResult(z.re, fmt, { numberFormat: numFmt, decimalMark });
  }

  const imNeg = z.im.decimal.isNegative();
  const absIm = imNeg ? negate(z.im) : z.im;
  const imDisp = formatResult(absIm, fmt, { numberFormat: numFmt, decimalMark });

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
    re: formatResult(z.re, fmt, { numberFormat: numFmt, decimalMark }),
    imSign: imNeg ? '−' : '+',
    im: imDisp,
  };
}
