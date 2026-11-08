import React, { useEffect, useRef } from 'react';
import { CONSTANT_BY_TOKEN, CONVERSION_BY_TOKEN } from '../core/constants';
import { STAT_TOKEN_LABELS } from '../core/expression';
import type { DisplayValue, IneqSegmentDisplay } from '../core/format';
import { normalizeMathCursor, parseCallSpans } from '../core/mathAst';

const DISPLAY_FUNC_LABELS: Record<string, string> = {
  asin: 'sin⁻¹',
  acos: 'cos⁻¹',
  atan: 'tan⁻¹',
  asinh: 'sinh⁻¹',
  acosh: 'cosh⁻¹',
  atanh: 'tanh⁻¹',
  RanInt: 'RanInt#',
  StatP: 'P',
  StatQ: 'Q',
  StatR: 'R',
};

const STAT_KEYS_SORTED = Object.keys(STAT_TOKEN_LABELS).sort((a, b) => b.length - a.length);

function RadicalSign(): React.ReactElement {
  return (
    <span className="math-sqrt-glyph">
      <span className="lcd-sr-text">√</span>
      <svg
        className="math-sqrt-svg"
        viewBox="0 0 12 22"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          points="0.8,12.5 3.0,10.8 5.6,20.2 11.2,0.9 12,0.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="square"
          strokeLinejoin="miter"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}

function Caret({ overwrite, box = false }: { overwrite: boolean; box?: boolean }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    const scroller = el?.closest('.lcd-expr-area') as HTMLElement | null;
    if (!el || !scroller) return;
    const cRect = el.getBoundingClientRect();
    const sRect = scroller.getBoundingClientRect();
    if (sRect.width > 0) {
      if (cRect.right > sRect.right - 8) {
        scroller.scrollLeft += cRect.right - (sRect.right - 8);
      } else if (cRect.left < sRect.left + 8) {
        scroller.scrollLeft -= (sRect.left + 8) - cRect.left;
      }
    }
    if (sRect.height > 0) {
      if (cRect.bottom > sRect.bottom - 4) {
        scroller.scrollTop += cRect.bottom - (sRect.bottom - 4);
      } else if (cRect.top < sRect.top + 4) {
        scroller.scrollTop -= (sRect.top + 4) - cRect.top;
      }
    }
  });
  if (box) {
    return (
      <span
        ref={ref}
        className={overwrite ? 'math-box-active math-box-overwrite' : 'math-box-active'}
        data-testid="lcd-caret"
        aria-hidden="true"
      >
        <span className="lcd-sr-text">■</span>
      </span>
    );
  }
  return (
    <span
      ref={ref}
      className={overwrite ? 'lcd-caret lcd-caret-overwrite' : 'lcd-caret'}
      data-testid="lcd-caret"
      aria-hidden="true"
    />
  );
}

interface RangeProps {
  source: string;
  start: number;
  end: number;
  cursor: number | null;
  overwrite: boolean;
  lineMode: boolean;
  showEmptyPlaceholder?: boolean;
}

function MathRange({
  source,
  start,
  end,
  cursor,
  overwrite,
  lineMode,
  showEmptyPlaceholder = false,
}: RangeProps): React.ReactElement {
  const inRange = (idx: number) => cursor !== null && cursor === idx;

  if (start === end) {
    if (showEmptyPlaceholder && inRange(start)) {
      return (
        <span className="math-seq">
          <Caret overwrite={overwrite} box />
        </span>
      );
    }
    return (
      <span className="math-seq">
        {inRange(start) && <Caret overwrite={overwrite} />}
        {showEmptyPlaceholder && (
          <span className="math-box-placeholder">
            <span className="lcd-sr-text">□</span>
          </span>
        )}
      </span>
    );
  }

  const nodes: React.ReactNode[] = [];
  let pos = start;
  let keyCounter = 0;

  while (pos < end) {
    if (inRange(pos)) {
      nodes.push(<Caret key={`c-${pos}`} overwrite={overwrite} />);
    }

    const rest = source.slice(pos, end);

    const constMatch = rest.match(/^const(?:0[1-9]|[1-3]\d|40)/);
    if (constMatch) {
      const len = constMatch[0].length;
      const meta = CONSTANT_BY_TOKEN.get(constMatch[0]);
      nodes.push(
        <span key={`k-${keyCounter++}`} className="math-const">
          {meta ? meta.symbol : constMatch[0]}
        </span>,
      );
      if (cursor !== null && cursor > pos && cursor < pos + len) {
        nodes.push(<Caret key={`cm-${pos}`} overwrite={overwrite} />);
      }
      pos += len;
      continue;
    }

    const convMatch = rest.match(/^▸conv(?:0[1-9]|[1-3]\d|40)/);
    if (convMatch) {
      const len = convMatch[0].length;
      const meta = CONVERSION_BY_TOKEN.get(convMatch[0]);
      nodes.push(
        <span key={`k-${keyCounter++}`} className="math-conv">
          {meta ? meta.label : convMatch[0]}
        </span>,
      );
      if (cursor !== null && cursor > pos && cursor < pos + len) {
        nodes.push(<Caret key={`cvm-${pos}`} overwrite={overwrite} />);
      }
      pos += len;
      continue;
    }

    if (rest.startsWith('▸xhat2')) {
      nodes.push(<span key={`k-${keyCounter++}`} className="math-const">x̂₂</span>);
      pos += 6;
      continue;
    }

    if (rest.startsWith('▸yhat') || rest.startsWith('▸xhat')) {
      const lbl = rest.startsWith('▸yhat') ? 'ŷ' : 'x̂';
      nodes.push(<span key={`k-${keyCounter++}`} className="math-const">{lbl}</span>);
      pos += 5;
      continue;
    }

    if (rest.startsWith('▸t')) {
      nodes.push(<span key={`k-${keyCounter++}`} className="math-const">▸t</span>);
      pos += 2;
      continue;
    }

    if (rest.startsWith('▸Simp')) {
      nodes.push(<span key={`k-${keyCounter++}`} className="math-const">▸Simp</span>);
      pos += 5;
      continue;
    }

    if (rest.startsWith('÷R')) {
      nodes.push(<span key={`k-${keyCounter++}`} className="math-const">÷R</span>);
      pos += 2;
      continue;
    }

    const statKey = STAT_KEYS_SORTED.find((sk) => rest.startsWith(sk));
    if (statKey) {
      nodes.push(<span key={`k-${keyCounter++}`} className="math-const">{STAT_TOKEN_LABELS[statKey]}</span>);
      pos += statKey.length;
      continue;
    }

    if (!lineMode) {
      // Recurring decimal vinculum overbar: r(3) -> 3̅
      if (rest.startsWith('r(') && !(pos > start && /[a-zA-Z]/.test(source[pos - 1]))) {
        const parsed = parseCallSpans(source, pos + 1, 1);
        if (parsed && parsed.afterIndex <= end) {
          const [rep] = parsed.args;
          const strayCursor =
            cursor !== null && cursor > pos && cursor < parsed.afterIndex && !(cursor >= rep.start && cursor <= rep.end);
          nodes.push(
            <span key={`k-${keyCounter++}`} className="math-overbar">
              {strayCursor && <Caret overwrite={overwrite} />}
              <MathRange
                source={source}
                start={rep.start}
                end={rep.end}
                cursor={cursor}
                overwrite={overwrite}
                lineMode={false}
                showEmptyPlaceholder
              />
            </span>,
          );
          pos = parsed.afterIndex;
          continue;
        }
      }

      if (rest.startsWith('mfrac(')) {
        const parsed = parseCallSpans(source, pos + 5, 3);
        if (parsed && parsed.afterIndex <= end) {
          const [w, n, d] = parsed.args;
          const strayCursor =
            cursor !== null &&
            cursor > pos &&
            cursor < parsed.afterIndex &&
            !(cursor >= w.start && cursor <= w.end) &&
            !(cursor >= n.start && cursor <= n.end) &&
            !(cursor >= d.start && cursor <= d.end);
          nodes.push(
            <span key={`k-${keyCounter++}`} className="math-mfrac">
              {strayCursor && <Caret overwrite={overwrite} />}
              <span className="math-mfrac-whole">
                <MathRange source={source} start={w.start} end={w.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              </span>
              <span className="math-frac">
                <span className="math-frac-num">
                  <MathRange source={source} start={n.start} end={n.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
                </span>
                <span className="math-frac-bar" />
                <span className="math-frac-den">
                  <MathRange source={source} start={d.start} end={d.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
                </span>
              </span>
            </span>,
          );
          pos = parsed.afterIndex;
          continue;
        }
      }

      if (rest.startsWith('frac(')) {
        const parsed = parseCallSpans(source, pos + 4, 2);
        if (parsed && parsed.afterIndex <= end) {
          const [n, d] = parsed.args;
          const strayCursor =
            cursor !== null &&
            cursor > pos &&
            cursor < parsed.afterIndex &&
            !(cursor >= n.start && cursor <= n.end) &&
            !(cursor >= d.start && cursor <= d.end);
          nodes.push(
            <span key={`k-${keyCounter++}`} className="math-frac">
              {strayCursor && <Caret overwrite={overwrite} />}
              <span className="math-frac-num">
                <MathRange source={source} start={n.start} end={n.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              </span>
              <span className="math-frac-bar" />
              <span className="math-frac-den">
                <MathRange source={source} start={d.start} end={d.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              </span>
            </span>,
          );
          pos = parsed.afterIndex;
          continue;
        }
      }

      if (rest.startsWith('sqrt(') || rest.startsWith('cbrt(')) {
        const isCube = rest.startsWith('cbrt(');
        const parsed = parseCallSpans(source, pos + 4, 1);
        if (parsed && parsed.afterIndex <= end) {
          const [rad] = parsed.args;
          const strayCursor =
            cursor !== null && cursor > pos && cursor < parsed.afterIndex && !(cursor >= rad.start && cursor <= rad.end);
          nodes.push(
            <span key={`k-${keyCounter++}`} className="math-sqrt">
              {strayCursor && <Caret overwrite={overwrite} />}
              {isCube && <sup className="math-root-idx">3</sup>}
              <RadicalSign />
              <span className="math-sqrt-body">
                <MathRange source={source} start={rad.start} end={rad.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              </span>
            </span>,
          );
          pos = parsed.afterIndex;
          continue;
        }
      }

      if (rest.startsWith('root(')) {
        const parsed = parseCallSpans(source, pos + 4, 2);
        if (parsed && parsed.afterIndex <= end) {
          const [idx, rad] = parsed.args;
          const strayCursor =
            cursor !== null &&
            cursor > pos &&
            cursor < parsed.afterIndex &&
            !(cursor >= idx.start && cursor <= idx.end) &&
            !(cursor >= rad.start && cursor <= rad.end);
          nodes.push(
            <span key={`k-${keyCounter++}`} className="math-sqrt">
              {strayCursor && <Caret overwrite={overwrite} />}
              <sup className="math-root-idx">
                <MathRange source={source} start={idx.start} end={idx.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              </sup>
              <RadicalSign />
              <span className="math-sqrt-body">
                <MathRange source={source} start={rad.start} end={rad.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              </span>
            </span>,
          );
          pos = parsed.afterIndex;
          continue;
        }
      }

      if (rest.startsWith('logb(')) {
        const parsed = parseCallSpans(source, pos + 4, 2);
        if (parsed && parsed.afterIndex <= end) {
          const [base, val] = parsed.args;
          nodes.push(
            <span key={`k-${keyCounter++}`} className="math-logb">
              <span>log</span>
              <sub className="math-sub">
                <MathRange source={source} start={base.start} end={base.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              </sub>
              <span>(</span>
              <MathRange source={source} start={val.start} end={val.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              <span>)</span>
            </span>,
          );
          pos = parsed.afterIndex;
          continue;
        }
      }

      if (rest.startsWith('abs(')) {
        const parsed = parseCallSpans(source, pos + 3, 1);
        if (parsed && parsed.afterIndex <= end) {
          const [val] = parsed.args;
          nodes.push(
            <span key={`k-${keyCounter++}`} className="math-abs">
              <span className="math-abs-bar">|</span>
              <MathRange source={source} start={val.start} end={val.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              <span className="math-abs-bar">|</span>
            </span>,
          );
          pos = parsed.afterIndex;
          continue;
        }
      }

      if (rest.startsWith('deriv(')) {
        const parsed = parseCallSpans(source, pos + 5, 2);
        if (parsed && parsed.afterIndex <= end) {
          const [body, x0] = parsed.args;
          nodes.push(
            <span key={`k-${keyCounter++}`} className="math-deriv">
              <span className="math-frac math-frac-mini">
                <span className="math-frac-num">d</span>
                <span className="math-frac-bar" />
                <span className="math-frac-den">dx</span>
              </span>
              <span>(</span>
              <MathRange source={source} start={body.start} end={body.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              <span>)</span>
              <sub className="math-sub">
                x=<MathRange source={source} start={x0.start} end={x0.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              </sub>
            </span>,
          );
          pos = parsed.afterIndex;
          continue;
        }
      }

      if (rest.startsWith('integ(')) {
        const parsed = parseCallSpans(source, pos + 5, 3);
        if (parsed && parsed.afterIndex <= end) {
          const [body, lower, upper] = parsed.args;
          nodes.push(
            <span key={`k-${keyCounter++}`} className="math-integ">
              <span className="math-integ-op">
                <span className="math-integ-glyph">
                  <span className="lcd-sr-text">∫</span>
                  <svg
                    className="math-integ-svg"
                    viewBox="0 0 6 28"
                    preserveAspectRatio="none"
                    shapeRendering="crispEdges"
                    aria-hidden="true"
                  >
                    <rect x="3" y="0" width="2" height="1.6" fill="currentColor" />
                    <rect x="5" y="1.4" width="1" height="1.8" fill="currentColor" />
                    <rect x="2" y="1.4" width="1.2" height="25.2" fill="currentColor" />
                    <rect x="0" y="24.8" width="1" height="1.8" fill="currentColor" />
                    <rect x="1" y="26.4" width="2" height="1.6" fill="currentColor" />
                  </svg>
                </span>
                <span className="math-integ-limits">
                  <span className="math-limit-top">
                    <MathRange source={source} start={upper.start} end={upper.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
                  </span>
                  <span className="math-limit-bot">
                    <MathRange source={source} start={lower.start} end={lower.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
                  </span>
                </span>
              </span>
              <span className="math-integ-body">
                <MathRange source={source} start={body.start} end={body.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
                <span className="math-integ-dx">dx</span>
              </span>
            </span>,
          );
          pos = parsed.afterIndex;
          continue;
        }
      }

      if (rest.startsWith('sigma(') || rest.startsWith('prod(')) {
        const kind = rest.startsWith('sigma(') ? 'sigma' : 'prod';
        const prefixLen = kind === 'prod' ? 4 : 5;
        const parsed = parseCallSpans(source, pos + prefixLen, 3);
        if (parsed && parsed.afterIndex <= end) {
          const [body, lower, upper] = parsed.args;
          const symbol = kind === 'sigma' ? '∑' : '∏';
          nodes.push(
            <span key={`k-${keyCounter++}`} className="math-bigop">
              <span className="math-bigop-limits">
                <span className="math-limit-top">
                  <MathRange source={source} start={upper.start} end={upper.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
                </span>
                <span className="math-bigop-sym">{symbol}</span>
                <span className="math-limit-bot">
                  x=
                  <MathRange source={source} start={lower.start} end={lower.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
                </span>
              </span>
              <span>(</span>
              <MathRange source={source} start={body.start} end={body.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              <span>)</span>
            </span>,
          );
          pos = parsed.afterIndex;
          continue;
        }
      }

      if (rest.startsWith('^(-1)')) {
        nodes.push(
          <sup key={`k-${keyCounter++}`} className="math-sup">
            −1
          </sup>,
        );
        pos += 5;
        continue;
      }
      if (rest.startsWith('^(')) {
        const parsed = parseCallSpans(source, pos + 1, 1);
        if (parsed && parsed.afterIndex <= end) {
          const [exp] = parsed.args;
          nodes.push(
            <sup key={`k-${keyCounter++}`} className="math-sup">
              <MathRange source={source} start={exp.start} end={exp.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
            </sup>,
          );
          pos = parsed.afterIndex;
          continue;
        }
      }
      if (rest.startsWith('^2') || rest.startsWith('^3')) {
        const digit = rest[1];
        nodes.push(
          <sup key={`k-${keyCounter++}`} className="math-sup">
            {cursor === pos + 1 && <Caret overwrite={overwrite} />}
            {digit}
          </sup>,
        );
        pos += 2;
        continue;
      }
    }

    const fnKey = Object.keys(DISPLAY_FUNC_LABELS).find((fn) => rest.startsWith(`${fn}(`));
    if (fnKey) {
      nodes.push(<span key={`k-${keyCounter++}`}>{DISPLAY_FUNC_LABELS[fnKey]}(</span>);
      if (cursor !== null && cursor > pos && cursor < pos + fnKey.length + 1) {
        nodes.push(<Caret key={`cfn-${pos}`} overwrite={overwrite} />);
      }
      pos += fnKey.length + 1;
      continue;
    }

    const ch = source[pos];
    if (ch === '⏨') {
      nodes.push(<span key={`k-${keyCounter++}`} className="math-sci-ten">×10</span>);
      pos++;
      continue;
    }
    const displayChar = ch === '-' ? '−' : ch === '*' ? '×' : ch === '/' ? '÷' : ch;
    nodes.push(<span key={`k-${keyCounter++}`}>{displayChar}</span>);
    pos++;
  }

  if (inRange(end)) {
    nodes.push(<Caret key={`c-end-${end}`} overwrite={overwrite} />);
  }

  return <span className="math-seq">{nodes}</span>;
}

export interface NaturalExpressionProps {
  expression: string;
  cursor: number | null;
  overwrite?: boolean;
  lineMode?: boolean;
}

export function NaturalExpression({
  expression,
  cursor,
  overwrite = false,
  lineMode = false,
}: NaturalExpressionProps): React.ReactElement {
  const safeCursor = cursor === null ? null : normalizeMathCursor(expression, cursor, lineMode);
  return (
    <div className="lcd-expr-inner" dir="ltr">
      <MathRange
        source={expression}
        start={0}
        end={expression.length}
        cursor={safeCursor}
        overwrite={overwrite}
        lineMode={lineMode}
      />
    </div>
  );
}

function renderFormattedText(text: string): React.ReactNode {
  const normalized = text.replace(/^-/, '−');
  if (!normalized.includes('×10^')) return normalized;
  const parts: React.ReactNode[] = [];
  const re = /×10\^(-?\d+)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let k = 0;
  while ((match = re.exec(normalized)) !== null) {
    if (match.index > lastIdx) {
      parts.push(normalized.slice(lastIdx, match.index));
    }
    parts.push(
      <React.Fragment key={`sci-${k++}`}>
        <span className="lcd-ten-pow">×10</span>
        <sup className="lcd-exp">{match[1].replace(/^-/, '−')}</sup>
      </React.Fragment>,
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < normalized.length) {
    parts.push(normalized.slice(lastIdx));
  }
  return <span>{parts}</span>;
}

function SurdTop({ a, b, rad }: { a: string; b: string; rad: string }): React.ReactElement {
  const aBig = BigInt(a);
  const bBig = BigInt(b);
  const absB = bBig < 0n ? -bBig : bBig;
  const coef = absB === 1n ? '' : absB.toString();
  const radNode = (
    <span className="math-sqrt">
      <RadicalSign />
      <span className="math-sqrt-body">{rad}</span>
    </span>
  );

  if (aBig === 0n) {
    return (
      <span className="math-seq">
        {bBig < 0n ? '−' : ''}
        {coef}
        {radNode}
      </span>
    );
  }

  return (
    <span className="math-seq">
      {aBig < 0n ? `−${(-aBig).toString()}` : aBig.toString()}
      {bBig < 0n ? '−' : '+'}
      {coef}
      {radNode}
    </span>
  );
}

function MultiSurdTop({ terms }: { terms: Array<{ coef: string; rad: string }> }): React.ReactElement {
  return (
    <span className="math-seq">
      {terms.map((t, idx) => {
        const cBig = BigInt(t.coef);
        const rBig = BigInt(t.rad);
        const neg = cBig < 0n;
        const absC = neg ? -cBig : cBig;
        const sign = idx === 0 ? (neg ? '−' : '') : neg ? '−' : '+';
        if (rBig === 1n) {
          return (
            <span key={idx}>
              {sign}
              {absC.toString()}
            </span>
          );
        }
        const coefStr = absC === 1n ? '' : absC.toString();
        return (
          <span key={idx} className="math-seq">
            {sign}
            {coefStr}
            <span className="math-sqrt">
              <RadicalSign />
              <span className="math-sqrt-body">{rBig.toString()}</span>
            </span>
          </span>
        );
      })}
    </span>
  );
}

function InlineDisplayAtom({ display, lineMode }: { display: DisplayValue; lineMode: boolean }): React.ReactElement {
  if (display.type === 'symbolic-pi') {
    if (display.denominator === '1') {
      const coef = display.numerator === '1' ? '' : display.numerator;
      return <span>{display.sign}{coef}π</span>;
    }
    if (lineMode) return <span>{display.sign}{display.numerator}⌟{display.denominator}π</span>;
    return (
      <span className="math-seq">
        {display.sign && <span>{display.sign}</span>}
        <span className="math-frac math-frac-mini-res">
          <span className="math-frac-num">{display.numerator}</span>
          <span className="math-frac-bar" />
          <span className="math-frac-den">{display.denominator}</span>
        </span>
        <span>π</span>
      </span>
    );
  }
  if (display.type === 'fraction') {
    if (lineMode) return <span>{display.sign}{display.numerator}⌟{display.denominator}</span>;
    return (
      <span className="math-seq">
        {display.sign && <span>{display.sign}</span>}
        <span className="math-frac math-frac-mini-res">
          <span className="math-frac-num">{display.numerator}</span>
          <span className="math-frac-bar" />
          <span className="math-frac-den">{display.denominator}</span>
        </span>
      </span>
    );
  }
  if (display.type === 'symbolic-surd') {
    if (display.d === '1') return <SurdTop a={display.a} b={display.b} rad={display.rad} />;
    return (
      <span className="math-frac math-frac-mini-res">
        <span className="math-frac-num"><SurdTop a={display.a} b={display.b} rad={display.rad} /></span>
        <span className="math-frac-bar" />
        <span className="math-frac-den">{display.d}</span>
      </span>
    );
  }
  if (display.type === 'symbolic-multisurd') {
    if (display.d === '1') return <MultiSurdTop terms={display.terms} />;
    return (
      <span className="math-frac math-frac-mini-res">
        <span className="math-frac-num"><MultiSurdTop terms={display.terms} /></span>
        <span className="math-frac-bar" />
        <span className="math-frac-den">{display.d}</span>
      </span>
    );
  }
  if (display.type === 'mixed-fraction') {
    if (lineMode) return <span>{display.sign}{display.whole}⌟{display.numerator}⌟{display.denominator}</span>;
    return (
      <span className="math-mfrac">
        <span className="math-mfrac-whole">{display.sign}{display.whole}</span>
        <span className="math-frac math-frac-mini-res">
          <span className="math-frac-num">{display.numerator}</span>
          <span className="math-frac-bar" />
          <span className="math-frac-den">{display.denominator}</span>
        </span>
      </span>
    );
  }
  if (display.type === 'recurring-decimal') {
    return (
      <span className="math-seq">
        {display.sign}{display.intPart}.{display.nonRepeat}
        <span className="math-overbar">{display.repeat}</span>
      </span>
    );
  }
  if (display.type === 'text') {
    return <span>{renderFormattedText(display.text)}</span>;
  }
  return <span />;
}

function renderIneqSegment(seg: IneqSegmentDisplay, idx: number, lineMode: boolean): React.ReactNode {
  if (seg.kind === 'all') return <span key={idx}>All Real Numbers</span>;
  if (seg.kind === 'none') return <span key={idx}>No Solution</span>;
  if (seg.kind === 'eq') {
    return (
      <span key={idx} className="math-seq">
        X=<InlineDisplayAtom display={seg.val} lineMode={lineMode} />
      </span>
    );
  }
  if (seg.kind === 'neq') {
    return (
      <span key={idx} className="math-seq">
        X≠<InlineDisplayAtom display={seg.val} lineMode={lineMode} />
      </span>
    );
  }
  if (seg.kind === 'left') {
    return (
      <span key={idx} className="math-seq">
        X{seg.op}<InlineDisplayAtom display={seg.upper} lineMode={lineMode} />
      </span>
    );
  }
  if (seg.kind === 'right') {
    return (
      <span key={idx} className="math-seq">
        <InlineDisplayAtom display={seg.lower} lineMode={lineMode} />{seg.op}X
      </span>
    );
  }
  return (
    <span key={idx} className="math-seq">
      <InlineDisplayAtom display={seg.lower} lineMode={lineMode} />
      {seg.op}X{seg.op}
      <InlineDisplayAtom display={seg.upper} lineMode={lineMode} />
    </span>
  );
}

export function NaturalResult({
  display,
  lineMode = false,
}: {
  display: DisplayValue;
  lineMode?: boolean;
}): React.ReactElement {
  if (display.type === 'complex-2d') {
    if (display.form === 'polar') {
      return (
        <div className="lcd-result-frac lcd-complex-2d" dir="ltr">
          {display.r && <InlineDisplayAtom display={display.r} lineMode={lineMode} />}
          <span className="lcd-phasor-sym">∠</span>
          {display.theta && <InlineDisplayAtom display={display.theta} lineMode={lineMode} />}
        </div>
      );
    }

    const imDisp = display.im;
    const isUnitIm = imDisp?.type === 'text' && imDisp.text === '1';
    const needsParens =
      (imDisp?.type === 'symbolic-surd' && imDisp.d === '1' && imDisp.a !== '0') ||
      (imDisp?.type === 'symbolic-multisurd' && imDisp.d === '1' && imDisp.terms.length > 1);

    return (
      <div className="lcd-result-frac lcd-complex-2d" dir="ltr">
        {display.re ? (
          <>
            <InlineDisplayAtom display={display.re} lineMode={lineMode} />
            <span className="lcd-cmplx-op">{display.imSign ?? '+'}</span>
          </>
        ) : (
          display.imSign === '−' && <span className="lcd-frac-sign">−</span>
        )}
        {!isUnitIm && imDisp && (
          needsParens ? (
            <span className="math-seq">
              (
              <InlineDisplayAtom display={imDisp} lineMode={lineMode} />
              )
            </span>
          ) : (
            <InlineDisplayAtom display={imDisp} lineMode={lineMode} />
          )
        )}
        <span className="lcd-imag-unit">i</span>
      </div>
    );
  }

  if (display.type === 'ineq-2d') {
    return (
      <div className="lcd-result-frac lcd-ineq-2d" dir="ltr">
        {display.segments.map((seg, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span className="lcd-ineq-sep">, </span>}
            {renderIneqSegment(seg, idx, lineMode)}
          </React.Fragment>
        ))}
      </div>
    );
  }

  if (display.type === 'pair') {
    if (display.label1 === 'Q' && display.label2 === 'R') {
      return (
        <div className="lcd-result-text" dir="ltr">
          {renderFormattedText(display.value1)}
          <span className="lcd-divr-rem">, R= {renderFormattedText(display.value2)}</span>
        </div>
      );
    }
    return (
      <div className="lcd-pair-result" dir="ltr">
        <div className="lcd-pair-row">
          <span className="lcd-pair-label">{display.label1}=</span>
          <span className="lcd-pair-val">{renderFormattedText(display.value1)}</span>
        </div>
        <div className="lcd-pair-row">
          <span className="lcd-pair-label">{display.label2}=</span>
          <span className="lcd-pair-val">{renderFormattedText(display.value2)}</span>
        </div>
      </div>
    );
  }

  if (display.type === 'recurring-decimal') {
    return (
      <div className="lcd-result-text" dir="ltr">
        {display.sign}
        {display.intPart}.{display.nonRepeat}
        <span className="math-overbar">{display.repeat}</span>
      </div>
    );
  }

  if (display.type === 'symbolic-pi') {
    if (display.denominator === '1') {
      const coef = display.numerator === '1' ? '' : display.numerator;
      return (
        <div className="lcd-result-text" dir="ltr">
          {display.sign}{coef}π
        </div>
      );
    }
    if (lineMode) {
      return (
        <div className="lcd-result-text" dir="ltr">
          {display.sign}{display.numerator}⌟{display.denominator}π
        </div>
      );
    }
    return (
      <div className="lcd-result-frac" dir="ltr">
        {display.sign && <span className="lcd-frac-sign">{display.sign}</span>}
        <span className="math-frac math-frac-result">
          <span className="math-frac-num">{display.numerator}</span>
          <span className="math-frac-bar" />
          <span className="math-frac-den">{display.denominator}</span>
        </span>
        <span className="lcd-pi-sym">π</span>
      </div>
    );
  }

  if (display.type === 'symbolic-surd') {
    if (display.d === '1') {
      return (
        <div className="lcd-result-frac" dir="ltr">
          <SurdTop a={display.a} b={display.b} rad={display.rad} />
        </div>
      );
    }
    return (
      <div className="lcd-result-frac" dir="ltr">
        <span className="math-frac math-frac-result">
          <span className="math-frac-num">
            <SurdTop a={display.a} b={display.b} rad={display.rad} />
          </span>
          <span className="math-frac-bar" />
          <span className="math-frac-den">{display.d}</span>
        </span>
      </div>
    );
  }

  if (display.type === 'symbolic-multisurd') {
    if (display.d === '1') {
      return (
        <div className="lcd-result-frac" dir="ltr">
          <MultiSurdTop terms={display.terms} />
        </div>
      );
    }
    return (
      <div className="lcd-result-frac" dir="ltr">
        <span className="math-frac math-frac-result">
          <span className="math-frac-num">
            <MultiSurdTop terms={display.terms} />
          </span>
          <span className="math-frac-bar" />
          <span className="math-frac-den">{display.d}</span>
        </span>
      </div>
    );
  }

  if (display.type === 'mixed-fraction') {
    if (lineMode) {
      return (
        <div className="lcd-result-text" dir="ltr">
          {display.simpFactor && <span className="math-simp-factor">÷{display.simpFactor} </span>}
          {display.sign}{display.whole}⌟{display.numerator}⌟{display.denominator}
        </div>
      );
    }
    return (
      <div className="lcd-result-frac" dir="ltr">
        {display.simpFactor && <span className="math-simp-factor">÷{display.simpFactor}</span>}
        {display.sign && <span className="lcd-frac-sign">{display.sign}</span>}
        <span className="lcd-mfrac-whole">{display.whole}</span>
        <span className="math-frac math-frac-result">
          <span className="math-frac-num">{display.numerator}</span>
          <span className="math-frac-bar" />
          <span className="math-frac-den">{display.denominator}</span>
        </span>
      </div>
    );
  }

  if (display.type === 'fraction') {
    if (lineMode) {
      return (
        <div className="lcd-result-text" dir="ltr">
          {display.simpFactor && <span className="math-simp-factor">÷{display.simpFactor} </span>}
          {display.sign}{display.numerator}⌟{display.denominator}
        </div>
      );
    }
    return (
      <div className="lcd-result-frac" dir="ltr">
        {display.simpFactor && <span className="math-simp-factor">÷{display.simpFactor}</span>}
        {display.sign && <span className="lcd-frac-sign">{display.sign}</span>}
        <span className="math-frac math-frac-result">
          <span className="math-frac-num">{display.numerator}</span>
          <span className="math-frac-bar" />
          <span className="math-frac-den">{display.denominator}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="lcd-result-text" dir="ltr">
      {renderFormattedText(display.text)}
    </div>
  );
}
