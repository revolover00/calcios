import { describe, expect, it } from 'vitest';
import { poissonPd } from './dist';
import { computeStatSummary, estimateStatXHat, estimateStatXHat2, estimateStatYHat } from './stat';
import { scalarFromInteger, scalarFromLiteral } from './value';

const closeTo = (actual: { decimal: { minus(value: string): { abs(): { lt(value: string): boolean } } } }, expected: string) =>
  expect(actual.decimal.minus(expected).abs().lt('1e-28')).toBe(true);

describe('stable statistical variance', () => {
  it('keeps the small root in quadratic-regression x-hat when the direct formula cancels', () => {
    const base = computeStatSummary('_+CX2', [
      { x: '-2', y: '4', freq: '1' },
      { x: '-1', y: '1', freq: '1' },
      { x: '0', y: '0', freq: '1' },
      { x: '1', y: '1', freq: '1' },
      { x: '2', y: '4', freq: '1' },
    ]);
    const summary = {
      ...base,
      quadraticFit: {
        center: scalarFromInteger(0),
        scale: scalarFromInteger(1),
        a: scalarFromInteger(1),
        b: scalarFromLiteral('1e20'),
        c: scalarFromInteger(1),
      },
    };

    const xhat1 = estimateStatXHat('_+CX2', summary, scalarFromInteger(0));
    const xhat2 = estimateStatXHat2('_+CX2', summary, scalarFromInteger(0));
    expect(xhat1.decimal.minus('-1e-20').abs().lt('1e-35')).toBe(true);
    expect(xhat2.decimal.minus('-1e20').abs().div('1e20').lt('1e-25')).toBe(true);

    const negativeB = {
      ...summary,
      quadraticFit: { ...summary.quadraticFit!, b: scalarFromLiteral('-1e20') },
    };
    const negativeBRoot1 = estimateStatXHat('_+CX2', negativeB, scalarFromInteger(0));
    const negativeBRoot2 = estimateStatXHat2('_+CX2', negativeB, scalarFromInteger(0));
    expect(negativeBRoot1.decimal.minus('1e20').abs().div('1e20').lt('1e-25')).toBe(true);
    expect(negativeBRoot2.decimal.minus('1e-20').abs().lt('1e-35')).toBe(true);

    const rawCoefficients = {
      ...summary,
      quadraticFit: undefined,
      regA: scalarFromInteger(1),
      regB: scalarFromLiteral('1e20'),
      regC: scalarFromInteger(1),
    };
    expect(estimateStatXHat('_+CX2', rawCoefficients, scalarFromInteger(0)).decimal.minus('-1e-20').abs().lt('1e-35')).toBe(true);
    expect(estimateStatXHat2('_+CX2', rawCoefficients, scalarFromInteger(0)).decimal.minus('-1e20').abs().div('1e20').lt('1e-25')).toBe(true);
  });

  it('preserves tiny but representable means and standard deviations', () => {
    const summary = computeStatSummary('1-VAR', [
      { x: '1e-30', freq: '1' },
      { x: '2e-30', freq: '1' },
    ]);

    expect(summary.meanX.decimal.minus('1.5e-30').abs().lt('1e-60')).toBe(true);
    expect(summary.popSdX.decimal.minus('5e-31').abs().lt('1e-60')).toBe(true);
  });

  it('preserves variance for data with a large common offset', () => {
    const summary = computeStatSummary('1-VAR', [
      { x: '100000000000000000000', freq: '1' },
      { x: '100000000000000000001', freq: '1' },
    ]);

    closeTo(summary.popSdX, '0.5');
    expect(summary.sampSdX!.decimal.pow(2).minus('0.5').abs().lt('1e-28')).toBe(true);
  });

  it('applies frequency weights when combining stable moments', () => {
    const summary = computeStatSummary('1-VAR', [
      { x: '100000000000000000000', freq: '2' },
      { x: '100000000000000000001', freq: '2' },
    ]);

    closeTo(summary.popSdX, '0.5');
    expect(summary.sampSdX!.decimal.pow(2).times(3).minus(1).abs().lt('1e-28')).toBe(true);
  });

  it('uses stable moments for both variables in two-variable summaries', () => {
    const summary = computeStatSummary('A+BX', [
      { x: '100000000000000000000', y: '200000000000000000000', freq: '1' },
      { x: '100000000000000000001', y: '200000000000000000001', freq: '1' },
    ]);

    closeTo(summary.popSdX, '0.5');
    closeTo(summary.popSdY!, '0.5');
    expect(summary.sampSdY!.decimal.pow(2).minus('0.5').abs().lt('1e-28')).toBe(true);
  });

  it('fits a quadratic when data have a very large common X offset', () => {
    const summary = computeStatSummary('_+CX2', [
      { x: '100000000000000000000', y: '0', freq: '1' },
      { x: '100000000000000000001', y: '1', freq: '1' },
      { x: '100000000000000000002', y: '4', freq: '1' },
    ]);

    expect(summary.regC).toBeDefined();
    closeTo(summary.regC!, '1');
    closeTo(
      estimateStatYHat('_+CX2', summary, scalarFromLiteral('100000000000000000001')),
      '1',
    );
    closeTo(estimateStatXHat('_+CX2', summary, scalarFromInteger(1)), '100000000000000000001');
    closeTo(estimateStatXHat2('_+CX2', summary, scalarFromInteger(1)), '99999999999999999999');
  });

  it('fits a quadratic when the independent-variable scale is very small', () => {
    const summary = computeStatSummary('_+CX2', [
      { x: '0', y: '0', freq: '1' },
      { x: '1e-15', y: '1e-30', freq: '1' },
      { x: '2e-15', y: '4e-30', freq: '1' },
    ]);

    closeTo(summary.regA!, '0');
    closeTo(summary.regB!, '0');
    closeTo(summary.regC!, '1');
  });

  it('keeps a valid linear fit when the X scale is very small', () => {
    const summary = computeStatSummary('A+BX', [
      { x: '0', y: '0', freq: '1' },
      { x: '1e-15', y: '1', freq: '1' },
      { x: '2e-15', y: '2', freq: '1' },
    ]);

    expect(summary.regB).toBeDefined();
    expect(summary.regB!.decimal.minus('1e15').abs().lt('1e-15')).toBe(true);
    closeTo(summary.corrR!, '1');
  });

  it('keeps linear regression slope and correlation accurate with large offsets', () => {
    const summary = computeStatSummary('A+BX', [
      { x: '100000000000000000000', y: '200000000000000000000', freq: '1' },
      { x: '100000000000000000001', y: '200000000000000000001', freq: '1' },
    ]);

    closeTo(summary.regB!, '1');
    closeTo(summary.corrR!, '1');
  });

  it('does not silently return zero for large valid Poisson outcomes', () => {
    const k = scalarFromInteger(10000001);
    const probability = poissonPd(k, k).decimal;

    expect(probability.isZero()).toBe(false);
    expect(probability.gt('0.0001')).toBe(true);
    expect(probability.lt('0.001')).toBe(true);
  });
});
