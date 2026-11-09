import React, { useEffect, useReducer, useRef, useState } from 'react';
import { CalculatorHardware } from './components/CalculatorHardware';
import { calculatorReducer, hydrateState, saveableState, type CalculatorState } from './core/calculator';

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

function isInsideUnclosedParen(expr: string, cursor: number): boolean {
  let depth = 0;
  const end = Math.min(cursor, expr.length);
  for (let i = 0; i < end; i++) {
    if (expr[i] === '(') depth++;
    else if (expr[i] === ')' && depth > 0) depth--;
  }
  return depth > 0;
}

export function mapKeyboardEvent(e: KeyboardEvent, cur: CalculatorState): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const k = e.key;
  if (/^[0-9]$/.test(k)) return k;

  // Inside menus / pickers: only map digits, D-pad, Enter/=, Backspace, and Escape/Delete
  if (cur.screen !== 'normal') {
    switch (k) {
      case 'Enter':
      case '=': return 'equals';
      case 'Backspace': return 'del';
      case 'Delete':
      case 'Escape': return 'ac';
      case 'ArrowLeft': return 'left';
      case 'ArrowRight': return 'right';
      case 'ArrowUp': return 'up';
      case 'ArrowDown': return 'down';
      default: return null;
    }
  }

  const before = cur.phase === 'editing' ? cur.expression.slice(0, cur.cursor) : '';
  const prefMatch = cur.mode === 'BASE-N' ? before.match(/(?:^|[^a-zA-Z])([dhbo])[0-9A-F]*$/) : null;
  const isHexBaseN = cur.mode === 'BASE-N' && (prefMatch ? prefMatch[1] === 'h' : cur.baseN.base === 'HEX');
  const isCmplx = cur.mode === 'CMPLX';

  if (isHexBaseN && /^[a-fA-F]$/.test(k)) {
    const map: Record<string, string> = { A: 'neg', B: 'dms', C: 'hyp', D: 'sin', E: 'cos', F: 'tan' };
    return map[k.toUpperCase()] ?? null;
  }

  // In BASE-N mode, never map scientific function letters (s, c, t, l, n, r, p, d, e)
  if (cur.mode === 'BASE-N' && /^[a-zA-Z]$/.test(k)) {
    return null;
  }

  switch (k) {
    case '.': return 'dot';
    case ',': {
      if (
        cur.decimalMark === 'Comma' &&
        (cur.phase !== 'editing' || !isInsideUnclosedParen(cur.expression, cur.cursor))
      ) {
        return 'dot';
      }
      return 'comma';
    }
    case '+': return 'add';
    case '-': return 'subtract';
    case '*': return 'multiply';
    case '/': return 'divide';
    case '(': return 'open';
    case ')': return 'close';
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

function persistCalculatorState(state: CalculatorState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saveableState(state)));
  } catch {
    // Ignore storage quota or privacy-mode restrictions
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class CalciosErrorBoundary extends React.Component<
  { onRecover: () => void; children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage restrictions
    }
    this.props.onRecover();
    this.setState({ hasError: false });
  }

  render(): React.ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
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

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    persistCalculatorState(state);
  }, [state]);

  const [deviceScale, setDeviceScale] = useState<number>(computeDeviceScale);

  useEffect(() => {
    let rafId: number | null = null;
    const updateScale = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      const next = computeDeviceScale();
      if (Number.isFinite(next) && next > 0) {
        setDeviceScale(next);
      }
    };
    const scheduleScaleRefresh = () => {
      updateScale();
      if (typeof window.requestAnimationFrame === 'function') {
        if (rafId !== null) window.cancelAnimationFrame(rafId);
        rafId = window.requestAnimationFrame(() => {
          rafId = null;
          updateScale();
        });
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistCalculatorState(stateRef.current);
      } else {
        scheduleScaleRefresh();
      }
    };
    const onPageHideOrFreeze = () => {
      persistCalculatorState(stateRef.current);
    };
    const onPageShow = () => {
      scheduleScaleRefresh();
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', scheduleScaleRefresh);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHideOrFreeze);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('freeze', onPageHideOrFreeze);
    window.visualViewport?.addEventListener('resize', updateScale);
    return () => {
      if (rafId !== null && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', scheduleScaleRefresh);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHideOrFreeze);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('freeze', onPageHideOrFreeze);
      window.visualViewport?.removeEventListener('resize', updateScale);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const cur = stateRef.current;
      const mapped = mapKeyboardEvent(e, cur);
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
      <CalciosErrorBoundary onRecover={() => dispatch({ type: 'key', id: 'on' })}>
        <CalculatorHardware state={state} dispatch={dispatch} />
      </CalciosErrorBoundary>
    </main>
  );
}

export default App;
