import React, { useEffect, useReducer, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { CalculatorHardware } from './components/CalculatorHardware';
import { ExtraPanel } from './components/ExtraPanel';
import { calculatorReducer, hydrateState, saveableState } from './core/calculator';

const STORAGE_KEY = 'scientific-calc-fx991es-state-v1';

function mapKeyboardEvent(e: KeyboardEvent, isHexBaseN: boolean): string | null {
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
  const [showExtra, setShowExtra] = useState(true);

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
      const mapped = mapKeyboardEvent(e, isHex);
      if (mapped) {
        e.preventDefault();
        dispatch({ type: 'key', id: mapped });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.mode, state.baseN.base]);

  return (
    <div className="app-shell" dir="rtl">
      <header className="app-topbar">
        <div className="app-title-block">
          <h1>الآلة الحاسبة العلمية — تصميم fx-95ES PLUS بوظائف fx-991ES PLUS C</h1>
          <p>واجهة مرسومة بالكامل بالكود (بدون صور) • محرك حسابي مستقل قيد التطوير التدريجي</p>
        </div>
        <div className="app-topbar-actions">
          <button
            type="button"
            className="panel-toggle-btn"
            onClick={() => setShowExtra((prev) => !prev)}
            aria-expanded={showExtra}
          >
            {showExtra ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            <span>{showExtra ? 'إخفاء لوحة 991ES+C' : 'إظهار لوحة 991ES+C'}</span>
          </button>
        </div>
      </header>

      <main className={showExtra ? 'workspace-grid' : 'workspace-grid panel-collapsed'}>
        <div className="hardware-column">
          <CalculatorHardware state={state} dispatch={dispatch} />
          {state.notice && (
            <div className="notice-banner" role="status" data-testid="calculator-notice">
              <span>{state.notice}</span>
              <button
                type="button"
                className="notice-close"
                onClick={() => dispatch({ type: 'clear-notice' })}
                aria-label="إغلاق التنبيه"
              >
                إخفاء
              </button>
            </div>
          )}
        </div>

        {showExtra && <ExtraPanel state={state} dispatch={dispatch} />}
      </main>
    </div>
  );
}

export default App;
