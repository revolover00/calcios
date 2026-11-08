import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NaturalExpression } from '../components/NaturalMath';
import {
  calculatorReducer,
  createInitialState,
  formatActiveComplexDisplay,
  formatActiveEqnItemDisplay,
  formatActiveInequalityDisplay,
  formatActiveResult,
  type CalculatorState,
} from './calculator';
import { formatDecimal, formatResult } from './format';
import { deserialize } from './value';

function pressFrom(initial: CalculatorState, ...ids: string[]): CalculatorState {
  return ids.reduce(
    (state, id) => calculatorReducer(state, { type: 'key', id, random: 0.421 }),
    initial,
  );
}

function press(...ids: string[]): CalculatorState {
  return pressFrom(createInitialState(), ...ids);
}

const dec = (s: CalculatorState) =>
  s.result && formatDecimal(deserialize(s.result), s.numberFormat, s.decimalMark);

/**
 * Steps through keys one by one while asserting at EVERY intermediate editing state:
 * 1) Rendering <NaturalExpression /> produces EXACTLY 1 visible blinking caret.
 * 2) Zero raw internal template names ('frac(', 'mfrac(', 'sqrt(', 'cbrt(', 'root(', 'integ(', 'sigma(', 'prod(', 'deriv(', 'logb(') leak into LCD text in MathIO.
 */
function pressWithCaretInvariants(...ids: string[]): CalculatorState {
  let state = createInitialState();
  const { container, rerender, unmount } = render(
    <NaturalExpression expression="" cursor={0} overwrite={false} lineMode={false} />,
  );
  try {
    for (const id of ids) {
      state = calculatorReducer(state, { type: 'key', id, random: 0.421 });
      if (state.phase === 'editing' && state.screen === 'normal') {
        rerender(
          <NaturalExpression
            expression={state.expression}
            cursor={state.cursor}
            overwrite={!state.insertMode}
            lineMode={state.ioMode === 'Line'}
          />,
        );
        const carets = container.querySelectorAll('[data-testid="lcd-caret"]');
        expect(carets).toHaveLength(1);
        const renderedText = container.textContent ?? '';
        expect(renderedText).not.toMatch(/(?:m?frac|sqrt|cbrt|root|integ|sigma|prod|deriv|logb)\(/);
      }
    }
  } finally {
    unmount();
  }
  return state;
}

describe('Comprehensive Multi-Difficulty Audit (Easy -> Medium -> Hard -> Extreme)', () => {
  describe('1. 2D 2D Natural Math Cursor Movements (◀ ▶ ▲ ▼), Smart DEL, INS & Fraction Wrapping', () => {
    it('[Easy] wraps preceding operand into 2D fraction numerator with ■/□ and mixed fraction with SHIFT+■/□', () => {
      // 3 -> ■/□ -> 4 -> =  ==> 3/4
      const s1 = pressWithCaretInvariants('3', 'frac', '4', 'equals');
      expect(s1.expression).toBe('frac(3,4)');
      expect(formatActiveResult(s1)).toEqual({
        type: 'fraction',
        sign: '',
        numerator: '3',
        denominator: '4',
      });

      // Empty ■/□ -> 5 -> ▼ (down to denominator!) -> 8 -> =  ==> 5/8
      const s2 = pressWithCaretInvariants('frac', '5', 'down', '8', 'equals');
      expect(s2.expression).toBe('frac(5,8)');
      expect(dec(s2)).toBe('0.625');

      // 2 -> SHIFT + ■/□ -> 1 -> ▼ -> 3 -> =  ==> 2 1/3 = 7/3
      const s3 = pressWithCaretInvariants('2', 'shift', 'frac', '1', 'down', '3', 'equals');
      expect(s3.expression).toBe('mfrac(2,1,3)');
      expect(formatActiveResult(s3)).toEqual({
        type: 'fraction',
        sign: '',
        numerator: '7',
        denominator: '3',
      });

      // Pressing ■/□ in result phase wraps Ans into numerator: (3/4) -> ■/□ -> 3 -> =  ==> 1/4
      const s4 = pressFrom(s1, 'frac', '3', 'equals');
      expect(s4.expression).toBe('frac(Ans,3)');
      expect(formatActiveResult(s4)).toEqual({
        type: 'fraction',
        sign: '',
        numerator: '1',
        denominator: '4',
      });
    });

    it('[Medium] navigates ▲ and ▼ across frac, pow, root, logb, and deriv without wiping expression', () => {
      // Build frac(10, 2), press ▲ from denominator back to numerator, change 10 -> 15 -> 15/2
      const sFrac = pressWithCaretInvariants(
        'frac', '1', '0', 'down', '2', 'up', 'del', '5', 'equals',
      );
      expect(sFrac.expression).toBe('frac(15,2)');
      expect(dec(sFrac)).toBe('7.5');

      // Power: 2 -> x^■ -> 3 -> ▼ (exit exponent!) -> + -> 1 -> ◀ -> ◀ -> ▲ (re-enter exponent!) -> + -> 1 -> =  ==> 2^(3+1)+1 = 17
      const sPow = pressWithCaretInvariants(
        '2', 'power', '3', 'down', 'add', '1', 'left', 'left', 'up', 'add', '1', 'equals',
      );
      expect(sPow.expression).toBe('2^(3+1)+1');
      expect(dec(sPow)).toBe('17');

      // Root: SHIFT+x^■ -> 3 -> ▼ (into radicand!) -> 2 -> 7 -> ▲ (back to index) -> =  ==> 3
      const sRoot = pressWithCaretInvariants('shift', 'power', '3', 'down', '2', '7', 'up', 'equals');
      expect(dec(sRoot)).toBe('3');

      // log_ab: logbase -> 2 -> ▲ (into argument!) -> 8 -> ▼ (back to base) -> =  ==> 3
      const sLog = pressWithCaretInvariants('logbase', '2', 'up', '8', 'down', 'equals');
      expect(dec(sLog)).toBe('3');

      // deriv: SHIFT+integ -> X^2 -> ▼ (into x=□!) -> 5 -> ▲ (back to body) -> =  ==> 10
      const sDeriv = pressWithCaretInvariants(
        'shift', 'integ', 'alpha', 'close', 'square', 'down', '5', 'up', 'equals',
      );
      expect(dec(sDeriv)).toBe('10');
    });

    it('[Hard] builds a 3-level nested 2D expression with arrow keys & DEL while keeping 1 visible caret at every step', () => {
      // (1 + √(9/4)) / 2^(1 + 1/1) = (1 + 3/2) / 4 = 5/8 = 0.625
      const s = pressWithCaretInvariants(
        'frac',
        '1', 'add', 'sqrt', '9', 'frac', '4', 'right', 'right',
        'down',
        '2', 'power', '1', 'add', '1', 'frac', '1',
        'equals',
      );
      expect(formatActiveResult(s)).toEqual({
        type: 'fraction',
        sign: '',
        numerator: '5',
        denominator: '8',
      });
    });

    it('[Extreme] handles DEL at every 2D boundary (empty deletion, fraction/radical unwrap, stepping inside) & INS overwrite', () => {
      // 1) Pressing ■/□ then DEL deletes empty fraction completely
      const sEmpty = pressWithCaretInvariants('5', 'add', 'frac', 'del', '3', 'equals');
      expect(sEmpty.expression).toBe('5+3');
      expect(dec(sEmpty)).toBe('8');

      // 2) Typing 7 -> ■/□ -> DEL unwraps frac(7,|) back to 7|
      const sUnwrapFrac = pressWithCaretInvariants('7', 'frac', 'del', 'add', '2', 'equals');
      expect(sUnwrapFrac.expression).toBe('7+2');
      expect(dec(sUnwrapFrac)).toBe('9');

      // 3) Standing outside frac(3,4)| and pressing DEL steps inside denominator -> DEL deletes 4 -> type 5 -> 3/5
      const sStepIn = pressWithCaretInvariants('3', 'frac', '4', 'right', 'del', 'del', '5', 'equals');
      expect(sStepIn.expression).toBe('frac(3,5)');
      expect(dec(sStepIn)).toBe('0.6');

      // 4) Unwrapping sqrt(|9) with DEL at start of radicand -> 9
      const sUnwrapSqrt = pressWithCaretInvariants('sqrt', '9', 'left', 'del', 'equals');
      expect(sUnwrapSqrt.expression).toBe('9');
      expect(dec(sUnwrapSqrt)).toBe('9');

      // 5) Navigating ∫ limits with ▼ (lower) and ▲ (upper), exiting with ▶, and adding + 1
      const sInteg = pressWithCaretInvariants(
        'integ', 'alpha', 'close', 'down', '0', 'up', '2', 'right', 'add', '1', 'equals',
      );
      expect(sInteg.expression).toBe('integ(X,0,2)+1');
      expect(dec(sInteg)).toBe('3');

      // 6) INS (SHIFT + DEL) overwrite mode replaces middle digit cleanly
      const sIns = pressWithCaretInvariants('1', '9', '3', 'left', 'left', 'shift', 'del', '2', 'equals');
      expect(sIns.expression).toBe('123');
      expect(dec(sIns)).toBe('123');

      // 7) Atomic postfix deletion of x⁻¹, x², x³ in a single DEL press
      const sAtomic = pressWithCaretInvariants('5', 'inverse', 'del', 'square', 'del', 'cube', 'equals');
      expect(sAtomic.expression).toBe('5^3');
      expect(dec(sAtomic)).toBe('125');
    });
  });

  describe('2. Scientific Notation ×10ˣ (⏨), Implicit Multiplication & Symbolic Algebra', () => {
    it('[Easy & Medium] evaluates unary and binary ×10ˣ with authentic Calcios precedence (no parens needed)', () => {
      // Unary ×10ˣ 3 = 1000
      expect(dec(pressWithCaretInvariants('exp', '3', 'equals'))).toBe('1000');
      // 2 ×10ˣ -3 = 1/500 (2×10^-3 in Norm1, 0.002 in Norm2)
      const s2e3 = pressWithCaretInvariants('2', 'exp', 'neg', '3', 'equals');
      expect(formatActiveResult(s2e3)).toEqual({
        type: 'fraction',
        sign: '',
        numerator: '1',
        denominator: '500',
      });
      expect(dec(s2e3)).toBe('2×10^-3');
      // Switch to Norm 2 (SHIFT + MODE -> 8 -> 2): 2 ×10ˣ -3 displays '0.002'
      expect(dec(press('shift', 'mode', '8', '2', '2', 'exp', 'neg', '3', 'equals'))).toBe('0.002');
      // 6 ÷ 2 ×10ˣ 3 = 3/1000 (tighter than ÷!)
      const sDivSci = pressWithCaretInvariants('6', 'divide', '2', 'exp', '3', 'equals');
      expect(formatActiveResult(sDivSci)).toEqual({
        type: 'fraction',
        sign: '',
        numerator: '3',
        denominator: '1000',
      });
      // Coulomb: 9 ×10ˣ 9 × 2 ×10ˣ -6 ÷ 3² = 2000
      expect(
        dec(
          pressWithCaretInvariants(
            '9', 'exp', '9', 'multiply', '2', 'exp', 'neg', '6', 'divide', '3', 'square', 'equals',
          ),
        ),
      ).toBe('2000');
      // (3 ×10ˣ 8)² via 3 ×10ˣ 8 x² = 9×10^16
      expect(dec(pressWithCaretInvariants('3', 'exp', '8', 'square', 'equals'))).toBe('9×10^16');
    });

    it('[Hard & Extreme] handles Calcios implicit multiplication, open-paren 1D functions, surds, ▸Simp, ÷R & FACT', () => {
      // 6 ÷ 2(1 + 2) = 1
      expect(dec(press('6', 'divide', '2', 'open', '1', 'add', '2', 'close', 'equals'))).toBe('1');
      // 1 ÷ 2π in RAD: sin(2π ÷ 2π) = sin(1) -> check 2π ÷ 2π = 1!
      expect(dec(press('2', 'shift', 'exp', 'divide', '2', 'shift', 'exp', 'equals'))).toBe('1');

      // Nested 1D open-paren functions without duplicate )) bugs: (1 + sin(30) + GCD(12, 18)) = 7.5
      const sNested = pressWithCaretInvariants(
        'open', '1', 'add', 'sin', '3', '0', 'close', 'add',
        'alpha', 'multiply', '1', '2', 'shift', 'close', '1', '8', 'close', 'close', 'equals',
      );
      expect(dec(sNested)).toBe('7.5');

      // Multi-radical rationalization: 1 / (√5 - √2) = (√5 + √2) / 3
      const sSurd = press('1', 'frac', 'sqrt', '5', 'right', 'subtract', 'sqrt', '2', 'equals');
      expect(formatActiveResult(sSurd)).toEqual({
        type: 'symbolic-multisurd',
        terms: [
          { coef: '1', rad: '5' },
          { coef: '1', rad: '2' },
        ],
        d: '3',
      });
      // Single radical conjugate: 1 / (2 - √3) = 2 + √3
      const sConj = press('1', 'frac', '2', 'subtract', 'sqrt', '3', 'equals');
      expect(formatActiveResult(sConj)).toEqual({
        type: 'symbolic-surd',
        a: '2',
        b: '1',
        rad: '3',
        d: '1',
      });

      // Manual step fraction simplification 24/36 ▸Simp 2 = 12/18 (with ÷2 badge)
      const sSimp1 = press('2', '4', 'frac', '3', '6', 'right', 'simp', '2', 'equals');
      expect(formatActiveResult(sSimp1)).toEqual({
        type: 'fraction',
        sign: '',
        numerator: '12',
        denominator: '18',
        simpFactor: '2',
      });
    });
  });

  describe('3. CALC Assignments, Multi-Statements (:), Calculus & SOLVE', () => {
    it('[Medium & Hard] supports CALC variable assignments and multi-statement formulas (A=X+1 : B=A² : B+X)', () => {
      // Build "A=X+1:B=A^2:B+X" and press CALC -> should prompt ONLY for X!
      const sPrompt = press(
        'alpha', 'neg', 'alpha', 'calc', 'alpha', 'close', 'add', '1',
        'alpha', 'integ',
        'alpha', 'dms', 'alpha', 'calc', 'alpha', 'neg', 'square',
        'alpha', 'integ',
        'alpha', 'dms', 'add', 'alpha', 'close',
        'calc',
      );
      expect(sPrompt.calcPrompt?.vars).toEqual(['X']);
      // Enter X = 3 -> step 1: A = 4
      const sStep1 = pressFrom(sPrompt, '3', 'equals');
      expect(dec(sStep1)).toBe('4');
      expect(formatDecimal(deserialize(sStep1.variables.A))).toBe('4');
      // Press = -> step 2: B = 16
      const sStep2 = pressFrom(sStep1, 'equals');
      expect(dec(sStep2)).toBe('16');
      expect(formatDecimal(deserialize(sStep2.variables.B))).toBe('16');
      // Press = -> step 3: B + X = 19
      const sStep3 = pressFrom(sStep2, 'equals');
      expect(dec(sStep3)).toBe('19');
    });

    it('[Extreme] solves transcendental SOLVE in RAD and telescoping Σ series', () => {
      // Switch to RAD (SHIFT + MODE -> 4), solve cos(X) = X starting at X = 0.5 -> 0.7390851332
      const sSolve = press(
        'shift', 'mode', '4',
        'cos', 'alpha', 'close', 'close', 'alpha', 'calc', 'alpha', 'close',
        'shift', 'calc', '0', 'dot', '5', 'equals',
      );
      expect(dec(sSolve)).toBe('0.7390851332');

      // Telescoping sum: ∑(frac(1, X(X+1)), 1, 9) = 9/10
      const sSigma = press(
        'shift', 'logbase',
        '1', 'frac', 'alpha', 'close', 'open', 'alpha', 'close', 'add', '1', 'close',
        'down', '1', 'up', '9', 'equals',
      );
      expect(formatActiveResult(sSigma)).toEqual({
        type: 'fraction',
        sign: '',
        numerator: '9',
        denominator: '10',
      });
    });
  });

  describe('4. All 10 Specialized Modes & Global Error Unbricking Across Every Mode', () => {
    it('[CMPLX Easy -> Extreme] toggles S⇔D on fractional complex numbers, Re⇔Im, polar phasors & ×10ˣ', () => {
      // (1 + i) ÷ 3 -> exact 1/3 + 1/3 i -> press S⇔D ONCE -> immediate decimal!
      const s1 = press('mode', '2', 'open', '1', 'add', 'eng', 'close', 'divide', '3', 'equals');
      expect(formatActiveComplexDisplay(s1)?.value).toEqual({
        type: 'complex-2d',
        form: 'rect',
        re: { type: 'fraction', sign: '', numerator: '1', denominator: '3' },
        imSign: '+',
        im: { type: 'fraction', sign: '', numerator: '1', denominator: '3' },
      });
      const s1Dec = pressFrom(s1, 'sd');
      expect(formatActiveComplexDisplay(s1Dec)?.value).toEqual({
        type: 'complex-2d',
        form: 'rect',
        re: { type: 'text', text: '0.3333333333' },
        imSign: '+',
        im: { type: 'text', text: '0.3333333333' },
      });

      // (1 + √3 i)^3 = -8
      const sCube = press(
        'mode', '2', 'open', '1', 'add', 'sqrt', '3', 'right', 'eng', 'close', 'cube', 'equals',
      );
      expect(formatActiveComplexDisplay(sCube)?.value).toEqual({ type: 'text', text: '-8' });

      // 2 ×10ˣ -2 + 5 ×10ˣ -2 i -> 0.02 + 0.05i
      const sSci = press('mode', '2', '2', 'exp', 'neg', '2', 'add', '5', 'exp', 'neg', '2', 'eng', 'equals', 'sd');
      expect(formatActiveComplexDisplay(sSci)?.value).toEqual({
        type: 'complex-2d',
        form: 'rect',
        re: { type: 'text', text: '0.02' },
        imSign: '+',
        im: { type: 'text', text: '0.05' },
      });
    });

    it('[MATRIX & VECTOR Hard -> Extreme] evaluates 2D fractions with MatA/VctA, unit vector VctA/|VctA|, Rref & S⇔D', () => {
      // Define MatA = [[1, 2], [3, 4]], compute frac(1, 2) × MatA -> [[1/2, 1], [3/2, 2]], toggle S⇔D!
      const sMat = press(
        'mode', '6', '1', '5',
        '1', 'equals', '2', 'equals', '3', 'equals', '4', 'equals',
        'ac',
        '1', 'frac', '2', 'right', 'multiply', 'shift', '4', '3', 'equals',
      );
      expect(sMat.matrix.showingMatrixResult).toBe(true);
      const cell00 = deserialize(sMat.matrix.matrices.MatAns!.cells[0][0]);
      expect(formatResult(cell00, sMat.resultFormat)).toEqual({
        type: 'fraction',
        sign: '',
        numerator: '1',
        denominator: '2',
      });
      const sMatDec = pressFrom(sMat, 'sd');
      expect(sMatDec.resultFormat).toBe('decimal');

      // Rref([[1, 2, 5], [1, -1, -1]]) -> [[1, 0, 1], [0, 1, 2]] (2x3 matrix = option 4)
      const sRref = press(
        'mode', '6', '1', '4',
        '1', 'equals', '2', 'equals', '5', 'equals',
        '1', 'equals', 'neg', '1', 'equals', 'neg', '1', 'equals',
        'ac',
        'shift', '4', 'down', '2', 'shift', '4', '3', 'equals',
      );
      const rrefAns = sRref.matrix.matrices.MatAns!;
      expect(formatDecimal(deserialize(rrefAns.cells[0][2]))).toBe('1');
      expect(formatDecimal(deserialize(rrefAns.cells[1][2]))).toBe('2');

      // VECTOR: VctA = [1, 1, 0] (dim 3 = option 1), unit vector frac(VctA, abs(VctA)) = [√2/2, √2/2, 0]
      const sUnit = press(
        'mode', '8', '1', '1',
        '1', 'equals', '1', 'equals', '0', 'equals',
        'ac',
        'shift', '5', '3', 'frac', 'shift', 'hyp', 'shift', '5', '3', 'equals',
      );
      expect(sUnit.vector.showingVectorResult).toBe(true);
      const c0 = deserialize(sUnit.vector.vectors.VctAns!.coords[0]);
      expect(formatResult(c0, 'exact')).toEqual({
        type: 'symbolic-surd',
        a: '0',
        b: '1',
        rad: '2',
        d: '2',
      });
    });

    it('[STAT, BASE-N, EQN, TABLE, INEQ, VERIF, DIST] passes hard multi-step workflows', () => {
      // STAT Quadratic Regression _+CX² (option 3): (0,1), (1,6), (2,17) -> y = 1 + 2x + 3x² -> C = 3
      const sQuadReg = press(
        'mode', '3', '3',
        '0', 'equals', '1', 'equals',
        '1', 'equals', '6', 'equals',
        '2', 'equals', '1', '7', 'equals',
        'ac',
        'shift', '1', '5', '3', 'equals',
      );
      expect(dec(sQuadReg)).toBe('3');

      // BASE-N: HEX FF and BIN 10101010 -> AA in HEX
      const sBase = press(
        'mode', '4', 'power', // HEX
        'tan', 'tan', // FF
        'shift', '3', '1', // and
        'shift', '3', 'down', '3', // 'b' prefix
        '1', '0', '1', '0', '1', '0', '1', '0',
        'equals',
      );
      expect(sBase.baseN.result).toBe('170'); // 0xAA = 170

      // EQN Cubic: X³ - 6X² + 11X - 6 = 0 -> exact roots {1, 2, 3}
      const sCubic = press(
        'mode', '5', '4',
        '1', 'equals', 'neg', '6', 'equals', '1', '1', 'equals', 'neg', '6', 'equals',
      );
      const sCubic2 = pressFrom(sCubic, 'down');
      const sCubic3 = pressFrom(sCubic2, 'down');
      expect([dec(sCubic), dec(sCubic2), dec(sCubic3)].sort()).toEqual(['1', '2', '3']);
      if (sCubic.eqn?.outcome?.status === 'solved') {
        expect(formatActiveEqnItemDisplay(sCubic, sCubic.eqn.outcome.items[0])).toEqual({
          type: 'text',
          text: '3',
        });
      }

      // TABLE with singularity: f(X) = 1/X, g(X) = X^2, Start = -1, End = 1, Step = 1
      const sTbl = press(
        'mode', '7',
        '1', 'frac', 'alpha', 'close', 'equals',
        'alpha', 'close', 'square', 'equals',
        'neg', '1', 'equals', '1', 'equals', '1', 'equals',
      );
      expect(sTbl.table?.rows.map((r) => r.fx)).toEqual(['-1', 'ERROR', '1']);
      expect(sTbl.table?.rows.map((r) => r.gx)).toEqual(['1', '0', '1']);

      // INEQ degenerate double root: (X - 2)² ≤ 0  <=>  X² - 4X + 4 ≤ 0 (deg 2 = 1, ≤ = 4) -> X = 2
      const sIneq = press(
        'mode', 'down', '1', '1', '4',
        '1', 'equals', 'neg', '4', 'equals', '4', 'equals',
      );
      expect(formatActiveInequalityDisplay(sIneq)).toEqual({
        type: 'ineq-2d',
        header: 'X=A',
        segments: [
          {
            kind: 'eq',
            val: { type: 'text', text: '2' },
          },
        ],
      });

      // VERIF exact trig/surd identity: sin(30)² + cos(30)² = 1 -> TRUE
      const sVerif = press(
        'mode', 'down', '2',
        'sin', '3', '0', 'close', 'square', 'add', 'cos', '3', '0', 'close', 'square',
        'shift', '6', '1', '1', 'equals',
      );
      expect(sVerif.verifResult).toBe(true);

      // DIST Inverse Normal: InvNorm(0.5, σ=2, μ=10) = 10
      const sDist = press('mode', 'down', '3', '3', '0', 'dot', '5', 'equals', '2', 'equals', '1', '0', 'equals');
      expect(dec(sDist)).toBe('10');
    });

    it('[Extreme Error Recovery] unbricks Math ERROR / Syntax ERROR cleanly with AC or ◀/▶ in EVERY mode', () => {
      // 1) EQN with a = 0 -> Math ERROR -> AC recovers to EQN editor!
      const errEqn = press('mode', '5', '3', '0', 'equals', '0', 'equals', '0', 'equals');
      expect(errEqn.phase).toBe('error');
      const recEqn = pressFrom(errEqn, 'ac');
      expect(recEqn.phase).toBe('editing');
      expect(recEqn.error).toBeNull();
      expect(recEqn.mode).toBe('EQN');

      // 2) INEQ with a = 0 -> Math ERROR -> ◀ recovers to INEQ editor!
      const errIneq = press('mode', 'down', '1', '1', '1', '0', 'equals', '1', 'equals', '1', 'equals');
      expect(errIneq.phase).toBe('error');
      const recIneq = pressFrom(errIneq, 'left');
      expect(recIneq.phase).toBe('editing');
      expect(recIneq.error).toBeNull();

      // 3) DIST Binomial PD with P = 2 -> Math ERROR -> AC recovers to DIST parameter editor!
      const errDist = press('mode', 'down', '3', '4', '2', '1', 'equals', '5', 'equals', '2', 'equals');
      expect(errDist.phase).toBe('error');
      const recDist = pressFrom(errDist, 'ac');
      expect(recDist.phase).toBe('editing');
      expect(recDist.error).toBeNull();
      expect(recDist.mode).toBe('DIST');

      // 4) TABLE with Step = 0 -> Math ERROR -> AC recovers to TABLE prompt!
      const errTbl = press('mode', '7', 'alpha', 'close', 'equals', 'equals', '1', 'equals', '5', 'equals', '0', 'equals');
      expect(errTbl.phase).toBe('error');
      const recTbl = pressFrom(errTbl, 'ac');
      expect(recTbl.phase).toBe('editing');
      expect(recTbl.error).toBeNull();
      expect(recTbl.mode).toBe('TABLE');

      // 5) COMP Syntax ERROR: 1 + * 2 -> ◀ jumps directly to offending '*' at index 2!
      const errSyn = press('1', 'add', 'multiply', '2', 'equals');
      expect(errSyn.phase).toBe('error');
      expect(errSyn.errorCursor).toBe(2);
      const recSyn = pressFrom(errSyn, 'left');
      expect(recSyn.phase).toBe('editing');
      expect(recSyn.cursor).toBe(2);
    });

    it('[Stress / Fuzz Invariant] executes 1,000+ deterministic pseudo-random 2D template + D-pad + DEL + INS steps across 5 seeds without ever losing or duplicating the caret', () => {
      const pool = [
        '1', '2', '3', 'dot', 'add', 'subtract', 'multiply',
        'frac', 'mfrac', 'sqrt', 'cbrt', 'root', 'power', 'logbase',
        'integ', 'deriv', 'sigma', 'prod', 'abs', 'recur',
        'sin', 'cos', 'log', 'exp', 'square', 'inverse', 'open', 'close',
        'left', 'right', 'up', 'down', 'del', 'toggle-ins',
      ];
      for (const initSeed of [1337, 4242, 99991, 77777, 314159]) {
        let seed = initSeed;
        const seq: string[] = [];
        for (let i = 0; i < 200; i++) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          seq.push(pool[seed % pool.length]);
        }
        pressWithCaretInvariants(...seq);
      }
    }, 20000);

    it('[Actions & Memory] verifies STO, RCL, M+, M-, Replay History protection, DRG▸, CONST, CONV, LineIO & CLR', () => {
      // 1) Replay history: calculate 10+5=15, start typing '77', press ▼ -> '77' is NOT wiped!
      const sHist1 = press('1', '0', 'add', '5', 'equals', '7', '7', 'down');
      expect(sHist1.expression).toBe('77');
      // After AC (empty expression), pressing ▲ recalls '10+5'!
      const sHist2 = pressFrom(sHist1, 'ac', 'up');
      expect(sHist2.expression).toBe('10+5');

      // 2) STO A, M+, M-, RCL M: 12 -> STO A -> A*2 -> M+ -> 4 -> SHIFT+M+ (M-) -> RCL M = 20
      const sMem = press(
        '1', '2', 'shift', 'rcl', 'neg', // 12 -> A
        'alpha', 'neg', 'multiply', '2', 'mplus', // M += 24
        '4', 'shift', 'mplus', // M -= 4
        'ac', 'rcl', 'mplus', 'equals',
      );
      expect(dec(sMem)).toBe('20');

      // 3) DRG▸ override: in RAD mode, sin(30°) = 0.5 via SHIFT + Ans -> 1
      const sDrg = press('shift', 'mode', '4', 'sin', '3', '0', 'shift', 'ans', '1', 'close', 'equals');
      expect(dec(sDrg)).toBe('0.5');

      // 4) Unit conversion CONV 01 (in -> cm): 10 in -> cm = 25.4
      const sConv = press('1', '0', 'shift', '8', '0', '1', 'equals');
      expect(dec(sConv)).toBe('25.4');

      // 5) LineIO mode (SHIFT + MODE -> 2): ■/□ inserts linear '÷' and returns decimal '0.5'
      const sLine = press('shift', 'mode', '2', '1', 'frac', '2', 'equals');
      expect(sLine.expression).toBe('1÷2');
      expect(formatActiveResult(sLine)).toEqual({ type: 'text', text: '0.5' });

      // 6) CLR All (SHIFT + 9 -> 3 -> =) resets angle, IO mode, and memory cleanly
      const sCleared = pressFrom(sMem, 'shift', '9', '3', 'equals');
      expect(sCleared.ioMode).toBe('Math');
      expect(formatDecimal(deserialize(sCleared.variables.M))).toBe('0');
    });

    it('[Calcios Hardware Fidelity] enforces wrap-around, visual L-to-R ∫/∑/∏ traversal, active ■ box, atomic 10^/e^, RCL immediate display & auto-DMS', () => {
      // 1) Expression wrap-around at 0 (◀ -> end) and length (▶ -> 0)
      const sWrapRight = press('1', 'add', '2', 'right');
      expect(sWrapRight.cursor).toBe(0);
      const sWrapLeft = pressFrom(sWrapRight, 'left');
      expect(sWrapLeft.cursor).toBe(sWrapLeft.expression.length);

      // 2) Active empty slot renders solid blinking '■' (`data-testid="lcd-caret"`), unfocused renders '□'
      const sEmptyFrac = press('frac');
      const view = render(<NaturalExpression expression={sEmptyFrac.expression} cursor={sEmptyFrac.cursor} />);
      const caretEl = view.getByTestId('lcd-caret');
      expect(caretEl.textContent).toBe('■');
      expect(view.container.querySelectorAll('.math-box-placeholder').length).toBe(1);
      view.unmount();

      // 3) Visual L-to-R traversal on filled integral `integ(X,0,2)`
      // Standing right after `integ(X,0,2)|`: ◀ enters body end (`X|`), NOT upper limit!
      const sInt = press('integ', 'alpha', 'close', 'down', '0', 'up', '2', 'right');
      expect(sInt.expression).toBe('integ(X,0,2)');
      expect(sInt.cursor).toBe(sInt.expression.length);
      const sStep1 = pressFrom(sInt, 'left'); // -> 'integ(X|,0,2)'
      expect(sStep1.cursor).toBe(7);
      const sStep2 = pressFrom(sStep1, 'left'); // -> 'integ(|X,0,2)'
      expect(sStep2.cursor).toBe(6);
      const sStep3 = pressFrom(sStep2, 'left'); // -> 'integ(X,0,2|)' (upper.end)
      expect(sStep3.cursor).toBe(11);
      const sStep4 = pressFrom(sStep3, 'left', 'left'); // -> 'integ(X,0|,2)' (lower.end)
      expect(sStep4.cursor).toBe(9);
      const sStep5 = pressFrom(sStep4, 'left', 'left'); // -> '|integ(X,0,2)' (nodeStart = 0)
      expect(sStep5.cursor).toBe(0);
      // Forward ▶ from '|integ(X,0,2)' enters lower.start ('|0') first!
      const sFwd1 = pressFrom(sStep5, 'right');
      expect(sFwd1.cursor).toBe(8);

      // 4) Atomic 10^(■) and e^(■): ◀ from empty exponent steps before '10', DEL deletes whole '10^()'
      const sPow10 = press('shift', 'log');
      expect(sPow10.expression).toBe('10^()');
      expect(pressFrom(sPow10, 'left').cursor).toBe(0);
      expect(pressFrom(sPow10, 'del').expression).toBe('');

      // 5) Centered proportional ▲/▼ inside 2D fraction: middle of '1234' ('12|34') -> ▼ -> middle of '56' ('5|6')
      const sMidFrac = press('frac', '1', '2', '3', '4', 'down', '5', '6', 'up', 'left', 'left', 'down');
      expect(sMidFrac.expression).toBe('frac(1234,56)');
      expect(sMidFrac.cursor).toBe(11); // right between '5' and '6'

      // 6) RCL <Var> on fresh screen immediately displays recalled value in result phase without pressing '='
      const sRclNow = press('7', 'frac', '2', 'shift', 'rcl', 'neg', 'ac', 'rcl', 'neg');
      expect(sRclNow.phase).toBe('result');
      expect(dec(sRclNow)).toBe('3.5');

      // 7) Sexagesimal arithmetic (`12°30° + 0°45° =`) auto-displays in DMS (`13°15’0”`) and toggles via S⇔D
      const sDms = press('1', '2', 'dms', '3', '0', 'dms', 'add', '0', 'dms', '4', '5', 'dms', 'equals');
      expect(formatActiveResult(sDms)).toEqual({ type: 'text', text: '13°15’0”' });
      const sDmsToggle = pressFrom(sDms, 'sd');
      expect(dec(sDmsToggle)).toBe('13.25');

      // 8) Pressing ON or MODE inside sub-menus (e.g. eqn-menu) never strands EQN with null state
      const sEqnMenu = press('mode', '5');
      expect(sEqnMenu.screen).toBe('eqn-menu');
      const sBackMode = pressFrom(sEqnMenu, 'mode', 'mode');
      expect(sBackMode.screen).toBe('normal');
      expect(sBackMode.mode).toBe('COMP');
      const sOnFromMenu = pressFrom(sEqnMenu, 'on');
      expect(sOnFromMenu.screen).toBe('normal');
      expect(sOnFromMenu.mode).toBe('COMP');
    });
  });
});
