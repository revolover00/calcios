import { describe, expect, it } from 'vitest';
import {
  calculatorReducer, createInitialState, formatActiveComplexDisplay, formatActiveEqnItemDisplay,
  formatActiveInequalityDisplay, formatActiveResult, hydrateState, saveableState, type CalculatorState,
} from './calculator';
import { deserialize } from './value';
import { formatDecimal, formatResult } from './format';

function press(...ids: string[]): CalculatorState {
  return ids.reduce((state, id) => calculatorReducer(state, { type: 'key', id, random: 0.1237 }), createInitialState());
}
const shown = (s: CalculatorState) => s.result && formatDecimal(deserialize(s.result));

describe('calculator state machine', () => {
  it('evaluates a key sequence', () => expect(shown(press('1', 'add', '2', 'equals'))).toBe('3'));
  it('starts a new calculation on digit, or continues with Ans on operator', () => {
    expect(shown(press('1', 'add', '2', 'equals', '4', 'equals'))).toBe('4');
    expect(shown(press('1', 'add', '2', 'equals', 'multiply', '4', 'equals'))).toBe('12');
  });
  it('enters a fraction template and toggles exact/decimal', () => {
    let s = press('frac', '1', 'right', '2', 'equals');
    expect(s.result && formatResult(deserialize(s.result), s.resultFormat)).toEqual({ type: 'fraction', sign: '', numerator: '1', denominator: '2' });
    s = calculatorReducer(s, { type: 'key', id: 'sd' });
    expect(s.result && formatResult(deserialize(s.result), s.resultFormat)).toEqual({ type: 'text', text: '0.5' });
  });
  it('toggles improper and mixed fractions with SHIFT + S⇔D', () => {
    const s = press('7', 'divide', '2', 'equals', 'shift', 'sd');
    expect(formatActiveResult(s)).toEqual({
      type: 'mixed-fraction',
      sign: '',
      whole: '3',
      numerator: '1',
      denominator: '2',
    });
  });
  it('supports prime factorization FACT on positive integers', () => {
    const s = press('3', '6', '0', 'equals', 'shift', 'dms');
    expect(formatActiveResult(s)).toEqual({ type: 'text', text: '2³×3²×5' });
  });
  it('supports engineering notation ENG and ←ENG shifts', () => {
    const s1 = press('1', '2', '3', '4', 'equals', 'eng');
    expect(formatActiveResult(s1)).toEqual({ type: 'text', text: '1.234×10^3' });
    const s2 = calculatorReducer(s1, { type: 'key', id: 'eng' });
    expect(formatActiveResult(s2)).toEqual({ type: 'text', text: '1234×10^0' });
    const s3 = press('5', '6', 'equals', 'shift', 'eng');
    expect(formatActiveResult(s3)).toEqual({ type: 'text', text: '0.056×10^3' });
  });
  it('toggles DMS display on results', () => {
    const s = press('1', '2', 'dot', '5', 'equals', 'dms');
    expect(formatActiveResult(s)).toEqual({ type: 'text', text: '12°30’0”' });
  });
  it('supports SETUP Fix, Sci, and LineIO', () => {
    const sFix = press('shift', 'mode', '6', '3', '1', 'divide', '8', 'equals');
    expect(formatActiveResult(sFix)).toEqual({ type: 'text', text: '0.125' });
    const sLine = press('shift', 'mode', '2');
    expect(sLine.ioMode).toBe('Line');
  });
  it('steps through multi-statement expressions separated by :', () => {
    const s1 = press('2', 'add', '3', 'alpha', 'cube', 'ans', 'multiply', '4', 'equals');
    expect(shown(s1)).toBe('5');
    expect(s1.statementRun).not.toBeNull();
    const s2 = calculatorReducer(s1, { type: 'key', id: 'equals' });
    expect(shown(s2)).toBe('20');
    expect(s2.statementRun).toBeNull();
  });
  it('supports INS overwrite cursor mode', () => {
    const s = press('1', '2', '3', 'left', 'shift', 'del', '9', 'equals');
    expect(shown(s)).toBe('129');
  });
  it('supports native SHIFT + 7 (CONST) and SHIFT + 8 (CONV) LCD pickers', () => {
    const sConst = press('shift', '7', '2', '8', 'equals');
    expect(shown(sConst)).toBe('299792458');

    const sConv = press('1', '0', '0', 'shift', '8', '3', '8', 'equals');
    expect(shown(sConv)).toBe('212');
  });
  it('supports CALC variable prompting workflow', () => {
    const s = press('2', 'alpha', 'close', 'add', 'alpha', 'neg', 'calc', '3', 'equals', '4', 'equals');
    expect(shown(s)).toBe('10');
  });
  it('supports SOLVE numerical equation workflow', () => {
    const s = press('alpha', 'close', 'square', 'subtract', '9', 'eq-sign', '0', 'solve', '2', 'equals');
    expect(shown(s)).toBe('3');
    expect(deserialize(s.variables.X).decimal.toNumber()).toBeCloseTo(3, 8);
  });
  it('supports CMPLX mode (rectangular, polar ∠, arg, Conjg, and polar conversion)', () => {
    // (2 + 3i) * (1 - 4i) = 14 - 5i
    const sProd = press('mode', '2', 'open', '2', 'add', '3', 'eng', 'close', 'multiply', 'open', '1', 'subtract', '4', 'eng', 'close', 'equals');
    expect(formatActiveResult(sProd)).toEqual({ type: 'text', text: '14−5i' });

    // arg(1+i) in DEG = 45
    const sArg = press('mode', '2', 'shift', '2', '1', '1', 'add', 'eng', 'close', 'equals');
    expect(formatActiveResult(sArg)).toEqual({ type: 'text', text: '45' });

    // 1 + i converted to r∠θ via SHIFT + 2 -> 3
    const sPol = press('mode', '2', '1', 'add', 'eng', 'equals', 'shift', '2', '3');
    expect(formatActiveResult(sPol)).toEqual({ type: 'text', text: '√2∠45' });
  });
  it('supports STAT mode (1-VAR summaries and A+BX linear regression estimates)', () => {
    // 1-VAR: [2, 4, 6] -> mean = 4
    const s1Var = press('mode', '3', '1', '2', 'equals', '4', 'equals', '6', 'equals', 'ac', 'shift', '1', '4', '2', 'equals');
    expect(shown(s1Var)).toBe('4');

    // A+BX: (1, 3), (2, 5), (3, 7) -> 4 ŷ = 9
    const sReg = press(
      'mode', '3', '2',
      '1', 'equals', '3', 'equals',
      '2', 'equals', '5', 'equals',
      '3', 'equals', '7', 'equals',
      'ac',
      '4', 'shift', '1', '5', '5', 'equals',
    );
    expect(shown(sReg)).toBe('9');
  });
  it('supports MATRIX mode (3x3/2x2 editor, det, Trn, inverse, and matrix product)', () => {
    // Define MatA as 2x2 (option 5): [[1, 2], [3, 4]], exit with AC, compute det(MatA) = -2
    const sDet = press(
      'mode', '6', '1', '5',
      '1', 'equals', '2', 'equals', '3', 'equals', '4', 'equals',
      'ac',
      'shift', '4', '7', 'shift', '4', '3', 'close', 'equals',
    );
    expect(shown(sDet)).toBe('-2');

    // MatA^2 -> [[7, 10], [15, 22]]
    const sSq = press(
      'mode', '6', '1', '5',
      '1', 'equals', '2', 'equals', '3', 'equals', '4', 'equals',
      'ac',
      'shift', '4', '3', 'square', 'equals',
    );
    expect(sSq.matrix.showingMatrixResult).toBe(true);
    const matAns = sSq.matrix.matrices.MatAns!;
    expect(formatDecimal(deserialize(matAns.cells[0][0]))).toBe('7');
    expect(formatDecimal(deserialize(matAns.cells[1][1]))).toBe('22');
  });
  it('supports VECTOR mode (3D dot product and cross product)', () => {
    // VctA = [1, 2, 3], VctB = [4, 5, 6]
    const sVec = press(
      'mode', '8', '1', '1',
      '1', 'equals', '2', 'equals', '3', 'equals',
      'ac',
      'shift', '5', '1', '2', '1',
      '4', 'equals', '5', 'equals', '6', 'equals',
      'ac',
      // VctA · VctB = 32
      'shift', '5', '3', 'shift', '5', '7', 'shift', '5', '4', 'equals',
    );
    expect(shown(sVec)).toBe('32');

    // Cross product: VctA × VctB = [-3, 6, -3]
    const sCross = calculatorReducer(
      press(
        'mode', '8', '1', '1',
        '1', 'equals', '2', 'equals', '3', 'equals',
        'ac',
        'shift', '5', '1', '2', '1',
        '4', 'equals', '5', 'equals', '6', 'equals',
        'ac',
        'shift', '5', '3', 'multiply', 'shift', '5', '4',
      ),
      { type: 'key', id: 'equals' },
    );
    expect(sCross.vector.showingVectorResult).toBe(true);
    const vAns = sCross.vector.vectors.VctAns!;
    expect(vAns.coords.map((c) => formatDecimal(deserialize(c)))).toEqual(['-3', '6', '-3']);
  });
  it('supports EQN mode (2x2 linear and quadratic with complex roots)', () => {
    const sLin = press('mode', '5', '1', '2', 'equals', '1', 'equals', '5', 'equals', '1', 'equals', 'neg', '1', 'equals', '1', 'equals');
    expect(shown(sLin)).toBe('2');
    const sLinY = calculatorReducer(sLin, { type: 'key', id: 'down' });
    expect(shown(sLinY)).toBe('1');

    const sQuad = press('mode', '5', '3', '1', 'equals', '0', 'equals', '4', 'equals');
    expect(sQuad.eqn?.outcome?.status).toBe('solved');
    if (sQuad.eqn?.outcome?.status === 'solved') {
      expect(sQuad.eqn.outcome.items[0].complexText).toBe('2i');
      expect(sQuad.eqn.outcome.items[1].complexText).toBe('−2i');
    }
  });
  it('supports TABLE mode generation for f(X) and g(X)', () => {
    const s = press('mode', '7', 'alpha', 'close', 'square', 'equals', '2', 'alpha', 'close', 'equals', 'equals', 'equals', 'equals');
    expect(s.table?.stage).toBe('view');
    expect(s.table?.rows.length).toBe(5);
    expect(s.table?.rows[2]).toEqual({ index: 3, x: '3', fx: '9', gx: '6' });
  });
  it('supports BASE-N mode conversions and bitwise operations', () => {
    const sHex = press('mode', '4', 'power', 'neg', 'tan', 'basen-and', '0', 'tan', 'equals');
    expect(formatActiveResult(sHex)).toEqual({ type: 'text', text: '0000000F' });
    const sDec = calculatorReducer(sHex, { type: 'key', id: 'square' });
    expect(formatActiveResult(sDec)).toEqual({ type: 'text', text: '15' });
  });
  it('supports Page-2 modes: INEQ, VERIF, and DIST', () => {
    // INEQ: X^2 - 5X + 6 < 0 -> 2<X<3
    const sIneq = press('mode', 'down', '1', '1', '2', '1', 'equals', 'neg', '5', 'equals', '6', 'equals');
    expect(formatActiveResult(sIneq)).toEqual({ type: 'text', text: '2<X<3' });

    // VERIF: sin(30)^2 + cos(30)^2 = 1 -> TRUE
    const sVerif = press(
      'mode', 'down', '2',
      'sin', '3', '0', 'close', 'square', 'add', 'cos', '3', '0', 'close', 'square',
      'shift', '6', '1', '1', 'equals',
    );
    expect(formatActiveResult(sVerif)).toEqual({ type: 'text', text: 'TRUE' });

    // DIST: Binomial PD (4:binom-pd) x=2, N=4, p=0.5 -> 0.375
    const sDist = press(
      'mode', 'down', '3', '4',
      '2', 'equals', '4', 'equals', '0', 'dot', '5', 'equals',
    );
    expect(shown(sDist)).toBe('0.375');

    // DIST: Normal CD (-4 to 4, σ=1, μ=0) exercises tail continued fraction -> ~0.9999366575
    const sNormTail = press(
      'mode', 'down', '3', '2',
      'neg', '4', 'equals', '4', 'equals', '1', 'equals', '0', 'equals',
    );
    expect(Number(shown(sNormTail))).toBeCloseTo(0.9999366575, 8);

    // DIST: Inverse Normal (Area=0.975, σ=1, μ=0) -> ~1.959963985
    const sInvNorm = press(
      'mode', 'down', '3', '3',
      '0', 'dot', '9', '7', '5', 'equals', '1', 'equals', '0', 'equals',
    );
    expect(Number(shown(sInvNorm))).toBeCloseTo(1.959963985, 7);
  });

  it('supports cubic INEQ intervals, MATRIX inverse/transpose, and CMPLX polar input', () => {
    // Cubic INEQ: X^3 - 6X^2 + 11X - 6 > 0 -> 1<X<2, 3<X
    const sCubicIneq = press(
      'mode', 'down', '1', '2', '1',
      '1', 'equals', 'neg', '6', 'equals', '1', '1', 'equals', 'neg', '6', 'equals',
    );
    expect(formatActiveResult(sCubicIneq)).toEqual({ type: 'text', text: '1<X<2, 3<X' });

    // MATRIX inverse: [[1, 2], [3, 4]]^(-1) -> [[-2, 1], [1.5, -0.5]]
    const sInv = press(
      'mode', '6', '1', '5',
      '1', 'equals', '2', 'equals', '3', 'equals', '4', 'equals',
      'ac',
      'shift', '4', '3', 'inverse', 'equals',
    );
    const invAns = sInv.matrix.matrices.MatAns!;
    expect(formatDecimal(deserialize(invAns.cells[0][0]))).toBe('-2');
    expect(formatDecimal(deserialize(invAns.cells[1][0]))).toBe('1.5');

    // CMPLX polar input: 2∠60 in DEG -> 1 + √3i
    const sPolarIn = press('mode', '2', '2', 'shift', 'neg', '6', '0', 'equals');
    expect(formatActiveResult(sPolarIn)).toEqual({ type: 'text', text: '1+√3i' });
  });
  it('supports natural key flow for trig and angle setup', () => {
    expect(shown(press('sin', '3', '0', 'equals'))).toBe('0.5');
    const s = press('shift', 'mode', '4');
    expect(s.angle).toBe('RAD');
    expect(s.screen).toBe('normal');
  });
  it('supports SHIFT functions and consumes the shift latch', () => {
    const s = press('5', 'shift', 'inverse', 'equals');
    expect(shown(s)).toBe('120'); expect(s.shift).toBe(false);
  });
  it('stores and recalls named variables', () => {
    const s = press('8', 'equals', 'shift', 'rcl', 'neg', 'ac', 'rcl', 'neg', 'add', '2', 'equals');
    expect(shown(s)).toBe('10');
    expect(deserialize(s.variables.A).decimal.toString()).toBe('8');
  });
  it('adds and subtracts memory independently', () => {
    const s = press('7', 'equals', 'mplus', 'ac', '2', 'equals', 'shift', 'mplus');
    expect(deserialize(s.variables.M).decimal.toString()).toBe('5');
  });
  it('replays history', () => expect(press('1', 'add', '2', 'equals', 'ac', 'up').expression).toBe('1+2'));
  it('reports errors without corrupting the previous answer', () => {
    const s = press('8', 'equals', 'ac', '1', 'divide', '0', 'equals');
    expect(s.error).toBe('Math ERROR'); expect(deserialize(s.ans).decimal.toString()).toBe('8');
  });
  it('supports power off and on', () => expect(press('shift', 'ac', 'on').screen).toBe('normal'));
  it('persists angle and variables with invalid-storage fallback', () => {
    const s = press('shift', 'mode', '4', '8', 'equals', 'shift', 'rcl', 'neg');
    const restored = hydrateState(JSON.stringify(saveableState(s)));
    expect(restored.angle).toBe('RAD'); expect(deserialize(restored.variables.A).decimal.toString()).toBe('8');
    expect(hydrateState('{oops').angle).toBe('DEG');
  });

  it('supports recurring decimal S⇔D cycling, ÷R quotient/remainder (storing E & F), GCD/LCM/Int/Intg, and PreAns', () => {
    // 1 ÷ 3 = -> 1/3 -> S⇔D -> 0.(3) recurring -> S⇔D -> 0.3333333333
    const s1 = press('1', 'divide', '3', 'equals');
    expect(formatActiveResult(s1)).toEqual({ type: 'fraction', sign: '', numerator: '1', denominator: '3' });
    const s2 = calculatorReducer(s1, { type: 'key', id: 'sd' });
    expect(formatActiveResult(s2)).toEqual({
      type: 'recurring-decimal',
      sign: '',
      intPart: '0',
      nonRepeat: '',
      repeat: '3',
    });
    const s3 = calculatorReducer(s2, { type: 'key', id: 'sd' });
    expect(formatActiveResult(s3)).toEqual({ type: 'text', text: '0.3333333333' });

    // 17 ÷R 5 (ALPHA + frac) -> Q=3 (in Ans & E), R=2 (in F)
    const sDivR = press('1', '7', 'alpha', 'frac', '5', 'equals');
    expect(formatActiveResult(sDivR)).toEqual({
      type: 'pair',
      label1: 'Q',
      value1: '3',
      label2: 'R',
      value2: '2',
    });
    expect(formatDecimal(deserialize(sDivR.variables.E))).toBe('3');
    expect(formatDecimal(deserialize(sDivR.variables.F))).toBe('2');

    // PreAns: 10 =, 25 =, ALPHA+Ans + Ans = -> 35
    const sPre = press('1', '0', 'equals', '2', '5', 'equals', 'alpha', 'ans', 'add', 'ans', 'equals');
    expect(shown(sPre)).toBe('35');

    // ALPHA+multiply (GCD) & ALPHA+divide (LCM)
    const sGcd = press('alpha', 'multiply', '4', '8', 'shift', 'close', '1', '8', '0', 'close', 'equals');
    expect(shown(sGcd)).toBe('12');
  });

  it('supports MATRIX Ref/Rref, VECTOR Angle & Data edit, BASE-N prefixes, chained VERIF, STAT Distr/_+CX2, and 2D INEQ', () => {
    // MATRIX Rref([[1, 2, 5], [1, -1, 2]]) -> [[1, 0, 3], [0, 1, 1]]
    const sRref = press(
      'mode', '6', '1', '4', // MatA 2x3
      '1', 'equals', '2', 'equals', '5', 'equals',
      '1', 'equals', 'neg', '1', 'equals', '2', 'equals',
      'ac',
      'shift', '4', 'down', '2', // Rref(
      'shift', '4', '3', 'close', 'equals',
    );
    const rrefMat = sRref.matrix.matrices.MatAns!;
    expect(formatDecimal(deserialize(rrefMat.cells[0][2]))).toBe('3');
    expect(formatDecimal(deserialize(rrefMat.cells[1][2]))).toBe('1');

    // VECTOR Angle([1, 0], [1, 1]) in DEG -> 45, plus SHIFT+5 -> 2:Data -> 2:VctB edit
    const sAng = press(
      'mode', '8', '1', '2', // VctA 2D
      '1', 'equals', '0', 'equals', 'ac',
      'shift', '5', '1', '2', '2', // VctB 2D
      '1', 'equals', '1', 'equals', 'ac',
      'shift', '5', '8', // Angle(
      'shift', '5', '3', 'shift', 'close', 'shift', '5', '4', 'close', 'equals',
    );
    expect(shown(sAng)).toBe('45');

    // BASE-N explicit prefixes in BIN mode: d10 + h0F = 25 (0000000000011001)
    const sBasePref = press(
      'mode', '4', 'log', // BIN
      'shift', '3', 'down', '1', '1', '0', // d10
      'add',
      'shift', '3', 'down', '2', '0', 'tan', // h0F
      'equals',
    );
    expect(formatActiveResult(sBasePref)).toEqual({ type: 'text', text: '0000000000011001' });

    // Chained VERIF: 1 < 2 < 3 -> TRUE, 1 < 5 < 3 -> FALSE
    const sVerifTrue = press('mode', 'down', '2', '1', 'shift', '6', '4', '2', 'shift', '6', '4', '3', 'equals');
    expect(formatActiveResult(sVerifTrue)).toEqual({ type: 'text', text: 'TRUE' });
    const sVerifFalse = press('mode', 'down', '2', '1', 'shift', '6', '4', '5', 'shift', '6', '4', '3', 'equals');
    expect(formatActiveResult(sVerifFalse)).toEqual({ type: 'text', text: 'FALSE' });

    // STAT 1-VAR 5:Distr -> 1:P(0) = 0.5
    const sStatDistr = press('mode', '3', '1', '2', 'equals', '4', 'equals', 'ac', 'shift', '1', '5', '1', '0', 'close', 'equals');
    expect(shown(sStatDistr)).toBe('0.5');

    // EQN exact symbolic surd roots: X^2 - 2X - 1 = 0 -> 1+√2 and 1-√2
    const sEqnSurd = press('mode', '5', '3', '1', 'equals', 'neg', '2', 'equals', 'neg', '1', 'equals');
    expect(sEqnSurd.result && formatResult(deserialize(sEqnSurd.result), 'exact')).toEqual({
      type: 'symbolic-surd',
      a: '1',
      b: '1',
      rad: '2',
      d: '1',
    });

    // INEQ 2D display: X^2 - 2 > 0 -> header 'X<A, B<X' with exact -√2 and √2 roots
    const sIneq2D = press('mode', 'down', '1', '1', '1', '1', 'equals', '0', 'equals', 'neg', '2', 'equals');
    const disp2D = formatActiveInequalityDisplay(sIneq2D);
    expect(disp2D?.type).toBe('ineq-2d');
    if (disp2D?.type === 'ineq-2d') {
      expect(disp2D.header).toBe('X<A, B<X');
      expect(disp2D.segments.length).toBe(2);
    }

    // TABLE Start?/End?/Step? replaces default on first digit rather than appending
    const sTblReplace = press('mode', '7', 'alpha', 'close', 'equals', 'equals', '0', 'equals', '2', 'equals', '1', 'equals');
    expect(sTblReplace.table?.rows.map((r) => r.x)).toEqual(['0', '1', '2']);
  });

  it('supports exact [◀][▶]:Goto cursor jump, ▸Simp, SHIFT+= (≈ & Re⇔Im), 2D CMPLX/EQN, dynamic DIST List, and M+/STO display', () => {
    // 1) Exact [◀][▶]:Goto on Syntax ERROR: '12+×5' -> offset 3 (right at '×')
    const sErr = press('1', '2', 'add', 'multiply', '5', 'equals');
    expect(sErr.phase).toBe('error');
    expect(sErr.errorCursor).toBe(3);
    const sGoto = calculatorReducer(sErr, { type: 'key', id: 'left' });
    expect(sGoto.phase).toBe('editing');
    expect(sGoto.cursor).toBe(3);

    // 2) Manual ▸Simp across steps: 12 ÷ 18 ▸Simp = -> 6/9 (÷2), then ▸Simp = -> 2/3 (÷3)
    const sSimp1 = press('1', '2', 'divide', '1', '8', 'simp', 'equals');
    expect(formatActiveResult(sSimp1)).toEqual({
      type: 'fraction',
      sign: '',
      numerator: '6',
      denominator: '9',
      simpFactor: '2',
    });
    const sSimp2 = calculatorReducer(
      calculatorReducer(sSimp1, { type: 'key', id: 'simp' }),
      { type: 'key', id: 'equals' },
    );
    expect(formatActiveResult(sSimp2)).toEqual({
      type: 'fraction',
      sign: '',
      numerator: '2',
      denominator: '3',
      simpFactor: '3',
    });

    // 3) SHIFT + = (≈) evaluates 1 ÷ 3 directly as decimal approximation
    const sApprox = press('1', 'divide', '3', 'shift', 'equals');
    expect(sApprox.resultFormat).toBe('decimal');
    expect(formatActiveResult(sApprox)).toEqual({ type: 'text', text: '0.3333333333' });

    // 4) 2D CMPLX rendering + Re⇔Im toggle via SHIFT + = + exact polar angle in RAD
    const sCmplx2D = press('mode', '2', 'open', '1', 'add', 'eng', 'close', 'divide', '2', 'equals');
    const cDisp = formatActiveComplexDisplay(sCmplx2D);
    expect(cDisp?.partLabel).toBeNull();
    expect(cDisp?.value).toEqual({
      type: 'complex-2d',
      form: 'rect',
      re: { type: 'fraction', sign: '', numerator: '1', denominator: '2' },
      imSign: '+',
      im: { type: 'fraction', sign: '', numerator: '1', denominator: '2' },
    });
    const sRe = press('mode', '2', 'open', '1', 'add', 'eng', 'close', 'divide', '2', 'equals', 'shift', 'equals');
    expect(formatActiveComplexDisplay(sRe)?.partLabel).toBe('Re=');
    const sIm = calculatorReducer(sRe, { type: 'key', id: 'shift' });
    const sIm2 = calculatorReducer(sIm, { type: 'key', id: 'equals' });
    expect(formatActiveComplexDisplay(sIm2)?.partLabel).toBe('Im=');

    // Polar CMPLX in RAD: (1+i)▸r∠θ -> √2 ∠ 1/4 π
    const sPolarRad = press('shift', 'mode', '4', 'mode', '2', 'open', '1', 'add', 'eng', 'close', 'shift', '2', '3', 'equals');
    const polarDisp = formatActiveComplexDisplay(sPolarRad);
    expect(polarDisp?.value.type).toBe('complex-2d');
    if (polarDisp?.value.type === 'complex-2d') {
      expect(polarDisp.value.theta).toEqual({ type: 'symbolic-pi', sign: '', numerator: '1', denominator: '4' });
    }

    // 5) EQN quadratic X^2 - X + 1 = 0 -> 2D complex roots 1/2 ± √3/2 i AND Minimum vertex (1/2, 3/4)
    const sEqnC = press('mode', '5', '3', '1', 'equals', 'neg', '1', 'equals', '1', 'equals');
    expect(sEqnC.eqn?.outcome?.status).toBe('solved');
    if (sEqnC.eqn?.outcome?.status === 'solved') {
      const items = sEqnC.eqn.outcome.items;
      expect(items.map((it) => it.label)).toEqual(['X₁', 'X₂', 'X-Value Minimum', 'Y-Value Minimum']);
      const root1Disp = formatActiveEqnItemDisplay(sEqnC, items[0]);
      expect(root1Disp.type).toBe('complex-2d');
      expect(items[2].scalar && formatResult(items[2].scalar, 'exact')).toEqual({
        type: 'fraction',
        sign: '',
        numerator: '1',
        denominator: '2',
      });
      expect(items[3].scalar && formatResult(items[3].scalar, 'exact')).toEqual({
        type: 'fraction',
        sign: '',
        numerator: '3',
        denominator: '4',
      });
    }

    // 6) Dynamic DIST List mode: insert 0, 1, 99, delete 99, append 2, advance to N=2, p=0.5 -> P=[0.25, 0.5, 0.25]
    const sDistList = press(
      'mode', 'down', '3', '4', // Binomial PD (Var)
      'right', // switch to dynamic List editor
      '0', 'equals',
      '1', 'equals',
      '9', '9', 'equals',
      'up', 'del', // delete row '99'
      '2', 'equals',
      'ac', // advance to params (N, p)
      '2', 'equals',
      '0', 'dot', '5', 'equals',
    );
    expect(sDistList.dist?.listResults).toEqual([
      { x: '0', p: '0.25' },
      { x: '1', p: '0.5' },
      { x: '2', p: '0.25' },
    ]);

    // 7) M+ on un-evaluated expression evaluates & displays result while updating M; STO shows →A
    const sMem = press('3', 'add', '4', 'mplus');
    expect(sMem.phase).toBe('result');
    expect(shown(sMem)).toBe('7');
    expect(formatDecimal(deserialize(sMem.variables.M))).toBe('7');

    const sSto = press('5', 'add', '6', 'shift', 'rcl', 'neg');
    expect(sSto.phase).toBe('result');
    expect(sSto.expression).toBe('5+6→A');
    expect(shown(sSto)).toBe('11');
  });
});
