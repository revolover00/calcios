import { describe, expect, it } from 'vitest';
import { determinantMatrix, invertMatrix, refMatrix, rrefMatrix, type MatrixValue } from './matrix';
import { makeScalar, scalarFromInteger } from './value';

describe('matrix determinant regressions', () => {
  it('keeps valid pivots across columns with very different scales', () => {
    const matrix: MatrixValue = {
      rows: 2,
      cols: 2,
      cells: [
        [makeScalar('1', undefined, true), makeScalar('0', undefined, true)],
        [makeScalar('0', undefined, true), makeScalar('1e-30', undefined, true)],
      ],
    };

    expect(invertMatrix(matrix).cells[1][1].decimal.toString()).toBe('1e+30');
    expect(refMatrix(matrix).cells[1][1].decimal.toString()).toBe('1');
    expect(rrefMatrix(matrix).cells[1][1].decimal.toString()).toBe('1');
  });

  it('includes every row and column for matrices larger than 3×3', () => {
    const values = [
      [1, 2, 0, 0],
      [3, 4, 0, 0],
      [0, 0, 5, 6],
      [0, 0, 7, 8],
    ];
    const matrix: MatrixValue = {
      rows: 4,
      cols: 4,
      cells: values.map((row) => row.map(scalarFromInteger)),
    };

    expect(determinantMatrix(matrix).exact).toEqual({ n: 4n, d: 1n });
  });
});
