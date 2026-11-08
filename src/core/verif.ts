import { syntax } from './errors';
import { evaluateExpression, type EvaluationContext } from './expression';

export type VerifOperator = '=' | '≠' | '>' | '<' | '≥' | '≤';

const VERIF_OPS: VerifOperator[] = ['≠', '≥', '≤', '=', '>', '<'];

export function evaluateVerification(source: string, ctx: EvaluationContext): boolean {
  let foundOp: VerifOperator | null = null;
  let foundIndex = -1;

  for (let i = 0; i < source.length; i++) {
    for (const op of VERIF_OPS) {
      if (source.startsWith(op, i)) {
        if (foundOp !== null) syntax('Only one relational operator is allowed in VERIF');
        foundOp = op;
        foundIndex = i;
        break;
      }
    }
  }

  if (!foundOp || foundIndex === -1) syntax('Expected relational operator (=, ≠, >, <, ≥, ≤)');

  const lhsText = source.slice(0, foundIndex).trim();
  const rhsText = source.slice(foundIndex + foundOp.length).trim();
  if (!lhsText || !rhsText) syntax('Incomplete verification statement');

  const lhs = evaluateExpression(lhsText, ctx);
  const rhs = evaluateExpression(rhsText, ctx);
  const diff = lhs.decimal.minus(rhs.decimal);
  const scale = lhs.decimal.abs().plus(rhs.decimal.abs()).plus(1);
  const eq = diff.abs().lte(scale.times('1e-24'));

  switch (foundOp) {
    case '=': return eq;
    case '≠': return !eq;
    case '>': return !eq && diff.gt(0);
    case '<': return !eq && diff.lt(0);
    case '≥': return eq || diff.gt(0);
    case '≤': return eq || diff.lt(0);
  }
}
