import React from 'react';
import { CONSTANT_BY_TOKEN, CONVERSION_BY_TOKEN } from '../core/constants';
import type { DisplayValue } from '../core/format';

interface ArgSpan {
  start: number;
  end: number;
}

function parseCallSpans(
  source: string,
  openParenIndex: number,
  expectedArgs: number,
): { args: ArgSpan[]; afterIndex: number } | null {
  if (source[openParenIndex] !== '(') return null;
  const args: ArgSpan[] = [];
  let depth = 0;
  let segStart = openParenIndex + 1;
  for (let i = openParenIndex + 1; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      if (depth === 0) {
        args.push({ start: segStart, end: i });
        if (args.length === expectedArgs) {
          return { args, afterIndex: i + 1 };
        }
        return null;
      }
      depth--;
    } else if (ch === ',' && depth === 0) {
      args.push({ start: segStart, end: i });
      segStart = i + 1;
    }
  }
  return null;
}

const DISPLAY_FUNC_LABELS: Record<string, string> = {
  asin: 'sin⁻¹',
  acos: 'cos⁻¹',
  atan: 'tan⁻¹',
  asinh: 'sinh⁻¹',
  acosh: 'cosh⁻¹',
  atanh: 'tanh⁻¹',
  RanInt: 'RanInt#',
};

function Caret({ overwrite }: { overwrite: boolean }) {
  return (
    <span
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
    return (
      <span className="math-seq">
        {inRange(start) && <Caret overwrite={overwrite} />}
        {showEmptyPlaceholder && <span className="math-box-placeholder">□</span>}
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

    // Scientific constant token const01..40
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

    // Unit conversion postfix token ▸conv01..40
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

    if (!lineMode) {
      // 1. Mixed fraction: mfrac(w, n, d)
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

      // 2. Fraction: frac(n, d)
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

      // 3. Roots: sqrt(x), cbrt(x), root(idx, x)
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
              <span className="math-sqrt-glyph">√</span>
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
              <span className="math-sqrt-glyph">√</span>
              <span className="math-sqrt-body">
                <MathRange source={source} start={rad.start} end={rad.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              </span>
            </span>,
          );
          pos = parsed.afterIndex;
          continue;
        }
      }

      // 4. General base logarithm: logb(base, val)
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

      // 5. Absolute value: abs(val)
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

      // 6. Calculus templates: deriv(f, x0), integ(f, a, b), sigma(f, a, b), prod(f, a, b)
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

      if (rest.startsWith('integ(') || rest.startsWith('sigma(') || rest.startsWith('prod(')) {
        const kind = rest.startsWith('integ(') ? 'integ' : rest.startsWith('sigma(') ? 'sigma' : 'prod';
        const prefixLen = kind === 'prod' ? 4 : 5;
        const parsed = parseCallSpans(source, pos + prefixLen, 3);
        if (parsed && parsed.afterIndex <= end) {
          const [body, lower, upper] = parsed.args;
          const symbol = kind === 'integ' ? '∫' : kind === 'sigma' ? '∑' : '∏';
          nodes.push(
            <span key={`k-${keyCounter++}`} className="math-bigop">
              <span className="math-bigop-limits">
                <span className="math-limit-top">
                  <MathRange source={source} start={upper.start} end={upper.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
                </span>
                <span className="math-bigop-sym">{symbol}</span>
                <span className="math-limit-bot">
                  {kind !== 'integ' && 'x='}
                  <MathRange source={source} start={lower.start} end={lower.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
                </span>
              </span>
              <span>(</span>
              <MathRange source={source} start={body.start} end={body.end} cursor={cursor} overwrite={overwrite} lineMode={false} showEmptyPlaceholder />
              <span>){kind === 'integ' ? 'dx' : ''}</span>
            </span>,
          );
          pos = parsed.afterIndex;
          continue;
        }
      }

      // 7. Superscript powers: ^(exp), ^2, ^3, ^(-1)
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

    // Friendly function labels like asin( -> sin⁻¹(
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
  return (
    <div className="lcd-expr-inner" dir="ltr">
      <MathRange
        source={expression}
        start={0}
        end={expression.length}
        cursor={cursor}
        overwrite={overwrite}
        lineMode={lineMode}
      />
    </div>
  );
}

function renderFormattedText(text: string): React.ReactNode {
  const sciMatch = text.match(/^(.*?)×10\^(-?\d+)$/);
  if (sciMatch) {
    return (
      <span>
        {sciMatch[1].replace(/^-/, '−')}
        <span className="lcd-ten-pow">×10</span>
        <sup className="lcd-exp">{sciMatch[2].replace(/^-/, '−')}</sup>
      </span>
    );
  }
  return text.replace(/^-/, '−');
}

export function NaturalResult({
  display,
  lineMode = false,
}: {
  display: DisplayValue;
  lineMode?: boolean;
}): React.ReactElement {
  if (display.type === 'pair') {
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

  if (display.type === 'mixed-fraction') {
    if (lineMode) {
      return (
        <div className="lcd-result-text" dir="ltr">
          {display.sign}{display.whole}⌟{display.numerator}⌟{display.denominator}
        </div>
      );
    }
    return (
      <div className="lcd-result-frac" dir="ltr">
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
          {display.sign}{display.numerator}⌟{display.denominator}
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
      </div>
    );
  }

  return (
    <div className="lcd-result-text" dir="ltr">
      {renderFormattedText(display.text)}
    </div>
  );
}
