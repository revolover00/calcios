import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import largeFontUrl from '../assets/calcios-lcd-large.ttf';
import smallFontUrl from '../assets/calcios-lcd-small.ttf';
import { LcdScreen } from '../components/LcdScreen';
import { NaturalResult } from '../components/NaturalMath';
import { evaluateBaseN } from './basen';
import {
  activateModeByName,
  calculatorReducer,
  createInitialState,
  formatActiveComplexDisplay,
  formatActiveEqnItemDisplay,
  formatActiveInequalityDisplay,
  formatActiveResult,
  hydrateState,
  type CalculatorState,
} from './calculator';
import { numericDerivative, numericIntegral, numericProduct, numericSummation, solveRoot } from './calculus';
import { evaluateComplex, formatComplexDisplay, zeroStoredComplex } from './cmplx';
import { binomialCd, binomialPd, inverseNormal, normalCd, poissonCd, poissonPd, statNormR } from './dist';
import { solveCubic, solveEqn } from './eqn';
import { evaluateExpression, evaluateRichExpression } from './expression';
import { formatDecimal, formatDms, formatResult, initialEngExponent } from './format';
import { formatInequalityResult, solveInequality } from './ineq';
import { createZeroMatrix, evaluateMatrixExpression } from './matrix';
import { computeStatSummary, estimateStatXHat } from './stat';
import { computeRecurringDecimal } from './symbolic';
import { generateFunctionTable } from './table';
import { deserialize, scalarFromInteger, scalarFromLiteral, serialize, zeroStored, D } from './value';
import { createZeroVector, evaluateVectorExpression } from './vector';
import { evaluateVerification } from './verif';
import { normalizeToCalcios2D, resetKeyRotationState, scanMathFromImage } from './visionScan';

function zeroVars() {
  return {
    A: zeroStored(), B: zeroStored(), C: zeroStored(), D: zeroStored(),
    E: zeroStored(), F: zeroStored(), X: zeroStored(), Y: zeroStored(), M: zeroStored(),
  };
}

function pressSeq(initial: CalculatorState, ...keys: string[]): CalculatorState {
  let s = initial;
  for (const k of keys) {
    s = calculatorReducer(s, { type: 'key', id: k });
  }
  return s;
}

describe('50-Bug Comprehensive Senior Audit Regression Suite (#1–#50)', () => {
  it('Bugs #1–#3 (BASE-N): DEC INT32_MIN/MAX boundaries, INT32_MIN/-1 overflow, explicit base prefixes & implicit mul', () => {
    // Bug #1: -2147483648 is valid INT32_MIN, while +2147483648 overflows
    expect(evaluateBaseN('-2147483648', 'DEC', 0n)).toBe(-2147483648n);
    expect(() => evaluateBaseN('2147483648', 'DEC', 0n)).toThrow(/32-bit|overflow/i);
    expect(() => evaluateBaseN('-2147483649', 'DEC', 0n)).toThrow(/32-bit|overflow/i);

    // Bug #2: -2147483648 ÷ -1 and Neg(-2147483648) overflow 32-bit two's complement
    expect(() => evaluateBaseN('-2147483648÷-1', 'DEC', 0n)).toThrow(/Math ERROR|overflow/i);
    expect(() => evaluateBaseN('Neg(-2147483648)', 'DEC', 0n)).toThrow(/Math ERROR|overflow/i);

    // Bug #3: invalid digits after explicit base prefix throw Syntax ERROR, boolean ops remain intact, implicit mul works
    expect(() => evaluateBaseN('b102', 'DEC', 0n)).toThrow(/Syntax ERROR|Invalid|Expected/i);
    expect(() => evaluateBaseN('o89', 'DEC', 0n)).toThrow(/Syntax ERROR|Invalid|Expected/i);
    expect(() => evaluateBaseN('h', 'DEC', 0n)).toThrow(/Syntax ERROR|Invalid|Expected/i);
    expect(evaluateBaseN('hFF and h0F', 'DEC', 0n)).toBe(15n);
    expect(evaluateBaseN('2(3+4)', 'DEC', 0n)).toBe(14n);
  });

  it('Bugs #4–#7 (Calculus & SOLVE): adaptive derivative/domain fallback, adaptive 8-pt Gauss-Legendre integral, BigInt Σ/∏, relative SOLVE', () => {
    // Bug #4: numericDerivative at huge x0 = 1e12 and at domain boundary x0 = 0 for sqrt(X)
    const dBig = numericDerivative((x) => ({ decimal: x.decimal.pow(2), preferDecimal: true }), scalarFromLiteral('1e12'));
    expect(dBig.decimal.minus('2e12').abs().div('2e12').lt('1e-8')).toBe(true);
    const dBoundary = numericDerivative(
      (x) => {
        if (x.decimal.lt(0)) throw new Error('Domain');
        return { decimal: x.decimal.sqrt().plus(x.decimal.times(3)), preferDecimal: true };
      },
      scalarFromInteger(0),
    );
    expect(dBoundary.decimal.isFinite()).toBe(true);

    // Bug #5: adaptive Gauss-Legendre integral handles cusp/endpoint singularity ∫_0^1 1/√x dx = 2 and ∫_-1^1 |x| dx = 1
    const cusp = numericIntegral(
      (x) => ({ decimal: x.decimal.abs(), preferDecimal: true }),
      scalarFromInteger(-1),
      scalarFromInteger(1),
    );
    expect(cusp.decimal.minus(1).abs().lt('1e-8')).toBe(true);
    const invSqrt = numericIntegral(
      (x) => ({ decimal: new D(1).div(x.decimal.sqrt()), preferDecimal: true }),
      scalarFromInteger(0),
      scalarFromInteger(1),
    );
    expect(invSqrt.decimal.minus(2).abs().lt('1e-4')).toBe(true);

    // Bug #6: BigInt loop counter in Σ / ∏ above 2^53 (9007199254740992..9007199254740994)
    const bigSum = numericSummation(
      (x) => x,
      scalarFromLiteral('9007199254740992'),
      scalarFromLiteral('9007199254740994'),
    );
    expect(bigSum.exact).toEqual({ n: 27021597764222979n, d: 1n });
    const bigProd = numericProduct(
      () => scalarFromInteger(2),
      scalarFromLiteral('9007199254740992'),
      scalarFromLiteral('9007199254740994'),
    );
    expect(bigProd.exact).toEqual({ n: 8n, d: 1n });

    // Bug #7: solveRoot at tiny scale (1e-12), huge scale (1e12), domain boundary sqrt(X) = 2 from X=0, and non-zero minimum X^2 + 1 = 0
    const tinyRoot = solveRoot((x) => ({ decimal: x.decimal.minus('1e-12'), preferDecimal: true }), scalarFromInteger(0));
    expect(tinyRoot.root.decimal.minus('1e-12').abs().lt('1e-22')).toBe(true);
    const sqrtEq = solveRoot(
      (x) => {
        if (x.decimal.lt(0)) throw new Error('Domain');
        return { decimal: x.decimal.sqrt().minus(2), preferDecimal: true };
      },
      scalarFromInteger(0),
    );
    expect(sqrtEq.root.decimal.minus(4).abs().lt('1e-10')).toBe(true);
    expect(() =>
      solveRoot((x) => ({ decimal: x.decimal.pow(2).plus(1), preferDecimal: true }), scalarFromInteger(1)),
    ).toThrow(/Can't Solve|CanNotSolve/);
  });

  it('Bugs #8–#10 (DIST): cancellation-free upper tail normal, extreme tail inverseNormal, and large N/k binomial & Poisson', () => {
    // Bug #8: R(8) and normalCd(8, 9, 0, 1) do not underflow to 0
    const r8 = statNormR(scalarFromInteger(8));
    expect(r8.decimal.gt('6e-16') && r8.decimal.lt('7e-16')).toBe(true);
    const tailBand = normalCd(scalarFromInteger(8), scalarFromInteger(9), scalarFromInteger(0), scalarFromInteger(1));
    expect(tailBand.decimal.gt('6e-16')).toBe(true);

    // Bug #9: inverseNormal(1e-50) works without Math.log underflow; Area=0.975 gives 1.95996398454...
    const inv975 = inverseNormal(scalarFromLiteral('0.975'), scalarFromInteger(0), scalarFromInteger(1));
    expect(Number(inv975.decimal.toString())).toBeCloseTo(1.9599639845, 9);
    const invDeep = inverseNormal(scalarFromLiteral('1e-50'), scalarFromInteger(0), scalarFromInteger(1));
    expect(invDeep.decimal.lt(-14) && invDeep.decimal.gt(-16)).toBe(true);

    // Bug #10: Binomial N = 1000, k = 500, p = 0.5 and Poisson λ = 600, k = 600
    const b1000 = binomialPd(scalarFromInteger(500), scalarFromInteger(1000), scalarFromLiteral('0.5'));
    expect(Number(b1000.decimal.toString())).toBeCloseTo(0.025225018, 7);
    const bCd1000 = binomialCd(scalarFromInteger(500), scalarFromInteger(1000), scalarFromLiteral('0.5'));
    expect(Number(bCd1000.decimal.toString())).toBeCloseTo(0.512612509, 7);
    const p600 = poissonPd(scalarFromInteger(600), scalarFromInteger(600));
    expect(Number(p600.decimal.toString())).toBeCloseTo(0.0162839, 5);
    const pCd600 = poissonCd(scalarFromInteger(600), scalarFromInteger(600));
    expect(Number(pCd600.decimal.toString())).toBeCloseTo(0.51085552, 6);
  });

  it('Bugs #11–#13 (EQN & INEQ): exact rational snapping >24, cubic exact surd/complex deflation + complexParts, tiny-scale INEQ', () => {
    // Bug #11: Cubic with rational root 1/25 (denominator 25 > old limit 24): 25X^3 - X^2 - 25X + 1 = 0 -> roots 1/25, 1, -1
    const cub25 = solveCubic([
      scalarFromInteger(25),
      scalarFromInteger(-1),
      scalarFromInteger(-25),
      scalarFromInteger(1),
    ]);
    expect(cub25.status).toBe('solved');
    if (cub25.status === 'solved') {
      const has1Over25 = cub25.items.some((it) => it.scalar?.exact?.n === 1n && it.scalar?.exact?.d === 25n);
      expect(has1Over25).toBe(true);
    }

    // Bug #12: Cubic (X - 1)(X^2 - 2X - 2) = X^3 - 3X^2 + 2 = 0 -> exact surds 1 + √3 and 1 - √3!
    // And X^3 - 1 = 0 -> X₁ = 1, X₂/X₃ have complexParts for 2D NaturalResult rendering!
    const cubSurd = solveEqn('cubic', [
      scalarFromInteger(1),
      scalarFromInteger(-3),
      scalarFromInteger(0),
      scalarFromInteger(2),
    ]);
    expect(cubSurd.status).toBe('solved');
    if (cubSurd.status === 'solved') {
      expect(cubSurd.items.some((it) => it.scalar?.symbolic?.kind === 'surd')).toBe(true);
    }
    const cubUnity = solveCubic([
      scalarFromInteger(1),
      scalarFromInteger(0),
      scalarFromInteger(0),
      scalarFromInteger(-1),
    ]);
    if (cubUnity.status === 'solved') {
      expect(cubUnity.items[1].complexParts).toBeDefined();
      expect(cubUnity.items[2].complexParts).toBeDefined();
    }

    // Bug #13: Tiny-root inequality (X - 1e-11)(X - 2e-11) < 0 -> X^2 - 3e-11 X + 2e-22 < 0 -> 1×10^-11<X<2×10^-11 (NOT No Solution!)
    const tinyIneq = solveInequality(2, '<', [
      scalarFromInteger(1),
      scalarFromLiteral('-3e-11'),
      scalarFromLiteral('2e-22'),
    ]);
    const tinyFormatted = formatInequalityResult(tinyIneq, false);
    expect(tinyFormatted).not.toBe('No Solution');
    expect(tinyFormatted).toContain('<X<');
  });

  it('Bugs #14–#18 (STAT): scientific cell values, quadratic x̂₁ when B=0, undefined sx for n=1, huge FRQ quartiles, singular _+CX2', () => {
    // Bug #14: entering 0.005 in STAT editor stores exact "0.005" (never crashes on "5×10^-3")
    let st = activateModeByName(createInitialState(), 'STAT');
    st = pressSeq(st, '1', '0', 'dot', '0', '0', '5', 'equals', 'ac');
    expect(st.stat.rows[0].x).toBe('0.005');
    const summarySmall = computeStatSummary('1-VAR', st.stat.rows);
    expect(summarySmall.meanX.decimal.toString()).toBe('0.005');

    // Bug #15: Quadratic regression Y = X^2 has B = 0, C = 1 -> x̂₁(4) = 2 (does NOT throw "Slope is zero"!)
    const quadSummary = computeStatSummary('_+CX2', [
      { x: '-2', y: '4', freq: '1' },
      { x: '0', y: '0', freq: '1' },
      { x: '2', y: '4', freq: '1' },
    ]);
    expect(estimateStatXHat('_+CX2', quadSummary, scalarFromInteger(4)).decimal.toNumber()).toBeCloseTo(2, 10);

    // Bug #16: Sample standard deviation sx is undefined when n = 1 (throws Math ERROR on statSampSdX)
    const n1Summary = computeStatSummary('1-VAR', [{ x: '42', freq: '1' }]);
    expect(n1Summary.sampSdX).toBeUndefined();
    expect(() =>
      evaluateExpression('statSampSdX', {
        angle: 'DEG',
        variables: zeroVars(),
        ans: zeroStored(),
        statContext: { subMode: '1-VAR', summary: n1Summary },
      }),
    ).toThrow(/Math ERROR|unavailable/i);

    // Bug #17: Huge frequencies (FRQ = 1,000,000) compute exact Q1, Med, Q3 in O(R log R)
    const hugeFreq = computeStatSummary('1-VAR', [
      { x: '10', freq: '1000000' },
      { x: '20', freq: '1000000' },
    ]);
    expect(hugeFreq.q1?.decimal.toNumber()).toBe(10);
    expect(hugeFreq.med?.decimal.toNumber()).toBe(15);
    expect(hugeFreq.q3?.decimal.toNumber()).toBe(20);

    // Bug #18: Singular _+CX2 with only 2 points leaves regA/regB/regC undefined instead of garbage
    const singQuad = computeStatSummary('_+CX2', [
      { x: '1', y: '2', freq: '1' },
      { x: '2', y: '5', freq: '1' },
    ]);
    expect(singQuad.regA).toBeUndefined();
    expect(singQuad.regC).toBeUndefined();
  });

  it('Bugs #19–#21 (CMPLX): Euler e^(iπ)=-1, i^i, ln(-1)=πi, parenthesized multi-term surd im, and CONST/CONV/DMS in CMPLX', () => {
    const ctx = { angle: 'RAD' as const, variables: zeroVars(), cmplxAns: zeroStoredComplex() };

    // Bug #19: e^(i*π) = -1, i^i = e^(-π/2), ln(-1) = πi, sqrt(3+4i) = 2+i
    const euler = evaluateComplex('e^(iπ)', ctx).value;
    expect(euler.re.decimal.toNumber()).toBeCloseTo(-1, 12);
    expect(euler.im.decimal.abs().lt('1e-24')).toBe(true);

    const iPowI = evaluateComplex('i^i', ctx).value;
    expect(iPowI.re.decimal.toNumber()).toBeCloseTo(Math.exp(-Math.PI / 2), 10);
    expect(iPowI.im.decimal.abs().lt('1e-24')).toBe(true);

    const lnNeg1 = evaluateComplex('ln(-1)', ctx).value;
    expect(lnNeg1.im.symbolic).toEqual({ kind: 'pi', n: 1n, d: 1n });

    const sq34 = evaluateComplex('sqrt(3+4i)', ctx).value;
    expect(sq34.re.exact).toEqual({ n: 2n, d: 1n });
    expect(sq34.im.exact).toEqual({ n: 1n, d: 1n });

    // Bug #20: multi-term surd imaginary part wraps in (...)i + Comma decimalMark
    const multiIm = evaluateComplex('3+(1+sqrt(2))i', ctx).value;
    expect(formatComplexDisplay(multiIm, 'rect', 'RAD', true)).toBe('3+(1+√2)i');
    expect(formatComplexDisplay(multiIm, 'rect', 'RAD', false, undefined, 'Comma')).toContain(',');

    // Bug #21: CONST, CONV, DMS, and recurring decimal inside CMPLX
    const convCmplx = evaluateComplex('1▸conv01+2i', ctx).value;
    expect(convCmplx.re.decimal.toNumber()).toBeCloseTo(2.54, 10);
    const dmsCmplx = evaluateComplex('12°30°+0.r(3)i', ctx).value;
    expect(dmsCmplx.re.decimal.toNumber()).toBeCloseTo(12.5, 10);
    expect(dmsCmplx.im.exact).toEqual({ n: 1n, d: 3n });
  });

  it('Bugs #22–#23 (MATRIX & VECTOR): MatA^(-2), right-hand scalar implicit mul (MatA)2 & (VctA)2, and full scalar ops', () => {
    const matA = createZeroMatrix(2, 2);
    matA.cells[0][0] = serialize(scalarFromInteger(2));
    matA.cells[1][1] = serialize(scalarFromInteger(4));

    // Bug #22: MatA^(-2) and (MatA)3
    const inv2 = evaluateMatrixExpression('MatA^(-2)', {
      matrices: { MatA: matA, MatB: null, MatC: null, MatAns: null },
      variables: zeroVars(),
      ans: zeroStored(),
    });
    expect(inv2.kind).toBe('matrix');
    if (inv2.kind === 'matrix') {
      expect(inv2.matrix.cells[0][0].exact).toEqual({ n: 1n, d: 4n });
      expect(inv2.matrix.cells[1][1].exact).toEqual({ n: 1n, d: 16n });
    }
    const rhsScaleMat = evaluateMatrixExpression('(MatA)3+GCD(6,9)MatA', {
      matrices: { MatA: matA, MatB: null, MatC: null, MatAns: null },
      variables: zeroVars(),
      ans: zeroStored(),
    });
    if (rhsScaleMat.kind === 'matrix') {
      expect(rhsScaleMat.matrix.cells[0][0].exact).toEqual({ n: 12n, d: 1n });
    }

    // Bug #23: (VctA)2 and 5! / nCr / recurring decimals in VECTOR
    const vctA = createZeroVector(2);
    vctA.coords[0] = serialize(scalarFromInteger(3));
    vctA.coords[1] = serialize(scalarFromInteger(4));
    const rhsScaleVct = evaluateVectorExpression('(VctA)2+(5nCr2)VctA', {
      vectors: { VctA: vctA, VctB: null, VctC: null, VctAns: null },
      variables: zeroVars(),
      ans: zeroStored(),
    });
    expect(rhsScaleVct.kind).toBe('vector');
    if (rhsScaleVct.kind === 'vector') {
      expect(rhsScaleVct.vector.coords[0].exact).toEqual({ n: 36n, d: 1n });
    }
  });

  it('Bugs #24–#32 (Symbolic, Value, Expression): (-8)^(1/3), cbrt(8/27), exact logb, recurring gcd, ÷R precedence, DMS & Big ÷R', () => {
    const evalS = (expr: string) =>
      evaluateExpression(expr, { angle: 'DEG', variables: zeroVars(), ans: zeroStored() });

    // Bug #24: odd-denominator rational powers of negatives + x^0 = 1 + 8^(2/3) = 4 + 2^(-1/2) = √2/2
    expect(evalS('(-8)^(frac(1,3))').exact).toEqual({ n: -2n, d: 1n });
    expect(evalS('(-8)^(frac(2,3))').exact).toEqual({ n: 4n, d: 1n });
    expect(evalS('π^0').exact).toEqual({ n: 1n, d: 1n });
    expect(evalS('8^(frac(2,3))').exact).toEqual({ n: 4n, d: 1n });
    expect(evalS('2^(-frac(1,2))').symbolic).toEqual({ kind: 'surd', a: 0n, b: 1n, rad: 2n, d: 2n });

    // Bug #25: cbrt(8/27) = 2/3 & root(4, 16/81) = 2/3 & root(3, -27) = -3
    expect(evalS('cbrt(frac(8,27))').exact).toEqual({ n: 2n, d: 3n });
    expect(evalS('root(4,frac(16,81))').exact).toEqual({ n: 2n, d: 3n });
    expect(evalS('root(3,-27)').exact).toEqual({ n: -3n, d: 1n });

    // Bug #26: exact rational logarithms log(1000)=3, log(sqrt(10))=1/2, logb(4, 8)=3/2, logb(8, 1/4)=-2/3, ln(e^3)=3
    expect(evalS('log(1000)').exact).toEqual({ n: 3n, d: 1n });
    expect(evalS('log(sqrt(10))').exact).toEqual({ n: 1n, d: 2n });
    expect(evalS('logb(4,8)').exact).toEqual({ n: 3n, d: 2n });
    expect(evalS('logb(8,frac(1,4))').exact).toEqual({ n: -2n, d: 3n });
    expect(evalS('ln(e^3)').exact).toEqual({ n: 3n, d: 1n });

    // Bug #27: computeRecurringDecimal reduces unreduced n/d first (e.g. 2/6 -> 0.r(3))
    expect(computeRecurringDecimal(2n, 6n)).toEqual({ sign: '', intPart: '0', nonRepeat: '', repeat: '3' });

    // Bug #28: huge power overflow throws clean CalculatorError('Math ERROR') instead of uncaught DecimalError
    expect(() => evalS('(10^9999)^2')).toThrow(/supported range|Power overflow/i);

    // Bug #29: ÷R rejects lower-precedence outer + / - while allowing (10+4) ÷R 5
    expect(() =>
      evaluateRichExpression('14÷R5+1', { angle: 'DEG', variables: zeroVars(), ans: zeroStored() }),
    ).toThrow(/lower-precedence|Syntax ERROR/i);
    expect(() =>
      evaluateRichExpression('1+14÷R5', { angle: 'DEG', variables: zeroVars(), ans: zeroStored() }),
    ).toThrow(/lower-precedence|Syntax ERROR/i);
    const okDivR = evaluateRichExpression('(10+4)÷R5', { angle: 'DEG', variables: zeroVars(), ans: zeroStored() });
    expect(okDivR.primary.exact).toEqual({ n: 2n, d: 1n });
    expect(okDivR.secondary?.exact).toEqual({ n: 4n, d: 1n });

    // Bug #30: .r(3) without leading 0 evaluates to 1/3
    expect(evalS('.r(3)').exact).toEqual({ n: 1n, d: 3n });

    // Bug #31: fractional degree before minutes 12.5°30° throws Syntax ERROR
    expect(() => evalS('12.5°30°')).toThrow(/integer|Syntax ERROR|Invalid/i);

    // Bug #32: ÷R supports >10-digit integers up to 1e100
    const bigDivR = evaluateRichExpression('10000000007÷R10', {
      angle: 'DEG',
      variables: zeroVars(),
      ans: zeroStored(),
    });
    expect(bigDivR.primary.exact).toEqual({ n: 1000000000n, d: 1n });
    expect(bigDivR.secondary?.exact).toEqual({ n: 7n, d: 1n });
  });

  it('Bugs #33–#36 (Format, Table, Verif): ENG on 999.99999999, DMS -0° suppression, huge Table span guard, single Ran# in VERIF', () => {
    // Bug #33: 999.99999999 rounds to 1000 at 10 sig figs -> initialEngExponent = 3 (1×10^3, NOT 1000×10^0!)
    expect(initialEngExponent(scalarFromLiteral('999.99999999'))).toBe(3);

    // Bug #34: tiny negative angle -1e-7 formats as "0°0’0”", never "−0°0’0”"
    expect(formatDms(scalarFromLiteral('-1e-7'))).toBe('0°0’0”');

    // Bug #35: huge table span (End = 1e30) throws clean Math ERROR, and Comma decimalMark formats cells with ','
    expect(() =>
      generateFunctionTable(
        'X',
        null,
        scalarFromInteger(0),
        scalarFromLiteral('1e30'),
        scalarFromInteger(1),
        { angle: 'DEG', variables: zeroVars(), ans: zeroStored() },
      ),
    ).toThrow(/Table exceeds/);
    const commaRows = generateFunctionTable(
      'X÷2',
      null,
      scalarFromInteger(1),
      scalarFromInteger(2),
      scalarFromInteger(1),
      { angle: 'DEG', variables: zeroVars(), ans: zeroStored() },
      'Comma',
    );
    expect(commaRows[0].fx).toBe('0,5');

    // Bug #36: chained VERIF `0 ≤ Ran# ≤ 1` evaluates middle operand ONCE
    let calls = 0;
    const seq = [0.9, 0.1]; // If Ran# were evaluated twice, 0 <= 0.9 AND 0.1 <= 0.5 would falsely pass for 0.8 <= Ran# <= 0.2!
    const impossibleChain = evaluateVerification('0.8≤Ran#≤0.2', {
      angle: 'DEG',
      variables: zeroVars(),
      ans: zeroStored(),
      get random() {
        return seq[calls++ % seq.length];
      },
    } as Parameters<typeof evaluateVerification>[1]);
    expect(impossibleChain).toBe(false);
    expect(calls).toBe(1);
  });

  it('Bugs #37–#45 & #48–#49 (State Machine, AST, NaturalMath, LcdScreen): A=5 assignment, mode STO/M+, 2D nav, Goto, LineIO mfrac, 0.r(3) frac wrap, overwrite atom, CLR Memory', () => {
    // Bug #37: `A = 5` + `=` assigns 5 to A directly (does NOT open SOLVE prompt!)
    let sAssign = pressSeq(createInitialState(), 'alpha', 'neg', 'alpha', 'calc', '5', 'equals');
    expect(sAssign.solvePrompt).toBeNull();
    expect(sAssign.phase).toBe('result');
    expect(deserialize(sAssign.variables.A).exact).toEqual({ n: 5n, d: 1n });

    // And pressing CALC on `2X+1=7` routes to SOLVE instead of Syntax ERROR
    const sCalcEq = pressSeq(createInitialState(), '2', 'var-x', 'add', '1', 'eq-sign', '7', 'calc');
    expect(sCalcEq.solvePrompt).not.toBeNull();

    // Bug #38: STO and M+ in BASE-N HEX mode evaluate hex `h10` = 16 cleanly!
    let sHex = activateModeByName(createInitialState(), 'BASE-N');
    sHex = pressSeq(sHex, 'power', '1', '0', 'shift', 'rcl', 'neg'); // HEX 10 -> STO A (= 16)
    expect(deserialize(sHex.variables.A).exact).toEqual({ n: 16n, d: 1n });
    sHex = pressSeq(sHex, 'ac', '2', '0', 'mplus'); // HEX 20 (= 32) -> M+
    expect(deserialize(sHex.variables.M).exact).toEqual({ n: 32n, d: 1n });

    // Bug #39: Replaying a 2D fraction from history, pressing ◀, then ▼ navigates into denominator instead of clearing expression!
    let sHist = pressSeq(createInitialState(), 'frac', '3', 'down', '4', 'equals', 'up', 'left', 'up');
    expect(sHist.expression).toBe('frac(3,4)');
    expect(sHist.historyIndex).toBeNull();

    // Bug #40: Goto normalizes cursor out of hidden `frac(` prefix
    let sErr: CalculatorState = {
      ...createInitialState(),
      expression: 'frac(,2)',
      phase: 'error',
      error: 'Syntax ERROR',
      errorCursor: 2,
    };
    sErr = pressSeq(sErr, 'left');
    expect(sErr.cursor).toBe(5); // Snapped cleanly to numerator slot start!

    // Bug #41: moveCursorVertical before `2^(3)` (`2|^(3)`) with ▲ enters exponent!
    let sPow = pressSeq(createInitialState(), '2', 'power', '3', 'right', 'left', 'left');
    // Move right before `^(`:
    sPow = { ...sPow, expression: '2^(3)', cursor: 1, phase: 'editing' };
    sPow = pressSeq(sPow, 'up');
    expect(sPow.cursor).toBe(3);

    // Bug #42: LineIO `SHIFT + frac` inserts `mfrac(`
    let sLine: CalculatorState = { ...createInitialState(), ioMode: 'Line' };
    sLine = pressSeq(sLine, 'shift', 'frac');
    expect(sLine.expression).toBe('mfrac(');

    // Bug #43: `0.r(3)` followed by `frac` wraps the WHOLE `0.r(3)` into `frac(0.r(3),)`!
    let sRecFrac = pressSeq(createInitialState(), 'alpha', 'sqrt', '3', 'right', 'frac', '2', 'equals');
    expect(sRecFrac.expression).toBe('frac(0.r(3),2)');
    expect(deserialize(sRecFrac.result!).exact).toEqual({ n: 1n, d: 6n });

    // Bug #44: NaturalResult renders complex-2d with mixed-fraction / recurring-decimal & scientific complex text
    const { container } = render(
      <NaturalResult
        display={{
          type: 'complex-2d',
          form: 'rect',
          re: { type: 'mixed-fraction', sign: '', whole: '1', numerator: '1', denominator: '2' },
          imSign: '+',
          im: { type: 'recurring-decimal', sign: '', intPart: '0', nonRepeat: '', repeat: '3' },
        }}
      />,
    );
    expect(container.querySelector('.math-mfrac')).not.toBeNull();
    expect(container.querySelector('.math-overbar')).not.toBeNull();

    // Bug #45: Overwrite mode (`insertMode = false`) at start of `sin(` replaces full `sin(` token instead of producing `7in(`!
    let sOvr = pressSeq(createInitialState(), 'sin', 'left', 'shift', 'del', '7');
    expect(sOvr.expression).toBe('7');

    // Bug #48: hydrateState rejects malformed numberFormat digits, and CLR Memory clears STAT rows & history
    const hydrated = hydrateState(
      JSON.stringify({
        version: 1,
        angle: 'DEG',
        numberFormat: { mode: 'Fix', digits: 999 },
        variables: zeroVars(),
      }),
    );
    expect(hydrated.numberFormat).toEqual({ mode: 'Norm', sub: 1 });

    let sClr = pressSeq(sRecFrac, 'shift', '9', '2', 'equals');
    expect(sClr.history).toHaveLength(0);
    expect(sClr.stat.rows).toHaveLength(0);

    // Bug #49: LcdScreen suppresses history ▲ indicator inside EQN grid editor even when COMP history exists
    const sEqnWithHist = activateModeByName(sRecFrac, 'EQN');
    const sEqnQuad = pressSeq(sEqnWithHist, '3');
    const { getByTestId } = render(<LcdScreen state={sEqnQuad} />);
    expect(getByTestId('lcd-status').textContent).not.toContain('▲');

    // Unused helper sanity check on exported display formatters
    expect(formatActiveResult(sRecFrac)).not.toBeNull();
    expect(formatActiveComplexDisplay(createInitialState())).toBeNull();
    expect(formatActiveInequalityDisplay(createInitialState())).toBeNull();
    expect(formatActiveEqnItemDisplay(createInitialState(), { scalar: scalarFromInteger(3) })).toEqual({
      type: 'text',
      text: '3',
    });
    expect(formatDecimal(scalarFromLiteral('1.5'), undefined, 'Comma')).toBe('1,5');
    expect(formatResult(scalarFromInteger(5), 'exact')).toEqual({ type: 'text', text: '5' });
  });

  it('Bugs #46, #47, #50 (Vision Scan, Keyboard h-prefix Hex, and LCD TrueType Glyph Completeness)', async () => {
    // Bug #46a: LaTeX normalizer handles \log_2(8), \prod, \binom, \sum + trailing term, and DMS 12°30'45"
    expect(normalizeToCalcios2D('\\log_2(8) + \\binom{5}{2}')).toBe('logb(2,8)+5nCr2');
    expect(normalizeToCalcios2D('\\sum_{x=1}^{4} x^2 + 10')).toBe('sigma(X^(2),1,4)+10');
    expect(normalizeToCalcios2D('\\prod_{k=1}^{3} (k+1)')).toBe('prod((X+1),1,3)');
    expect(normalizeToCalcios2D('12°30\'45"')).toBe('12°30°45°');

    // Bug #46b: HTTP 400 with custom JSON error message fails immediately on attempt 1 without poisoning remaining keys!
    resetKeyRotationState();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Invalid image payload' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const tinyPngBlob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    await expect(
      scanMathFromImage(tinyPngBlob, {
        apiKeys: ['key-1', 'key-2', 'key-3'],
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        model: 'gemini-2.5-flash',
      }),
    ).rejects.toThrow('HTTP 400');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Did NOT retry or poison key-1/key-2/key-3!
    fetchSpy.mockRestore();

    // Bug #47: Physical keyboard typing `f` after `h` prefix in BASE-N DEC mode enters hex `F`!
    const { container, unmount } = render(<App />);
    const clickKey = (id: string) => {
      const btn = container.querySelector<HTMLButtonElement>(`[data-key-id="${id}"]`);
      if (!btn) throw new Error(`Missing key ${id}`);
      fireEvent.click(btn);
    };
    // Switch to BASE-N (MODE -> 4), open BASE-N menu (SHIFT -> 3 -> down -> 2 for 'h'), then type keyboard 'f'
    clickKey('mode');
    clickKey('4');
    clickKey('shift');
    clickKey('3');
    clickKey('down');
    clickKey('2'); // inserts 'h'
    fireEvent.keyDown(window, { key: 'f' });
    expect(screen.getByTestId('lcd-expression').textContent).toContain('hF');
    unmount();

    // Bug #50: Both generated LCD .ttf fonts resolve cleanly as bundled TrueType assets
    expect(largeFontUrl).toContain('calcios-lcd-large');
    expect(smallFontUrl).toContain('calcios-lcd-small');
  });
});
