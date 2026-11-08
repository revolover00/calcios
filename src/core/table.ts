import { CalculatorError, mathError } from './errors';
import { evaluateExpression, type EvaluationContext } from './expression';
import { formatDecimal } from './format';
import { add, multiply, scalarFromInteger, serialize, type Scalar } from './value';

export interface TableRow {
  index: number;
  x: string;
  fx: string;
  gx?: string;
}

export function generateFunctionTable(
  fExpr: string,
  gExpr: string | null,
  start: Scalar,
  end: Scalar,
  step: Scalar,
  context: EvaluationContext,
): TableRow[] {
  if (step.decimal.lte(0)) mathError('Table step must be positive');
  if (end.decimal.lt(start.decimal)) mathError('Table End must be >= Start');

  const hasG = Boolean(gExpr && gExpr.trim().length > 0);
  const maxRows = hasG ? 20 : 30;

  const span = end.decimal.minus(start.decimal).div(step.decimal);
  const count = Math.floor(Number(span.plus('1e-12').toFixed(6))) + 1;
  if (!Number.isFinite(count) || count < 1 || count > maxRows) {
    mathError(`Table exceeds ${maxRows} rows`);
  }

  const evalCell = (expr: string, xVal: Scalar): string => {
    try {
      const val = evaluateExpression(expr, {
        ...context,
        variables: { ...context.variables, X: serialize(xVal) },
      });
      return formatDecimal(val, context.numberFormat);
    } catch (err) {
      if (err instanceof CalculatorError && err.kind === 'Syntax ERROR') throw err;
      return 'ERROR';
    }
  };

  // Validate syntax once up front
  if (!fExpr.trim()) throw new CalculatorError('Syntax ERROR', 'Empty f(X)');

  const rows: TableRow[] = [];
  for (let i = 0; i < count; i++) {
    const xVal = add(start, multiply(step, scalarFromInteger(i)));
    const row: TableRow = {
      index: i + 1,
      x: formatDecimal(xVal, context.numberFormat),
      fx: evalCell(fExpr, xVal),
    };
    if (hasG && gExpr) {
      row.gx = evalCell(gExpr, xVal);
    }
    rows.push(row);
  }
  return rows;
}
