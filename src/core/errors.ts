/** Errors visible on the calculator display, separate from programming errors. */
export class CalculatorError extends Error {
  readonly kind: 'Syntax ERROR' | 'Math ERROR' | 'Argument ERROR';
  constructor(kind: CalculatorError['kind'], message: string = kind) {
    super(message);
    this.name = 'CalculatorError';
    this.kind = kind;
  }
}

export function syntax(message?: string): never { throw new CalculatorError('Syntax ERROR', message); }
export function mathError(message?: string): never { throw new CalculatorError('Math ERROR', message); }
