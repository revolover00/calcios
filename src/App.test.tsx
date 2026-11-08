import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

function clickHardwareKey(container: HTMLElement, keyId: string) {
  const btn = container.querySelector<HTMLButtonElement>(`[data-key-id="${keyId}"]`);
  if (!btn) throw new Error(`Missing hardware key: ${keyId}`);
  fireEvent.click(btn);
}

describe('Calculator UI & Extra fx-991ES PLUS C Panel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('draws the fx-95ES PLUS hardware in code without using the reference photograph', () => {
    const { container } = render(<App />);
    expect(screen.getByTestId('calculator-hardware')).toBeInTheDocument();
    expect(screen.getByText('CASIO')).toBeInTheDocument();
    expect(screen.getByText('fx-95ES PLUS')).toBeInTheDocument();
    expect(screen.getByText('2nd edition')).toBeInTheDocument();

    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(0);
  });

  it('computes expressions via physical keypad clicks and toggles S⇔D', () => {
    const { container } = render(<App />);
    clickHardwareKey(container, '7');
    clickHardwareKey(container, 'divide');
    clickHardwareKey(container, '2');
    clickHardwareKey(container, 'equals');

    const lcdResult = screen.getByTestId('lcd-result');
    expect(lcdResult.textContent).toContain('7');
    expect(lcdResult.textContent).toContain('2');

    clickHardwareKey(container, 'sd');
    expect(lcdResult.textContent).toBe('3.5');
  });

  it('supports physical keyboard input when no text input is focused', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '6' });
    fireEvent.keyDown(window, { key: '*' });
    fireEvent.keyDown(window, { key: '7' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(screen.getByTestId('lcd-result').textContent).toBe('42');
  });

  it('inserts scientific constants and unit conversions from the fx-991ES PLUS C panel', () => {
    const { container } = render(<App />);

    // Open Constants tab and pick c0 (28)
    fireEvent.click(screen.getByRole('tab', { name: /الثوابت/ }));
    fireEvent.click(screen.getByTestId('const-28'));
    clickHardwareKey(container, 'equals');
    expect(screen.getByTestId('lcd-result').textContent).toBe('299792458');

    // Clear, enter 100, convert °C -> °F (conv-38)
    clickHardwareKey(container, 'ac');
    clickHardwareKey(container, '1');
    clickHardwareKey(container, '0');
    clickHardwareKey(container, '0');
    fireEvent.click(screen.getByRole('tab', { name: /التحويلات/ }));
    fireEvent.click(screen.getByTestId('conv-38'));
    clickHardwareKey(container, 'equals');
    expect(screen.getByTestId('lcd-result').textContent).toBe('212');
  });

  it('switches modes and honestly marks unimplemented modes in Arabic', () => {
    render(<App />);
    const panel = screen.getByLabelText(/لوحة وظائف fx-991ES PLUS C/);
    fireEvent.click(within(panel).getByRole('tab', { name: /الأوضاع والتغطية/ }));

    fireEvent.click(within(panel).getByRole('button', { name: /MATRIX/ }));
    expect(screen.getByTestId('calculator-notice').textContent).toContain('قيد التطوير');
  });
});
