import React from 'react';
import { formatActiveResult, type CalculatorState } from '../core/calculator';
import { SCIENTIFIC_CONSTANTS, UNIT_CONVERSIONS } from '../core/constants';
import type { DistSubMode } from '../core/dist';
import type { EqnType } from '../core/eqn';
import { formatDecimal, formatResult } from '../core/format';
import { deserialize } from '../core/value';
import { NaturalExpression, NaturalResult } from './NaturalMath';

const EQN_LABELS: Record<EqnType, string> = {
  lin2: 'anX+bnY=cn',
  lin3: 'anX+bnY+cnZ=dn',
  quad: 'aX²+bX+c=0',
  cubic: 'aX³+bX²+cX+d=0',
};

const EQN_COEFFS: Record<EqnType, readonly string[]> = {
  lin2: ['a1', 'b1', 'c1', 'a2', 'b2', 'c2'],
  lin3: ['a1', 'b1', 'c1', 'd1', 'a2', 'b2', 'c2', 'd2', 'a3', 'b3', 'c3', 'd3'],
  quad: ['a', 'b', 'c'],
  cubic: ['a', 'b', 'c', 'd'],
};

const DIST_TITLES: Record<DistSubMode, string> = {
  'norm-pd': 'Normal PD',
  'norm-cd': 'Normal CD',
  'inv-norm': 'Inverse Normal',
  'binom-pd': 'Binomial PD',
  'binom-cd': 'Binomial CD',
  'poisson-pd': 'Poisson PD',
  'poisson-cd': 'Poisson CD',
};

function LcdStatusBar({ state }: { state: CalculatorState }): React.ReactElement {
  const mScalar = deserialize(state.variables.M);
  const hasM = !mScalar.decimal.isZero();
  const isMath = state.ioMode === 'Math';
  const isFix = state.numberFormat.mode === 'Fix';
  const isSci = state.numberFormat.mode === 'Sci';

  return (
    <div className="lcd-status" data-testid="lcd-status" dir="ltr">
      <span className={state.shift ? 'ind on' : 'ind'}>S</span>
      <span className={state.alpha ? 'ind on' : 'ind'}>A</span>
      <span className={state.pending === 'store' ? 'ind on' : 'ind'}>STO</span>
      <span className={state.pending === 'recall' ? 'ind on' : 'ind'}>RCL</span>
      <span className={state.hyp ? 'ind on' : 'ind'}>HYP</span>
      <span className={hasM ? 'ind on' : 'ind'}>M</span>
      <span className="ind on">{state.angle === 'DEG' ? 'D' : state.angle === 'RAD' ? 'R' : 'G'}</span>
      <span className={state.mode === 'CMPLX' ? 'ind on' : 'ind'}>CMPLX</span>
      <span className={state.mode === 'STAT' ? 'ind on' : 'ind'}>STAT</span>
      <span className={state.mode === 'MATRIX' ? 'ind on' : 'ind'}>MAT</span>
      <span className={state.mode === 'VECTOR' ? 'ind on' : 'ind'}>VCT</span>
      <span className={isFix ? 'ind on' : 'ind'}>FIX</span>
      <span className={isSci ? 'ind on' : 'ind'}>SCI</span>
      <span className={isMath ? 'ind on' : 'ind'}>Math</span>
      <span className="ind-spacer" />
      <span className="ind-mode">
        {state.mode === 'BASE-N' ? state.baseN.base : state.mode !== 'COMP' ? state.mode : ''}
      </span>
    </div>
  );
}

function renderMenuScreen(state: CalculatorState): React.ReactElement | null {
  const { screen, menuPage, numberFormat } = state;
  if (screen === 'normal' || screen === 'off') return null;

  if (screen === 'mode') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        {menuPage === 0 ? (
          <div className="lcd-menu-grid">
            <span>1:COMP</span>
            <span>2:CMPLX</span>
            <span>3:STAT</span>
            <span>4:BASE-N</span>
            <span>5:EQN</span>
            <span>6:MATRIX</span>
            <span>7:TABLE</span>
            <span>8:VECTOR</span>
          </div>
        ) : (
          <div className="lcd-menu-grid">
            <span>1:INEQ</span>
            <span>2:VERIF</span>
            <span>3:DIST</span>
          </div>
        )}
        <div className="lcd-menu-hint">{menuPage === 0 ? '▼ Page 2' : '▲ Page 1'}</div>
      </div>
    );
  }

  if (screen === 'setup') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        {menuPage === 0 ? (
          <div className="lcd-menu-grid">
            <span>1:MthIO</span>
            <span>2:LineIO</span>
            <span>3:Deg</span>
            <span>4:Rad</span>
            <span>5:Gra</span>
            <span>6:Fix</span>
            <span>7:Sci</span>
            <span>8:Norm</span>
          </div>
        ) : (
          <div className="lcd-menu-grid">
            <span>1:ab/c</span>
            <span>2:TABLE</span>
            <span>3:STAT</span>
          </div>
        )}
        <div className="lcd-menu-hint">{menuPage === 0 ? '▼ Page 2' : '▲ Page 1'}</div>
      </div>
    );
  }

  if (
    screen === 'setup-fix' ||
    screen === 'setup-sci' ||
    screen === 'setup-norm' ||
    screen === 'setup-abdc' ||
    screen === 'setup-table' ||
    screen === 'setup-stat-freq'
  ) {
    const prompt =
      screen === 'setup-fix'
        ? 'Fix 0~9?'
        : screen === 'setup-sci'
          ? 'Sci 0~9?'
          : screen === 'setup-norm'
            ? 'Norm 1~2?'
            : screen === 'setup-abdc'
              ? '1:a b/c   2:d/c'
              : screen === 'setup-table'
                ? '1:f(X)   2:f(X),g(X)'
                : 'Frequency? 1:ON  2:OFF';
    return (
      <div className="lcd-prompt-screen" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-prompt-title">{prompt}</div>
      </div>
    );
  }

  if (screen === 'drg') {
    return (
      <div className="lcd-prompt-screen" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-prompt-title">1:°   2:r   3:g</div>
      </div>
    );
  }

  if (screen === 'clear') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-list">
          <span>1:Setup</span>
          <span>2:Memory</span>
          <span>3:All</span>
        </div>
      </div>
    );
  }

  if (screen === 'clear-confirm') {
    const title =
      state.clearTarget === 'setup'
        ? 'Reset Setup?'
        : state.clearTarget === 'memory'
          ? 'Clear Memory?'
          : 'Reset All?';
    return (
      <div className="lcd-prompt-screen" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-prompt-title">{title}</div>
        <div className="lcd-menu-hint">[=] : Yes   [AC] : Cancel</div>
      </div>
    );
  }

  if (screen === 'const-picker' || screen === 'conv-picker') {
    const isConst = screen === 'const-picker';
    const items = isConst ? SCIENTIFIC_CONSTANTS : UNIT_CONVERSIONS;
    const startIdx = Math.max(0, Math.min(items.length - 4, state.pickerIndex));
    const slice = items.slice(startIdx, startIdx + 4);
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-prompt-title">
          {isConst ? 'CONST 01~40' : 'CONV 01~40'} [{state.codeDigits.padEnd(2, '_')}]
        </div>
        <div className="lcd-menu-grid">
          {slice.map((item, idx) => {
            const active = startIdx + idx === state.pickerIndex;
            return (
              <span key={item.code} className={active ? 'menu-item-active' : undefined}>
                {item.code}:{'symbol' in item ? item.symbol : item.label}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (screen === 'cmplx-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:arg</span>
          <span>2:Conjg</span>
          <span>3:▸r∠θ</span>
          <span>4:▸a+bi</span>
        </div>
      </div>
    );
  }

  if (screen === 'basen-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:and</span>
          <span>2:or</span>
          <span>3:xor</span>
          <span>4:xnor</span>
          <span>5:Not</span>
          <span>6:Neg</span>
        </div>
      </div>
    );
  }

  if (screen === 'verif-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:=</span>
          <span>2:≠</span>
          <span>3:&gt;</span>
          <span>4:&lt;</span>
          <span>5:≥</span>
          <span>6:≤</span>
        </div>
      </div>
    );
  }

  if (screen === 'stat-type-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:1-VAR</span>
          <span>2:A+BX</span>
          <span>3:_+CX²</span>
          <span>4:ln X</span>
          <span>5:e^X</span>
          <span>6:A·B^X</span>
          <span>7:A·X^B</span>
          <span>8:1/X</span>
        </div>
      </div>
    );
  }

  if (screen === 'stat-menu') {
    const isReg = state.stat.subMode !== '1-VAR';
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:Type</span>
          <span>2:Data</span>
          <span>3:Sum</span>
          <span>4:Var</span>
          <span>{isReg ? '5:Reg' : '5:MinMax'}</span>
          {isReg && <span>6:MinMax</span>}
        </div>
      </div>
    );
  }

  if (screen === 'stat-sub-sum') {
    const isReg = state.stat.subMode !== '1-VAR';
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:Σx²</span>
          <span>2:Σx</span>
          {isReg && <span>3:Σy²</span>}
          {isReg && <span>4:Σy</span>}
          {isReg && <span>5:Σxy</span>}
        </div>
      </div>
    );
  }

  if (screen === 'stat-sub-var') {
    const isReg = state.stat.subMode !== '1-VAR';
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:n</span>
          <span>2:x̄</span>
          <span>3:σx</span>
          <span>4:sx</span>
          {isReg && <span>5:ȳ</span>}
          {isReg && <span>6:σy</span>}
          {isReg && <span>7:sy</span>}
        </div>
      </div>
    );
  }

  if (screen === 'stat-sub-reg') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:A</span>
          <span>2:B</span>
          <span>{state.stat.subMode === '_+CX2' ? '3:C' : '3:r'}</span>
          <span>4:x̂</span>
          <span>5:ŷ</span>
        </div>
      </div>
    );
  }

  if (screen === 'stat-sub-minmax') {
    const is1Var = state.stat.subMode === '1-VAR';
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:minX</span>
          <span>2:maxX</span>
          {is1Var ? (
            <>
              <span>3:Q1</span>
              <span>4:med</span>
              <span>5:Q3</span>
            </>
          ) : (
            <>
              <span>3:minY</span>
              <span>4:maxY</span>
            </>
          )}
        </div>
      </div>
    );
  }

  if (screen === 'matrix-target-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-prompt-title">{state.matrix.dimAction === 'define' ? 'Matrix?' : 'Edit Matrix?'}</div>
        <div className="lcd-menu-list">
          <span>1:MatA</span>
          <span>2:MatB</span>
          <span>3:MatC</span>
        </div>
      </div>
    );
  }

  if (screen === 'matrix-dim-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-prompt-title">{state.matrix.pendingTarget}(m×n) m×n?</div>
        <div className="lcd-menu-grid lcd-menu-grid-3">
          <span>1:3×3</span>
          <span>2:3×2</span>
          <span>3:3×1</span>
          <span>4:2×3</span>
          <span>5:2×2</span>
          <span>6:2×1</span>
          <span>7:1×3</span>
          <span>8:1×2</span>
          <span>9:1×1</span>
        </div>
      </div>
    );
  }

  if (screen === 'matrix-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:Dim</span>
          <span>2:Data</span>
          <span>3:MatA</span>
          <span>4:MatB</span>
          <span>5:MatC</span>
          <span>6:MatAns</span>
          <span>7:det</span>
          <span>8:Trn</span>
        </div>
      </div>
    );
  }

  if (screen === 'vector-target-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-prompt-title">Vector?</div>
        <div className="lcd-menu-list">
          <span>1:VctA</span>
          <span>2:VctB</span>
          <span>3:VctC</span>
        </div>
      </div>
    );
  }

  if (screen === 'vector-dim-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-prompt-title">{state.vector.pendingTarget}(m) m?</div>
        <div className="lcd-menu-list">
          <span>1:3</span>
          <span>2:2</span>
        </div>
      </div>
    );
  }

  if (screen === 'vector-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:Dim</span>
          <span>2:Data</span>
          <span>3:VctA</span>
          <span>4:VctB</span>
          <span>5:VctC</span>
          <span>6:VctAns</span>
          <span>7:Dot</span>
        </div>
      </div>
    );
  }

  if (screen === 'eqn-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-list">
          <span>1:anX+bnY=cn</span>
          <span>2:anX+bnY+cnZ=dn</span>
          <span>3:aX²+bX+c=0</span>
          <span>4:aX³+bX²+cX+d=0</span>
        </div>
      </div>
    );
  }

  if (screen === 'ineq-deg-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-prompt-title">Inequality:</div>
        <div className="lcd-menu-list">
          <span>1:aX²+bX+c</span>
          <span>2:aX³+bX²+cX+d</span>
        </div>
      </div>
    );
  }

  if (screen === 'ineq-rel-menu') {
    const poly = state.ineq?.degree === 3 ? 'aX³+bX²+cX+d' : 'aX²+bX+c';
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-list">
          <span>1:{poly}&gt;0</span>
          <span>2:{poly}&lt;0</span>
          <span>3:{poly}≥0</span>
          <span>4:{poly}≤0</span>
        </div>
      </div>
    );
  }

  if (screen === 'dist-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:Normal PD</span>
          <span>2:Normal CD</span>
          <span>3:Inv Normal</span>
          <span>4:Binomial PD</span>
          <span>5:Binomial CD</span>
          <span>6:Poisson PD</span>
          <span>7:Poisson CD</span>
        </div>
      </div>
    );
  }

  void numberFormat;
  return null;
}

function renderNormalInteractiveBody(state: CalculatorState): React.ReactElement | null {
  const lineMode = state.ioMode === 'Line';

  // CALC variable prompt
  if (state.calcPrompt) {
    const varName = state.calcPrompt.vars[state.calcPrompt.index] ?? 'X';
    const currentStored = formatDecimal(deserialize(state.variables[varName]), state.numberFormat);
    return (
      <div className="lcd-home" dir="ltr">
        <div className="lcd-expr-area">
          <span className="lcd-prompt-prefix">{varName}?</span>
          <NaturalExpression
            expression={state.calcPrompt.input || currentStored}
            cursor={state.calcPrompt.input ? state.calcPrompt.input.length : null}
            overwrite={!state.insertMode}
            lineMode={lineMode}
          />
        </div>
        <div className="lcd-result-area" data-testid="lcd-result" />
      </div>
    );
  }

  // SOLVE prompt
  if (state.solvePrompt && state.solvePrompt.stage === 'prompt-x') {
    const xCurrent = formatDecimal(deserialize(state.variables.X), state.numberFormat);
    return (
      <div className="lcd-home" dir="ltr">
        <div className="lcd-expr-area">
          <span className="lcd-prompt-prefix">Solve for X:</span>
          <NaturalExpression
            expression={state.solvePrompt.input || xCurrent}
            cursor={state.solvePrompt.input ? state.solvePrompt.input.length : null}
            overwrite={!state.insertMode}
            lineMode={lineMode}
          />
        </div>
        <div className="lcd-result-area" data-testid="lcd-result" />
      </div>
    );
  }

  // STAT Data Table Editor
  if (state.mode === 'STAT' && state.stat.editingTable) {
    const st = state.stat;
    const hasY = st.subMode !== '1-VAR';
    const totalSlots = Math.min(80, st.rows.length + 1);
    const startRow = Math.max(0, Math.min(st.rowIdx - 1, Math.max(0, totalSlots - 3)));
    const visibleIndices = Array.from({ length: Math.min(3, totalSlots - startRow) }, (_, i) => startRow + i);
    return (
      <div className="lcd-table-view" data-testid="lcd-stat-editor" dir="ltr">
        <div className="lcd-table-head">
          <span>#</span>
          <span>X</span>
          {hasY && <span>Y</span>}
          {st.useFreq && <span>FRQ</span>}
        </div>
        {visibleIndices.map((rIdx) => {
          const row = st.rows[rIdx];
          const isCurRow = rIdx === st.rowIdx;
          return (
            <div key={rIdx} className={isCurRow ? 'lcd-table-row active' : 'lcd-table-row'}>
              <span>{rIdx + 1}</span>
              <span className={isCurRow && st.colIdx === 0 ? 'cell-focus' : undefined}>
                {isCurRow && st.colIdx === 0 && st.editingCell ? st.cellInput : row ? row.x : '—'}
              </span>
              {hasY && (
                <span className={isCurRow && st.colIdx === 1 ? 'cell-focus' : undefined}>
                  {isCurRow && st.colIdx === 1 && st.editingCell ? st.cellInput : row ? (row.y ?? '0') : '—'}
                </span>
              )}
              {st.useFreq && (
                <span className={isCurRow && st.colIdx === (hasY ? 2 : 1) ? 'cell-focus' : undefined}>
                  {isCurRow && st.colIdx === (hasY ? 2 : 1) && st.editingCell ? st.cellInput : row ? row.freq : '—'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // MATRIX Cell Editor or MatAns Result Grid
  if (state.mode === 'MATRIX' && (state.matrix.editingTarget || state.matrix.showingMatrixResult)) {
    const targetName = state.matrix.editingTarget ?? 'MatAns';
    const mat = state.matrix.matrices[targetName];
    const isEditing = state.matrix.editingTarget !== null;
    if (mat) {
      return (
        <div className="lcd-table-view" data-testid="lcd-matrix-grid" dir="ltr">
          <div className="lcd-prompt-title">
            {targetName} [{mat.rows}×{mat.cols}]
          </div>
          {mat.cells.map((rCells, r) => (
            <div key={r} className="lcd-mat-row">
              {rCells.map((cell, c) => {
                const focused = isEditing && r === state.matrix.rowIdx && c === state.matrix.colIdx;
                const valStr =
                  focused && state.matrix.editingCell
                    ? state.matrix.cellInput
                    : formatDecimal(deserialize(cell), state.numberFormat);
                return (
                  <span key={c} className={focused ? 'lcd-mat-cell focused' : 'lcd-mat-cell'}>
                    {valStr}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      );
    }
  }

  // VECTOR Coordinate Editor or VctAns Result
  if (state.mode === 'VECTOR' && (state.vector.editingTarget || state.vector.showingVectorResult)) {
    const targetName = state.vector.editingTarget ?? 'VctAns';
    const vct = state.vector.vectors[targetName];
    const isEditing = state.vector.editingTarget !== null;
    if (vct) {
      return (
        <div className="lcd-table-view" data-testid="lcd-vector-grid" dir="ltr">
          <div className="lcd-prompt-title">
            {targetName} [{vct.dim}]
          </div>
          <div className="lcd-mat-row">
            {vct.coords.map((cell, idx) => {
              const focused = isEditing && idx === state.vector.coordIdx;
              const valStr =
                focused && state.vector.editingCell
                  ? state.vector.cellInput
                  : formatDecimal(deserialize(cell), state.numberFormat);
              return (
                <span key={idx} className={focused ? 'lcd-mat-cell focused' : 'lcd-mat-cell'}>
                  {valStr}
                </span>
              );
            })}
          </div>
        </div>
      );
    }
  }

  // EQN Mode Editor & Solution Display
  if (state.mode === 'EQN' && state.eqn) {
    const eqn = state.eqn;
    if (eqn.outcome) {
      if (eqn.outcome.status === 'infinite') {
        return (
          <div className="lcd-home" dir="ltr">
            <div className="lcd-expr-area">{EQN_LABELS[eqn.type]}</div>
            <div className="lcd-result-area" data-testid="lcd-result">
              <div className="lcd-result-text">Infinite Sol.</div>
            </div>
          </div>
        );
      }
      if (eqn.outcome.status === 'no-solution') {
        return (
          <div className="lcd-home" dir="ltr">
            <div className="lcd-expr-area">{EQN_LABELS[eqn.type]}</div>
            <div className="lcd-result-area" data-testid="lcd-result">
              <div className="lcd-result-text">No Solution</div>
            </div>
          </div>
        );
      }
      const item = eqn.outcome.items[eqn.solutionIndex];
      const disp = item?.scalar
        ? formatResult(item.scalar, state.resultFormat, {
            fractionStyle: state.fractionStyle,
            numberFormat: state.numberFormat,
          })
        : { type: 'text' as const, text: item?.complexText ?? '0' };
      return (
        <div className="lcd-home" dir="ltr">
          <div className="lcd-expr-area">
            <span className="lcd-eqn-res-label">{item?.label} =</span>
            <span className="lcd-eqn-nav">
              ({eqn.solutionIndex + 1}/{eqn.outcome.items.length}) ▼▲
            </span>
          </div>
          <div className="lcd-result-area" data-testid="lcd-result">
            <NaturalResult display={disp} lineMode={lineMode} />
          </div>
        </div>
      );
    }

    const names = EQN_COEFFS[eqn.type];
    const activeName = names[eqn.cursorIndex] ?? 'a';
    return (
      <div className="lcd-eqn-editor" dir="ltr">
        <div className="lcd-eqn-header">
          {EQN_LABELS[eqn.type]} — {activeName}?
        </div>
        <div className="lcd-eqn-coeffs">
          {names.slice(0, 6).map((nm, idx) => (
            <span key={nm} className={idx === eqn.cursorIndex ? 'eqn-chip active' : 'eqn-chip'}>
              {nm}={formatDecimal(deserialize(eqn.coeffs[idx]), state.numberFormat)}
            </span>
          ))}
        </div>
        <div className="lcd-expr-area">
          <NaturalExpression
            expression={eqn.editingCell ? eqn.input : formatDecimal(deserialize(eqn.coeffs[eqn.cursorIndex]), state.numberFormat)}
            cursor={eqn.editingCell ? eqn.input.length : null}
            overwrite={!state.insertMode}
            lineMode={lineMode}
          />
        </div>
      </div>
    );
  }

  // INEQ Mode Editor & Interval Solution
  if (state.mode === 'INEQ' && state.ineq) {
    const ineq = state.ineq;
    if (ineq.solved) {
      const disp = formatActiveResult(state) ?? { type: 'text', text: '' };
      return (
        <div className="lcd-home" dir="ltr">
          <div className="lcd-expr-area">
            <span className="lcd-eqn-res-label">Inequality:</span>
          </div>
          <div className="lcd-result-area" data-testid="lcd-result">
            <NaturalResult display={disp} lineMode={lineMode} />
          </div>
        </div>
      );
    }
    const names = ineq.degree === 2 ? ['a', 'b', 'c'] : ['a', 'b', 'c', 'd'];
    const cur = names[ineq.cursorIndex] ?? 'a';
    const poly = ineq.degree === 2 ? 'aX²+bX+c' : 'aX³+bX²+cX+d';
    return (
      <div className="lcd-eqn-editor" dir="ltr">
        <div className="lcd-eqn-header">
          {poly} {ineq.relation} 0 — {cur}?
        </div>
        <div className="lcd-eqn-coeffs">
          {names.map((nm, idx) => (
            <span key={nm} className={idx === ineq.cursorIndex ? 'eqn-chip active' : 'eqn-chip'}>
              {nm}={formatDecimal(deserialize(ineq.coeffs[idx]), state.numberFormat)}
            </span>
          ))}
        </div>
        <div className="lcd-expr-area">
          <NaturalExpression
            expression={ineq.editingCell ? ineq.input : formatDecimal(deserialize(ineq.coeffs[ineq.cursorIndex]), state.numberFormat)}
            cursor={ineq.editingCell ? ineq.input.length : null}
            overwrite={!state.insertMode}
            lineMode={lineMode}
          />
        </div>
      </div>
    );
  }

  // DIST Mode Parameter Editor & Probability Result
  if (state.mode === 'DIST' && state.dist) {
    const ds = state.dist;
    if (ds.result) {
      const disp = formatResult(deserialize(ds.result), 'decimal', {
        fractionStyle: state.fractionStyle,
        numberFormat: state.numberFormat,
      });
      return (
        <div className="lcd-home" dir="ltr">
          <div className="lcd-expr-area">
            <span className="lcd-eqn-res-label">{DIST_TITLES[ds.subMode]} =</span>
          </div>
          <div className="lcd-result-area" data-testid="lcd-result">
            <NaturalResult display={disp} lineMode={lineMode} />
          </div>
        </div>
      );
    }
    return (
      <div className="lcd-table-view" data-testid="lcd-dist-editor" dir="ltr">
        <div className="lcd-prompt-title">{DIST_TITLES[ds.subMode]}</div>
        {ds.params.map((p, idx) => {
          const active = idx === ds.paramIdx;
          return (
            <div key={p.name} className={active ? 'lcd-table-row active' : 'lcd-table-row'}>
              <span>{p.name}</span>
              <span className={active ? 'cell-focus' : undefined}>
                {active && ds.editingParam ? ds.input : p.value}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // TABLE Mode Prompts & Table Viewer
  if (state.mode === 'TABLE' && state.table) {
    const tbl = state.table;
    if (tbl.stage === 'view') {
      const startIdx = Math.max(0, Math.min(tbl.selectedRow, Math.max(0, tbl.rows.length - 3)));
      const visible = tbl.rows.slice(startIdx, startIdx + 3);
      const hasG = tbl.rows.some((r) => r.gx !== undefined);
      return (
        <div className="lcd-table-view" data-testid="lcd-table" dir="ltr">
          <div className="lcd-table-head">
            <span>#</span>
            <span>X</span>
            <span>f(X)</span>
            {hasG && <span>g(X)</span>}
          </div>
          {visible.map((r, i) => {
            const idx = startIdx + i;
            return (
              <div key={idx} className={idx === tbl.selectedRow ? 'lcd-table-row active' : 'lcd-table-row'}>
                <span>{idx + 1}</span>
                <span>{r.x}</span>
                <span>{r.fx}</span>
                {hasG && <span>{r.gx ?? ''}</span>}
              </div>
            );
          })}
        </div>
      );
    }

    if (tbl.stage === 'start' || tbl.stage === 'end' || tbl.stage === 'step') {
      const label = tbl.stage === 'start' ? 'Start?' : tbl.stage === 'end' ? 'End?' : 'Step?';
      const val = tbl.stage === 'start' ? tbl.startInput : tbl.stage === 'end' ? tbl.endInput : tbl.stepInput;
      return (
        <div className="lcd-home" dir="ltr">
          <div className="lcd-expr-area">
            <span className="lcd-prompt-prefix">{label}</span>
            <NaturalExpression expression={val} cursor={val.length} overwrite={!state.insertMode} lineMode={lineMode} />
          </div>
          <div className="lcd-result-area" data-testid="lcd-result" />
        </div>
      );
    }

    const fnPrefix = tbl.stage === 'f' ? 'f(X)=' : 'g(X)=';
    return (
      <div className="lcd-home" dir="ltr">
        <div className="lcd-expr-area" data-testid="lcd-expression">
          <span className="lcd-prompt-prefix">{fnPrefix}</span>
          <NaturalExpression
            expression={state.expression}
            cursor={state.cursor}
            overwrite={!state.insertMode}
            lineMode={lineMode}
          />
        </div>
        <div className="lcd-result-area" data-testid="lcd-result" />
      </div>
    );
  }

  return null;
}

export function LcdScreen({ state }: { state: CalculatorState }): React.ReactElement {
  if (state.screen === 'off') {
    return (
      <div className="lcd-bezel">
        <div className="lcd-glass lcd-off" data-testid="lcd-off" />
      </div>
    );
  }

  if (state.phase === 'error' && state.error) {
    return (
      <div className="lcd-bezel">
        <div className="lcd-glass" data-testid="lcd-screen">
          <LcdStatusBar state={state} />
          <div className="lcd-error" data-testid="lcd-error" dir="ltr">
            <div className="lcd-error-title">{state.error}</div>
            <div className="lcd-error-hint">
              <div>[AC]  :Cancel</div>
              <div>[◀][▶]:Goto</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const menuNode = renderMenuScreen(state);
  if (menuNode) {
    return (
      <div className="lcd-bezel">
        <div className="lcd-glass" data-testid="lcd-screen">
          <LcdStatusBar state={state} />
          {menuNode}
        </div>
      </div>
    );
  }

  const interactiveNode = renderNormalInteractiveBody(state);
  if (interactiveNode) {
    return (
      <div className="lcd-bezel">
        <div className="lcd-glass" data-testid="lcd-screen">
          <LcdStatusBar state={state} />
          {interactiveNode}
        </div>
      </div>
    );
  }

  const display = formatActiveResult(state) ?? { type: 'text' as const, text: '' };
  const lineMode = state.ioMode === 'Line' || state.mode === 'BASE-N';

  return (
    <div className="lcd-bezel">
      <div className="lcd-glass" data-testid="lcd-screen">
        <LcdStatusBar state={state} />
        <div className="lcd-home">
          <div className="lcd-expr-area" data-testid="lcd-expression">
            <NaturalExpression
              expression={state.expression}
              cursor={state.phase === 'result' ? null : state.cursor}
              overwrite={!state.insertMode}
              lineMode={lineMode}
            />
          </div>
          {state.notice && (
            <div className="lcd-notice" data-testid="lcd-notice">
              {state.notice}
            </div>
          )}
          <div className="lcd-result-area" data-testid="lcd-result">
            {display.type === 'text' && display.text === '' ? null : (
              <NaturalResult display={display} lineMode={lineMode} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
