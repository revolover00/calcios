import { describe, expect, it } from 'vitest';
import { calculatorReducer, createInitialState, formatActiveComplexDisplay, hydrateState, saveableState } from './calculator';
import { evaluateComplex, formatComplexDisplay, mulComplex, powComplex } from './cmplx';
import { solveEqn } from './eqn';
import { evaluateExpression } from './expression';
import { D, deserialize, makeScalar, scalarFromInteger, scalarFromLiteral, serialize, zeroStored, VARIABLES } from './value';

const vars = Object.fromEntries(VARIABLES.map((name) => [name, zeroStored()])) as Record<(typeof VARIABLES)[number], ReturnType<typeof zeroStored>>;
const ctx = { angle: 'RAD' as const, variables: vars, ans: zeroStored() };

describe('real-Casio parity extensions', () => {
  it('accepts optional Casio tolerance arguments for derivatives and integrals', () => {
    const deriv = evaluateExpression('deriv(X^2,3,8)', ctx);
    expect(deriv.decimal.toNumber()).toBeCloseTo(6, 5);
    const integ = evaluateExpression('integ(X,0,1,8)', ctx);
    expect(integ.decimal.toNumber()).toBeCloseTo(0.5, 10);
    expect(() => evaluateExpression('deriv(X,1,15)', ctx)).toThrow();
    expect(() => evaluateExpression('integ(X,0,1,0)', ctx)).toThrow();
  });

  it('adds cubic local max/min values only to EQN cubic solutions', () => {
    const out = solveEqn('cubic', [scalarFromInteger(1), scalarFromInteger(0), scalarFromInteger(-3), scalarFromInteger(0)]);
    expect(out.status).toBe('solved');
    if (out.status === 'solved') {
      expect(out.items.map((item) => item.label)).toEqual(expect.arrayContaining([
        'X-Value Local Max', 'Y-Value Local Max', 'X-Value Local Min', 'Y-Value Local Min',
      ]));
      expect(out.items.find((item) => item.label === 'X-Value Local Max')?.scalar?.decimal.toNumber()).toBeCloseTo(-1);
      expect(out.items.find((item) => item.label === 'Y-Value Local Max')?.scalar?.decimal.toNumber()).toBeCloseTo(2);
    }
  });

  it('applies Casio relative-percent semantics to scalar calculations in CMPLX mode', () => {
    const cmplxAns = { re: zeroStored(), im: zeroStored() };
    for (const [expression, expected] of [
      ['200+10%', 220],
      ['200-10%', 180],
      ['200+10%+10%', 242],
      ['200×10%', 20],
      ['200÷10%', 2000],
      ['200+(10%)', 200.1],
      ['200+10%×2', 200.2],
    ] as const) {
      const result = evaluateComplex(expression, { angle: 'RAD', variables: vars, cmplxAns }).value;
      expect(result.re.decimal.toNumber()).toBe(expected);
      expect(result.im.decimal.isZero()).toBe(true);
    }
  });

  it('returns complex values for real inverse-trig inputs outside the real domain in CMPLX mode', () => {
    const complexZero = { re: zeroStored(), im: zeroStored() };
    const asin = evaluateComplex('asin(2)', {
      angle: 'RAD', variables: vars, cmplxAns: complexZero,
    }).value;
    expect(asin.re.decimal.minus(D.acos(-1).div(2)).abs().lt('1e-28')).toBe(true);
    expect(asin.im.decimal.lt(0)).toBe(true);
    expect(asin.im.decimal.abs().toNumber()).toBeCloseTo(Math.log(2 + Math.sqrt(3)), 12);

    const asinNegative = evaluateComplex('asin(-2)', {
      angle: 'RAD', variables: vars, cmplxAns: complexZero,
    }).value;
    expect(asinNegative.re.decimal.toNumber()).toBeCloseTo(-Math.PI / 2, 12);
    expect(asinNegative.im.decimal.toNumber()).toBeCloseTo(Math.log(2 + Math.sqrt(3)), 12);

    const acosh = evaluateComplex('acosh(0.5)', {
      angle: 'RAD', variables: vars, cmplxAns: complexZero,
    }).value;
    expect(acosh.re.decimal.isZero()).toBe(true);
    expect(acosh.im.decimal.abs().toNumber()).toBeCloseTo(Math.PI / 3, 12);

    const acoshNegative = evaluateComplex('acosh(-2)', {
      angle: 'RAD', variables: vars, cmplxAns: complexZero,
    }).value;
    expect(acoshNegative.re.decimal.toNumber()).toBeCloseTo(Math.log(2 + Math.sqrt(3)), 12);
    expect(acoshNegative.im.decimal.toNumber()).toBeCloseTo(Math.PI, 12);

    const acos = evaluateComplex('acos(2)', {
      angle: 'RAD', variables: vars, cmplxAns: complexZero,
    }).value;
    expect(acos.re.decimal.isZero()).toBe(true);
    expect(acos.im.decimal.toNumber()).toBeCloseTo(Math.log(2 + Math.sqrt(3)), 12);
    const acosNegative = evaluateComplex('acos(-2)', {
      angle: 'RAD', variables: vars, cmplxAns: complexZero,
    }).value;
    expect(acosNegative.re.decimal.toNumber()).toBeCloseTo(Math.PI, 12);
    expect(acosNegative.im.decimal.toNumber()).toBeCloseTo(-Math.log(2 + Math.sqrt(3)), 12);

    const atanh = evaluateComplex('atanh(2)', {
      angle: 'RAD', variables: vars, cmplxAns: complexZero,
    }).value;
    expect(atanh.re.decimal.toNumber()).toBeCloseTo(Math.log(3) / 2, 12);
    expect(atanh.im.decimal.toNumber()).toBeCloseTo(Math.PI / 2, 12);
  });

  it('preserves a tiny real component when taking the square root near the negative real axis', () => {
    const result = evaluateComplex('sqrt(-1+1e-100i)', {
      angle: 'RAD', variables: vars, cmplxAns: { re: zeroStored(), im: zeroStored() },
    }).value;
    expect(result.re.decimal.minus('5e-101').abs().lt('1e-130')).toBe(true);
    expect(result.im.decimal.minus(1).abs().lt('1e-30')).toBe(true);
    const viaPower = evaluateComplex('(-1+1e-100i)^(1/2)', {
      angle: 'RAD', variables: vars, cmplxAns: { re: zeroStored(), im: zeroStored() },
    }).value;
    expect(viaPower.re.decimal.minus('5e-101').abs().lt('1e-130')).toBe(true);

    const lowerHalfPlane = evaluateComplex('sqrt(-1-1e-100i)', {
      angle: 'RAD', variables: vars, cmplxAns: { re: zeroStored(), im: zeroStored() },
    }).value;
    expect(lowerHalfPlane.re.decimal.minus('5e-101').abs().lt('1e-130')).toBe(true);
    expect(lowerHalfPlane.im.decimal.plus(1).abs().lt('1e-30')).toBe(true);

    const positiveAxis = evaluateComplex('sqrt(1+1e-100i)', {
      angle: 'RAD', variables: vars, cmplxAns: { re: zeroStored(), im: zeroStored() },
    }).value;
    expect(positiveAxis.re.decimal.minus(1).abs().lt('1e-30')).toBe(true);
    expect(positiveAxis.im.decimal.minus('5e-101').abs().lt('1e-130')).toBe(true);

    for (const [reText, imText] of [
      ['-1', '1e-100'], ['-1', '-1e-100'], ['1', '1e-100'],
      ['1', '-1e-100'], ['-1e90', '1e50'], ['1e90', '-1e50'],
    ]) {
      const z = {
        re: scalarFromLiteral(reText),
        im: scalarFromLiteral(imText),
      };
      const squareRoot = evaluateComplex(`sqrt(${reText}${imText.startsWith('-') ? '' : '+'}${imText}i)`, {
        angle: 'RAD', variables: vars, cmplxAns: { re: zeroStored(), im: zeroStored() },
      }).value;
      const roundTrip = mulComplex(squareRoot, squareRoot);
      const scale = z.re.decimal.abs().plus(z.im.decimal.abs());
      expect(roundTrip.re.decimal.minus(z.re.decimal).abs().lte(scale.times('1e-30'))).toBe(true);
      expect(roundTrip.im.decimal.minus(z.im.decimal).abs().lte(scale.times('1e-30'))).toBe(true);
    }
  });

  it('keeps complex division and magnitude stable at very large and very small scales', () => {
    const ctx = { angle: 'RAD' as const, variables: vars, cmplxAns: { re: zeroStored(), im: zeroStored() } };
    for (const scale of ['1e-90', '1e90']) {
      const same = evaluateComplex(`((${scale}+${scale}i)/(${scale}+${scale}i))`, ctx).value;
      expect(same.re.decimal.minus(1).abs().lt('1e-28')).toBe(true);
      expect(same.im.decimal.isZero()).toBe(true);
      const opposite = evaluateComplex(`((${scale}+${scale}i)/(${scale}-${scale}i))`, ctx).value;
      expect(opposite.re.decimal.isZero()).toBe(true);
      expect(opposite.im.decimal.minus(1).abs().lt('1e-28')).toBe(true);
    }
    const magnitude = evaluateComplex('abs(1e90+1e90i)', ctx).value;
    expect(magnitude.re.decimal.minus(new D(2).sqrt().times('1e90')).abs().div('1e90').lt('1e-28')).toBe(true);
  });

  it('preserves reciprocal identities for integer complex powers over scale extremes', () => {
    const ctx = { angle: 'RAD' as const, variables: vars, cmplxAns: { re: zeroStored(), im: zeroStored() } };
    const values = ['1+i', '-2+3i', '1e20+1e-20i', '-1e-20+2e20i'];
    for (const value of values) {
      for (const exponent of [1, 2, 3]) {
        const result = evaluateComplex(`(${value})^${exponent}×(${value})^-${exponent}`, ctx).value;
        expect(result.re.decimal.minus(1).abs().lt('1e-25')).toBe(true);
        expect(result.im.decimal.abs().lt('1e-25')).toBe(true);
      }
    }
  });

  it('round-trips circular and hyperbolic complex inverse functions across representative quadrants', () => {
    const radCtx = { angle: 'RAD' as const, variables: vars, cmplxAns: { re: zeroStored(), im: zeroStored() } };
    const closeComplex = (actual: ReturnType<typeof evaluateComplex>['value'], re: number, im: number) => {
      expect(actual.re.decimal.minus(re).abs().lt('1e-18')).toBe(true);
      expect(actual.im.decimal.minus(im).abs().lt('1e-18')).toBe(true);
    };
    for (const [re, im] of [[-2, -1.5], [-0.5, 1.25], [0.25, -2], [1.5, 0.75], [3, -0.2]]) {
      const source = `${re < 0 ? `(${re})` : re}${im < 0 ? '' : '+'}${im}i`;
      closeComplex(evaluateComplex(`sin(asin(${source}))`, radCtx).value, re, im);
      closeComplex(evaluateComplex(`cos(acos(${source}))`, radCtx).value, re, im);
      closeComplex(evaluateComplex(`tan(atan(${source}))`, radCtx).value, re, im);
      closeComplex(evaluateComplex(`sinh(asinh(${source}))`, radCtx).value, re, im);
      closeComplex(evaluateComplex(`cosh(acosh(${source}))`, radCtx).value, re, im);
      closeComplex(evaluateComplex(`tanh(atanh(${source}))`, radCtx).value, re, im);
    }
  });

  it('preserves tiny nonzero components when calculating a complex argument', () => {
    const result = evaluateComplex('arg(e^(-64)+i)', {
      angle: 'RAD', variables: vars, cmplxAns: { re: zeroStored(), im: zeroStored() },
    }).value.re.decimal;
    const expectedOffset = D.exp(-64);
    const actualOffset = D.acos(-1).div(2).minus(result);
    expect(actualOffset.gt(expectedOffset.div(2))).toBe(true);
    expect(actualOffset.minus(expectedOffset).abs().div(expectedOffset).lt('1e-5')).toBe(true);
  });

  it('does not treat a nearby finite decimal as the exact complex constant e', () => {
    const nearbyE = makeScalar(D.exp(1).plus('1e-31'), undefined, true);
    const result = powComplex(
      { re: nearbyE, im: scalarFromInteger(0) },
      { re: scalarFromInteger(0), im: scalarFromInteger(1) },
      'RAD',
    );
    const exactEToI = { re: D.cos(1), im: D.sin(1) };
    expect(result.im.decimal.minus(exactEToI.im).abs().gt('1e-33')).toBe(true);
  });

  it('uses the selected angle unit for complex circular trigonometry', () => {
    const out = evaluateComplex('sin(30+i)', {
      angle: 'DEG', variables: vars, cmplxAns: { re: zeroStored(), im: zeroStored() },
    }).value;
    expect(out.re.decimal.toNumber()).toBeCloseTo(0.5 * Math.cosh(1), 12);
    expect(out.im.decimal.toNumber()).toBeCloseTo(Math.sqrt(3) / 2 * Math.sinh(1), 12);
  });

  it('evaluates inverse trigonometric functions for complex arguments', () => {
    const radCtx = { angle: 'RAD' as const, variables: vars, cmplxAns: { re: zeroStored(), im: zeroStored() } };
    const tinyComponentArg = evaluateComplex('arg(1e-30+i)', radCtx).value.re.decimal;
    expect(tinyComponentArg.minus(D.acos(-1).div(2)).abs().gt('5e-31')).toBe(true);
    const tinyRealDisplay = formatComplexDisplay({
      re: scalarFromLiteral('1e-30'),
      im: scalarFromInteger(1),
    }, 'rect', 'RAD', false);
    expect(tinyRealDisplay).not.toBe('i');

    const tanInverseNotation = evaluateComplex('tan⁻¹(1)', radCtx).value;
    expect(tanInverseNotation.re.decimal.toNumber()).toBeCloseTo(Math.PI / 4, 12);
    expect(tanInverseNotation.im.decimal.toNumber()).toBeCloseTo(0, 12);

    const asinI = evaluateComplex('asin(i)', radCtx).value;
    expect(asinI.re.decimal.toNumber()).toBeCloseTo(0, 12);
    expect(asinI.im.decimal.toNumber()).toBeCloseTo(Math.asinh(1), 12);
    const atanHalfI = evaluateComplex('atan(0.5i)', radCtx).value;
    expect(atanHalfI.re.decimal.toNumber()).toBeCloseTo(0, 12);
    expect(atanHalfI.im.decimal.toNumber()).toBeCloseTo(Math.atanh(0.5), 12);
    const asinIDeg = evaluateComplex('asin(i)', { ...radCtx, angle: 'DEG' }).value;
    expect(asinIDeg.im.decimal.toNumber()).toBeCloseTo(Math.asinh(1) * 180 / Math.PI, 10);

    const roundTrip = (inverse: string, forward: string) => {
      const z = evaluateComplex(inverse, radCtx).value;
      return evaluateComplex(`${forward}(${z.re.decimal.toString()}+${z.im.decimal.toString()}i)`, radCtx).value;
    };
    const asinhRoundTrip = roundTrip('asinh(1+i)', 'sinh');
    expect(asinhRoundTrip.re.decimal.toNumber()).toBeCloseTo(1, 10);
    expect(asinhRoundTrip.im.decimal.toNumber()).toBeCloseTo(1, 10);
    const acoshRoundTrip = roundTrip('acosh(1+i)', 'cosh');
    expect(acoshRoundTrip.re.decimal.toNumber()).toBeCloseTo(1, 10);
    expect(acoshRoundTrip.im.decimal.toNumber()).toBeCloseTo(1, 10);
    const atanhRoundTrip = roundTrip('atanh(0.5i)', 'tanh');
    expect(atanhRoundTrip.re.decimal.toNumber()).toBeCloseTo(0, 10);
    expect(atanhRoundTrip.im.decimal.toNumber()).toBeCloseTo(0.5, 10);
  });

  it('stores and recalls full complex variables including imaginary values', () => {
    let state = createInitialState();
    state = calculatorReducer(state, { type: 'select-mode', mode: 'CMPLX' });
    for (const id of ['2', 'add', '3', 'eng', 'equals', 'shift', 'rcl', 'neg']) {
      state = calculatorReducer(state, { type: 'key', id });
    }
    expect(deserialize(state.variables.A).decimal.toNumber()).toBe(2);
    expect(deserialize(state.cmplx.varsIm.A).decimal.toNumber()).toBe(3);
    state = calculatorReducer(state, { type: 'key', id: 'ac' });
    for (const id of ['rcl', 'neg']) state = calculatorReducer(state, { type: 'key', id });
    const shown = formatActiveComplexDisplay(state);
    expect(shown?.value.type).toBe('complex-2d');
    if (shown?.value.type === 'complex-2d') {
      expect(shown.value.re).toEqual({ type: 'text', text: '2' });
      expect(shown.value.im).toEqual({ type: 'text', text: '3' });
    }
    const evalStored = evaluateComplex('A+A', {
      angle: 'RAD', variables: state.variables, varsIm: state.cmplx.varsIm,
      cmplxAns: state.cmplx.ans,
    });
    expect(evalStored.value.re.decimal.toNumber()).toBe(4);
    expect(evalStored.value.im.decimal.toNumber()).toBe(6);
    const persisted = hydrateState(JSON.stringify(saveableState(state)));
    expect(deserialize(persisted.cmplx.varsIm.A).decimal.toNumber()).toBe(3);
  });



  it('accumulates full complex M+ and M− values, then clears imaginary memory on a real overwrite', () => {
    let state = calculatorReducer(createInitialState(), { type: 'select-mode', mode: 'CMPLX' });
    for (const id of ['2', 'add', '3', 'eng', 'mplus']) state = calculatorReducer(state, { type: 'key', id });
    expect(deserialize(state.variables.M).decimal.toNumber()).toBe(2);
    expect(deserialize(state.cmplx.varsIm.M).decimal.toNumber()).toBe(3);
    state = calculatorReducer(state, { type: 'key', id: 'ac' });
    for (const id of ['1', 'add', '1', 'eng', 'shift', 'mplus']) state = calculatorReducer(state, { type: 'key', id });
    expect(deserialize(state.variables.M).decimal.toNumber()).toBe(1);
    expect(deserialize(state.cmplx.varsIm.M).decimal.toNumber()).toBe(2);
    state = calculatorReducer(state, { type: 'select-mode', mode: 'COMP' });
    for (const id of ['7', 'shift', 'rcl', 'neg']) state = calculatorReducer(state, { type: 'key', id });
    expect(deserialize(state.cmplx.varsIm.A).decimal.toNumber()).toBe(0);
  });

  it('infers Y as the SOLVE target when a single-variable equation contains no X', () => {
    let state = createInitialState();
    state = { ...state, expression: '2Y+3=11', cursor: 7 };
    state = calculatorReducer(state, { type: 'key', id: 'equals' });
    expect(state.solvePrompt?.targetVar).toBe('Y');
    state = calculatorReducer(state, { type: 'key', id: 'equals' });
    expect(deserialize(state.variables.Y).decimal.toNumber()).toBeCloseTo(4);
  });

  it('solves both RATIO forms through the existing LCD editor and preserves the mode state', () => {
    let state = calculatorReducer(createInitialState(), { type: 'select-mode', mode: 'RATIO' });
    state = calculatorReducer(state, { type: 'key', id: '1' });
    for (const id of ['2', 'equals', '3', 'equals', '8', 'equals']) {
      state = calculatorReducer(state, { type: 'key', id });
    }
    expect(state.mode).toBe('RATIO');
    expect(state.ratio.solved).toBe(true);
    expect(deserialize(state.result!).decimal.toNumber()).toBeCloseTo(16 / 3);
    const restored = hydrateState(JSON.stringify(saveableState(state)));
    expect(restored.mode).toBe('RATIO');
    expect(restored.ratio.solved).toBe(true);
    expect(deserialize(restored.result!).decimal.toNumber()).toBeCloseTo(16 / 3);
    let second = calculatorReducer(createInitialState(), { type: 'select-mode', mode: 'RATIO' });
    second = calculatorReducer(second, { type: 'key', id: '2' });
    for (const id of ['2', 'equals', '3', 'equals', '8', 'equals']) second = calculatorReducer(second, { type: 'key', id });
    expect(deserialize(second.result!).decimal.toNumber()).toBeCloseTo(12);
  });

  it('clears stale imaginary memory whenever real-mode workflows write variables', () => {
    const seedImag = (state: ReturnType<typeof createInitialState>, ...names: (typeof VARIABLES)[number][]) => ({
      ...state,
      cmplx: { ...state.cmplx, varsIm: { ...state.cmplx.varsIm, ...Object.fromEntries(names.map((n) => [n, serialize(scalarFromInteger(4))])) } },
    });
    let baseN = seedImag(createInitialState(), 'A');
    baseN = { ...baseN, mode: 'BASE-N', expression: '7→A', cursor: 4 };
    baseN = calculatorReducer(baseN, { type: 'key', id: 'equals' });
    expect(deserialize(baseN.cmplx.varsIm.A).decimal.toNumber()).toBe(0);

    let pol = seedImag(createInitialState(), 'X', 'Y');
    pol = { ...pol, expression: 'Pol(3,4)', cursor: 'Pol(3,4)'.length };
    pol = calculatorReducer(pol, { type: 'key', id: 'equals' });
    expect(deserialize(pol.cmplx.varsIm.X).decimal.toNumber()).toBe(0);
    expect(deserialize(pol.cmplx.varsIm.Y).decimal.toNumber()).toBe(0);

    let calc = seedImag(createInitialState(), 'X');
    calc = { ...calc, expression: 'X+1', cursor: 3 };
    calc = calculatorReducer(calc, { type: 'key', id: 'calc' });
    calc = calculatorReducer(calc, { type: 'key', id: '2' });
    calc = calculatorReducer(calc, { type: 'key', id: 'equals' });
    expect(deserialize(calc.cmplx.varsIm.X).decimal.toNumber()).toBe(0);
  });

  it('prompts non-target solve variables and stores the selected root variable', () => {
    let state = createInitialState();
    state = {
      ...state,
      expression: '2A+B=11,A',
      cursor: 11,
      cmplx: { ...state.cmplx, varsIm: { ...state.cmplx.varsIm, A: serialize(scalarFromInteger(9)) } },
    };
    state = calculatorReducer(state, { type: 'key', id: 'equals' });
    expect(state.solvePrompt?.stage).toBe('prompt-var');
    state = calculatorReducer(state, { type: 'key', id: '1' });
    state = calculatorReducer(state, { type: 'key', id: 'equals' });
    expect(state.solvePrompt?.stage).toBe('prompt-x');
    state = calculatorReducer(state, { type: 'key', id: 'equals' });
    expect(state.solvePrompt?.stage).toBe('solved');
    expect(deserialize(state.variables.A).decimal.toNumber()).toBeCloseTo(5);
    expect(deserialize(state.cmplx.varsIm.A).decimal.toNumber()).toBe(0);
    expect(state.pairResult && state.pairResult.type === 'pair' && state.pairResult.label1).toBe('A');
  });
});
