import { mathError } from './errors';
import { divide, multiply, type Scalar } from './value';

export type RatioForm = 'a:b=X:d' | 'a:b=c:X';

/** Solve the unknown term of a four-term proportion without losing exact fractions. */
export function solveRatio(form: RatioForm, a: Scalar, b: Scalar, known: Scalar): Scalar {
  if (b.decimal.isZero()) mathError('Division by zero');
  if (form === 'a:b=X:d') return divide(multiply(a, known), b);
  if (a.decimal.isZero()) mathError('Division by zero');
  return divide(multiply(b, known), a);
}
