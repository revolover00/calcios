import { describe, expect, it } from 'vitest';
import { numericDerivative, numericIntegral, solveRoot } from './calculus';
import { makeScalar, scalarFromInteger } from './value';

describe('small-result calculus regressions', () => {
  it('preserves derivatives and integrals smaller than 1e-22', () => {
    const tinyDerivative = numericDerivative(
      (x) => makeScalar(x.decimal.times('1e-30'), undefined, true),
      scalarFromInteger(0),
    );
    const tinyIntegral = numericIntegral(
      () => makeScalar('1e-30', undefined, true),
      scalarFromInteger(0),
      scalarFromInteger(1),
    );

    expect(tinyDerivative.decimal.minus('1e-30').abs().lt('1e-40')).toBe(true);
    expect(tinyIntegral.decimal.minus('1e-30').abs().lt('1e-40')).toBe(true);
  });
});

describe('adaptive integration polynomial sweep', () => {
  it('matches polynomial derivatives across degrees and scales', () => {
    for (let exponent = 0; exponent <= 8; exponent++) {
      const fn = (x: ReturnType<typeof scalarFromInteger>) => makeScalar(x.decimal.pow(exponent), undefined, true);
      for (const point of [-3, -0.5, 0, 2, 10]) {
        const derivative = numericDerivative(fn, makeScalar(String(point), undefined, true));
        const expected = exponent === 0 ? 0 : exponent * point ** (exponent - 1);
        const scale = Math.max(1, Math.abs(expected));
        expect(derivative.decimal.minus(expected).abs().lte(String(scale * 1e-8))).toBe(true);
      }
    }
  });

  it('matches exact polynomial antiderivatives and preserves reversed-bound signs', () => {
    for (let exponent = 0; exponent <= 8; exponent++) {
      const fn = (x: ReturnType<typeof scalarFromInteger>) => makeScalar(x.decimal.pow(exponent), undefined, true);
      const a = -2;
      const b = 3;
      const exact = (b ** (exponent + 1) - a ** (exponent + 1)) / (exponent + 1);
      const forward = numericIntegral(fn, scalarFromInteger(a), scalarFromInteger(b));
      const reverse = numericIntegral(fn, scalarFromInteger(b), scalarFromInteger(a));
      expect(forward.decimal.minus(exact).abs().lt('1e-10')).toBe(true);
      expect(reverse.decimal.plus(forward.decimal).abs().lt('1e-10')).toBe(true);
    }
  });
});

describe('root-solver small-residual regressions', () => { 
  it('does not snap a genuine root near zero to exactly zero', () => {
    const result = solveRoot(
      (x) => makeScalar(x.decimal.minus('1e-30'), undefined, true),
      scalarFromInteger(0),
    );

    expect(result.root.decimal.minus('1e-30').abs().lt('1e-40')).toBe(true);
  });

  it('solves equations whose entire output scale is much smaller than the absolute slope cutoff', () => {
    const result = solveRoot(
      (x) => makeScalar(x.decimal.minus('123.456').times('1e-30'), undefined, true),
      scalarFromInteger(0),
    );
    expect(result.root.decimal.minus('123.456').abs().lt('1e-8')).toBe(true);
  });

  it('does not mistake a scaled positive quadratic for a root', () => {
    expect(() => solveRoot(
      (x) => makeScalar(x.decimal.pow(2).plus(1).times('1e-30'), undefined, true),
      scalarFromInteger(0),
    )).toThrow(/CanNotSolve/);
  });

  it('does not accept a tiny nonzero residual as proof that a root exists', () => {
    expect(() => solveRoot(
      () => makeScalar('1e-30', undefined, true),
      scalarFromInteger(0),
    )).toThrow(/CanNotSolve/);
  });
});
