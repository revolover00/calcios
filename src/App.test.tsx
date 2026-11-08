import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

function clickHardwareKey(container: HTMLElement, keyId: string) {
  const btn = container.querySelector<HTMLButtonElement>(`[data-key-id="${keyId}"]`);
  if (!btn) throw new Error(`Missing hardware key: ${keyId}`);
  fireEvent.click(btn);
}

describe('Calculator-Only Viewport & fx-991ES PLUS C Integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders ONLY the code-drawn fx-95ES PLUS calculator on screen with no external panels or images', () => {
    const { container } = render(<App />);
    const viewport = screen.getByTestId('calc-viewport');
    expect(viewport.children.length).toBe(1);
    expect(screen.getByTestId('calculator-hardware')).toBeInTheDocument();
    expect(screen.getByText('CASIO')).toBeInTheDocument();
    expect(screen.getByText('fx-95ES PLUS')).toBeInTheDocument();
    expect(screen.getByText('2nd edition')).toBeInTheDocument();
    expect(screen.queryByTestId('fn-tray-popover')).toBeNull();

    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(0);
  });

  it('computes exact fractions, symbolic surds, and π multiples on the LCD and toggles S⇔D', () => {
    const { container } = render(<App />);

    // sin(45) -> √2/2 exact surd, then S⇔D -> decimal
    clickHardwareKey(container, 'sin');
    clickHardwareKey(container, '4');
    clickHardwareKey(container, '5');
    clickHardwareKey(container, 'equals');

    const lcdResult = screen.getByTestId('lcd-result');
    expect(lcdResult.textContent).toContain('√2');
    expect(lcdResult.textContent).toContain('2');

    clickHardwareKey(container, 'sd');
    expect(lcdResult.textContent).toBe('0.7071067812');

    // Switch to RAD (SHIFT + MODE -> 4) and compute asin(0.5) -> 1/6 π
    clickHardwareKey(container, 'ac');
    clickHardwareKey(container, 'shift');
    clickHardwareKey(container, 'mode');
    clickHardwareKey(container, '4');

    clickHardwareKey(container, 'shift');
    clickHardwareKey(container, 'sin');
    clickHardwareKey(container, '0');
    clickHardwareKey(container, 'dot');
    clickHardwareKey(container, '5');
    clickHardwareKey(container, 'equals');

    expect(screen.getByTestId('lcd-result').textContent).toContain('1');
    expect(screen.getByTestId('lcd-result').textContent).toContain('6');
    expect(screen.getByTestId('lcd-result').textContent).toContain('π');
  });

  it('supports physical keyboard input when no text input is focused', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '6' });
    fireEvent.keyDown(window, { key: '*' });
    fireEvent.keyDown(window, { key: '7' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(screen.getByTestId('lcd-result').textContent).toBe('42');
  });

  it('supports native SHIFT+7 (CONST) and SHIFT+8 (CONV) LCD menus directly from the keypad', () => {
    const { container } = render(<App />);

    // SHIFT + 7 -> 28 (c0 speed of light = 299792458)
    clickHardwareKey(container, 'shift');
    clickHardwareKey(container, '7');
    expect(screen.getByTestId('lcd-menu').textContent).toContain('CONST');
    clickHardwareKey(container, '2');
    clickHardwareKey(container, '8');
    clickHardwareKey(container, 'equals');
    expect(screen.getByTestId('lcd-result').textContent).toBe('299792458');

    // Clear, enter 100, SHIFT + 8 -> 38 (°C▸°F = 212)
    clickHardwareKey(container, 'ac');
    clickHardwareKey(container, '1');
    clickHardwareKey(container, '0');
    clickHardwareKey(container, '0');
    clickHardwareKey(container, 'shift');
    clickHardwareKey(container, '8');
    expect(screen.getByTestId('lcd-menu').textContent).toContain('CONV');
    clickHardwareKey(container, '3');
    clickHardwareKey(container, '8');
    clickHardwareKey(container, 'equals');
    expect(screen.getByTestId('lcd-result').textContent).toBe('212');
  });

  it('provides discreet internal 991+ bezel popover for dedicated calculus/CALC/SOLVE keys and switches all 11 modes', () => {
    const { container } = render(<App />);

    // Open internal 991+ micro-popover, insert definite integral ∫(X^2, 0, 3) = 9
    fireEvent.click(screen.getByTestId('fn-tray-toggle'));
    expect(screen.getByTestId('fn-tray-popover')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fn-integ'));
    expect(screen.queryByTestId('fn-tray-popover')).toBeNull();

    clickHardwareKey(container, 'alpha');
    clickHardwareKey(container, 'close'); // X
    clickHardwareKey(container, 'square'); // ^2
    clickHardwareKey(container, 'right'); // move to lower bound
    clickHardwareKey(container, '0');
    clickHardwareKey(container, 'right'); // move to upper bound
    clickHardwareKey(container, '3');
    clickHardwareKey(container, 'equals');
    expect(screen.getByTestId('lcd-result').textContent).toBe('9');

    // Switch to MODE -> Page 2 -> 2:VERIF and verify 3+4=7 -> TRUE
    clickHardwareKey(container, 'mode');
    clickHardwareKey(container, 'down');
    expect(screen.getByTestId('lcd-menu').textContent).toContain('1:INEQ');
    expect(screen.getByTestId('lcd-menu').textContent).toContain('2:VERIF');
    expect(screen.getByTestId('lcd-menu').textContent).toContain('3:DIST');
    clickHardwareKey(container, '2');

    clickHardwareKey(container, '3');
    clickHardwareKey(container, 'add');
    clickHardwareKey(container, '4');
    clickHardwareKey(container, 'shift');
    clickHardwareKey(container, '6');
    clickHardwareKey(container, '1'); // =
    clickHardwareKey(container, '7');
    clickHardwareKey(container, 'equals');
    expect(screen.getByTestId('lcd-result').textContent).toBe('TRUE');
  });

  it('renders 2D Natural-V.P.A.M. INEQ header (X<A, B<X) and recurring decimal overbar on the LCD', () => {
    const { container } = render(<App />);

    // 1 ÷ 3 = -> 1/3 -> S⇔D -> 0.3̅ with vinculum overbar
    clickHardwareKey(container, '1');
    clickHardwareKey(container, 'divide');
    clickHardwareKey(container, '3');
    clickHardwareKey(container, 'equals');
    clickHardwareKey(container, 'sd');

    const overbar = container.querySelector('.math-overbar');
    expect(overbar).not.toBeNull();
    expect(overbar?.textContent).toBe('3');

    // Switch to INEQ: aX^2+bX+c > 0 with a=1, b=0, c=-2 -> X<A, B<X on top line, X<-√2, √2<X on bottom
    clickHardwareKey(container, 'mode');
    clickHardwareKey(container, 'down');
    clickHardwareKey(container, '1'); // INEQ
    clickHardwareKey(container, '1'); // quad
    clickHardwareKey(container, '1'); // > 0
    clickHardwareKey(container, '1');
    clickHardwareKey(container, 'equals');
    clickHardwareKey(container, '0');
    clickHardwareKey(container, 'equals');
    clickHardwareKey(container, 'neg');
    clickHardwareKey(container, '2');
    clickHardwareKey(container, 'equals');

    expect(screen.getByTestId('lcd-expression').textContent).toBe('X<A, B<X');
    expect(screen.getByTestId('lcd-result').textContent).toContain('X<−√2');
    expect(screen.getByTestId('lcd-result').textContent).toContain('√2<X');
  });

  it('renders ▸Simp divisor badge, 2D CMPLX with Re⇔Im indicator, and persists Page-2 SETUP settings', () => {
    const { container, unmount } = render(<App />);

    // 12 ÷ 18 ▸Simp = -> ÷2 badge + 6/9 fraction
    clickHardwareKey(container, '1');
    clickHardwareKey(container, '2');
    clickHardwareKey(container, 'divide');
    clickHardwareKey(container, '1');
    clickHardwareKey(container, '8');
    fireEvent.click(screen.getByTestId('fn-tray-toggle'));
    fireEvent.click(screen.getByTestId('fn-simp'));
    clickHardwareKey(container, 'equals');

    const simpBadge = container.querySelector('.math-simp-factor');
    expect(simpBadge?.textContent).toBe('÷2');
    expect(screen.getByTestId('lcd-result').textContent).toContain('6');
    expect(screen.getByTestId('lcd-result').textContent).toContain('9');

    // CMPLX 2D stacked fraction + Re⇔Im indicator in LCD status bar
    clickHardwareKey(container, 'mode');
    clickHardwareKey(container, '2'); // CMPLX
    clickHardwareKey(container, 'open');
    clickHardwareKey(container, '1');
    clickHardwareKey(container, 'add');
    clickHardwareKey(container, 'eng'); // i
    clickHardwareKey(container, 'close');
    clickHardwareKey(container, 'divide');
    clickHardwareKey(container, '2');
    clickHardwareKey(container, 'equals');

    expect(screen.getByTestId('lcd-status').textContent).toContain('Re⇔Im');
    expect(container.querySelector('.lcd-complex-2d')).not.toBeNull();

    // SETUP Page 2 -> 5:Disp -> 2:Comma persists to localStorage across remount
    clickHardwareKey(container, 'shift');
    clickHardwareKey(container, 'mode');
    clickHardwareKey(container, 'down');
    clickHardwareKey(container, '5'); // Disp
    clickHardwareKey(container, '2'); // Comma
    unmount();

    const { container: c2 } = render(<App />);
    clickHardwareKey(c2, '1');
    clickHardwareKey(c2, 'divide');
    clickHardwareKey(c2, '2');
    clickHardwareKey(c2, 'shift');
    clickHardwareKey(c2, 'equals'); // ≈ -> 0,5 with Comma decimal mark!
    expect(screen.getByTestId('lcd-result').textContent).toBe('0,5');
  });
});
