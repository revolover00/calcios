import { evaluateBaseN, formatBaseN, scalarToBaseNInt32, type BaseMode } from './basen';
import { solveRoot } from './calculus';
import {
  addComplex, argComplex, absComplex, deserializeComplex, evaluateComplex, formatComplex2D, formatComplexDisplay,
  serializeComplex, subComplex, zeroStoredComplex,
  type ComplexFormat, type StoredComplex,
} from './cmplx';
import { CONSTANT_BY_CODE, CONVERSION_BY_CODE, SCIENTIFIC_CONSTANTS, UNIT_CONVERSIONS } from './constants';
import {
  binomialCd, binomialPd, inverseNormal, normalCd, normalPd, poissonCd, poissonPd,
  type DistSubMode,
} from './dist';
import { solveEqn, type EqnOutcome, type EqnType } from './eqn';
import { CalculatorError, mathError } from './errors';
import {
  STAT_TOKEN_LABELS, evaluateExpression, evaluateRichExpression, extractVariables,
  parseAssignmentStatement, splitEquation, splitStatements,
} from './expression';
import {
  extractTrailingOperandSpan, handleSmartCloseParen, isInsideTemplateSlot, isSafeOverwriteAt,
  moveCursorHorizontal, moveCursorVertical, normalizeMathCursor, smartDeleteBeforeCursor,
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
import { solveRatio, type RatioForm } from './ratio';

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
  | 'DIST'
  | 'RATIO';

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
  | 'ratio-menu'
  | 'ratio-editor'
  | 'off';

export interface HistoryEntry {
  expression: string;
  result: StoredScalar;
  mode?: ActiveMode;
}

export interface CalcPromptState {
  sourceExpr: string;
  vars: VariableName[];
  index: number;
  input: string;
}

export interface SolvePromptState {
  sourceExpr: string;
  stage: 'prompt-x' | 'prompt-var' | 'solved';
  input: string;
  targetVar?: VariableName;
  targetExplicit?: boolean;
  promptVars?: VariableName[];
  promptIndex?: number;
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
  partView?: 'both' | 're' | 'im';
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
  varsIm: Record<VariableName, StoredScalar>;
  preAns: StoredComplex;
  result: StoredComplex | null;
  format: ComplexFormat;
  partView: 'both' | 'first' | 'second';
}

export interface RatioModeState {
  form: RatioForm | null;
  coeffs: StoredScalar[];
  cursorIndex: number;
  input: string;
  editingCell: boolean;
  solved: boolean;
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
  ratio: RatioModeState;
  notice: string | null;
}

export type CalculatorAction =
  | { type: 'key'; id: string; random?: number }
  | { type: 'insert-token'; token: string; behavior?: 'fresh' | 'continue' }
  | { type: 'select-mode'; mode: string }
  | { type: 'angle'; angle: AngleUnit }
  | { type: 'load-scanned-math'; expression: string; mode?: 'COMP' | 'CMPLX'; angle?: AngleUnit }
  | { type: 'clear-notice' };

function clearComplexImagForRealWrites(
  cmplx: CmplxModeState,
  names: readonly VariableName[],
): CmplxModeState {
  if (names.length === 0) return cmplx;
  let varsIm = cmplx.varsIm;
  for (const name of names) varsIm = { ...varsIm, [name]: zeroStored() };
  return { ...cmplx, varsIm };
}

function zeroVariables(): Record<VariableName, StoredScalar> {
  return Object.fromEntries(VARIABLES.map((v) => [v, zeroStored()])) as Record<VariableName, StoredScalar>;
}

function createDefaultBaseN(): BaseNState {
  return { base: 'DEC', ans: '0', result: null };
}

function createDefaultCmplx(format: ComplexFormat = 'rect'): CmplxModeState {
  return { varsIm: zeroVariables(), ans: zeroStoredComplex(), preAns: zeroStoredComplex(), result: null, format, partView: 'both' };
}

function createDefaultRatio(form: RatioForm | null = null): RatioModeState {
  return { form, coeffs: Array.from({ length: 3 }, () => zeroStored()), cursorIndex: 0, input: '', editingCell: false, solved: false };
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
    ratio: createDefaultRatio(),
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
const extraModes: ActiveMode[] = ['INEQ', 'VERIF', 'DIST', 'RATIO'];

const ONE_DIM_ATOMIC_TOKENS = [
  ...Object.keys(STAT_TOKEN_LABELS),
  'MatAns', 'MatA', 'MatB', 'MatC', 'VctAns', 'VctA', 'VctB', 'VctC',
  'Conjg(', 'Angle(', 'Rref(', 'Ref(', 'arg(', 'det(', 'Trn(',
  'StatP(', 'StatQ(', 'StatR(', 'Intg(', 'GCD(', 'LCM(', 'Int(',
  '▸xhat2', '▸Simp', '▸r∠θ', '▸a+bi', '▸yhat', '▸xhat', '▸t', '÷R',
  'RanInt(', 'asinh(', 'acosh(', 'atanh(',
  'sinh(', 'cosh(', 'tanh(', 'asin(', 'acos(', 'atan(',
  'Pol(', 'Rec(', 'Rnd(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(',
  'Not(', 'Neg(', '×10^(', 'PreAns', '^(-1)', 'Ran#', '^2', '^3',
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
  let replaceStart = cursor;
  let replaceEnd = cursor;
  if (canOverwrite) {
    const atomHit = findAtomicSpans(expression, isLineModeState(s)).find(
      ([st, en]) => cursor >= st && cursor < en,
    );
    if (atomHit) {
      replaceStart = atomHit[0];
      replaceEnd = atomHit[1];
    } else {
      replaceEnd = cursor + 1;
    }
  }
  const nextExpr = expression.slice(0, replaceStart) + text + expression.slice(replaceEnd);
  return {
    ...resetResultModifiers(s),
    expression: nextExpr,
    cursor: replaceStart + caretOffset,
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
  if (isLineModeState(s)) return functionTemplate(s, 'mfrac');
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
  const preservedExpr = s.solvePrompt?.sourceExpr ?? s.calcPrompt?.sourceExpr ?? s.expression;
  const boundedOffset =
    typeof error.offset === 'number'
      ? Math.max(0, Math.min(preservedExpr.length, error.offset))
      : null;
  return {
    ...resetResultModifiers(s),
    expression: preservedExpr,
    cursor: preservedExpr.length,
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
      statContext = { subMode: s.stat.subMode, summary: computeStatSummary(s.stat.subMode, s.stat.rows, s.stat.useFreq) };
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
    rng: random === undefined ? () => Math.random() : undefined,
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
  let writtenVariables: VariableName[] = assign ? [assign.target] : [];
  let pairResult: DisplayValue | null = null;

  if (outcome.pairKind && outcome.secondary) {
    const secStored = serialize(outcome.secondary);
    if (outcome.pairKind === 'divr') {
      variables = { ...s.variables, E: primaryStored, F: secStored };
      writtenVariables = ['E', 'F'];
      pairResult = {
        type: 'pair',
        label1: 'Q',
        value1: formatDecimal(outcome.primary, s.numberFormat, s.decimalMark),
        label2: 'R',
        value2: formatDecimal(outcome.secondary, s.numberFormat, s.decimalMark),
      };
    } else {
      variables = { ...s.variables, X: primaryStored, Y: secStored };
      writtenVariables = ['X', 'Y'];
      pairResult = {
        type: 'pair',
        label1: outcome.pairKind === 'pol' ? 'r' : 'X',
        value1: formatDecimal(outcome.primary, s.numberFormat, s.decimalMark),
        label2: outcome.pairKind === 'pol' ? 'θ' : 'Y',
        value2: formatDecimal(outcome.secondary, s.numberFormat, s.decimalMark),
      };
    }
  }

  const cmplxAfterWrite = clearComplexImagForRealWrites(s.cmplx, writtenVariables);
  const autoDms = !pairResult && hasTopLevelDms(exprToEval);
  const history = [...s.history, { expression: recordExpr, result: primaryStored, mode: s.mode }].slice(-40);
  return {
    ...resetResultModifiers(s),
    phase: 'result',
    result: primaryStored,
    pairResult,
    displayOverride: autoDms ? 'dms' : 'none',
    preAns: s.ans,
    ans: primaryStored,
    variables,
    cmplx: cmplxAfterWrite,
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
      const assign = parseAssignmentStatement(s.expression);
      const exprToEval = assign ? assign.rhs : s.expression;
      const val = evaluateBaseN(exprToEval, s.baseN.base, prevAns, s.variables);
      const serialized = val.toString();
      const storedInt = serialize(scalarFromInteger(val));
      const variables = assign ? { ...s.variables, [assign.target]: storedInt } : s.variables;
      const history = [...s.history, { expression: s.expression, result: storedInt, mode: s.mode }].slice(-40);
      return {
        ...resetResultModifiers(s),
        phase: 'result',
        result: storedInt,
        variables,
        cmplx: clearComplexImagForRealWrites(s.cmplx, assign ? [assign.target] : []),
        baseN: { ...s.baseN, ans: serialized, result: serialized },
        history,
        historyIndex: null,
        error: null,
        shift: false,
        alpha: false,
        hyp: false,
        pending: null,
        notice: null,
      };
    }

    if (s.mode === 'CMPLX') {
      const assign = parseAssignmentStatement(s.expression);
      const exprToEval = assign ? assign.rhs : s.expression;
      const out = evaluateComplex(exprToEval, {
        angle: s.angle,
        variables: s.variables,
        varsIm: s.cmplx.varsIm,
        cmplxAns: s.cmplx.ans,
        cmplxPreAns: s.cmplx.preAns,
        preAns: s.preAns,
        random,
        rng: random === undefined ? () => Math.random() : undefined,
        numberFormat: s.numberFormat,
      });
      const storedZ = serializeComplex(out.value);
      const variables = assign ? { ...s.variables, [assign.target]: storedZ.re } : s.variables;
      const varsIm = assign ? { ...s.cmplx.varsIm, [assign.target]: storedZ.im } : s.cmplx.varsIm;
      const history = [...s.history, { expression: s.expression, result: storedZ.re, mode: s.mode }].slice(-40);
      return {
        ...resetResultModifiers(s),
        phase: 'result',
        result: storedZ.re,
        preAns: s.ans,
        ans: storedZ.re,
        variables,
        resultFormat: effectiveResultFormat(s, 'exact'),
        cmplx: {
          ...s.cmplx, varsIm,
          ans: storedZ,
          preAns: s.cmplx.ans,
          result: storedZ,
          format: out.preferredFormat ?? s.defaultCmplxFormat,
          partView: 'both',
        },
        history,
        historyIndex: null,
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
        preAns: s.preAns,
        angle: s.angle,
        numberFormat: s.numberFormat,
        rng: random !== undefined ? () => random : undefined,
      });
      if (out.kind === 'scalar') {
        const stored = serialize(out.scalar);
        const history = [...s.history, { expression: s.expression, result: stored, mode: s.mode }].slice(-40);
        return {
          ...resetResultModifiers(s),
          phase: 'result',
          result: stored,
          preAns: s.ans,
          ans: stored,
          resultFormat: effectiveResultFormat(s, defaultResultFormat(out.scalar)),
          history,
          historyIndex: null,
          error: null,
          shift: false,
          alpha: false,
        };
      }
      const storedMat = serializeMatrix(out.matrix);
      const history = [...s.history, { expression: s.expression, result: s.ans, mode: s.mode }].slice(-40);
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
        history,
        historyIndex: null,
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
        preAns: s.preAns,
        angle: s.angle,
        numberFormat: s.numberFormat,
        rng: random !== undefined ? () => random : undefined,
      });
      if (out.kind === 'scalar') {
        const stored = serialize(out.scalar);
        const history = [...s.history, { expression: s.expression, result: stored, mode: s.mode }].slice(-40);
        return {
          ...resetResultModifiers(s),
          phase: 'result',
          result: stored,
          preAns: s.ans,
          ans: stored,
          resultFormat: effectiveResultFormat(s, defaultResultFormat(out.scalar)),
          history,
          historyIndex: null,
          error: null,
          shift: false,
          alpha: false,
        };
      }
      const storedVct = serializeVector(out.vector);
      const history = [...s.history, { expression: s.expression, result: s.ans, mode: s.mode }].slice(-40);
      return {
        ...resetResultModifiers(s),
        phase: 'result',
        vector: {
          ...s.vector,
          vectors: { ...s.vector.vectors, VctAns: storedVct },
          showingVectorResult: true,
          coordIdx: 0,
        },
        history,
        historyIndex: null,
        error: null,
        shift: false,
        alpha: false,
      };
    }

    if (s.mode === 'VERIF') {
      const ok = evaluateVerification(s.expression, evalContext(s, random));
      const history = [...s.history, { expression: s.expression, result: s.ans, mode: s.mode }].slice(-40);
      return {
        ...resetResultModifiers(s),
        phase: 'result',
        verifResult: ok,
        history,
        historyIndex: null,
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

    if (s.expression.includes('=') && !parseAssignmentStatement(s.expression)) {
      return startSolveWorkflow(s);
    }

    return evaluateSingleStatement(s, s.expression, s.expression, random);
  } catch (error) {
    return errorState(s, error);
  }
}

function currentValue(s: CalculatorState): StoredScalar {
  if (s.phase === 'result') {
    if (s.mode === 'MATRIX' && s.matrix.showingMatrixResult) {
      throw new CalculatorError('Argument ERROR', 'Cannot store matrix in scalar variable');
    }
    if (s.mode === 'VECTOR' && s.vector.showingVectorResult) {
      throw new CalculatorError('Argument ERROR', 'Cannot store vector in scalar variable');
    }
    if (s.mode === 'CMPLX' && s.cmplx.result && !deserialize(s.cmplx.result.im).decimal.isZero()) {
      mathError('Cannot store non-real value in real variable');
    }
    if (s.result) return s.result;
  }
  if (!s.expression.trim()) {
    if (s.mode === 'BASE-N') return serialize(scalarFromInteger(BigInt(s.baseN.ans)));
    if (s.mode === 'CMPLX') {
      if (!deserialize(s.cmplx.ans.im).decimal.isZero()) mathError('Cannot store non-real Ans in real variable');
      return s.cmplx.ans.re;
    }
    return s.ans;
  }
  if (s.mode === 'BASE-N') {
    const val = evaluateBaseN(s.expression, s.baseN.base, BigInt(s.baseN.ans), s.variables);
    return serialize(scalarFromInteger(val));
  }
  if (s.mode === 'CMPLX') {
    const out = evaluateComplex(s.expression, {
      angle: s.angle,
      variables: s.variables,
      varsIm: s.cmplx.varsIm,
      cmplxAns: s.cmplx.ans,
      preAns: s.preAns,
      numberFormat: s.numberFormat,
    });
    if (!out.value.im.decimal.isZero()) mathError('Cannot store non-real value in real variable');
    return serialize(out.value.re);
  }
  if (s.mode === 'MATRIX') {
    const out = evaluateMatrixExpression(s.expression, {
      matrices: s.matrix.matrices,
      variables: s.variables,
      ans: s.ans,
      preAns: s.preAns,
      angle: s.angle,
      numberFormat: s.numberFormat,
    });
    if (out.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Cannot store matrix in scalar variable');
    return serialize(out.scalar);
  }
  if (s.mode === 'VECTOR') {
    const out = evaluateVectorExpression(s.expression, {
      vectors: s.vector.vectors,
      variables: s.variables,
      ans: s.ans,
      preAns: s.preAns,
      angle: s.angle,
      numberFormat: s.numberFormat,
    });
    if (out.kind !== 'scalar') throw new CalculatorError('Argument ERROR', 'Cannot store vector in scalar variable');
    return serialize(out.scalar);
  }
  return serialize(evaluateExpression(s.expression, evalContext(s)));
}

function currentComplexValue(s: CalculatorState, random?: number): ReturnType<typeof deserializeComplex> {
  if (s.phase === 'result' && s.cmplx.result) return deserializeComplex(s.cmplx.result);
  if (!s.expression.trim()) return deserializeComplex(s.cmplx.ans);
  return evaluateComplex(s.expression, {
    angle: s.angle, variables: s.variables, varsIm: s.cmplx.varsIm,
    cmplxAns: s.cmplx.ans, cmplxPreAns: s.cmplx.preAns, preAns: s.preAns,
    random, numberFormat: s.numberFormat,
  }).value;
}

function updateMemory(s: CalculatorState, direction: 1 | -1): CalculatorState {
  if (s.mode === 'CMPLX') {
    try {
      const current = currentComplexValue(s);
      const memory = { re: deserialize(s.variables.M), im: deserialize(s.cmplx.varsIm.M) };
      const updated = direction === 1 ? addComplex(memory, current) : subComplex(memory, current);
      const storedZ = serializeComplex(updated);
      const wasEditing = s.phase === 'editing' && s.expression.trim().length > 0;
      const history = wasEditing
        ? [...s.history, { expression: s.expression, result: serialize(current.re), mode: s.mode }].slice(-40)
        : s.history;
      return {
        ...resetResultModifiers(s),
        phase: wasEditing ? 'result' : s.phase,
        result: wasEditing ? serialize(current.re) : s.result,
        preAns: wasEditing ? s.ans : s.preAns,
        ans: wasEditing ? serialize(current.re) : s.ans,
        variables: { ...s.variables, M: storedZ.re },
        cmplx: {
          ...s.cmplx, varsIm: { ...s.cmplx.varsIm, M: storedZ.im },
          preAns: wasEditing ? s.cmplx.ans : s.cmplx.preAns,
          ans: wasEditing ? serializeComplex(current) : s.cmplx.ans,
          result: wasEditing ? serializeComplex(current) : s.cmplx.result,
        },
        history, historyIndex: null, pending: null, shift: false, alpha: false, hyp: false,
      };
    } catch (error) {
      return errorState(s, error);
    }
  }
  try {
    const storedCurrent = currentValue(s);
    const current = deserialize(storedCurrent);
    const memory = deserialize(s.variables.M);
    const updated = direction === 1 ? add(memory, current) : subtract(memory, current);
    const wasEditing = s.phase === 'editing' && s.expression.trim().length > 0;
    const baseState = wasEditing ? resetResultModifiers(s) : s;
    const history = wasEditing
      ? [...s.history, { expression: s.expression, result: storedCurrent, mode: s.mode }].slice(-40)
      : s.history;
    return {
      ...baseState,
      phase: wasEditing ? 'result' : s.phase,
      result: wasEditing ? storedCurrent : s.result,
      baseN:
        wasEditing && s.mode === 'BASE-N'
          ? { ...s.baseN, ans: current.decimal.toFixed(0), result: current.decimal.toFixed(0) }
          : baseState.baseN,
      resultFormat: wasEditing ? effectiveResultFormat(s, defaultResultFormat(current)) : s.resultFormat,
      preAns: wasEditing ? s.ans : s.preAns,
      ans: wasEditing ? storedCurrent : s.ans,
      variables: { ...s.variables, M: serialize(updated) },
      cmplx: { ...s.cmplx, varsIm: { ...s.cmplx.varsIm, M: zeroStored() } },
      history,
      historyIndex: null,
      pending: null,
      shift: false,
      alpha: false,
    };
  } catch (error) {
    return errorState(s, error);
  }
}

export function getModeHistoryIndices(s: CalculatorState): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.history.length; i++) {
    if ((s.history[i].mode ?? 'COMP') === s.mode) out.push(i);
  }
  return out;
}

function navigateHistory(s: CalculatorState, direction: 'up' | 'down'): CalculatorState {
  const modeIndices = getModeHistoryIndices(s);
  if (!modeIndices.length) return s;
  if (s.historyIndex === null) {
    if (direction === 'down') return s;
    if (s.phase === 'editing' && s.expression.length > 0) return s;
    const chosen = modeIndices[modeIndices.length - 1];
    const entry = s.history[chosen];
    return {
      ...resetResultModifiers(s),
      expression: entry.expression,
      cursor: entry.expression.length,
      phase: 'editing',
      result: null,
      error: null,
      historyIndex: chosen,
      notice: null,
    };
  }
  const curPos = modeIndices.indexOf(s.historyIndex);
  if (curPos === -1) {
    return { ...s, historyIndex: null };
  }
  const nextPos = curPos + (direction === 'up' ? -1 : 1);
  if (nextPos >= modeIndices.length) {
    return { ...resetResultModifiers(s), expression: '', cursor: 0, phase: 'editing', result: null, error: null, historyIndex: null, notice: null };
  }
  const boundedPos = Math.max(0, nextPos);
  const chosen = modeIndices[boundedPos];
  const entry = s.history[chosen];
  return {
    ...resetResultModifiers(s),
    expression: entry.expression,
    cursor: entry.expression.length,
    phase: 'editing',
    result: null,
    error: null,
    historyIndex: chosen,
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
    historyIndex: null,
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
      return { ...baseReset, mode: 'CMPLX', cmplx: { ...createDefaultCmplx(s.defaultCmplxFormat), varsIm: s.cmplx.varsIm } };
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
    case 'RATIO':
      return { ...baseReset, mode: 'RATIO', screen: 'ratio-menu', ratio: createDefaultRatio() };
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

  if (s.screen === 'ratio-menu') {
    if (id === '1' || id === '2') {
      const form: RatioForm = id === '1' ? 'a:b=X:d' : 'a:b=c:X';
      return { ...s, mode: 'RATIO', screen: 'ratio-editor', ratio: createDefaultRatio(form) };
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
      const nextSub = types[id];
      const keepRows =
        s.mode === 'STAT' &&
        (nextSub === s.stat.subMode || (s.stat.subMode !== '1-VAR' && nextSub !== '1-VAR'));
      return {
        ...s,
        mode: 'STAT',
        screen: 'normal',
        stat: keepRows
          ? {
              ...s.stat,
              subMode: nextSub,
              editingTable: true,
              rowIdx: 0,
              colIdx: 0,
              cellInput: '',
              editingCell: false,
            }
          : createDefaultStat(nextSub, s.stat.useFreq),
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
      if (id === '1') return { ...s, screen: 'setup-matho', menuPage: 0 };
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
        stat: { ...s.stat, rows: [], rowIdx: 0, colIdx: 0, cellInput: '', editingCell: false },
        matrix: createDefaultMatrix(),
        vector: createDefaultVector(),
        history: [],
        historyIndex: null,
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
      stat: { ...s.stat, useFreq: false },
      clearTarget: null,
    };
  }
  return s;
}

function deleteSimpleInput(raw: string): string {
  return deleteBeforeCursor(raw, raw.length, true).expression;
}

function simpleInputChar(id: string, shift: boolean, alpha: boolean, hyp = false): string | null {
  if (/^[0-9]$/.test(id)) return id;
  if (shift && id === 'exp') return 'π';
  if (alpha && (id === 'exp' || id === 'ln')) return 'e';
  if (alpha && id === 'ans') return 'PreAns';
  if (alpha && id === 'dot') return 'RanInt(';
  if (alpha && ALPHA_KEYS[id]) return ALPHA_KEYS[id];
  if (shift && (id === 'sin' || id === 'cos' || id === 'tan')) {
    return `a${id}${hyp ? 'h' : ''}(`;
  }
  if (shift && id === 'sqrt') return 'cbrt(';
  if (shift && id === 'square') return '^3';
  if (shift && id === 'hyp') return 'abs(';
  if (shift && id === 'log') return '10^(';
  if (shift && id === 'ln') return 'e^(';
  if (shift && id === 'power') return 'root(';
  if (shift && id === 'open') return '%';
  if (shift && id === 'close') return ',';
  if (shift && id === 'multiply') return 'nPr';
  if (shift && id === 'divide') return 'nCr';
  if (shift && id === '0') return 'Rnd(';
  if (shift && id === 'dot') return 'Ran#';
  if (hyp && (id === 'sin' || id === 'cos' || id === 'tan')) {
    return `${id}h(`;
  }
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
    case 'comma': return ',';
    case 'sqrt': return 'sqrt(';
    case 'cbrt': return 'cbrt(';
    case 'root': return 'root(';
    case 'abs': return 'abs(';
    case 'sin': return 'sin(';
    case 'cos': return 'cos(';
    case 'tan': return 'tan(';
    case 'log': return 'log(';
    case 'ln': return 'ln(';
    case 'ans': return 'Ans';
    case 'preans': return 'PreAns';
    case 'exp': return '⏨';
    case 'pi': return 'π';
    case 'e': return 'e';
    case 'var-x': return 'X';
    case 'var-y': return 'Y';
    case 'percent': return '%';
    case 'factorial': return '!';
    case 'ncr': return 'nCr';
    case 'npr': return 'nPr';
    case 'rnd': return 'Rnd(';
    case 'ranint': return 'RanInt(';
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
  if (!s.expression.includes(':') && s.expression.includes('=') && !parseAssignmentStatement(s.expression)) {
    return startSolveWorkflow(s);
  }
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
  if (id === 'ac') return { ...s, calcPrompt: null, shift: false, alpha: false, hyp: false };
  if (id === 'del') return { ...s, calcPrompt: { ...prompt, input: deleteSimpleInput(prompt.input) } };
  if (id === 'equals') {
    try {
      const targetVar = prompt.vars[prompt.index];
      const nextVal = prompt.input.trim()
        ? serialize(evaluateExpression(prompt.input, evalContext(s, random)))
        : s.variables[targetVar];
      const updatedVars = { ...s.variables, [targetVar]: nextVal };
      const nextIndex = prompt.index + 1;
      if (nextIndex < prompt.vars.length) {
        return { ...s, variables: updatedVars, cmplx: clearComplexImagForRealWrites(s.cmplx, [targetVar]), calcPrompt: { ...prompt, index: nextIndex, input: '' } };
      }
      const nextState = { ...s, variables: updatedVars, cmplx: clearComplexImagForRealWrites(s.cmplx, [targetVar]), calcPrompt: null, expression: prompt.sourceExpr };
      return evaluateCalcStatements(nextState, prompt.sourceExpr, random);
    } catch (err) {
      return errorState(s, err);
    }
  }
  const ch = simpleInputChar(id, s.shift, s.alpha, s.hyp);
  if (ch !== null) return { ...s, shift: false, alpha: false, hyp: false, calcPrompt: { ...prompt, input: prompt.input + ch } };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
  if (id === 'hyp') return { ...s, hyp: !s.hyp };
  return s;
}

function splitSolveTarget(source: string): { expression: string; target: VariableName; explicit: boolean } {
  let depth = 0;
  let comma = -1;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')' && depth > 0) depth--;
    else if (source[i] === ',' && depth === 0) comma = i;
  }
  if (comma < 0) return { expression: source.trim(), target: 'X', explicit: false };
  const suffix = source.slice(comma + 1).trim().toUpperCase();
  if (!VARIABLES.includes(suffix as VariableName)) return { expression: source.trim(), target: 'X', explicit: false };
  const expression = source.slice(0, comma).trim();
  if (!expression) throw new CalculatorError('Syntax ERROR', 'Missing expression');
  return { expression, target: suffix as VariableName, explicit: true };
}

function startSolveWorkflow(s: CalculatorState): CalculatorState {
  if (!s.expression.trim()) return s;
  try {
    const parsed = splitSolveTarget(s.expression);
    splitEquation(parsed.expression);
    const expressionVars = extractVariables(parsed.expression);
    const target = !parsed.explicit && !expressionVars.includes('X') && expressionVars.length === 1
      ? expressionVars[0]
      : parsed.target;
    const vars = expressionVars.filter((v) => v !== target);
    const first = vars[0];
    return {
      ...closeLatches(s),
      solvePrompt: {
        sourceExpr: parsed.expression,
        stage: first ? 'prompt-var' : 'prompt-x',
        input: '', targetVar: target, targetExplicit: parsed.explicit, promptVars: vars, promptIndex: 0,
      },
    };
  } catch (err) {
    return errorState(s, err);
  }
}

function handleSolvePrompt(s: CalculatorState, id: string, random?: number): CalculatorState {
  const sp = s.solvePrompt!;
  const editableSource = sp.targetExplicit ? `${sp.sourceExpr},${sp.targetVar ?? 'X'}` : sp.sourceExpr;
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
        expression: editableSource,
        cursor: id === 'left' ? editableSource.length : 0,
        result: null,
        error: null,
      };
    }
    if (id === 'equals') {
      return { ...s, solvePrompt: { ...sp, stage: 'prompt-x', input: '' } };
    }
    return calculatorReducer({ ...s, solvePrompt: null }, { type: 'key', id, random });
  }
  if (id === 'ac') {
    return { ...s, solvePrompt: null, phase: 'editing', expression: editableSource, cursor: editableSource.length, shift: false, alpha: false, hyp: false };
  }
  if (id === 'del') return { ...s, solvePrompt: { ...sp, input: deleteSimpleInput(sp.input) } };
  if (id === 'equals') {
    try {
      if (sp.stage === 'prompt-var') {
        const promptVars = sp.promptVars ?? [];
        const index = sp.promptIndex ?? 0;
        const name = promptVars[index];
        if (!name) return { ...s, solvePrompt: { ...sp, stage: 'prompt-x', input: '' } };
        const value = sp.input.trim() ? evaluateExpression(sp.input, evalContext(s, random)) : deserialize(s.variables[name]);
        const variables = { ...s.variables, [name]: serialize(value) };
        const nextIndex = index + 1;
        return {
          ...s, variables, cmplx: clearComplexImagForRealWrites(s.cmplx, [name]),
          solvePrompt: { ...sp, stage: nextIndex < promptVars.length ? 'prompt-var' : 'prompt-x', input: '', promptIndex: nextIndex },
        };
      }
      const targetVar = sp.targetVar ?? 'X';
      const guessScalar = sp.input.trim()
        ? evaluateExpression(sp.input, evalContext(s, random))
        : deserialize(s.variables[targetVar]);
      const { left, right } = splitEquation(sp.sourceExpr);
      const outcome = solveRoot(
        (xVal) => {
          const ctx = { ...evalContext(s, random), variables: { ...s.variables, [targetVar]: serialize(xVal) } };
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
        variables: { ...s.variables, [targetVar]: rootStored },
        cmplx: clearComplexImagForRealWrites(s.cmplx, [targetVar]),
        pairResult: {
          type: 'pair',
          label1: targetVar,
          value1: formatDecimal(outcome.root, s.numberFormat, s.decimalMark),
          label2: 'L−R',
          value2: formatDecimal(outcome.residual, s.numberFormat, s.decimalMark),
        },
        solvePrompt: { ...sp, stage: 'solved', input: '', root: rootStored, residual: resStored },
      };
    } catch (err) {
      return errorState(s, err);
    }
  }
  const ch = simpleInputChar(id, s.shift, s.alpha, s.hyp);
  if (ch !== null) return { ...s, shift: false, alpha: false, hyp: false, solvePrompt: { ...sp, input: sp.input + ch } };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
  if (id === 'hyp') return { ...s, hyp: !s.hyp };
  return s;
}

function handleRatioEditor(s: CalculatorState, id: string): CalculatorState {
  const ratio = s.ratio;
  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0 };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
  if (id === 'ac') return { ...s, ratio: createDefaultRatio(ratio.form), screen: 'ratio-editor', phase: 'editing' };
  if (id === 'left' || id === 'up') return { ...s, ratio: { ...ratio, cursorIndex: Math.max(0, ratio.cursorIndex - 1), input: '', editingCell: false } };
  if (id === 'right' || id === 'down') return { ...s, ratio: { ...ratio, cursorIndex: Math.min(2, ratio.cursorIndex + 1), input: '', editingCell: false } };
  if (id === 'del') return { ...s, ratio: { ...ratio, input: deleteSimpleInput(ratio.input), editingCell: true } };
  if (id === 'equals') {
    try {
      const coeffs = [...ratio.coeffs];
      if (ratio.input.trim()) coeffs[ratio.cursorIndex] = serialize(evaluateExpression(ratio.input, evalContext(s)));
      const nextRatio = { ...ratio, coeffs, input: '', editingCell: false };
      if (ratio.cursorIndex < 2) return { ...s, ratio: { ...nextRatio, cursorIndex: ratio.cursorIndex + 1 } };
      const [a, b, known] = coeffs.map(deserialize);
      const value = solveRatio(ratio.form!, a, b, known);
      const stored = serialize(value);
      const expression = ratio.form === 'a:b=X:d' ? 'a:b = X:d' : 'a:b = c:X';
      return {
        ...resetResultModifiers(s), screen: 'normal', expression, cursor: expression.length,
        phase: 'result', result: stored, preAns: s.ans, ans: stored,
        resultFormat: effectiveResultFormat(s, defaultResultFormat(value)),
        ratio: { ...nextRatio, solved: true }, pending: null, error: null,
      };
    } catch (error) {
      return errorState(s, error);
    }
  }
  const ch = simpleInputChar(id, s.shift, s.alpha, s.hyp);
  if (ch !== null) return { ...s, shift: false, alpha: false, hyp: false, ratio: { ...ratio, input: ratio.input + ch, editingCell: true } };
  return s;
}

function handleEqnMode(s: CalculatorState, id: string, random?: number): CalculatorState {
  const eqn = s.eqn!;
  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0, hyp: false };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
  if (id === 'hyp') return { ...s, hyp: !s.hyp };

  if (eqn.outcome) {
    if (s.pending === 'store') {
      const name = ALPHA_KEYS[id];
      if (id === 'ac') return { ...s, pending: null, shift: false, alpha: false };
      if (name && s.result) {
        return {
          ...s,
          pending: null,
          shift: false,
          alpha: false,
          variables: { ...s.variables, [name]: s.result },
          cmplx: { ...s.cmplx, varsIm: { ...s.cmplx.varsIm, [name]: zeroStored() } },
        };
      }
      return s;
    }
    if (id === 'ac') {
      return {
        ...resetResultModifiers(s),
        eqn: { ...eqn, outcome: null, solutionIndex: 0, partView: 'both', input: '', editingCell: false },
      };
    }
    if (eqn.outcome.status === 'solved') {
      const len = eqn.outcome.items.length;
      const curItem = eqn.outcome.items[eqn.solutionIndex];
      if (s.shift && id === 'rcl' && curItem?.scalar) {
        return { ...closeLatches(s), pending: 'store' };
      }
      if (s.shift && id === 'equals' && curItem?.complexParts) {
        const curView = eqn.partView ?? 'both';
        const nextView = curView === 'both' ? 're' : curView === 're' ? 'im' : 'both';
        return { ...closeLatches(s), eqn: { ...eqn, partView: nextView } };
      }
      if (id === 'eng' && curItem?.scalar) {
        const scalar = curItem.scalar;
        const delta = s.shift ? 3 : -3;
        const nextExp = s.displayOverride === 'eng' && s.engExponent !== null
          ? s.engExponent + delta
          : initialEngExponent(scalar) + (s.shift ? 3 : 0);
        return { ...closeLatches(s), displayOverride: 'eng', engExponent: nextExp };
      }
      if (id === 'down' || (id === 'equals' && !s.shift)) {
        const nextIdx = (eqn.solutionIndex + 1) % len;
        const item = eqn.outcome.items[nextIdx];
        return {
          ...resetResultModifiers(s),
          result: item.scalar ? serialize(item.scalar) : null,
          resultFormat: item.scalar ? effectiveResultFormat(s, defaultResultFormat(item.scalar)) : 'decimal',
          eqn: { ...eqn, solutionIndex: nextIdx, partView: 'both' },
        };
      }
      if (id === 'up') {
        const prevIdx = (eqn.solutionIndex - 1 + len) % len;
        const item = eqn.outcome.items[prevIdx];
        return {
          ...resetResultModifiers(s),
          result: item.scalar ? serialize(item.scalar) : null,
          resultFormat: item.scalar ? effectiveResultFormat(s, defaultResultFormat(item.scalar)) : 'decimal',
          eqn: { ...eqn, solutionIndex: prevIdx, partView: 'both' },
        };
      }
      if (id === 'sd') {
        if (s.shift && curItem?.scalar?.exact && curItem.scalar.exact.d > 1n) {
          const nextStyle: FractionStyle =
            s.resultFormat === 'decimal' ? 'mixed' : s.fractionStyle === 'mixed' ? 'improper' : 'mixed';
          return { ...closeLatches(s), resultFormat: 'exact', fractionStyle: nextStyle, displayOverride: 'none' };
        }
        if (s.shift) return closeLatches(s);
        return { ...s, displayOverride: 'none', engExponent: null, resultFormat: s.resultFormat === 'exact' ? 'decimal' : 'exact' };
      }
    }
    return s;
  }

  if (id === 'ac') {
    if (eqn.editingCell) return { ...s, eqn: { ...eqn, input: '', editingCell: false } };
    return { ...s, screen: 'eqn-menu' };
  }
  if (id === 'del' && eqn.editingCell) {
    const nextInput = deleteSimpleInput(eqn.input);
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

  const ch = simpleInputChar(id, s.shift, s.alpha, s.hyp);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, hyp: false, eqn: { ...eqn, input: (eqn.editingCell ? eqn.input : '') + ch, editingCell: true } };
  }
  return s;
}

function handleIneqMode(s: CalculatorState, id: string, random?: number): CalculatorState {
  const ineq = s.ineq!;
  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0, hyp: false };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
  if (id === 'hyp') return { ...s, hyp: !s.hyp };

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
    const nextInput = deleteSimpleInput(ineq.input);
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

  const ch = simpleInputChar(id, s.shift, s.alpha, s.hyp);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, hyp: false, ineq: { ...ineq, input: (ineq.editingCell ? ineq.input : '') + ch, editingCell: true } };
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

  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0, hyp: false };
  if (s.shift && id === '1') return { ...closeLatches(s), screen: 'stat-menu' };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
  if (id === 'hyp') return { ...s, hyp: !s.hyp };

  if (id === 'ac') {
    if (st.editingCell) return { ...s, stat: { ...st, cellInput: '', editingCell: false } };
    return { ...s, phase: 'editing', expression: '', cursor: 0, stat: { ...st, editingTable: false } };
  }
  if (id === 'del') {
    if (st.editingCell) {
      const next = deleteSimpleInput(st.cellInput);
      return { ...s, stat: { ...st, cellInput: next, editingCell: next.length > 0 } };
    }
    if (st.rowIdx < st.rows.length) {
      const nextRows = st.rows.filter((_, idx) => idx !== st.rowIdx);
      const capSlot = nextRows.length >= 80 ? 79 : nextRows.length;
      return { ...s, stat: { ...st, rows: nextRows, rowIdx: Math.min(st.rowIdx, capSlot) } };
    }
    return s;
  }
  if (!st.editingCell) {
    const totalRowSlots = st.rows.length >= 80 ? 80 : st.rows.length + 1;
    if (id === 'up') return { ...s, stat: { ...st, rowIdx: (st.rowIdx - 1 + totalRowSlots) % totalRowSlots } };
    if (id === 'down') return { ...s, stat: { ...st, rowIdx: (st.rowIdx + 1) % totalRowSlots } };
    if (id === 'left') return { ...s, stat: { ...st, colIdx: (st.colIdx - 1 + colsCount) % colsCount } };
    if (id === 'right') return { ...s, stat: { ...st, colIdx: (st.colIdx + 1) % colsCount } };
  }
  if (id === 'equals') {
    try {
      const nextRows = [...st.rows];
      const isFreqCol = st.useFreq && st.colIdx > (hasY ? 1 : 0);
      if (st.rowIdx === nextRows.length) {
        if (!st.editingCell || !st.cellInput.trim()) return s;
        if (nextRows.length >= 80) mathError('Statistical table limit (80 rows) reached');
        const valScalar = evaluateExpression(st.cellInput, evalContext(s, random));
        if (isFreqCol && (valScalar.decimal.lt(0) || !valScalar.decimal.isInteger() || valScalar.decimal.gte('1e15'))) {
          mathError('Invalid frequency');
        }
        const valStr = valScalar.decimal.toString();
        nextRows.push({
          x: st.colIdx === 0 ? valStr : '0',
          y: hasY ? (st.colIdx === 1 ? valStr : '0') : undefined,
          freq: isFreqCol ? valStr : '1',
        });
      } else if (st.editingCell && st.cellInput.trim()) {
        const currentRow = { ...nextRows[st.rowIdx] };
        const valScalar = evaluateExpression(st.cellInput, evalContext(s, random));
        if (isFreqCol && (valScalar.decimal.lt(0) || !valScalar.decimal.isInteger() || valScalar.decimal.gte('1e15'))) {
          mathError('Invalid frequency');
        }
        const valStr = valScalar.decimal.toString();
        if (st.colIdx === 0) currentRow.x = valStr;
        else if (hasY && st.colIdx === 1) currentRow.y = valStr;
        else currentRow.freq = valStr;
        nextRows[st.rowIdx] = currentRow;
      }
      let nextRowIdx = st.rowIdx;
      let nextColIdx = st.colIdx + 1;
      if (nextColIdx >= colsCount) {
        nextColIdx = 0;
        const maxSelectable = nextRows.length >= 80 ? 79 : nextRows.length;
        nextRowIdx = st.rowIdx + 1 <= maxSelectable ? st.rowIdx + 1 : 0;
      }
      return {
        ...s,
        stat: { ...st, rows: nextRows, rowIdx: nextRowIdx, colIdx: nextColIdx, cellInput: '', editingCell: false },
      };
    } catch (err) {
      return errorState(s, err);
    }
  }
  const ch = simpleInputChar(id, s.shift, s.alpha, s.hyp);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, hyp: false, stat: { ...st, cellInput: (st.editingCell ? st.cellInput : '') + ch, editingCell: true } };
  }
  return s;
}

function handleMatrixCellEditor(s: CalculatorState, id: string, random?: number): CalculatorState {
  const mt = s.matrix;
  const target = mt.editingTarget!;
  const mat = mt.matrices[target]!;

  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0, hyp: false };
  if (s.shift && id === '4') return { ...closeLatches(s), screen: 'matrix-menu', menuPage: 0, matrix: { ...mt, editingTarget: null } };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
  if (id === 'hyp') return { ...s, hyp: !s.hyp };

  if (id === 'ac') {
    if (mt.editingCell) return { ...s, matrix: { ...mt, cellInput: '', editingCell: false } };
    return { ...s, phase: 'editing', expression: '', cursor: 0, matrix: { ...mt, editingTarget: null } };
  }
  if (id === 'del' && mt.editingCell) {
    const next = deleteSimpleInput(mt.cellInput);
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
  const ch = simpleInputChar(id, s.shift, s.alpha, s.hyp);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, hyp: false, matrix: { ...mt, cellInput: (mt.editingCell ? mt.cellInput : '') + ch, editingCell: true } };
  }
  return s;
}

function handleVectorCellEditor(s: CalculatorState, id: string, random?: number): CalculatorState {
  const vt = s.vector;
  const target = vt.editingTarget!;
  const vct = vt.vectors[target]!;

  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0, hyp: false };
  if (s.shift && id === '5') return { ...closeLatches(s), screen: 'vector-menu', vector: { ...vt, editingTarget: null } };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
  if (id === 'hyp') return { ...s, hyp: !s.hyp };

  if (id === 'ac') {
    if (vt.editingCell) return { ...s, vector: { ...vt, cellInput: '', editingCell: false } };
    return { ...s, phase: 'editing', expression: '', cursor: 0, vector: { ...vt, editingTarget: null } };
  }
  if (id === 'del' && vt.editingCell) {
    const next = deleteSimpleInput(vt.cellInput);
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
  const ch = simpleInputChar(id, s.shift, s.alpha, s.hyp);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, hyp: false, vector: { ...vt, cellInput: (vt.editingCell ? vt.cellInput : '') + ch, editingCell: true } };
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
  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0, hyp: false };
  if (s.shift && id === '1') return { ...closeLatches(s), screen: 'dist-menu' };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
  if (id === 'hyp') return { ...s, hyp: !s.hyp };

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
    if (s.pending === 'store') {
      const name = ALPHA_KEYS[id];
      if (id === 'ac') return { ...s, pending: null, shift: false, alpha: false };
      if (name) {
        return {
          ...s,
          pending: null,
          shift: false,
          alpha: false,
          variables: { ...s.variables, [name]: ds.result },
          cmplx: { ...s.cmplx, varsIm: { ...s.cmplx.varsIm, [name]: zeroStored() } },
        };
      }
      return s;
    }
    if (s.shift && id === 'rcl') {
      return { ...closeLatches(s), pending: 'store' };
    }
    if (id === 'eng') {
      const scalar = deserialize(ds.result);
      const delta = s.shift ? 3 : -3;
      const nextExp = s.displayOverride === 'eng' && s.engExponent !== null
        ? s.engExponent + delta
        : initialEngExponent(scalar) + (s.shift ? 3 : 0);
      return { ...closeLatches(s), displayOverride: 'eng', engExponent: nextExp };
    }
    if (id === 'ac' || id === 'equals') {
      return { ...resetResultModifiers(s), phase: 'editing', dist: { ...ds, result: null, paramIdx: 0, input: '', editingParam: false } };
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
        const next = deleteSimpleInput(ds.input);
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
    const ch = simpleInputChar(id, s.shift, s.alpha, s.hyp);
    if (ch !== null) {
      return {
        ...s,
        shift: false,
        alpha: false,
        hyp: false,
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
    const next = deleteSimpleInput(ds.input);
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
  const ch = simpleInputChar(id, s.shift, s.alpha, s.hyp);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, hyp: false, dist: { ...ds, input: (ds.editingParam ? ds.input : '') + ch, editingParam: true } };
  }
  return s;
}

function handleTableMode(s: CalculatorState, id: string, random?: number): CalculatorState | null {
  const tbl = s.table!;
  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0, hyp: false };

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
      const nextVal = tbl.editingField ? deleteSimpleInput(tbl[field]) : '';
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
        const rows = generateFunctionTable(tbl.fExpr, s.tableUseG ? tbl.gExpr : null, start, end, step, ctx, s.decimalMark);
        return { ...s, phase: 'result', table: { ...tbl, stage: 'view', editingField: false, rows, selectedRow: 0 } };
      } catch (err) {
        return errorState(s, err);
      }
    }
    const ch = simpleInputChar(id, s.shift, s.alpha, s.hyp);
    if (ch !== null) {
      const nextVal = (tbl.editingField ? tbl[field] : '') + ch;
      return { ...s, shift: false, alpha: false, hyp: false, table: { ...tbl, [field]: nextVal, editingField: true } };
    }
    if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
    if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
    if (id === 'hyp') return { ...s, hyp: !s.hyp };
    return s;
  }

  if (tbl.stage === 'g' && id === 'ac' && !s.shift) {
    if (s.expression.length === 0) {
      return {
        ...closeLatches(s),
        phase: 'editing',
        expression: tbl.fExpr,
        cursor: tbl.fExpr.length,
        table: { ...tbl, stage: 'f', gExpr: '', editingField: false },
      };
    }
    return {
      ...closeLatches(s),
      phase: 'editing',
      expression: '',
      cursor: 0,
      table: { ...tbl, gExpr: '', editingField: false },
    };
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
    if (targetMode === 'COMP' && expr.includes('=') && !parseAssignmentStatement(expr)) {
      const solveInit = startSolveWorkflow(editingState);
      if (solveInit.solvePrompt) {
        const solvedDefault = handleSolvePrompt(solveInit, 'equals');
        if (!solvedDefault.error) return solvedDefault;
        for (const fallbackGuess of ['1', '0', '-1', '2']) {
          const withGuess: CalculatorState = {
            ...solveInit,
            solvePrompt: { ...solveInit.solvePrompt, input: fallbackGuess },
          };
          const solvedFallback = handleSolvePrompt(withGuess, 'equals');
          if (!solvedFallback.error) return solvedFallback;
        }
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
  if (state.mode === 'RATIO' && state.screen === 'ratio-editor') return handleRatioEditor(state, id);
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
      const rawGotoPos =
        state.errorCursor !== null
          ? state.errorCursor
          : id === 'left'
            ? state.expression.length
            : 0;
      const gotoPos = normalizeMathCursor(state.expression, rawGotoPos, isLineModeState(state));
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
  if (state.mode === 'RATIO' && state.ratio.solved && id === 'ac') return { ...resetResultModifiers(state), screen: 'ratio-menu', ratio: createDefaultRatio(), phase: 'editing', expression: '', cursor: 0, result: null };
  if (state.mode === 'STAT' && state.stat.editingTable) return handleStatTableEditor(state, id, action.random);
  if (state.mode === 'MATRIX' && state.matrix.editingTarget) return handleMatrixCellEditor(state, id, action.random);
  if (state.mode === 'VECTOR' && state.vector.editingTarget) return handleVectorCellEditor(state, id, action.random);
  if (state.mode === 'TABLE' && state.table) {
    const tblNext = handleTableMode(state, id, action.random);
    if (tblNext) return tblNext;
  }

  // Navigating Matrix / Vector result cells with wrap-around arrows + S⇔D / SHIFT+S⇔D toggle
  if (state.mode === 'MATRIX' && state.phase === 'result' && state.matrix.showingMatrixResult && state.matrix.matrices.MatAns) {
    const mAns = state.matrix.matrices.MatAns;
    if (id === 'up') return { ...state, matrix: { ...state.matrix, rowIdx: (state.matrix.rowIdx - 1 + mAns.rows) % mAns.rows } };
    if (id === 'down') return { ...state, matrix: { ...state.matrix, rowIdx: (state.matrix.rowIdx + 1) % mAns.rows } };
    if (id === 'left') return { ...state, matrix: { ...state.matrix, colIdx: (state.matrix.colIdx - 1 + mAns.cols) % mAns.cols } };
    if (id === 'right') return { ...state, matrix: { ...state.matrix, colIdx: (state.matrix.colIdx + 1) % mAns.cols } };
    if (id === 'sd' && !state.alpha) {
      if (state.shift) {
        const cellScalar = deserialize(mAns.cells[state.matrix.rowIdx][state.matrix.colIdx]);
        if (!cellScalar.exact || cellScalar.exact.d === 1n) return closeLatches(state);
        const nextStyle: FractionStyle =
          state.resultFormat === 'decimal' ? 'mixed' : state.fractionStyle === 'mixed' ? 'improper' : 'mixed';
        return { ...closeLatches(state), resultFormat: 'exact', fractionStyle: nextStyle };
      }
      return { ...state, resultFormat: state.resultFormat === 'exact' ? 'decimal' : 'exact' };
    }
  }
  if (state.mode === 'VECTOR' && state.phase === 'result' && state.vector.showingVectorResult && state.vector.vectors.VctAns) {
    const vAns = state.vector.vectors.VctAns;
    if (id === 'left' || id === 'up') return { ...state, vector: { ...state.vector, coordIdx: (state.vector.coordIdx - 1 + vAns.dim) % vAns.dim } };
    if (id === 'right' || id === 'down') return { ...state, vector: { ...state.vector, coordIdx: (state.vector.coordIdx + 1) % vAns.dim } };
    if (id === 'sd' && !state.alpha) {
      if (state.shift) {
        const coordScalar = deserialize(vAns.coords[state.vector.coordIdx]);
        if (!coordScalar.exact || coordScalar.exact.d === 1n) return closeLatches(state);
        const nextStyle: FractionStyle =
          state.resultFormat === 'decimal' ? 'mixed' : state.fractionStyle === 'mixed' ? 'improper' : 'mixed';
        return { ...closeLatches(state), resultFormat: 'exact', fractionStyle: nextStyle };
      }
      return { ...state, resultFormat: state.resultFormat === 'exact' ? 'decimal' : 'exact' };
    }
  }

  if (id === 'shift') return { ...state, shift: !state.shift, alpha: false, notice: null };
  if (id === 'alpha') return { ...state, alpha: !state.alpha, shift: false, hyp: false, notice: null };

  if (state.pending) {
    const name = ALPHA_KEYS[id];
    if (!name) {
      if (id === 'ac') return { ...state, pending: null, shift: false, alpha: false, notice: null };
      return state;
    }
    if (state.pending === 'recall') {
      if (state.mode === 'CMPLX') {
        const value = { re: state.variables[name], im: state.cmplx.varsIm[name] };
        const storedZ = { re: value.re, im: value.im };
        const reScalar = deserialize(value.re);
        return {
          ...resetResultModifiers(state), expression: name, cursor: name.length, phase: 'result',
          result: value.re, preAns: state.ans, ans: value.re,
          resultFormat: effectiveResultFormat(state, defaultResultFormat(reScalar)),
          cmplx: { ...state.cmplx, preAns: state.cmplx.ans, ans: storedZ, result: storedZ, partView: 'both' },
          pending: null, shift: false, alpha: false,
        };
      }
      if (state.mode === 'BASE-N') {
        const recalledVal = state.variables[name];
        const recalledScalar = deserialize(recalledVal);
        if (state.phase === 'result' || state.expression.trim() === '') {
          try {
            const intVal = scalarToBaseNInt32(recalledScalar);
            const serialized = intVal.toString();
            const storedInt = serialize(scalarFromInteger(intVal));
            return {
              ...resetResultModifiers(state),
              expression: name,
              cursor: name.length,
              phase: 'result',
              result: storedInt,
              baseN: { ...state.baseN, ans: serialized, result: serialized },
              pending: null,
              shift: false,
              alpha: false,
            };
          } catch (err) {
            return errorState(state, err);
          }
        }
        if (state.baseN.base === 'HEX' && /^[A-F]$/.test(name)) {
          try {
            const intVal = scalarToBaseNInt32(recalledScalar);
            const tokText = intVal < 0n ? `(d${(-intVal).toString()}×-1)` : `d${intVal.toString()}`;
            return insert({ ...state, pending: null }, tokText);
          } catch (err) {
            return errorState(state, err);
          }
        }
        return insert({ ...state, pending: null }, name);
      }
      if (
        (state.phase === 'result' || state.expression.trim() === '') &&
        (state.mode === 'COMP' || state.mode === 'STAT' || state.mode === 'MATRIX' || state.mode === 'VECTOR' || state.mode === 'RATIO')
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
          matrix: { ...state.matrix, showingMatrixResult: false },
          vector: { ...state.vector, showingVectorResult: false },
          pending: null,
          shift: false,
          alpha: false,
        };
      }
      return insert({ ...state, pending: null }, name);
    }
    if (state.mode === 'CMPLX') {
      try {
        const value = currentComplexValue(state, action.random);
        const storedZ = serializeComplex(value);
        const baseExpr = state.expression.trim() || 'Ans';
        const stoExpr = baseExpr.endsWith(`→${name}`) ? baseExpr : `${baseExpr}→${name}`;
        const history = [...state.history, { expression: stoExpr, result: storedZ.re, mode: state.mode }].slice(-40);
        return {
          ...resetResultModifiers(state), expression: stoExpr, cursor: stoExpr.length, phase: 'result',
          result: storedZ.re, preAns: state.ans, ans: storedZ.re,
          variables: { ...state.variables, [name]: storedZ.re },
          cmplx: { ...state.cmplx, varsIm: { ...state.cmplx.varsIm, [name]: storedZ.im },
            preAns: state.cmplx.ans, ans: storedZ, result: storedZ, partView: 'both' },
          resultFormat: effectiveResultFormat(state, defaultResultFormat(value.re)),
          history, historyIndex: null, pending: null, shift: false, alpha: false, hyp: false,
        };
      } catch (error) {
        return errorState(state, error);
      }
    }
    try {
      const storedVal = currentValue(state);
      const valScalar = deserialize(storedVal);
      const baseExpr = state.expression.trim() || 'Ans';
      const stoExpr = baseExpr.endsWith(`→${name}`) ? baseExpr : `${baseExpr}→${name}`;
      const history = [...state.history, { expression: stoExpr, result: storedVal, mode: state.mode }].slice(-40);
      return {
        ...resetResultModifiers(state),
        expression: stoExpr,
        cursor: stoExpr.length,
        phase: 'result',
        result: storedVal,
        baseN:
          state.mode === 'BASE-N'
            ? { ...state.baseN, ans: valScalar.decimal.toFixed(0), result: valScalar.decimal.toFixed(0) }
            : state.baseN,
        resultFormat: effectiveResultFormat(state, defaultResultFormat(valScalar)),
        preAns: state.ans,
        ans: storedVal,
        history,
        historyIndex: null,
        pending: null,
        shift: false,
        alpha: false,
        variables: { ...state.variables, [name]: storedVal },
        cmplx: { ...state.cmplx, varsIm: { ...state.cmplx.varsIm, [name]: zeroStored() } },
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
      return {
        ...resetResultModifiers(state),
        phase: 'editing',
        result: null,
        error: null,
        cursor: nextCursor,
        historyIndex: null,
        notice: null,
      };
    }
    const nextCursor = stepCursor(state.expression, state.cursor, id === 'left' ? -1 : 1, lineMode);
    return { ...state, phase: 'editing', error: null, cursor: nextCursor, historyIndex: null, notice: null };
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
    if (!['add', 'subtract', 'multiply', 'divide', 'open', 'close', 'ans', 'mplus', 'rcl', 'basen-and', 'basen-or', 'basen-xor', 'basen-xnor', 'basen-not', 'basen-neg'].includes(id)) {
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
    const s = { ...closeLatches(state), hyp: false };
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
        return functionTemplate(s, `${state.hyp ? 'a' + id + 'h' : 'a' + id}`);
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
          return s;
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
          const roundedScalar = roundScalar(deserialize(s.result), s.numberFormat);
          const rounded = serialize(roundedScalar);
          return {
            ...resetResultModifiers(s),
            result: rounded,
            ans: rounded,
            resultFormat: effectiveResultFormat(s, defaultResultFormat(roundedScalar)),
            displayOverride: 'none',
          };
        }
        return functionTemplate(s, 'Rnd');
      }
      case 'exp': return insert(s, 'π');
      case 'ans': return { ...s, screen: 'drg' };
      case 'calc': return startSolveWorkflow(s);
      case 'integ': return binaryTemplate(s, 'deriv');
      case 'dot': return insert(s, 'Ran#');
      default: return s;
    }
  }

  const wasHyp = state.hyp;
  const s = { ...state, shift: false, alpha: false, hyp: false, notice: null };
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
    case 'hyp': return { ...s, hyp: !wasHyp };
    case 'sin': case 'cos': case 'tan':
      return functionTemplate(s, `${id}${wasHyp ? 'h' : ''}`);
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

const MAX_PERSISTED_HISTORY = 50;

const VALID_ACTIVE_MODES: ReadonlySet<ActiveMode> = new Set([
  'COMP', 'CMPLX', 'STAT', 'BASE-N', 'EQN', 'MATRIX', 'TABLE', 'VECTOR', 'INEQ', 'VERIF', 'DIST', 'RATIO',
]);

const VALID_SCREEN_VIEWS: ReadonlySet<ScreenView> = new Set([
  'normal', 'mode', 'setup', 'setup-matho', 'setup-fix', 'setup-sci', 'setup-norm',
  'setup-cmplx', 'setup-disp', 'setup-table', 'setup-stat-freq', 'setup-recur', 'setup-contrast',
  'drg', 'const-picker', 'conv-picker', 'cmplx-menu', 'basen-menu', 'stat-type-menu', 'stat-menu',
  'stat-sub-sum', 'stat-sub-var', 'stat-sub-reg', 'stat-sub-distr', 'stat-sub-minmax',
  'matrix-target-menu', 'matrix-dim-menu', 'matrix-menu', 'vector-target-menu', 'vector-dim-menu',
  'vector-menu', 'ineq-deg-menu', 'ineq-rel-menu', 'verif-menu', 'dist-menu', 'clear',
  'clear-confirm', 'eqn-menu', 'ratio-menu', 'ratio-editor', 'off',
]);

export interface PersistentEqnState {
  type: EqnType;
  coeffs: StoredScalar[];
  cursorIndex: number;
  input: string;
  editingCell: boolean;
  solved: boolean;
  solutionIndex: number;
  partView?: 'both' | 're' | 'im';
}

export interface PersistentCalculatorSession {
  mode: ActiveMode;
  screen: ScreenView;
  menuPage: 0 | 1;
  codeDigits: string;
  pickerIndex: number;
  clearTarget: 'setup' | 'memory' | 'all' | null;
  insertMode: boolean;
  hyp: boolean;
  expression: string;
  cursor: number;
  phase: Phase;
  result: StoredScalar | null;
  pairResult: DisplayValue | null;
  verifResult: boolean | null;
  resultFormat: ResultFormat;
  fractionStyle: FractionStyle;
  displayOverride: DisplayOverride;
  engExponent: number | null;
  factoredText: string | null;
  error: CalculatorError['kind'] | null;
  errorCursor: number | null;
  ans: StoredScalar;
  preAns: StoredScalar;
  history: HistoryEntry[];
  historyIndex: number | null;
  statementRun: { statements: string[]; index: number } | null;
  calcPrompt: CalcPromptState | null;
  solvePrompt: SolvePromptState | null;
  eqn: PersistentEqnState | null;
  ineq: IneqState | null;
  table: TableModeState | null;
  baseN: BaseNState;
  cmplx: CmplxModeState;
  stat: StatModeState;
  matrix: MatrixModeState;
  vector: VectorModeState;
  dist: DistModeState | null;
  ratio: RatioModeState;
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
  statUseFreq?: boolean;
  variables: Record<VariableName, StoredScalar>;
  session?: PersistentCalculatorSession;
}

export function saveableState(state: CalculatorState): PersistentCalculator {
  const droppedHistory = Math.max(0, state.history.length - MAX_PERSISTED_HISTORY);
  const history = droppedHistory > 0 ? state.history.slice(-MAX_PERSISTED_HISTORY) : state.history;
  const historyIndex =
    state.historyIndex === null
      ? null
      : Math.max(0, Math.min(history.length - 1, state.historyIndex - droppedHistory));

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
    statUseFreq: state.stat.useFreq,
    variables: state.variables,
    session: {
      mode: state.mode,
      screen: state.screen === 'off' ? 'normal' : state.screen,
      menuPage: state.menuPage,
      codeDigits: state.codeDigits,
      pickerIndex: state.pickerIndex,
      clearTarget: state.clearTarget,
      insertMode: state.insertMode,
      hyp: state.hyp,
      expression: state.expression,
      cursor: state.cursor,
      phase: state.phase,
      result: state.result,
      pairResult: state.pairResult,
      verifResult: state.verifResult,
      resultFormat: state.resultFormat,
      fractionStyle: state.fractionStyle,
      displayOverride: state.displayOverride,
      engExponent: state.engExponent,
      factoredText: state.factoredText,
      error: state.error,
      errorCursor: state.errorCursor,
      ans: state.ans,
      preAns: state.preAns,
      history,
      historyIndex: history.length > 0 ? historyIndex : null,
      statementRun: state.statementRun,
      calcPrompt: state.calcPrompt,
      solvePrompt: state.solvePrompt,
      eqn: state.eqn
        ? {
            type: state.eqn.type,
            coeffs: state.eqn.coeffs,
            cursorIndex: state.eqn.cursorIndex,
            input: state.eqn.input,
            editingCell: state.eqn.editingCell,
            solved: state.eqn.outcome !== null,
            solutionIndex: state.eqn.solutionIndex,
            partView: state.eqn.partView,
          }
        : null,
      ineq: state.ineq,
      table: state.table,
      baseN: state.baseN,
      cmplx: state.cmplx,
      stat: state.stat,
      matrix: state.matrix,
      vector: state.vector,
      dist: state.dist,
      ratio: state.ratio,
    },
  };
}

function sanitizeNumberFormat(raw: unknown): NumberFormatSetting {
  if (!raw || typeof raw !== 'object') return DEFAULT_NUMBER_FORMAT;
  const nf = raw as Partial<NumberFormatSetting>;
  if (nf.mode === 'Fix' && typeof nf.digits === 'number' && Number.isInteger(nf.digits) && nf.digits >= 0 && nf.digits <= 9) {
    return { mode: 'Fix', digits: nf.digits };
  }
  if (nf.mode === 'Sci' && typeof nf.digits === 'number' && Number.isInteger(nf.digits) && nf.digits >= 0 && nf.digits <= 9) {
    return { mode: 'Sci', digits: nf.digits };
  }
  if (nf.mode === 'Norm' && (nf.sub === 1 || nf.sub === 2)) {
    return { mode: 'Norm', sub: nf.sub };
  }
  return DEFAULT_NUMBER_FORMAT;
}

function sanitizeStoredScalar(raw: unknown, fallback: StoredScalar): StoredScalar {
  if (!raw || typeof raw !== 'object') return fallback;
  try {
    deserialize(raw as StoredScalar);
    return raw as StoredScalar;
  } catch {
    return fallback;
  }
}

function sanitizeNullableScalar(raw: unknown): StoredScalar | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return null;
  try {
    deserialize(raw as StoredScalar);
    return raw as StoredScalar;
  } catch {
    return null;
  }
}

function hydrateSession(
  base: CalculatorState,
  rawSession: Partial<PersistentCalculatorSession> | undefined,
): CalculatorState {
  if (!rawSession || typeof rawSession !== 'object') return base;
  try {
    const mode = VALID_ACTIVE_MODES.has(rawSession.mode as ActiveMode)
      ? (rawSession.mode as ActiveMode)
      : base.mode;
    const rawScreen = VALID_SCREEN_VIEWS.has(rawSession.screen as ScreenView)
      ? (rawSession.screen as ScreenView)
      : 'normal';
    // Never restore powered-off state on reload so a resumed background tab never looks dead
    const screen: ScreenView = rawScreen === 'off' ? 'normal' : rawScreen;
    const expression = typeof rawSession.expression === 'string' ? rawSession.expression : '';
    const cursor = typeof rawSession.cursor === 'number' && Number.isInteger(rawSession.cursor)
      ? Math.max(0, Math.min(expression.length, rawSession.cursor))
      : expression.length;
    const phase: Phase =
      rawSession.phase === 'result' || rawSession.phase === 'error' ? rawSession.phase : 'editing';

    const history: HistoryEntry[] = Array.isArray(rawSession.history)
      ? rawSession.history
          .slice(-MAX_PERSISTED_HISTORY)
          .filter(
            (entry): entry is HistoryEntry =>
              Boolean(entry) &&
              typeof entry.expression === 'string' &&
              sanitizeNullableScalar(entry.result) !== null,
          )
      : [];

    const historyIndex =
      typeof rawSession.historyIndex === 'number' &&
      Number.isInteger(rawSession.historyIndex) &&
      rawSession.historyIndex >= 0 &&
      rawSession.historyIndex < history.length
        ? rawSession.historyIndex
        : null;

    let cmplx = base.cmplx;
    if (rawSession.cmplx && typeof rawSession.cmplx === 'object') {
      try {
        deserializeComplex(rawSession.cmplx.ans);
        deserializeComplex(rawSession.cmplx.preAns);
        if (rawSession.cmplx.result !== null) deserializeComplex(rawSession.cmplx.result);
        const varsIm = zeroVariables();
        if (rawSession.cmplx.varsIm && typeof rawSession.cmplx.varsIm === 'object') {
          for (const name of VARIABLES) varsIm[name] = sanitizeStoredScalar(rawSession.cmplx.varsIm[name], zeroStored());
        }
        cmplx = {
          varsIm,
          ans: rawSession.cmplx.ans,
          preAns: rawSession.cmplx.preAns,
          result: rawSession.cmplx.result,
          format: rawSession.cmplx.format === 'polar' ? 'polar' : 'rect',
          partView:
            rawSession.cmplx.partView === 'first' || rawSession.cmplx.partView === 'second'
              ? rawSession.cmplx.partView
              : 'both',
        };
      } catch {
        cmplx = base.cmplx;
      }
    }

    let stat = base.stat;
    if (rawSession.stat && typeof rawSession.stat === 'object' && Array.isArray(rawSession.stat.rows)) {
      stat = {
        ...base.stat,
        ...rawSession.stat,
        useFreq: base.stat.useFreq,
        rows: rawSession.stat.rows.filter(
          (r): r is StatRow => Boolean(r) && typeof r.x === 'string',
        ),
      };
    }

    let matrix = base.matrix;
    if (rawSession.matrix && typeof rawSession.matrix === 'object' && rawSession.matrix.matrices) {
      let validMatrices = true;
      for (const mName of ['MatA', 'MatB', 'MatC', 'MatAns'] as MatrixName[]) {
        const m = rawSession.matrix.matrices[mName];
        if (m !== null && m !== undefined) {
          if (!Array.isArray(m.cells)) {
            validMatrices = false;
          } else {
            for (const row of m.cells) {
              if (!Array.isArray(row)) {
                validMatrices = false;
                break;
              }
              for (const cell of row) deserialize(cell);
            }
          }
        }
      }
      if (validMatrices) {
        matrix = { ...base.matrix, ...rawSession.matrix };
      }
    }

    let vector = base.vector;
    if (rawSession.vector && typeof rawSession.vector === 'object' && rawSession.vector.vectors) {
      let validVectors = true;
      for (const vName of ['VctA', 'VctB', 'VctC', 'VctAns'] as VectorName[]) {
        const v = rawSession.vector.vectors[vName];
        if (v !== null && v !== undefined) {
          if (!Array.isArray(v.coords)) {
            validVectors = false;
          } else {
            for (const coord of v.coords) deserialize(coord);
          }
        }
      }
      if (validVectors) {
        vector = { ...base.vector, ...rawSession.vector };
      }
    }

    let eqn: EqnState | null = null;
    if (rawSession.eqn && Array.isArray(rawSession.eqn.coeffs)) {
      const scalars = rawSession.eqn.coeffs.map(deserialize);
      const outcome = rawSession.eqn.solved ? solveEqn(rawSession.eqn.type, scalars) : null;
      eqn = {
        type: rawSession.eqn.type,
        coeffs: rawSession.eqn.coeffs,
        cursorIndex: typeof rawSession.eqn.cursorIndex === 'number' ? rawSession.eqn.cursorIndex : 0,
        input: typeof rawSession.eqn.input === 'string' ? rawSession.eqn.input : '',
        editingCell: rawSession.eqn.editingCell === true,
        outcome,
        solutionIndex: typeof rawSession.eqn.solutionIndex === 'number' ? rawSession.eqn.solutionIndex : 0,
        partView: rawSession.eqn.partView,
      };
    }

    let ineq = rawSession.ineq ?? null;
    if (ineq && Array.isArray(ineq.coeffs)) {
      for (const c of ineq.coeffs) deserialize(c);
    } else {
      ineq = null;
    }

    let dist = rawSession.dist ?? null;
    if (dist && typeof dist === 'object') {
      dist = { ...dist, result: sanitizeNullableScalar(dist.result) };
    } else {
      dist = null;
    }
    let ratio = base.ratio;
    const rawRatio = rawSession.ratio as RatioModeState | undefined;
    if (rawRatio && (rawRatio.form === null || rawRatio.form === 'a:b=X:d' || rawRatio.form === 'a:b=c:X') && Array.isArray(rawRatio.coeffs) && rawRatio.coeffs.length === 3) {
      try {
        rawRatio.coeffs.forEach(deserialize);
        ratio = { ...createDefaultRatio(rawRatio.form), ...rawRatio, coeffs: rawRatio.coeffs };
      } catch { ratio = base.ratio; }
    }

    return {
      ...base,
      mode,
      screen,
      menuPage: rawSession.menuPage === 1 ? 1 : 0,
      codeDigits: typeof rawSession.codeDigits === 'string' ? rawSession.codeDigits : '',
      pickerIndex:
        typeof rawSession.pickerIndex === 'number' && Number.isInteger(rawSession.pickerIndex) && rawSession.pickerIndex >= 0
          ? rawSession.pickerIndex
          : 0,
      clearTarget:
        rawSession.clearTarget === 'setup' || rawSession.clearTarget === 'memory' || rawSession.clearTarget === 'all'
          ? rawSession.clearTarget
          : null,
      insertMode: rawSession.insertMode === true,
      hyp: rawSession.hyp === true,
      expression,
      cursor,
      phase,
      result: sanitizeNullableScalar(rawSession.result),
      pairResult: rawSession.pairResult ?? null,
      verifResult: typeof rawSession.verifResult === 'boolean' ? rawSession.verifResult : null,
      resultFormat: rawSession.resultFormat === 'decimal' ? 'decimal' : 'exact',
      fractionStyle: rawSession.fractionStyle === 'mixed' ? 'mixed' : base.defaultFractionStyle,
      displayOverride: rawSession.displayOverride ?? base.displayOverride,
      engExponent: typeof rawSession.engExponent === 'number' && Number.isFinite(rawSession.engExponent)
        ? rawSession.engExponent
        : null,
      factoredText: typeof rawSession.factoredText === 'string' ? rawSession.factoredText : null,
      error: rawSession.error ?? null,
      errorCursor: typeof rawSession.errorCursor === 'number' ? rawSession.errorCursor : null,
      ans: sanitizeStoredScalar(rawSession.ans, base.ans),
      preAns: sanitizeStoredScalar(rawSession.preAns, base.preAns),
      history,
      historyIndex,
      statementRun: rawSession.statementRun ?? null,
      calcPrompt: rawSession.calcPrompt ?? null,
      solvePrompt: rawSession.solvePrompt
        ? {
            ...rawSession.solvePrompt,
            root: sanitizeNullableScalar(rawSession.solvePrompt.root) ?? undefined,
            residual: sanitizeNullableScalar(rawSession.solvePrompt.residual) ?? undefined,
          }
        : null,
      eqn,
      ineq,
      table: rawSession.table && typeof rawSession.table === 'object' ? rawSession.table : null,
      baseN:
        rawSession.baseN && typeof rawSession.baseN === 'object'
          ? {
              base: ['DEC', 'HEX', 'BIN', 'OCT'].includes(rawSession.baseN.base)
                ? rawSession.baseN.base
                : 'DEC',
              ans: typeof rawSession.baseN.ans === 'string' ? rawSession.baseN.ans : '0',
              result: typeof rawSession.baseN.result === 'string' ? rawSession.baseN.result : null,
            }
          : base.baseN,
      cmplx,
      stat,
      matrix,
      vector,
      dist,
      ratio,
    };
  } catch {
    return base;
  }
}

export function hydrateState(raw: string | null): CalculatorState {
  const state = createInitialState();
  if (!raw) return state;
  try {
    const data = JSON.parse(raw) as Partial<PersistentCalculator>;
    if (data.version !== 1 || !data.variables || !['DEG', 'RAD', 'GRA'].includes(data.angle ?? '')) return state;
    for (const name of VARIABLES) deserialize(data.variables[name]);
    const defaultCmplxFormat: ComplexFormat = data.defaultCmplxFormat === 'polar' ? 'polar' : 'rect';
    const defaultFractionStyle: FractionStyle = data.defaultFractionStyle === 'mixed' ? 'mixed' : 'improper';
    const baseHydrated: CalculatorState = {
      ...state,
      angle: data.angle as AngleUnit,
      ioMode: data.ioMode === 'Line' ? 'Line' : 'Math',
      mathOutputMode: data.mathOutputMode === 'LineO' ? 'LineO' : 'MathO',
      decimalMark: data.decimalMark === 'Comma' ? 'Comma' : 'Dot',
      defaultCmplxFormat,
      cmplx: { ...state.cmplx, format: defaultCmplxFormat },
      recurEnabled: data.recurEnabled !== false,
      contrast: typeof data.contrast === 'number' && Number.isFinite(data.contrast)
        ? Math.max(1, Math.min(10, Math.round(data.contrast)))
        : 5,
      numberFormat: sanitizeNumberFormat(data.numberFormat),
      defaultFractionStyle,
      fractionStyle: defaultFractionStyle,
      tableUseG: data.tableUseG !== false,
      stat: { ...state.stat, useFreq: data.statUseFreq === true },
      variables: data.variables,
    };
    return hydrateSession(baseHydrated, data.session);
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
      const reZero = z.re.exact ? z.re.exact.n === 0n : !z.re.symbolic && z.re.decimal.isZero();
      const imZero = z.im.exact ? z.im.exact.n === 0n : !z.im.symbolic && z.im.decimal.isZero();
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
    const partView = state.eqn?.partView ?? 'both';
    const preferExact = state.resultFormat === 'exact' && state.ioMode === 'Math' && state.mathOutputMode === 'MathO';
    const fmt: ResultFormat = preferExact ? 'exact' : 'decimal';
    if (partView === 're') {
      return formatResult(item.complexParts.re, fmt, {
        fractionStyle: state.fractionStyle,
        numberFormat: state.numberFormat,
        decimalMark: state.decimalMark,
      });
    }
    if (partView === 'im') {
      return formatComplex2D(
        { re: scalarFromInteger(0), im: item.complexParts.im },
        'rect',
        state.angle,
        preferExact,
        state.numberFormat,
        state.decimalMark,
      );
    }
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
      const decText = formatComplexDisplay(item.complexParts, 'rect', state.angle, false, state.numberFormat, state.decimalMark);
      return { type: 'text', text: decText };
    }
  }
  if (item.complexText !== undefined) {
    return {
      type: 'text',
      text: state.decimalMark === 'Comma' ? item.complexText.replace(/\./g, ',') : item.complexText,
    };
  }
  if (item.scalar) {
    const fmt = state.ioMode === 'Line' || state.mathOutputMode === 'LineO' ? 'decimal' : state.resultFormat;
    return formatResult(item.scalar, fmt, {
      fractionStyle: state.fractionStyle,
      numberFormat: state.numberFormat,
      override: state.displayOverride,
      engExponent: state.engExponent,
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
      state.decimalMark,
    );
    return { type: 'text', text };
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
