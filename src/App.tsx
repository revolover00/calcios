import React, { useEffect, useReducer, useRef, useState } from 'react';
import { CalculatorHardware } from './components/CalculatorHardware';
import { calculatorReducer, hydrateState, saveableState } from './core/calculator';

const STORAGE_KEY = 'calcios-state-v1';
const PHYSICAL_WIDTH = 356;
const PHYSICAL_HEIGHT = 708;

function computeDeviceScale(): number {
  if (typeof window === 'undefined') return 1;
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  if (!vw || !vh) return 1;
  const availW = Math.max(200, vw - 28);
  const availH = Math.max(320, vh - 32);
  return Math.min(1, availW / PHYSICAL_WIDTH, availH / PHYSICAL_HEIGHT);
}

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
    case '%': return 'percent';
    case '|': return 'abs';
    case 'Enter':
    case '=': return 'equals';
    case 'Backspace': return 'del';
    case 'Insert': return 'toggle-ins';
    case 'Delete':
    case 'Escape': return 'ac';
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case 'x':
    case 'X': return 'var-x';
    case 'y':
    case 'Y': return 'var-y';
    case 'e':
    case 'E': return 'exp';
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
  }, [
    state.angle,
    state.ioMode,
    state.mathOutputMode,
    state.decimalMark,
    state.defaultCmplxFormat,
    state.recurEnabled,
    state.contrast,
    state.numberFormat,
    state.defaultFractionStyle,
    state.tableUseG,
    state.variables,
  ]);

  const [deviceScale, setDeviceScale] = useState<number>(computeDeviceScale);

  useEffect(() => {
    const updateScale = () => setDeviceScale(computeDeviceScale());
    updateScale();
    window.addEventListener('resize', updateScale);
    window.visualViewport?.addEventListener('resize', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
      window.visualViewport?.removeEventListener('resize', updateScale);
    };
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const cur = stateRef.current;
      const before = cur.phase === 'editing' ? cur.expression.slice(0, cur.cursor) : '';
      const prefMatch = cur.mode === 'BASE-N' ? before.match(/(?:^|[^a-zA-Z])([dhbo])[0-9A-F]*$/) : null;
      const isHex = cur.mode === 'BASE-N' && (prefMatch ? prefMatch[1] === 'h' : cur.baseN.base === 'HEX');
      const isCmplx = cur.mode === 'CMPLX';
      const mapped = mapKeyboardEvent(e, isHex, isCmplx);
      if (mapped) {
        e.preventDefault();
        dispatch({ type: 'key', id: mapped });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <main
      className="calc-viewport"
      data-testid="calc-viewport"
      style={{ '--calc-scale': String(deviceScale) } as React.CSSProperties}
    >
      <CalculatorHardware state={state} dispatch={dispatch} />
    </main>
  );
}

export default App;
