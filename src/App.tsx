import React, { useEffect, useReducer } from 'react';
import { CalculatorHardware } from './components/CalculatorHardware';
import { calculatorReducer, hydrateState, saveableState } from './core/calculator';

const STORAGE_KEY = 'scientific-calc-fx991es-state-v1';

function mapKeyboardEvent(e: KeyboardEvent, isHexBaseN: boolean, isCmplx: boolean): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const k = e.key;
  if (/^[0-9]$/.test(k)) return k;
  if (isHexBaseN && /^[a-fA-F]$/.test(k)) {
    const map: Record<string, string> = { A: 'neg', B: 'dms', C: 'hyp', D: 'sin', E: 'cos', F: 'tan' };
    return map[k.toUpperCase()] ?? null;
  }
  switch (k) {
    case '.': return 'dot';
    case '+': return 'add';
    case '-': return 'subtract';
    case '*': return 'multiply';
    case '/': return 'divide';
    case '(': return 'open';
    case ')': return 'close';
    case ',': return 'comma';
    case ':': return 'colon';
    case '^': return 'power';
    case '!': return 'factorial';
    case 'Enter':
    case '=': return 'equals';
    case 'Backspace': return 'del';
    case 'Delete':
    case 'Escape': return 'ac';
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case 's': return 'sin';
    case 'c': return 'cos';
    case 't': return 'tan';
    case 'l': return 'log';
    case 'n': return 'ln';
    case 'r': return 'sqrt';
    case 'p': return 'pi';
    case 'd': return 'sd';
    case 'i': return isCmplx ? 'imag-i' : null;
    default: return null;
  }
}

export function App(): React.ReactElement {
  const [state, dispatch] = useReducer(calculatorReducer, null, () => {
    try {
      return hydrateState(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      return hydrateState(null);
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saveableState(state)));
    } catch {
      // Ignore storage quota or privacy-mode restrictions
    }
  }, [state.angle, state.ioMode, state.numberFormat, state.defaultFractionStyle, state.variables]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const isHex = state.mode === 'BASE-N' && state.baseN.base === 'HEX';
      const isCmplx = state.mode === 'CMPLX';
      const mapped = mapKeyboardEvent(e, isHex, isCmplx);
      if (mapped) {
        e.preventDefault();
        dispatch({ type: 'key', id: mapped });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.mode, state.baseN.base]);

  return (
    <main className="calc-viewport" data-testid="calc-viewport">
      <CalculatorHardware state={state} dispatch={dispatch} />
    </main>
  );
}

export default App;
