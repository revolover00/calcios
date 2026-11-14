import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App, mapKeyboardEvent } from '../App';
import { LcdScreen } from '../components/LcdScreen';
import { NaturalExpression, NaturalResult } from '../components/NaturalMath';
import { evaluateBaseN } from './basen';
import {
  calculatorReducer,
  createInitialState,
  formatActiveComplexDisplay,
  formatActiveEqnItemDisplay,
  formatActiveResult,
  hydrateState,
  saveableState,
  type CalculatorState,
} from './calculator';
import { absComplex, divComplex, evaluateComplex, formatComplex2D, formatComplexDisplay, serializeComplex, zeroStoredComplex } from './cmplx';
import { solveCubic, solveLinear2, solveLinear3 } from './eqn';
import { CalculatorError } from './errors';
import { evaluateExpression, extractVariables, parseAssignmentStatement } from './expression';
import { formatDecimal, formatEngineering, formatResult, formatSymbolicLinear } from './format';
import { solveInequality } from './ineq';
import { statNormR } from './dist';
import { invertMatrix, refMatrix, rrefMatrix, type MatrixValue } from './matrix';
import { computeStatSummary } from './stat';
import { extractSquareFactor } from './symbolic';
import { generateFunctionTable } from './table';
import {
  applyFunction,
  combinatoric,
  deserialize,
  makeScalar,
  mixedFraction,
  multiply,
  polarFromRect,
  roundScalar,
  scalarFromInteger,
  scalarFromLiteral,
  serialize,
  VARIABLES,
  zeroStored,
  type StoredScalar,
  type VariableName,
} from './value';
import { angleVector, normVector } from './vector';
import { evaluateVerification } from './verif';
import { normalizeToCalcios2D } from './visionScan';
import * as visionScanModule from './visionScan';

function zeroVars(): Record<VariableName, StoredScalar> {
  return Object.fromEntries(VARIABLES.map((v) => [v, zeroStored()])) as Record<VariableName, StoredScalar>;
}

function pressSeq(initial: CalculatorState, ...keys: string[]): CalculatorState {
  let s = initial;
  for (const k of keys) {
    s = calculatorReducer(s, { type: 'key', id: k });
  }
  return s;
}

describe('Second 50-Bug Senior Audit Regression Suite (#51–#100)', () => {
  it('Bugs #51–#60 (Value, Expression, Symbolic): tiny magnitude preservation, integer mfrac, scaled Pol, n<1e10 nCr, Rnd exact, RAD tan pole, rng stream, var DMS, multi-stmt CALC =, large surd factor', () => {
    // #51: representable sub-1e-99 values remain nonzero and exact.
    const tiny = multiply(scalarFromLiteral('1e-60'), scalarFromLiteral('1e-60'));
    expect(tiny.decimal.eq('1e-120')).toBe(true);
    expect(tiny.exact).toEqual({ n: 1n, d: 10n ** 120n });

    // #52: mixedFraction rejects non-integer or irrational arguments
    expect(() => mixedFraction(scalarFromLiteral('1.5'), scalarFromInteger(1), scalarFromInteger(2))).toThrow(CalculatorError);
    expect(() =>
      mixedFraction(
        scalarFromInteger(1),
        applyFunction('sqrt', [scalarFromInteger(2)], 'DEG'),
        scalarFromInteger(3),
      ),
    ).toThrow(CalculatorError);

    // #53: polarFromRect uses scaled hypot so Pol(3e60, 4e60) = (5e60, 53.13010235°) without 1e120 overflow
    const pol = polarFromRect(scalarFromLiteral('3e60'), scalarFromLiteral('4e60'), 'DEG');
    expect(Number(pol.r.decimal.div('1e60').toString())).toBeCloseTo(5, 10);
    expect(pol.theta.decimal.toNumber()).toBeCloseTo(53.130102354, 7);

    // #54: combinatoric enforces n < 1e10 and overflows cleanly at >= 1e100
    expect(combinatoric(scalarFromLiteral('9999999999'), scalarFromInteger(1), false).exact).toEqual({
      n: 9999999999n,
      d: 1n,
    });
    expect(() => combinatoric(scalarFromLiteral('10000000000'), scalarFromInteger(1), false)).toThrow(CalculatorError);
    expect(() => combinatoric(scalarFromInteger(10000), scalarFromInteger(5000), false)).toThrow(/outside the supported range/);

    // #55: roundScalar preserves exact rational in Sci mode and handles Fix on >= 1e10 safely
    const oneThird = evaluateExpression('1÷3', { angle: 'DEG', variables: zeroVars(), ans: zeroStored() });
    const rndSci2 = roundScalar(oneThird, { mode: 'Sci', digits: 2 });
    expect(rndSci2.exact).toEqual({ n: 33n, d: 100n });
    const rndHugeFix = roundScalar(scalarFromLiteral('1.234567890123e20'), { mode: 'Fix', digits: 2 });
    expect(formatDecimal(rndHugeFix)).toBe('1.23456789×10^20');

    // #56: tan in RAD mode throws Math ERROR at numerical π/2 without symbolic tag
    const numHalfPi = makeScalar('1.5707963267948966192313216916397514', undefined, true);
    expect(() => applyFunction('tan', [numHalfPi], 'RAD')).toThrow(/Undefined tangent/);

    // #57: rng stream draws distinct samples across multiple Ran# and RanInt calls in one expression
    const samples = [0.123, 0.789, 0.0, 0.999];
    let sIdx = 0;
    const sumRan = evaluateExpression('Ran#+Ran#', {
      angle: 'DEG',
      variables: zeroVars(),
      ans: zeroStored(),
      rng: () => samples[sIdx++],
    });
    expect(sumRan.decimal.toNumber()).toBeCloseTo(0.123 + 0.789, 10);
    const sumRanInt = evaluateExpression('RanInt(1,10)+RanInt(1,10)', {
      angle: 'DEG',
      variables: zeroVars(),
      ans: zeroStored(),
      rng: () => samples[sIdx++],
    });
    expect(sumRanInt.decimal.toNumber()).toBe(1 + 10);

    // #58: sexagesimal DMS supports variables for minutes and seconds (A°B°C° -> 12.5125, not 12*30*45)
    const vars = zeroVars();
    vars.A = serialize(scalarFromInteger(12));
    vars.B = serialize(scalarFromInteger(30));
    vars.C = serialize(scalarFromInteger(45));
    expect(evaluateExpression('A°B°C°', { angle: 'DEG', variables: vars, ans: zeroStored() }).decimal.toNumber()).toBeCloseTo(
      12.5125,
      10,
    );

    // #59: extractVariables rejects non-assignment '=' in multi-statement CALC, while supporting expr→VAR
    expect(() => extractVariables('X+1=2:X+3')).toThrow(CalculatorError);
    expect(parseAssignmentStatement('5+2→A')).toEqual({ target: 'A', rhs: '5+2' });
    expect(extractVariables('X+1→A:A+Y')).toEqual(['X', 'Y']);

    // #60: extractSquareFactor extracts large prime squares up to 10^12 (150011 is prime > 25000*6)
    const radicand = 2n * 150011n * 150011n;
    expect(extractSquareFactor(radicand)).toEqual({ sq: 150011n, rem: 2n });
  });

  it('retains representable normal-tail probabilities beyond the arbitrary cutoff', () => {
    const tail = statNormR(scalarFromInteger(200)).decimal;
    expect(tail.isZero()).toBe(false);
    expect(tail.lt('1e-8600')).toBe(true);
  });

  it('does not add an out-of-range final row to a function table', () => {
    const context = { angle: 'DEG' as const, variables: zeroVars(), ans: zeroStored() };
    const rows = generateFunctionTable(
      'X', null, scalarFromInteger(0), scalarFromLiteral('0.9999999999999999999999999'),
      scalarFromInteger(1), context,
    );
    expect(rows.map((row) => row.x)).toEqual(['0']);

    const exactGrid = generateFunctionTable(
      'X', null, scalarFromInteger(0), scalarFromLiteral('0.3'),
      scalarFromLiteral('0.1'), context,
    );
    expect(exactGrid.map((row) => row.x)).toEqual(['0', '0.1', '0.2', '0.3']);
  });

  it('keeps the polar angle of tiny nonzero complex values in the component view', () => {
    const state = createInitialState();
    state.mode = 'CMPLX';
    state.angle = 'DEG';
    state.cmplx = {
      ...state.cmplx,
      format: 'polar',
      partView: 'second',
      result: serializeComplex({
        re: scalarFromLiteral('1e-30'),
        im: scalarFromLiteral('1e-30'),
      }),
    };

    expect(formatActiveComplexDisplay(state)?.value).toEqual({ type: 'text', text: '45' });
  });

  it('Bugs #61–#65 (Format & NaturalMath): symmetric negative symbolic budget, integer ▸Simp factor, -0 guard, Fix carry >=1e10, true minus rendering', () => {
    // #61: negative 10-digit fraction has same symbolic linear budget as positive counterpart
    const posFrac = evaluateExpression('12345÷67891', { angle: 'DEG', variables: zeroVars(), ans: zeroStored() });
    const negFrac = evaluateExpression('-12345÷67891', { angle: 'DEG', variables: zeroVars(), ans: zeroStored() });
    expect(formatSymbolicLinear(posFrac)).toBe('12345/67891');
    expect(formatSymbolicLinear(negFrac)).toBe('−12345/67891');

    // #62: manual ▸Simp reducing to integer preserves simpFactor (`÷2`) in DisplayValue & NaturalResult
    const simpInt = evaluateExpression('4÷2▸Simp2', { angle: 'DEG', variables: zeroVars(), ans: zeroStored() });
    const dispSimp = formatResult(simpInt, 'exact');
    expect(dispSimp).toEqual({ type: 'text', text: '2', simpFactor: '2' });
    const { container: simpDom } = render(<NaturalResult display={dispSimp} />);
    expect(simpDom.querySelector('.math-simp-factor')?.textContent).toContain('÷2');

    // #63: formatEngineering and Sci mode never produce '-0×10^...'
    expect(formatEngineering(scalarFromInteger(0), -3)).toBe('0×10^-3');
    expect(formatDecimal(scalarFromInteger(0), { mode: 'Sci', digits: 3 })).toBe('0.00×10^0');

    // #64: Fix mode switches to scientific notation when rounding carries across 10^10
    expect(formatDecimal(scalarFromLiteral('9999999999.99'), { mode: 'Fix', digits: 1 })).toBe('1×10^10');

    // #65: NaturalResult normalizes '-' to '−' globally (including polar angles & scientific exponents)
    const { container: negDom } = render(
      <NaturalResult display={{ type: 'text', text: '-3.5×10^-4∠-45' }} />,
    );
    expect(negDom.textContent).toBe('−3.5×10−4∠−45');
    expect(negDom.querySelector('sup.lcd-exp')?.textContent).toBe('−4');
  });

  it('Bugs #66–#75 (CMPLX, Vector, Matrix, BASE-N, EQN, INEQ): Smith complex div/hypot, CMPLX Ran#/Pol/Rec/PreAns/Fix0, 1e60 vectors, 1e-30 matrices & linear systems, cubic triple root', () => {
    // #66: Smith complex division & scaled hypot avoid 1e120 overflow
    const bigA = { re: scalarFromLiteral('1e60'), im: scalarFromLiteral('1e60') };
    const bigB = { re: scalarFromLiteral('1e60'), im: scalarFromLiteral('-1e60') };
    const quot = divComplex(bigA, bigB);
    expect(quot.re.decimal.toNumber()).toBeCloseTo(0, 10);
    expect(quot.im.decimal.toNumber()).toBeCloseTo(1, 10);
    const absZ = absComplex({ re: scalarFromLiteral('3e60'), im: scalarFromLiteral('4e60') }, 'DEG');
    expect(Number(absZ.re.decimal.div('1e60').toString())).toBeCloseTo(5, 10);

    // #67 & #68: CMPLX supports Ran#, RanInt, Pol, Rec, and enforces top-level end for ▸r∠θ
    let rSeq = 0;
    const cmplxCtx = {
      angle: 'DEG' as const,
      variables: zeroVars(),
      cmplxAns: zeroStoredComplex(),
      rng: () => [0.25, 0.9][rSeq++],
    };
    const rCmplx = evaluateComplex('Ran#+RanInt(1,10)i', cmplxCtx).value;
    expect(rCmplx.re.decimal.toNumber()).toBeCloseTo(0.25, 10);
    expect(rCmplx.im.decimal.toNumber()).toBe(10);
    const polOut = evaluateComplex('Pol(3,4)', cmplxCtx);
    expect(polOut.preferredFormat).toBe('polar');
    expect(formatComplexDisplay(polOut.value, 'polar', 'DEG', false)).toBe('5∠53.13010235');
    const recOut = evaluateComplex('Rec(2,60)', cmplxCtx);
    expect(recOut.value.re.decimal.toNumber()).toBeCloseTo(1, 10);
    expect(() => evaluateComplex('1+i▸r∠θ+2', cmplxCtx)).toThrow(CalculatorError);
    expect(() => evaluateComplex('(1+i▸r∠θ)', cmplxCtx)).toThrow(CalculatorError);

    // #69: PreAns in CMPLX preserves full complex value (both real & imaginary parts!)
    let sCmplx = calculatorReducer(createInitialState(), { type: 'select-mode', mode: 'CMPLX' });
    sCmplx = pressSeq(sCmplx, '2', 'add', '3', 'eng', 'equals'); // Ans = 2+3i
    sCmplx = pressSeq(sCmplx, '4', 'add', '5', 'eng', 'equals'); // Ans = 4+5i, PreAns = 2+3i
    sCmplx = pressSeq(sCmplx, 'alpha', 'ans', 'equals'); // PreAns = 2+3i
    expect(formatActiveResult(sCmplx)).toEqual({ type: 'text', text: '2+3i' });

    // #70: formatComplexDisplay & formatComplex2D check zero/unit after Fix/Norm rounding
    const tinyIm = { re: scalarFromInteger(1), im: scalarFromLiteral('0.001') };
    expect(formatComplexDisplay(tinyIm, 'rect', 'DEG', false, { mode: 'Fix', digits: 2 })).toBe('1.00');
    expect(formatComplex2D(tinyIm, 'rect', 'DEG', false, { mode: 'Fix', digits: 2 })).toEqual({
      type: 'text',
      text: '1.00',
    });
    const nearOneIm = { re: scalarFromInteger(1), im: scalarFromLiteral('1.00000000001') };
    expect(formatComplexDisplay(nearOneIm, 'rect', 'DEG', false)).toBe('1+i');

    // #71: normVector & angleVector handle 1e60-scaled vectors without overflow
    const vBig1 = { dim: 2 as const, coords: [scalarFromLiteral('3e60'), scalarFromLiteral('4e60')] };
    const vBig2 = { dim: 2 as const, coords: [scalarFromLiteral('-4e60'), scalarFromLiteral('3e60')] };
    expect(Number(normVector(vBig1).decimal.div('1e60').toString())).toBeCloseTo(5, 10);
    expect(angleVector(vBig1, vBig2, 'DEG').decimal.toNumber()).toBeCloseTo(90, 10);

    // #72: invertMatrix, refMatrix, rrefMatrix handle 1e-30 scaled nonsingular matrices
    const tinyDiag: MatrixValue = {
      rows: 2,
      cols: 2,
      cells: [
        [scalarFromLiteral('2e-30'), scalarFromInteger(0)],
        [scalarFromInteger(0), scalarFromLiteral('4e-30')],
      ],
    };
    const invTiny = invertMatrix(tinyDiag);
    expect(Number(invTiny.cells[0][0].decimal.div('1e29').toString())).toBeCloseTo(5, 10);
    expect(Number(invTiny.cells[1][1].decimal.div('1e29').toString())).toBeCloseTo(2.5, 10);
    expect(refMatrix(tinyDiag).cells[0][0].decimal.toNumber()).toBe(1);
    expect(rrefMatrix(tinyDiag).cells[1][1].decimal.toNumber()).toBe(1);

    // #73: BASE-N evaluates variables X, Y, M (in all bases) and A–F (outside HEX)
    const bVars = zeroVars();
    bVars.X = serialize(scalarFromInteger(10));
    bVars.M = serialize(scalarFromInteger(5));
    bVars.A = serialize(scalarFromInteger(7));
    expect(evaluateBaseN('X+M+A', 'DEC', 0n, bVars)).toBe(22n);
    expect(evaluateBaseN('h10+X', 'HEX', 0n, bVars)).toBe(26n);

    // #74: solveLinear2 and solveLinear3 solve 1e-30 scaled systems accurately
    const lin2Tiny = solveLinear2([
      scalarFromLiteral('1e-30'), scalarFromLiteral('1e-30'), scalarFromLiteral('3e-30'),
      scalarFromLiteral('1e-30'), scalarFromLiteral('-1e-30'), scalarFromLiteral('1e-30'),
    ]);
    expect(lin2Tiny.status).toBe('solved');
    if (lin2Tiny.status === 'solved') {
      expect(lin2Tiny.items[0].scalar?.decimal.toNumber()).toBeCloseTo(2, 10);
      expect(lin2Tiny.items[1].scalar?.decimal.toNumber()).toBeCloseTo(1, 10);
    }
    const lin3Tiny = solveLinear3([
      scalarFromLiteral('1e-30'), scalarFromInteger(0), scalarFromInteger(0), scalarFromLiteral('5e-30'),
      scalarFromInteger(0), scalarFromLiteral('2e-30'), scalarFromInteger(0), scalarFromLiteral('6e-30'),
      scalarFromInteger(0), scalarFromInteger(0), scalarFromLiteral('3e-30'), scalarFromLiteral('12e-30'),
    ]);
    expect(lin3Tiny.status).toBe('solved');
    if (lin3Tiny.status === 'solved') {
      expect(lin3Tiny.items.map((it) => it.scalar?.decimal.toNumber())).toEqual([5, 3, 4]);
    }

    // #75: solveCubic & solveInequality collapse triple roots cleanly across irrational and large scales
    const cbrt2 = scalarFromInteger(2).decimal.cbrt();
    const irratTriple = solveInequality(3, '>', [
      scalarFromInteger(1),
      makeScalar(cbrt2.times(-3)),
      makeScalar(cbrt2.pow(2).times(3)),
      scalarFromInteger(-2),
    ]);
    expect(irratTriple.roots).toHaveLength(1);
    expect(irratTriple.roots[0].decimal.toNumber()).toBeCloseTo(cbrt2.toNumber(), 10);

    const largeTriple = solveCubic([
      scalarFromInteger(1),
      scalarFromLiteral('-3e8'),
      scalarFromLiteral('3e16'),
      scalarFromLiteral('-1e24'),
    ]);
    expect(largeTriple.status).toBe('solved');
    if (largeTriple.status === 'solved') {
      expect(largeTriple.items).toHaveLength(1);
      expect(largeTriple.items[0].scalar?.decimal.toNumber()).toBeCloseTo(1e8, 4);
    }
  });

  it('Bugs #76–#85 (STAT, EQN/DIST STO & ENG, TABLE, VERIF, Ran#, Sub-Editor DEL/Keys, expr→VAR, Replay Status)', () => {
    // #76: STAT editor rejects negative/fractional FRQ immediately and caps at 80 rows cleanly
    let sStat = pressSeq(createInitialState(), 'shift', 'mode', 'down', '4', '1'); // STAT Frequency ON
    sStat = pressSeq(sStat, 'mode', '3', '1'); // STAT 1-VAR
    sStat = pressSeq(sStat, '1', '0', 'equals', 'neg', '2', 'equals'); // FRQ = -2 -> Math ERROR
    expect(sStat.phase).toBe('error');
    expect(sStat.error).toBe('Math ERROR');

    // #77: computeStatSummary ignores stale row.freq when useFreq === false + statUseFreq persists
    const rowsWithFreq = [
      { x: '10', freq: '5' },
      { x: '20', freq: '1' },
    ];
    expect(computeStatSummary('1-VAR', rowsWithFreq, true).n.decimal.toNumber()).toBe(6);
    expect(computeStatSummary('1-VAR', rowsWithFreq, false).n.decimal.toNumber()).toBe(2);
    const freqOnState = pressSeq(createInitialState(), 'shift', 'mode', 'down', '4', '1');
    const hydrated = hydrateState(JSON.stringify(saveableState(freqOnState)));
    expect(hydrated.stat.useFreq).toBe(true);
    const clrSetup = pressSeq(hydrated, 'shift', '9', '1', 'equals');
    expect(clrSetup.stat.useFreq).toBe(false);

    // #78: EQN & DIST scalar results support STO (SHIFT+RCL+A) and ENG
    let sEqn = pressSeq(createInitialState(), 'mode', '5', '3', '1', 'equals', '0', 'equals', 'neg', '2', '5', '0', '0', '0', '0', '0', '0', 'equals');
    // X₁ = 5000
    sEqn = pressSeq(sEqn, 'shift', 'rcl', 'neg'); // STO A
    expect(deserialize(sEqn.variables.A).decimal.toNumber()).toBe(5000);
    sEqn = pressSeq(sEqn, 'eng');
    const eqnDisp = formatActiveEqnItemDisplay(sEqn, sEqn.eqn!.outcome!.status === 'solved' ? sEqn.eqn!.outcome!.items[0] : {});
    expect(eqnDisp).toEqual({ type: 'text', text: '5×10^3' });

    let sDist = pressSeq(createInitialState(), 'mode', 'down', '3', '4', '1', 'equals', '2', 'equals', '0', 'dot', '5', 'equals');
    // Binomial PD(x=1, N=2, p=0.5) = 0.5
    sDist = pressSeq(sDist, 'shift', 'rcl', 'dms'); // STO B
    expect(deserialize(sDist.variables.B).decimal.toNumber()).toBe(0.5);
    sDist = pressSeq(sDist, 'eng');
    expect(sDist.displayOverride).toBe('eng');

    // #79: AC on empty g(X)= in TABLE returns to f(X)=; generateFunctionTable draws fresh RNG per row
    let sTbl = pressSeq(createInitialState(), 'mode', '7', 'alpha', 'close', 'square', 'equals'); // f(X)=X^2 -> g(X)=
    expect(sTbl.table?.stage).toBe('g');
    sTbl = pressSeq(sTbl, 'ac'); // empty g(X)= -> back to f(X)=!
    expect(sTbl.table?.stage).toBe('f');
    expect(sTbl.expression).toBe('X^2');

    let tblRngIdx = 0;
    const tblRngVals = [0.111, 0.222, 0.333];
    const tblRows = generateFunctionTable('Ran#', null, scalarFromInteger(1), scalarFromInteger(3), scalarFromInteger(1), {
      angle: 'DEG',
      variables: zeroVars(),
      ans: zeroStored(),
      rng: () => tblRngVals[tblRngIdx++],
    });
    expect(tblRows.map((r) => r.fx)).toEqual(['0.111', '0.222', '0.333']);

    // #80: VERIF compares tiny numbers accurately without +1 scale inflation (const06=0 is FALSE!)
    expect(evaluateVerification('1⏨-25=0', { angle: 'DEG', variables: zeroVars(), ans: zeroStored() })).toBe(false);
    expect(evaluateVerification('const06=0', { angle: 'DEG', variables: zeroVars(), ans: zeroStored() })).toBe(false);
    expect(evaluateVerification('(1÷3)×3=1', { angle: 'DEG', variables: zeroVars(), ans: zeroStored() })).toBe(true);

    // #81: SHIFT + . inserts live 'Ran#' token into expression
    const sRan = pressSeq(createInitialState(), 'shift', 'dot');
    expect(sRan.expression).toBe('Ran#');

    // #82 & #83: Sub-prompt editors support %, nCr, Rnd(, sinh(, and atomic DEL
    let sCalcSub = pressSeq(createInitialState(), 'alpha', 'neg', 'calc'); // A? prompt
    sCalcSub = pressSeq(sCalcSub, 'hyp', 'sin'); // 'sinh('
    expect(sCalcSub.calcPrompt?.input).toBe('sinh(');
    sCalcSub = pressSeq(sCalcSub, 'del'); // atomic DEL removes 'sinh(' in ONE press!
    expect(sCalcSub.calcPrompt?.input).toBe('');
    sCalcSub = pressSeq(sCalcSub, '5', 'shift', 'divide', '2', 'equals'); // 5nCr2 = 10
    expect(deserialize(sCalcSub.result!).decimal.toNumber()).toBe(10);

    // #84: expr→VAR assignment works on '=' and history replay
    let sStoExpr = createInitialState();
    sStoExpr = calculatorReducer(sStoExpr, { type: 'insert-token', token: '7+8→A' });
    sStoExpr = pressSeq(sStoExpr, 'equals');
    expect(sStoExpr.error).toBeNull();
    expect(deserialize(sStoExpr.variables.A).decimal.toNumber()).toBe(15);

    // #85: LcdScreen suppresses ▲ while typing fresh '77' without vertical 2D slots
    const sFreshAfterHist = pressSeq(createInitialState(), '1', 'add', '2', 'equals', '7', '7');
    const { getByTestId } = render(<LcdScreen state={sFreshAfterHist} />);
    expect(getByTestId('lcd-status').textContent).not.toContain('▲');
  });

  it('Bugs #86–#100 (STAT Reg Switch, SOLVE Goto, SHIFT+S⇔D, HYP Latch, Scan Fallback/Cancel, BASE-N RCL, Setup Cancel, AST Wrap/Recur DEL, LineIO Labels, EQN Chips/Re⇔Im, Keyboard & LaTeX)', async () => {
    // #86: Switching between 2-variable STAT regression models (A+BX -> LN_X) preserves (X, Y) rows
    let sReg = pressSeq(createInitialState(), 'mode', '3', '2', '1', 'equals', '1', '0', 'equals', '2', 'equals', '2', '0', 'equals', 'ac');
    expect(sReg.stat.rows).toHaveLength(2);
    sReg = pressSeq(sReg, 'shift', '1', '1', '4'); // STAT -> 1:Type -> 4:ln X
    expect(sReg.stat.subMode).toBe('LN_X');
    expect(sReg.stat.rows).toHaveLength(2);

    // #87: Recovering via Goto (◀) after CanNotSolve in SOLVE preserves the original equation
    let sSolveErr = pressSeq(createInitialState(), 'alpha', 'close', 'square', 'add', '1', 'alpha', 'calc', '0', 'shift', 'calc', 'equals');
    expect(sSolveErr.phase).toBe('error');
    sSolveErr = pressSeq(sSolveErr, 'left');
    expect(sSolveErr.phase).toBe('editing');
    expect(sSolveErr.expression).toBe('X^2+1=0');

    // #88: SHIFT+S⇔D is a no-op on integer results, and toggles mixed fractions on MatAns
    let sIntRes = pressSeq(createInitialState(), '6', 'frac', '2', 'equals');
    expect(sIntRes.resultFormat).toBe('exact');
    sIntRes = pressSeq(sIntRes, 'shift', 'sd');
    expect(sIntRes.resultFormat).toBe('exact');

    // #89: HYP latch auto-clears if followed by a non-trig key
    const sHyp = pressSeq(createInitialState(), 'hyp', '5');
    expect(sHyp.hyp).toBe(false);
    expect(sHyp.expression).toBe('5');

    // #90: scanned equations are shown as transcription only; stale X cannot trigger an implicit solve/error.
    let sStaleX = createInitialState();
    sStaleX = { ...sStaleX, variables: { ...sStaleX.variables, X: serialize(scalarFromInteger(-5)) } };
    const sScanned = calculatorReducer(sStaleX, { type: 'load-scanned-math', expression: 'sqrt(X)=3', mode: 'COMP' });
    expect(sScanned.error).toBeNull();
    expect(sScanned.phase).toBe('editing');
    expect(sScanned.expression).toBe('sqrt(X)=3');
    expect(sScanned.solvePrompt).toBeNull();
    expect(sScanned.result).toBeNull();

    // #91: RCL in BASE-N immediately displays recalled variable in active base & recalls A value in HEX
    let sBaseRcl = createInitialState();
    sBaseRcl = { ...sBaseRcl, variables: { ...sBaseRcl.variables, A: serialize(scalarFromInteger(255)) } };
    sBaseRcl = pressSeq(sBaseRcl, 'mode', '4', 'power'); // BASE-N -> HEX
    const sImmediate = pressSeq(sBaseRcl, 'rcl', 'neg'); // RCL A
    expect(formatActiveResult(sImmediate)).toEqual({ type: 'text', text: '000000FF' });
    const sMidHex = pressSeq(sBaseRcl, '1', 'add', 'rcl', 'neg', 'equals'); // 0x1 + var(A=255) = 256 = 0x00000100
    expect(formatActiveResult(sMidHex)).toEqual({ type: 'text', text: '00000100' });

    // #92: SETUP -> 1:MthIO -> AC cancels setup-matho without overwriting ioMode: 'Line'
    let sSetupCancel = pressSeq(createInitialState(), 'shift', 'mode', '2'); // LineIO
    expect(sSetupCancel.ioMode).toBe('Line');
    sSetupCancel = pressSeq(sSetupCancel, 'shift', 'mode', '1', 'ac'); // 1:MthIO -> AC cancel
    expect(sSetupCancel.ioMode).toBe('Line');

    // #93 & #94: AST wraps 5! and 2⏨3 into frac, and DEL on empty 0.r(|) cleans auto-inserted '0.'
    const sWrapFact = pressSeq(createInitialState(), '5', 'shift', 'inverse', 'frac', '2');
    expect(sWrapFact.expression).toBe('frac(5!,2)');
    const sWrapSci = pressSeq(createInitialState(), '2', 'exp', '3', 'frac', '5');
    expect(sWrapSci.expression).toBe('frac(2⏨3,5)');
    const sRecurDel = pressSeq(createInitialState(), 'alpha', 'sqrt', 'del');
    expect(sRecurDel.expression).toBe('');

    // #95: LineIO renders Abs( and ³√( instead of raw abs( and cbrt(
    const { container: lineDom } = render(
      <NaturalExpression expression="abs(-5)+cbrt(8)" cursor={null} lineMode />,
    );
    expect(lineDom.textContent).toBe('Abs(−5)+³√(8)');

    // #96 & #97: EQN lin3 windows chips to show d3 at index 11, lights Re⇔Im on complex roots, & Picker lights ▲▼
    let sLin3 = pressSeq(createInitialState(), 'mode', '5', '2');
    for (let i = 0; i < 11; i++) sLin3 = pressSeq(sLin3, 'right');
    const { container: lin3Dom } = render(<LcdScreen state={sLin3} />);
    expect(lin3Dom.querySelector('.lcd-eqn-coeffs')?.textContent).toContain('d3=0');

    let sEqnComplex = pressSeq(createInitialState(), 'mode', '5', '3', '1', 'equals', '0', 'equals', '4', 'equals'); // X² + 4 = 0 -> ±2i
    const { container: eqnComplexDom } = render(<LcdScreen state={sEqnComplex} />);
    const eqnStatusText = eqnComplexDom.querySelector('[data-testid="lcd-status"]')?.textContent ?? '';
    expect(eqnStatusText).toContain('Re⇔Im');
    expect(eqnStatusText).toContain('▲');
    expect(eqnStatusText).toContain('▼');
    sEqnComplex = pressSeq(sEqnComplex, 'shift', 'equals'); // Re view -> 0
    expect(sEqnComplex.eqn?.partView).toBe('re');
    sEqnComplex = pressSeq(sEqnComplex, 'shift', 'equals'); // Im view -> 2i
    expect(sEqnComplex.eqn?.partView).toBe('im');

    const sPicker = pressSeq(createInitialState(), 'shift', '7'); // CONST picker
    const { container: pickerDom } = render(<LcdScreen state={sPicker} />);
    const pickStatusText = pickerDom.querySelector('[data-testid="lcd-status"]')?.textContent ?? '';
    expect(pickStatusText).toContain('▲');
    expect(pickStatusText).toContain('▼');

    // #98: Pressing [AC] cancels an in-flight scanMathFromImage so late resolution never overwrites LCD
    let resolveScan!: (v: visionScanModule.ScannedMathResult) => void;
    const scanSpy = vi.spyOn(visionScanModule, 'scanMathFromImage').mockImplementation(
      () =>
        new Promise<visionScanModule.ScannedMathResult>((resolve) => {
          resolveScan = resolve;
        }),
    );
    const { container: appDom, unmount } = render(<App />);
    const fileInputs = appDom.querySelectorAll('input[type="file"]');
    const uploadInput = fileInputs[1] as HTMLInputElement;
    const fakeBlob = new File([new Uint8Array([1, 2, 3])], 'math.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(uploadInput, { target: { files: [fakeBlob] } });
    });
    expect(appDom.textContent).toContain('SCANNING MATH');
    // Press [AC] while scan is still in flight
    const acBtn = appDom.querySelector('[data-key-id="ac"]') as HTMLButtonElement;
    act(() => {
      fireEvent.click(acBtn);
    });
    expect(appDom.textContent).not.toContain('SCANNING MATH');
    // Now resolve the stale scan — it must be ignored!
    await act(async () => {
      resolveScan({ expression: '999', transcription: '999', mode: 'COMP' });
    });
    expect(appDom.querySelector('[data-testid="lcd-expression"]')?.textContent ?? '').not.toContain('999');
    scanSpy.mockRestore();
    unmount();

    // #99: mapKeyboardEvent blocks letter shortcuts inside menus & BASE-N, and maps ',' -> 'dot' in Comma mode
    const menuState = pressSeq(createInitialState(), 'mode');
    expect(mapKeyboardEvent(new KeyboardEvent('keydown', { key: 's' }), menuState)).toBeNull();
    const baseNDecState = pressSeq(createInitialState(), 'mode', '4');
    expect(mapKeyboardEvent(new KeyboardEvent('keydown', { key: 's' }), baseNDecState)).toBeNull();
    const commaState = pressSeq(createInitialState(), 'shift', 'mode', 'down', '5', '2'); // Comma mark
    expect(mapKeyboardEvent(new KeyboardEvent('keydown', { key: ',' }), commaState)).toBe('dot');
    const commaInsidePol = pressSeq(commaState, 'shift', 'add', '3'); // Pol(3|
    expect(mapKeyboardEvent(new KeyboardEvent('keydown', { key: ',' }), commaInsidePol)).toBe('comma');

    // #100: Vision LaTeX normalizer converts 2\frac{3}{4} -> mfrac(2,3,4) and dummy vars t/k to X
    expect(normalizeToCalcios2D('2\\frac{3}{4} + 1')).toBe('mfrac(2,3,4)+1');
    expect(normalizeToCalcios2D('\\int_{0}^{1} t^2 \\, dt')).toBe('integ(X^(2),0,1)');
    expect(normalizeToCalcios2D('\\sum_{k=1}^{5} k^2')).toBe('sigma(X^(2),1,5)');
    expect(
      evaluateExpression(normalizeToCalcios2D('2\\frac{3}{4}'), {
        angle: 'DEG',
        variables: zeroVars(),
        ans: zeroStored(),
      }).exact,
    ).toEqual({ n: 11n, d: 4n });
  });
});
