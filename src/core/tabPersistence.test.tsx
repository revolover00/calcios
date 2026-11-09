import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import {
  calculatorReducer,
  createInitialState,
  formatActiveResult,
  hydrateState,
  saveableState,
  type CalculatorState,
} from './calculator';
import { deserialize } from './value';

function pressSeq(initial: CalculatorState, ...keys: string[]): CalculatorState {
  let s = initial;
  for (const id of keys) {
    s = calculatorReducer(s, { type: 'key', id });
  }
  return s;
}

describe('Background tab lifecycle & live session persistence', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('persists and restores active COMP expression, result, Ans, and replay history across tab discard', () => {
    let s = pressSeq(createInitialState(), '1', 'divide', '3', 'equals');
    s = pressSeq(s, 'add', '5');
    expect(s.phase).toBe('editing');
    expect(s.expression).toBe('Ans+5');

    const restored = hydrateState(JSON.stringify(saveableState(s)));
    expect(restored.mode).toBe('COMP');
    expect(restored.phase).toBe('editing');
    expect(restored.expression).toBe('Ans+5');
    expect(deserialize(restored.ans).decimal.toNumber()).toBeCloseTo(1 / 3, 10);
    expect(restored.history).toHaveLength(1);

    const evaluated = pressSeq(restored, 'equals');
    expect(formatActiveResult(evaluated)).toEqual({
      type: 'fraction',
      sign: '',
      numerator: '16',
      denominator: '3',
    });
  });

  it('persists STAT table rows, MATRIX entries, and EQN solved roots across tab reload', () => {
    // STAT 1-VAR with entered data rows
    const statState = pressSeq(
      createInitialState(),
      'mode', '3', '1',
      '1', '0', 'equals',
      '2', '0', 'equals',
      '3', '0', 'equals',
    );
    const restoredStat = hydrateState(JSON.stringify(saveableState(statState)));
    expect(restoredStat.mode).toBe('STAT');
    expect(restoredStat.stat.rows.map((r) => r.x)).toEqual(['10', '20', '30']);

    // EQN quadratic solved state
    const eqnState = pressSeq(
      createInitialState(),
      'mode', '5', '3',
      '1', 'equals', 'neg', '5', 'equals', '6', 'equals', 'equals',
    );
    expect(eqnState.eqn?.outcome?.status).toBe('solved');
    const restoredEqn = hydrateState(JSON.stringify(saveableState(eqnState)));
    expect(restoredEqn.mode).toBe('EQN');
    expect(restoredEqn.eqn?.outcome?.status).toBe('solved');

    // MATRIX 2x2 defined in MatA
    const matState = pressSeq(
      createInitialState(),
      'mode', '6', '1', '5',
      '7', 'equals', '8', 'equals', '9', 'equals', '4', 'equals',
    );
    const restoredMat = hydrateState(JSON.stringify(saveableState(matState)));
    expect(restoredMat.mode).toBe('MATRIX');
    expect(deserialize(restoredMat.matrix.matrices.MatA!.cells[0][0]).decimal.toNumber()).toBe(7);
    expect(deserialize(restoredMat.matrix.matrices.MatA!.cells[1][1]).decimal.toNumber()).toBe(4);
  });

  it('wakes powered-off screen to normal when reloading a discarded tab so LCD never appears dead', () => {
    const poweredOff = pressSeq(createInitialState(), '4', '2', 'equals', 'shift', 'ac');
    expect(poweredOff.screen).toBe('off');

    const restored = hydrateState(JSON.stringify(saveableState(poweredOff)));
    expect(restored.screen).toBe('normal');
    expect(deserialize(restored.ans).decimal.toNumber()).toBe(42);
  });

  it('survives corrupted session payload while keeping valid settings and variables', () => {
    const base = pressSeq(createInitialState(), 'shift', 'mode', '4', '9', 'equals', 'shift', 'rcl', 'neg');
    const saved = saveableState(base);
    const corruptedRaw = JSON.stringify({
      ...saved,
      session: {
        ...saved.session,
        matrix: {
          ...saved.session!.matrix,
          matrices: { MatA: { rows: 1, cols: 1, cells: [[{ bogus: true }]] }, MatB: null, MatC: null, MatAns: null },
        },
      },
    });
    const hydrated = hydrateState(corruptedRaw);
    expect(hydrated.angle).toBe('RAD');
    expect(deserialize(hydrated.variables.A).decimal.toNumber()).toBe(9);
  });

  it('flushes state on visibilitychange/pagehide and restores full UI after remount', () => {
    const firstMount = render(<App />);
    fireEvent.keyDown(window, { key: '7' });
    fireEvent.keyDown(window, { key: '*' });
    fireEvent.keyDown(window, { key: '8' });
    fireEvent.keyDown(window, { key: 'Enter' });

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pagehide'));
    });

    firstMount.unmount();

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
    });

    const secondMount = render(<App />);
    expect(secondMount.container.textContent).toContain('56');
  });
});
