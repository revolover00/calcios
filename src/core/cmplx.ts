import { CalculatorError, mathError, syntax } from './errors';
import { completeParentheses } from './expression';
import { formatDecimal, formatSymbolicLinear, type NumberFormatSetting } from './format';
import {
  D, VARIABLES, add, applyFunction, deserialize, divide, fromRadians, makeScalar,
  multiply, negate, scalarFromInteger, scalarFromLiteral, scalarPi, serialize, subtract, zeroStored,
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
  | { type: 'number'; text: string }
  | { type: 'i' }
  | { type: 'id'; text: string }
  | { type: 'op'; text: string }
  | { type: 'postfix'; text: '▸polar' | '▸rect' }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'comma' }
  | { type: 'end' };

const CMPLX_FUNCS = ['Conjg', 'arg', 'abs', 'sqrt', 'frac', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log'];
const VAR_SET = new Set<string>(VARIABLES);

function tokenizeCmplx(source: string): CmplxToken[] {
  const tokens: CmplxToken[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    const rest = source.slice(i);

    if (rest.startsWith('▸r∠θ')) { tokens.push({ type: 'postfix', text: '▸polar' }); i += 4; continue; }
    if (rest.startsWith('▸a+bi')) { tokens.push({ type: 'postfix', text: '▸rect' }); i += 5; continue; }

    const num = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (num) {
      tokens.push({ type: 'number', text: num[0] });
      i += num[0].length;
      continue;
    }

    const fn = [...CMPLX_FUNCS, 'Ans'].sort((a, b) => b.length - a.length).find((w) => rest.startsWith(w));
    if (fn) {
      tokens.push({ type: 'id', text: fn });
      i += fn.length;
      continue;
    }

    if (ch === 'i') { tokens.push({ type: 'i' }); i++; continue; }
    if (VAR_SET.has(ch) || ch === 'π' || ch === 'e') { tokens.push({ type: 'id', text: ch }); i++; continue; }
    if ('+-−×÷*/^∠'.includes(ch)) {
      tokens.push({ type: 'op', text: ch === '−' ? '-' : ch });
      i++;
      continue;
    }
    if (ch === '(') { tokens.push({ type: 'open' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'close' }); i++; continue; }
    if (ch === ',') { tokens.push({ type: 'comma' }); i++; continue; }
    syntax(`Unexpected character '${ch}' in CMPLX`);
  }
  tokens.push({ type: 'end' });
  return tokens;
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
            : op === '∠' ? 35 : 0;
        } else if (next.type === 'number' || next.type === 'i' || next.type === 'id' || next.type === 'open') {
          op = '×';
          prec = 25;
          implicit = true;
        }
        if (!op || prec < minPrec || prec === 0) break;
        if (!implicit) take();
        const right = parseExpr(op === '^' ? prec : prec + 1);
        switch (op) {
          case '+': left = addComplex(left, right); break;
          case '-': left = subComplex(left, right); break;
          case '×': case '*': left = mulComplex(left, right); break;
          case '÷': case '/': left = divComplex(left, right); break;
          case '^': left = powComplex(left, right, ctx.angle); break;
          case '∠': left = polarPhasor(left, right, ctx.angle); break;
        }
      }
      return left;
    }

    function parsePrefix(): Complex {
      const tok = take();
      if (tok.type === 'op' && (tok.text === '+' || tok.text === '-')) {
        const v = parseExpr(30);
        return tok.text === '-' ? negComplex(v) : v;
      }
      if (tok.type === 'number') return realToComplex(scalarFromLiteral(tok.text));
      if (tok.type === 'i') return { re: scalarFromInteger(0), im: scalarFromInteger(1) };
      if (tok.type === 'open') {
        const v = parseExpr(0);
        if (peek().type !== 'close') syntax('Expected )');
        take();
        return v;
      }
      if (tok.type === 'id') {
        if (CMPLX_FUNCS.includes(tok.text)) {
          if (peek().type !== 'open') syntax('Expected (');
          take();
          const a1 = parseExpr(0);
          const args = [a1];
          while (peek().type === 'comma') { take(); args.push(parseExpr(0)); }
          if (peek().type !== 'close') syntax('Expected )');
          take();
          if (tok.text === 'frac') {
            if (args.length !== 2) syntax('frac expects 2 args');
            return divComplex(args[0], args[1]);
          }
          if (args.length !== 1) syntax('Expected 1 argument');
          if (tok.text === 'Conjg') return conjComplex(a1);
          if (tok.text === 'arg') return argComplex(a1, ctx.angle);
          if (tok.text === 'abs') return absComplex(a1, ctx.angle);
          if (tok.text === 'sqrt') return sqrtComplex(a1, ctx.angle);
          if (!a1.im.decimal.isZero()) mathError(`${tok.text} requires real argument`);
          return realToComplex(applyFunction(tok.text, [a1.re], ctx.angle));
        }
        if (tok.text === 'π') return realToComplex(scalarPi());
        if (tok.text === 'e') return realToComplex(makeScalar(new D(1).exp(), undefined, true));
        if (tok.text === 'Ans') return deserializeComplex(ctx.cmplxAns);
        if (VAR_SET.has(tok.text)) return realToComplex(deserialize(ctx.variables[tok.text as VariableName]));
      }
      return syntax('Expected complex value');
    }

    if (peek().type === 'end') syntax('Empty expression');
    const value = parseExpr(0);
    if (peek().type !== 'end') syntax('Unexpected token');
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
