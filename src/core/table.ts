import { CalculatorError, mathError } from './errors';
import { evaluateExpression, type EvaluationContext } from './expression';
import { formatDecimal, type DecimalMark } from './format';
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
  decimalMark: DecimalMark = 'Dot',
): TableRow[] {
  if (step.decimal.lte(0)) mathError('Table step must be positive');
  if (end.decimal.lt(start.decimal)) mathError('Table End must be >= Start');

  const hasG = Boolean(gExpr && gExpr.trim().length > 0);
  const maxRows = hasG ? 20 : 30;

  const span = end.decimal.minus(start.decimal).div(step.decimal);
  if (span.gt(maxRows)) {
    mathError(`Table exceeds ${maxRows} rows`);
  }
  const countDec = span.floor().plus(1);
  if (!countDec.isFinite() || countDec.lt(1) || countDec.gt(maxRows)) {
    mathError(`Table exceeds ${maxRows} rows`);
  }
  const count = countDec.toNumber();

  // Validate syntax once up front
  if (!fExpr.trim()) throw new CalculatorError('Syntax ERROR', 'Empty f(X)');

  const evalCell = (expr: string, xVal: Scalar): string => {
    try {
      const val = evaluateExpression(expr, {
        ...context,
        random: context.rng ? undefined : context.random,
        rng: context.rng ?? (context.random === undefined ? () => Math.random() : undefined),
        variables: { ...context.variables, X: serialize(xVal) },
      });
      return formatDecimal(val, context.numberFormat, decimalMark);
    } catch (err) {
      if (err instanceof CalculatorError && err.kind === 'Syntax ERROR') throw err;
      return 'ERROR';
    }
  };

  const rows: TableRow[] = [];
  for (let i = 0; i < count; i++) {
    const xVal = add(start, multiply(step, scalarFromInteger(i)));
    const row: TableRow = {
      index: i + 1,
      x: formatDecimal(xVal, context.numberFormat, decimalMark),
      fx: evalCell(fExpr, xVal),
    };
    if (hasG && gExpr) {
      row.gx = evalCell(gExpr, xVal);
    }
    rows.push(row);
  }
  return rows;
}
