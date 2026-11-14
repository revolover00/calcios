import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalculatorHardware } from './CalculatorHardware';
import { createInitialState } from '../core/calculator';
import { scanMathFromImage } from '../core/visionScan';

vi.mock('../core/visionScan', () => ({
  scanMathFromImage: vi.fn(),
}));

const scanMock = vi.mocked(scanMathFromImage);

describe('CalculatorHardware image scan review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reviews structured mode values and loads a complete EQN scan into EQN mode', async () => {
    const modeData = { type: 'quad', coefficients: ['1', '-5', '6'] };
    scanMock.mockResolvedValueOnce({
      transcription: 'x squared minus five x plus six equals zero',
      expression: '',
      mode: 'EQN',
      modeData,
    });
    const dispatch = vi.fn();

    render(<CalculatorHardware state={createInitialState()} dispatch={dispatch} />);
    fireEvent.click(screen.getByTestId('scan-math-btn'));
    fireEvent.click(screen.getByTestId('scan-trigger-upload'));
    fireEvent.change(screen.getByTestId('scan-upload-input'), {
      target: { files: [new File(['fake image'], 'equation.png', { type: 'image/png' })] },
    });

    expect(await screen.findByTestId('scan-mode-prefilled')).toHaveTextContent('EQN');
    expect(screen.getByTestId('scan-mode-data-preview')).toHaveTextContent('coefficients');
    const loadButton = screen.getByTestId('scan-load-expression');
    expect(loadButton).toBeEnabled();
    fireEvent.click(loadButton);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'load-scanned-math',
      expression: '',
      mode: 'EQN',
      modeData,
      angle: undefined,
    });
  });

  it('shows the full OCR transcription before allowing a calculator expression to be loaded', async () => {
    const transcription = 'Line one: a definition\\nLine two: an equation\\nFinal question';
    scanMock.mockResolvedValueOnce({
      transcription,
      expression: '2X+5=13',
      mode: 'COMP',
    });
    const dispatch = vi.fn();

    render(<CalculatorHardware state={createInitialState()} dispatch={dispatch} />);
    fireEvent.click(screen.getByTestId('scan-math-btn'));
    fireEvent.click(screen.getByTestId('scan-trigger-upload'));
    fireEvent.change(screen.getByTestId('scan-upload-input'), {
      target: { files: [new File(['fake image'], 'problem.png', { type: 'image/png' })] },
    });

    const transcriptionField = await screen.findByTestId('scan-transcription');
    expect(transcriptionField).toHaveValue(transcription);
    expect(screen.getByTestId('scan-expression')).toHaveValue('2X+5=13');
    expect(screen.getByTestId('scan-solve-guidance')).toHaveTextContent('SHIFT + CALC (SOLVE)');
    expect(dispatch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('scan-load-expression'));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({
      type: 'load-scanned-math',
      expression: '2X+5=13',
      mode: 'COMP',
      angle: undefined,
      notice: 'Equation loaded in COMP. Press SHIFT + CALC (SOLVE) when ready; it will not solve automatically.',
    }));
  });
});
