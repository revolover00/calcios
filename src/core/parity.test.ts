import { describe, expect, it } from 'vitest';
import { calculatorReducer, createInitialState, formatActiveComplexDisplay, hydrateState, saveableState } from './calculator';
import { evaluateComplex } from './cmplx';
import { solveEqn } from './eqn';
import { evaluateExpression } from './expression';
import { deserialize, scalarFromInteger, zeroStored, VARIABLES } from './value';

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

  it('prompts non-target solve variables and stores the selected root variable', () => {
    let state = createInitialState();
    state = { ...state, expression: '2A+B=11,A', cursor: 11 };
    state = calculatorReducer(state, { type: 'key', id: 'equals' });
    expect(state.solvePrompt?.stage).toBe('prompt-var');
    state = calculatorReducer(state, { type: 'key', id: '1' });
    state = calculatorReducer(state, { type: 'key', id: 'equals' });
    expect(state.solvePrompt?.stage).toBe('prompt-x');
    state = calculatorReducer(state, { type: 'key', id: 'equals' });
    expect(state.solvePrompt?.stage).toBe('solved');
    expect(deserialize(state.variables.A).decimal.toNumber()).toBeCloseTo(5);
    expect(state.pairResult && state.pairResult.type === 'pair' && state.pairResult.label1).toBe('A');
  });
});
