import { syntax } from './errors';
import { evaluateExpression, type EvaluationContext } from './expression';

export type VerifOperator = '=' | '≠' | '>' | '<' | '≥' | '≤';

const VERIF_OPS: VerifOperator[] = ['≠', '≥', '≤', '=', '>', '<'];

function comparePair(op: VerifOperator, lhsText: string, rhsText: string, ctx: EvaluationContext): boolean {
  const lhs = evaluateExpression(lhsText, ctx);
  const rhs = evaluateExpression(rhsText, ctx);
  const diff = lhs.decimal.minus(rhs.decimal);
  const scale = lhs.decimal.abs().plus(rhs.decimal.abs()).plus(1);
  const eq = diff.abs().lte(scale.times('1e-24'));

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

  // Validate Casio chaining rules: ≠ cannot be chained; mixed < and > cannot be chained
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

  for (let i = 0; i < ops.length; i++) {
    if (!comparePair(ops[i].op, parts[i], parts[i + 1], ctx)) return false;
  }
  return true;
}
