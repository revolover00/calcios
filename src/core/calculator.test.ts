import { describe, expect, it } from 'vitest';
import {
  calculatorReducer, createInitialState, formatActiveResult, hydrateState, saveableState,
  type CalculatorState,
} from './calculator';
import { deserialize } from './value';
import { formatDecimal, formatResult } from './format';

function press(...ids: string[]): CalculatorState {
  return ids.reduce((state, id) => calculatorReducer(state, { type: 'key', id, random: 0.1237 }), createInitialState());
}
const shown = (s: CalculatorState) => s.result && formatDecimal(deserialize(s.result));

describe('calculator state machine', () => {
  it('evaluates a key sequence', () => expect(shown(press('1', 'add', '2', 'equals'))).toBe('3'));
  it('starts a new calculation on digit, or continues with Ans on operator', () => {
    expect(shown(press('1', 'add', '2', 'equals', '4', 'equals'))).toBe('4');
    expect(shown(press('1', 'add', '2', 'equals', 'multiply', '4', 'equals'))).toBe('12');
  });
  it('enters a fraction template and toggles exact/decimal', () => {
    let s = press('frac', '1', 'right', '2', 'equals');
    expect(s.result && formatResult(deserialize(s.result), s.resultFormat)).toEqual({ type: 'fraction', sign: '', numerator: '1', denominator: '2' });
    s = calculatorReducer(s, { type: 'key', id: 'sd' });
    expect(s.result && formatResult(deserialize(s.result), s.resultFormat)).toEqual({ type: 'text', text: '0.5' });
  });
  it('toggles improper and mixed fractions with SHIFT + S⇔D', () => {
    const s = press('7', 'divide', '2', 'equals', 'shift', 'sd');
    expect(formatActiveResult(s)).toEqual({
      type: 'mixed-fraction',
      sign: '',
      whole: '3',
      numerator: '1',
      denominator: '2',
    });
  });
  it('supports prime factorization FACT on positive integers', () => {
    const s = press('3', '6', '0', 'equals', 'shift', 'dms');
    expect(formatActiveResult(s)).toEqual({ type: 'text', text: '2³×3²×5' });
  });
  it('supports engineering notation ENG and ←ENG shifts', () => {
    const s1 = press('1', '2', '3', '4', 'equals', 'eng');
    expect(formatActiveResult(s1)).toEqual({ type: 'text', text: '1.234×10^3' });
    const s2 = calculatorReducer(s1, { type: 'key', id: 'eng' });
    expect(formatActiveResult(s2)).toEqual({ type: 'text', text: '1234×10^0' });
    const s3 = press('5', '6', 'equals', 'shift', 'eng');
    expect(formatActiveResult(s3)).toEqual({ type: 'text', text: '0.056×10^3' });
  });
  it('toggles DMS display on results', () => {
    const s = press('1', '2', 'dot', '5', 'equals', 'dms');
    expect(formatActiveResult(s)).toEqual({ type: 'text', text: '12°30’0”' });
  });
  it('supports SETUP Fix, Sci, and LineIO', () => {
    const sFix = press('shift', 'mode', '6', '3', '1', 'divide', '8', 'equals');
    expect(formatActiveResult(sFix)).toEqual({ type: 'text', text: '0.125' });
    const sLine = press('shift', 'mode', '2');
    expect(sLine.ioMode).toBe('Line');
  });
  it('steps through multi-statement expressions separated by :', () => {
    const s1 = press('2', 'add', '3', 'alpha', 'cube', 'ans', 'multiply', '4', 'equals');
    expect(shown(s1)).toBe('5');
    expect(s1.statementRun).not.toBeNull();
    const s2 = calculatorReducer(s1, { type: 'key', id: 'equals' });
    expect(shown(s2)).toBe('20');
    expect(s2.statementRun).toBeNull();
  });
  it('supports INS overwrite cursor mode', () => {
    const s = press('1', '2', '3', 'left', 'shift', 'del', '9', 'equals');
    expect(shown(s)).toBe('129');
  });
  it('supports CALC variable prompting workflow', () => {
    const s = press('2', 'alpha', 'close', 'add', 'alpha', 'neg', 'calc', '3', 'equals', '4', 'equals');
    expect(shown(s)).toBe('10');
  });
  it('supports SOLVE numerical equation workflow', () => {
    const s = press('alpha', 'close', 'square', 'subtract', '9', 'eq-sign', '0', 'solve', '2', 'equals');
    expect(shown(s)).toBe('3');
    expect(deserialize(s.variables.X).decimal.toNumber()).toBeCloseTo(3, 8);
  });
  it('supports EQN mode (2x2 linear and quadratic with complex roots)', () => {
    // 2X + 1Y = 5, 1X - 1Y = 1 -> X = 2, Y = 1
    const sLin = press('mode', '5', '1', '2', 'equals', '1', 'equals', '5', 'equals', '1', 'equals', 'neg', '1', 'equals', '1', 'equals');
    expect(shown(sLin)).toBe('2');
    const sLinY = calculatorReducer(sLin, { type: 'key', id: 'down' });
    expect(shown(sLinY)).toBe('1');

    // X^2 + 0X + 4 = 0 -> 2i, -2i
    const sQuad = press('mode', '5', '3', '1', 'equals', '0', 'equals', '4', 'equals');
    expect(sQuad.eqn?.outcome?.status).toBe('solved');
    if (sQuad.eqn?.outcome?.status === 'solved') {
      expect(sQuad.eqn.outcome.items[0].complexText).toBe('2i');
      expect(sQuad.eqn.outcome.items[1].complexText).toBe('−2i');
    }
  });
  it('supports TABLE mode generation for f(X) and g(X)', () => {
    const s = press('mode', '7', 'alpha', 'close', 'square', 'equals', '2', 'alpha', 'close', 'equals', 'equals', 'equals', 'equals');
    expect(s.table?.stage).toBe('view');
    expect(s.table?.rows.length).toBe(5);
    expect(s.table?.rows[2]).toEqual({ index: 3, x: '3', fx: '9', gx: '6' });
  });
  it('supports BASE-N mode conversions and bitwise operations', () => {
    const sHex = press('mode', '4', 'power', 'neg', 'tan', 'basen-and', '0', 'tan', 'equals');
    // 0xAF and 0x0F = 0x0000000F
    expect(formatActiveResult(sHex)).toEqual({ type: 'text', text: '0000000F' });
    const sDec = calculatorReducer(sHex, { type: 'key', id: 'square' });
    expect(formatActiveResult(sDec)).toEqual({ type: 'text', text: '15' });
  });
  it('supports natural key flow for trig and angle setup', () => {
    expect(shown(press('sin', '3', '0', 'equals'))).toBe('0.5');
    const s = press('shift', 'mode', '4');
    expect(s.angle).toBe('RAD');
    expect(s.screen).toBe('normal');
  });
  it('supports SHIFT functions and consumes the shift latch', () => {
    const s = press('5', 'shift', 'inverse', 'equals');
    expect(shown(s)).toBe('120'); expect(s.shift).toBe(false);
  });
  it('stores and recalls named variables', () => {
    const s = press('8', 'equals', 'shift', 'rcl', 'neg', 'ac', 'rcl', 'neg', 'add', '2', 'equals');
    expect(shown(s)).toBe('10');
    expect(deserialize(s.variables.A).decimal.toString()).toBe('8');
  });
  it('adds and subtracts memory independently', () => {
    const s = press('7', 'equals', 'mplus', 'ac', '2', 'equals', 'shift', 'mplus');
    expect(deserialize(s.variables.M).decimal.toString()).toBe('5');
  });
  it('replays history', () => expect(press('1', 'add', '2', 'equals', 'ac', 'up').expression).toBe('1+2'));
  it('reports errors without corrupting the previous answer', () => {
    const s = press('8', 'equals', 'ac', '1', 'divide', '0', 'equals');
    expect(s.error).toBe('Math ERROR'); expect(deserialize(s.ans).decimal.toString()).toBe('8');
  });
  it('clearly reports unfinished modes rather than faking them', () => {
    const s = press('mode', '6');
    expect(s.screen).toBe('normal'); expect(s.notice).toContain('MATRIX'); expect(s.notice).toContain('قيد التطوير');
  });
  it('supports power off and on', () => expect(press('shift', 'ac', 'on').screen).toBe('normal'));
  it('persists angle and variables with invalid-storage fallback', () => {
    const s = press('shift', 'mode', '4', '8', 'equals', 'shift', 'rcl', 'neg');
    const restored = hydrateState(JSON.stringify(saveableState(s)));
    expect(restored.angle).toBe('RAD'); expect(deserialize(restored.variables.A).decimal.toString()).toBe('8');
    expect(hydrateState('{oops').angle).toBe('DEG');
  });
});
