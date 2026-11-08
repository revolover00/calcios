import { evaluateBaseN, formatBaseN, type BaseMode } from './basen';
import { solveRoot } from './calculus';
import { solveEqn, type EqnOutcome, type EqnType } from './eqn';
import { CalculatorError } from './errors';
import {
  evaluateExpression, evaluateRichExpression, extractVariables,
  splitEquation, splitStatements,
} from './expression';
import {
  DEFAULT_NUMBER_FORMAT, defaultResultFormat, formatDecimal, formatResult, initialEngExponent,
  type DisplayOverride, type DisplayValue, type FractionStyle, type NumberFormatSetting, type ResultFormat,
} from './format';
import { generateFunctionTable, type TableRow } from './table';
import {
  VARIABLES, add, deserialize, primeFactorize, roundScalar, scalarFromInteger, serialize, subtract, zeroStored,
  type AngleUnit, type StoredScalar, type VariableName,
} from './value';

export type Phase = 'editing' | 'result' | 'error';
export type ActiveMode = 'COMP' | 'BASE-N' | 'EQN' | 'TABLE';
export type IoMode = 'Math' | 'Line';
export type ScreenView =
  | 'normal'
  | 'mode'
  | 'setup'
  | 'setup-fix'
  | 'setup-sci'
  | 'setup-norm'
  | 'setup-abdc'
  | 'setup-table'
  | 'drg'
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

export interface TableModeState {
  stage: 'f' | 'g' | 'start' | 'end' | 'step' | 'view';
  fExpr: string;
  gExpr: string;
  startInput: string;
  endInput: string;
  stepInput: string;
  rows: TableRow[];
  selectedRow: number;
}

export interface BaseNState {
  base: BaseMode;
  ans: string; // serialized bigint
  result: string | null; // serialized bigint
}

export interface CalculatorState {
  mode: ActiveMode;
  ioMode: IoMode;
  insertMode: boolean;
  expression: string;
  cursor: number;
  phase: Phase;
  result: StoredScalar | null;
  pairResult: DisplayValue | null;
  resultFormat: ResultFormat;
  fractionStyle: FractionStyle;
  defaultFractionStyle: FractionStyle;
  displayOverride: DisplayOverride;
  engExponent: number | null;
  factoredText: string | null;
  numberFormat: NumberFormatSetting;
  tableUseG: boolean;
  error: CalculatorError['kind'] | null;
  angle: AngleUnit;
  shift: boolean;
  alpha: boolean;
  hyp: boolean;
  pending: 'store' | 'recall' | null;
  screen: ScreenView;
  menuPage: 0 | 1;
  clearTarget: 'setup' | 'memory' | 'all' | null;
  variables: Record<VariableName, StoredScalar>;
  ans: StoredScalar;
  history: HistoryEntry[];
  historyIndex: number | null;
  statementRun: { statements: string[]; index: number } | null;
  calcPrompt: CalcPromptState | null;
  solvePrompt: SolvePromptState | null;
  eqn: EqnState | null;
  table: TableModeState | null;
  baseN: BaseNState;
  notice: string | null;
}

export type CalculatorAction =
  | { type: 'key'; id: string; random?: number }
  | { type: 'insert-token'; token: string; behavior?: 'fresh' | 'continue' }
  | { type: 'select-mode'; mode: string }
  | { type: 'angle'; angle: AngleUnit }
  | { type: 'clear-notice' };

function zeroVariables(): Record<VariableName, StoredScalar> {
  return Object.fromEntries(VARIABLES.map((v) => [v, zeroStored()])) as Record<VariableName, StoredScalar>;
}

function createDefaultBaseN(): BaseNState {
  return { base: 'DEC', ans: '0', result: null };
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

function createTableState(): TableModeState {
  return {
    stage: 'f',
    fExpr: '',
    gExpr: '',
    startInput: '1',
    endInput: '5',
    stepInput: '1',
    rows: [],
    selectedRow: 0,
  };
}

export function createInitialState(): CalculatorState {
  return {
    mode: 'COMP',
    ioMode: 'Math',
    insertMode: true,
    expression: '',
    cursor: 0,
    phase: 'editing',
    result: null,
    pairResult: null,
    resultFormat: 'exact',
    fractionStyle: 'improper',
    defaultFractionStyle: 'improper',
    displayOverride: 'none',
    engExponent: null,
    factoredText: null,
    numberFormat: DEFAULT_NUMBER_FORMAT,
    tableUseG: true,
    error: null,
    angle: 'DEG',
    shift: false,
    alpha: false,
    hyp: false,
    pending: null,
    screen: 'normal',
    menuPage: 0,
    clearTarget: null,
    variables: zeroVariables(),
    ans: zeroStored(),
    history: [],
    historyIndex: null,
    statementRun: null,
    calcPrompt: null,
    solvePrompt: null,
    eqn: null,
    table: null,
    baseN: createDefaultBaseN(),
    notice: null,
  };
}

const ALPHA_KEYS: Record<string, VariableName> = {
  neg: 'A', dms: 'B', hyp: 'C', sin: 'D', cos: 'E', tan: 'F', close: 'X', sd: 'Y', mplus: 'M',
};
const BASEN_HEX_KEYS: Record<string, string> = {
  neg: 'A', dms: 'B', hyp: 'C', sin: 'D', cos: 'E', tan: 'F',
};

const modeNames = ['COMP', 'CMPLX', 'STAT', 'BASE-N', 'EQN', 'MATRIX', 'TABLE', 'VECTOR'];
const extraModes = ['INEQ', 'VERIF', 'DIST'];

const ATOMIC_TOKENS = [
  'RanInt(', 'mfrac(', 'deriv(', 'integ(', 'sigma(', 'prod(',
  'asinh(', 'acosh(', 'atanh(', 'logb(', 'sqrt(', 'cbrt(', 'frac(', 'root(',
  'sinh(', 'cosh(', 'tanh(', 'asin(', 'acos(', 'atan(',
  'Pol(', 'Rec(', 'Rnd(', 'sin(', 'cos(', 'tan(', 'abs(', 'log(', 'ln(',
  'Not(', 'Neg(', '×10^(', '10^(', 'e^(', 'xnor', 'and', 'xor', 'or', 'nCr', 'nPr', 'Ans',
].sort((a, b) => b.length - a.length);

function findAtomicSpans(source: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    const cMatch = rest.match(/^(?:const|▸conv)(?:0[1-9]|[1-3]\d|40)/);
    if (cMatch) {
      spans.push([i, i + cMatch[0].length]);
      i += cMatch[0].length;
      continue;
    }
    const atom = ATOMIC_TOKENS.find((t) => rest.startsWith(t));
    if (atom) {
      spans.push([i, i + atom.length]);
      i += atom.length;
      continue;
    }
    i++;
  }
  return spans;
}

function stepCursor(source: string, cursor: number, dir: -1 | 1): number {
  const spans = findAtomicSpans(source);
  if (dir === 1) {
    if (cursor >= source.length) return source.length;
    const hit = spans.find(([start, end]) => cursor >= start && cursor < end);
    return hit ? hit[1] : cursor + 1;
  }
  if (cursor <= 0) return 0;
  const hit = spans.find(([start, end]) => cursor > start && cursor <= end);
  return hit ? hit[0] : cursor - 1;
}

function deleteBeforeCursor(source: string, cursor: number): { expression: string; cursor: number } {
  if (cursor <= 0) return { expression: source, cursor: 0 };
  const spans = findAtomicSpans(source);
  const hit = spans.find(([start, end]) => cursor > start && cursor <= end);
  if (hit) {
    const [start, end] = hit;
    const tokenText = source.slice(start, end);
    // If deleting an empty template like `sin()` or `frac(,)`, remove its closing structure too
    if (tokenText.endsWith('(')) {
      const emptyMatch = source.slice(end).match(/^,*\)/);
      if (emptyMatch) {
        return {
          expression: source.slice(0, start) + source.slice(end + emptyMatch[0].length),
          cursor: start,
        };
      }
    }
    return { expression: source.slice(0, start) + source.slice(end), cursor: start };
  }
  return { expression: source.slice(0, cursor - 1) + source.slice(cursor), cursor: cursor - 1 };
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
    displayOverride: 'none',
    engExponent: null,
    factoredText: null,
    statementRun: null,
  };
}

/** Insert text/template without mutating input; caretOffset is relative to inserted text. */
function insert(
  s: CalculatorState,
  text: string,
  behavior: 'fresh' | 'continue' = 'fresh',
  caretOffset = text.length,
): CalculatorState {
  let expression = s.expression;
  let cursor = s.cursor;
  if (s.phase !== 'editing') {
    expression = s.phase === 'result' && behavior === 'continue' ? 'Ans' : '';
    cursor = expression.length;
  }
  if (expression.length + text.length > 300) {
    return withNotice(s, 'وصلت للحد الأقصى للإدخال.');
  }
  const replaceCount = !s.insertMode && s.phase === 'editing' && caretOffset === text.length && cursor < expression.length ? 1 : 0;
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

function functionTemplate(s: CalculatorState, name: string): CalculatorState {
  const text = `${name}()`;
  return insert(s, text, 'fresh', text.length - 1);
}
function binaryTemplate(s: CalculatorState, name: string): CalculatorState {
  const text = `${name}(,)`;
  return insert(s, text, 'fresh', name.length + 1);
}
function ternaryTemplate(s: CalculatorState, name: string): CalculatorState {
  const text = `${name}(,,)`;
  return insert(s, text, 'fresh', name.length + 1);
}
function powerTemplate(s: CalculatorState, prefix: string): CalculatorState {
  const text = `${prefix}()`;
  return insert(s, text, prefix === '^' || prefix === '×10^' ? 'continue' : 'fresh', text.length - 1);
}

function errorState(s: CalculatorState, error: unknown): CalculatorState {
  if (!(error instanceof CalculatorError)) throw error;
  return {
    ...resetResultModifiers(s),
    phase: 'error',
    result: null,
    error: error.kind,
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
  return {
    angle: s.angle,
    variables: s.variables,
    ans: s.ans,
    random,
    numberFormat: s.numberFormat,
  };
}

function evaluateSingleStatement(
  s: CalculatorState,
  expr: string,
  recordExpr: string,
  random?: number,
): CalculatorState {
  const outcome = evaluateRichExpression(expr, evalContext(s, random));
  const primaryStored = serialize(outcome.primary);
  let variables = s.variables;
  let pairResult: DisplayValue | null = null;

  if (outcome.pairKind && outcome.secondary) {
    const secStored = serialize(outcome.secondary);
    variables = { ...s.variables, X: primaryStored, Y: secStored };
    pairResult = {
      type: 'pair',
      label1: outcome.pairKind === 'pol' ? 'r' : 'X',
      value1: formatDecimal(outcome.primary, s.numberFormat),
      label2: outcome.pairKind === 'pol' ? 'θ' : 'Y',
      value2: formatDecimal(outcome.secondary, s.numberFormat),
    };
  }

  const history = [...s.history, { expression: recordExpr, result: primaryStored }].slice(-40);
  return {
    ...resetResultModifiers(s),
    phase: 'result',
    result: primaryStored,
    pairResult,
    ans: primaryStored,
    variables,
    resultFormat: defaultResultFormat(outcome.primary),
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

    // Continuing multi-statement execution on '='
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

    // Equation with '=' evaluated via SOLVE automatically if '=' is present
    if (s.expression.includes('=')) {
      return startSolveWorkflow(s);
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
    const current = deserialize(currentValue(s));
    const memory = deserialize(s.variables.M);
    const updated = direction === 1 ? add(memory, current) : subtract(memory, current);
    return {
      ...s,
      variables: { ...s.variables, M: serialize(updated) },
      pending: null,
      shift: false,
      alpha: false,
      notice: direction === 1 ? 'اتضافت القيمة للذاكرة M.' : 'اتخصمت القيمة من الذاكرة M.',
    };
  } catch (error) {
    return errorState(s, error);
  }
}

function navigateHistory(s: CalculatorState, direction: 'up' | 'down'): CalculatorState {
  if (!s.history.length) return withNotice(s, 'مفيش عمليات سابقة لسه.');
  const index = s.historyIndex === null
    ? (direction === 'up' ? s.history.length - 1 : s.history.length)
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

function activateModeByName(s: CalculatorState, label: string): CalculatorState {
  const baseReset = {
    ...resetResultModifiers(closeLatches(s)),
    screen: 'normal' as ScreenView,
    phase: 'editing' as Phase,
    expression: '',
    cursor: 0,
    result: null,
    error: null,
    calcPrompt: null,
    solvePrompt: null,
    eqn: null,
    table: null,
  };
  if (label === 'COMP') {
    return { ...baseReset, mode: 'COMP', notice: 'وضع COMP جاهز.' };
  }
  if (label === 'BASE-N') {
    return {
      ...baseReset,
      mode: 'BASE-N',
      baseN: createDefaultBaseN(),
      notice: 'وضع BASE-N جاهز (DEC / HEX / BIN / OCT حسابات 32-bit).',
    };
  }
  if (label === 'EQN') {
    return {
      ...baseReset,
      mode: 'EQN',
      screen: 'eqn-menu',
      notice: 'اختار نوع المعادلة (1–4).',
    };
  }
  if (label === 'TABLE') {
    return {
      ...baseReset,
      mode: 'TABLE',
      table: createTableState(),
      notice: 'وضع TABLE: اكتب دالة f(X) واضغط =.',
    };
  }
  return {
    ...s,
    screen: 'normal',
    shift: false,
    alpha: false,
    notice: `وضع ${label} لسه قيد التطوير؛ الأوضاع المتاحة حاليًا: COMP و BASE-N و EQN و TABLE.`,
  };
}

function handleMenu(s: CalculatorState, id: string): CalculatorState {
  if (id === 'ac') {
    if (s.screen === 'eqn-menu') {
      return { ...s, mode: 'COMP', screen: 'normal', eqn: null, notice: 'رجعنا لوضع COMP.' };
    }
    return { ...s, screen: 'normal', clearTarget: null, notice: null, shift: false, alpha: false };
  }
  if (id === 'mode') {
    return { ...s, screen: 'normal', clearTarget: null, notice: null, shift: false, alpha: false };
  }

  if (s.screen === 'mode') {
    if (id === 'down' || id === 'right') return { ...s, menuPage: 1 };
    if (id === 'up' || id === 'left') return { ...s, menuPage: 0 };
    if (/^[1-8]$/.test(id)) {
      const label = s.menuPage === 0 ? modeNames[Number(id) - 1] : extraModes[Number(id) - 1];
      if (!label) return s;
      return activateModeByName(s, label);
    }
  }

  if (s.screen === 'eqn-menu') {
    const map: Record<string, EqnType> = { '1': 'lin2', '2': 'lin3', '3': 'quad', '4': 'cubic' };
    if (map[id]) {
      return {
        ...s,
        mode: 'EQN',
        screen: 'normal',
        eqn: createEqnState(map[id]),
        notice: 'ادخل المعاملات واضغط = بعد كل قيمة.',
      };
    }
    return s;
  }

  if (s.screen === 'setup') {
    if (id === 'down' || id === 'right') return { ...s, menuPage: 1 };
    if (id === 'up' || id === 'left') return { ...s, menuPage: 0 };
    if (s.menuPage === 0 && /^[1-8]$/.test(id)) {
      if (id === '1') return { ...s, screen: 'normal', ioMode: 'Math', notice: 'نظام الإدخال والعرض: MathIO.' };
      if (id === '2') return { ...s, screen: 'normal', ioMode: 'Line', notice: 'نظام الإدخال والعرض: LineIO.' };
      const angles: Record<string, AngleUnit> = { '3': 'DEG', '4': 'RAD', '5': 'GRA' };
      if (angles[id]) return { ...s, screen: 'normal', angle: angles[id], notice: `وحدة الزوايا: ${angles[id]}.` };
      if (id === '6') return { ...s, screen: 'setup-fix', notice: 'اختار عدد الخانات العشرية Fix (0–9).' };
      if (id === '7') return { ...s, screen: 'setup-sci', notice: 'اختار عدد الأرقام المعنوية Sci (0–9).' };
      if (id === '8') return { ...s, screen: 'setup-norm', notice: 'اختار Norm 1 أو Norm 2.' };
    }
    if (s.menuPage === 1) {
      if (id === '1') return { ...s, screen: 'setup-abdc', notice: 'اختار شكل الكسر الافتراضي (1:ab/c أو 2:d/c).' };
      if (id === '2') return { ...s, screen: 'setup-table', notice: 'اختار نظام جدول الدوال (1:f(X) أو 2:f(X),g(X)).' };
    }
    return s;
  }

  if (s.screen === 'setup-fix' && /^[0-9]$/.test(id)) {
    const digits = Number(id);
    return { ...s, screen: 'normal', numberFormat: { mode: 'Fix', digits }, notice: `تقريب العرض: Fix ${digits}.` };
  }
  if (s.screen === 'setup-sci' && /^[0-9]$/.test(id)) {
    const digits = Number(id);
    return { ...s, screen: 'normal', numberFormat: { mode: 'Sci', digits }, notice: `العرض العلمي: Sci ${digits === 0 ? 10 : digits}.` };
  }
  if (s.screen === 'setup-norm' && (id === '1' || id === '2')) {
    const sub = id === '1' ? 1 : 2;
    return { ...s, screen: 'normal', numberFormat: { mode: 'Norm', sub }, notice: `العرض القياسي: Norm ${sub}.` };
  }
  if (s.screen === 'setup-abdc' && (id === '1' || id === '2')) {
    const style: FractionStyle = id === '1' ? 'mixed' : 'improper';
    return {
      ...s,
      screen: 'normal',
      defaultFractionStyle: style,
      fractionStyle: style,
      notice: style === 'mixed' ? 'عرض الكسور: عدد كسري a b/c.' : 'عرض الكسور: كسر اعتيادي d/c.',
    };
  }
  if (s.screen === 'setup-table' && (id === '1' || id === '2')) {
    const useG = id === '2';
    return { ...s, screen: 'normal', tableUseG: useG, notice: useG ? 'جدول TABLE بدالتين f(X) و g(X).' : 'جدول TABLE بدالة واحدة f(X).' };
  }

  if (s.screen === 'drg') {
    const map: Record<string, string> = { '1': 'ᵈ', '2': 'ʳ', '3': 'ᵍ' };
    if (map[id]) {
      return insert({ ...s, screen: 'normal' }, map[id], 'continue');
    }
    return s;
  }

  if (s.screen === 'clear' && ['1', '2', '3'].includes(id)) {
    return { ...s, screen: 'clear-confirm', clearTarget: id === '1' ? 'setup' : id === '2' ? 'memory' : 'all' };
  }
  if (s.screen === 'clear-confirm' && id === 'equals') {
    if (s.clearTarget === 'all') return { ...createInitialState(), notice: 'اتمسحت الإعدادات والذاكرة.' };
    if (s.clearTarget === 'memory') {
      return { ...s, screen: 'normal', variables: zeroVariables(), ans: zeroStored(), baseN: createDefaultBaseN(), clearTarget: null, notice: 'اتمسحت الذاكرة.' };
    }
    return {
      ...s,
      screen: 'normal',
      angle: 'DEG',
      ioMode: 'Math',
      numberFormat: DEFAULT_NUMBER_FORMAT,
      defaultFractionStyle: 'improper',
      fractionStyle: 'improper',
      tableUseG: true,
      clearTarget: null,
      notice: 'رجعت الإعدادات الافتراضية.',
    };
  }
  return s;
}

function startCalcWorkflow(s: CalculatorState): CalculatorState {
  if (!s.expression.trim()) return withNotice(s, 'اكتب تعبير رياضي الأول قبل CALC.');
  try {
    const vars = extractVariables(s.expression);
    if (vars.length === 0) {
      return calculate(closeLatches(s));
    }
    return {
      ...closeLatches(s),
      calcPrompt: { sourceExpr: s.expression, vars, index: 0, input: '' },
      notice: `ادخل قيمة ${vars[0]} واضغط =.`,
    };
  } catch (err) {
    return errorState(s, err);
  }
}

function handleCalcPrompt(s: CalculatorState, id: string, random?: number): CalculatorState {
  const prompt = s.calcPrompt!;
  if (id === 'ac') {
    return { ...s, calcPrompt: null, shift: false, alpha: false, notice: null };
  }
  if (id === 'del') {
    return { ...s, calcPrompt: { ...prompt, input: prompt.input.slice(0, -1) } };
  }
  if (id === 'equals') {
    try {
      const targetVar = prompt.vars[prompt.index];
      const nextVal = prompt.input.trim()
        ? serialize(evaluateExpression(prompt.input, evalContext(s, random)))
        : s.variables[targetVar];
      const updatedVars = { ...s.variables, [targetVar]: nextVal };
      const nextIndex = prompt.index + 1;
      if (nextIndex < prompt.vars.length) {
        return {
          ...s,
          variables: updatedVars,
          calcPrompt: { ...prompt, index: nextIndex, input: '' },
          notice: `ادخل قيمة ${prompt.vars[nextIndex]} واضغط =.`,
        };
      }
      const nextState = { ...s, variables: updatedVars, calcPrompt: null, expression: prompt.sourceExpr };
      return evaluateSingleStatement(nextState, prompt.sourceExpr, prompt.sourceExpr, random);
    } catch (err) {
      return errorState(s, err);
    }
  }
  const ch = simpleInputChar(id, s.shift, s.alpha);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, calcPrompt: { ...prompt, input: prompt.input + ch } };
  }
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
  return s;
}

function startSolveWorkflow(s: CalculatorState): CalculatorState {
  if (!s.expression.trim()) return withNotice(s, 'اكتب معادلة بدلالة X الأول قبل SOLVE.');
  try {
    splitEquation(s.expression);
    return {
      ...closeLatches(s),
      solvePrompt: { sourceExpr: s.expression, stage: 'prompt-x', input: '' },
      notice: 'ادخل قيمة مبدئية لـ X واضغط = للحل العددي.',
    };
  } catch (err) {
    return errorState(s, err);
  }
}

function handleSolvePrompt(s: CalculatorState, id: string, random?: number): CalculatorState {
  const sp = s.solvePrompt!;
  if (id === 'ac') {
    return {
      ...s,
      solvePrompt: null,
      phase: 'editing',
      expression: sp.sourceExpr,
      cursor: sp.sourceExpr.length,
      shift: false,
      alpha: false,
      notice: null,
    };
  }
  if (sp.stage === 'solved') {
    if (id === 'equals') {
      return { ...s, solvePrompt: { sourceExpr: sp.sourceExpr, stage: 'prompt-x', input: '' }, notice: 'قيمة مبدئية جديدة لـ X؟' };
    }
    return s;
  }
  if (id === 'del') {
    return { ...s, solvePrompt: { ...sp, input: sp.input.slice(0, -1) } };
  }
  if (id === 'equals') {
    try {
      const guessScalar = sp.input.trim()
        ? evaluateExpression(sp.input, evalContext(s, random))
        : deserialize(s.variables.X);
      const { left, right } = splitEquation(sp.sourceExpr);
      const outcome = solveRoot(
        (xVal) => {
          const ctx = { ...evalContext(s, random), variables: { ...s.variables, X: serialize(xVal) } };
          const lv = evaluateExpression(left, ctx);
          const rv = evaluateExpression(right, ctx);
          return subtract(lv, rv);
        },
        guessScalar,
      );
      const rootStored = serialize(outcome.root);
      const resStored = serialize(outcome.residual);
      return {
        ...s,
        phase: 'result',
        result: rootStored,
        ans: rootStored,
        variables: { ...s.variables, X: rootStored },
        pairResult: {
          type: 'pair',
          label1: 'X',
          value1: formatDecimal(outcome.root, s.numberFormat),
          label2: 'L−R',
          value2: formatDecimal(outcome.residual, s.numberFormat),
        },
        solvePrompt: { sourceExpr: sp.sourceExpr, stage: 'solved', input: '', root: rootStored, residual: resStored },
        notice: 'حل عددي تقريبي (Newton-Secant) — تحقق من قيمة L−R.',
      };
    } catch (err) {
      return errorState(s, err);
    }
  }
  const ch = simpleInputChar(id, s.shift, s.alpha);
  if (ch !== null) {
    return { ...s, shift: false, alpha: false, solvePrompt: { ...sp, input: sp.input + ch } };
  }
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
  return s;
}

function simpleInputChar(id: string, shift: boolean, alpha: boolean): string | null {
  if (/^[0-9]$/.test(id)) return id;
  if (shift && id === 'exp') return 'π';
  if (alpha && id === 'exp') return 'e';
  if (alpha && ALPHA_KEYS[id]) return ALPHA_KEYS[id];
  switch (id) {
    case 'dot': return '.';
    case 'neg': case 'subtract': return '-';
    case 'add': return '+';
    case 'multiply': return '×';
    case 'divide': return '÷';
    case 'open': return '(';
    case 'close': return ')';
    case 'sqrt': return 'sqrt(';
    case 'exp': return '×10^(';
    case 'pi': return 'π';
    case 'e': return 'e';
    default: return null;
  }
}

function handleEqnMode(s: CalculatorState, id: string, random?: number): CalculatorState {
  const eqn = s.eqn!;
  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0 };
  if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
  if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };

  if (eqn.outcome) {
    if (id === 'ac') {
      return { ...s, eqn: { ...eqn, outcome: null, solutionIndex: 0, input: '', editingCell: false }, notice: null };
    }
    if (eqn.outcome.status === 'solved') {
      const len = eqn.outcome.items.length;
      if (id === 'down' || id === 'equals') {
        const nextIdx = (eqn.solutionIndex + 1) % len;
        const item = eqn.outcome.items[nextIdx];
        return {
          ...s,
          result: item.scalar ? serialize(item.scalar) : null,
          resultFormat: item.scalar ? defaultResultFormat(item.scalar) : 'decimal',
          eqn: { ...eqn, solutionIndex: nextIdx },
        };
      }
      if (id === 'up') {
        const prevIdx = (eqn.solutionIndex - 1 + len) % len;
        const item = eqn.outcome.items[prevIdx];
        return {
          ...s,
          result: item.scalar ? serialize(item.scalar) : null,
          resultFormat: item.scalar ? defaultResultFormat(item.scalar) : 'decimal',
          eqn: { ...eqn, solutionIndex: prevIdx },
        };
      }
      if (id === 'sd' && s.result) {
        return { ...s, resultFormat: s.resultFormat === 'exact' ? 'decimal' : 'exact' };
      }
    }
    return s;
  }

  // Editing coefficient cells
  if (id === 'ac') {
    if (eqn.editingCell) {
      return { ...s, eqn: { ...eqn, input: '', editingCell: false } };
    }
    return { ...s, screen: 'eqn-menu', notice: 'اختار نوع المعادلة (1–4).' };
  }
  if (id === 'del' && eqn.editingCell) {
    const nextInput = eqn.input.slice(0, -1);
    return { ...s, eqn: { ...eqn, input: nextInput, editingCell: nextInput.length > 0 } };
  }
  if ((id === 'left' || id === 'up') && !eqn.editingCell) {
    return { ...s, eqn: { ...eqn, cursorIndex: Math.max(0, eqn.cursorIndex - 1) } };
  }
  if ((id === 'right' || id === 'down') && !eqn.editingCell) {
    return { ...s, eqn: { ...eqn, cursorIndex: Math.min(eqn.coeffs.length - 1, eqn.cursorIndex + 1) } };
  }
  if (id === 'equals') {
    try {
      const nextCoeffs = [...eqn.coeffs];
      if (eqn.editingCell && eqn.input.trim()) {
        const val = evaluateExpression(eqn.input, evalContext(s, random));
        nextCoeffs[eqn.cursorIndex] = serialize(val);
      }
      if (eqn.cursorIndex + 1 < nextCoeffs.length) {
        return {
          ...s,
          eqn: { ...eqn, coeffs: nextCoeffs, cursorIndex: eqn.cursorIndex + 1, input: '', editingCell: false },
          notice: null,
        };
      }
      const scalars = nextCoeffs.map(deserialize);
      const outcome = solveEqn(eqn.type, scalars);
      const firstScalar = outcome.status === 'solved' ? outcome.items[0]?.scalar : undefined;
      return {
        ...s,
        phase: 'result',
        result: firstScalar ? serialize(firstScalar) : null,
        resultFormat: firstScalar ? defaultResultFormat(firstScalar) : 'decimal',
        eqn: { ...eqn, coeffs: nextCoeffs, input: '', editingCell: false, outcome, solutionIndex: 0 },
        notice: outcome.status === 'solved' ? 'استخدم ▲ / ▼ أو = للتنقل بين الجذور والقيم.' : null,
      };
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
      eqn: { ...eqn, input: (eqn.editingCell ? eqn.input : '') + ch, editingCell: true },
    };
  }
  return s;
}

function handleTableMode(s: CalculatorState, id: string, random?: number): CalculatorState {
  const tbl = s.table!;
  if (id === 'mode') return { ...closeLatches(s), screen: s.shift ? 'setup' : 'mode', menuPage: 0 };

  if (tbl.stage === 'view') {
    if (id === 'ac') {
      return {
        ...s,
        phase: 'editing',
        expression: tbl.fExpr,
        cursor: tbl.fExpr.length,
        table: { ...tbl, stage: 'f' },
        notice: 'عدّل دالة f(X) واضغط =.',
      };
    }
    if (id === 'down') {
      return { ...s, table: { ...tbl, selectedRow: Math.min(tbl.rows.length - 1, tbl.selectedRow + 1) } };
    }
    if (id === 'up') {
      return { ...s, table: { ...tbl, selectedRow: Math.max(0, tbl.selectedRow - 1) } };
    }
    return s;
  }

  if (tbl.stage === 'start' || tbl.stage === 'end' || tbl.stage === 'step') {
    const field = tbl.stage === 'start' ? 'startInput' : tbl.stage === 'end' ? 'endInput' : 'stepInput';
    if (id === 'ac') {
      return {
        ...s,
        expression: tbl.fExpr,
        cursor: tbl.fExpr.length,
        table: { ...tbl, stage: 'f' },
        notice: null,
      };
    }
    if (id === 'del') {
      return { ...s, table: { ...tbl, [field]: tbl[field].slice(0, -1) } };
    }
    if (id === 'equals') {
      if (tbl.stage === 'start') return { ...s, table: { ...tbl, stage: 'end' }, notice: null };
      if (tbl.stage === 'end') return { ...s, table: { ...tbl, stage: 'step' }, notice: null };
      try {
        const ctx = evalContext(s, random);
        const start = evaluateExpression(tbl.startInput || '1', ctx);
        const end = evaluateExpression(tbl.endInput || '5', ctx);
        const step = evaluateExpression(tbl.stepInput || '1', ctx);
        const rows = generateFunctionTable(tbl.fExpr, s.tableUseG ? tbl.gExpr : null, start, end, step, ctx);
        return {
          ...s,
          phase: 'result',
          table: { ...tbl, stage: 'view', rows, selectedRow: 0 },
          notice: `اتكوّن الجدول (${rows.length} صف) — استخدم ▲ / ▼ للتصفح.`,
        };
      } catch (err) {
        return errorState(s, err);
      }
    }
    const ch = simpleInputChar(id, s.shift, s.alpha);
    if (ch !== null) {
      return { ...s, shift: false, alpha: false, table: { ...tbl, [field]: tbl[field] + ch } };
    }
    if (id === 'shift') return { ...s, shift: !s.shift, alpha: false };
    if (id === 'alpha') return { ...s, alpha: !s.alpha, shift: false };
    return s;
  }

  // In stage 'f' or 'g', reuse main expression editor!
  if (id === 'equals') {
    if (tbl.stage === 'f') {
      if (!s.expression.trim()) return withNotice(s, 'اكتب دالة f(X) الأول.');
      if (s.tableUseG) {
        return {
          ...closeLatches(s),
          expression: tbl.gExpr,
          cursor: tbl.gExpr.length,
          table: { ...tbl, stage: 'g', fExpr: s.expression },
          notice: 'اكتب دالة g(X) (أو سيبها فاضية) واضغط =.',
        };
      }
      return {
        ...closeLatches(s),
        table: { ...tbl, stage: 'start', fExpr: s.expression },
        notice: 'حدد نقطة البداية Start?.',
      };
    }
    return {
      ...closeLatches(s),
      table: { ...tbl, stage: 'start', gExpr: s.expression },
      notice: 'حدد نقطة البداية Start?.',
    };
  }
  return null as unknown as CalculatorState; // Sentinel: fall through to standard expression editor
}

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  if (action.type === 'clear-notice') return { ...state, notice: null };
  if (action.type === 'angle') {
    return { ...state, angle: action.angle, screen: 'normal', shift: false, alpha: false, notice: `وحدة الزوايا: ${action.angle}.` };
  }
  if (action.type === 'select-mode') {
    if (state.screen === 'off') return state;
    return activateModeByName(state, action.mode);
  }
  if (action.type === 'insert-token') {
    if (state.screen === 'off') return state;
    if (state.mode !== 'COMP' && !(state.mode === 'TABLE' && (state.table?.stage === 'f' || state.table?.stage === 'g'))) {
      return withNotice(state, 'العنصر ده متاح في وضع الحسابات العلمية COMP أو TABLE.');
    }
    return insert({ ...state, screen: 'normal' }, action.token, action.behavior ?? 'fresh');
  }

  const { id } = action;
  if (state.screen === 'off') {
    return id === 'on'
      ? { ...resetResultModifiers(state), screen: 'normal', phase: 'editing', expression: '', cursor: 0, result: null, error: null, notice: null }
      : state;
  }
  if (state.screen !== 'normal') return handleMenu(state, id);

  if (id === 'on') {
    return {
      ...resetResultModifiers(state),
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

  // Active sub-prompts
  if (state.calcPrompt) return handleCalcPrompt(state, id, action.random);
  if (state.solvePrompt) return handleSolvePrompt(state, id, action.random);
  if (state.mode === 'EQN' && state.eqn) return handleEqnMode(state, id, action.random);
  if (state.mode === 'TABLE' && state.table) {
    const tblNext = handleTableMode(state, id, action.random);
    if (tblNext) return tblNext;
  }

  if (id === 'shift') return { ...state, shift: !state.shift, alpha: false, notice: null };
  if (id === 'alpha') return { ...state, alpha: !state.alpha, shift: false, notice: null };

  if (state.pending) {
    const name = ALPHA_KEYS[id];
    if (!name) {
      if (id === 'ac') return { ...state, pending: null, shift: false, alpha: false, notice: null };
      return withNotice(state, 'اختار متغيّر من A–F أو X أو Y أو M.');
    }
    if (state.pending === 'recall') return insert({ ...state, pending: null }, name);
    try {
      return {
        ...state,
        pending: null,
        shift: false,
        alpha: false,
        variables: { ...state.variables, [name]: currentValue(state) },
        notice: `اتحفظت القيمة في ${name}.`,
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
    if (state.phase !== 'editing') {
      const nextCursor = id === 'left' ? state.expression.length : 0;
      return { ...resetResultModifiers(state), phase: 'editing', result: null, error: null, cursor: nextCursor, notice: null };
    }
    const nextCursor = stepCursor(state.expression, state.cursor, id === 'left' ? -1 : 1);
    return { ...state, phase: 'editing', error: null, cursor: nextCursor, notice: null };
  }
  if (id === 'up' || id === 'down') return navigateHistory(state, id);

  if (id === 'del') {
    if (state.shift) {
      return {
        ...closeLatches(state),
        insertMode: !state.insertMode,
        notice: !state.insertMode ? 'وضع الإدراج INS مفعّل.' : 'وضع الكتابة الفوقية مفعّل.',
      };
    }
    if (state.phase !== 'editing') {
      return { ...resetResultModifiers(state), phase: 'editing', result: null, error: null, cursor: state.expression.length, notice: null };
    }
    if (!state.cursor) return { ...state, phase: 'editing', error: null, notice: null };
    const updated = deleteBeforeCursor(state.expression, state.cursor);
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

  if (id === 'equals') return calculate(closeLatches(state), action.random);

  // BASE-N specific physical shortcuts (matches Casio fx-991ES PLUS keys!)
  if (state.mode === 'BASE-N' && !state.shift && !state.alpha) {
    const baseSwitch: Record<string, BaseMode> = { square: 'DEC', power: 'HEX', log: 'BIN', ln: 'OCT' };
    if (baseSwitch[id]) {
      const targetBase = baseSwitch[id];
      return {
        ...state,
        baseN: { ...state.baseN, base: targetBase },
        expression: state.phase === 'result' ? '' : state.expression,
        cursor: state.phase === 'result' ? 0 : state.cursor,
        notice: `نظام العد الحالي: ${targetBase}.`,
      };
    }
    if (state.baseN.base === 'HEX' && BASEN_HEX_KEYS[id]) {
      return insert(state, BASEN_HEX_KEYS[id]);
    }
    if (/^[0-9]$/.test(id)) {
      const digit = Number(id);
      if (state.baseN.base === 'BIN' && digit > 1) return withNotice(state, 'النظام الثنائي BIN يقبل 0 و 1 فقط.');
      if (state.baseN.base === 'OCT' && digit > 7) return withNotice(state, 'النظام الثماني OCT يقبل الأرقام من 0 إلى 7 فقط.');
      return insert(state, id);
    }
    if (['add', 'subtract', 'multiply', 'divide', 'open', 'close', 'ans'].includes(id)) {
      // allow standard arithmetic below
    } else if (['basen-and', 'basen-or', 'basen-xor', 'basen-xnor', 'basen-not', 'basen-neg'].includes(id)) {
      // handled below
    } else {
      return withNotice(state, 'المفتاح ده غير نشط في وضع BASE-N.');
    }
  }

  if (state.alpha) {
    const s = closeLatches(state);
    if (id === 'exp') return insert(s, 'e');
    if (id === 'cube') return insert(s, ':', 'continue');
    if (id === 'dot') return binaryTemplate(s, 'RanInt');
    if (id === 'calc') return insert(s, '=', 'continue');
    const variable = ALPHA_KEYS[id];
    return variable ? insert(s, variable) : withNotice(state, 'المفتاح ده مالوش رمز ALPHA مباشر.');
  }

  if (state.shift) {
    const s = closeLatches(state);
    switch (id) {
      case 'mode': return { ...s, screen: 'setup', menuPage: 0 };
      case '9': return { ...s, screen: 'clear' };
      case 'rcl': return { ...s, pending: 'store', notice: 'اختار متغيّر لحفظ القيمة (A–F, X, Y, M).' };
      case 'mplus': return updateMemory(s, -1);
      case 'frac': return ternaryTemplate(s, 'mfrac');
      case 'inverse': return insert(s, '!', 'continue');
      case 'sqrt': return functionTemplate(s, 'cbrt');
      case 'power': return binaryTemplate(s, 'root');
      case 'log': return powerTemplate(s, '10^');
      case 'ln': return powerTemplate(s, 'e^');
      case 'sin': case 'cos': case 'tan':
        return functionTemplate({ ...s, hyp: false }, `${state.hyp ? 'a' + id + 'h' : 'a' + id}`);
      case 'dms': {
        if (s.phase !== 'result' || !s.result) {
          return withNotice(s, 'احسب عدد صحيح موجب الأول وبعدين اضغط SHIFT + FACT.');
        }
        if (s.displayOverride === 'fact') {
          return { ...s, displayOverride: 'none', factoredText: null };
        }
        try {
          const factored = primeFactorize(deserialize(s.result));
          return { ...s, displayOverride: 'fact', factoredText: factored, pairResult: null };
        } catch (err) {
          return errorState(s, err);
        }
      }
      case 'eng': {
        if (s.phase !== 'result' || !s.result) {
          return withNotice(s, 'احسب النتيجة الأول عشان تحرّك الأس الهندسي ←ENG.');
        }
        const scalar = deserialize(s.result);
        const nextExp = s.displayOverride === 'eng' && s.engExponent !== null
          ? s.engExponent + 3
          : initialEngExponent(scalar) + 3;
        return { ...s, displayOverride: 'eng', engExponent: nextExp, pairResult: null };
      }
      case 'sd': {
        if (s.phase !== 'result' || !s.result) {
          return withNotice(s, 'احسب النتيجة الكسرية الأول للتبديل بين a b/c و d/c.');
        }
        const scalar = deserialize(s.result);
        if (!scalar.exact || scalar.exact.d === 1n) {
          return { ...s, resultFormat: s.resultFormat === 'exact' ? 'decimal' : 'exact', displayOverride: 'none' };
        }
        const nextStyle: FractionStyle =
          s.resultFormat === 'decimal'
            ? 'mixed'
            : s.fractionStyle === 'mixed'
              ? 'improper'
              : 'mixed';
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
      case 'add': return binaryTemplate(s, 'Pol');
      case 'subtract': return binaryTemplate(s, 'Rec');
      case '0': {
        if (s.phase === 'result' && s.result) {
          const rounded = serialize(roundScalar(deserialize(s.result), s.numberFormat));
          return { ...s, result: rounded, ans: rounded, displayOverride: 'none', notice: 'اتقرّبت القيمة الداخلية حسب دقة العرض (Rnd).' };
        }
        return functionTemplate(s, 'Rnd');
      }
      case 'exp': return insert(s, 'π');
      case 'ans': return { ...s, screen: 'drg', notice: 'اختار وحدة الزاوية للقيمة المدخلة (1:°  2:r  3:g).' };
      case '1': return withNotice(s, 'قائمة STAT التفصيلية لسه قيد التطوير.');
      case 'calc': return startSolveWorkflow(s);
      case 'integ': return binaryTemplate(s, 'deriv');
      case 'dot': {
        const value = action.random ?? Math.random();
        const safe = Math.max(0, Math.min(0.999, Math.floor(value * 1000) / 1000));
        return insert(s, safe.toFixed(3));
      }
      default: return withNotice(s, 'الوظيفة دي لسه قيد التطوير.');
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
    case 'open': return insert(s, '(');
    case 'close': return insert(s, ')', 'continue');
    case 'frac': {
      const previous = s.expression[s.cursor - 1];
      if (s.phase === 'result' || (previous && /[0-9A-FXYMπe)]/.test(previous))) return insert(s, '÷', 'continue');
      return binaryTemplate(s, 'frac');
    }
    case 'mfrac': return ternaryTemplate(s, 'mfrac');
    case 'sqrt': return functionTemplate(s, 'sqrt');
    case 'cbrt': return functionTemplate(s, 'cbrt');
    case 'root': return binaryTemplate(s, 'root');
    case 'abs': return functionTemplate(s, 'abs');
    case 'square': return insert(s, '^2', 'continue');
    case 'cube': return insert(s, '^3', 'continue');
    case 'inverse': return insert(s, '^(-1)', 'continue');
    case 'power': return powerTemplate(s, '^');
    case 'logbase': return binaryTemplate(s, 'logb');
    case 'log': case 'ln': return functionTemplate(s, id);
    case 'dms': {
      if (s.phase === 'result' && s.result) {
        return {
          ...s,
          displayOverride: s.displayOverride === 'dms' ? 'none' : 'dms',
          pairResult: null,
        };
      }
      return insert(s, '°', 'continue');
    }
    case 'eng': {
      if (s.phase !== 'result' || !s.result) {
        return withNotice(s, 'احسب النتيجة الأول عشان تعرضها بالصيغة الهندسية ENG.');
      }
      const scalar = deserialize(s.result);
      const nextExp = s.displayOverride === 'eng' && s.engExponent !== null
        ? s.engExponent - 3
        : initialEngExponent(scalar);
      return { ...s, displayOverride: 'eng', engExponent: nextExp, pairResult: null };
    }
    case 'hyp': return { ...s, hyp: !s.hyp };
    case 'sin': case 'cos': case 'tan':
      return functionTemplate({ ...s, hyp: false }, `${id}${s.hyp ? 'h' : ''}`);
    case 'rcl': return { ...s, pending: 'recall', notice: 'اختار المتغيّر اللي عايز تستدعيه.' };
    case 'mplus': return updateMemory(s, 1);
    case 'ans': return insert(s, 'Ans');
    case 'exp': return powerTemplate(s, '×10^');
    case 'sd':
      if (s.phase !== 'result' || !s.result) return withNotice(s, 'احسب النتيجة الأول عشان تغيّر طريقة عرضها.');
      if (s.displayOverride !== 'none') return { ...s, displayOverride: 'none', engExponent: null, factoredText: null };
      return { ...s, resultFormat: s.resultFormat === 'exact' ? 'decimal' : 'exact', pairResult: null };
    case 'comma': {
      if (s.phase === 'editing' && s.expression[s.cursor] === ',') {
        return { ...s, cursor: s.cursor + 1 };
      }
      return insert(s, ',', 'continue');
    }
    case 'colon': return insert(s, ':', 'continue');
    case 'eq-sign': return insert(s, '=', 'continue');
    case 'pi': return insert(s, 'π');
    case 'e': return insert(s, 'e');
    case 'factorial': return insert(s, '!', 'continue');
    case 'ncr': return insert(s, 'nCr', 'continue');
    case 'npr': return insert(s, 'nPr', 'continue');
    case 'pol': return binaryTemplate(s, 'Pol');
    case 'rec': return binaryTemplate(s, 'Rec');
    case 'ranint': return binaryTemplate(s, 'RanInt');
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
    default: return withNotice(s, 'الوظيفة دي لسه قيد التطوير.');
  }
}

export interface PersistentCalculator {
  version: 1;
  angle: AngleUnit;
  ioMode?: IoMode;
  numberFormat?: NumberFormatSetting;
  defaultFractionStyle?: FractionStyle;
  variables: Record<VariableName, StoredScalar>;
}

export function saveableState(state: CalculatorState): PersistentCalculator {
  return {
    version: 1,
    angle: state.angle,
    ioMode: state.ioMode,
    numberFormat: state.numberFormat,
    defaultFractionStyle: state.defaultFractionStyle,
    variables: state.variables,
  };
}

export function hydrateState(raw: string | null): CalculatorState {
  const state = createInitialState();
  if (!raw) return state;
  try {
    const data = JSON.parse(raw) as Partial<PersistentCalculator>;
    if (data.version !== 1 || !data.variables || !['DEG', 'RAD', 'GRA'].includes(data.angle ?? '')) return state;
    for (const name of VARIABLES) deserialize(data.variables[name]); // validates stored values
    return {
      ...state,
      angle: data.angle as AngleUnit,
      ioMode: data.ioMode === 'Line' ? 'Line' : 'Math',
      numberFormat: data.numberFormat ?? DEFAULT_NUMBER_FORMAT,
      defaultFractionStyle: data.defaultFractionStyle === 'mixed' ? 'mixed' : 'improper',
      fractionStyle: data.defaultFractionStyle === 'mixed' ? 'mixed' : 'improper',
      variables: data.variables,
    };
  } catch {
    return state;
  }
}

export function formatActiveResult(state: CalculatorState): DisplayValue | null {
  if (state.mode === 'BASE-N') {
    if (state.baseN.result === null) return null;
    return { type: 'text', text: formatBaseN(BigInt(state.baseN.result), state.baseN.base) };
  }
  if (state.pairResult) return state.pairResult;
  if (!state.result) return null;
  return formatResult(deserialize(state.result), state.resultFormat, {
    fractionStyle: state.fractionStyle,
    numberFormat: state.numberFormat,
    override: state.displayOverride,
    engExponent: state.engExponent,
    factoredText: state.factoredText,
  });
}
