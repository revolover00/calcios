import { CONSTANT_BY_TOKEN } from './constants';
import { CalculatorError, mathError, syntax } from './errors';
import { completeParentheses } from './expression';
import type { NumberFormatSetting } from './format';
import {
  D, VARIABLES, add, applyFunction, applyUnitConversion, combinatoric, convertAngleToActive,
  deserialize, divide, dmsToScalar, factorial, makeScalar, multiply, negate, power,
  scalarFromInteger, scalarFromLiteral, scalarFromRecurring, scalarPi, serialize, subtract, zeroStored,
  type AngleUnit, type Scalar, type StoredScalar, type VariableName,
} from './value';

export type MatrixName = 'MatA' | 'MatB' | 'MatC' | 'MatAns';

export interface MatrixValue {
  rows: number;
  cols: number;
  cells: Scalar[][];
}

export interface StoredMatrix {
  rows: number;
  cols: number;
  cells: StoredScalar[][];
}

export function createZeroMatrix(rows: number, cols: number): StoredMatrix {
  return {
    rows,
    cols,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => zeroStored())),
  };
}

export function serializeMatrix(m: MatrixValue): StoredMatrix {
  return { rows: m.rows, cols: m.cols, cells: m.cells.map((row) => row.map(serialize)) };
}

export function deserializeMatrix(m: StoredMatrix): MatrixValue {
  return { rows: m.rows, cols: m.cols, cells: m.cells.map((row) => row.map(deserialize)) };
}

function matrixPivotTol(m: MatrixValue): InstanceType<typeof D> {
  const maxEntry = m.cells.flat().reduce((mx, c) => D.max(mx, c.decimal.abs()), new D(0));
  return maxEntry.isZero() ? new D(0) : maxEntry.times('1e-28');
}

function isBelowTol(s: Scalar, tol: InstanceType<typeof D>): boolean {
  if (s.exact) return s.exact.n === 0n;
  return s.decimal.abs().lte(tol);
}

export function addMatrix(a: MatrixValue, b: MatrixValue, sub = false): MatrixValue {
  if (a.rows !== b.rows || a.cols !== b.cols) throw new CalculatorError('Argument ERROR', 'Dimension mismatch');
  return {
    rows: a.rows,
    cols: a.cols,
    cells: a.cells.map((row, r) =>
      row.map((val, c) => (sub ? subtract(val, b.cells[r][c]) : add(val, b.cells[r][c]))),
    ),
  };
}

export function scaleMatrix(k: Scalar, m: MatrixValue): MatrixValue {
  return { rows: m.rows, cols: m.cols, cells: m.cells.map((row) => row.map((v) => multiply(k, v))) };
}

export function multiplyMatrix(a: MatrixValue, b: MatrixValue): MatrixValue {
  if (a.cols !== b.rows) throw new CalculatorError('Argument ERROR', 'Matrix multiplication dimension mismatch');
  const cells: Scalar[][] = Array.from({ length: a.rows }, () => Array.from({ length: b.cols }, () => scalarFromInteger(0)));
  for (let r = 0; r < a.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      let sum = scalarFromInteger(0);
      for (let k = 0; k < a.cols; k++) {
        sum = add(sum, multiply(a.cells[r][k], b.cells[k][c]));
      }
      cells[r][c] = sum;
    }
  }
  return { rows: a.rows, cols: b.cols, cells };
}

export function transposeMatrix(m: MatrixValue): MatrixValue {
  const cells: Scalar[][] = Array.from({ length: m.cols }, (_, r) =>
    Array.from({ length: m.rows }, (__, c) => m.cells[c][r]),
  );
  return { rows: m.cols, cols: m.rows, cells };
}

export function absMatrix(m: MatrixValue): MatrixValue {
  return {
    rows: m.rows,
    cols: m.cols,
    cells: m.cells.map((row) => row.map((v) => (v.decimal.isNegative() ? negate(v) : v))),
  };
}

export function determinantMatrix(m: MatrixValue): Scalar {
  if (m.rows !== m.cols) throw new CalculatorError('Argument ERROR', 'Determinant requires square matrix');
  const n = m.rows;
  if (n === 1) return m.cells[0][0];
  if (n === 2) {
    return subtract(multiply(m.cells[0][0], m.cells[1][1]), multiply(m.cells[0][1], m.cells[1][0]));
  }
  // 3x3 exact cofactor expansion
  const a = m.cells;
  const c0 = multiply(a[0][0], subtract(multiply(a[1][1], a[2][2]), multiply(a[1][2], a[2][1])));
  const c1 = multiply(a[0][1], subtract(multiply(a[1][0], a[2][2]), multiply(a[1][2], a[2][0])));
  const c2 = multiply(a[0][2], subtract(multiply(a[1][0], a[2][1]), multiply(a[1][1], a[2][0])));
  return add(subtract(c0, c1), c2);
}

export function invertMatrix(m: MatrixValue): MatrixValue {
  if (m.rows !== m.cols) throw new CalculatorError('Argument ERROR', 'Inverse requires square matrix');
  const n = m.rows;
  const tol = matrixPivotTol(m);
  if (tol.isZero()) mathError('Singular matrix');
  const aug: Scalar[][] = m.cells.map((row, r) => [
    ...row,
    ...Array.from({ length: n }, (_, c) => scalarFromInteger(r === c ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    let best = col;
    for (let r = col + 1; r < n; r++) {
      if (aug[r][col].decimal.abs().gt(aug[best][col].decimal.abs())) best = r;
    }
    if (isBelowTol(aug[best][col], tol)) mathError('Singular matrix');
    [aug[col], aug[best]] = [aug[best], aug[col]];
    const piv = aug[col][col];
    for (let c = 0; c < 2 * n; c++) aug[col][c] = divide(aug[col][c], piv);
    for (let r = 0; r < n; r++) {
      if (r === col || isBelowTol(aug[r][col], tol)) continue;
      const fac = aug[r][col];
      for (let c = 0; c < 2 * n; c++) {
        aug[r][c] = subtract(aug[r][c], multiply(fac, aug[col][c]));
      }
    }
  }

  return {
    rows: n,
    cols: n,
    cells: aug.map((row) => row.slice(n)),
  };
}

/** Row Echelon Form (Ref) with leading 1s and partial pivoting. */
export function refMatrix(m: MatrixValue): MatrixValue {
  const tol = matrixPivotTol(m);
  if (tol.isZero()) return { rows: m.rows, cols: m.cols, cells: m.cells.map((r) => [...r]) };
  const grid = m.cells.map((row) => [...row]);
  let leadRow = 0;
  for (let col = 0; col < m.cols && leadRow < m.rows; col++) {
    let best = leadRow;
    for (let r = leadRow + 1; r < m.rows; r++) {
      if (grid[r][col].decimal.abs().gt(grid[best][col].decimal.abs())) best = r;
    }
    if (isBelowTol(grid[best][col], tol)) continue;
    if (best !== leadRow) [grid[leadRow], grid[best]] = [grid[best], grid[leadRow]];
    const piv = grid[leadRow][col];
    for (let c = col; c < m.cols; c++) grid[leadRow][c] = divide(grid[leadRow][c], piv);
    for (let r = leadRow + 1; r < m.rows; r++) {
      if (isBelowTol(grid[r][col], tol)) continue;
      const fac = grid[r][col];
      for (let c = col; c < m.cols; c++) {
        grid[r][c] = subtract(grid[r][c], multiply(fac, grid[leadRow][c]));
      }
      grid[r][col] = scalarFromInteger(0);
    }
    leadRow++;
  }
  return { rows: m.rows, cols: m.cols, cells: grid };
}

/** Reduced Row Echelon Form (Rref) via exact Gauss-Jordan elimination. */
export function rrefMatrix(m: MatrixValue): MatrixValue {
  const tol = matrixPivotTol(m);
  if (tol.isZero()) return { rows: m.rows, cols: m.cols, cells: m.cells.map((r) => [...r]) };
  const grid = m.cells.map((row) => [...row]);
  let leadRow = 0;
  for (let col = 0; col < m.cols && leadRow < m.rows; col++) {
    let best = leadRow;
    for (let r = leadRow + 1; r < m.rows; r++) {
      if (grid[r][col].decimal.abs().gt(grid[best][col].decimal.abs())) best = r;
    }
    if (isBelowTol(grid[best][col], tol)) continue;
    if (best !== leadRow) [grid[leadRow], grid[best]] = [grid[best], grid[leadRow]];
    const piv = grid[leadRow][col];
    for (let c = col; c < m.cols; c++) grid[leadRow][c] = divide(grid[leadRow][c], piv);
    for (let r = 0; r < m.rows; r++) {
      if (r === leadRow || isBelowTol(grid[r][col], tol)) continue;
      const fac = grid[r][col];
      for (let c = col; c < m.cols; c++) {
        grid[r][c] = subtract(grid[r][c], multiply(fac, grid[leadRow][c]));
      }
      grid[r][col] = scalarFromInteger(0);
    }
    leadRow++;
  }
  return { rows: m.rows, cols: m.cols, cells: grid };
}

export function powerMatrix(m: MatrixValue, exp: Scalar): MatrixValue {
  if (m.rows !== m.cols) throw new CalculatorError('Argument ERROR', 'Power requires square matrix');
  if (!exp.decimal.isInteger()) mathError('Matrix power must be integer');
  const n = exp.decimal.toNumber();
  if (Math.abs(n) > 20) mathError('Matrix power out of range');
  const identity: MatrixValue = {
    rows: m.rows,
    cols: m.cols,
    cells: Array.from({ length: m.rows }, (_, r) =>
      Array.from({ length: m.cols }, (__, c) => scalarFromInteger(r === c ? 1 : 0)),
    ),
  };
  if (n === 0) return identity;
  let cur = n < 0 ? invertMatrix(m) : m;
  let acc = identity;
  let k = Math.abs(n);
  while (k > 0) {
    if (k & 1) acc = multiplyMatrix(acc, cur);
    k >>= 1;
    if (k > 0) cur = multiplyMatrix(cur, cur);
  }
  return acc;
}

export type MatrixEvalVal = { kind: 'matrix'; matrix: MatrixValue } | { kind: 'scalar'; scalar: Scalar };

export interface MatrixEvalContext {
  matrices: Record<MatrixName, StoredMatrix | null>;
  variables: Record<VariableName, StoredScalar>;
  ans: StoredScalar;
  preAns?: StoredScalar;
  angle?: AngleUnit;
  numberFormat?: NumberFormatSetting;
  rng?: () => number;
}

const SCALAR_FNS = [
  'RanInt#', 'mfrac', 'cbrt', 'root', 'logb', 'sqrt',
  'asinh', 'acosh', 'atanh', 'sinh', 'cosh', 'tanh',
  'asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'ln', 'log',
  'Intg', 'GCD', 'LCM', 'Int', 'Rnd',
];

type MatTok =
  | { type: 'num'; text: string }
  | { type: 'recur'; parts: [string, string, string] }
  | { type: 'mat'; name: MatrixName }
  | { type: 'fn'; name: 'det' | 'Trn' | 'abs' | 'Ref' | 'Rref' | 'frac' }
  | { type: 'sfn'; name: string }
  | { type: 'var'; text: string }
  | { type: 'op'; text: string }
  | { type: 'dms' }
  | { type: 'postfix'; text: string }
  | { type: 'comma' }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'end' };

const VAR_SET = new Set<string>(VARIABLES);

function tokenizeMatrix(source: string): MatTok[] {
  const tokens: MatTok[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    const rest = source.slice(i);
    let matchedMat = false;
    for (const mName of ['MatAns', 'MatA', 'MatB', 'MatC'] as MatrixName[]) {
      if (rest.startsWith(mName)) {
        tokens.push({ type: 'mat', name: mName });
        i += mName.length;
        matchedMat = true;
        break;
      }
    }
    if (matchedMat) continue;
    const convMatch = rest.match(/^▸conv(?:0[1-9]|[1-3]\d|40)/);
    if (convMatch) { tokens.push({ type: 'postfix', text: convMatch[0] }); i += convMatch[0].length; continue; }
    const constMatch = rest.match(/^const(?:0[1-9]|[1-3]\d|40)/);
    if (constMatch) { tokens.push({ type: 'var', text: constMatch[0] }); i += constMatch[0].length; continue; }
    if (rest.startsWith('Rref(')) { tokens.push({ type: 'fn', name: 'Rref' }); tokens.push({ type: 'open' }); i += 5; continue; }
    if (rest.startsWith('Ref(')) { tokens.push({ type: 'fn', name: 'Ref' }); tokens.push({ type: 'open' }); i += 4; continue; }
    if (rest.startsWith('det(')) { tokens.push({ type: 'fn', name: 'det' }); tokens.push({ type: 'open' }); i += 4; continue; }
    if (rest.startsWith('Trn(')) { tokens.push({ type: 'fn', name: 'Trn' }); tokens.push({ type: 'open' }); i += 4; continue; }
    if (rest.startsWith('abs(')) { tokens.push({ type: 'fn', name: 'abs' }); tokens.push({ type: 'open' }); i += 4; continue; }
    if (rest.startsWith('frac(')) { tokens.push({ type: 'fn', name: 'frac' }); tokens.push({ type: 'open' }); i += 5; continue; }
    const sfn = SCALAR_FNS.find((fn) => rest.startsWith(`${fn}(`));
    if (sfn) {
      tokens.push({ type: 'sfn', name: sfn });
      tokens.push({ type: 'open' });
      i += sfn.length + 1;
      continue;
    }
    if (rest.startsWith('Ran#')) { tokens.push({ type: 'var', text: 'Ran#' }); i += 4; continue; }
    if (rest.startsWith('PreAns')) { tokens.push({ type: 'var', text: 'PreAns' }); i += 6; continue; }
    if (rest.startsWith('Ans')) { tokens.push({ type: 'var', text: 'Ans' }); i += 3; continue; }
    if (rest.startsWith('nCr') || rest.startsWith('nPr')) {
      tokens.push({ type: 'op', text: rest.slice(0, 3) });
      i += 3;
      continue;
    }
    const recMatch = rest.match(/^(?:(\d+)\.(\d*)|\.(\d*))r\((\d+)\)/);
    if (recMatch) {
      if (tokens[tokens.length - 1]?.type === 'num' || tokens[tokens.length - 1]?.type === 'recur') {
        syntax('Adjacent numbers are invalid');
      }
      const intPart = recMatch[1] ?? '0';
      const nonRep = recMatch[1] !== undefined ? (recMatch[2] ?? '') : (recMatch[3] ?? '');
      tokens.push({ type: 'recur', parts: [intPart, nonRep, recMatch[4]] });
      i += recMatch[0].length;
      continue;
    }
    const num = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (num) {
      if (tokens[tokens.length - 1]?.type === 'num' || tokens[tokens.length - 1]?.type === 'recur') {
        syntax('Adjacent numbers are invalid');
      }
      tokens.push({ type: 'num', text: num[0] });
      i += num[0].length;
      continue;
    }
    if (VAR_SET.has(ch) || ch === 'π' || ch === 'e') { tokens.push({ type: 'var', text: ch }); i++; continue; }
    if (ch === '°') { tokens.push({ type: 'dms' }); i++; continue; }
    if (ch === '!' || ch === '%' || ch === 'ᵈ' || ch === 'ʳ' || ch === 'ᵍ') {
      tokens.push({ type: 'postfix', text: ch });
      i++;
      continue;
    }
    if ('+-−×÷*/^⏨'.includes(ch)) { tokens.push({ type: 'op', text: ch === '−' ? '-' : ch }); i++; continue; }
    if (ch === ',') { tokens.push({ type: 'comma' }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'open' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'close' }); i++; continue; }
    syntax(`Unexpected '${ch}' in MATRIX`);
  }
  tokens.push({ type: 'end' });
  return tokens;
}

export function evaluateMatrixExpression(source: string, ctx: MatrixEvalContext): MatrixEvalVal {
  try {
    const tokens = tokenizeMatrix(completeParentheses(source));
    const angle = ctx.angle ?? 'DEG';
    let pos = 0;
    const peek = () => tokens[pos];
    const take = () => tokens[pos++];

    function parseExpr(minPrec: number): MatrixEvalVal {
      let left = parsePrefix();
      for (;;) {
        const next = peek();
        if (next.type === 'dms') {
          if (45 < minPrec) break;
          take();
          if (left.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'DMS requires scalar');
          const parts: Scalar[] = [left.scalar];
          while (parts.length < 3 && peek().type === 'num' && tokens[pos + 1]?.type === 'dms') {
            parts.push(scalarFromLiteral((take() as Extract<MatTok, { type: 'num' }>).text));
            take();
          }
          left = { kind: 'scalar', scalar: dmsToScalar(parts) };
          continue;
        }
        if (next.type === 'postfix') {
          if (40 < minPrec) break;
          take();
          if (left.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Postfix operator requires scalar');
          if (next.text === '!') left = { kind: 'scalar', scalar: factorial(left.scalar) };
          else if (next.text === '%') left = { kind: 'scalar', scalar: divide(left.scalar, scalarFromInteger(100)) };
          else if (next.text === 'ᵈ') left = { kind: 'scalar', scalar: convertAngleToActive(left.scalar, 'DEG', angle) };
          else if (next.text === 'ʳ') left = { kind: 'scalar', scalar: convertAngleToActive(left.scalar, 'RAD', angle) };
          else if (next.text === 'ᵍ') left = { kind: 'scalar', scalar: convertAngleToActive(left.scalar, 'GRA', angle) };
          else left = { kind: 'scalar', scalar: applyUnitConversion(left.scalar, next.text) };
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
            : op === '⏨' ? 32 : 0;
        } else if (
          next.type === 'num' ||
          next.type === 'recur' ||
          next.type === 'mat' ||
          next.type === 'fn' ||
          next.type === 'sfn' ||
          next.type === 'var' ||
          next.type === 'open'
        ) {
          op = '×';
          prec = 23;
          implicit = true;
        }
        if (!op || prec < minPrec || prec === 0) break;
        if (!implicit) take();
        const right = op === '⏨' ? parseSciExp() : parseExpr(op === '^' ? prec : prec + 1);

        if (op === '+' || op === '-') {
          if (left.kind === 'matrix' && right.kind === 'matrix') {
            left = { kind: 'matrix', matrix: addMatrix(left.matrix, right.matrix, op === '-') };
          } else if (left.kind === 'scalar' && right.kind === 'scalar') {
            left = { kind: 'scalar', scalar: op === '-' ? subtract(left.scalar, right.scalar) : add(left.scalar, right.scalar) };
          } else {
            throw new CalculatorError('Argument ERROR', 'Cannot add scalar and matrix');
          }
        } else if (op === '×' || op === '*') {
          if (left.kind === 'matrix' && right.kind === 'matrix') left = { kind: 'matrix', matrix: multiplyMatrix(left.matrix, right.matrix) };
          else if (left.kind === 'scalar' && right.kind === 'matrix') left = { kind: 'matrix', matrix: scaleMatrix(left.scalar, right.matrix) };
          else if (left.kind === 'matrix' && right.kind === 'scalar') left = { kind: 'matrix', matrix: scaleMatrix(right.scalar, left.matrix) };
          else if (left.kind === 'scalar' && right.kind === 'scalar') left = { kind: 'scalar', scalar: multiply(left.scalar, right.scalar) };
        } else if (op === '÷' || op === '/') {
          if (right.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Cannot divide by matrix directly; use ^(-1)');
          const inv = divide(scalarFromInteger(1), right.scalar);
          left = left.kind === 'matrix'
            ? { kind: 'matrix', matrix: scaleMatrix(inv, left.matrix) }
            : { kind: 'scalar', scalar: multiply(left.scalar, inv) };
        } else if (op === 'nCr' || op === 'nPr') {
          if (left.kind !== 'scalar' || right.kind !== 'scalar') {
            throw new CalculatorError('Argument ERROR', 'Combinatorics requires scalar');
          }
          left = { kind: 'scalar', scalar: combinatoric(left.scalar, right.scalar, op === 'nPr') };
        } else if (op === '^') {
          if (right.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Matrix exponent must be scalar');
          if (left.kind === 'matrix') left = { kind: 'matrix', matrix: powerMatrix(left.matrix, right.scalar) };
          else left = { kind: 'scalar', scalar: power(left.scalar, right.scalar) };
        } else if (op === '⏨') {
          if (left.kind !== 'scalar' || right.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Scientific exponent requires scalar');
          left = { kind: 'scalar', scalar: multiply(left.scalar, power(scalarFromInteger(10), right.scalar)) };
        }
      }
      return left;
    }

    function parseSciExp(): MatrixEvalVal {
      const next = peek();
      if (next.type === 'op' && (next.text === '+' || next.text === '-')) {
        take();
        const mag = parseSciExp();
        if (mag.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Scientific exponent requires scalar');
        return { kind: 'scalar', scalar: next.text === '-' ? negate(mag.scalar) : mag.scalar };
      }
      return parseExpr(33);
    }

    function parsePrefix(): MatrixEvalVal {
      const tok = take();
      if (tok.type === 'op' && (tok.text === '+' || tok.text === '-')) {
        const operand = parseExpr(30);
        if (tok.text === '+') return operand;
        return operand.kind === 'matrix'
          ? { kind: 'matrix', matrix: scaleMatrix(scalarFromInteger(-1), operand.matrix) }
          : { kind: 'scalar', scalar: negate(operand.scalar) };
      }
      if (tok.type === 'op' && tok.text === '⏨') {
        const exp = parseSciExp();
        if (exp.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Scientific exponent requires scalar');
        return { kind: 'scalar', scalar: power(scalarFromInteger(10), exp.scalar) };
      }
      if (tok.type === 'num') return { kind: 'scalar', scalar: scalarFromLiteral(tok.text) };
      if (tok.type === 'recur') return { kind: 'scalar', scalar: scalarFromRecurring(tok.parts[0], tok.parts[1], tok.parts[2]) };
      if (tok.type === 'var') {
        const constant = CONSTANT_BY_TOKEN.get(tok.text);
        if (constant) return { kind: 'scalar', scalar: { ...scalarFromLiteral(constant.value), preferDecimal: true } };
        if (tok.text === 'Ran#') {
          const sample = (ctx.rng ?? Math.random)();
          const millis = Math.min(999, Math.max(0, Math.floor(sample * 1000)));
          return { kind: 'scalar', scalar: scalarFromLiteral((millis / 1000).toFixed(3)) };
        }
        if (tok.text === 'π') return { kind: 'scalar', scalar: scalarPi() };
        if (tok.text === 'e') return { kind: 'scalar', scalar: makeScalar(new D(1).exp(), undefined, false) };
        if (tok.text === 'PreAns') return { kind: 'scalar', scalar: deserialize(ctx.preAns ?? ctx.ans) };
        const s = tok.text === 'Ans' ? deserialize(ctx.ans) : deserialize(ctx.variables[tok.text as VariableName]);
        return { kind: 'scalar', scalar: s };
      }
      if (tok.type === 'mat') {
        const stored = ctx.matrices[tok.name];
        if (!stored) throw new CalculatorError('Argument ERROR', `${tok.name} is undefined`);
        return { kind: 'matrix', matrix: deserializeMatrix(stored) };
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
        return {
          kind: 'scalar',
          scalar: applyFunction(tok.name, args, angle, { rng: ctx.rng, numberFormat: ctx.numberFormat }),
        };
      }
      if (tok.type === 'fn') {
        if (peek().type !== 'open') syntax('Expected (');
        take();
        if (tok.name === 'frac') {
          const num = parseExpr(0);
          if (peek().type !== 'comma') syntax('Expected , in frac');
          take();
          const den = parseExpr(0);
          if (peek().type !== 'close') syntax('Expected )');
          take();
          if (den.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Cannot divide by matrix directly');
          const inv = divide(scalarFromInteger(1), den.scalar);
          return num.kind === 'matrix'
            ? { kind: 'matrix', matrix: scaleMatrix(inv, num.matrix) }
            : { kind: 'scalar', scalar: multiply(num.scalar, inv) };
        }
        const inner = parseExpr(0);
        if (peek().type !== 'close') syntax('Expected )');
        take();
        if (tok.name === 'det') {
          if (inner.kind !== 'matrix') throw new CalculatorError('Argument ERROR', 'det expects matrix');
          return { kind: 'scalar', scalar: determinantMatrix(inner.matrix) };
        }
        if (tok.name === 'Trn') {
          if (inner.kind !== 'matrix') throw new CalculatorError('Argument ERROR', 'Trn expects matrix');
          return { kind: 'matrix', matrix: transposeMatrix(inner.matrix) };
        }
        if (tok.name === 'Ref') {
          if (inner.kind !== 'matrix') throw new CalculatorError('Argument ERROR', 'Ref expects matrix');
          return { kind: 'matrix', matrix: refMatrix(inner.matrix) };
        }
        if (tok.name === 'Rref') {
          if (inner.kind !== 'matrix') throw new CalculatorError('Argument ERROR', 'Rref expects matrix');
          return { kind: 'matrix', matrix: rrefMatrix(inner.matrix) };
        }
        if (inner.kind === 'matrix') return { kind: 'matrix', matrix: absMatrix(inner.matrix) };
        return { kind: 'scalar', scalar: inner.scalar.decimal.isNegative() ? negate(inner.scalar) : inner.scalar };
      }
      if (tok.type === 'open') {
        const v = parseExpr(0);
        if (peek().type !== 'close') syntax('Expected )');
        take();
        return v;
      }
      return syntax('Expected matrix or scalar');
    }

    if (peek().type === 'end') syntax('Empty matrix expression');
    const out = parseExpr(0);
    if (peek().type !== 'end') syntax('Unexpected token');
    return out;
  } catch (err) {
    if (err instanceof CalculatorError) throw err;
    if (err instanceof Error && err.message.startsWith('[DecimalError]')) mathError(err.message);
    throw err;
  }
}
