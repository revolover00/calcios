import React from 'react';
import type { CalculatorAction, CalculatorState } from '../core/calculator';
import {
  LOWER_KEYPAD_ROWS,
  SCIENTIFIC_ROW_1,
  SCIENTIFIC_ROWS_2_TO_4,
  type KeySpec,
} from '../data/keyLayout';
import { LcdScreen } from './LcdScreen';

interface CalculatorHardwareProps {
  state: CalculatorState;
  dispatch: React.Dispatch<CalculatorAction>;
}

function renderKeyFace(key: KeySpec): React.ReactNode {
  switch (key.id) {
    case 'frac':
      return (
        <span className="key-glyph-frac" aria-hidden="true">
          <span className="glyph-box glyph-box-solid" />
          <span className="glyph-frac-line" />
          <span className="glyph-box glyph-box-hollow" />
        </span>
      );
    case 'sqrt':
      return (
        <span className="key-glyph-inline" aria-hidden="true">
          <span>√</span>
          <span className="glyph-overbar">
            <span className="glyph-box glyph-box-solid" />
          </span>
        </span>
      );
    case 'square':
      return (
        <span className="key-glyph-math" aria-hidden="true">
          <i>x</i><sup>2</sup>
        </span>
      );
    case 'cube':
      return (
        <span className="key-glyph-math" aria-hidden="true">
          <i>x</i><sup>3</sup>
        </span>
      );
    case 'inverse':
      return (
        <span className="key-glyph-math" aria-hidden="true">
          <i>x</i><sup>−1</sup>
        </span>
      );
    case 'power':
      return (
        <span className="key-glyph-math" aria-hidden="true">
          <i>x</i>
          <sup className="glyph-sup-box">
            <span className="glyph-box glyph-box-solid" />
          </sup>
        </span>
      );
    case 'logbase':
      return (
        <span className="key-glyph-logb" aria-hidden="true">
          <span>log</span>
          <sub className="glyph-sub-box">
            <span className="glyph-box glyph-box-solid" />
          </sub>
          <span className="glyph-box glyph-box-hollow" />
        </span>
      );
    case 'exp':
      return (
        <span className="key-glyph-exp" aria-hidden="true">
          ×10<sup><i>x</i></sup>
        </span>
      );
    default:
      return <span>{key.primary}</span>;
  }
}

function renderShiftLegend(key: KeySpec): React.ReactNode {
  if (!key.shiftLabel) return null;
  if (key.id === 'frac') {
    return (
      <span className="legend-mfrac" aria-hidden="true">
        <span className="legend-box-solid" />
        <span className="legend-frac-stack">
          <span className="legend-box-hollow" />
          <span className="legend-frac-bar" />
          <span className="legend-box-hollow" />
        </span>
      </span>
    );
  }
  return key.shiftLabel;
}

function CalcKey({
  spec,
  isBaseN,
  activeBase,
  onPress,
}: {
  spec: KeySpec;
  isBaseN: boolean;
  activeBase: string;
  onPress: (id: string) => void;
}): React.ReactElement {
  const hasBoth = Boolean(spec.shiftLabel && spec.alphaLabel);
  const baseTagActive = isBaseN && spec.baseNLabel === activeBase;

  return (
    <div
      className={`calc-key-cell calc-key-cell-${spec.variant}`}
      style={spec.col ? { gridColumn: spec.col } : undefined}
    >
      <div className={`calc-key-legends ${hasBoth ? 'legends-split' : 'legends-center'}`}>
        {spec.shiftLabel && (
          <span className="legend-shift">{renderShiftLegend(spec)}</span>
        )}
        {spec.baseNLabel && isBaseN && (
          <span className={baseTagActive ? 'legend-basen active' : 'legend-basen'}>
            {spec.baseNLabel}
          </span>
        )}
        {spec.alphaLabel && (
          <span className="legend-alpha">{spec.alphaLabel}</span>
        )}
      </div>
      <button
        type="button"
        className={`calc-btn calc-btn-${spec.variant}`}
        data-key-id={spec.id}
        aria-label={spec.ariaLabel}
        onClick={() => onPress(spec.id)}
      >
        {renderKeyFace(spec)}
      </button>
    </div>
  );
}

export function CalculatorHardware({
  state,
  dispatch,
}: CalculatorHardwareProps): React.ReactElement {
  const handlePress = (id: string) => dispatch({ type: 'key', id });
  const isBaseN = state.mode === 'BASE-N';

  return (
    <div className="casio-casing" dir="ltr" data-testid="calculator-hardware">
      <div className="casio-inner-rim">
        {/* Top Brand & Edition Header */}
        <header className="casio-header">
          <div className="casio-brand-row">
            <span className="casio-logo">CASIO</span>
            <span className="casio-model">fx-95ES PLUS</span>
          </div>
          <div className="casio-sub-row">
            <span className="casio-vpam">NATURAL-V.P.A.M.</span>
            <span className="casio-edition">2nd edition</span>
          </div>
        </header>

        {/* Natural Textbook LCD */}
        <LcdScreen state={state} dispatch={dispatch} />

        {/* Upper Control Row + Central Sculpted 4-Way D-Pad */}
        <div className="casio-upper-deck">
          {/* Left Pill: SHIFT & ALPHA */}
          <div className="casio-round-pair-wrap">
            <div className="casio-round-labels">
              <span className={state.shift ? 'round-lbl round-lbl-shift active' : 'round-lbl round-lbl-shift'}>
                SHIFT
              </span>
              <span className={state.alpha ? 'round-lbl round-lbl-alpha active' : 'round-lbl round-lbl-alpha'}>
                ALPHA
              </span>
            </div>
            <div className="casio-pill-groove">
              <button
                type="button"
                className={state.shift ? 'casio-metal-btn active' : 'casio-metal-btn'}
                data-key-id="shift"
                aria-label="SHIFT الوظائف الثانوية"
                aria-pressed={state.shift}
                onClick={() => handlePress('shift')}
              />
              <button
                type="button"
                className={state.alpha ? 'casio-metal-btn active' : 'casio-metal-btn'}
                data-key-id="alpha"
                aria-label="ALPHA المتغيرات والرموز"
                aria-pressed={state.alpha}
                onClick={() => handlePress('alpha')}
              />
            </div>
          </div>

          {/* Center 4-Way Replay Pad */}
          <div className="casio-dpad-zone">
            <div className="casio-dpad-ring" role="group" aria-label="أزرار الاتجاهات ومراجعة العمليات">
              <button
                type="button"
                className="dpad-lobe dpad-up"
                data-key-id="up"
                aria-label="فوق"
                onClick={() => handlePress('up')}
              >
                <span className="dpad-arrow">▲</span>
              </button>
              <button
                type="button"
                className="dpad-lobe dpad-left"
                data-key-id="left"
                aria-label="يسار"
                onClick={() => handlePress('left')}
              >
                <span className="dpad-arrow">◀</span>
              </button>
              <div className="dpad-center-knurl" aria-hidden="true" />
              <button
                type="button"
                className="dpad-lobe dpad-right"
                data-key-id="right"
                aria-label="يمين"
                onClick={() => handlePress('right')}
              >
                <span className="dpad-arrow">▶</span>
              </button>
              <button
                type="button"
                className="dpad-lobe dpad-down"
                data-key-id="down"
                aria-label="تحت"
                onClick={() => handlePress('down')}
              >
                <span className="dpad-arrow">▼</span>
              </button>
            </div>
          </div>

          {/* Right Pill: MODE/SETUP & ON */}
          <div className="casio-round-pair-wrap">
            <div className="casio-round-labels casio-round-labels-right">
              <span className="round-lbl-mode-group">
                <span className="round-lbl round-lbl-mode">MODE</span>
                <span className="round-lbl round-lbl-setup">SETUP</span>
              </span>
              <span className="round-lbl round-lbl-on">ON</span>
            </div>
            <div className="casio-pill-groove">
              <button
                type="button"
                className="casio-metal-btn"
                data-key-id="mode"
                aria-label="MODE الأوضاع أو SETUP الإعدادات"
                onClick={() => handlePress('mode')}
              />
              <button
                type="button"
                className="casio-metal-btn"
                data-key-id="on"
                aria-label="ON تشغيل"
                onClick={() => handlePress('on')}
              />
            </div>
          </div>
        </div>

        {/* Scientific 6-Column Block */}
        <section className="casio-sci-section" aria-label="الأزرار العلمية">
          {/* Row 1 flanking lower D-Pad */}
          <div className="casio-sci-row casio-sci-row-flank">
            {SCIENTIFIC_ROW_1.map((spec) => (
              <CalcKey
                key={spec.id}
                spec={spec}
                isBaseN={isBaseN}
                activeBase={state.baseN.base}
                onPress={handlePress}
              />
            ))}
          </div>

          {/* Rows 2 to 4 */}
          {SCIENTIFIC_ROWS_2_TO_4.map((row, rIdx) => (
            <div key={rIdx} className="casio-sci-row">
              {row.map((spec) => (
                <CalcKey
                  key={spec.id}
                  spec={spec}
                  isBaseN={isBaseN}
                  activeBase={state.baseN.base}
                  onPress={handlePress}
                />
              ))}
            </div>
          ))}
        </section>

        {/* Main 5-Column Numeric & Operator Block */}
        <section className="casio-num-section" aria-label="الأرقام والعمليات الأساسية">
          {LOWER_KEYPAD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="casio-num-row">
              {row.map((spec) => (
                <CalcKey
                  key={spec.id}
                  spec={spec}
                  isBaseN={isBaseN}
                  activeBase={state.baseN.base}
                  onPress={handlePress}
                />
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
