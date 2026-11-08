import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CalculatorAction, CalculatorState } from '../core/calculator';
import {
  isDirectGroqHost,
  loadVisionConfig,
  saveVisionConfig,
  scanMathFromImage,
  type VisionConfig,
} from '../core/visionScan';
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
    case 'integ':
      return (
        <span className="key-glyph-integ" aria-hidden="true">
          <span className="glyph-int-sym">∫</span>
          <span className="glyph-int-limits">
            <span className="glyph-box glyph-box-hollow glyph-box-2xs" />
            <span className="glyph-box glyph-box-hollow glyph-box-2xs" />
          </span>
          <span className="glyph-box glyph-box-solid" />
        </span>
      );
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
    case 'dms':
      return (
        <span className="key-glyph-dms" aria-hidden="true">
          ° ’ ”
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

  if (key.modeTag) {
    return <span className="legend-mode-tag">{key.shiftLabel}</span>;
  }

  switch (key.id) {
    case 'integ':
      return (
        <span className="legend-deriv" aria-hidden="true">
          <span className="legend-frac-stack">
            <span className="legend-mini-ch">d</span>
            <span className="legend-frac-bar" />
            <span className="legend-mini-ch">d<i>x</i></span>
          </span>
          <span className="legend-box-solid" />
        </span>
      );
    case 'inverse':
      return (
        <span className="legend-math-italic" aria-hidden="true">
          <i>x</i>!
        </span>
      );
    case 'logbase':
      return (
        <span className="legend-inline-glyph" aria-hidden="true">
          <span>∑</span>
          <span className="legend-box-solid" />
        </span>
      );
    case 'frac':
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
    case 'sqrt':
      return (
        <span className="legend-inline-glyph" aria-hidden="true">
          <sup className="legend-sup-num">3</sup>
          <span>√</span>
          <span className="legend-overbar-gold">
            <span className="legend-box-solid" />
          </span>
        </span>
      );
    case 'square':
      return (
        <span className="legend-math-italic" aria-hidden="true">
          <i>x</i><sup>3</sup>
        </span>
      );
    case 'power':
      return (
        <span className="legend-inline-glyph" aria-hidden="true">
          <sup className="legend-sup-box">
            <span className="legend-box-solid" />
          </sup>
          <span>√</span>
          <span className="legend-overbar-gold">
            <span className="legend-box-hollow" />
          </span>
        </span>
      );
    case 'log':
      return (
        <span className="legend-inline-glyph" aria-hidden="true">
          <span>10</span>
          <sup className="legend-sup-box">
            <span className="legend-box-solid" />
          </sup>
        </span>
      );
    case 'ln':
      return (
        <span className="legend-inline-glyph legend-math-italic" aria-hidden="true">
          <i>e</i>
          <sup className="legend-sup-box">
            <span className="legend-box-solid" />
          </sup>
        </span>
      );
    case 'sd':
      return (
        <span className="legend-sd-frac" aria-hidden="true">
          <span>a</span>
          <span className="legend-frac-stack">
            <span className="legend-mini-ch">b</span>
            <span className="legend-frac-bar" />
            <span className="legend-mini-ch">c</span>
          </span>
          <span>⇔</span>
          <span className="legend-frac-stack">
            <span className="legend-mini-ch">d</span>
            <span className="legend-frac-bar" />
            <span className="legend-mini-ch">c</span>
          </span>
        </span>
      );
    default:
      return key.shiftLabel;
  }
}

function renderAlphaLegend(key: KeySpec): React.ReactNode {
  if (!key.alphaLabel) return null;
  if (key.id === 'logbase') {
    return (
      <span className="legend-inline-glyph" aria-hidden="true">
        <span>∏</span>
        <span className="legend-box-pink" />
      </span>
    );
  }
  if (key.id === 'sqrt') {
    return (
      <span className="legend-overbar-pink" aria-hidden="true">
        <span className="legend-box-pink" />
      </span>
    );
  }
  if (key.id === 'exp') {
    return <i className="legend-italic-e">e</i>;
  }
  return key.alphaLabel;
}

function CalcKey({
  spec,
  isBaseN,
  isCmplx,
  activeBase,
  onPress,
}: {
  spec: KeySpec;
  isBaseN: boolean;
  isCmplx: boolean;
  activeBase: string;
  onPress: (id: string) => void;
}): React.ReactElement {
  const hasLeft = Boolean(spec.shiftLabel || spec.cmplxLeftLabel);
  const hasRight = Boolean(spec.alphaLabel || spec.baseNLabel || spec.cmplxRightLabel);
  const hasBoth = hasLeft && hasRight;
  const onlyRight = !hasLeft && hasRight;
  const baseTagActive = isBaseN && spec.baseNLabel === activeBase;

  const alignClass = hasBoth
    ? 'legends-split'
    : onlyRight
      ? 'legends-right'
      : 'legends-center';

  return (
    <div
      className={`calc-key-cell calc-key-cell-${spec.variant}`}
      style={spec.col ? { gridColumn: spec.col } : undefined}
    >
      <div className={`calc-key-legends ${alignClass}`}>
        {spec.shiftLabel && (
          <span className="legend-shift">{renderShiftLegend(spec)}</span>
        )}
        {spec.cmplxLeftLabel && (
          <span className={isCmplx ? 'legend-cmplx active' : 'legend-cmplx'}>
            {spec.cmplxLeftLabel}
          </span>
        )}
        {spec.baseNLabel && (
          <span className={baseTagActive ? 'legend-basen active' : 'legend-basen'}>
            {spec.baseNLabel}
          </span>
        )}
        {spec.cmplxRightLabel && (
          <span className={isCmplx ? 'legend-cmplx active' : 'legend-cmplx'}>
            {spec.cmplxRightLabel === 'i' ? <i>i</i> : spec.cmplxRightLabel}
          </span>
        )}
        {spec.alphaLabel && (
          <span className="legend-alpha">{renderAlphaLegend(spec)}</span>
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

export type CalciosBodyTheme = 'black' | 'pink' | 'blue';

function loadBodyTheme(): CalciosBodyTheme {
  try {
    const saved = window.localStorage.getItem('calcios-body-theme');
    if (saved === 'black' || saved === 'pink' || saved === 'blue') return saved;
  } catch {
    // ignore storage errors
  }
  return 'black';
}

export function CalculatorHardware({
  state,
  dispatch,
}: CalculatorHardwareProps): React.ReactElement {
  const [bodyTheme, setBodyTheme] = useState<CalciosBodyTheme>(loadBodyTheme);
  const [scanView, setScanView] = useState<'closed' | 'menu' | 'config' | 'scanning'>('closed');
  const [scanError, setScanError] = useState<string | null>(null);
  const [visionCfg, setVisionCfg] = useState<VisionConfig>(loadVisionConfig);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const selectTheme = (next: CalciosBodyTheme) => {
    setBodyTheme(next);
    try {
      window.localStorage.setItem('calcios-body-theme', next);
    } catch {
      // ignore storage errors
    }
  };

  const runImageScan = useCallback(
    async (file: Blob) => {
      setScanError(null);
      setScanView('scanning');
      try {
        const scanned = await scanMathFromImage(file, visionCfg);
        dispatch({
          type: 'load-scanned-math',
          expression: scanned.expression,
          mode: scanned.mode,
          angle: scanned.angle,
        });
        setScanView('closed');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to scan math image.';
        setScanError(msg);
        const cfg = loadVisionConfig();
        setScanView(!cfg.apiKey && isDirectGroqHost(cfg.apiUrl) ? 'config' : 'menu');
      }
    },
    [dispatch, visionCfg],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            void runImageScan(blob);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [runImageScan]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      void runImageScan(file);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = saveVisionConfig(visionCfg);
    setVisionCfg(saved);
    setScanError(null);
    setScanView('menu');
  };

  const handlePress = (id: string) => {
    if (scanView !== 'closed') {
      if (id === 'ac' || id === 'on') {
        setScanView('closed');
        setScanError(null);
        return;
      }
      if (scanView === 'menu') {
        if (id === '1') {
          cameraInputRef.current?.click();
          return;
        }
        if (id === '2') {
          uploadInputRef.current?.click();
          return;
        }
        if (id === '3') {
          setScanView('config');
          return;
        }
      }
      setScanView('closed');
      setScanError(null);
    }
    dispatch({ type: 'key', id });
  };

  const isBaseN = state.mode === 'BASE-N';
  const isCmplx = state.mode === 'CMPLX';
  const isShift = state.shift;
  const isAlpha = state.alpha;

  return (
    <div
      className={`calcios-casing theme-${bodyTheme}`}
      dir="ltr"
      data-testid="calculator-hardware"
      data-theme={bodyTheme}
    >
      <div className="calcios-inner-rim">
        {/* Clean Minimalist Top Header: CALCIOS Wordmark + Camera Scan Lens + 3 Color Dots */}
        <header className="calcios-header">
          <div className="calcios-header-row">
            <span className="calcios-logo">CALCIOS</span>
            <div className="calcios-header-actions">
              <button
                type="button"
                className={scanView !== 'closed' ? 'calcios-scan-lens active' : 'calcios-scan-lens'}
                data-testid="scan-math-btn"
                aria-label="Scan math problem from camera or image"
                title="Scan math problem from camera or image (or Ctrl+V paste)"
                onClick={() => {
                  setScanError(null);
                  setVisionCfg(loadVisionConfig());
                  setScanView((v) => (v === 'closed' ? 'menu' : 'closed'));
                }}
              >
                <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                  <path
                    d="M5.4 2.5L6.3 1.3h3.4l.9 1.2H13c1.1 0 2 .9 2 2v7.2c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V4.5c0-1.1.9-2 2-2h2.4zm2.6 2.3a3.3 3.3 0 100 6.6 3.3 3.3 0 000-6.6zm0 1.4a1.9 1.9 0 110 3.8 1.9 1.9 0 010-3.8z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="calcios-hidden-file"
                data-testid="scan-camera-input"
                aria-label="Capture math problem with camera"
                onChange={handleFileChange}
              />
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="calcios-hidden-file"
                data-testid="scan-upload-input"
                aria-label="Upload math problem image"
                onChange={handleFileChange}
              />
              <div className="calcios-theme-dots" role="group" aria-label="Calculator color editions">
                <button
                  type="button"
                  className={bodyTheme === 'black' ? 'theme-dot dot-black active' : 'theme-dot dot-black'}
                  data-testid="theme-black"
                  aria-label="Black edition"
                  aria-pressed={bodyTheme === 'black'}
                  onClick={() => selectTheme('black')}
                />
                <button
                  type="button"
                  className={bodyTheme === 'pink' ? 'theme-dot dot-pink active' : 'theme-dot dot-pink'}
                  data-testid="theme-pink"
                  aria-label="Pink edition"
                  aria-pressed={bodyTheme === 'pink'}
                  onClick={() => selectTheme('pink')}
                />
                <button
                  type="button"
                  className={bodyTheme === 'blue' ? 'theme-dot dot-blue active' : 'theme-dot dot-blue'}
                  data-testid="theme-blue"
                  aria-label="Ice Blue edition"
                  aria-pressed={bodyTheme === 'blue'}
                  onClick={() => selectTheme('blue')}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Natural Textbook 2D Dot-Matrix LCD + Inside-LCD Scan Overlay */}
        <div className="calcios-lcd-wrap">
          <LcdScreen state={state} />
          {scanView !== 'closed' && (
            <div className="calcios-scan-lcd" data-testid="scan-lcd-overlay" role="dialog" aria-label="Math Vision Scanner">
              {scanView === 'scanning' && (
                <div className="scan-lcd-center">
                  <div className="scan-lcd-title">SCANNING MATH...</div>
                  <div className="scan-lcd-sub">{visionCfg.model}</div>
                </div>
              )}

              {scanView === 'menu' && (
                <div className="scan-lcd-menu">
                  <div className="scan-lcd-hdr">
                    <span>SCAN MATH</span>
                    <button
                      type="button"
                      className="scan-lcd-close"
                      aria-label="Close scanner"
                      onClick={() => setScanView('closed')}
                    >
                      [AC]
                    </button>
                  </div>
                  {scanError && <div className="scan-lcd-err" data-testid="scan-lcd-error">{scanError}</div>}
                  <div className="scan-lcd-actions">
                    <button
                      type="button"
                      className="scan-lcd-item"
                      data-testid="scan-trigger-camera"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      1:Camera Photo
                    </button>
                    <button
                      type="button"
                      className="scan-lcd-item"
                      data-testid="scan-trigger-upload"
                      onClick={() => uploadInputRef.current?.click()}
                    >
                      2:Upload Image
                    </button>
                    <button
                      type="button"
                      className="scan-lcd-item"
                      data-testid="scan-trigger-config"
                      onClick={() => setScanView('config')}
                    >
                      3:Vision API
                    </button>
                  </div>
                  <div className="scan-lcd-hint">Tip: Paste screenshot with Ctrl+V</div>
                </div>
              )}

              {scanView === 'config' && (
                <form className="scan-lcd-form" onSubmit={handleSaveConfig}>
                  <div className="scan-lcd-hdr">
                    <span>VISION API</span>
                    <button
                      type="button"
                      className="scan-lcd-close"
                      aria-label="Back to scan menu"
                      onClick={() => setScanView('menu')}
                    >
                      [BACK]
                    </button>
                  </div>
                  {scanError && <div className="scan-lcd-err" data-testid="scan-lcd-error">{scanError}</div>}
                  <input
                    type="text"
                    className="scan-lcd-input"
                    data-testid="scan-api-url"
                    aria-label="Vision API URL"
                    placeholder="API URL"
                    value={visionCfg.apiUrl}
                    onChange={(e) => setVisionCfg((c) => ({ ...c, apiUrl: e.target.value }))}
                  />
                  <input
                    type="text"
                    className="scan-lcd-input"
                    data-testid="scan-api-model"
                    aria-label="Vision Model ID"
                    placeholder="Model (qwen/qwen3.8-27b)"
                    value={visionCfg.model}
                    onChange={(e) => setVisionCfg((c) => ({ ...c, model: e.target.value }))}
                  />
                  <div className="scan-lcd-row">
                    <input
                      type="password"
                      className="scan-lcd-input"
                      data-testid="scan-api-key"
                      aria-label="Groq API Key"
                      placeholder="Groq API Key (gsk_...)"
                      value={visionCfg.apiKey}
                      onChange={(e) => setVisionCfg((c) => ({ ...c, apiKey: e.target.value }))}
                    />
                    <button type="submit" className="scan-lcd-save" data-testid="scan-save-config">
                      SAVE
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Upper Control Row + Central Sculpted 4-Way D-Pad */}
        <div className="calcios-upper-deck">
          {/* Left Pair: SHIFT & ALPHA aligned horizontally inside subtle recessed contour */}
          <div className="calcios-round-side">
            <div className="calcios-round-labels">
              <span className={isShift ? 'round-lbl round-lbl-shift active' : 'round-lbl round-lbl-shift'}>
                SHIFT
              </span>
              <span className={isAlpha ? 'round-lbl round-lbl-alpha active' : 'round-lbl round-lbl-alpha'}>
                ALPHA
              </span>
            </div>
            <div className="calcios-round-groove">
              <div className="calcios-round-well">
                <button
                  type="button"
                  className={isShift ? 'calcios-metal-btn active' : 'calcios-metal-btn'}
                  data-key-id="shift"
                  aria-label="SHIFT secondary functions"
                  aria-pressed={isShift}
                  onClick={() => handlePress('shift')}
                />
              </div>
              <div className="calcios-round-well">
                <button
                  type="button"
                  className={isAlpha ? 'calcios-metal-btn active' : 'calcios-metal-btn'}
                  data-key-id="alpha"
                  aria-label="ALPHA variables and symbols"
                  aria-pressed={isAlpha}
                  onClick={() => handlePress('alpha')}
                />
              </div>
            </div>
          </div>

          {/* Center 4-Way Replay Pad */}
          <div className="calcios-dpad-zone">
            <div className="calcios-dpad-ring" role="group" aria-label="Directional navigation pad">
              <button
                type="button"
                className="dpad-lobe dpad-up"
                data-key-id="up"
                aria-label="Up"
                onClick={() => handlePress('up')}
              >
                <span className="dpad-arrow">▲</span>
              </button>
              <button
                type="button"
                className="dpad-lobe dpad-left"
                data-key-id="left"
                aria-label="Left"
                onClick={() => handlePress('left')}
              >
                <span className="dpad-arrow">◀</span>
              </button>
              <div className="dpad-center-knurl" aria-hidden="true" />
              <button
                type="button"
                className="dpad-lobe dpad-right"
                data-key-id="right"
                aria-label="Right"
                onClick={() => handlePress('right')}
              >
                <span className="dpad-arrow">▶</span>
              </button>
              <button
                type="button"
                className="dpad-lobe dpad-down"
                data-key-id="down"
                data-key-down="true"
                aria-label="Down"
                onClick={() => handlePress('down')}
              >
                <span className="dpad-arrow">▼</span>
              </button>
            </div>
          </div>

          {/* Right Pair: MODE/SETUP & ON aligned horizontally inside subtle recessed contour */}
          <div className="calcios-round-side">
            <div className="calcios-round-labels">
              <span className="round-lbl-mode-group">
                <span className="round-lbl round-lbl-mode">MODE</span>
                <span className="round-lbl round-lbl-setup">SETUP</span>
              </span>
              <span className="round-lbl round-lbl-on">ON</span>
            </div>
            <div className="calcios-round-groove">
              <div className="calcios-round-well">
                <button
                  type="button"
                  className="calcios-metal-btn"
                  data-key-id="mode"
                  aria-label="MODE or SETUP"
                  onClick={() => handlePress('mode')}
                />
              </div>
              <div className="calcios-round-well">
                <button
                  type="button"
                  className="calcios-metal-btn"
                  data-key-id="on"
                  aria-label="ON power"
                  onClick={() => handlePress('on')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Scientific 6-Column Block */}
        <section className="calcios-sci-section" aria-label="Scientific functions">
          {/* Row 1 flanking lower D-Pad */}
          <div className="calcios-sci-row calcios-sci-row-flank">
            {SCIENTIFIC_ROW_1.map((spec) => (
              <CalcKey
                key={spec.id}
                spec={spec}
                isBaseN={isBaseN}
                isCmplx={isCmplx}
                activeBase={state.baseN.base}
                onPress={handlePress}
              />
            ))}
          </div>

          {/* Rows 2 to 4 */}
          {SCIENTIFIC_ROWS_2_TO_4.map((row, rIdx) => (
            <div key={rIdx} className="calcios-sci-row">
              {row.map((spec) => (
                <CalcKey
                  key={spec.id}
                  spec={spec}
                  isBaseN={isBaseN}
                  isCmplx={isCmplx}
                  activeBase={state.baseN.base}
                  onPress={handlePress}
                />
              ))}
            </div>
          ))}
        </section>

        {/* Main 5-Column Numeric & Operator Block */}
        <section className="calcios-num-section" aria-label="Numeric and arithmetic keys">
          {LOWER_KEYPAD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="calcios-num-row">
              {row.map((spec) => (
                <CalcKey
                  key={spec.id}
                  spec={spec}
                  isBaseN={isBaseN}
                  isCmplx={isCmplx}
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
