import { CalculatorError, mathError, syntax } from './errors';
import { completeParentheses } from './expression';
import {
  VARIABLES, add, applyFunction, deserialize, divide, makeScalar, multiply, negate, power, scalarFromInteger,
  scalarFromLiteral, scalarPi, serialize, subtract, zeroStored, D,
  type AngleUnit, type Scalar, type StoredScalar, type VariableName,
} from './value';

export type VectorName = 'VctA' | 'VctB' | 'VctC' | 'VctAns';

export interface VectorValue {
  dim: 2 | 3;
  coords: Scalar[];
}

export interface StoredVector {
  dim: 2 | 3;
  coords: StoredScalar[];
}

export function createZeroVector(dim: 2 | 3): StoredVector {
  return { dim, coords: Array.from({ length: dim }, () => zeroStored()) };
}

export function serializeVector(v: VectorValue): StoredVector {
  return { dim: v.dim, coords: v.coords.map(serialize) };
}

export function deserializeVector(v: StoredVector): VectorValue {
  return { dim: v.dim, coords: v.coords.map(deserialize) };
}

export function addVector(a: VectorValue, b: VectorValue, sub = false): VectorValue {
  if (a.dim !== b.dim) throw new CalculatorError('Argument ERROR', 'Vector dimension mismatch');
  return {
    dim: a.dim,
    coords: a.coords.map((val, i) => (sub ? subtract(val, b.coords[i]) : add(val, b.coords[i]))),
  };
}

export function scaleVector(k: Scalar, v: VectorValue): VectorValue {
  return { dim: v.dim, coords: v.coords.map((c) => multiply(k, c)) };
}

export function dotVector(a: VectorValue, b: VectorValue): Scalar {
  if (a.dim !== b.dim) throw new CalculatorError('Argument ERROR', 'Dot product dimension mismatch');
  return a.coords.reduce((sum, val, i) => add(sum, multiply(val, b.coords[i])), scalarFromInteger(0));
}

/** Casio fx-991ES PLUS cross product: promotes 2D vectors [x, y] to [x, y, 0] in 3D! */
export function crossVector(a: VectorValue, b: VectorValue): VectorValue {
  if (a.dim !== b.dim) throw new CalculatorError('Argument ERROR', 'Cross product dimension mismatch');
  const ax = a.coords[0], ay = a.coords[1], az = a.dim === 3 ? a.coords[2] : scalarFromInteger(0);
  const bx = b.coords[0], by = b.coords[1], bz = b.dim === 3 ? b.coords[2] : scalarFromInteger(0);
  return {
    dim: 3,
    coords: [
      subtract(multiply(ay, bz), multiply(az, by)),
      subtract(multiply(az, bx), multiply(ax, bz)),
      subtract(multiply(ax, by), multiply(ay, bx)),
    ],
  };
}

export function normVector(v: VectorValue): Scalar {
  const sumSq = v.coords.reduce((acc, c) => add(acc, multiply(c, c)), scalarFromInteger(0));
  return applyFunction('sqrt', [sumSq], 'DEG');
}

export function angleVector(a: VectorValue, b: VectorValue, angle: AngleUnit = 'DEG'): Scalar {
  if (a.dim !== b.dim) throw new CalculatorError('Argument ERROR', 'Angle dimension mismatch');
  const na = normVector(a);
  const nb = normVector(b);
  if (na.decimal.isZero() || nb.decimal.isZero()) mathError('Angle with zero vector is undefined');
  const dot = dotVector(a, b);
  let cosVal = divide(dot, multiply(na, nb));
  if (cosVal.decimal.gt(1)) cosVal = makeScalar(new D(1), { n: 1n, d: 1n });
  else if (cosVal.decimal.lt(-1)) cosVal = makeScalar(new D(-1), { n: -1n, d: 1n });
  return applyFunction('acos', [cosVal], angle);
}

export type VectorEvalVal = { kind: 'vector'; vector: VectorValue } | { kind: 'scalar'; scalar: Scalar };

export interface VectorEvalContext {
  vectors: Record<VectorName, StoredVector | null>;
  variables: Record<VariableName, StoredScalar>;
  ans: StoredScalar;
  angle?: AngleUnit;
}

const SCALAR_FNS = [
  'mfrac', 'cbrt', 'root', 'logb', 'sqrt',
  'asinh', 'acosh', 'atanh', 'sinh', 'cosh', 'tanh',
  'asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'ln', 'log',
];

type VctTok =
  | { type: 'num'; text: string }
  | { type: 'vct'; name: VectorName }
  | { type: 'abs' }
  | { type: 'angle' }
  | { type: 'frac' }
  | { type: 'sfn'; name: string }
  | { type: 'comma' }
  | { type: 'var'; text: string }
  | { type: 'op'; text: '+' | '-' | '×' | '÷' | '·' | '^' | '⏨' }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'end' };

const VAR_SET = new Set<string>(VARIABLES);

function tokenizeVector(source: string): VctTok[] {
  const tokens: VctTok[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    const rest = source.slice(i);
    let matchedVct = false;
    for (const vName of ['VctAns', 'VctA', 'VctB', 'VctC'] as VectorName[]) {
      if (rest.startsWith(vName)) {
        tokens.push({ type: 'vct', name: vName });
        i += vName.length;
        matchedVct = true;
        break;
      }
    }
    if (matchedVct) continue;
    if (rest.startsWith('Angle(')) { tokens.push({ type: 'angle' }); tokens.push({ type: 'open' }); i += 6; continue; }
    if (rest.startsWith('abs(')) { tokens.push({ type: 'abs' }); tokens.push({ type: 'open' }); i += 4; continue; }
    if (rest.startsWith('frac(')) { tokens.push({ type: 'frac' }); tokens.push({ type: 'open' }); i += 5; continue; }
    const sfn = SCALAR_FNS.find((fn) => rest.startsWith(`${fn}(`));
    if (sfn) {
      tokens.push({ type: 'sfn', name: sfn });
      tokens.push({ type: 'open' });
      i += sfn.length + 1;
      continue;
    }
    if (rest.startsWith('dot') || ch === '·') {
      tokens.push({ type: 'op', text: '·' });
      i += ch === '·' ? 1 : 3;
      continue;
    }
    if (rest.startsWith('Ans')) { tokens.push({ type: 'var', text: 'Ans' }); i += 3; continue; }
    const num = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (num) { tokens.push({ type: 'num', text: num[0] }); i += num[0].length; continue; }
    if (VAR_SET.has(ch) || ch === 'π' || ch === 'e') { tokens.push({ type: 'var', text: ch }); i++; continue; }
    if ('+-−×÷*/^⏨'.includes(ch)) {
      const norm = ch === '−' ? '-' : ch === '*' ? '×' : ch === '/' ? '÷' : (ch as '+' | '-' | '×' | '÷' | '^' | '⏨');
      tokens.push({ type: 'op', text: norm });
      i++;
      continue;
    }
    if (ch === ',') { tokens.push({ type: 'comma' }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'open' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'close' }); i++; continue; }
    syntax(`Unexpected '${ch}' in VECTOR`);
  }
  tokens.push({ type: 'end' });
  return tokens;
}

export function evaluateVectorExpression(source: string, ctx: VectorEvalContext): VectorEvalVal {
  const tokens = tokenizeVector(completeParentheses(source));
  const angle = ctx.angle ?? 'DEG';
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  function parseExpr(minPrec: number): VectorEvalVal {
    let left = parsePrefix();
    for (;;) {
      const next = peek();
      let op: '+' | '-' | '×' | '÷' | '·' | '^' | '⏨' | undefined;
      let prec = 0;
      let implicit = false;
      if (next.type === 'op') {
        op = next.text;
        prec = op === '+' || op === '-' ? 10
          : op === '^' ? 30
          : op === '⏨' ? 32
          : 20;
      } else if (
        next.type === 'vct' ||
        next.type === 'abs' ||
        next.type === 'angle' ||
        next.type === 'frac' ||
        next.type === 'sfn' ||
        next.type === 'var' ||
        next.type === 'open'
      ) {
        op = '×';
        prec = 23;
        implicit = true;
      }
      if (!op || prec < minPrec) break;
      if (!implicit) take();
      const right = op === '⏨' ? parseSciExp() : parseExpr(op === '^' ? prec : prec + 1);

      if (op === '+' || op === '-') {
        if (left.kind === 'vector' && right.kind === 'vector') {
          left = { kind: 'vector', vector: addVector(left.vector, right.vector, op === '-') };
        } else if (left.kind === 'scalar' && right.kind === 'scalar') {
          left = { kind: 'scalar', scalar: op === '-' ? subtract(left.scalar, right.scalar) : add(left.scalar, right.scalar) };
        } else {
          throw new CalculatorError('Argument ERROR', 'Cannot add scalar and vector');
        }
      } else if (op === '·') {
        if (left.kind !== 'vector' || right.kind !== 'vector') {
          throw new CalculatorError('Argument ERROR', 'Dot product requires two vectors');
        }
        left = { kind: 'scalar', scalar: dotVector(left.vector, right.vector) };
      } else if (op === '×') {
        if (left.kind === 'vector' && right.kind === 'vector') left = { kind: 'vector', vector: crossVector(left.vector, right.vector) };
        else if (left.kind === 'scalar' && right.kind === 'vector') left = { kind: 'vector', vector: scaleVector(left.scalar, right.vector) };
        else if (left.kind === 'vector' && right.kind === 'scalar') left = { kind: 'vector', vector: scaleVector(right.scalar, left.vector) };
        else if (left.kind === 'scalar' && right.kind === 'scalar') left = { kind: 'scalar', scalar: multiply(left.scalar, right.scalar) };
      } else if (op === '÷') {
        if (right.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Cannot divide by vector');
        const inv = divide(scalarFromInteger(1), right.scalar);
        left = left.kind === 'vector'
          ? { kind: 'vector', vector: scaleVector(inv, left.vector) }
          : { kind: 'scalar', scalar: multiply(left.scalar, inv) };
      } else if (op === '^') {
        if (left.kind !== 'scalar' || right.kind !== 'scalar') {
          throw new CalculatorError('Argument ERROR', 'Power in VECTOR requires scalar');
        }
        left = { kind: 'scalar', scalar: power(left.scalar, right.scalar) };
      } else if (op === '⏨') {
        if (left.kind !== 'scalar' || right.kind !== 'scalar') {
          throw new CalculatorError('Argument ERROR', 'Scientific exponent requires scalar');
        }
        left = { kind: 'scalar', scalar: multiply(left.scalar, power(scalarFromInteger(10), right.scalar)) };
      }
    }
    return left;
  }

  function parseSciExp(): VectorEvalVal {
    const next = peek();
    if (next.type === 'op' && (next.text === '+' || next.text === '-')) {
      take();
      const mag = parseSciExp();
      if (mag.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Scientific exponent requires scalar');
      return { kind: 'scalar', scalar: next.text === '-' ? negate(mag.scalar) : mag.scalar };
    }
    return parseExpr(33);
  }

  function parsePrefix(): VectorEvalVal {
    const tok = take();
    if (tok.type === 'op' && (tok.text === '+' || tok.text === '-')) {
      const operand = parseExpr(30);
      if (tok.text === '+') return operand;
      return operand.kind === 'vector'
        ? { kind: 'vector', vector: scaleVector(scalarFromInteger(-1), operand.vector) }
        : { kind: 'scalar', scalar: negate(operand.scalar) };
    }
    if (tok.type === 'op' && tok.text === '⏨') {
      const exp = parseSciExp();
      if (exp.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Scientific exponent requires scalar');
      return { kind: 'scalar', scalar: power(scalarFromInteger(10), exp.scalar) };
    }
    if (tok.type === 'num') return { kind: 'scalar', scalar: scalarFromLiteral(tok.text) };
    if (tok.type === 'var') {
      if (tok.text === 'π') return { kind: 'scalar', scalar: scalarPi() };
      if (tok.text === 'e') return { kind: 'scalar', scalar: makeScalar(new D(1).exp(), undefined, false) };
      const s = tok.text === 'Ans' ? deserialize(ctx.ans) : deserialize(ctx.variables[tok.text as VariableName]);
      return { kind: 'scalar', scalar: s };
    }
    if (tok.type === 'vct') {
      const stored = ctx.vectors[tok.name];
      if (!stored) throw new CalculatorError('Argument ERROR', `${tok.name} is undefined`);
      return { kind: 'vector', vector: deserializeVector(stored) };
    }
    if (tok.type === 'frac') {
      if (peek().type !== 'open') syntax('Expected (');
      take();
      const num = parseExpr(0);
      if (peek().type !== 'comma') syntax('Expected , in frac');
      take();
      const den = parseExpr(0);
      if (peek().type !== 'close') syntax('Expected )');
      take();
      if (den.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Cannot divide by vector');
      const inv = divide(scalarFromInteger(1), den.scalar);
      return num.kind === 'vector'
        ? { kind: 'vector', vector: scaleVector(inv, num.vector) }
        : { kind: 'scalar', scalar: multiply(num.scalar, inv) };
    }
    if (tok.type === 'sfn') {
      if (peek().type !== 'open') syntax('Expected (');
      take();
      const args: Scalar[] = [];
      const first = parseExpr(0);
      if (first.kind !== 'scalar') throw new CalculatorError('Argument ERROR', `${tok.name} expects scalar`);
      args.push(first.scalar);
      while (peek().type === 'comma') {
        take();
        const nextArg = parseExpr(0);
        if (nextArg.kind !== 'scalar') throw new CalculatorError('Argument ERROR', `${tok.name} expects scalar`);
        args.push(nextArg.scalar);
      }
      if (peek().type !== 'close') syntax('Expected )');
      take();
      return { kind: 'scalar', scalar: applyFunction(tok.name, args, angle) };
    }
    if (tok.type === 'angle') {
      if (peek().type !== 'open') syntax('Expected (');
      take();
      const first = parseExpr(0);
      if (peek().type !== 'comma') syntax('Expected , in Angle(VctA,VctB)');
      take();
      const second = parseExpr(0);
      if (peek().type !== 'close') syntax('Expected )');
      take();
      if (first.kind !== 'vector' || second.kind !== 'vector') {
        throw new CalculatorError('Argument ERROR', 'Angle requires two vectors');
      }
      return { kind: 'scalar', scalar: angleVector(first.vector, second.vector, ctx.angle ?? 'DEG') };
    }
    if (tok.type === 'abs') {
      if (peek().type !== 'open') syntax('Expected (');
      take();
      const inner = parseExpr(0);
      if (peek().type !== 'close') syntax('Expected )');
      take();
      if (inner.kind === 'vector') return { kind: 'scalar', scalar: normVector(inner.vector) };
      return { kind: 'scalar', scalar: inner.scalar.decimal.isNegative() ? negate(inner.scalar) : inner.scalar };
    }
    if (tok.type === 'open') {
      const v = parseExpr(0);
      if (peek().type !== 'close') syntax('Expected )');
      take();
      return v;
    }
    return syntax('Expected vector or scalar');
  }

  if (peek().type === 'end') syntax('Empty vector expression');
  const out = parseExpr(0);
  if (peek().type !== 'end') syntax('Unexpected token');
  return out;
}
