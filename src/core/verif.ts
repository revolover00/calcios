import { syntax } from './errors';
import { evaluateExpression, type EvaluationContext } from './expression';
import { D, type Scalar } from './value';

export type VerifOperator = '=' | '≠' | '>' | '<' | '≥' | '≤';

const VERIF_OPS: VerifOperator[] = ['≠', '≥', '≤', '=', '>', '<'];

function compareValues(op: VerifOperator, lhs: Scalar, rhs: Scalar): boolean {
  if (lhs.exact && rhs.exact) {
    const crossL = lhs.exact.n * rhs.exact.d;
    const crossR = rhs.exact.n * lhs.exact.d;
    switch (op) {
      case '=': return crossL === crossR;
      case '≠': return crossL !== crossR;
      case '>': return crossL > crossR;
      case '<': return crossL < crossR;
      case '≥': return crossL >= crossR;
      case '≤': return crossL <= crossR;
    }
  }

  const diff = lhs.decimal.minus(rhs.decimal);
  const lhsZero = lhs.decimal.isZero();
  const rhsZero = rhs.decimal.isZero();
  let eq: boolean;
  if (lhsZero && rhsZero) {
    eq = true;
  } else if (lhsZero || rhsZero) {
    eq = diff.abs().lte('1e-34');
  } else {
    const maxMag = D.max(lhs.decimal.abs(), rhs.decimal.abs());
    eq = diff.abs().lte(maxMag.times('1e-12'));
  }

  switch (op) {
    case '=': return eq;
    case '≠': return !eq;
    case '>': return !eq && diff.gt(0);
    case '<': return !eq && diff.lt(0);
    case '≥': return eq || diff.gt(0);
    case '≤': return eq || diff.lt(0);
  }
}

export function evaluateVerification(source: string, ctx: EvaluationContext): boolean {
  const ops: Array<{ op: VerifOperator; index: number }> = [];
  let depth = 0;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') { depth++; continue; }
    if (ch === ')') { if (depth > 0) depth--; continue; }
    if (depth === 0) {
      for (const op of VERIF_OPS) {
        if (source.startsWith(op, i)) {
          ops.push({ op, index: i });
          i += op.length - 1;
          break;
        }
      }
    }
  }

  if (ops.length === 0) syntax('Expected relational operator (=, ≠, >, <, ≥, ≤)', source.length);

  // Validate Calcios chaining rules: ≠ cannot be chained; mixed < and > cannot be chained
  if (ops.length > 1) {
    const neqItem = ops.find((o) => o.op === '≠');
    if (neqItem) syntax('Cannot chain ≠ in VERIF', neqItem.index);
    const hasLess = ops.some((o) => o.op === '<' || o.op === '≤');
    const hasGreater = ops.some((o) => o.op === '>' || o.op === '≥');
    if (hasLess && hasGreater) syntax('Cannot mix < and > directions in VERIF chain', ops[1].index);
  }

  const parts: string[] = [];
  let prev = 0;
  for (const item of ops) {
    const seg = source.slice(prev, item.index).trim();
    if (!seg) syntax('Incomplete verification statement', item.index);
    parts.push(seg);
    prev = item.index + item.op.length;
  }
  const tail = source.slice(prev).trim();
  if (!tail) syntax('Incomplete verification statement', prev);
  parts.push(tail);

  // Evaluate each operand ONCE so chained inequalities like 0 ≤ Ran# ≤ 1 compare the same middle sample
  const evaluated = parts.map((seg) => evaluateExpression(seg, ctx));
  for (let i = 0; i < ops.length; i++) {
    if (!compareValues(ops[i].op, evaluated[i], evaluated[i + 1])) return false;
  }
  return true;
}
