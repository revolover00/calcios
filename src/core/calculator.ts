import { evaluateBaseN, formatBaseN, type BaseMode } from './basen';
import { solveRoot } from './calculus';
import {
  argComplex, absComplex, deserializeComplex, evaluateComplex, formatComplex2D, formatComplexDisplay,
  serializeComplex, zeroStoredComplex,
  type ComplexFormat, type StoredComplex,
} from './cmplx';
import { CONSTANT_BY_CODE, CONVERSION_BY_CODE, SCIENTIFIC_CONSTANTS, UNIT_CONVERSIONS } from './constants';
import {
  binomialCd, binomialPd, inverseNormal, normalCd, normalPd, poissonCd, poissonPd,
  type DistSubMode,
} from './dist';
import { solveEqn, type EqnOutcome, type EqnType } from './eqn';
import { CalculatorError } from './errors';
import {
  STAT_TOKEN_LABELS, evaluateExpression, evaluateRichExpression, extractVariables,
  parseAssignmentStatement, splitEquation, splitStatements,
} from './expression';
import {
  extractTrailingOperandSpan, handleSmartCloseParen, isInsideTemplateSlot, isSafeOverwriteAt,
  moveCursorHorizontal, moveCursorVertical, smartDeleteBeforeCursor,
} from './mathAst';
import {
  DEFAULT_NUMBER_FORMAT, defaultResultFormat, formatDecimal, formatResult, initialEngExponent,
  type DecimalMark, type DisplayOverride, type DisplayValue, type FractionStyle,
  type NumberFormatSetting, type ResultFormat,
} from './format';
import {
  formatInequalityDisplay, formatInequalityResult, solveInequality,
  type IneqDegree, type IneqRelation,
} from './ineq';
import {
  createZeroMatrix, evaluateMatrixExpression, serializeMatrix,
  type MatrixName, type StoredMatrix,
} from './matrix';
import { computeStatSummary, type StatRow, type StatSubMode } from './stat';
import { computeRecurringDecimal } from './symbolic';
import { generateFunctionTable, type TableRow } from './table';
import {
  VARIABLES, add, deserialize, primeFactorize, roundScalar, scalarFromInteger, serialize, subtract, zeroStored,
  type AngleUnit, type StoredScalar, type VariableName,
} from './value';
import {
  createZeroVector, evaluateVectorExpression, serializeVector,
  type StoredVector, type VectorName,
} from './vector';
import { evaluateVerification } from './verif';

export type Phase = 'editing' | 'result' | 'error';
export type ActiveMode =
  | 'COMP'
  | 'CMPLX'
  | 'STAT'
  | 'BASE-N'
  | 'EQN'
  | 'MATRIX'
  | 'TABLE'
  | 'VECTOR'
  | 'INEQ'
  | 'VERIF'
  | 'DIST';

export type IoMode = 'Math' | 'Line';
export type MathOutputMode = 'MathO' | 'LineO';

export type ScreenView =
  | 'normal'
  | 'mode'
  | 'setup'
  | 'setup-matho'
  | 'setup-fix'
  | 'setup-sci'
  | 'setup-norm'
  | 'setup-cmplx'
  | 'setup-disp'
  | 'setup-table'
  | 'setup-stat-freq'
  | 'setup-recur'
  | 'setup-contrast'
  | 'drg'
  | 'const-picker'
  | 'conv-picker'
  | 'cmplx-menu'
  | 'basen-menu'
  | 'stat-type-menu'
  | 'stat-menu'
  | 'stat-sub-sum'
  | 'stat-sub-var'
  | 'stat-sub-reg'
  | 'stat-sub-distr'
  | 'stat-sub-minmax'
  | 'matrix-target-menu'
  | 'matrix-dim-menu'
  | 'matrix-menu'
  | 'vector-target-menu'
  | 'vector-dim-menu'
  | 'vector-menu'
  | 'ineq-deg-menu'
  | 'ineq-rel-menu'
  | 'verif-menu'
  | 'dist-menu'
  | 'clear'
  | 'clear-confirm'
  | 'eqn-menu'
  | 'off';

export interface HistoryEntry { expression: string; result: StoredScalar }

export interface CalcPromptState {
  sourceExpr: string;
  vars: VariableName[];
  index: number;
  input: string;
}

export interface SolvePromptState {
  sourceExpr: string;
  stage: 'prompt-x' | 'solved';
  input: string;
  root?: StoredScalar;
  residual?: StoredScalar;
}

export interface EqnState {
  type: EqnType;
  coeffs: StoredScalar[];
  cursorIndex: number;
  input: string;
  editingCell: boolean;
  outcome: EqnOutcome | null;
  solutionIndex: number;
}

export interface IneqState {
  degree: IneqDegree;
  relation: IneqRelation;
  coeffs: StoredScalar[];
  cursorIndex: number;
  input: string;
  editingCell: boolean;
  solved: boolean;
}

export interface TableModeState {
  stage: 'f' | 'g' | 'start' | 'end' | 'step' | 'view';
  fExpr: string;
  gExpr: string;
  startInput: string;
  endInput: string;
  stepInput: string;
  editingField: boolean;
  rows: TableRow[];
  selectedRow: number;
}

export interface BaseNState {
  base: BaseMode;
  ans: string;
  result: string | null;
}

export interface CmplxModeState {
  ans: StoredComplex;
  result: StoredComplex | null;
  format: ComplexFormat;
  partView: 'both' | 'first' | 'second';
}

export interface StatModeState {
  subMode: StatSubMode;
  useFreq: boolean;
  editingTable: boolean;
  rows: StatRow[];
  rowIdx: number;
  colIdx: number;
  cellInput: string;
  editingCell: boolean;
}

export interface MatrixModeState {
  matrices: Record<MatrixName, StoredMatrix | null>;
  editingTarget: MatrixName | null;
  dimAction: 'define' | 'edit';
  pendingTarget: 'MatA' | 'MatB' | 'MatC';
  rowIdx: number;
  colIdx: number;
  cellInput: string;
  editingCell: boolean;
  showingMatrixResult: boolean;
}

export interface VectorModeState {
  vectors: Record<VectorName, StoredVector | null>;
  editingTarget: VectorName | null;
  dimAction: 'define' | 'edit';
  pendingTarget: 'VctA' | 'VctB' | 'VctC';
  coordIdx: number;
  cellInput: string;
  editingCell: boolean;
  showingVectorResult: boolean;
}

export interface DistModeState {
  subMode: DistSubMode;
  listMode: boolean;
  editingListTable: boolean;
  listX: string[];
  listResults: Array<{ x: string; p: string }> | null;
  listRowIdx: number;
  params: Array<{ name: string; value: string }>;
  paramIdx: number;
  input: string;
  editingParam: boolean;
  result: StoredScalar | null;
}

export interface CalculatorState {
  mode: ActiveMode;
  ioMode: IoMode;
  mathOutputMode: MathOutputMode;
  decimalMark: DecimalMark;
  defaultCmplxFormat: ComplexFormat;
  recurEnabled: boolean;
  contrast: number;
  insertMode: boolean;
  expression: string;
  cursor: number;
  phase: Phase;
  result: StoredScalar | null;
  pairResult: DisplayValue | null;
  verifResult: boolean | null;
  resultFormat: ResultFormat;
  fractionStyle: FractionStyle;
  defaultFractionStyle: FractionStyle;
  displayOverride: DisplayOverride;
  engExponent: number | null;
  factoredText: string | null;
  numberFormat: NumberFormatSetting;
  tableUseG: boolean;
  error: CalculatorError['kind'] | null;
  errorCursor: number | null;
  angle: AngleUnit;
  shift: boolean;
  alpha: boolean;
  hyp: boolean;
  pending: 'store' | 'recall' | null;
  screen: ScreenView;
  menuPage: 0 | 1;
  codeDigits: string;
  pickerIndex: number;
  clearTarget: 'setup' | 'memory' | 'all' | null;
  variables: Record<VariableName, StoredScalar>;
  ans: StoredScalar;
  preAns: StoredScalar;
  history: HistoryEntry[];
  historyIndex: number | null;
  statementRun: { statements: string[]; index: number } | null;
  calcPrompt: CalcPromptState | null;
  solvePrompt: SolvePromptState | null;
  eqn: EqnState | null;
  ineq: IneqState | null;
  table: TableModeState | null;
  baseN: BaseNState;
  cmplx: CmplxModeState;
  stat: StatModeState;
  matrix: MatrixModeState;
  vector: VectorModeState;
  dist: DistModeState | null;
  notice: string | null;
}

export type CalculatorAction =
  | { type: 'key'; id: string; random?: number }
  | { type: 'insert-token'; token: string; behavior?: 'fresh' | 'continue' }
  | { type: 'select-mode'; mode: string }
  | { type: 'angle'; angle: AngleUnit }
  | { type: 'load-scanned-math'; expression: string; mode?: 'COMP' | 'CMPLX'; angle?: AngleUnit }
  | { type: 'clear-notice' };

function zeroVariables(): Record<VariableName, StoredScalar> {
  return Object.fromEntries(VARIABLES.map((v) => [v, zeroStored()])) as Record<VariableName, StoredScalar>;
}

function createDefaultBaseN(): BaseNState {
  return { base: 'DEC', ans: '0', result: null };
}

function createDefaultCmplx(format: ComplexFormat = 'rect'): CmplxModeState {
  return { ans: zeroStoredComplex(), result: null, format, partView: 'both' };
}

function createDefaultStat(subMode: StatSubMode = '1-VAR', useFreq = false): StatModeState {
  return {
    subMode,
    useFreq,
    editingTable: true,
    rows: [],
    rowIdx: 0,
    colIdx: 0,
    cellInput: '',
    editingCell: false,
  };
}

function createDefaultMatrix(): MatrixModeState {
  return {
    matrices: { MatA: null, MatB: null, MatC: null, MatAns: null },
    editingTarget: null,
    dimAction: 'define',
    pendingTarget: 'MatA',
    rowIdx: 0,
    colIdx: 0,
    cellInput: '',
    editingCell: false,
    showingMatrixResult: false,
  };
}

function createDefaultVector(): VectorModeState {
  return {
    vectors: { VctA: null, VctB: null, VctC: null, VctAns: null },
    editingTarget: null,
    dimAction: 'define',
    pendingTarget: 'VctA',
    coordIdx: 0,
    cellInput: '',
    editingCell: false,
    showingVectorResult: false,
  };
}

function createEqnState(type: EqnType): EqnState {
  const count = type === 'lin2' ? 6 : type === 'lin3' ? 12 : type === 'quad' ? 3 : 4;
  return {
    type,
    coeffs: Array.from({ length: count }, () => zeroStored()),
    cursorIndex: 0,
    input: '',
    editingCell: false,
    outcome: null,
    solutionIndex: 0,
  };
}

function createIneqState(degree: IneqDegree, relation: IneqRelation): IneqState {
  const count = degree === 2 ? 3 : 4;
  return {
    degree,
    relation,
    coeffs: Array.from({ length: count }, () => zeroStored()),
    cursorIndex: 0,
    input: '',
    editingCell: false,
    solved: false,
  };
}

function createTableState(): TableModeState {
  return {
    stage: 'f',
    fExpr: '',
    gExpr: '',
    startInput: '1',
    endInput: '5',
    stepInput: '1',
    editingField: false,
    rows: [],
    selectedRow: 0,
  };
}

function createDistState(subMode: DistSubMode, listMode = false): DistModeState {
  const paramDefs: Record<DistSubMode, Array<{ name: string; value: string }>> = {
    'norm-pd': [{ name: 'x', value: '0' }, { name: 'σ', value: '1' }, { name: 'μ', value: '0' }],
    'norm-cd': [{ name: 'Lower', value: '-1' }, { name: 'Upper', value: '1' }, { name: 'σ', value: '1' }, { name: 'μ', value: '0' }],
    'inv-norm': [{ name: 'Area', value: '0.5' }, { name: 'σ', value: '1' }, { name: 'μ', value: '0' }],
    'binom-pd': [{ name: 'x', value: '2' }, { name: 'N', value: '5' }, { name: 'p', value: '0.5' }],
    'binom-cd': [{ name: 'x', value: '2' }, { name: 'N', value: '5' }, { name: 'p', value: '0.5' }],
    'poisson-pd': [{ name: 'x', value: '2' }, { name: 'λ', value: '3' }],
    'poisson-cd': [{ name: 'x', value: '2' }, { name: 'λ', value: '3' }],
  };
  const supportsList = subMode !== 'norm-cd' && subMode !== 'inv-norm';
  const useList = supportsList && listMode;
  return {
    subMode,
    listMode: useList,
    editingListTable: useList,
    listX: [],
    listResults: null,
    listRowIdx: 0,
    params: useList ? paramDefs[subMode].slice(1) : paramDefs[subMode],
    paramIdx: 0,
    input: '',
    editingParam: false,
    result: null,
  };
}

export function createInitialState(): CalculatorState {
  return {
    mode: 'COMP',
    ioMode: 'Math',
    mathOutputMode: 'MathO',
    decimalMark: 'Dot',
    defaultCmplxFormat: 'rect',
    recurEnabled: true,
    contrast: 5,
    insertMode: true,
    expression: '',
    cursor: 0,
    phase: 'editing',
    result: null,
    pairResult: null,
    verifResult: null,
    resultFormat: 'exact',
    fractionStyle: 'improper',
    defaultFractionStyle: 'improper',
    displayOverride: 'none',
    engExponent: null,
    factoredText: null,
    numberFormat: DEFAULT_NUMBER_FORMAT,
    tableUseG: true,
    error: null,
    errorCursor: null,
    angle: 'DEG',
    shift: false,
    alpha: false,
    hyp: false,
    pending: null,
    screen: 'normal',
    menuPage: 0,
    codeDigits: '',
    pickerIndex: 0,
    clearTarget: null,
    variables: zeroVariables(),
    ans: zeroStored(),
    preAns: zeroStored(),
    history: [],
    historyIndex: null,
    statementRun: null,
    calcPrompt: null,
    solvePrompt: null,
    eqn: null,
    ineq: null,
    table: null,
    baseN: createDefaultBaseN(),
    cmplx: createDefaultCmplx(),
    stat: createDefaultStat(),
    matrix: createDefaultMatrix(),
    vector: createDefaultVector(),
    dist: null,
    notice: null,
  };
}

const ALPHA_KEYS: Record<string, VariableName> = {
  neg: 'A', dms: 'B', hyp: 'C', sin: 'D', cos: 'E', tan: 'F', close: 'X', sd: 'Y', mplus: 'M',
};
const BASEN_HEX_KEYS: Record<string, string> = {
  neg: 'A', dms: 'B', hyp: 'C', sin: 'D', cos: 'E', tan: 'F',
};

const modeNames: ActiveMode[] = ['COMP', 'CMPLX', 'STAT', 'BASE-N', 'EQN', 'MATRIX', 'TABLE', 'VECTOR'];
const extraModes: ActiveMode[] = ['INEQ', 'VERIF', 'DIST'];

const ONE_DIM_ATOMIC_TOKENS = [
  ...Object.keys(STAT_TOKEN_LABELS),
  'MatAns', 'MatA', 'MatB', 'MatC', 'VctAns', 'VctA', 'VctB', 'VctC',
  'Conjg(', 'Angle(', 'Rref(', 'Ref(', 'arg(', 'det(', 'Trn(',
  'StatP(', 'StatQ(', 'StatR(', 'Intg(', 'GCD(', 'LCM(', 'Int(',
  '▸xhat2', '▸Simp', '▸r∠θ', '▸a+bi', '▸yhat', '▸xhat', '▸t', '÷R',
  'RanInt(', 'asinh(', 'acosh(', 'atanh(',
  'sinh(', 'cosh(', 'tanh(', 'asin(', 'acos(', 'atan(',
  'Pol(', 'Rec(', 'Rnd(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(',
  'Not(', 'Neg(', '×10^(', 'PreAns', '^(-1)', '^2', '^3',
  'xnor', 'and', 'xor', 'or', 'dot', 'nCr', 'nPr', 'Ans', '⏨',
].sort((a, b) => b.length - a.length);

const LINE_ONLY_2D_TOKENS = [
  'mfrac(', 'deriv(', 'integ(', 'sigma(', 'prod(',
  'logb(', 'sqrt(', 'cbrt(', 'frac(', 'root(', 'abs(', '10^(', 'e^(', 'r(',
];

const LINE_ATOMIC_TOKENS = [...ONE_DIM_ATOMIC_TOKENS, ...LINE_ONLY_2D_TOKENS].sort((a, b) => b.length - a.length);

function isLineModeState(s: CalculatorState): boolean {
  return s.ioMode === 'Line' || s.mode === 'BASE-N';
}

function findAtomicSpans(source: string, lineMode = false): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const table = lineMode ? LINE_ATOMIC_TOKENS : ONE_DIM_ATOMIC_TOKENS;
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    const cMatch = rest.match(/^(?:const|▸conv)(?:0[1-9]|[1-3]\d|40)/);
    if (cMatch) {
      spans.push([i, i + cMatch[0].length]);
      i += cMatch[0].length;
      continue;
    }
    const atom = table.find((t) => rest.startsWith(t));
    if (atom) {
      spans.push([i, i + atom.length]);
      i += atom.length;
      continue;
    }
    i++;
  }
  return spans;
}

function stepCursor(source: string, cursor: number, dir: -1 | 1, lineMode = false): number {
  return moveCursorHorizontal(source, cursor, dir, lineMode, findAtomicSpans(source, lineMode));
}

function deleteBeforeCursor(
  source: string,
  cursor: number,
  lineMode = false,
): { expression: string; cursor: number } {
  return smartDeleteBeforeCursor(source, cursor, lineMode, findAtomicSpans(source, lineMode));
}

function closeLatches(s: CalculatorState): CalculatorState {
  return { ...s, shift: false, alpha: false, notice: null };
}
function withNotice(s: CalculatorState, notice: string): CalculatorState {
  return { ...s, shift: false, alpha: false, hyp: false, notice };
}

function resetResultModifiers(s: CalculatorState): CalculatorState {
  return {
    ...s,
    pairResult: null,
    verifResult: null,
    displayOverride: 'none',
    engExponent: null,
    factoredText: null,
    errorCursor: null,
    statementRun: null,
    cmplx: { ...s.cmplx, result: null, partView: 'both' },
    matrix: { ...s.matrix, showingMatrixResult: false },
    vector: { ...s.vector, showingVectorResult: false },
  };
}

function insert(
  s: CalculatorState,
  text: string,
  behavior: 'fresh' | 'continue' = 'fresh',
  caretOffset = text.length,
): CalculatorState {
  let expression = s.expression;
  let cursor = s.cursor;
  if (s.phase !== 'editing') {
    if (s.phase === 'result' && behavior === 'continue') {
      expression = s.mode === 'MATRIX' && s.matrix.showingMatrixResult
        ? 'MatAns'
        : s.mode === 'VECTOR' && s.vector.showingVectorResult
          ? 'VctAns'
          : 'Ans';
    } else {
      expression = '';
    }
    cursor = expression.length;
  }
  if (expression.length + text.length > 300) {
    return withNotice(s, 'Input limit reached.');
  }
  const canOverwrite =
    !s.insertMode &&
    s.phase === 'editing' &&
    caretOffset === text.length &&
    cursor < expression.length &&
    isSafeOverwriteAt(expression, cursor, isLineModeState(s));
  const replaceCount = canOverwrite ? 1 : 0;
  const nextExpr = expression.slice(0, cursor) + text + expression.slice(cursor + replaceCount);
  return {
    ...resetResultModifiers(s),
    expression: nextExpr,
    cursor: cursor + caretOffset,
    phase: 'editing',
    result: null,
    error: null,
    historyIndex: null,
    pending: null,
    shift: false,
    alpha: false,
    notice: null,
  };
}

function insertRecurringTemplate(s: CalculatorState): CalculatorState {
  const before = s.phase === 'editing' ? s.expression.slice(0, s.cursor) : '';
  const hasDecimalPrefix = /(?:\d+\.\d*|\.\d*)$/.test(before);
  if (hasDecimalPrefix) {
    return insert(s, 'r()', 'fresh', 2);
  }
  if (/\d+$/.test(before)) {
    return insert(s, '.r()', 'fresh', 3);
  }
  return insert(s, '0.r()', 'fresh', 4);
}

function functionTemplate(s: CalculatorState, name: string): CalculatorState {
  const lineMode = isLineModeState(s);
  if (!lineMode && s.phase === 'editing' && isInsideTemplateSlot(s.expression, s.cursor, false)) {
    const text = `${name}()`;
    return insert(s, text, 'fresh', text.length - 1);
  }
  const text = `${name}(`;
  return insert(s, text, 'fresh', text.length);
}
function box1Template(s: CalculatorState, name: string): CalculatorState {
  if (isLineModeState(s)) return functionTemplate(s, name);
  const text = `${name}()`;
  return insert(s, text, 'fresh', text.length - 1);
}
function binaryTemplate(s: CalculatorState, name: string): CalculatorState {
  if (isLineModeState(s)) return functionTemplate(s, name);
  const text = `${name}(,)`;
  return insert(s, text, 'fresh', name.length + 1);
}
function ternaryTemplate(s: CalculatorState, name: string): CalculatorState {
  if (isLineModeState(s)) return functionTemplate(s, name);
  const text = `${name}(,,)`;
  return insert(s, text, 'fresh', name.length + 1);
}
function powerTemplate(s: CalculatorState, prefix: string): CalculatorState {
  if (isLineModeState(s)) {
    const text = `${prefix}(`;
    return insert(s, text, prefix === '^' ? 'continue' : 'fresh', text.length);
  }
  const text = `${prefix}()`;
  return insert(s, text, prefix === '^' ? 'continue' : 'fresh', text.length - 1);
}
function insertSmartFraction(s: CalculatorState): CalculatorState {
  if (isLineModeState(s)) return insert(s, '÷', 'continue');
  if (s.phase === 'result') {
    const base =
      s.mode === 'MATRIX' && s.matrix.showingMatrixResult
        ? 'MatAns'
        : s.mode === 'VECTOR' && s.vector.showingVectorResult
          ? 'VctAns'
          : 'Ans';
    const expr = `frac(${base},)`;
    return {
      ...resetResultModifiers(s),
      expression: expr,
      cursor: 5 + base.length + 1,
      phase: 'editing',
      result: null,
      error: null,
      historyIndex: null,
      pending: null,
      shift: false,
      alpha: false,
      notice: null,
    };
  }
  if (s.phase === 'editing') {
    const span = extractTrailingOperandSpan(s.expression, s.cursor);
    if (span) {
      const wrapped = `frac(${span.text},)`;
      const nextExpr = s.expression.slice(0, span.start) + wrapped + s.expression.slice(s.cursor);
      if (nextExpr.length <= 300) {
        return {
          ...resetResultModifiers(s),
          expression: nextExpr,
          cursor: span.start + 5 + span.text.length + 1,
          phase: 'editing',
          result: null,
          error: null,
          historyIndex: null,
          pending: null,
          shift: false,
          alpha: false,
          notice: null,
        };
      }
    }
  }
  return binaryTemplate(s, 'frac');
}
function insertSmartMixedFraction(s: CalculatorState): CalculatorState {
  if (isLineModeState(s)) return insert(s, '÷', 'continue');
  if (s.phase === 'editing') {
    const span = extractTrailingOperandSpan(s.expression, s.cursor);
    if (span) {
      const wrapped = `mfrac(${span.text},,)`;
      const nextExpr = s.expression.slice(0, span.start) + wrapped + s.expression.slice(s.cursor);
      if (nextExpr.length <= 300) {
        return {
          ...resetResultModifiers(s),
          expression: nextExpr,
          cursor: span.start + 6 + span.text.length + 1,
          phase: 'editing',
          result: null,
          error: null,
          historyIndex: null,
          pending: null,
          shift: false,
          alpha: false,
          notice: null,
        };
      }
    }
  }
  return ternaryTemplate(s, 'mfrac');
}

function effectiveResultFormat(s: CalculatorState, naturalFormat: ResultFormat): ResultFormat {
  if (s.ioMode === 'Line' || s.mathOutputMode === 'LineO') return 'decimal';
  return naturalFormat;
}

function errorState(s: CalculatorState, error: unknown): CalculatorState {
  if (!(error instanceof CalculatorError)) throw error;
  const boundedOffset =
    typeof error.offset === 'number'
      ? Math.max(0, Math.min(s.expression.length, error.offset))
      : null;
  return {
    ...resetResultModifiers(s),
    phase: 'error',
    result: null,
    error: error.kind,
    errorCursor: boundedOffset,
    pending: null,
    shift: false,
    alpha: false,
    hyp: false,
    calcPrompt: null,
    solvePrompt: null,
    notice: null,
  };
}

function evalContext(s: CalculatorState, random?: number) {
  let statContext: { subMode: StatSubMode; summary: ReturnType<typeof computeStatSummary> } | undefined;
  if (s.mode === 'STAT' && s.stat.rows.length > 0) {
    try {
      statContext = { subMode: s.stat.subMode, summary: computeStatSummary(s.stat.subMode, s.stat.rows) };
    } catch {
      statContext = undefined;
    }
  }
  return {
    angle: s.angle,
    variables: s.variables,
    ans: s.ans,
    preAns: s.preAns,
    random,
    numberFormat: s.numberFormat,
    statContext,
  };
}

function hasTopLevelDms(expr: string): boolean {
  let depth = 0;
  for (const ch of expr) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === '°' && depth === 0) return true;
  }
  return false;
}

function evaluateSingleStatement(
  s: CalculatorState,
  expr: string,
  recordExpr: string,
  random?: number,
): CalculatorState {
  const assign = parseAssignmentStatement(expr);
  const exprToEval = assign ? assign.rhs : expr;
  const outcome = evaluateRichExpression(exprToEval, evalContext(s, random));
  const primaryStored = serialize(outcome.primary);
  let variables = assign ? { ...s.variables, [assign.target]: primaryStored } : s.variables;
  let pairResult: DisplayValue | null = null;

  if (outcome.pairKind && outcome.secondary) {
    const secStored = serialize(outcome.secondary);
    if (outcome.pairKind === 'divr') {
      variables = { ...s.variables, E: primaryStored, F: secStored };
      pairResult = {
        type: 'pair',
        label1: 'Q',
        value1: formatDecimal(outcome.primary, s.numberFormat, s.decimalMark),
        label2: 'R',
        value2: formatDecimal(outcome.secondary, s.numberFormat, s.decimalMark),
      };
    } else {
      variables = { ...s.variables, X: primaryStored, Y: secStored };
      pairResult = {
        type: 'pair',
        label1: outcome.pairKind === 'pol' ? 'r' : 'X',
        value1: formatDecimal(outcome.primary, s.numberFormat, s.decimalMark),
        label2: outcome.pairKind === 'pol' ? 'θ' : 'Y',
        value2: formatDecimal(outcome.secondary, s.numberFormat, s.decimalMark),
      };
    }
  }

  const autoDms = !pairResult && hasTopLevelDms(exprToEval);
  const history = [...s.history, { expression: recordExpr, result: primaryStored }].slice(-40);
  return {
    ...resetResultModifiers(s),
    phase: 'result',
    result: primaryStored,
    pairResult,
    displayOverride: autoDms ? 'dms' : 'none',
    preAns: s.ans,
    ans: primaryStored,
    variables,
    resultFormat: effectiveResultFormat(s, defaultResultFormat(outcome.primary)),
    fractionStyle: s.defaultFractionStyle,
    error: null,
    shift: false,
    alpha: false,
    hyp: false,
    pending: null,
    history,
    historyIndex: null,
    notice: null,
  };
}

function calculate(s: CalculatorState, random?: number): CalculatorState {
  try {
    if (s.mode === 'BASE-N') {
      const prevAns = BigInt(s.baseN.ans);
      const val = evaluateBaseN(s.expression, s.baseN.base, prevAns);
      const serialized = val.toString();
      return {
        ...resetResultModifiers(s),
        phase: 'result',
        result: serialize(scalarFromInteger(val)),
        baseN: { ...s.baseN, ans: serialized, result: serialized },
        error: null,
        shift: false,
        alpha: false,
        hyp: false,
        pending: null,
        notice: null,
      };
    }

    if (s.mode === 'CMPLX') {
      const out = evaluateComplex(s.expression, {
        angle: s.angle,
        variables: s.variables,
        cmplxAns: s.cmplx.ans,
      });
      const storedZ = serializeComplex(out.value);
      return {
        ...resetResultModifiers(s),
        phase: 'result',
        result: storedZ.re,
        preAns: s.ans,
        ans: storedZ.re,
        resultFormat: effectiveResultFormat(s, 'exact'),
        cmplx: {
          ans: storedZ,
          result: storedZ,
          format: out.preferredFormat ?? s.defaultCmplxFormat,
          partView: 'both',
        },
        error: null,
        shift: false,
        alpha: false,
        hyp: false,
        pending: null,
        notice: null,
      };
    }

    if (s.mode === 'MATRIX') {
      const out = evaluateMatrixExpression(s.expression, {
        matrices: s.matrix.matrices,
        variables: s.variables,
        ans: s.ans,
        angle: s.angle,
      });
      if (out.kind === 'scalar') {
        const stored = serialize(out.scalar);
        return {
          ...resetResultModifiers(s),
          phase: 'result',
          result: stored,
          preAns: s.ans,
          ans: stored,
          resultFormat: effectiveResultFormat(s, defaultResultFormat(out.scalar)),
          error: null,
          shift: false,
          alpha: false,
        };
      }
      const storedMat = serializeMatrix(out.matrix);
      return {
        ...resetResultModifiers(s),
        phase: 'result',
        matrix: {
          ...s.matrix,
          matrices: { ...s.matrix.matrices, MatAns: storedMat },
          showingMatrixResult: true,
          rowIdx: 0,
          colIdx: 0,
        },
        error: null,
        shift: false,
        alpha: false,
      };
    }

    if (s.mode === 'VECTOR') {
      const out = evaluateVectorExpression(s.expression, {
        vectors: s.vector.vectors,
        variables: s.variables,
        ans: s.ans,
        angle: s.angle,
      });
      if (out.kind === 'scalar') {
        const stored = serialize(out.scalar);
        return {
          ...resetResultModifiers(s),
          phase: 'result',
          result: stored,
          preAns: s.ans,
          ans: stored,
          resultFormat: effectiveResultFormat(s, defaultResultFormat(out.scalar)),
          error: null,
          shift: false,
          alpha: false,
        };
      }
      const storedVct = serializeVector(out.vector);
      return {
        ...resetResultModifiers(s),
        phase: 'result',
        vector: {
          ...s.vector,
          vectors: { ...s.vector.vectors, VctAns: storedVct },
          showingVectorResult: true,
          coordIdx: 0,
        },
        error: null,
        shift: false,
        alpha: false,
      };
    }

    if (s.mode === 'VERIF') {
      const ok = evaluateVerification(s.expression, evalContext(s, random));
      return {
        ...resetResultModifiers(s),
        phase: 'result',
        verifResult: ok,
        error: null,
        shift: false,
        alpha: false,
      };
    }

    if (s.phase === 'result' && s.statementRun) {
      const nextIdx = s.statementRun.index + 1;
      if (nextIdx < s.statementRun.statements.length) {
        const stmt = s.statementRun.statements[nextIdx];
        const nextState = evaluateSingleStatement(s, stmt, stmt, random);
        const hasMore = nextIdx + 1 < s.statementRun.statements.length;
        return {
          ...nextState,
          expression: stmt,
          cursor: stmt.length,
          statementRun: hasMore ? { statements: s.statementRun.statements, index: nextIdx } : null,
        };
      }
    }

    const statements = splitStatements(s.expression).map((p) => p.trim()).filter(Boolean);
    if (statements.length > 1) {
      const first = statements[0];
      const nextState = evaluateSingleStatement(s, first, s.expression, random);
      return {
        ...nextState,
        statementRun: { statements, index: 0 },
      };
    }

    if (s.expression.includes('=')) {
      return startSolveWorkflow(s);
    }

    return evaluateSingleStatement(s, s.expression, s.expression, random);
  } catch (error) {
    return errorState(s, error);
  }
}

function currentValue(s: CalculatorState): StoredScalar {
  if (s.phase === 'result' && s.result) return s.result;
  if (!s.expression) return s.ans;
  return serialize(evaluateExpression(s.expression, evalContext(s)));
}

function updateMemory(s: CalculatorState, direction: 1 | -1): CalculatorState {
  try {
    const storedCurrent = currentValue(s);
    const current = deserialize(storedCurrent);
    const memory = deserialize(s.variables.M);
    const updated = direction === 1 ? add(memory, current) : subtract(memory, current);
    const wasEditing = s.phase === 'editing' && s.expression.trim().length > 0;
    return {
      ...s,
      phase: wasEditing ? 'result' : s.phase,
      result: wasEditing ? storedCurrent : s.result,
      resultFormat: wasEditing ? effectiveResultFormat(s, defaultResultFormat(current)) : s.resultFormat,
      preAns: wasEditing ? s.ans : s.preAns,
      ans: wasEditing ? storedCurrent : s.ans,
      variables: { ...s.variables, M: serialize(updated) },
      pending: null,
      shift: false,
      alpha: false,
    };
  } catch (error) {
    return errorState(s, error);
  }
}

function navigateHistory(s: CalculatorState, direction: 'up' | 'down'): CalculatorState {
  if (!s.history.length) return s;
  if (s.historyIndex === null) {
    if (direction === 'down') return s;
    if (s.phase === 'editing' && s.expression.length > 0) return s;
  }
  const index = s.historyIndex === null
    ? s.history.length - 1
    : s.historyIndex + (direction === 'up' ? -1 : 1);
  if (index >= s.history.length) {
    return { ...resetResultModifiers(s), expression: '', cursor: 0, phase: 'editing', result: null, error: null, historyIndex: null, notice: null };
  }
  const bounded = Math.max(0, index);
  const entry = s.history[bounded];
  return {
    ...resetResultModifiers(s),
    expression: entry.expression,
    cursor: entry.expression.length,
    phase: 'editing',
    result: null,
    error: null,
    historyIndex: bounded,
    notice: null,
  };
}

export function activateModeByName(s: CalculatorState, label: string): CalculatorState {
  const baseReset: CalculatorState = {
    ...resetResultModifiers(closeLatches(s)),
    screen: 'normal',
    menuPage: 0,
    phase: 'editing',
    expression: '',
    cursor: 0,
    result: null,
    error: null,
    calcPrompt: null,
    solvePrompt: null,
    eqn: null,
    ineq: null,
    table: null,
    dist: null,
    codeDigits: '',
  };
  switch (label) {
    case 'COMP':
      return { ...baseReset, mode: 'COMP' };
    case 'CMPLX':
      return { ...baseReset, mode: 'CMPLX', cmplx: createDefaultCmplx(s.defaultCmplxFormat) };
    case 'STAT':
      return { ...baseReset, mode: 'STAT', screen: 'stat-type-menu' };
    case 'BASE-N':
      return { ...baseReset, mode: 'BASE-N', baseN: createDefaultBaseN() };
    case 'EQN':
      return { ...baseReset, mode: 'EQN', screen: 'eqn-menu' };
    case 'MATRIX':
      return {
        ...baseReset,
        mode: 'MATRIX',
        matrix: { ...s.matrix, editingTarget: null, dimAction: 'define', showingMatrixResult: false },
        screen: 'matrix-target-menu',
      };
    case 'TABLE':
      return { ...baseReset, mode: 'TABLE', table: createTableState() };
    case 'VECTOR':
      return {
        ...baseReset,
        mode: 'VECTOR',
        vector: { ...s.vector, editingTarget: null, dimAction: 'define', showingVectorResult: false },
        screen: 'vector-target-menu',
      };
    case 'INEQ':
      return { ...baseReset, mode: 'INEQ', screen: 'ineq-deg-menu' };
    case 'VERIF':
      return { ...baseReset, mode: 'VERIF' };
    case 'DIST':
      return { ...baseReset, mode: 'DIST', screen: 'dist-menu' };
    default:
      return baseReset;
  }
}

function cancelMenuToSafeNormal(s: CalculatorState): CalculatorState {
  if (s.screen === 'matrix-target-menu' || s.screen === 'matrix-dim-menu') {
    return { ...closeLatches(s), screen: 'normal', menuPage: 0, matrix: { ...s.matrix, editingTarget: null } };
  }
  if (s.screen === 'vector-target-menu' || s.screen === 'vector-dim-menu') {
    return { ...closeLatches(s), screen: 'normal', menuPage: 0, vector: { ...s.vector, editingTarget: null } };
  }
  if (s.screen === 'stat-type-menu') {
    return { ...closeLatches(s), screen: 'normal', menuPage: 0, stat: { ...s.stat, editingTable: false } };
  }
  if ((s.mode === 'EQN' && !s.eqn) || (s.mode === 'INEQ' && !s.ineq) || (s.mode === 'DIST' && !s.dist)) {
    return { ...closeLatches(s), mode: 'COMP', screen: 'normal', menuPage: 0, eqn: null, ineq: null, dist: null };
  }
  return { ...closeLatches(s), screen: 'normal', menuPage: 0, clearTarget: null, codeDigits: '', notice: null };
}

function handleMenu(s: CalculatorState, id: string): CalculatorState {
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'ac') {
    if (s.shift) return { ...closeLatches(s), screen: 'off' };
    return cancelMenuToSafeNormal(s);
  }
  if (id === 'mode') {
    if (s.shift) {
      return s.screen === 'setup'
        ? cancelMenuToSafeNormal(s)
        : { ...closeLatches(s), screen: 'setup', menuPage: 0, clearTarget: null, codeDigits: '', notice: null };
    }
    return s.screen === 'mode'
      ? cancelMenuToSafeNormal(s)
      : { ...closeLatches(s), screen: 'mode', menuPage: 0, clearTarget: null, codeDigits: '', notice: null };
  }

  // MODE Menu (Page 0 & Page 1)
  if (s.screen === 'mode') {
    if (id === 'down' || id === 'right') return { ...s, menuPage: 1 };
    if (id === 'up' || id === 'left') return { ...s, menuPage: 0 };
    if (/^[1-8]$/.test(id)) {
      const label = s.menuPage === 0 ? modeNames[Number(id) - 1] : extraModes[Number(id) - 1];
      if (!label) return s;
      return activateModeByName(s, label);
    }
    return s;
  }

  // CONST Picker (SHIFT + 7)
  if (s.screen === 'const-picker') {
    if (id === 'down') return { ...s, pickerIndex: (s.pickerIndex + 1) % 40 };
    if (id === 'up') return { ...s, pickerIndex: (s.pickerIndex + 39) % 40 };
    if (id === 'del') return { ...s, codeDigits: s.codeDigits.slice(0, -1) };
    if (id === 'equals') {
      const chosen = SCIENTIFIC_CONSTANTS[s.pickerIndex];
      return insert({ ...s, screen: 'normal', codeDigits: '' }, chosen.token);
    }
    if (/^[0-9]$/.test(id)) {
      const nextDigits = s.codeDigits + id;
      if (nextDigits.length === 1) return { ...s, codeDigits: nextDigits };
      const c = CONSTANT_BY_CODE.get(nextDigits);
      if (c) return insert({ ...s, screen: 'normal', codeDigits: '' }, c.token);
      return { ...s, codeDigits: '' };
    }
    return s;
  }

  // CONV Picker (SHIFT + 8)
  if (s.screen === 'conv-picker') {
    if (id === 'down') return { ...s, pickerIndex: (s.pickerIndex + 1) % 40 };
    if (id === 'up') return { ...s, pickerIndex: (s.pickerIndex + 39) % 40 };
    if (id === 'del') return { ...s, codeDigits: s.codeDigits.slice(0, -1) };
    if (id === 'equals') {
      const chosen = UNIT_CONVERSIONS[s.pickerIndex];
      return insert({ ...s, screen: 'normal', codeDigits: '' }, chosen.token, 'continue');
    }
    if (/^[0-9]$/.test(id)) {
      const nextDigits = s.codeDigits + id;
      if (nextDigits.length === 1) return { ...s, codeDigits: nextDigits };
      const c = CONVERSION_BY_CODE.get(nextDigits);
      if (c) return insert({ ...s, screen: 'normal', codeDigits: '' }, c.token, 'continue');
      return { ...s, codeDigits: '' };
    }
    return s;
  }

  // CMPLX Menu (SHIFT + 2)
  if (s.screen === 'cmplx-menu') {
    if (id === '1') return functionTemplate({ ...s, screen: 'normal' }, 'arg');
    if (id === '2') return functionTemplate({ ...s, screen: 'normal' }, 'Conjg');
    if (id === '3') {
      if (s.phase === 'result' && s.cmplx.result) {
        return { ...s, screen: 'normal', cmplx: { ...s.cmplx, format: 'polar' } };
      }
      return insert({ ...s, screen: 'normal' }, '▸r∠θ', 'continue');
    }
    if (id === '4') {
      if (s.phase === 'result' && s.cmplx.result) {
        return { ...s, screen: 'normal', cmplx: { ...s.cmplx, format: 'rect' } };
      }
      return insert({ ...s, screen: 'normal' }, '▸a+bi', 'continue');
    }
    return s;
  }

  // BASE-N Menu (SHIFT + 3): Page 0 Logic, Page 1 Base Prefixes (d, h, b, o)
  if (s.screen === 'basen-menu') {
    if (id === 'down' || id === 'right') return { ...s, menuPage: 1 };
    if (id === 'up' || id === 'left') return { ...s, menuPage: 0 };
    if (s.menuPage === 0) {
      const map: Record<string, () => CalculatorState> = {
        '1': () => insert({ ...s, screen: 'normal', menuPage: 0 }, 'and', 'continue'),
        '2': () => insert({ ...s, screen: 'normal', menuPage: 0 }, 'or', 'continue'),
        '3': () => insert({ ...s, screen: 'normal', menuPage: 0 }, 'xor', 'continue'),
        '4': () => insert({ ...s, screen: 'normal', menuPage: 0 }, 'xnor', 'continue'),
        '5': () => functionTemplate({ ...s, screen: 'normal', menuPage: 0 }, 'Not'),
        '6': () => functionTemplate({ ...s, screen: 'normal', menuPage: 0 }, 'Neg'),
      };
      return map[id] ? map[id]() : s;
    }
    const prefMap: Record<string, string> = { '1': 'd', '2': 'h', '3': 'b', '4': 'o' };
    if (prefMap[id]) return insert({ ...s, screen: 'normal', menuPage: 0 }, prefMap[id]);
    return s;
  }

  // STAT Menus
  if (s.screen === 'stat-type-menu') {
    const types: Record<string, StatSubMode> = {
      '1': '1-VAR', '2': 'A+BX', '3': '_+CX2', '4': 'LN_X',
      '5': 'E_X', '6': 'AB_X', '7': 'AX_B', '8': 'INV_X',
    };
    if (types[id]) {
      return {
        ...s,
        mode: 'STAT',
        screen: 'normal',
        stat: createDefaultStat(types[id], s.stat.useFreq),
      };
    }
    return s;
  }

  if (s.screen === 'stat-menu') {
    if (id === '1') return { ...s, screen: 'stat-type-menu' };
    if (id === '2') return { ...s, screen: 'normal', stat: { ...s.stat, editingTable: true, editingCell: false, cellInput: '' } };
    if (id === '3') return { ...s, screen: 'stat-sub-sum' };
    if (id === '4') return { ...s, screen: 'stat-sub-var' };
    if (id === '5') {
      return { ...s, screen: s.stat.subMode === '1-VAR' ? 'stat-sub-distr' : 'stat-sub-reg' };
    }
    if (id === '6') return { ...s, screen: 'stat-sub-minmax' };
    return s;
  }

  if (s.screen === 'stat-sub-sum') {
    const map1: Record<string, string> = { '1': 'statSumX2', '2': 'statSumX' };
    const map2: Record<string, string> = {
      '1': 'statSumX2', '2': 'statSumX', '3': 'statSumY2', '4': 'statSumY', '5': 'statSumXY',
      '6': 'statSumX3', '7': 'statSumX2Y', '8': 'statSumX4',
    };
    const tok = (s.stat.subMode === '1-VAR' ? map1 : map2)[id];
    return tok ? insert({ ...s, screen: 'normal' }, tok) : s;
  }

  if (s.screen === 'stat-sub-var') {
    const map1: Record<string, string> = { '1': 'statN', '2': 'statMeanX', '3': 'statPopSdX', '4': 'statSampSdX' };
    const map2: Record<string, string> = {
      '1': 'statN', '2': 'statMeanX', '3': 'statPopSdX', '4': 'statSampSdX',
      '5': 'statMeanY', '6': 'statPopSdY', '7': 'statSampSdY',
    };
    const tok = (s.stat.subMode === '1-VAR' ? map1 : map2)[id];
    return tok ? insert({ ...s, screen: 'normal' }, tok) : s;
  }

  if (s.screen === 'stat-sub-distr') {
    if (id === '1') return functionTemplate({ ...s, screen: 'normal' }, 'StatP');
    if (id === '2') return functionTemplate({ ...s, screen: 'normal' }, 'StatQ');
    if (id === '3') return functionTemplate({ ...s, screen: 'normal' }, 'StatR');
    if (id === '4') return insert({ ...s, screen: 'normal' }, '▸t', 'continue');
    return s;
  }

  if (s.screen === 'stat-sub-reg') {
    if (s.stat.subMode === '_+CX2') {
      const mapQ: Record<string, { tok: string; cont?: boolean }> = {
        '1': { tok: 'statRegA' }, '2': { tok: 'statRegB' }, '3': { tok: 'statRegC' },
        '4': { tok: '▸xhat', cont: true }, '5': { tok: '▸xhat2', cont: true }, '6': { tok: '▸yhat', cont: true },
      };
      const hit = mapQ[id];
      return hit ? insert({ ...s, screen: 'normal' }, hit.tok, hit.cont ? 'continue' : 'fresh') : s;
    }
    const mapR: Record<string, { tok: string; cont?: boolean }> = {
      '1': { tok: 'statRegA' }, '2': { tok: 'statRegB' }, '3': { tok: 'statCorrR' },
      '4': { tok: '▸xhat', cont: true }, '5': { tok: '▸yhat', cont: true },
    };
    const hit = mapR[id];
    return hit ? insert({ ...s, screen: 'normal' }, hit.tok, hit.cont ? 'continue' : 'fresh') : s;
  }

  if (s.screen === 'stat-sub-minmax') {
    if (s.stat.subMode === '1-VAR') {
      const mapM1: Record<string, string> = {
        '1': 'statMinX', '2': 'statMaxX', '3': 'statQ1', '4': 'statMed', '5': 'statQ3',
      };
      return mapM1[id] ? insert({ ...s, screen: 'normal' }, mapM1[id]) : s;
    }
    const mapM2: Record<string, string> = {
      '1': 'statMinX', '2': 'statMaxX', '3': 'statMinY', '4': 'statMaxY',
    };
    return mapM2[id] ? insert({ ...s, screen: 'normal' }, mapM2[id]) : s;
  }

  // MATRIX Menus
  if (s.screen === 'matrix-target-menu') {
    const targets: Record<string, 'MatA' | 'MatB' | 'MatC'> = { '1': 'MatA', '2': 'MatB', '3': 'MatC' };
    const t = targets[id];
    if (!t) return s;
    if (s.matrix.dimAction === 'edit' && s.matrix.matrices[t]) {
      return {
        ...s,
        screen: 'normal',
        matrix: { ...s.matrix, editingTarget: t, rowIdx: 0, colIdx: 0, cellInput: '', editingCell: false, showingMatrixResult: false },
      };
    }
    return { ...s, screen: 'matrix-dim-menu', matrix: { ...s.matrix, pendingTarget: t } };
  }

  if (s.screen === 'matrix-dim-menu') {
    const dims: Record<string, [number, number]> = {
      '1': [3, 3], '2': [3, 2], '3': [3, 1],
      '4': [2, 3], '5': [2, 2], '6': [2, 1],
      '7': [1, 3], '8': [1, 2], '9': [1, 1],
    };
    if (dims[id]) {
      const [rows, cols] = dims[id];
      const t = s.matrix.pendingTarget;
      return {
        ...s,
        screen: 'normal',
        matrix: {
          ...s.matrix,
          matrices: { ...s.matrix.matrices, [t]: createZeroMatrix(rows, cols) },
          editingTarget: t,
          rowIdx: 0,
          colIdx: 0,
          cellInput: '',
          editingCell: false,
          showingMatrixResult: false,
        },
      };
    }
    return s;
  }

  if (s.screen === 'matrix-menu') {
    if (id === 'down' || id === 'right') return { ...s, menuPage: 1 };
    if (id === 'up' || id === 'left') return { ...s, menuPage: 0 };
    if (s.menuPage === 1) {
      if (id === '1') return functionTemplate({ ...s, screen: 'normal', menuPage: 0 }, 'Ref');
      if (id === '2') return functionTemplate({ ...s, screen: 'normal', menuPage: 0 }, 'Rref');
      return s;
    }
    if (id === '1') return { ...s, screen: 'matrix-target-menu', matrix: { ...s.matrix, dimAction: 'define' } };
    if (id === '2') return { ...s, screen: 'matrix-target-menu', matrix: { ...s.matrix, dimAction: 'edit' } };
    if (id === '3') return insert({ ...s, screen: 'normal' }, 'MatA');
    if (id === '4') return insert({ ...s, screen: 'normal' }, 'MatB');
    if (id === '5') return insert({ ...s, screen: 'normal' }, 'MatC');
    if (id === '6') return insert({ ...s, screen: 'normal' }, 'MatAns');
    if (id === '7') return functionTemplate({ ...s, screen: 'normal' }, 'det');
    if (id === '8') return functionTemplate({ ...s, screen: 'normal' }, 'Trn');
    return s;
  }

  // VECTOR Menus
  if (s.screen === 'vector-target-menu') {
    const targets: Record<string, 'VctA' | 'VctB' | 'VctC'> = { '1': 'VctA', '2': 'VctB', '3': 'VctC' };
    const t = targets[id];
    if (!t) return s;
    if (s.vector.dimAction === 'edit' && s.vector.vectors[t]) {
      return {
        ...s,
        screen: 'normal',
        vector: { ...s.vector, editingTarget: t, coordIdx: 0, cellInput: '', editingCell: false, showingVectorResult: false },
      };
    }
    return { ...s, screen: 'vector-dim-menu', vector: { ...s.vector, pendingTarget: t } };
  }

  if (s.screen === 'vector-dim-menu') {
    if (id === '1' || id === '2') {
      const dim: 2 | 3 = id === '1' ? 3 : 2;
      const t = s.vector.pendingTarget;
      return {
        ...s,
        screen: 'normal',
        vector: {
          ...s.vector,
          vectors: { ...s.vector.vectors, [t]: createZeroVector(dim) },
          editingTarget: t,
          coordIdx: 0,
          cellInput: '',
          editingCell: false,
          showingVectorResult: false,
        },
      };
    }
    return s;
  }

  if (s.screen === 'vector-menu') {
    if (id === '1') return { ...s, screen: 'vector-target-menu', vector: { ...s.vector, dimAction: 'define' } };
    if (id === '2') return { ...s, screen: 'vector-target-menu', vector: { ...s.vector, dimAction: 'edit' } };
    if (id === '3') return insert({ ...s, screen: 'normal' }, 'VctA');
    if (id === '4') return insert({ ...s, screen: 'normal' }, 'VctB');
    if (id === '5') return insert({ ...s, screen: 'normal' }, 'VctC');
    if (id === '6') return insert({ ...s, screen: 'normal' }, 'VctAns');
    if (id === '7') return insert({ ...s, screen: 'normal' }, '·', 'continue');
    if (id === '8') return functionTemplate({ ...s, screen: 'normal' }, 'Angle');
    return s;
  }

  // INEQ Menus
  if (s.screen === 'ineq-deg-menu') {
    if (id === '1' || id === '2') {
      const deg: IneqDegree = id === '1' ? 2 : 3;
      return { ...s, screen: 'ineq-rel-menu', ineq: createIneqState(deg, '>') };
    }
    return s;
  }
  if (s.screen === 'ineq-rel-menu' && s.ineq) {
    const rels: Record<string, IneqRelation> = { '1': '>', '2': '<', '3': '≥', '4': '≤' };
    if (rels[id]) {
      return { ...s, screen: 'normal', ineq: createIneqState(s.ineq.degree, rels[id]) };
    }
    return s;
  }

  // VERIF Menu (SHIFT + 6)
  if (s.screen === 'verif-menu') {
    const ops: Record<string, string> = { '1': '=', '2': '≠', '3': '>', '4': '<', '5': '≥', '6': '≤' };
    if (ops[id]) return insert({ ...s, screen: 'normal' }, ops[id], 'continue');
    return s;
  }

  // DIST Menu
  if (s.screen === 'dist-menu') {
    const map: Record<string, DistSubMode> = {
      '1': 'norm-pd', '2': 'norm-cd', '3': 'inv-norm',
      '4': 'binom-pd', '5': 'binom-cd', '6': 'poisson-pd', '7': 'poisson-cd',
    };
    if (map[id]) {
      return { ...s, mode: 'DIST', screen: 'normal', dist: createDistState(map[id], false) };
    }
    if (id === '8' && s.dist) {
      return { ...s, mode: 'DIST', screen: 'normal', dist: createDistState(s.dist.subMode, !s.dist.listMode) };
    }
    return s;
  }

  if (s.screen === 'eqn-menu') {
    const map: Record<string, EqnType> = { '1': 'lin2', '2': 'lin3', '3': 'quad', '4': 'cubic' };
    if (map[id]) {
      return { ...s, mode: 'EQN', screen: 'normal', eqn: createEqnState(map[id]) };
    }
    return s;
  }

  // SETUP Menu (Page 0 & Page 1)
  if (s.screen === 'setup') {
    if (id === 'down' || id === 'right') return { ...s, menuPage: 1 };
    if (id === 'up' || id === 'left') return { ...s, menuPage: 0 };
    if (s.menuPage === 0 && /^[1-8]$/.test(id)) {
      if (id === '1') return { ...s, ioMode: 'Math', screen: 'setup-matho', menuPage: 0 };
      if (id === '2') return { ...s, screen: 'normal', menuPage: 0, ioMode: 'Line' };
      const angles: Record<string, AngleUnit> = { '3': 'DEG', '4': 'RAD', '5': 'GRA' };
      if (angles[id]) return { ...s, screen: 'normal', menuPage: 0, angle: angles[id] };
      if (id === '6') return { ...s, screen: 'setup-fix', menuPage: 0 };
      if (id === '7') return { ...s, screen: 'setup-sci', menuPage: 0 };
      if (id === '8') return { ...s, screen: 'setup-norm', menuPage: 0 };
    }
    if (s.menuPage === 1) {
      if (id === '1') return { ...s, screen: 'normal', menuPage: 0, defaultFractionStyle: 'mixed', fractionStyle: 'mixed' };
      if (id === '2') return { ...s, screen: 'normal', menuPage: 0, defaultFractionStyle: 'improper', fractionStyle: 'improper' };
      if (id === '3') return { ...s, screen: 'setup-cmplx', menuPage: 0 };
      if (id === '4') return { ...s, screen: 'setup-stat-freq', menuPage: 0 };
      if (id === '5') return { ...s, screen: 'setup-disp', menuPage: 0 };
      if (id === '6') return { ...s, screen: 'setup-table', menuPage: 0 };
      if (id === '7') return { ...s, screen: 'setup-recur', menuPage: 0 };
      if (id === '8') return { ...s, screen: 'setup-contrast', menuPage: 0 };
    }
    return s;
  }

  if (s.screen === 'setup-matho' && (id === '1' || id === '2')) {
    return { ...s, screen: 'normal', ioMode: 'Math', mathOutputMode: id === '1' ? 'MathO' : 'LineO' };
  }
  if (s.screen === 'setup-fix' && /^[0-9]$/.test(id)) {
    return { ...s, screen: 'normal', numberFormat: { mode: 'Fix', digits: Number(id) } };
  }
  if (s.screen === 'setup-sci' && /^[0-9]$/.test(id)) {
    return { ...s, screen: 'normal', numberFormat: { mode: 'Sci', digits: Number(id) } };
  }
  if (s.screen === 'setup-norm' && (id === '1' || id === '2')) {
    return { ...s, screen: 'normal', numberFormat: { mode: 'Norm', sub: id === '1' ? 1 : 2 } };
  }
  if (s.screen === 'setup-cmplx' && (id === '1' || id === '2')) {
    const fmt: ComplexFormat = id === '1' ? 'rect' : 'polar';
    return { ...s, screen: 'normal', defaultCmplxFormat: fmt, cmplx: { ...s.cmplx, format: fmt } };
  }
  if (s.screen === 'setup-disp' && (id === '1' || id === '2')) {
    return { ...s, screen: 'normal', decimalMark: id === '1' ? 'Dot' : 'Comma' };
  }
  if (s.screen === 'setup-table' && (id === '1' || id === '2')) {
    return { ...s, screen: 'normal', tableUseG: id === '2' };
  }
  if (s.screen === 'setup-stat-freq' && (id === '1' || id === '2')) {
    return { ...s, screen: 'normal', stat: { ...s.stat, useFreq: id === '1' } };
  }
  if (s.screen === 'setup-recur' && (id === '1' || id === '2')) {
    return { ...s, screen: 'normal', recurEnabled: id === '1' };
  }
  if (s.screen === 'setup-contrast') {
    if (id === 'left') return { ...s, contrast: Math.max(1, s.contrast - 1) };
    if (id === 'right') return { ...s, contrast: Math.min(10, s.contrast + 1) };
    if (id === 'equals') return { ...s, screen: 'normal' };
    return s;
  }

  if (s.screen === 'drg') {
    const map: Record<string, string> = { '1': 'ᵈ', '2': 'ʳ', '3': 'ᵍ' };
    if (map[id]) return insert({ ...s, screen: 'normal' }, map[id], 'continue');
    return s;
  }

  if (s.screen === 'clear' && ['1', '2', '3'].includes(id)) {
    return { ...s, screen: 'clear-confirm', clearTarget: id === '1' ? 'setup' : id === '2' ? 'memory' : 'all' };
  }
  if (s.screen === 'clear-confirm' && id === 'equals') {
    if (s.clearTarget === 'all') return createInitialState();
    if (s.clearTarget === 'memory') {
      return {
        ...s,
        screen: 'normal',
        variables: zeroVariables(),
        ans: zeroStored(),
        preAns: zeroStored(),
        baseN: createDefaultBaseN(),
        cmplx: createDefaultCmplx(s.defaultCmplxFormat),
        matrix: createDefaultMatrix(),
        vector: createDefaultVector(),
        clearTarget: null,
      };
    }
    return {
      ...s,
      screen: 'normal',
      angle: 'DEG',
      ioMode: 'Math',
      mathOutputMode: 'MathO',
      decimalMark: 'Dot',
      defaultCmplxFormat: 'rect',
      recurEnabled: true,
      contrast: 5,
      numberFormat: DEFAULT_NUMBER_FORMAT,
      defaultFractionStyle: 'improper',
      fractionStyle: 'improper',
      tableUseG: true,
      clearTarget: null,
    };
  }
  return s;
}

function simpleInputChar(id: string, shift: boolean, alpha: boolean): string | null {
  if (/^[0-9]$/.test(id)) return id;
  if (shift && id === 'exp') return 'π';
  if (alpha && (id === 'exp' || id === 'ln')) return 'e';
  if (alpha && ALPHA_KEYS[id]) return ALPHA_KEYS[id];
  if (shift && id === 'sin') return 'asin(';
  if (shift && id === 'cos') return 'acos(';
  if (shift && id === 'tan') return 'atan(';
  if (shift && id === 'sqrt') return 'cbrt(';
  if (shift && id === 'square') return '^3';
  if (shift && id === 'hyp') return 'abs(';
  if (shift && id === 'log') return '10^(';
  if (shift && id === 'ln') return 'e^(';
  if (shift && id === 'power') return 'root(';
  switch (id) {
    case 'dot': return '.';
    case 'neg': case 'subtract': return '-';
    case 'add': return '+';
    case 'multiply': return '×';
    case 'divide': case 'frac': return '÷';
    case 'square': return '^2';
    case 'cube': return '^3';
    case 'inverse': return shift ? '!' : '^(-1)';
    case 'power': return '^';
    case 'open': return '(';
    case 'close': return ')';
    case 'sqrt': return 'sqrt(';
    case 'abs': return 'abs(';
    case 'sin': return 'sin(';
    case 'cos': return 'cos(';
    case 'tan': return 'tan(';
    case 'log': return 'log(';
    case 'ln': return 'ln(';
    case 'ans': return 'Ans';
    case 'exp': return '⏨';
    case 'pi': return 'π';
    case 'e': return 'e';
    case 'var-x': return 'X';
    case 'var-y': return 'Y';
    case 'percent': return '%';
    default: return null;
  }
}

function evaluateCalcStatements(
  s: CalculatorState,
  sourceExpr: string,
  random?: number,
): CalculatorState {
  const statements = splitStatements(sourceExpr).map((p) => p.trim()).filter(Boolean);
  if (statements.length > 1) {
    const first = statements[0];
    const nextState = evaluateSingleStatement(s, first, sourceExpr, random);
    return { ...nextState, statementRun: { statements, index: 0 } };
  }
  return evaluateSingleStatement(s, sourceExpr, sourceExpr, random);
}

function startCalcWorkflow(s: CalculatorState): CalculatorState {
  if (!s.expression.trim()) return s;
  try {
    const vars = extractVariables(s.expression);
    if (vars.length === 0) return evaluateCalcStatements(closeLatches(s), s.expression);
    return { ...closeLatches(s), calcPrompt: { sourceExpr: s.expression, vars, index: 0, input: '' } };
  } catch (err) {
    return errorState(s, err);
  }
}

function handleCalcPrompt(s: CalculatorState, id: string, random?: number): CalculatorState {
  const prompt = s.calcPrompt!;
  if (id === 'ac') return { ...s, calcPrompt: null, shift: false, alpha: false };
  if (id === 'del') return { ...s, calcPrompt: { ...prompt, input: prompt.input.slice(0, -1) } };
  if (id === 'equals') {
    try {
      const targetVar = prompt.vars[prompt.index];
      const nextVal = prompt.input.trim()
        ? serialize(evaluateExpression(prompt.input, evalContext(s, random)))
        : s.variables[targetVar];
      const updatedVars = { ...s.variables, [targetVar]: nextVal };
      const nextIndex = prompt.index + 1;
      if (nextIndex < prompt.vars.length) {
        return { ...s, variables: updatedVars, calcPrompt: { ...prompt, index: nextIndex, input: '' } };
      }
      const nextState = { ...s, variables: updatedVars, calcPrompt: null, expression: prompt.sourceExpr };
      return evaluateCalcStatements(nextState, prompt.sourceExpr, random);
    } catch (err) {
      return errorState(s, err);
    }
  }
  const ch = simpleInputChar(id, s.shift, s.alpha);
  if (ch !== null) return { ...s, shift: false, alpha: false, calcPrompt: { ...prompt, input: prompt.input + ch } };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
  return s;
}

function startSolveWorkflow(s: CalculatorState): CalculatorState {
  if (!s.expression.trim()) return s;
  try {
    splitEquation(s.expression);
    return { ...closeLatches(s), solvePrompt: { sourceExpr: s.expression, stage: 'prompt-x', input: '' } };
  } catch (err) {
    return errorState(s, err);
  }
}

function handleSolvePrompt(s: CalculatorState, id: string, random?: number): CalculatorState {
  const sp = s.solvePrompt!;
  if (sp.stage === 'solved') {
    if (id === 'ac') {
      return {
        ...resetResultModifiers(s),
        solvePrompt: null,
        phase: 'editing',
        expression: '',
        cursor: 0,
        result: null,
        error: null,
        shift: false,
        alpha: false,
      };
    }
    if (id === 'left' || id === 'right') {
      return {
        ...resetResultModifiers(s),
        solvePrompt: null,
        phase: 'editing',
        expression: sp.sourceExpr,
        cursor: id === 'left' ? sp.sourceExpr.length : 0,
        result: null,
        error: null,
      };
    }
    if (id === 'equals') {
      return { ...s, solvePrompt: { sourceExpr: sp.sourceExpr, stage: 'prompt-x', input: '' } };
    }
    return calculatorReducer({ ...s, solvePrompt: null }, { type: 'key', id, random });
  }
  if (id === 'ac') {
    return { ...s, solvePrompt: null, phase: 'editing', expression: sp.sourceExpr, cursor: sp.sourceExpr.length, shift: false, alpha: false };
  }
  if (id === 'del') return { ...s, solvePrompt: { ...sp, input: sp.input.slice(0, -1) } };
  if (id === 'equals') {
    try {
      const guessScalar = sp.input.trim()
        ? evaluateExpression(sp.input, evalContext(s, random))
        : deserialize(s.variables.X);
      const { left, right } = splitEquation(sp.sourceExpr);
      const outcome = solveRoot(
        (xVal) => {
          const ctx = { ...evalContext(s, random), variables: { ...s.variables, X: serialize(xVal) } };
          return subtract(evaluateExpression(left, ctx), evaluateExpression(right, ctx));
        },
        guessScalar,
      );
      const rootStored = serialize(outcome.root);
      const resStored = serialize(outcome.residual);
      return {
        ...s,
        phase: 'result',
        result: rootStored,
        preAns: s.ans,
        ans: rootStored,
        variables: { ...s.variables, X: rootStored },
        pairResult: {
          type: 'pair',
          label1: 'X',
          value1: formatDecimal(outcome.root, s.numberFormat, s.decimalMark),
          label2: 'L−R',
          value2: formatDecimal(outcome.residual, s.numberFormat, s.decimalMark),
        },
        solvePrompt: { sourceExpr: sp.sourceExpr, stage: 'solved', input: '', root: rootStored, residual: resStored },
      };
    } catch (err) {
      return errorState(s, err);
    }
  }
  const ch = simpleInputChar(id, s.shift, s.alpha);
  if (ch !== null) return { ...s, shift: false, alpha: false, solvePrompt: { ...sp, input: sp.input + ch } };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
  return s;
}

function handleEqnMode(s: CalculatorState, id: string, random?: number): CalculatorState {
  const eqn = s.eqn!;
  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0 };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };

  if (eqn.outcome) {
    if (id === 'ac') return { ...s, eqn: { ...eqn, outcome: null, solutionIndex: 0, input: '', editingCell: false } };
    if (eqn.outcome.status === 'solved') {
      const len = eqn.outcome.items.length;
      if (id === 'down' || id === 'equals') {
        const nextIdx = (eqn.solutionIndex + 1) % len;
        const item = eqn.outcome.items[nextIdx];
        return {
          ...s,
          result: item.scalar ? serialize(item.scalar) : null,
          resultFormat: item.scalar ? effectiveResultFormat(s, defaultResultFormat(item.scalar)) : 'decimal',
          eqn: { ...eqn, solutionIndex: nextIdx },
        };
      }
      if (id === 'up') {
        const prevIdx = (eqn.solutionIndex - 1 + len) % len;
        const item = eqn.outcome.items[prevIdx];
        return {
          ...s,
          result: item.scalar ? serialize(item.scalar) : null,
          resultFormat: item.scalar ? effectiveResultFormat(s, defaultResultFormat(item.scalar)) : 'decimal',
          eqn: { ...eqn, solutionIndex: prevIdx },
        };
      }
      if (id === 'sd') {
        return { ...s, resultFormat: s.resultFormat === 'exact' ? 'decimal' : 'exact' };
      }
    }
    return s;
  }

  if (id === 'ac') {
    if (eqn.editingCell) return { ...s, eqn: { ...eqn, input: '', editingCell: false } };
    return { ...s, screen: 'eqn-menu' };
  }
  if (id === 'del' && eqn.editingCell) {
    const nextInput = eqn.input.slice(0, -1);
    return { ...s, eqn: { ...eqn, input: nextInput, editingCell: nextInput.length > 0 } };
  }
  if ((id === 'left' || id === 'up') && !eqn.editingCell) {
    const nextIdx = (eqn.cursorIndex - 1 + eqn.coeffs.length) % eqn.coeffs.length;
    return { ...s, eqn: { ...eqn, cursorIndex: nextIdx } };
  }
  if ((id === 'right' || id === 'down') && !eqn.editingCell) {
    const nextIdx = (eqn.cursorIndex + 1) % eqn.coeffs.length;
    return { ...s, eqn: { ...eqn, cursorIndex: nextIdx } };
  }
  if (id === 'equals') {
    try {
      const nextCoeffs = [...eqn.coeffs];
      if (eqn.editingCell && eqn.input.trim()) {
        nextCoeffs[eqn.cursorIndex] = serialize(evaluateExpression(eqn.input, evalContext(s, random)));
      }
      if (eqn.cursorIndex + 1 < nextCoeffs.length) {
        return { ...s, eqn: { ...eqn, coeffs: nextCoeffs, cursorIndex: eqn.cursorIndex + 1, input: '', editingCell: false } };
      }
      const scalars = nextCoeffs.map(deserialize);
      const outcome = solveEqn(eqn.type, scalars);
      const firstScalar = outcome.status === 'solved' ? outcome.items[0]?.scalar : undefined;
      return {
        ...s,
        phase: 'result',
        result: firstScalar ? serialize(firstScalar) : null,
        resultFormat: firstScalar ? effectiveResultFormat(s, defaultResultFormat(firstScalar)) : 'decimal',
        eqn: { ...eqn, coeffs: nextCoeffs, input: '', editingCell: false, outcome, solutionIndex: 0 },
      };
    } catch (err) {
      return errorState(s, err);
    }
  }

  const ch = simpleInputChar(id, s.shift, s.alpha);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, eqn: { ...eqn, input: (eqn.editingCell ? eqn.input : '') + ch, editingCell: true } };
  }
  return s;
}

function handleIneqMode(s: CalculatorState, id: string, random?: number): CalculatorState {
  const ineq = s.ineq!;
  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0 };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };

  if (ineq.solved) {
    if (id === 'ac' || id === 'equals') {
      return { ...s, phase: 'editing', ineq: { ...ineq, solved: false, input: '', editingCell: false } };
    }
    if (id === 'sd') {
      return { ...s, resultFormat: s.resultFormat === 'exact' ? 'decimal' : 'exact' };
    }
    return s;
  }

  if (id === 'ac') {
    if (ineq.editingCell) return { ...s, ineq: { ...ineq, input: '', editingCell: false } };
    return { ...s, screen: 'ineq-deg-menu' };
  }
  if (id === 'del' && ineq.editingCell) {
    const nextInput = ineq.input.slice(0, -1);
    return { ...s, ineq: { ...ineq, input: nextInput, editingCell: nextInput.length > 0 } };
  }
  if ((id === 'left' || id === 'up') && !ineq.editingCell) {
    const nextIdx = (ineq.cursorIndex - 1 + ineq.coeffs.length) % ineq.coeffs.length;
    return { ...s, ineq: { ...ineq, cursorIndex: nextIdx } };
  }
  if ((id === 'right' || id === 'down') && !ineq.editingCell) {
    const nextIdx = (ineq.cursorIndex + 1) % ineq.coeffs.length;
    return { ...s, ineq: { ...ineq, cursorIndex: nextIdx } };
  }
  if (id === 'equals') {
    try {
      const nextCoeffs = [...ineq.coeffs];
      if (ineq.editingCell && ineq.input.trim()) {
        nextCoeffs[ineq.cursorIndex] = serialize(evaluateExpression(eqnOrIneqInput(ineq.input), evalContext(s, random)));
      }
      if (ineq.cursorIndex + 1 < nextCoeffs.length) {
        return { ...s, ineq: { ...ineq, coeffs: nextCoeffs, cursorIndex: ineq.cursorIndex + 1, input: '', editingCell: false } };
      }
      solveInequality(ineq.degree, ineq.relation, nextCoeffs.map(deserialize));
      return {
        ...s,
        phase: 'result',
        resultFormat: effectiveResultFormat(s, 'exact'),
        ineq: { ...ineq, coeffs: nextCoeffs, input: '', editingCell: false, solved: true },
      };
    } catch (err) {
      return errorState(s, err);
    }
  }

  const ch = simpleInputChar(id, s.shift, s.alpha);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, ineq: { ...ineq, input: (ineq.editingCell ? ineq.input : '') + ch, editingCell: true } };
  }
  return s;
}

function eqnOrIneqInput(raw: string): string {
  return raw;
}

function handleStatTableEditor(s: CalculatorState, id: string, random?: number): CalculatorState {
  const st = s.stat;
  const hasY = st.subMode !== '1-VAR';
  const colsCount = 1 + (hasY ? 1 : 0) + (st.useFreq ? 1 : 0);

  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0 };
  if (s.shift && id === '1') return { ...closeLatches(s), screen: 'stat-menu' };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };

  if (id === 'ac') {
    if (st.editingCell) return { ...s, stat: { ...st, cellInput: '', editingCell: false } };
    return { ...s, phase: 'editing', expression: '', cursor: 0, stat: { ...st, editingTable: false } };
  }
  if (id === 'del') {
    if (st.editingCell) {
      const next = st.cellInput.slice(0, -1);
      return { ...s, stat: { ...st, cellInput: next, editingCell: next.length > 0 } };
    }
    if (st.rowIdx < st.rows.length) {
      const nextRows = st.rows.filter((_, idx) => idx !== st.rowIdx);
      return { ...s, stat: { ...st, rows: nextRows, rowIdx: Math.min(st.rowIdx, nextRows.length) } };
    }
    return s;
  }
  if (!st.editingCell) {
    const maxRowSlot = Math.min(79, st.rows.length);
    const totalRowSlots = maxRowSlot + 1;
    if (id === 'up') return { ...s, stat: { ...st, rowIdx: (st.rowIdx - 1 + totalRowSlots) % totalRowSlots } };
    if (id === 'down') return { ...s, stat: { ...st, rowIdx: (st.rowIdx + 1) % totalRowSlots } };
    if (id === 'left') return { ...s, stat: { ...st, colIdx: (st.colIdx - 1 + colsCount) % colsCount } };
    if (id === 'right') return { ...s, stat: { ...st, colIdx: (st.colIdx + 1) % colsCount } };
  }
  if (id === 'equals') {
    try {
      const nextRows = [...st.rows];
      if (st.rowIdx === nextRows.length) {
        if (!st.editingCell || !st.cellInput.trim()) return s;
        const valStr = formatDecimal(evaluateExpression(st.cellInput, evalContext(s, random)));
        nextRows.push({
          x: st.colIdx === 0 ? valStr : '0',
          y: hasY ? (st.colIdx === 1 ? valStr : '0') : undefined,
          freq: st.colIdx > (hasY ? 1 : 0) ? valStr : '1',
        });
      } else if (st.editingCell && st.cellInput.trim()) {
        const currentRow = { ...nextRows[st.rowIdx] };
        const valStr = formatDecimal(evaluateExpression(st.cellInput, evalContext(s, random)));
        if (st.colIdx === 0) currentRow.x = valStr;
        else if (hasY && st.colIdx === 1) currentRow.y = valStr;
        else currentRow.freq = valStr;
        nextRows[st.rowIdx] = currentRow;
      }
      let nextRowIdx = st.rowIdx;
      let nextColIdx = st.colIdx + 1;
      if (nextColIdx >= colsCount) {
        nextColIdx = 0;
        nextRowIdx = Math.min(79, nextRows.length, st.rowIdx + 1);
      }
      return {
        ...s,
        stat: { ...st, rows: nextRows, rowIdx: nextRowIdx, colIdx: nextColIdx, cellInput: '', editingCell: false },
      };
    } catch (err) {
      return errorState(s, err);
    }
  }
  const ch = simpleInputChar(id, s.shift, s.alpha);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, stat: { ...st, cellInput: (st.editingCell ? st.cellInput : '') + ch, editingCell: true } };
  }
  return s;
}

function handleMatrixCellEditor(s: CalculatorState, id: string, random?: number): CalculatorState {
  const mt = s.matrix;
  const target = mt.editingTarget!;
  const mat = mt.matrices[target]!;

  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0 };
  if (s.shift && id === '4') return { ...closeLatches(s), screen: 'matrix-menu', menuPage: 0, matrix: { ...mt, editingTarget: null } };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };

  if (id === 'ac') {
    if (mt.editingCell) return { ...s, matrix: { ...mt, cellInput: '', editingCell: false } };
    return { ...s, phase: 'editing', expression: '', cursor: 0, matrix: { ...mt, editingTarget: null } };
  }
  if (id === 'del' && mt.editingCell) {
    const next = mt.cellInput.slice(0, -1);
    return { ...s, matrix: { ...mt, cellInput: next, editingCell: next.length > 0 } };
  }
  if (!mt.editingCell) {
    if (id === 'up') return { ...s, matrix: { ...mt, rowIdx: (mt.rowIdx - 1 + mat.rows) % mat.rows } };
    if (id === 'down') return { ...s, matrix: { ...mt, rowIdx: (mt.rowIdx + 1) % mat.rows } };
    if (id === 'left') return { ...s, matrix: { ...mt, colIdx: (mt.colIdx - 1 + mat.cols) % mat.cols } };
    if (id === 'right') return { ...s, matrix: { ...mt, colIdx: (mt.colIdx + 1) % mat.cols } };
  }
  if (id === 'equals') {
    try {
      const cells = mat.cells.map((r) => [...r]);
      if (mt.editingCell && mt.cellInput.trim()) {
        cells[mt.rowIdx][mt.colIdx] = serialize(evaluateExpression(mt.cellInput, evalContext(s, random)));
      }
      let nextR = mt.rowIdx;
      let nextC = mt.colIdx + 1;
      if (nextC >= mat.cols) {
        nextC = 0;
        nextR = (mt.rowIdx + 1) % mat.rows;
      }
      return {
        ...s,
        matrix: {
          ...mt,
          matrices: { ...mt.matrices, [target]: { ...mat, cells } },
          rowIdx: nextR,
          colIdx: nextC,
          cellInput: '',
          editingCell: false,
        },
      };
    } catch (err) {
      return errorState(s, err);
    }
  }
  const ch = simpleInputChar(id, s.shift, s.alpha);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, matrix: { ...mt, cellInput: (mt.editingCell ? mt.cellInput : '') + ch, editingCell: true } };
  }
  return s;
}

function handleVectorCellEditor(s: CalculatorState, id: string, random?: number): CalculatorState {
  const vt = s.vector;
  const target = vt.editingTarget!;
  const vct = vt.vectors[target]!;

  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0 };
  if (s.shift && id === '5') return { ...closeLatches(s), screen: 'vector-menu', vector: { ...vt, editingTarget: null } };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };

  if (id === 'ac') {
    if (vt.editingCell) return { ...s, vector: { ...vt, cellInput: '', editingCell: false } };
    return { ...s, phase: 'editing', expression: '', cursor: 0, vector: { ...vt, editingTarget: null } };
  }
  if (id === 'del' && vt.editingCell) {
    const next = vt.cellInput.slice(0, -1);
    return { ...s, vector: { ...vt, cellInput: next, editingCell: next.length > 0 } };
  }
  if (!vt.editingCell) {
    if (id === 'left' || id === 'up') return { ...s, vector: { ...vt, coordIdx: (vt.coordIdx - 1 + vct.dim) % vct.dim } };
    if (id === 'right' || id === 'down') return { ...s, vector: { ...vt, coordIdx: (vt.coordIdx + 1) % vct.dim } };
  }
  if (id === 'equals') {
    try {
      const coords = [...vct.coords];
      if (vt.editingCell && vt.cellInput.trim()) {
        coords[vt.coordIdx] = serialize(evaluateExpression(vt.cellInput, evalContext(s, random)));
      }
      const nextIdx = (vt.coordIdx + 1) % vct.dim;
      return {
        ...s,
        vector: {
          ...vt,
          vectors: { ...vt.vectors, [target]: { ...vct, coords } },
          coordIdx: nextIdx,
          cellInput: '',
          editingCell: false,
        },
      };
    } catch (err) {
      return errorState(s, err);
    }
  }
  const ch = simpleInputChar(id, s.shift, s.alpha);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, vector: { ...vt, cellInput: (vt.editingCell ? vt.cellInput : '') + ch, editingCell: true } };
  }
  return s;
}

function evalSingleDistScalar(subMode: DistSubMode, xVal: ReturnType<typeof evaluateExpression>, rest: Array<ReturnType<typeof evaluateExpression>>) {
  switch (subMode) {
    case 'norm-pd': return normalPd(xVal, rest[1], rest[0]);
    case 'binom-pd': return binomialPd(xVal, rest[0], rest[1]);
    case 'binom-cd': return binomialCd(xVal, rest[0], rest[1]);
    case 'poisson-pd': return poissonPd(xVal, rest[0]);
    case 'poisson-cd': return poissonCd(xVal, rest[0]);
    default: return xVal;
  }
}

function handleDistMode(s: CalculatorState, id: string, random?: number): CalculatorState {
  const ds = s.dist!;
  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0 };
  if (s.shift && id === '1') return { ...closeLatches(s), screen: 'dist-menu' };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };

  if (ds.listResults) {
    if (id === 'ac') {
      return {
        ...s,
        phase: 'editing',
        dist: { ...ds, listResults: null, editingListTable: true, paramIdx: 0, input: '', editingParam: false },
      };
    }
    if (id === 'up') return { ...s, dist: { ...ds, listRowIdx: Math.max(0, ds.listRowIdx - 1) } };
    if (id === 'down' || id === 'equals') {
      return { ...s, dist: { ...ds, listRowIdx: Math.min(ds.listResults.length - 1, ds.listRowIdx + 1) } };
    }
    return s;
  }

  if (ds.result) {
    if (id === 'ac' || id === 'equals') {
      return { ...s, phase: 'editing', dist: { ...ds, result: null, paramIdx: 0, input: '', editingParam: false } };
    }
    return s;
  }

  // Dynamic List x-table editor (insert/edit/delete up to 40 x values, like STAT)
  if (ds.listMode && ds.editingListTable) {
    if (id === 'ac') {
      if (ds.editingParam) return { ...s, dist: { ...ds, input: '', editingParam: false } };
      if (ds.listX.length > 0) {
        return { ...s, dist: { ...ds, editingListTable: false, paramIdx: 0, input: '', editingParam: false } };
      }
      return { ...s, screen: 'dist-menu' };
    }
    if (id === 'del') {
      if (ds.editingParam) {
        const next = ds.input.slice(0, -1);
        return { ...s, dist: { ...ds, input: next, editingParam: next.length > 0 } };
      }
      if (ds.paramIdx < ds.listX.length) {
        const nextListX = ds.listX.filter((_, idx) => idx !== ds.paramIdx);
        return { ...s, dist: { ...ds, listX: nextListX, paramIdx: Math.min(ds.paramIdx, nextListX.length) } };
      }
      return s;
    }
    if (!ds.editingParam && (id === 'left' || id === 'right')) {
      return { ...s, dist: createDistState(ds.subMode, false) };
    }
    if (!ds.editingParam) {
      const maxSlot = Math.min(40, ds.listX.length);
      if (id === 'up') return { ...s, dist: { ...ds, paramIdx: Math.max(0, ds.paramIdx - 1) } };
      if (id === 'down') return { ...s, dist: { ...ds, paramIdx: Math.min(maxSlot, ds.paramIdx + 1) } };
    }
    if (id === 'equals') {
      try {
        if (ds.editingParam && ds.input.trim()) {
          const sc = evaluateExpression(ds.input, evalContext(s, random));
          const nextListX = [...ds.listX];
          if (ds.paramIdx < nextListX.length) {
            nextListX[ds.paramIdx] = sc.decimal.toString();
          } else if (nextListX.length < 40) {
            nextListX.push(sc.decimal.toString());
          }
          const nextRow = Math.min(40, ds.paramIdx + 1);
          return { ...s, dist: { ...ds, listX: nextListX, paramIdx: nextRow, input: '', editingParam: false } };
        }
        if (ds.paramIdx >= ds.listX.length && ds.listX.length > 0) {
          return { ...s, dist: { ...ds, editingListTable: false, paramIdx: 0, input: '', editingParam: false } };
        }
        if (ds.paramIdx < ds.listX.length) {
          return { ...s, dist: { ...ds, paramIdx: ds.paramIdx + 1 } };
        }
        return s;
      } catch (err) {
        return errorState(s, err);
      }
    }
    const ch = simpleInputChar(id, s.shift, s.alpha);
    if (ch !== null) {
      return {
        ...s,
        shift: false,
        alpha: false,
        dist: { ...ds, input: (ds.editingParam ? ds.input : '') + ch, editingParam: true },
      };
    }
    return s;
  }

  if (id === 'ac') {
    if (ds.editingParam) return { ...s, dist: { ...ds, input: '', editingParam: false } };
    if (ds.listMode) {
      return { ...s, dist: { ...ds, editingListTable: true, paramIdx: 0, input: '', editingParam: false } };
    }
    return { ...s, screen: 'dist-menu' };
  }
  if (id === 'del' && ds.editingParam) {
    const next = ds.input.slice(0, -1);
    return { ...s, dist: { ...ds, input: next, editingParam: next.length > 0 } };
  }

  // Toggle Var / List mode with left/right when not editing
  if (!ds.editingParam && (id === 'left' || id === 'right') && ds.subMode !== 'norm-cd' && ds.subMode !== 'inv-norm') {
    return { ...s, dist: createDistState(ds.subMode, !ds.listMode) };
  }

  const totalSlots = ds.params.length;
  if (!ds.editingParam && totalSlots > 0) {
    if (id === 'up') return { ...s, dist: { ...ds, paramIdx: (ds.paramIdx - 1 + totalSlots) % totalSlots } };
    if (id === 'down') return { ...s, dist: { ...ds, paramIdx: (ds.paramIdx + 1) % totalSlots } };
  }

  if (id === 'equals') {
    try {
      const nextParams = ds.params.map((p) => ({ ...p }));
      if (ds.editingParam && ds.input.trim()) {
        const sc = evaluateExpression(ds.input, evalContext(s, random));
        nextParams[ds.paramIdx].value = sc.decimal.toString();
      }
      if (ds.paramIdx + 1 < totalSlots) {
        return { ...s, dist: { ...ds, params: nextParams, paramIdx: ds.paramIdx + 1, input: '', editingParam: false } };
      }

      if (ds.listMode) {
        const restVals = nextParams.map((p) => evaluateExpression(p.value, evalContext(s, random)));
        const listResults = ds.listX.map((xStr) => {
          const xVal = evaluateExpression(xStr, evalContext(s, random));
          const pVal = evalSingleDistScalar(ds.subMode, xVal, restVals);
          return { x: formatDecimal(xVal, s.numberFormat, s.decimalMark), p: formatDecimal(pVal, s.numberFormat, s.decimalMark) };
        });
        return {
          ...s,
          phase: 'result',
          dist: { ...ds, params: nextParams, input: '', editingParam: false, listResults, listRowIdx: 0 },
        };
      }

      const vals = nextParams.map((p) => evaluateExpression(p.value, evalContext(s, random)));
      let outScalar;
      switch (ds.subMode) {
        case 'norm-pd': outScalar = normalPd(vals[0], vals[2], vals[1]); break;
        case 'norm-cd': outScalar = normalCd(vals[0], vals[1], vals[3], vals[2]); break;
        case 'inv-norm': outScalar = inverseNormal(vals[0], vals[2], vals[1]); break;
        case 'binom-pd': outScalar = binomialPd(vals[0], vals[1], vals[2]); break;
        case 'binom-cd': outScalar = binomialCd(vals[0], vals[1], vals[2]); break;
        case 'poisson-pd': outScalar = poissonPd(vals[0], vals[1]); break;
        case 'poisson-cd': outScalar = poissonCd(vals[0], vals[1]); break;
      }
      const stored = serialize(outScalar);
      return {
        ...s,
        phase: 'result',
        result: stored,
        preAns: s.ans,
        ans: stored,
        resultFormat: 'decimal',
        dist: { ...ds, params: nextParams, input: '', editingParam: false, result: stored },
      };
    } catch (err) {
      return errorState(s, err);
    }
  }
  const ch = simpleInputChar(id, s.shift, s.alpha);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, dist: { ...ds, input: (ds.editingParam ? ds.input : '') + ch, editingParam: true } };
  }
  return s;
}

function handleTableMode(s: CalculatorState, id: string, random?: number): CalculatorState | null {
  const tbl = s.table!;
  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0 };

  if (tbl.stage === 'view') {
    if (id === 'ac') {
      return { ...s, phase: 'editing', expression: tbl.fExpr, cursor: tbl.fExpr.length, table: { ...tbl, stage: 'f', editingField: false } };
    }
    if (tbl.rows.length > 0) {
      if (id === 'down') return { ...s, table: { ...tbl, selectedRow: (tbl.selectedRow + 1) % tbl.rows.length } };
      if (id === 'up') return { ...s, table: { ...tbl, selectedRow: (tbl.selectedRow - 1 + tbl.rows.length) % tbl.rows.length } };
    }
    return s;
  }

  if (tbl.stage === 'start' || tbl.stage === 'end' || tbl.stage === 'step') {
    const field = tbl.stage === 'start' ? 'startInput' : tbl.stage === 'end' ? 'endInput' : 'stepInput';
    if (id === 'ac') {
      return { ...s, expression: tbl.fExpr, cursor: tbl.fExpr.length, table: { ...tbl, stage: 'f', editingField: false } };
    }
    if (id === 'del') {
      const nextVal = tbl.editingField ? tbl[field].slice(0, -1) : '';
      return { ...s, table: { ...tbl, [field]: nextVal, editingField: true } };
    }
    if (id === 'equals') {
      if (tbl.stage === 'start') return { ...s, table: { ...tbl, stage: 'end', editingField: false } };
      if (tbl.stage === 'end') return { ...s, table: { ...tbl, stage: 'step', editingField: false } };
      try {
        const ctx = evalContext(s, random);
        const start = evaluateExpression(tbl.startInput || '1', ctx);
        const end = evaluateExpression(tbl.endInput || '5', ctx);
        const step = evaluateExpression(tbl.stepInput || '1', ctx);
        const rows = generateFunctionTable(tbl.fExpr, s.tableUseG ? tbl.gExpr : null, start, end, step, ctx);
        return { ...s, phase: 'result', table: { ...tbl, stage: 'view', editingField: false, rows, selectedRow: 0 } };
      } catch (err) {
        return errorState(s, err);
      }
    }
    const ch = simpleInputChar(id, s.shift, s.alpha);
    if (ch !== null) {
      const nextVal = (tbl.editingField ? tbl[field] : '') + ch;
      return { ...s, shift: false, alpha: false, table: { ...tbl, [field]: nextVal, editingField: true } };
    }
    if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
    if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
    return s;
  }

  if (id === 'equals') {
    if (tbl.stage === 'f') {
      if (!s.expression.trim()) return s;
      if (s.tableUseG) {
        return { ...closeLatches(s), expression: tbl.gExpr, cursor: tbl.gExpr.length, table: { ...tbl, stage: 'g', fExpr: s.expression, editingField: false } };
      }
      return { ...closeLatches(s), table: { ...tbl, stage: 'start', fExpr: s.expression, editingField: false } };
    }
    return { ...closeLatches(s), table: { ...tbl, stage: 'start', gExpr: s.expression, editingField: false } };
  }
  return null;
}

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  if (action.type === 'clear-notice') return { ...state, notice: null };
  if (action.type === 'load-scanned-math') {
    const expr = action.expression.trim();
    if (!expr) return state;
    const targetMode = action.mode ?? 'COMP';
    let next = activateModeByName(
      { ...state, screen: 'normal', ioMode: 'Math', shift: false, alpha: false, notice: null },
      targetMode,
    );
    if (action.angle) {
      next = { ...next, angle: action.angle };
    }
    const editingState: CalculatorState = {
      ...resetResultModifiers(next),
      screen: 'normal',
      phase: 'editing',
      expression: expr,
      cursor: expr.length,
      result: null,
      error: null,
      calcPrompt: null,
      solvePrompt: null,
      notice: null,
    };
    if (targetMode === 'COMP' && expr.includes('=')) {
      const solveInit = startSolveWorkflow(editingState);
      if (solveInit.solvePrompt) {
        const solved = handleSolvePrompt(solveInit, 'equals');
        if (!solved.error) return solved;
      }
      return editingState;
    }
    const evaluated = calculatorReducer(editingState, { type: 'key', id: 'equals' });
    return evaluated.error ? editingState : evaluated;
  }
  if (action.type === 'angle') {
    return { ...state, angle: action.angle, screen: 'normal', shift: false, alpha: false };
  }
  if (action.type === 'select-mode') {
    if (state.screen === 'off') return state;
    return activateModeByName(state, action.mode);
  }
  if (action.type === 'insert-token') {
    if (state.screen === 'off') return state;
    return insert({ ...state, screen: 'normal' }, action.token, action.behavior ?? 'fresh');
  }

  const { id } = action;
  if (state.screen === 'off') {
    return id === 'on'
      ? { ...resetResultModifiers(state), screen: 'normal', phase: 'editing', expression: '', cursor: 0, result: null, error: null, notice: null }
      : state;
  }
  if (id === 'on') {
    const safeBase = state.screen !== 'normal' ? cancelMenuToSafeNormal(state) : state;
    return {
      ...resetResultModifiers(safeBase),
      screen: 'normal',
      phase: 'editing',
      expression: '',
      cursor: 0,
      result: null,
      error: null,
      calcPrompt: null,
      solvePrompt: null,
      notice: null,
    };
  }
  if (state.screen !== 'normal') return handleMenu(state, id);

  // Global error screen recovery ([AC] :Cancel / [◀][▶]:Goto) across ALL 11 modes!
  if (state.phase === 'error') {
    if (id === 'shift') return { ...state, shift: !state.shift, alpha: false };
    if (id === 'mode') {
      return {
        ...resetResultModifiers(closeLatches(state)),
        phase: 'editing',
        error: null,
        screen: state.shift ? 'setup' : 'mode',
        menuPage: 0,
      };
    }
    if (id === 'ac') {
      if (state.shift) return { ...closeLatches(state), phase: 'editing', error: null, screen: 'off' };
      const isExprMode = ['COMP', 'CMPLX', 'BASE-N', 'VERIF'].includes(state.mode) ||
        (state.mode === 'STAT' && !state.stat.editingTable) ||
        (state.mode === 'MATRIX' && !state.matrix.editingTarget) ||
        (state.mode === 'VECTOR' && !state.vector.editingTarget);
      return {
        ...resetResultModifiers(closeLatches(state)),
        phase: 'editing',
        error: null,
        result: null,
        expression: isExprMode ? '' : state.expression,
        cursor: isExprMode ? 0 : state.cursor,
      };
    }
    if (id === 'left' || id === 'right') {
      const gotoPos =
        state.errorCursor !== null
          ? state.errorCursor
          : id === 'left'
            ? state.expression.length
            : 0;
      return {
        ...resetResultModifiers(closeLatches(state)),
        phase: 'editing',
        error: null,
        result: null,
        cursor: gotoPos,
      };
    }
    return state;
  }

  // Active sub-prompts & interactive editors
  if (state.calcPrompt) return handleCalcPrompt(state, id, action.random);
  if (state.solvePrompt) return handleSolvePrompt(state, id, action.random);
  if (state.mode === 'EQN' && state.eqn) return handleEqnMode(state, id, action.random);
  if (state.mode === 'INEQ' && state.ineq) return handleIneqMode(state, id, action.random);
  if (state.mode === 'DIST' && state.dist) return handleDistMode(state, id, action.random);
  if (state.mode === 'STAT' && state.stat.editingTable) return handleStatTableEditor(state, id, action.random);
  if (state.mode === 'MATRIX' && state.matrix.editingTarget) return handleMatrixCellEditor(state, id, action.random);
  if (state.mode === 'VECTOR' && state.vector.editingTarget) return handleVectorCellEditor(state, id, action.random);
  if (state.mode === 'TABLE' && state.table) {
    const tblNext = handleTableMode(state, id, action.random);
    if (tblNext) return tblNext;
  }

  // Navigating Matrix / Vector result cells with wrap-around arrows + S⇔D toggle
  if (state.mode === 'MATRIX' && state.phase === 'result' && state.matrix.showingMatrixResult && state.matrix.matrices.MatAns) {
    const mAns = state.matrix.matrices.MatAns;
    if (id === 'up') return { ...state, matrix: { ...state.matrix, rowIdx: (state.matrix.rowIdx - 1 + mAns.rows) % mAns.rows } };
    if (id === 'down') return { ...state, matrix: { ...state.matrix, rowIdx: (state.matrix.rowIdx + 1) % mAns.rows } };
    if (id === 'left') return { ...state, matrix: { ...state.matrix, colIdx: (state.matrix.colIdx - 1 + mAns.cols) % mAns.cols } };
    if (id === 'right') return { ...state, matrix: { ...state.matrix, colIdx: (state.matrix.colIdx + 1) % mAns.cols } };
    if (id === 'sd' && !state.shift && !state.alpha) {
      return { ...state, resultFormat: state.resultFormat === 'exact' ? 'decimal' : 'exact' };
    }
  }
  if (state.mode === 'VECTOR' && state.phase === 'result' && state.vector.showingVectorResult && state.vector.vectors.VctAns) {
    const vAns = state.vector.vectors.VctAns;
    if (id === 'left' || id === 'up') return { ...state, vector: { ...state.vector, coordIdx: (state.vector.coordIdx - 1 + vAns.dim) % vAns.dim } };
    if (id === 'right' || id === 'down') return { ...state, vector: { ...state.vector, coordIdx: (state.vector.coordIdx + 1) % vAns.dim } };
    if (id === 'sd' && !state.shift && !state.alpha) {
      return { ...state, resultFormat: state.resultFormat === 'exact' ? 'decimal' : 'exact' };
    }
  }

  if (id === 'shift') return { ...state, shift: !state.shift, alpha: false, notice: null };
  if (id === 'alpha') return { ...state, alpha: !state.alpha, shift: false, notice: null };

  if (state.pending) {
    const name = ALPHA_KEYS[id];
    if (!name) {
      if (id === 'ac') return { ...state, pending: null, shift: false, alpha: false, notice: null };
      return state;
    }
    if (state.pending === 'recall') {
      if (
        (state.phase === 'result' || state.expression.trim() === '') &&
        (state.mode === 'COMP' || state.mode === 'STAT' || state.mode === 'CMPLX' || state.mode === 'MATRIX' || state.mode === 'VECTOR')
      ) {
        const recalledVal = state.variables[name];
        const recalledScalar = deserialize(recalledVal);
        return {
          ...resetResultModifiers(state),
          expression: name,
          cursor: name.length,
          phase: 'result',
          result: recalledVal,
          resultFormat: effectiveResultFormat(state, defaultResultFormat(recalledScalar)),
          preAns: state.ans,
          ans: recalledVal,
          cmplx:
            state.mode === 'CMPLX'
              ? {
                  ...state.cmplx,
                  ans: { re: recalledVal, im: zeroStored() },
                  result: { re: recalledVal, im: zeroStored() },
                  partView: 'both',
                }
              : state.cmplx,
          matrix: { ...state.matrix, showingMatrixResult: false },
          vector: { ...state.vector, showingVectorResult: false },
          pending: null,
          shift: false,
          alpha: false,
        };
      }
      return insert({ ...state, pending: null }, name);
    }
    try {
      const storedVal = currentValue(state);
      const valScalar = deserialize(storedVal);
      const baseExpr = state.expression.trim() || 'Ans';
      const stoExpr = baseExpr.endsWith(`→${name}`) ? baseExpr : `${baseExpr}→${name}`;
      return {
        ...resetResultModifiers(state),
        expression: stoExpr,
        cursor: stoExpr.length,
        phase: 'result',
        result: storedVal,
        resultFormat: effectiveResultFormat(state, defaultResultFormat(valScalar)),
        preAns: state.ans,
        ans: storedVal,
        pending: null,
        shift: false,
        alpha: false,
        variables: { ...state.variables, [name]: storedVal },
      };
    } catch (error) {
      return errorState(state, error);
    }
  }

  if (id === 'mode') return { ...closeLatches(state), screen: state.shift ? 'setup' : 'mode', menuPage: 0, hyp: false };
  if (id === 'ac') {
    if (state.shift) return { ...closeLatches(state), screen: 'off', hyp: false, pending: null };
    return {
      ...resetResultModifiers(state),
      expression: '',
      cursor: 0,
      phase: 'editing',
      result: null,
      baseN: { ...state.baseN, result: null },
      error: null,
      shift: false,
      alpha: false,
      hyp: false,
      pending: null,
      historyIndex: null,
      notice: null,
    };
  }

  if (id === 'left' || id === 'right') {
    const lineMode = isLineModeState(state);
    if (state.phase !== 'editing') {
      const nextCursor = id === 'left' ? state.expression.length : 0;
      return { ...resetResultModifiers(state), phase: 'editing', result: null, error: null, cursor: nextCursor, notice: null };
    }
    const nextCursor = stepCursor(state.expression, state.cursor, id === 'left' ? -1 : 1, lineMode);
    return { ...state, phase: 'editing', error: null, cursor: nextCursor, notice: null };
  }
  if (id === 'up' || id === 'down') {
    if (state.phase === 'editing') {
      const vNext = moveCursorVertical(state.expression, state.cursor, id, isLineModeState(state));
      if (vNext !== null) {
        return { ...state, phase: 'editing', error: null, cursor: vNext, notice: null };
      }
    }
    return navigateHistory(state, id);
  }

  if (id === 'del') {
    if (state.shift) {
      return { ...closeLatches(state), insertMode: !state.insertMode };
    }
    if (state.phase !== 'editing') {
      return { ...resetResultModifiers(state), phase: 'editing', result: null, error: null, cursor: state.expression.length, notice: null };
    }
    if (!state.cursor) return { ...state, phase: 'editing', error: null, notice: null };
    const updated = deleteBeforeCursor(state.expression, state.cursor, isLineModeState(state));
    return {
      ...resetResultModifiers(state),
      expression: updated.expression,
      cursor: updated.cursor,
      phase: 'editing',
      result: null,
      error: null,
      shift: false,
      alpha: false,
      notice: null,
    };
  }

  // SHIFT + = in CMPLX result phase toggles Re⇔Im (or r⇔∠θ in polar)
  if (state.shift && id === 'equals' && state.mode === 'CMPLX' && state.phase === 'result' && state.cmplx.result) {
    const nextView =
      state.cmplx.partView === 'both'
        ? 'first'
        : state.cmplx.partView === 'first'
          ? 'second'
          : 'both';
    return { ...closeLatches(state), cmplx: { ...state.cmplx, partView: nextView } };
  }

  if (id === 'equals') {
    const forceApprox = state.shift;
    const evaluated = calculate(closeLatches(state), action.random);
    if (forceApprox && evaluated.phase === 'result') {
      return { ...evaluated, resultFormat: 'decimal', displayOverride: 'none' };
    }
    return evaluated;
  }

  // BASE-N specific physical shortcuts
  if (state.mode === 'BASE-N' && !state.shift && !state.alpha) {
    const baseSwitch: Record<string, BaseMode> = { square: 'DEC', power: 'HEX', log: 'BIN', ln: 'OCT' };
    if (baseSwitch[id]) {
      return {
        ...state,
        baseN: { ...state.baseN, base: baseSwitch[id] },
        expression: state.phase === 'result' ? '' : state.expression,
        cursor: state.phase === 'result' ? 0 : state.cursor,
      };
    }
    // Check if an explicit base prefix (d, h, b, o) precedes cursor (not part of 'and' etc.)
    const before = state.phase === 'editing' ? state.expression.slice(0, state.cursor) : '';
    const prefMatch = before.match(/(?:^|[^a-zA-Z])([dhbo])[0-9A-F]*$/);
    const activeBase: BaseMode = prefMatch
      ? (prefMatch[1] === 'd' ? 'DEC' : prefMatch[1] === 'h' ? 'HEX' : prefMatch[1] === 'b' ? 'BIN' : 'OCT')
      : state.baseN.base;

    if (activeBase === 'HEX' && BASEN_HEX_KEYS[id]) {
      return insert(state, BASEN_HEX_KEYS[id]);
    }
    if (/^[0-9]$/.test(id)) {
      const digit = Number(id);
      if (activeBase === 'BIN' && digit > 1) return state;
      if (activeBase === 'OCT' && digit > 7) return state;
      return insert(state, id);
    }
    if (!['add', 'subtract', 'multiply', 'divide', 'open', 'close', 'ans', 'basen-and', 'basen-or', 'basen-xor', 'basen-xnor', 'basen-not', 'basen-neg'].includes(id)) {
      return state;
    }
  }

  if (state.alpha) {
    const s = closeLatches(state);
    if (id === 'exp' || id === 'ln') return insert(s, 'e');
    if (id === 'cube' || id === 'integ') return insert(s, ':', 'continue');
    if (id === 'logbase') return ternaryTemplate(s, 'prod');
    if (id === 'eng' && s.mode === 'CMPLX') return insert(s, 'i');
    if (id === 'dot') return functionTemplate(s, 'RanInt');
    if (id === 'calc') return insert(s, '=', 'continue');
    if (id === 'multiply') return functionTemplate(s, 'GCD');
    if (id === 'divide') return functionTemplate(s, 'LCM');
    if (id === 'add') return functionTemplate(s, 'Int');
    if (id === 'subtract') return functionTemplate(s, 'Intg');
    if (id === 'frac') return insert(s, '÷R', 'continue');
    if (id === 'sqrt') return insertRecurringTemplate(s);
    if (id === 'ans') return insert(s, 'PreAns');
    const variable = ALPHA_KEYS[id];
    return variable ? insert(s, variable) : s;
  }

  if (state.shift) {
    const s = closeLatches(state);
    switch (id) {
      case 'mode': return { ...s, screen: 'setup', menuPage: 0 };
      case '1':
        if (s.mode === 'STAT') return { ...s, screen: 'stat-menu' };
        if (s.mode === 'DIST') return { ...s, screen: 'dist-menu' };
        return activateModeByName(s, 'STAT');
      case '2':
        if (s.mode === 'CMPLX') return { ...s, screen: 'cmplx-menu' };
        return activateModeByName(s, 'CMPLX');
      case '3':
        if (s.mode === 'BASE-N') return { ...s, screen: 'basen-menu', menuPage: 0 };
        return activateModeByName(s, 'BASE-N');
      case '4':
        if (s.mode === 'MATRIX') return { ...s, screen: 'matrix-menu', menuPage: 0 };
        return activateModeByName(s, 'MATRIX');
      case '5':
        if (s.mode === 'VECTOR') return { ...s, screen: 'vector-menu' };
        return activateModeByName(s, 'VECTOR');
      case '6':
        if (s.mode === 'VERIF') return { ...s, screen: 'verif-menu' };
        return activateModeByName(s, 'VERIF');
      case '7': return { ...s, screen: 'const-picker', codeDigits: '', pickerIndex: 0 };
      case '8': return { ...s, screen: 'conv-picker', codeDigits: '', pickerIndex: 0 };
      case '9': return { ...s, screen: 'clear' };
      case 'rcl': return { ...s, pending: 'store' };
      case 'mplus': return updateMemory(s, -1);
      case 'frac': return insertSmartMixedFraction(s);
      case 'inverse': return insert(s, '!', 'continue');
      case 'logbase': return ternaryTemplate(s, 'sigma');
      case 'sqrt': return box1Template(s, 'cbrt');
      case 'square': return insert(s, '^3', 'continue');
      case 'power': return binaryTemplate(s, 'root');
      case 'log': return powerTemplate(s, '10^');
      case 'ln': return powerTemplate(s, 'e^');
      case 'hyp': return box1Template(s, 'abs');
      case 'neg':
        if (s.mode === 'CMPLX') return insert(s, '∠', 'continue');
        return insert(s, '-');
      case 'sin': case 'cos': case 'tan':
        return functionTemplate({ ...s, hyp: false }, `${state.hyp ? 'a' + id + 'h' : 'a' + id}`);
      case 'dms': {
        if (s.phase !== 'result' || !s.result) return s;
        if (s.displayOverride === 'fact') return { ...s, displayOverride: 'none', factoredText: null };
        try {
          const factored = primeFactorize(deserialize(s.result));
          return { ...s, displayOverride: 'fact', factoredText: factored, pairResult: null };
        } catch (err) {
          return errorState(s, err);
        }
      }
      case 'eng': {
        if (s.phase !== 'result' || !s.result) return s;
        const scalar = deserialize(s.result);
        const nextExp = s.displayOverride === 'eng' && s.engExponent !== null
          ? s.engExponent + 3
          : initialEngExponent(scalar) + 3;
        return { ...s, displayOverride: 'eng', engExponent: nextExp, pairResult: null };
      }
      case 'sd': {
        if (s.phase !== 'result' || !s.result) return s;
        const scalar = deserialize(s.result);
        if (!scalar.exact || scalar.exact.d === 1n) {
          return { ...s, resultFormat: s.resultFormat === 'exact' ? 'decimal' : 'exact', displayOverride: 'none' };
        }
        const nextStyle: FractionStyle =
          s.resultFormat === 'decimal' ? 'mixed'
          : s.fractionStyle === 'mixed' ? 'improper' : 'mixed';
        return { ...s, resultFormat: 'exact', fractionStyle: nextStyle, displayOverride: 'none', pairResult: null };
      }
      case 'open': return insert(s, '%', 'continue');
      case 'close': {
        if (s.phase === 'editing' && s.expression[s.cursor] === ',') {
          return { ...s, cursor: s.cursor + 1 };
        }
        return insert(s, ',', 'continue');
      }
      case 'multiply': return insert(s, 'nPr', 'continue');
      case 'divide': return insert(s, 'nCr', 'continue');
      case 'add': return functionTemplate(s, 'Pol');
      case 'subtract': return functionTemplate(s, 'Rec');
      case '0': {
        if (s.phase === 'result' && s.result) {
          const rounded = serialize(roundScalar(deserialize(s.result), s.numberFormat));
          return { ...s, result: rounded, ans: rounded, displayOverride: 'none' };
        }
        return functionTemplate(s, 'Rnd');
      }
      case 'exp': return insert(s, 'π');
      case 'ans': return { ...s, screen: 'drg' };
      case 'calc': return startSolveWorkflow(s);
      case 'integ': return binaryTemplate(s, 'deriv');
      case 'dot': {
        const value = action.random ?? Math.random();
        const safe = Math.max(0, Math.min(0.999, Math.floor(value * 1000) / 1000));
        return insert(s, safe.toFixed(3));
      }
      default: return s;
    }
  }

  const s = { ...state, shift: false, alpha: false, notice: null };
  if (/^[0-9]$/.test(id)) return insert(s, id);
  switch (id) {
    case 'dot': return insert(s, '.');
    case 'add': return insert(s, '+', 'continue');
    case 'subtract': return insert(s, '-', 'continue');
    case 'multiply': return insert(s, '×', 'continue');
    case 'divide': return insert(s, '÷', 'continue');
    case 'neg': return insert(s, '-');
    case 'open': {
      if (!isLineModeState(s) && s.phase === 'editing' && isInsideTemplateSlot(s.expression, s.cursor, false)) {
        return insert(s, '()', 'fresh', 1);
      }
      return insert(s, '(');
    }
    case 'close': {
      if (s.phase === 'editing') {
        const decision = handleSmartCloseParen(s.expression, s.cursor, isLineModeState(s));
        if (decision.action === 'step') {
          return { ...s, cursor: decision.cursor };
        }
      }
      return insert(s, ')', 'continue');
    }
    case 'frac': return insertSmartFraction(s);
    case 'mfrac': return insertSmartMixedFraction(s);
    case 'sqrt': return box1Template(s, 'sqrt');
    case 'cbrt': return box1Template(s, 'cbrt');
    case 'root': return binaryTemplate(s, 'root');
    case 'abs': return box1Template(s, 'abs');
    case 'square': return insert(s, '^2', 'continue');
    case 'cube': return insert(s, '^3', 'continue');
    case 'inverse': return insert(s, '^(-1)', 'continue');
    case 'power': return powerTemplate(s, '^');
    case 'logbase': return binaryTemplate(s, 'logb');
    case 'log': case 'ln': return functionTemplate(s, id);
    case 'dms': {
      if (s.phase === 'result' && s.result) {
        return { ...s, displayOverride: s.displayOverride === 'dms' ? 'none' : 'dms', pairResult: null };
      }
      return insert(s, '°', 'continue');
    }
    case 'eng': {
      if (s.mode === 'CMPLX') return insert(s, 'i');
      if (s.phase !== 'result' || !s.result) return s;
      const scalar = deserialize(s.result);
      const nextExp = s.displayOverride === 'eng' && s.engExponent !== null
        ? s.engExponent - 3
        : initialEngExponent(scalar);
      return { ...s, displayOverride: 'eng', engExponent: nextExp, pairResult: null };
    }
    case 'hyp': return { ...s, hyp: !s.hyp };
    case 'sin': case 'cos': case 'tan':
      return functionTemplate({ ...s, hyp: false }, `${id}${s.hyp ? 'h' : ''}`);
    case 'rcl': return { ...s, pending: 'recall' };
    case 'mplus': return updateMemory(s, 1);
    case 'ans':
      if (s.mode === 'MATRIX' && s.matrix.matrices.MatAns) return insert(s, 'MatAns');
      if (s.mode === 'VECTOR' && s.vector.vectors.VctAns) return insert(s, 'VctAns');
      return insert(s, 'Ans');
    case 'exp': return insert(s, '⏨');
    case 'sd': {
      if (s.phase !== 'result') return s;
      if (s.displayOverride === 'recur') {
        return { ...s, displayOverride: 'none', resultFormat: 'decimal', pairResult: null };
      }
      if (s.displayOverride !== 'none') {
        return { ...s, displayOverride: 'none', engExponent: null, factoredText: null };
      }
      if (s.mode === 'COMP' && s.result && s.recurEnabled && s.resultFormat === 'exact') {
        const sc = deserialize(s.result);
        if (sc.exact && sc.exact.d > 1n && computeRecurringDecimal(sc.exact.n, sc.exact.d)) {
          return { ...s, displayOverride: 'recur', pairResult: null };
        }
      }
      return { ...s, resultFormat: s.resultFormat === 'exact' ? 'decimal' : 'exact', pairResult: null };
    }
    case 'comma': {
      if (s.phase === 'editing' && s.expression[s.cursor] === ',') {
        return { ...s, cursor: s.cursor + 1 };
      }
      return insert(s, ',', 'continue');
    }
    case 'colon': return insert(s, ':', 'continue');
    case 'eq-sign': return insert(s, '=', 'continue');
    case 'imag-i': return insert(s, 'i');
    case 'phasor': return insert(s, '∠', 'continue');
    case 'divr': return insert(s, '÷R', 'continue');
    case 'simp': return insert(s, '▸Simp', 'continue');
    case 'recur': return insertRecurringTemplate(s);
    case 'gcd': return functionTemplate(s, 'GCD');
    case 'lcm': return functionTemplate(s, 'LCM');
    case 'int-fn': return functionTemplate(s, 'Int');
    case 'intg-fn': return functionTemplate(s, 'Intg');
    case 'preans': return insert(s, 'PreAns');
    case 'const-menu': return { ...s, screen: 'const-picker', codeDigits: '', pickerIndex: 0 };
    case 'conv-menu': return { ...s, screen: 'conv-picker', codeDigits: '', pickerIndex: 0 };
    case 'context-menu': {
      if (s.mode === 'STAT') return { ...s, screen: 'stat-menu' };
      if (s.mode === 'CMPLX') return { ...s, screen: 'cmplx-menu' };
      if (s.mode === 'BASE-N') return { ...s, screen: 'basen-menu', menuPage: 0 };
      if (s.mode === 'MATRIX') return { ...s, screen: 'matrix-menu', menuPage: 0 };
      if (s.mode === 'VECTOR') return { ...s, screen: 'vector-menu' };
      if (s.mode === 'VERIF') return { ...s, screen: 'verif-menu' };
      if (s.mode === 'DIST') return { ...s, screen: 'dist-menu' };
      return { ...s, screen: 'mode', menuPage: 0 };
    }
    case 'pi': return insert(s, 'π');
    case 'e': return insert(s, 'e');
    case 'var-x': return insert(s, 'X');
    case 'var-y': return insert(s, 'Y');
    case 'percent': return insert(s, '%', 'continue');
    case 'toggle-ins': return { ...closeLatches(state), insertMode: !state.insertMode };
    case 'factorial': return insert(s, '!', 'continue');
    case 'ncr': return insert(s, 'nCr', 'continue');
    case 'npr': return insert(s, 'nPr', 'continue');
    case 'pol': return functionTemplate(s, 'Pol');
    case 'rec': return functionTemplate(s, 'Rec');
    case 'ranint': return functionTemplate(s, 'RanInt');
    case 'rnd': return functionTemplate(s, 'Rnd');
    case 'calc': return startCalcWorkflow(s);
    case 'solve': return startSolveWorkflow(s);
    case 'integ': return ternaryTemplate(s, 'integ');
    case 'deriv': return binaryTemplate(s, 'deriv');
    case 'sigma': return ternaryTemplate(s, 'sigma');
    case 'prod': return ternaryTemplate(s, 'prod');
    case 'basen-and': return insert(s, 'and', 'continue');
    case 'basen-or': return insert(s, 'or', 'continue');
    case 'basen-xor': return insert(s, 'xor', 'continue');
    case 'basen-xnor': return insert(s, 'xnor', 'continue');
    case 'basen-not': return functionTemplate(s, 'Not');
    case 'basen-neg': return functionTemplate(s, 'Neg');
    default: return s;
  }
}

export interface PersistentCalculator {
  version: 1;
  angle: AngleUnit;
  ioMode?: IoMode;
  mathOutputMode?: MathOutputMode;
  decimalMark?: DecimalMark;
  defaultCmplxFormat?: ComplexFormat;
  recurEnabled?: boolean;
  contrast?: number;
  numberFormat?: NumberFormatSetting;
  defaultFractionStyle?: FractionStyle;
  tableUseG?: boolean;
  variables: Record<VariableName, StoredScalar>;
}

export function saveableState(state: CalculatorState): PersistentCalculator {
  return {
    version: 1,
    angle: state.angle,
    ioMode: state.ioMode,
    mathOutputMode: state.mathOutputMode,
    decimalMark: state.decimalMark,
    defaultCmplxFormat: state.defaultCmplxFormat,
    recurEnabled: state.recurEnabled,
    contrast: state.contrast,
    numberFormat: state.numberFormat,
    defaultFractionStyle: state.defaultFractionStyle,
    tableUseG: state.tableUseG,
    variables: state.variables,
  };
}

export function hydrateState(raw: string | null): CalculatorState {
  const state = createInitialState();
  if (!raw) return state;
  try {
    const data = JSON.parse(raw) as Partial<PersistentCalculator>;
    if (data.version !== 1 || !data.variables || !['DEG', 'RAD', 'GRA'].includes(data.angle ?? '')) return state;
    for (const name of VARIABLES) deserialize(data.variables[name]);
    return {
      ...state,
      angle: data.angle as AngleUnit,
      ioMode: data.ioMode === 'Line' ? 'Line' : 'Math',
      mathOutputMode: data.mathOutputMode === 'LineO' ? 'LineO' : 'MathO',
      decimalMark: data.decimalMark === 'Comma' ? 'Comma' : 'Dot',
      defaultCmplxFormat: data.defaultCmplxFormat === 'polar' ? 'polar' : 'rect',
      recurEnabled: data.recurEnabled !== false,
      contrast: typeof data.contrast === 'number' ? Math.max(1, Math.min(10, data.contrast)) : 5,
      numberFormat: data.numberFormat ?? DEFAULT_NUMBER_FORMAT,
      defaultFractionStyle: data.defaultFractionStyle === 'mixed' ? 'mixed' : 'improper',
      fractionStyle: data.defaultFractionStyle === 'mixed' ? 'mixed' : 'improper',
      tableUseG: data.tableUseG !== false,
      variables: data.variables,
    };
  } catch {
    return state;
  }
}

export function formatActiveInequalityDisplay(state: CalculatorState): DisplayValue | null {
  if (state.mode !== 'INEQ' || !state.ineq?.solved) return null;
  const res = solveInequality(state.ineq.degree, state.ineq.relation, state.ineq.coeffs.map(deserialize));
  if (state.ioMode === 'Line' || state.mathOutputMode === 'LineO') {
    return {
      type: 'text',
      text: formatInequalityResult(res, state.resultFormat === 'exact', state.numberFormat, state.decimalMark),
    };
  }
  return formatInequalityDisplay(res, state.resultFormat === 'exact', state.numberFormat, state.decimalMark);
}

export function formatActiveComplexDisplay(state: CalculatorState): {
  partLabel: string | null;
  value: DisplayValue;
} | null {
  if (state.mode !== 'CMPLX' || !state.cmplx.result) return null;
  const z = deserializeComplex(state.cmplx.result);
  const preferExact = state.resultFormat === 'exact' && state.ioMode === 'Math' && state.mathOutputMode === 'MathO';
  const fmt: ResultFormat = preferExact ? 'exact' : 'decimal';

  if (state.cmplx.partView !== 'both') {
    if (state.cmplx.format === 'polar') {
      const reZero = z.re.decimal.abs().lt('1e-24');
      const imZero = z.im.decimal.abs().lt('1e-24');
      if (state.cmplx.partView === 'first') {
        const r = absComplex(z, state.angle).re;
        return {
          partLabel: 'r=',
          value: formatResult(r, fmt, { numberFormat: state.numberFormat, decimalMark: state.decimalMark }),
        };
      }
      const theta = reZero && imZero ? scalarFromInteger(0) : argComplex(z, state.angle).re;
      return {
        partLabel: '∠θ=',
        value: formatResult(theta, fmt, { numberFormat: state.numberFormat, decimalMark: state.decimalMark }),
      };
    }

    if (state.cmplx.partView === 'first') {
      return {
        partLabel: 'Re=',
        value: formatResult(z.re, fmt, { numberFormat: state.numberFormat, decimalMark: state.decimalMark }),
      };
    }
    return {
      partLabel: 'Im=',
      value: formatComplex2D(
        { re: scalarFromInteger(0), im: z.im },
        'rect',
        state.angle,
        preferExact,
        state.numberFormat,
        state.decimalMark,
      ),
    };
  }

  if (state.ioMode === 'Line' || state.mathOutputMode === 'LineO') {
    const lin = formatActiveResult(state);
    return lin ? { partLabel: null, value: lin } : null;
  }

  return {
    partLabel: null,
    value: formatComplex2D(
      z,
      state.cmplx.format,
      state.angle,
      state.resultFormat === 'exact',
      state.numberFormat,
      state.decimalMark,
    ),
  };
}

export function formatActiveEqnItemDisplay(
  state: CalculatorState,
  item: { scalar?: ReturnType<typeof deserialize>; complexText?: string; complexParts?: { re: ReturnType<typeof deserialize>; im: ReturnType<typeof deserialize> } },
): DisplayValue {
  if (item.complexParts) {
    if (state.ioMode === 'Math' && state.mathOutputMode === 'MathO') {
      return formatComplex2D(
        item.complexParts,
        'rect',
        state.angle,
        state.resultFormat === 'exact',
        state.numberFormat,
        state.decimalMark,
      );
    }
    if (state.resultFormat === 'decimal') {
      const decText = formatComplexDisplay(item.complexParts, 'rect', state.angle, false, state.numberFormat);
      return { type: 'text', text: state.decimalMark === 'Comma' ? decText.replace(/\./g, ',') : decText };
    }
  }
  if (item.complexText !== undefined) {
    return { type: 'text', text: item.complexText };
  }
  if (item.scalar) {
    const fmt = state.ioMode === 'Line' || state.mathOutputMode === 'LineO' ? 'decimal' : state.resultFormat;
    return formatResult(item.scalar, fmt, {
      fractionStyle: state.fractionStyle,
      numberFormat: state.numberFormat,
      decimalMark: state.decimalMark,
    });
  }
  return { type: 'text', text: '0' };
}

export function formatActiveResult(state: CalculatorState): DisplayValue | null {
  if (state.mode === 'BASE-N') {
    if (state.baseN.result === null) return null;
    return { type: 'text', text: formatBaseN(BigInt(state.baseN.result), state.baseN.base) };
  }
  if (state.mode === 'CMPLX') {
    if (!state.cmplx.result) return null;
    const z = deserializeComplex(state.cmplx.result);
    const text = formatComplexDisplay(
      z,
      state.cmplx.format,
      state.angle,
      state.resultFormat === 'exact',
      state.numberFormat,
    );
    return { type: 'text', text: state.decimalMark === 'Comma' ? text.replace(/\./g, ',') : text };
  }
  if (state.mode === 'VERIF') {
    if (state.verifResult === null) return null;
    return { type: 'text', text: state.verifResult ? 'TRUE' : 'FALSE' };
  }
  if (state.mode === 'INEQ' && state.ineq?.solved) {
    const res = solveInequality(state.ineq.degree, state.ineq.relation, state.ineq.coeffs.map(deserialize));
    return {
      type: 'text',
      text: formatInequalityResult(res, state.resultFormat === 'exact', state.numberFormat, state.decimalMark),
    };
  }
  if (state.pairResult) return state.pairResult;
  if (!state.result) return null;
  return formatResult(deserialize(state.result), state.resultFormat, {
    fractionStyle: state.fractionStyle,
    numberFormat: state.numberFormat,
    override: state.displayOverride,
    engExponent: state.engExponent,
    factoredText: state.factoredText,
    decimalMark: state.decimalMark,
  });
}
