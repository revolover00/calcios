import { describe, expect, it } from 'vitest';
import { evaluateExpression, evaluateRichExpression } from './expression';
import { createInitialState } from './calculator';
import { formatDecimal, formatResult } from './format';
import { CalculatorError } from './errors';
import { serialize } from './value';

const state = createInitialState();
const ctx = { angle: state.angle, variables: state.variables, ans: state.ans } as const;
const solve = (source: string) => evaluateExpression(source, ctx);

describe('expression engine', () => {
  it.each([
    ['1+2×3', '7'], ['(1+2)×3', '9'], ['-2^2', '-4'], ['(-2)^2', '4'],
    ['2^3^2', '512'], ['10÷4', '2.5'], ['0.1+0.2', '0.3'], ['2(3+4)', '14'],
    ['3!+2', '8'], ['50%', '0.5'], ['10nCr3', '120'], ['5nPr2', '20'],
    ['sqrt(81)', '9'], ['abs(-12)', '12'], ['log(1000)', '3'], ['logb(2,8)', '3'],
    ['root(3,8)', '2'], ['sin(30)', '0.5'], ['cos(60)', '0.5'], ['tan(45)', '1'],
    ['asin(0.5)', '30'], ['sinh(0)', '0'], ['2×10^(3)', '2000'],
  ])('%s = %s', (expression, expected) => {
    expect(formatDecimal(solve(expression))).toBe(expected);
  });

  it('keeps exact rational arithmetic for S⇔D', () => {
    const result = solve('1÷3+1÷6');
    expect(result.exact).toEqual({ n: 1n, d: 2n });
    expect(formatResult(result, 'exact')).toEqual({ type: 'fraction', sign: '', numerator: '1', denominator: '2' });
    expect(formatResult(result, 'decimal')).toEqual({ type: 'text', text: '0.5' });
  });

  it('simplifies quadratic surds and rationalizes surd denominators', () => {
    expect(formatResult(solve('sqrt(12)'), 'exact')).toEqual({
      type: 'symbolic-surd',
      a: '0',
      b: '2',
      rad: '3',
      d: '1',
    });
    expect(formatResult(solve('sqrt(2)+sqrt(8)'), 'exact')).toEqual({
      type: 'symbolic-surd',
      a: '0',
      b: '3',
      rad: '2',
      d: '1',
    });
    expect(formatResult(solve('1÷sqrt(2)'), 'exact')).toEqual({
      type: 'symbolic-surd',
      a: '0',
      b: '1',
      rad: '2',
      d: '2',
    });
    expect(formatResult(solve('1÷(2+sqrt(3))'), 'exact')).toEqual({
      type: 'symbolic-surd',
      a: '2',
      b: '-1',
      rad: '3',
      d: '1',
    });
  });

  it('preserves exact rational π multiples and special-angle trig', () => {
    expect(formatResult(solve('π÷2+π÷3'), 'exact')).toEqual({
      type: 'symbolic-pi',
      sign: '',
      numerator: '5',
      denominator: '6',
    });
    expect(formatResult(solve('sin(60)'), 'exact')).toEqual({
      type: 'symbolic-surd',
      a: '0',
      b: '1',
      rad: '3',
      d: '2',
    });
    expect(formatResult(solve('tan(30)'), 'exact')).toEqual({
      type: 'symbolic-surd',
      a: '0',
      b: '1',
      rad: '3',
      d: '3',
    });
    const radAsin = evaluateExpression('asin(1÷2)', { ...ctx, angle: 'RAD' });
    expect(formatResult(radAsin, 'exact')).toEqual({
      type: 'symbolic-pi',
      sign: '',
      numerator: '1',
      denominator: '6',
    });
  });

  it('supports fraction templates', () => expect(solve('frac(1,2)').exact).toEqual({ n: 1n, d: 2n }));
  it('supports mixed fraction templates', () => {
    expect(solve('mfrac(2,1,4)').exact).toEqual({ n: 9n, d: 4n });
    expect(solve('-mfrac(1,1,2)').exact).toEqual({ n: -3n, d: 2n });
  });
  it('supports DMS sexagesimal input', () => {
    expect(formatDecimal(solve('12°30°'))).toBe('12.5');
    expect(formatDecimal(solve('12°30°45°'))).toBe('12.5125');
    expect(formatDecimal(solve('-1°30°'))).toBe('-1.5');
  });
  it('supports Polar and Rectangular coordinate pairs', () => {
    const pol = evaluateRichExpression('Pol(3,4)', ctx);
    expect(pol.pairKind).toBe('pol');
    expect(formatDecimal(pol.primary)).toBe('5');
    expect(formatDecimal(pol.secondary!)).toBe('53.13010235');

    const rec = evaluateRichExpression('Rec(2,60)', ctx);
    expect(rec.pairKind).toBe('rec');
    expect(formatDecimal(rec.primary)).toBe('1');
    expect(formatDecimal(rec.secondary!)).toBe('1.732050808');
  });
  it('supports RanInt and Rnd', () => {
    const r = evaluateExpression('RanInt(10,20)', { ...ctx, random: 0.5 });
    expect(formatDecimal(r)).toBe('15');
    const rounded = evaluateExpression('Rnd(1.236)', {
      ...ctx,
      numberFormat: { mode: 'Fix', digits: 2 },
    });
    expect(formatDecimal(rounded)).toBe('1.24');
  });
  it('supports DRG angle suffixes', () => {
    expect(formatDecimal(solve('πʳ'))).toBe('180');
    expect(formatDecimal(solve('200ᵍ'))).toBe('180');
    const inRad = evaluateExpression('90ᵈ', { ...ctx, angle: 'RAD' });
    expect(formatDecimal(inRad)).toBe('1.570796327');
  });
  it('supports scientific constants and metric conversions', () => {
    expect(formatDecimal(solve('const28'))).toBe('299792458');
    expect(formatDecimal(solve('const40'))).toBe('101325');
    expect(formatDecimal(solve('10▸conv01'))).toBe('25.4');
    expect(formatDecimal(solve('212▸conv37'))).toBe('100');
    expect(formatDecimal(solve('100▸conv38'))).toBe('212');
  });
  it('evaluates numerical derivative, definite integral, summation, and product', () => {
    expect(formatDecimal(solve('deriv(X^3,2)'))).toBe('12');
    expect(formatDecimal(solve('integ(X^2,0,3)'))).toBe('9');
    expect(formatDecimal(solve('sigma(X^2,1,4)'))).toBe('30');
    expect(formatDecimal(solve('prod(X,1,5)'))).toBe('120');
  });
  it('closes pending parentheses on equals', () => expect(formatDecimal(solve('2(3+4'))).toBe('14'));
  it('supports constants and implicit multiplication', () => expect(formatDecimal(solve('2π'))).toBe('6.283185307'));
  it('uses the chosen angle unit', () => {
    const radians = evaluateExpression('sin(π÷2)', { ...ctx, angle: 'RAD' });
    const gradians = evaluateExpression('cos(100)', { ...ctx, angle: 'GRA' });
    expect(formatDecimal(radians)).toBe('1');
    expect(formatDecimal(gradians)).toMatch(/^(0|[-\d.]+×10\^-\d+)$/);
  });
  it.each(['1÷0', 'sqrt(-1)', 'tan(90)', 'acos(2)', '0^0', '70!', '1e100'])('reports a math error for %s', expression => {
    expect(() => solve(expression)).toThrowError(CalculatorError);
    try { solve(expression); } catch (error) { expect((error as CalculatorError).kind).toBe('Math ERROR'); }
  });
  it.each(['', '1+', 'frac(1,)', '2)', 'alert(1)', '2..3'])('rejects invalid input %s', expression => {
    expect(() => solve(expression)).toThrowError(CalculatorError);
  });
  it('does not use JavaScript evaluation or allow arbitrary property access', () => {
    expect(() => solve('globalThis.alert(1)')).toThrowError(CalculatorError);
  });

  it('supports multi-surd combinations, Galois denominator rationalization, and nested surd denesting', () => {
    const sumSurd = solve('sqrt(2)+sqrt(3)');
    expect(formatResult(sumSurd, 'exact')).toEqual({
      type: 'symbolic-multisurd',
      terms: [{ coef: '1', rad: '3' }, { coef: '1', rad: '2' }],
      d: '1',
    });

    // 1 / (√2 + √3) = √3 - √2
    const inv2 = solve('1÷(sqrt(2)+sqrt(3))');
    expect(formatResult(inv2, 'exact')).toEqual({
      type: 'symbolic-multisurd',
      terms: [{ coef: '1', rad: '3' }, { coef: '-1', rad: '2' }],
      d: '1',
    });

    // 1 / (1 + √2 + √3) = (2 + √2 - √6) / 4
    const inv3 = solve('1÷(1+sqrt(2)+sqrt(3))');
    expect(formatResult(inv3, 'exact')).toEqual({
      type: 'symbolic-multisurd',
      terms: [{ coef: '2', rad: '1' }, { coef: '1', rad: '2' }, { coef: '-1', rad: '6' }],
      d: '4',
    });

    // (√2 + √3)^2 = 5 + 2√6 (collapses back to single quadratic surd)
    const sqSum = solve('(sqrt(2)+sqrt(3))^2');
    expect(formatResult(sqSum, 'exact')).toEqual({
      type: 'symbolic-surd',
      a: '5',
      b: '2',
      rad: '6',
      d: '1',
    });

    // Nested surd denesting: √(3 + 2√2) = 1 + √2
    const denest = solve('sqrt(3+2sqrt(2))');
    expect(formatResult(denest, 'exact')).toEqual({
      type: 'symbolic-surd',
      a: '1',
      b: '1',
      rad: '2',
      d: '1',
    });
  });

  it('supports exact 15° and 75° trig and inverse trig in DEG and RAD', () => {
    // sin(15°) = (√6 - √2) / 4
    expect(formatResult(solve('sin(15)'), 'exact')).toEqual({
      type: 'symbolic-multisurd',
      terms: [{ coef: '1', rad: '6' }, { coef: '-1', rad: '2' }],
      d: '4',
    });
    expect(formatResult(solve('tan(15)'), 'exact')).toEqual({
      type: 'symbolic-surd',
      a: '2',
      b: '-1',
      rad: '3',
      d: '1',
    });
    expect(formatDecimal(solve('asin((sqrt(6)-sqrt(2))÷4)'))).toBe('15');
    const inRad = evaluateExpression('asin((sqrt(6)-sqrt(2))÷4)', { ...ctx, angle: 'RAD' });
    expect(formatResult(inRad, 'exact')).toEqual({
      type: 'symbolic-pi',
      sign: '',
      numerator: '1',
      denominator: '12',
    });
  });

  it('supports GCD, LCM, Int, Intg, and exact recurring decimal literals', () => {
    expect(formatDecimal(solve('GCD(48,180)'))).toBe('12');
    expect(formatDecimal(solve('LCM(12,18)'))).toBe('36');
    expect(formatDecimal(solve('Int(-3.7)'))).toBe('-3');
    expect(formatDecimal(solve('Intg(-3.7)'))).toBe('-4');

    expect(formatResult(solve('0.r(3)'), 'exact')).toEqual({
      type: 'fraction',
      sign: '',
      numerator: '1',
      denominator: '3',
    });
    expect(formatResult(solve('0.58r(3)'), 'exact')).toEqual({
      type: 'fraction',
      sign: '',
      numerator: '7',
      denominator: '12',
    });
    expect(formatResult(solve('0.r(142857)'), 'exact')).toEqual({
      type: 'fraction',
      sign: '',
      numerator: '1',
      denominator: '7',
    });
  });

  it('supports manual step-by-step fraction simplification (▸Simp) and exact syntax error offsets', () => {
    // 12 ÷ 18 ▸Simp -> 6/9 (÷2)
    const step1 = solve('12÷18▸Simp');
    expect(formatResult(step1, 'exact')).toEqual({
      type: 'fraction',
      sign: '',
      numerator: '6',
      denominator: '9',
      simpFactor: '2',
    });

    // Chaining Ans▸Simp -> 2/3 (÷3)
    const step2 = evaluateExpression('Ans▸Simp', { ...ctx, ans: serialize(step1) });
    expect(formatResult(step2, 'exact')).toEqual({
      type: 'fraction',
      sign: '',
      numerator: '2',
      denominator: '3',
      simpFactor: '3',
    });

    // Explicit factor: 12 ÷ 18 ▸Simp 3 -> 4/6 (÷3)
    const explicitStep = solve('12÷18▸Simp3');
    expect(formatResult(explicitStep, 'exact')).toEqual({
      type: 'fraction',
      sign: '',
      numerator: '4',
      denominator: '6',
      simpFactor: '3',
    });

    // Non-divisor factor throws Math ERROR
    expect(() => solve('12÷18▸Simp5')).toThrowError(/Math ERROR|does not divide/i);

    // Syntax error carries exact character offset for [◀][▶]:Goto
    let caughtOffset: number | undefined;
    try {
      solve('12+×5');
    } catch (err) {
      if (err instanceof CalculatorError) caughtOffset = err.offset;
    }
    expect(caughtOffset).toBe(3);
  });
});
