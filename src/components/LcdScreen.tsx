import React from 'react';
import { formatActiveResult, type CalculatorAction, type CalculatorState } from '../core/calculator';
import { formatEqnItem } from '../core/eqn';
import { formatDecimal } from '../core/format';
import { deserialize } from '../core/value';
import { NaturalExpression, NaturalResult } from './NaturalMath';

interface LcdScreenProps {
  state: CalculatorState;
  dispatch: React.Dispatch<CalculatorAction>;
}

export function LcdScreen({ state, dispatch }: LcdScreenProps): React.ReactElement {
  const press = (id: string) => dispatch({ type: 'key', id });

  if (state.screen === 'off') {
    return (
      <div className="lcd-bezel">
        <div className="lcd-glass lcd-glass-off" data-testid="lcd-screen" aria-label="الشاشة مغلقة">
          <span className="lcd-off-hint">اضغط ON للتشغيل</span>
        </div>
      </div>
    );
  }

  const memActive = !deserialize(state.variables.M).decimal.isZero();
  const angleBadge = state.angle === 'DEG' ? 'D' : state.angle === 'RAD' ? 'R' : 'G';
  const lineMode = state.ioMode === 'Line' || state.mode === 'BASE-N';
  const activeDisplay = formatActiveResult(state);

  const renderBody = (): React.ReactNode => {
    // 1. Menus
    if (state.screen === 'mode') {
      return state.menuPage === 0 ? (
        <div className="lcd-menu" dir="ltr">
          <button type="button" className="lcd-menu-item" onClick={() => press('1')}>1:COMP</button>
          <button type="button" className="lcd-menu-item lcd-menu-dim" onClick={() => press('2')}>2:CMPLX</button>
          <button type="button" className="lcd-menu-item lcd-menu-dim" onClick={() => press('3')}>3:STAT</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('4')}>4:BASE-N</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('5')}>5:EQN</button>
          <button type="button" className="lcd-menu-item lcd-menu-dim" onClick={() => press('6')}>6:MATRIX</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('7')}>7:TABLE</button>
          <button type="button" className="lcd-menu-item lcd-menu-dim" onClick={() => press('8')}>8:VECTOR</button>
        </div>
      ) : (
        <div className="lcd-menu" dir="ltr">
          <button type="button" className="lcd-menu-item lcd-menu-dim" onClick={() => press('1')}>1:INEQ</button>
          <button type="button" className="lcd-menu-item lcd-menu-dim" onClick={() => press('2')}>2:VERIF</button>
          <button type="button" className="lcd-menu-item lcd-menu-dim" onClick={() => press('3')}>3:DIST</button>
        </div>
      );
    }

    if (state.screen === 'eqn-menu') {
      return (
        <div className="lcd-menu lcd-menu-single" dir="ltr">
          <button type="button" className="lcd-menu-item" onClick={() => press('1')}>1:anX+bnY=cn</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('2')}>2:anX+bnY+cnZ=dn</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('3')}>3:aX²+bX+c=0</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('4')}>4:aX³+bX²+cX+d=0</button>
        </div>
      );
    }

    if (state.screen === 'setup') {
      return state.menuPage === 0 ? (
        <div className="lcd-menu" dir="ltr">
          <button type="button" className="lcd-menu-item" onClick={() => press('1')}>1:MthIO</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('2')}>2:LineIO</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('3')}>3:Deg</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('4')}>4:Rad</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('5')}>5:Gra</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('6')}>6:Fix</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('7')}>7:Sci</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('8')}>8:Norm</button>
        </div>
      ) : (
        <div className="lcd-menu lcd-menu-single" dir="ltr">
          <button type="button" className="lcd-menu-item" onClick={() => press('1')}>1:ab/c ⇔ d/c</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('2')}>2:TABLE (f / f,g)</button>
        </div>
      );
    }

    if (state.screen === 'setup-fix') {
      return <div className="lcd-prompt-center" dir="ltr">Fix 0~9?</div>;
    }
    if (state.screen === 'setup-sci') {
      return <div className="lcd-prompt-center" dir="ltr">Sci 0~9?</div>;
    }
    if (state.screen === 'setup-norm') {
      return <div className="lcd-prompt-center" dir="ltr">Norm 1~2?</div>;
    }
    if (state.screen === 'setup-abdc') {
      return (
        <div className="lcd-menu lcd-menu-single" dir="ltr">
          <button type="button" className="lcd-menu-item" onClick={() => press('1')}>1:ab/c</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('2')}>2:d/c</button>
        </div>
      );
    }
    if (state.screen === 'setup-table') {
      return (
        <div className="lcd-menu lcd-menu-single" dir="ltr">
          <button type="button" className="lcd-menu-item" onClick={() => press('1')}>1:f(X)</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('2')}>2:f(X),g(X)</button>
        </div>
      );
    }
    if (state.screen === 'drg') {
      return (
        <div className="lcd-menu lcd-menu-inline" dir="ltr">
          <button type="button" className="lcd-menu-item" onClick={() => press('1')}>1:°</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('2')}>2:r</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('3')}>3:g</button>
        </div>
      );
    }

    if (state.screen === 'clear') {
      return (
        <div className="lcd-menu lcd-menu-single" dir="ltr">
          <div className="lcd-menu-title">Clear?</div>
          <button type="button" className="lcd-menu-item" onClick={() => press('1')}>1:Setup</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('2')}>2:Memory</button>
          <button type="button" className="lcd-menu-item" onClick={() => press('3')}>3:All</button>
        </div>
      );
    }

    if (state.screen === 'clear-confirm') {
      const label = state.clearTarget === 'setup' ? 'Setup' : state.clearTarget === 'memory' ? 'Memory' : 'All';
      return (
        <div className="lcd-error-box" dir="ltr">
          <div className="lcd-error-title">Reset {label}?</div>
          <div className="lcd-error-line">[=] :Yes</div>
          <div className="lcd-error-line">[AC] :Cancel</div>
        </div>
      );
    }

    // 2. Error Screen
    if (state.phase === 'error' && state.error) {
      return (
        <div className="lcd-error-box" dir="ltr">
          <div className="lcd-error-title">{state.error}</div>
          <div className="lcd-error-line">[AC] :Cancel</div>
          <div className="lcd-error-line">[◄][►]:Goto</div>
        </div>
      );
    }

    // 3. CALC variable prompt
    if (state.calcPrompt) {
      const targetVar = state.calcPrompt.vars[state.calcPrompt.index];
      const storedStr = formatDecimal(deserialize(state.variables[targetVar]), state.numberFormat);
      return (
        <div className="lcd-split" dir="ltr">
          <div className="lcd-expr-area">
            <span className="lcd-prompt-tag">{targetVar}?</span>
            {state.calcPrompt.input && <span className="lcd-prompt-typing"> {state.calcPrompt.input}▮</span>}
          </div>
          <div className="lcd-result-area">
            <div className="lcd-result-text">{state.calcPrompt.input || storedStr}</div>
          </div>
        </div>
      );
    }

    // 4. SOLVE prompt / result
    if (state.solvePrompt) {
      if (state.solvePrompt.stage === 'prompt-x') {
        const storedX = formatDecimal(deserialize(state.variables.X), state.numberFormat);
        return (
          <div className="lcd-split" dir="ltr">
            <div className="lcd-expr-area">
              <div className="lcd-solve-eq">{state.solvePrompt.sourceExpr}</div>
              <div>
                <span className="lcd-prompt-tag">X?</span>
                {state.solvePrompt.input && <span> {state.solvePrompt.input}▮</span>}
              </div>
            </div>
            <div className="lcd-result-area">
              <div className="lcd-result-text">{state.solvePrompt.input || storedX}</div>
            </div>
          </div>
        );
      }
      if (activeDisplay) {
        return (
          <div className="lcd-split" dir="ltr">
            <div className="lcd-expr-area">
              <div className="lcd-solve-eq">{state.solvePrompt.sourceExpr}</div>
            </div>
            <div className="lcd-result-area">
              <NaturalResult display={activeDisplay} lineMode={lineMode} />
            </div>
          </div>
        );
      }
    }

    // 5. EQN Mode
    if (state.mode === 'EQN' && state.eqn) {
      const eqn = state.eqn;
      if (eqn.outcome) {
        if (eqn.outcome.status === 'infinite') {
          return <div className="lcd-prompt-center" dir="ltr">Infinite Sol</div>;
        }
        if (eqn.outcome.status === 'no-solution') {
          return <div className="lcd-prompt-center" dir="ltr">No Solution</div>;
        }
        const item = eqn.outcome.items[eqn.solutionIndex];
        const formatted = formatEqnItem(item, state.resultFormat === 'exact');
        return (
          <div className="lcd-split" dir="ltr">
            <div className="lcd-expr-area">
              <span className="lcd-eqn-sol-label">{item.label} =</span>
              <span className="lcd-eqn-sol-step">({eqn.solutionIndex + 1}/{eqn.outcome.items.length})</span>
            </div>
            <div className="lcd-result-area">
              <NaturalResult display={formatted} lineMode={lineMode} />
            </div>
          </div>
        );
      }

      const headers =
        eqn.type === 'lin2' ? ['a', 'b', 'c']
        : eqn.type === 'lin3' ? ['a', 'b', 'c', 'd']
        : eqn.type === 'quad' ? ['a', 'b', 'c']
        : ['a', 'b', 'c', 'd'];
      const cols = headers.length;
      const rowsCount = eqn.coeffs.length / cols;

      return (
        <div className="lcd-eqn-grid-wrap" dir="ltr">
          <table className="lcd-matrix">
            <thead>
              <tr>
                <th />
                {headers.map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowsCount }).map((_, r) => (
                <tr key={r}>
                  <td className="lcd-matrix-rowidx">{rowsCount > 1 ? r + 1 : '0'}</td>
                  {headers.map((_, c) => {
                    const idx = r * cols + c;
                    const active = idx === eqn.cursorIndex;
                    const cellText = active && eqn.editingCell
                      ? eqn.input
                      : formatDecimal(deserialize(eqn.coeffs[idx]));
                    return (
                      <td key={c} className={active ? 'lcd-matrix-cell active' : 'lcd-matrix-cell'}>
                        {cellText}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // 6. TABLE Mode
    if (state.mode === 'TABLE' && state.table) {
      const tbl = state.table;
      if (tbl.stage === 'f' || tbl.stage === 'g') {
        return (
          <div className="lcd-split" dir="ltr">
            <div className="lcd-expr-area lcd-table-fn">
              <span className="lcd-fn-prefix">{tbl.stage}(X)=</span>
              <NaturalExpression
                expression={state.expression}
                cursor={state.cursor}
                overwrite={!state.insertMode}
                lineMode={lineMode}
              />
            </div>
          </div>
        );
      }
      if (tbl.stage === 'start' || tbl.stage === 'end' || tbl.stage === 'step') {
        const label = tbl.stage === 'start' ? 'Start?' : tbl.stage === 'end' ? 'End?' : 'Step?';
        const val = tbl.stage === 'start' ? tbl.startInput : tbl.stage === 'end' ? tbl.endInput : tbl.stepInput;
        return (
          <div className="lcd-split" dir="ltr">
            <div className="lcd-expr-area"><span className="lcd-prompt-tag">{label}</span></div>
            <div className="lcd-result-area"><div className="lcd-result-text">{val || '0'}</div></div>
          </div>
        );
      }
      const visibleStart = Math.max(0, Math.min(tbl.selectedRow - 1, Math.max(0, tbl.rows.length - 3)));
      const visibleRows = tbl.rows.slice(visibleStart, visibleStart + 3);
      const current = tbl.rows[tbl.selectedRow];
      const hasG = visibleRows.some((r) => r.gx !== undefined);
      return (
        <div className="lcd-table-view" dir="ltr">
          <table className="lcd-matrix">
            <thead>
              <tr>
                <th>#</th>
                <th>X</th>
                <th>f(X)</th>
                {hasG && <th>g(X)</th>}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const isSel = r.index - 1 === tbl.selectedRow;
                return (
                  <tr key={r.index} className={isSel ? 'lcd-table-row-active' : ''}>
                    <td className="lcd-matrix-rowidx">{r.index}</td>
                    <td>{r.x}</td>
                    <td>{r.fx}</td>
                    {hasG && <td>{r.gx}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {current && (
            <div className="lcd-table-footer">
              X={current.x} → f={current.fx}{current.gx !== undefined ? `, g=${current.gx}` : ''}
            </div>
          )}
        </div>
      );
    }

    // 7. Standard COMP / BASE-N View
    return (
      <div className="lcd-split" dir="ltr">
        <div className="lcd-expr-area" data-testid="lcd-expression">
          <NaturalExpression
            expression={state.expression}
            cursor={state.phase === 'editing' ? state.cursor : null}
            overwrite={!state.insertMode}
            lineMode={lineMode}
          />
        </div>
        <div className="lcd-result-area" data-testid="lcd-result">
          {state.mode === 'BASE-N' && (
            <span className="lcd-basen-tag">[{state.baseN.base}]</span>
          )}
          {activeDisplay && <NaturalResult display={activeDisplay} lineMode={lineMode} />}
        </div>
      </div>
    );
  };

  const canMenuDown = (state.screen === 'mode' || state.screen === 'setup') && state.menuPage === 0;
  const canMenuUp = (state.screen === 'mode' || state.screen === 'setup') && state.menuPage === 1;
  const showHistoryUp = state.screen === 'normal' && state.mode === 'COMP' && state.history.length > 0 && (state.historyIndex === null || state.historyIndex > 0);
  const showHistoryDown = state.screen === 'normal' && state.mode === 'COMP' && state.historyIndex !== null;

  return (
    <div className="lcd-bezel">
      <div className="lcd-glass" data-testid="lcd-screen" role="region" aria-label="شاشة الآلة الحاسبة">
        <div className="lcd-status-bar" dir="ltr">
          <div className="lcd-status-left">
            <span className={state.shift ? 'lcd-ind lcd-ind-box active' : 'lcd-ind lcd-ind-box'}>S</span>
            <span className={state.alpha ? 'lcd-ind lcd-ind-box active' : 'lcd-ind lcd-ind-box'}>A</span>
            <span className={state.pending === 'store' ? 'lcd-ind active' : 'lcd-ind'}>STO</span>
            <span className={state.pending === 'recall' ? 'lcd-ind active' : 'lcd-ind'}>RCL</span>
            <span className={memActive ? 'lcd-ind active' : 'lcd-ind'}>M</span>
            <span className={state.hyp ? 'lcd-ind active' : 'lcd-ind'}>HYP</span>
          </div>
          <div className="lcd-status-center">
            <span className="lcd-ind lcd-ind-box active" data-testid="lcd-angle-badge">{angleBadge}</span>
            {state.numberFormat.mode === 'Fix' && <span className="lcd-ind active">FIX</span>}
            {state.numberFormat.mode === 'Sci' && <span className="lcd-ind active">SCI</span>}
            {state.mode !== 'COMP' && <span className="lcd-ind active">{state.mode}</span>}
            {state.statementRun && <span className="lcd-ind lcd-ind-box active">Disp</span>}
          </div>
          <div className="lcd-status-right">
            <span className={canMenuUp || showHistoryUp ? 'lcd-ind active' : 'lcd-ind'}>▲</span>
            <span className={canMenuDown || showHistoryDown ? 'lcd-ind active' : 'lcd-ind'}>▼</span>
            <span className={state.ioMode === 'Math' && state.mode === 'COMP' ? 'lcd-ind lcd-math-flag active' : 'lcd-ind lcd-math-flag'}>
              Math
            </span>
          </div>
        </div>
        <div className="lcd-content">{renderBody()}</div>
      </div>
    </div>
  );
}
