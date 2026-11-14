import { describe, expect, it } from 'vitest';
import { createInitialState } from './calculator';
import { evaluateExpression } from './expression';
import { evaluateComplex } from './cmplx';
import { computeStatSummary, estimateStatYHat } from './stat';
import { determinantMatrix, invertMatrix, multiplyMatrix, rrefMatrix, type MatrixValue } from './matrix';
import { angleVector, crossVector, dotVector, evaluateVectorExpression, type VectorValue } from './vector';
import { evaluateMatrixExpression } from './matrix';
import { solveCubic, solveQuadratic } from './eqn';
import { D, applyUnitConversion, combinatoric, factorial, makeScalar, polarFromRect, rational, rectFromPolar, scalarFromInteger, scalarFromLiteral } from './value';
import { binomialCd, binomialPd, inverseNormal, normalCd, normalPd, poissonCd, poissonPd, statNormP, statNormR } from './dist';
import { numericIntegral } from './calculus';
import { UNIT_CONVERSIONS } from './constants';
import { evaluateBaseN, formatBaseN, toInt32 } from './basen';

const state = createInitialState();
const baseContext = { variables: state.variables, ans: state.ans, preAns: state.preAns };
const closeEnough = (actual: number, expected: number, tolerance = 2e-11) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(expected)));
};
const lit = (value: number) => value.toPrecision(16).replace(/(?:\.0+|(?<=\.[0-9]*?)0+)$/, '');

function evaluate(expression: string, angle: 'DEG' | 'RAD' | 'GRA'): number {
  return evaluateExpression(expression, { ...baseContext, angle }).decimal.toNumber();
}

describe('calculator math-engine numerical invariant sweep', () => {
  it('keeps common scalar grammar consistent across COMP, CMPLX, MATRIX, and VECTOR engines', () => {
    const state = createInitialState();
    const matrixContext = { matrices: state.matrix.matrices, variables: state.variables, ans: state.ans, angle: 'DEG' as const };
    const vectorContext = { vectors: state.vector.vectors, variables: state.variables, ans: state.ans, angle: 'DEG' as const };
    const complexContext = { angle: 'DEG' as const, variables: state.variables, cmplxAns: { re: state.ans, im: state.cmplx.ans.im } };
    const expressions: Array<[string, number]> = [
      ['2^3^2', 512],
      ['-2^2', -4],
      ['2×(3+4)', 14],
      ['2(3+4)', 14],
      ['3!+4', 10],
      ['sin(30)^2+cos(30)^2', 1],
      ['sin⁻¹(0.5)', 30],
      ['arcsin(0.5)', 30],
      ['12°30°+1', 13.5],
      ['5nCr2', 10],
      ['logb(2,8)', 3],
      ['GCD(18,24)', 6],
      ['root(3,-8)', -2],
      ['sqrt(2)^2', 2],
      ['2π+1', 2 * Math.PI + 1],
      ['3⏨2', 300],
    ];
    for (const [expression, expected] of expressions) {
      const comp = evaluateExpression(expression, { ...baseContext, angle: 'DEG' });
      const cmplx = evaluateComplex(expression, complexContext).value;
      const matrix = evaluateMatrixExpression(expression, matrixContext);
      const vector = evaluateVectorExpression(expression, vectorContext);
      expect(cmplx.im.decimal.isZero()).toBe(true);
      expect(matrix.kind).toBe('scalar');
      expect(vector.kind).toBe('scalar');
      closeEnough(comp.decimal.toNumber(), expected);
      closeEnough(cmplx.re.decimal.toNumber(), expected);
      if (matrix.kind === 'scalar') closeEnough(matrix.scalar.decimal.toNumber(), expected);
      if (vector.kind === 'scalar') closeEnough(vector.scalar.decimal.toNumber(), expected);
    }
  });

  it('cross-checks randomized scalar expressions across the four independent mode parsers', () => {
    const state = createInitialState();
    const matrixContext = { matrices: state.matrix.matrices, variables: state.variables, ans: state.ans, angle: 'DEG' as const };
    const vectorContext = { vectors: state.vector.vectors, variables: state.variables, ans: state.ans, angle: 'DEG' as const };
    const complexContext = { angle: 'DEG' as const, variables: state.variables, cmplxAns: { re: state.ans, im: state.cmplx.ans.im } };
    let seed = 0x3c6ef372;
    const next = (max: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % max;
    };
    for (let sample = 0; sample < 48; sample++) {
      const a = next(9) + 2;
      const b = next(9) + 2;
      const c = next(9) + 2;
      const expressions = [
        `${a}+${b}×${c}`,
        `${a}×${b}+${c}`,
        `${a}^2-${b}`,
        `${a}+${b}%`,
        `${a}-${b}%`,
        `${a}×${b}%`,
        `${a}/${b}%`,
        `sin(${a * 5})+cos(${b * 5})`,
        `sqrt(${a * a})+${b}`,
        `GCD(${a * b},${b * c})`,
        `logb(2,${2 ** (1 + next(5))})`,
      ];
      for (const expression of expressions) {
        const reference = evaluateExpression(expression, { ...baseContext, angle: 'DEG' }).decimal;
        const complex = evaluateComplex(expression, complexContext).value;
        const matrix = evaluateMatrixExpression(expression, matrixContext);
        const vector = evaluateVectorExpression(expression, vectorContext);
        expect(complex.im.decimal.isZero()).toBe(true);
        expect(complex.re.decimal.minus(reference).abs().lt('1e-25')).toBe(true);
        expect(matrix.kind).toBe('scalar');
        expect(vector.kind).toBe('scalar');
        if (matrix.kind === 'scalar') expect(matrix.scalar.decimal.minus(reference).abs().lt('1e-25')).toBe(true);
        if (vector.kind === 'scalar') expect(vector.scalar.decimal.minus(reference).abs().lt('1e-25')).toBe(true);
      }
    }
  });

  it('keeps Casio relative-percent addition and subtraction consistent in scalar MATRIX/VECTOR expressions', () => {
    const state = createInitialState();
    const matrixContext = { matrices: state.matrix.matrices, variables: state.variables, ans: state.ans };
    const vectorContext = { vectors: state.vector.vectors, variables: state.variables, ans: state.ans };
    const cases: Array<[string, string]> = [
      ['200+10%', '220'],
      ['200-10%', '180'],
      ['200+10%+10%', '242'],
      ['200*10%', '20'],
      ['200/10%', '2000'],
      ['200+(10%)', '200.1'],
      ['10%+200', '200.1'],
      ['200+10%×2', '200.2'],
    ];
    for (const [expression, expected] of cases) {
      const matrixResult = evaluateMatrixExpression(expression, matrixContext);
      const vectorResult = evaluateVectorExpression(expression, vectorContext);
      expect(matrixResult.kind).toBe('scalar');
      expect(vectorResult.kind).toBe('scalar');
      if (matrixResult.kind === 'scalar') expect(matrixResult.scalar.decimal.toString()).toBe(expected);
      if (vectorResult.kind === 'scalar') expect(vectorResult.scalar.decimal.toString()).toBe(expected);
    }
  });

  it('evaluates deterministic parenthesized arithmetic trees consistently', () => {
    let seed = 0x1234abcd;
    const next = (max: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed % max;
    };
    const tree = (depth: number): { source: string; value: number } => {
      if (depth === 0 || next(4) === 0) {
        const value = next(19) - 9;
        return { source: String(value), value };
      }
      const left = tree(depth - 1);
      let right = tree(depth - 1);
      const operator = ['+', '-', '×', '÷'][next(4)];
      if (operator === '÷' && right.value === 0) right = { source: '1', value: 1 };
      const value = operator === '+' ? left.value + right.value
        : operator === '-' ? left.value - right.value
        : operator === '×' ? left.value * right.value
        : left.value / right.value;
      return { source: `(${left.source}${operator}${right.source})`, value };
    };
    for (let sample = 0; sample < 256; sample++) {
      const expression = tree(4);
      closeEnough(evaluate(expression.source, 'RAD'), expression.value, 1e-12);
    }
  });

  it('tracks circular trig and inverse trig across DEG, RAD, and GRA', () => {
    const angles = ['DEG', 'RAD', 'GRA'] as const;
    for (const angle of angles) {
      const toRadians = angle === 'DEG' ? Math.PI / 180 : angle === 'GRA' ? Math.PI / 200 : 1;
      const fromRadians = 1 / toRadians;
      for (let i = 0; i < 36; i++) {
        const x = ((i * 47) % 121 - 60) / 2.7;
        const r = x * toRadians;
        closeEnough(evaluate(`sin(${lit(x)})`, angle), Math.sin(r));
        closeEnough(evaluate(`cos(${lit(x)})`, angle), Math.cos(r));
        if (Math.abs(Math.cos(r)) > 0.15) {
          closeEnough(evaluate(`tan(${lit(x)})`, angle), Math.tan(r));
        }
      }
      for (let i = -19; i <= 19; i++) {
        const x = i / 20;
        closeEnough(evaluate(`asin(${lit(x)})`, angle), Math.asin(x) * fromRadians);
        closeEnough(evaluate(`acos(${lit(x)})`, angle), Math.acos(x) * fromRadians);
        closeEnough(evaluate(`atan(${lit(x)})`, angle), Math.atan(x) * fromRadians);
      }
    }
  });

  it('returns correct vector angles across tiny and huge magnitudes and all angle units', () => {
    for (const scale of ['1e-90', '1', '1e90']) {
      const axisX: VectorValue = { dim: 3, coords: [makeScalar(scale, undefined, true), scalarFromInteger(0), scalarFromInteger(0)] };
      const axisY: VectorValue = { dim: 3, coords: [scalarFromInteger(0), makeScalar(scale, undefined, true), scalarFromInteger(0)] };
      const negativeX: VectorValue = { dim: 3, coords: [makeScalar(`-${scale}`, undefined, true), scalarFromInteger(0), scalarFromInteger(0)] };
      expect(angleVector(axisX, axisX, 'DEG').decimal.abs().lt('1e-25')).toBe(true);
      expect(angleVector(axisX, axisY, 'DEG').decimal.minus(90).abs().lt('1e-20')).toBe(true);
      expect(angleVector(axisX, negativeX, 'DEG').decimal.minus(180).abs().lt('1e-20')).toBe(true);
      expect(angleVector(axisX, axisY, 'RAD').decimal.minus(D.acos(-1).div(2)).abs().lt('1e-25')).toBe(true);
      expect(angleVector(axisX, axisY, 'GRA').decimal.minus(100).abs().lt('1e-20')).toBe(true);
    }
  });

  it('preserves matrix determinant identities and vector orthogonality across deterministic samples', () => {
    const matrix = (seed: number): MatrixValue => ({
      rows: 3,
      cols: 3,
      cells: Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) =>
        scalarFromInteger(((seed * 17 + r * 11 + c * 7 + r * c * 3) % 13) - 6),
      )),
    });
    for (let seed = 0; seed < 32; seed++) {
      const a = matrix(seed);
      const b = matrix(seed + 41);
      const lhs = determinantMatrix(multiplyMatrix(a, b)).decimal;
      const rhs = determinantMatrix(a).decimal.times(determinantMatrix(b).decimal);
      expect(lhs.minus(rhs).abs().lte('1e-25')).toBe(true);

      const v: VectorValue = { dim: 3, coords: [0, 1, 2].map((j) => scalarFromInteger(seed + j * 3 - 7)) };
      const w: VectorValue = { dim: 3, coords: [0, 1, 2].map((j) => scalarFromInteger(seed * 2 - j * 5 + 2)) };
      const cross = crossVector(v, w);
      expect(dotVector(cross, v).decimal.isZero()).toBe(true);
      expect(dotVector(cross, w).decimal.isZero()).toBe(true);
    }
  });

  it('round-trips signed 32-bit values through DEC, HEX, BIN, and OCT display encodings', () => {
    let seed = 0x1badb002;
    for (let sample = 0; sample < 256; sample++) {
      seed = (Math.imul(seed, 22695477) + 1) | 0;
      const value = BigInt(seed);
      for (const base of ['DEC', 'HEX', 'BIN', 'OCT'] as const) {
        expect(evaluateBaseN(formatBaseN(value, base), base, 0n)).toBe(toInt32(value));
      }
    }
    expect(evaluateBaseN('-2147483648', 'DEC', 0n)).toBe(-2147483648n);
    expect(evaluateBaseN('FFFFFFFF', 'HEX', 0n)).toBe(-1n);
    expect(evaluateBaseN('10000000000000000000000000000000', 'BIN', 0n)).toBe(-2147483648n);
    expect(evaluateBaseN('37777777777', 'OCT', 0n)).toBe(-1n);
  });

  it('matches signed 32-bit BASE-N logical operations against BigInt bitwise arithmetic', () => {
    let seed = 0x5eed1234;
    const nextSigned = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      return BigInt(seed);
    };
    for (let sample = 0; sample < 128; sample++) {
      const left = nextSigned();
      const right = nextSigned();
      for (const [operator, expected] of [
        ['and', BigInt.asIntN(32, left & right)],
        ['or', BigInt.asIntN(32, left | right)],
        ['xor', BigInt.asIntN(32, left ^ right)],
        ['xnor', BigInt.asIntN(32, ~(left ^ right))],
      ] as const) {
        expect(evaluateBaseN(`${left}${operator}${right}`, 'DEC', 0n)).toBe(expected);
      }
    }
  });

  it('round-trips rectangular and polar coordinates in DEG, RAD, and GRA', () => {
    const angles = ['DEG', 'RAD', 'GRA'] as const;
    for (const angle of angles) {
      for (let sample = 0; sample < 48; sample++) {
        const x = scalarFromInteger(((sample * 19) % 101) - 50);
        const y = scalarFromInteger(((sample * 37 + 11) % 97) - 48);
        const polar = polarFromRect(x, y, angle);
        const rect = rectFromPolar(polar.r, polar.theta, angle);
        expect(rect.x.decimal.minus(x.decimal).abs().lt('1e-24')).toBe(true);
        expect(rect.y.decimal.minus(y.decimal).abs().lt('1e-24')).toBe(true);
      }
    }
  });

  it('round-trips every paired unit conversion, including temperature offsets', () => {
    for (let index = 0; index < UNIT_CONVERSIONS.length; index += 2) {
      const forward = UNIT_CONVERSIONS[index];
      const reverse = UNIT_CONVERSIONS[index + 1];
      const input = scalarFromInteger(7);
      const roundTrip = applyUnitConversion(
        applyUnitConversion(input, forward.token),
        reverse.token,
      );
      expect(roundTrip.decimal.minus(input.decimal).abs().lt('1e-30')).toBe(true);
    }
  });

  it('solves a spread of quadratic equations and returns both real roots', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rootA = (seed * 5) % 19 - 9;
      let rootB = (seed * 11) % 23 - 11;
      if (rootA === rootB) rootB += 1;
      const leading = seed % 2 === 0 ? -seed : seed;
      const result = solveQuadratic([
        scalarFromInteger(leading),
        scalarFromInteger(-leading * (rootA + rootB)),
        scalarFromInteger(leading * rootA * rootB),
      ]);
      expect(result.status).toBe('solved');
      if (result.status === 'solved') {
        const roots = result.items
          .filter((item) => (item.label === 'X₁' || item.label === 'X₂') && item.scalar)
          .map((item) => item.scalar!.decimal.toNumber())
          .sort((a, b) => a - b);
        expect(roots).toHaveLength(2);
        expect(roots[0]).toBeCloseTo(Math.min(rootA, rootB), 10);
        expect(roots[1]).toBeCloseTo(Math.max(rootA, rootB), 10);
      }
    }
  });

  it('keeps reduced row-echelon form idempotent on deterministic rectangular matrices', () => {
    for (let seed = 0; seed < 64; seed++) {
      const input: MatrixValue = {
        rows: 3,
        cols: 4,
        cells: Array.from({ length: 3 }, (_, r) => Array.from({ length: 4 }, (_, c) =>
          scalarFromInteger(((seed * 19 + r * 13 + c * 7 + r * c) % 11) - 5),
        )),
      };
      const once = rrefMatrix(input);
      const twice = rrefMatrix(once);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          expect(twice.cells[r][c].decimal.minus(once.cells[r][c].decimal).abs().lt('1e-25')).toBe(true);
        }
      }
    }
  });

  it('round-trips deterministic diagonally dominant matrices through inversion', () => {
    for (let seed = 1; seed <= 32; seed++) {
      const input: MatrixValue = {
        rows: 3,
        cols: 3,
        cells: Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) =>
          scalarFromInteger(r === c ? 20 + seed + r : ((seed * 7 + r * 13 + c * 5) % 9) - 4),
        )),
      };
      const identity = multiplyMatrix(input, invertMatrix(input));
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const expected = r === c ? 1 : 0;
          expect(identity.cells[r][c].decimal.minus(expected).abs().lt('1e-25')).toBe(true);
        }
      }
    }
  });

  it('matches exact factorial, combination, and permutation values over their practical ranges', () => {
    let expectedFactorial = 1n;
    for (let n = 0; n <= 69; n++) {
      if (n > 1) expectedFactorial *= BigInt(n);
      expect(factorial(scalarFromInteger(n)).decimal.eq(expectedFactorial.toString())).toBe(true);
      for (let k = 0; k <= Math.min(n, 35); k++) {
        let combination = 1n;
        let permutation = 1n;
        for (let i = 0; i < k; i++) {
          combination = combination * BigInt(n - i) / BigInt(i + 1);
          permutation *= BigInt(n - i);
        }
        expect(combinatoric(scalarFromInteger(n), scalarFromInteger(k), false).decimal.eq(combination.toString())).toBe(true);
        expect(combinatoric(scalarFromInteger(n), scalarFromInteger(k), true).decimal.eq(permutation.toString())).toBe(true);
      }
    }
  });

  it('recovers known real roots across a deterministic cubic coefficient corpus', () => {
    for (let seed = 1; seed <= 36; seed++) {
      const roots = [seed % 11 - 5, (seed * 3) % 13 - 6, (seed * 7) % 17 - 8];
      for (let i = 1; i < roots.length; i++) {
        while (roots.slice(0, i).includes(roots[i])) roots[i] += 1;
      }
      const [a, b, c] = roots;
      const scale = seed % 2 === 0 ? -seed : seed;
      const coefficients = [
        scale,
        -scale * (a + b + c),
        scale * (a * b + a * c + b * c),
        -scale * a * b * c,
      ].map(scalarFromInteger);
      const result = solveCubic(coefficients);
      expect(result.status).toBe('solved');
      if (result.status === 'solved') {
        const actual = result.items
          .filter((item) => item.scalar)
          .map((item) => item.scalar!.decimal.toNumber())
          .sort((x, y) => x - y);
        expect(actual).toHaveLength(3);
        expect(actual).toEqual([...roots].sort((x, y) => x - y));
      }
    }
  });

  it('matches weighted statistical moments across deterministic datasets', () => {
    let seed = 0x76543210;
    const next = (max: number) => {
      seed = (Math.imul(seed, 22695477) + 1) >>> 0;
      return seed % max;
    };
    for (let sample = 0; sample < 40; sample++) {
      const rows = Array.from({ length: 8 }, () => ({
        x: String(next(101) - 50),
        y: String(next(81) - 40),
        freq: String(next(4) + 1),
      }));
      const expanded = rows.flatMap((row) => Array.from({ length: Number(row.freq) }, () => ({
        x: Number(row.x), y: Number(row.y),
      })));
      const n = expanded.length;
      const meanX = expanded.reduce((sum, item) => sum + item.x, 0) / n;
      const meanY = expanded.reduce((sum, item) => sum + item.y, 0) / n;
      const varianceX = expanded.reduce((sum, item) => sum + (item.x - meanX) ** 2, 0) / n;
      const varianceY = expanded.reduce((sum, item) => sum + (item.y - meanY) ** 2, 0) / n;
      const covariance = expanded.reduce((sum, item) => sum + (item.x - meanX) * (item.y - meanY), 0) / n;
      const summary = computeStatSummary('A+BX', rows);
      closeEnough(summary.meanX.decimal.toNumber(), meanX, 1e-12);
      closeEnough(summary.meanY!.decimal.toNumber(), meanY, 1e-12);
      closeEnough(summary.popSdX.decimal.toNumber(), Math.sqrt(varianceX), 1e-12);
      closeEnough(summary.popSdY!.decimal.toNumber(), Math.sqrt(varianceY), 1e-12);
      closeEnough(summary.corrR!.decimal.toNumber(), covariance / Math.sqrt(varianceX * varianceY), 1e-12);
    }
  });

  it('recovers linear regression coefficients from multiple exact weighted datasets', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const slope = seed - 12;
      const intercept = seed % 7 - 3;
      const rows = Array.from({ length: 6 }, (_, index) => {
        const x = index - 2;
        return { x: String(x), y: String(intercept + slope * x), freq: String((index % 3) + 1) };
      });
      const summary = computeStatSummary('A+BX', rows);
      expect(summary.regA?.decimal.minus(intercept).abs().lte('1e-25')).toBe(true);
      expect(summary.regB?.decimal.minus(slope).abs().lte('1e-25')).toBe(true);
      closeEnough(estimateStatYHat('A+BX', summary, scalarFromInteger(9)).decimal.toNumber(), intercept + slope * 9);
    }
  });

  it('normalizes discrete distribution PMFs and keeps their CDFs consistent', () => {
    for (let n = 0; n <= 30; n++) {
      for (const pText of ['0', '0.01', '0.2', '0.5', '0.9', '1']) {
        const nScalar = scalarFromInteger(n);
        const p = scalarFromLiteral(pText);
        let total = new D(0);
        let cumulative = new D(0);
        for (let x = 0; x <= n; x++) {
          const mass = binomialPd(scalarFromInteger(x), nScalar, p).decimal;
          total = total.plus(mass);
          cumulative = cumulative.plus(mass);
          expect(binomialCd(scalarFromInteger(x), nScalar, p).decimal.minus(cumulative).abs().lt('1e-28')).toBe(true);
        }
        expect(total.minus(1).abs().lt('1e-28')).toBe(true);
      }
    }
    for (const lambdaText of ['0.1', '1', '5', '20']) {
      const lambda = scalarFromLiteral(lambdaText);
      let total = new D(0);
      for (let x = 0; x <= 100; x++) total = total.plus(poissonPd(scalarFromInteger(x), lambda).decimal);
      expect(total.minus(1).abs().lt('1e-25')).toBe(true);
      expect(poissonCd(scalarFromInteger(100), lambda).decimal.minus(1).abs().lt('1e-25')).toBe(true);
    }
  });

  it('keeps the normal PDF integral consistent with its interval CDF', () => {
    const zero = scalarFromInteger(0);
    const one = scalarFromInteger(1);
    const lower = scalarFromInteger(-8);
    const upper = scalarFromInteger(8);
    const integrated = numericIntegral((x) => normalPd(x, zero, one), lower, upper);
    const cdf = normalCd(lower, upper, zero, one);
    expect(integrated.decimal.minus(cdf.decimal).abs().lt('1e-10')).toBe(true);
    expect(cdf.decimal.minus(1).abs().lt('1e-14')).toBe(true);
  });

  it('round-trips inverse-normal probabilities from extreme lower and upper tails', () => {
    const zero = scalarFromInteger(0);
    const one = scalarFromInteger(1);
    const probabilities = ['1e-100', '1e-40', '1e-12', '0.001', '0.025', '0.5'];
    for (const probability of probabilities) {
      const p = scalarFromLiteral(probability);
      const z = inverseNormal(p, zero, one);
      const recovered = statNormP(z);
      expect(recovered.decimal.minus(p.decimal).abs().div(p.decimal).lt('1e-24')).toBe(true);
      const exact = p.exact!;
      const upperComplement = rational(exact.d - exact.n, exact.d)!;
      const upperTail = makeScalar(new D(1).minus(p.decimal), upperComplement, true);
      const high = inverseNormal(upperTail, zero, one);
      const upperRecovered = statNormR(high);
      expect(upperRecovered.decimal.minus(p.decimal).abs().div(p.decimal).lt('1e-24')).toBe(true);
    }
  });

  it('tracks logarithms, roots, and hyperbolic functions over small, ordinary, and large scales', () => {
    const values = ['1e-100', '1e-30', '0.001', '0.2', '1', '2', '10', '1e30', '1e90'];
    for (const value of values) {
      const x = Number(value);
      closeEnough(evaluate(`ln(${value})`, 'RAD'), Math.log(x));
      closeEnough(evaluate(`log(${value})`, 'RAD'), Math.log10(x));
      closeEnough(evaluate(`sqrt(${value})`, 'RAD'), Math.sqrt(x));
    }
    for (let i = -12; i <= 12; i++) {
      const x = i / 3;
      closeEnough(evaluate(`sinh(${lit(x)})`, 'RAD'), Math.sinh(x));
      closeEnough(evaluate(`cosh(${lit(x)})`, 'RAD'), Math.cosh(x));
      closeEnough(evaluate(`tanh(${lit(x)})`, 'RAD'), Math.tanh(x));
    }
  });
});
