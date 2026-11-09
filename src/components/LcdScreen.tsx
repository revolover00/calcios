import React from 'react';
import {
  formatActiveComplexDisplay, formatActiveEqnItemDisplay,
  formatActiveInequalityDisplay, formatActiveResult, getModeHistoryIndices,
  type CalculatorState,
} from '../core/calculator';
import { SCIENTIFIC_CONSTANTS, UNIT_CONVERSIONS } from '../core/constants';
import type { DistSubMode } from '../core/dist';
import type { EqnType } from '../core/eqn';
import { formatDecimal, formatResult, type DecimalMark, type NumberFormatSetting } from '../core/format';
import { moveCursorVertical } from '../core/mathAst';
import { D, deserialize, makeScalar } from '../core/value';
import { NaturalExpression, NaturalResult } from './NaturalMath';

function formatGridCellValue(raw: string, numFmt: NumberFormatSetting, decimalMark: DecimalMark): string {
  try {
    const clean = raw.trim().replace(/×10\^/g, 'e').replace(/−/g, '-');
    if (!clean) return '0';
    return formatDecimal(makeScalar(new D(clean), undefined, true), numFmt, decimalMark);
  } catch {
    return decimalMark === 'Comma' ? raw.replace(/\./g, ',') : raw;
  }
}

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
  const eqnActiveItem =
    state.mode === 'EQN' && state.eqn?.outcome?.status === 'solved'
      ? state.eqn.outcome.items[state.eqn.solutionIndex]
      : undefined;
  const showReIm =
    (state.mode === 'CMPLX' && state.phase === 'result' && state.cmplx.result !== null) ||
    Boolean(eqnActiveItem?.complexParts);
  const showDisp = state.statementRun !== null;

  const isPagedMenu =
    state.screen === 'mode' ||
    state.screen === 'setup' ||
    state.screen === 'basen-menu' ||
    state.screen === 'matrix-menu';
  const isPickerScreen = state.screen === 'const-picker' || state.screen === 'conv-picker';
  const isEqnSolvedMulti =
    state.screen === 'normal' &&
    state.mode === 'EQN' &&
    state.eqn?.outcome?.status === 'solved' &&
    state.eqn.outcome.items.length > 1;
  const isTableViewMulti =
    state.screen === 'normal' &&
    state.mode === 'TABLE' &&
    state.table?.stage === 'view' &&
    state.table.rows.length > 1;
  const distListResults =
    state.screen === 'normal' && state.mode === 'DIST' ? state.dist?.listResults ?? null : null;
  const isExpressionReplayScreen =
    state.screen === 'normal' &&
    !state.calcPrompt &&
    !state.solvePrompt &&
    !(state.mode === 'EQN' || state.mode === 'INEQ' || state.mode === 'DIST' || state.mode === 'TABLE') &&
    !(state.mode === 'STAT' && state.stat.editingTable) &&
    !(state.mode === 'MATRIX' && (state.matrix.editingTarget || state.matrix.showingMatrixResult)) &&
    !(state.mode === 'VECTOR' && (state.vector.editingTarget || state.vector.showingVectorResult));
  const modeIndices = isExpressionReplayScreen ? getModeHistoryIndices(state) : [];
  const curHistPos = state.historyIndex !== null ? modeIndices.indexOf(state.historyIndex) : -1;
  const lineMode = state.ioMode === 'Line' || state.mode === 'BASE-N';
  const isFreshEditing =
    isExpressionReplayScreen &&
    state.phase === 'editing' &&
    state.expression.length > 0 &&
    state.historyIndex === null;

  const canUp = isPagedMenu
    ? state.menuPage > 0
    : isPickerScreen || isEqnSolvedMulti || isTableViewMulti
      ? true
      : distListResults
        ? (state.dist?.listRowIdx ?? 0) > 0
        : isFreshEditing
          ? moveCursorVertical(state.expression, state.cursor, 'up', lineMode) !== null
          : isExpressionReplayScreen && modeIndices.length > 0 && (curHistPos === -1 || curHistPos > 0);

  const canDown = isPagedMenu
    ? state.menuPage === 0
    : isPickerScreen || isEqnSolvedMulti || isTableViewMulti
      ? true
      : distListResults
        ? (state.dist?.listRowIdx ?? 0) < distListResults.length - 1
        : isFreshEditing
          ? moveCursorVertical(state.expression, state.cursor, 'down', lineMode) !== null
          : isExpressionReplayScreen && curHistPos !== -1 && curHistPos < modeIndices.length;

  const modeBadge =
    state.mode === 'BASE-N'
      ? state.baseN.base
      : state.mode === 'CMPLX'
        ? 'CMPLX'
        : state.mode === 'STAT'
          ? 'STAT'
          : state.mode === 'MATRIX'
            ? 'MAT'
            : state.mode === 'VECTOR'
              ? 'VCT'
              : state.mode !== 'COMP'
                ? state.mode
                : '';

  return (
    <div className="lcd-status" data-testid="lcd-status" dir="ltr">
      <div className="lcd-status-zone zone-left">
        {state.shift && <span className="ind ind-boxed on">S</span>}
        {state.alpha && <span className="ind ind-boxed on">A</span>}
        {state.pending === 'store' && <span className="ind on">STO</span>}
        {state.pending === 'recall' && <span className="ind on">RCL</span>}
        {hasM && <span className="ind on">M</span>}
        {modeBadge && <span className="ind on">{modeBadge}</span>}
      </div>
      <div className="lcd-status-zone zone-center">
        {state.hyp && <span className="ind on">HYP</span>}
        <span className="ind ind-boxed on">
          {state.angle === 'DEG' ? 'D' : state.angle === 'RAD' ? 'R' : 'G'}
        </span>
      </div>
      <div className="lcd-status-zone zone-math">
        {isFix && <span className="ind on">FIX</span>}
        {isSci && <span className="ind on">SCI</span>}
        {isMath && <span className="ind on">Math</span>}
      </div>
      <div className="lcd-status-zone zone-right">
        {showReIm && <span className="ind on">Re⇔Im</span>}
        {showDisp && <span className="ind ind-boxed on">Disp</span>}
        {canUp && <span className="ind on">▲</span>}
        {canDown && <span className="ind on">▼</span>}
      </div>
    </div>
  );
}

function renderMenuScreen(state: CalculatorState): React.ReactElement | null {
  const { screen, menuPage } = state;
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
            <span>2:d/c</span>
            <span>3:CMPLX</span>
            <span>4:STAT</span>
            <span>5:Disp</span>
            <span>6:TABLE</span>
            <span>7:Recur</span>
            <span>8:◀CONT▶</span>
          </div>
        )}
      </div>
    );
  }

  if (
    screen === 'setup-matho' ||
    screen === 'setup-fix' ||
    screen === 'setup-sci' ||
    screen === 'setup-norm' ||
    screen === 'setup-cmplx' ||
    screen === 'setup-disp' ||
    screen === 'setup-table' ||
    screen === 'setup-stat-freq' ||
    screen === 'setup-recur'
  ) {
    const prompt =
      screen === 'setup-matho'
        ? '1:MathO   2:LineO'
        : screen === 'setup-fix'
          ? 'Fix 0~9?'
          : screen === 'setup-sci'
            ? 'Sci 0~9?'
            : screen === 'setup-norm'
              ? 'Norm 1~2?'
              : screen === 'setup-cmplx'
                ? '1:a+bi   2:r∠θ'
                : screen === 'setup-disp'
                  ? '1:Dot   2:Comma'
                  : screen === 'setup-table'
                    ? '1:f(X)   2:f(X),g(X)'
                    : screen === 'setup-stat-freq'
                      ? 'Frequency? 1:ON  2:OFF'
                      : 'Recurring Dec? 1:ON 2:OFF';
    return (
      <div className="lcd-prompt-screen" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-prompt-title">{prompt}</div>
      </div>
    );
  }

  if (screen === 'setup-contrast') {
    const bars = '█'.repeat(state.contrast) + '░'.repeat(10 - state.contrast);
    return (
      <div className="lcd-prompt-screen" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-prompt-title">CONTRAST</div>
        <div className="lcd-contrast-bar">LIGHT ◀ {bars} ▶ DARK</div>
        <div className="lcd-menu-hint">[AC] / [=] : Exit</div>
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
        {menuPage === 0 ? (
          <div className="lcd-menu-grid">
            <span>1:and</span>
            <span>2:or</span>
            <span>3:xor</span>
            <span>4:xnor</span>
            <span>5:Not</span>
            <span>6:Neg</span>
          </div>
        ) : (
          <div className="lcd-menu-grid">
            <span>1:d</span>
            <span>2:h</span>
            <span>3:b</span>
            <span>4:o</span>
          </div>
        )}
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
          <span>{isReg ? '5:Reg' : '5:Distr'}</span>
          <span>6:MinMax</span>
        </div>
      </div>
    );
  }

  if (screen === 'stat-sub-sum') {
    const isReg = state.stat.subMode !== '1-VAR';
    const isQuad = state.stat.subMode === '_+CX2';
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:Σx²</span>
          <span>2:Σx</span>
          {isReg && <span>3:Σy²</span>}
          {isReg && <span>4:Σy</span>}
          {isReg && <span>5:Σxy</span>}
          {isQuad && <span>6:Σx³</span>}
          {isQuad && <span>7:Σx²y</span>}
          {isQuad && <span>8:Σx⁴</span>}
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

  if (screen === 'stat-sub-distr') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:P(</span>
          <span>2:Q(</span>
          <span>3:R(</span>
          <span>4:▸t</span>
        </div>
      </div>
    );
  }

  if (screen === 'stat-sub-reg') {
    const isQuad = state.stat.subMode === '_+CX2';
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-menu-grid">
          <span>1:A</span>
          <span>2:B</span>
          <span>{isQuad ? '3:C' : '3:r'}</span>
          <span>{isQuad ? '4:x̂₁' : '4:x̂'}</span>
          <span>{isQuad ? '5:x̂₂' : '5:ŷ'}</span>
          {isQuad && <span>6:ŷ</span>}
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
        {menuPage === 0 ? (
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
        ) : (
          <div className="lcd-menu-grid">
            <span>1:Ref</span>
            <span>2:Rref</span>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'vector-target-menu') {
    return (
      <div className="lcd-menu" data-testid="lcd-menu" dir="ltr">
        <div className="lcd-prompt-title">{state.vector.dimAction === 'define' ? 'Vector?' : 'Edit Vector?'}</div>
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
          <span>8:Angle</span>
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
          {state.dist && state.dist.subMode !== 'norm-cd' && state.dist.subMode !== 'inv-norm' && (
            <span>8:{state.dist.listMode ? 'Var' : 'List'}</span>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function renderNormalInteractiveBody(state: CalculatorState): React.ReactElement | null {
  const lineMode = state.ioMode === 'Line';

  // CALC variable prompt
  if (state.calcPrompt) {
    const varName = state.calcPrompt.vars[state.calcPrompt.index] ?? 'X';
    const currentStored = formatDecimal(deserialize(state.variables[varName]), state.numberFormat, state.decimalMark);
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

  // SOLVE prompt & 3-line Calcios SOLVE result
  if (state.solvePrompt) {
    if (state.solvePrompt.stage === 'prompt-x') {
      const xCurrent = formatDecimal(deserialize(state.variables.X), state.numberFormat, state.decimalMark);
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

    if (state.solvePrompt.stage === 'solved' && state.solvePrompt.root && state.solvePrompt.residual) {
      const xVal = formatDecimal(deserialize(state.solvePrompt.root), state.numberFormat, state.decimalMark);
      const lrVal = formatDecimal(deserialize(state.solvePrompt.residual), state.numberFormat, state.decimalMark);
      return (
        <div className="lcd-home" dir="ltr">
          <div className="lcd-expr-area" data-testid="lcd-expression">
            <NaturalExpression expression={state.solvePrompt.sourceExpr} cursor={null} lineMode={lineMode} />
          </div>
          <div className="lcd-result-area" data-testid="lcd-result">
            <NaturalResult
              display={{ type: 'pair', label1: 'X', value1: xVal, label2: 'L−R', value2: lrVal }}
              lineMode={lineMode}
            />
          </div>
        </div>
      );
    }
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
                {isCurRow && st.colIdx === 0 && st.editingCell
                  ? st.cellInput
                  : row
                    ? formatGridCellValue(row.x, state.numberFormat, state.decimalMark)
                    : '—'}
              </span>
              {hasY && (
                <span className={isCurRow && st.colIdx === 1 ? 'cell-focus' : undefined}>
                  {isCurRow && st.colIdx === 1 && st.editingCell
                    ? st.cellInput
                    : row
                      ? formatGridCellValue(row.y ?? '0', state.numberFormat, state.decimalMark)
                      : '—'}
                </span>
              )}
              {st.useFreq && (
                <span className={isCurRow && st.colIdx === (hasY ? 2 : 1) ? 'cell-focus' : undefined}>
                  {isCurRow && st.colIdx === (hasY ? 2 : 1) && st.editingCell
                    ? st.cellInput
                    : row
                      ? formatGridCellValue(row.freq, state.numberFormat, state.decimalMark)
                      : '—'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // MATRIX Cell Editor or MatAns Result Grid (with D-pad navigation & exact bottom-right cell readout!)
  if (state.mode === 'MATRIX' && (state.matrix.editingTarget || state.matrix.showingMatrixResult)) {
    const targetName = state.matrix.editingTarget ?? 'MatAns';
    const mat = state.matrix.matrices[targetName];
    const isEditing = state.matrix.editingTarget !== null;
    if (mat) {
      const curR = Math.min(mat.rows - 1, state.matrix.rowIdx);
      const curC = Math.min(mat.cols - 1, state.matrix.colIdx);
      const activeCellScalar = deserialize(mat.cells[curR][curC]);
      const activeCellExact = formatResult(activeCellScalar, isEditing ? 'exact' : state.resultFormat, {
        fractionStyle: state.fractionStyle,
        numberFormat: state.numberFormat,
        decimalMark: state.decimalMark,
      });
      return (
        <div className="lcd-table-view" data-testid="lcd-matrix-grid" dir="ltr">
          <div className="lcd-prompt-title">
            {targetName} [{mat.rows}×{mat.cols}] ({curR + 1},{curC + 1})
          </div>
          {mat.cells.map((rCells, r) => (
            <div key={r} className="lcd-mat-row">
              {rCells.map((cell, c) => {
                const focused = r === curR && c === curC;
                const valStr =
                  isEditing && focused && state.matrix.editingCell
                    ? state.matrix.cellInput
                    : formatDecimal(deserialize(cell), state.numberFormat, state.decimalMark);
                return (
                  <span key={c} className={focused ? 'lcd-mat-cell focused' : 'lcd-mat-cell'}>
                    {valStr}
                  </span>
                );
              })}
            </div>
          ))}
          {!state.matrix.editingCell && (
            <div className="lcd-cell-readout">
              <NaturalResult display={activeCellExact} lineMode={lineMode} />
            </div>
          )}
        </div>
      );
    }
  }

  // VECTOR Coordinate Editor or VctAns Result (with D-pad navigation & exact readout!)
  if (state.mode === 'VECTOR' && (state.vector.editingTarget || state.vector.showingVectorResult)) {
    const targetName = state.vector.editingTarget ?? 'VctAns';
    const vct = state.vector.vectors[targetName];
    const isEditing = state.vector.editingTarget !== null;
    if (vct) {
      const curIdx = Math.min(vct.dim - 1, state.vector.coordIdx);
      const activeScalar = deserialize(vct.coords[curIdx]);
      const activeExact = formatResult(activeScalar, isEditing ? 'exact' : state.resultFormat, {
        fractionStyle: state.fractionStyle,
        numberFormat: state.numberFormat,
        decimalMark: state.decimalMark,
      });
      return (
        <div className="lcd-table-view" data-testid="lcd-vector-grid" dir="ltr">
          <div className="lcd-prompt-title">
            {targetName} [{vct.dim}] ({curIdx + 1})
          </div>
          <div className="lcd-mat-row">
            {vct.coords.map((cell, idx) => {
              const focused = idx === curIdx;
              const valStr =
                isEditing && focused && state.vector.editingCell
                  ? state.vector.cellInput
                  : formatDecimal(deserialize(cell), state.numberFormat, state.decimalMark);
              return (
                <span key={idx} className={focused ? 'lcd-mat-cell focused' : 'lcd-mat-cell'}>
                  {valStr}
                </span>
              );
            })}
          </div>
          {!state.vector.editingCell && (
            <div className="lcd-cell-readout">
              <NaturalResult display={activeExact} lineMode={lineMode} />
            </div>
          )}
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
      const disp = item ? formatActiveEqnItemDisplay(state, item) : { type: 'text' as const, text: '0' };
      const partPrefix =
        item?.complexParts && eqn.partView === 're'
          ? ' (Re)'
          : item?.complexParts && eqn.partView === 'im'
            ? ' (Im)'
            : '';
      return (
        <div className="lcd-home" dir="ltr">
          <div className="lcd-expr-area">
            <span className="lcd-eqn-res-label">{item?.label}{partPrefix} =</span>
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
    const chipStart = Math.max(0, Math.min(eqn.cursorIndex - 2, Math.max(0, names.length - 6)));
    const visibleNames = names.slice(chipStart, chipStart + 6);
    return (
      <div className="lcd-eqn-editor" dir="ltr">
        <div className="lcd-eqn-header">
          {EQN_LABELS[eqn.type]} — {activeName}?
        </div>
        <div className="lcd-eqn-coeffs">
          {visibleNames.map((nm, localIdx) => {
            const idx = chipStart + localIdx;
            return (
              <span key={nm} className={idx === eqn.cursorIndex ? 'eqn-chip active' : 'eqn-chip'}>
                {nm}={formatDecimal(deserialize(eqn.coeffs[idx]), state.numberFormat, state.decimalMark)}
              </span>
            );
          })}
        </div>
        <div className="lcd-expr-area">
          <NaturalExpression
            expression={
              eqn.editingCell
                ? eqn.input
                : formatDecimal(deserialize(eqn.coeffs[eqn.cursorIndex]), state.numberFormat, state.decimalMark)
            }
            cursor={eqn.editingCell ? eqn.input.length : null}
            overwrite={!state.insertMode}
            lineMode={lineMode}
          />
        </div>
      </div>
    );
  }

  // INEQ Mode Editor & 2D 2D Natural Math Solution (matching Calcios LCD layout!)
  if (state.mode === 'INEQ' && state.ineq) {
    const ineq = state.ineq;
    if (ineq.solved) {
      const richDisp = formatActiveInequalityDisplay(state) ?? { type: 'text' as const, text: '' };
      const topHeader = richDisp.type === 'ineq-2d' ? richDisp.header : 'Inequality:';
      return (
        <div className="lcd-home" dir="ltr">
          <div className="lcd-expr-area" data-testid="lcd-expression">
            <span className="lcd-eqn-res-label">{topHeader}</span>
          </div>
          <div className="lcd-result-area" data-testid="lcd-result">
            <NaturalResult display={richDisp} lineMode={lineMode} />
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
              {nm}={formatDecimal(deserialize(ineq.coeffs[idx]), state.numberFormat, state.decimalMark)}
            </span>
          ))}
        </div>
        <div className="lcd-expr-area">
          <NaturalExpression
            expression={
              ineq.editingCell
                ? ineq.input
                : formatDecimal(deserialize(ineq.coeffs[ineq.cursorIndex]), state.numberFormat, state.decimalMark)
            }
            cursor={ineq.editingCell ? ineq.input.length : null}
            overwrite={!state.insertMode}
            lineMode={lineMode}
          />
        </div>
      </div>
    );
  }

  // DIST Mode Parameter Editor & Probability Result (supports both Var and dynamic List!)
  if (state.mode === 'DIST' && state.dist) {
    const ds = state.dist;
    if (ds.listResults) {
      const startRow = Math.max(0, Math.min(ds.listRowIdx - 1, Math.max(0, ds.listResults.length - 3)));
      const visibleIndices = Array.from(
        { length: Math.min(3, ds.listResults.length - startRow) },
        (_, i) => startRow + i,
      );
      return (
        <div className="lcd-table-view" data-testid="lcd-result" dir="ltr">
          <div className="lcd-table-head">
            <span>#</span>
            <span>x</span>
            <span>P</span>
          </div>
          {visibleIndices.map((idx) => {
            const row = ds.listResults![idx];
            return (
              <div key={idx} className={idx === ds.listRowIdx ? 'lcd-table-row active' : 'lcd-table-row'}>
                <span>{idx + 1}</span>
                <span>{row.x}</span>
                <span>{row.p}</span>
              </div>
            );
          })}
        </div>
      );
    }
    if (ds.result) {
      const disp = formatResult(deserialize(ds.result), 'decimal', {
        fractionStyle: state.fractionStyle,
        numberFormat: state.numberFormat,
        override: state.displayOverride,
        engExponent: state.engExponent,
        decimalMark: state.decimalMark,
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
    if (ds.listMode && ds.editingListTable) {
      const totalSlots = Math.min(40, ds.listX.length + 1);
      const startRow = Math.max(0, Math.min(ds.paramIdx - 1, Math.max(0, totalSlots - 3)));
      const visibleIndices = Array.from({ length: Math.min(3, totalSlots - startRow) }, (_, i) => startRow + i);
      return (
        <div className="lcd-table-view" data-testid="lcd-dist-editor" dir="ltr">
          <div className="lcd-table-head">
            <span>#</span>
            <span>x ({DIST_TITLES[ds.subMode]} · List)</span>
          </div>
          {visibleIndices.map((rIdx) => {
            const val = ds.listX[rIdx];
            const active = rIdx === ds.paramIdx;
            return (
              <div key={`dlx-${rIdx}`} className={active ? 'lcd-table-row active' : 'lcd-table-row'}>
                <span>{rIdx + 1}</span>
                <span className={active ? 'cell-focus' : undefined}>
                  {active && ds.editingParam
                    ? ds.input
                    : val !== undefined
                      ? formatGridCellValue(val, state.numberFormat, state.decimalMark)
                      : '—'}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return (
      <div className="lcd-table-view" data-testid="lcd-dist-editor" dir="ltr">
        <div className="lcd-prompt-title">
          {DIST_TITLES[ds.subMode]} [{ds.listMode ? 'List' : 'Var'}]
        </div>
        {ds.params.map((p, i) => {
          const active = i === ds.paramIdx;
          return (
            <div key={p.name} className={active ? 'lcd-table-row active' : 'lcd-table-row'}>
              <span>{p.name}</span>
              <span className={active ? 'cell-focus' : undefined}>
                {active && ds.editingParam
                  ? ds.input
                  : formatGridCellValue(p.value, state.numberFormat, state.decimalMark)}
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
            <NaturalExpression
              expression={val}
              cursor={tbl.editingField ? val.length : null}
              overwrite={!state.insertMode}
              lineMode={lineMode}
            />
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
  const contrastOpacity = (0.45 + state.contrast * 0.055).toFixed(3);
  const glassStyle = { '--lcd-contrast-alpha': contrastOpacity } as React.CSSProperties;

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
        <div className="lcd-glass" style={glassStyle} data-testid="lcd-screen">
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
        <div className="lcd-glass" style={glassStyle} data-testid="lcd-screen">
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
        <div className="lcd-glass" style={glassStyle} data-testid="lcd-screen">
          <LcdStatusBar state={state} />
          {interactiveNode}
        </div>
      </div>
    );
  }

  const cmplxRich = state.mode === 'CMPLX' ? formatActiveComplexDisplay(state) : null;
  const display = cmplxRich ? cmplxRich.value : formatActiveResult(state) ?? { type: 'text' as const, text: '' };
  const lineMode = state.ioMode === 'Line' || state.mode === 'BASE-N';

  return (
    <div className="lcd-bezel">
      <div className="lcd-glass" style={glassStyle} data-testid="lcd-screen">
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
            {display.type === 'text' && display.text === '' ? null : cmplxRich?.partLabel ? (
              <div className="lcd-cmplx-part-row" dir="ltr">
                <span className="lcd-cmplx-part-label">{cmplxRich.partLabel}</span>
                <NaturalResult display={display} lineMode={lineMode} />
              </div>
            ) : (
              <NaturalResult display={display} lineMode={lineMode} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
