/** Errors visible on the calculator display, separate from programming errors. */
export class CalculatorError extends Error {
  readonly kind: 'Syntax ERROR' | 'Math ERROR' | 'Argument ERROR';
  readonly offset?: number;
  constructor(kind: CalculatorError['kind'], message: string = kind, offset?: number) {
    super(message);
    this.name = 'CalculatorError';
    this.kind = kind;
    this.offset = offset;
  }
}

export function syntax(message?: string, offset?: number): never {
  throw new CalculatorError('Syntax ERROR', message, offset);
}
export function mathError(message?: string, offset?: number): never {
  throw new CalculatorError('Math ERROR', message, offset);
}
