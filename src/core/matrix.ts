import { CalculatorError, mathError, syntax } from './errors';
import { completeParentheses } from './expression';
import {
  VARIABLES, add, deserialize, divide, multiply, negate, scalarFromInteger, scalarFromLiteral,
  serialize, subtract, zeroStored, type Scalar, type StoredScalar, type VariableName,
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

function isTiny(s: Scalar): boolean {
  if (s.exact) return s.exact.n === 0n;
  return s.decimal.abs().lt('1e-26');
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
  const aug: Scalar[][] = m.cells.map((row, r) => [
    ...row,
    ...Array.from({ length: n }, (_, c) => scalarFromInteger(r === c ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    let best = col;
    for (let r = col + 1; r < n; r++) {
      if (aug[r][col].decimal.abs().gt(aug[best][col].decimal.abs())) best = r;
    }
    if (isTiny(aug[best][col])) mathError('Singular matrix');
    [aug[col], aug[best]] = [aug[best], aug[col]];
    const piv = aug[col][col];
    for (let c = 0; c < 2 * n; c++) aug[col][c] = divide(aug[col][c], piv);
    for (let r = 0; r < n; r++) {
      if (r === col || isTiny(aug[r][col])) continue;
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
  const grid = m.cells.map((row) => [...row]);
  let leadRow = 0;
  for (let col = 0; col < m.cols && leadRow < m.rows; col++) {
    let best = leadRow;
    for (let r = leadRow + 1; r < m.rows; r++) {
      if (grid[r][col].decimal.abs().gt(grid[best][col].decimal.abs())) best = r;
    }
    if (isTiny(grid[best][col])) continue;
    if (best !== leadRow) [grid[leadRow], grid[best]] = [grid[best], grid[leadRow]];
    const piv = grid[leadRow][col];
    for (let c = col; c < m.cols; c++) grid[leadRow][c] = divide(grid[leadRow][c], piv);
    for (let r = leadRow + 1; r < m.rows; r++) {
      if (isTiny(grid[r][col])) continue;
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
  const grid = m.cells.map((row) => [...row]);
  let leadRow = 0;
  for (let col = 0; col < m.cols && leadRow < m.rows; col++) {
    let best = leadRow;
    for (let r = leadRow + 1; r < m.rows; r++) {
      if (grid[r][col].decimal.abs().gt(grid[best][col].decimal.abs())) best = r;
    }
    if (isTiny(grid[best][col])) continue;
    if (best !== leadRow) [grid[leadRow], grid[best]] = [grid[best], grid[leadRow]];
    const piv = grid[leadRow][col];
    for (let c = col; c < m.cols; c++) grid[leadRow][c] = divide(grid[leadRow][c], piv);
    for (let r = 0; r < m.rows; r++) {
      if (r === leadRow || isTiny(grid[r][col])) continue;
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
  if (n === -1) return invertMatrix(m);
  if (n < -1 || n > 20) mathError('Matrix power out of range');
  if (n === 0) {
    return {
      rows: m.rows,
      cols: m.cols,
      cells: Array.from({ length: m.rows }, (_, r) =>
        Array.from({ length: m.cols }, (__, c) => scalarFromInteger(r === c ? 1 : 0)),
      ),
    };
  }
  let acc = m;
  for (let i = 1; i < n; i++) acc = multiplyMatrix(acc, m);
  return acc;
}

export type MatrixEvalVal = { kind: 'matrix'; matrix: MatrixValue } | { kind: 'scalar'; scalar: Scalar };

export interface MatrixEvalContext {
  matrices: Record<MatrixName, StoredMatrix | null>;
  variables: Record<VariableName, StoredScalar>;
  ans: StoredScalar;
}

type MatTok =
  | { type: 'num'; text: string }
  | { type: 'mat'; name: MatrixName }
  | { type: 'fn'; name: 'det' | 'Trn' | 'abs' | 'Ref' | 'Rref' }
  | { type: 'var'; text: string }
  | { type: 'op'; text: string }
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
    if (rest.startsWith('Rref(')) { tokens.push({ type: 'fn', name: 'Rref' }); tokens.push({ type: 'open' }); i += 5; continue; }
    if (rest.startsWith('Ref(')) { tokens.push({ type: 'fn', name: 'Ref' }); tokens.push({ type: 'open' }); i += 4; continue; }
    if (rest.startsWith('det(')) { tokens.push({ type: 'fn', name: 'det' }); tokens.push({ type: 'open' }); i += 4; continue; }
    if (rest.startsWith('Trn(')) { tokens.push({ type: 'fn', name: 'Trn' }); tokens.push({ type: 'open' }); i += 4; continue; }
    if (rest.startsWith('abs(')) { tokens.push({ type: 'fn', name: 'abs' }); tokens.push({ type: 'open' }); i += 4; continue; }
    if (rest.startsWith('Ans')) { tokens.push({ type: 'var', text: 'Ans' }); i += 3; continue; }
    const num = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (num) { tokens.push({ type: 'num', text: num[0] }); i += num[0].length; continue; }
    if (VAR_SET.has(ch)) { tokens.push({ type: 'var', text: ch }); i++; continue; }
    if ('+-−×÷*/^'.includes(ch)) { tokens.push({ type: 'op', text: ch === '−' ? '-' : ch }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'open' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'close' }); i++; continue; }
    syntax(`Unexpected '${ch}' in MATRIX`);
  }
  tokens.push({ type: 'end' });
  return tokens;
}

export function evaluateMatrixExpression(source: string, ctx: MatrixEvalContext): MatrixEvalVal {
  const tokens = tokenizeMatrix(completeParentheses(source));
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  function parseExpr(minPrec: number): MatrixEvalVal {
    let left = parsePrefix();
    for (;;) {
      const next = peek();
      let op: string | undefined;
      let prec = 0;
      let implicit = false;
      if (next.type === 'op') {
        op = next.text;
        prec = op === '+' || op === '-' ? 10 : ['×', '÷', '*', '/'].includes(op) ? 20 : op === '^' ? 30 : 0;
      } else if (next.type === 'mat' || next.type === 'fn' || next.type === 'open') {
        op = '×';
        prec = 20;
        implicit = true;
      }
      if (!op || prec < minPrec || prec === 0) break;
      if (!implicit) take();
      const right = parseExpr(op === '^' ? prec : prec + 1);

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
      } else if (op === '^') {
        if (right.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Matrix exponent must be scalar');
        if (left.kind === 'matrix') left = { kind: 'matrix', matrix: powerMatrix(left.matrix, right.scalar) };
        else left = { kind: 'scalar', scalar: scalarFromLiteral(left.scalar.decimal.pow(right.scalar.decimal).toString()) };
      }
    }
    return left;
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
    if (tok.type === 'num') return { kind: 'scalar', scalar: scalarFromLiteral(tok.text) };
    if (tok.type === 'var') {
      const s = tok.text === 'Ans' ? deserialize(ctx.ans) : deserialize(ctx.variables[tok.text as VariableName]);
      return { kind: 'scalar', scalar: s };
    }
    if (tok.type === 'mat') {
      const stored = ctx.matrices[tok.name];
      if (!stored) throw new CalculatorError('Argument ERROR', `${tok.name} is undefined`);
      return { kind: 'matrix', matrix: deserializeMatrix(stored) };
    }
    if (tok.type === 'fn') {
      if (peek().type !== 'open') syntax('Expected (');
      take();
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
}
