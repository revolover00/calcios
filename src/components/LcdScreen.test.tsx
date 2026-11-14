import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../core/calculator';
import { createZeroMatrix } from '../core/matrix';
import { scalarFromLiteral, serialize } from '../core/value';
import { LcdScreen } from './LcdScreen';

describe('LCD overflow visibility', () => {
  it('keeps focused matrix digits reachable instead of truncating them', () => {
    const initial = createInitialState();
    const matrix = createZeroMatrix(2, 2);
    matrix.cells[0][0] = serialize(scalarFromLiteral('12345678901234567890'));
    const state = {
      ...initial,
      mode: 'MATRIX' as const,
      matrix: {
        ...initial.matrix,
        matrices: { ...initial.matrix.matrices, MatA: matrix },
        editingTarget: 'MatA' as const,
      },
    };

    const { container, rerender } = render(<LcdScreen state={state} />);
    const focusedCell = container.querySelector<HTMLElement>('.lcd-mat-cell.focused');
    const exactReadout = container.querySelector<HTMLElement>('.lcd-cell-readout');
    if (!focusedCell || !exactReadout) throw new Error('Missing focused matrix value display');
    Object.defineProperty(focusedCell, 'scrollWidth', { configurable: true, value: 180 });
    Object.defineProperty(exactReadout, 'scrollWidth', { configurable: true, value: 180 });

    rerender(<LcdScreen state={{ ...state }} />);
    expect(focusedCell.scrollLeft).toBe(180);
    expect(exactReadout.scrollLeft).toBe(180);
  });

  it('keeps the active table row digits reachable when values exceed a column', () => {
    const initial = createInitialState();
    const state = {
      ...initial,
      mode: 'TABLE' as const,
      table: {
        stage: 'view' as const,
        fExpr: 'X',
        gExpr: '',
        startInput: '',
        endInput: '',
        stepInput: '',
        editingField: false,
        rows: [{ index: 1, x: '12345678901234567890', fx: '98765432109876543210' }],
        selectedRow: 0,
      },
    };

    const { container, rerender } = render(<LcdScreen state={state} />);
    const activeCells = Array.from(container.querySelectorAll<HTMLElement>('.lcd-table-row.active > span'));
    expect(activeCells.length).toBeGreaterThan(0);
    activeCells.forEach((cell) => {
      Object.defineProperty(cell, 'scrollWidth', { configurable: true, value: 160 });
    });

    rerender(<LcdScreen state={{ ...state }} />);
    activeCells.forEach((cell) => expect(cell.scrollLeft).toBe(160));
  });
});
