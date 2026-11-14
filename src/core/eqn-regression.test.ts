import { describe, expect, it } from 'vitest';
import { solveCubic, solveLinear3, solveQuadratic } from './eqn';
import { solveInequality } from './ineq';
import { makeScalar, scalarFromInteger, scalarFromLiteral } from './value';

describe('equation solver small-root regressions', () => {
  it('solves 3×3 systems whose independent rows have very different scales', () => {
    const approx = (value: string) => makeScalar(value, undefined, true);
    const result = solveLinear3([
      approx('1e30'), approx('0'), approx('0'), approx('1e30'),
      approx('0'), approx('1'), approx('0'), approx('2'),
      approx('0'), approx('0'), approx('1'), approx('3'),
    ]);
    expect(result.status).toBe('solved');
    if (result.status === 'solved') {
      expect(result.items.map((item) => item.scalar?.decimal.toNumber())).toEqual([1, 2, 3]);
    }
  });
  it('does not hide a small inconsistent equation behind a huge right-hand side', () => {
    const approx = (value: string) => makeScalar(value, undefined, true);
    const result = solveLinear3([
      approx('1'), approx('0'), approx('0'), approx('1e30'),
      approx('0'), approx('1'), approx('0'), approx('0'),
      approx('0'), approx('1'), approx('0'), approx('1'),
    ]);
    expect(result.status).toBe('no-solution');
  });

  it('retains the small root in quadratic inequalities too', () => {
    const out = solveInequality(2, '>', [
      scalarFromInteger(1), scalarFromLiteral('1e20'), scalarFromInteger(1),
    ]);
    expect(out.roots).toHaveLength(2);
    expect(out.roots.some((root) => root.decimal.eq('-1e-20'))).toBe(true);
  });

  it('retains the small root when the quadratic formula would cancel', () => {
    const out = solveQuadratic([
      scalarFromInteger(1), scalarFromLiteral('1e20'), scalarFromInteger(1),
    ]);
    expect(out.status).toBe('solved');
    if (out.status === 'solved') {
      const small = out.items.find((item) => item.label === 'X₁')?.scalar;
      expect(small?.decimal.toString()).toBe('-1e-20');
    }
  });
  it('keeps distinct inequality roots closer than the old absolute dedupe threshold', () => {
    const result = solveInequality(2, '>', [
      scalarFromInteger(1),
      scalarFromLiteral('-2.00000000000000000001'),
      scalarFromLiteral('1.00000000000000000001'),
    ]);

    expect(result.roots).toHaveLength(2);
    expect(result.roots[0].decimal.eq(1)).toBe(true);
    expect(result.roots[1].decimal.minus('1.00000000000000000001').abs().lt('1e-35')).toBe(true);
  });

  it('does not rational-snap a cubic root that is merely near an integer', () => {
    const result = solveCubic([
      makeScalar('1', undefined, true),
      makeScalar('-6.0000000000000000000000001', undefined, true),
      makeScalar('11.0000000000000000000000003', undefined, true),
      makeScalar('-6.0000000000000000000000002', undefined, true),
    ]);
    expect(result.status).toBe('solved');
    if (result.status === 'solved') {
      const roots = result.items.flatMap((item) => item.scalar ? [item.scalar] : []);
      expect(roots.some((root) => root.decimal.minus(`3.0000000000000000000000001`).abs().lt('1e-30'))).toBe(true);
      expect(roots.some((root) => root.decimal.eq(3))).toBe(false);
    }
  });

  it('keeps tiny nonzero real parts in complex quadratic roots', () => {
    const result = solveQuadratic([
      scalarFromInteger(1),
      scalarFromLiteral('-2e-30'),
      scalarFromInteger(1),
    ]);
    expect(result.status).toBe('solved');
    if (result.status === 'solved') {
      const complexRoot = result.items.find((item) => item.complexParts);
      expect(complexRoot?.complexParts?.re.decimal.toString()).toBe('1e-30');
      expect(complexRoot?.complexText).toMatch(/\+/);
    }
  });

  it('does not merge distinct cubic roots merely because their absolute gap is tiny', () => {
    const result = solveCubic([
      scalarFromInteger(1),
      scalarFromLiteral('-3e-30'),
      scalarFromLiteral('2e-60'),
      scalarFromInteger(0),
    ]);
    expect(result.status).toBe('solved');
    if (result.status === 'solved') {
      expect(result.items.filter((item) => item.scalar)).toHaveLength(3);
      const roots = result.items.flatMap((item) => item.scalar ? [item.scalar.decimal] : []);
      expect(roots.some((root) => root.eq('0'))).toBe(true);
      expect(roots.some((root) => root.minus('1e-30').abs().lt('1e-40'))).toBe(true);
      expect(roots.some((root) => root.minus('2e-30').abs().lt('1e-40'))).toBe(true);
    }
  });

  it('preserves real cubic roots far below the old absolute-zero threshold', () => {
    const result = solveCubic([
      scalarFromInteger(1),
      scalarFromInteger(0),
      scalarFromInteger(0),
      scalarFromLiteral('-1e-90'),
    ]);

    expect(result.status).toBe('solved');
    if (result.status === 'solved') {
      const realRoot = result.items.find((item) => item.scalar);
      expect(realRoot?.scalar?.decimal.minus('1e-30').abs().lt('1e-40')).toBe(true);
    }
  });
});
