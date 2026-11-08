import { computeRecurringDecimal } from './symbolic';
import type { Scalar } from './value';

export type ResultFormat = 'exact' | 'decimal';
export type FractionStyle = 'improper' | 'mixed';
export type DisplayOverride = 'none' | 'dms' | 'fact' | 'eng' | 'recur';
export type DecimalMark = 'Dot' | 'Comma';

export type NumberFormatSetting =
  | { mode: 'Norm'; sub: 1 | 2 }
  | { mode: 'Fix'; digits: number }
  | { mode: 'Sci'; digits: number };

export type IneqSegmentDisplay =
  | { kind: 'all' }
  | { kind: 'none' }
  | { kind: 'eq'; val: DisplayValue }
  | { kind: 'neq'; val: DisplayValue }
  | { kind: 'left'; op: '<' | '≤'; upper: DisplayValue }
  | { kind: 'right'; op: '<' | '≤'; lower: DisplayValue }
  | { kind: 'between'; op: '<' | '≤'; lower: DisplayValue; upper: DisplayValue };

export type DisplayValue =
  | { type: 'text'; text: string }
  | { type: 'fraction'; sign: string; numerator: string; denominator: string; simpFactor?: string }
  | { type: 'mixed-fraction'; sign: string; whole: string; numerator: string; denominator: string; simpFactor?: string }
  | { type: 'symbolic-pi'; sign: string; numerator: string; denominator: string }
  | { type: 'symbolic-surd'; a: string; b: string; rad: string; d: string }
  | { type: 'symbolic-multisurd'; terms: Array<{ coef: string; rad: string }>; d: string }
  | { type: 'recurring-decimal'; sign: string; intPart: string; nonRepeat: string; repeat: string }
  | { type: 'pair'; label1: string; value1: string; label2: string; value2: string }
  | { type: 'ineq-2d'; header: string; segments: IneqSegmentDisplay[] }
  | {
      type: 'complex-2d';
      form: 'rect' | 'polar';
      re?: DisplayValue;
      im?: DisplayValue;
      imSign?: '+' | '−';
      r?: DisplayValue;
      theta?: DisplayValue;
    };

export const DEFAULT_NUMBER_FORMAT: NumberFormatSetting = { mode: 'Norm', sub: 1 };

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};

export function toSuperscript(text: string): string {
  return [...text].map((ch) => SUPERSCRIPTS[ch] ?? ch).join('');
}

function applyDecimalMark(str: string, mark: DecimalMark = 'Dot'): string {
  return mark === 'Comma' ? str.replace(/\./g, ',') : str;
}

/** Formats a linear symbolic string (useful in LineIO, CMPLX coefficients, and compact views). */
export function formatSymbolicLinear(value: Scalar): string | null {
  if (value.exact) {
    const { n, d } = value.exact;
    if (d === 1n) return n.toString().replace(/^-/, '−');
    if (n.toString().length + d.toString().length <= 10) {
      return `${n < 0n ? '−' : ''}${n < 0n ? -n : n}/${d}`;
    }
  }
  if (value.symbolic?.kind === 'pi') {
    const { n, d } = value.symbolic;
    const sign = n < 0n ? '−' : '';
    const an = n < 0n ? -n : n;
    if (d === 1n) return `${sign}${an === 1n ? '' : an.toString()}π`;
    return `${sign}${an}/${d}π`;
  }
  if (value.symbolic?.kind === 'surd') {
    const { a, b, rad, d } = value.symbolic;
    const absB = b < 0n ? -b : b;
    const bCoef = absB === 1n ? '' : absB.toString();
    const radPart = `${bCoef}√${rad}`;
    let top: string;
    if (a === 0n) {
      top = `${b < 0n ? '−' : ''}${radPart}`;
    } else {
      const aStr = a.toString().replace(/^-/, '−');
      top = `${aStr}${b < 0n ? '−' : '+'}${radPart}`;
    }
    if (d === 1n) return top;
    return a === 0n ? `${top}/${d}` : `(${top})/${d}`;
  }
  if (value.symbolic?.kind === 'multi-surd') {
    const parts = value.symbolic.terms.map((t, idx) => {
      const neg = t.coef < 0n;
      const absC = neg ? -t.coef : t.coef;
      const sign = idx === 0 ? (neg ? '−' : '') : neg ? '−' : '+';
      if (t.rad === 1n) return `${sign}${absC.toString()}`;
      const cStr = absC === 1n ? '' : absC.toString();
      return `${sign}${cStr}√${t.rad}`;
    });
    const top = parts.join('');
    if (value.symbolic.d === 1n) return top;
    return `(${top})/${value.symbolic.d}`;
  }
  return null;
}

/** A 10-digit display approximation with optional Fix/Sci/Norm and Dot/Comma formatting. */
export function formatDecimal(
  value: Scalar,
  setting: NumberFormatSetting = DEFAULT_NUMBER_FORMAT,
  decimalMark: DecimalMark = 'Dot',
): string {
  const d = value.decimal;
  if (d.isZero()) {
    if (setting.mode === 'Fix') return applyDecimalMark((0).toFixed(setting.digits), decimalMark);
    if (setting.mode === 'Sci') {
      const sig = setting.digits === 0 ? 10 : setting.digits;
      return applyDecimalMark(`${(0).toFixed(Math.max(0, sig - 1))}×10^0`, decimalMark);
    }
    return '0';
  }

  if (setting.mode === 'Sci') {
    const sig = setting.digits === 0 ? 10 : Math.max(1, Math.min(10, setting.digits));
    const rounded = d.toSignificantDigits(sig);
    const [mantissa, exponent] = rounded.toExponential(sig - 1).split('e');
    return applyDecimalMark(`${mantissa}×10^${Number(exponent)}`, decimalMark);
  }

  if (setting.mode === 'Fix') {
    const places = Math.max(0, Math.min(9, setting.digits));
    const abs = d.abs();
    if (abs.gte('1e10')) {
      const rounded = d.toSignificantDigits(10);
      const [mantissa, exponent] = rounded.toExponential(9).split('e');
      const clean = mantissa.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
      return applyDecimalMark(`${clean}×10^${Number(exponent)}`, decimalMark);
    }
    const fixed = d.toDecimalPlaces(places).toFixed(places);
    const normZero = fixed === `-0.${'0'.repeat(places)}` || fixed === '-0' ? fixed.slice(1) : fixed;
    return applyDecimalMark(normZero, decimalMark);
  }

  const rounded = d.toSignificantDigits(10);
  const absolute = rounded.abs();
  const lowThreshold = setting.sub === 2 ? '1e-9' : '1e-2';
  if (absolute.gte('1e10') || absolute.lt(lowThreshold)) {
    const [mantissa, exponent] = rounded.toExponential(9).split('e');
    const clean = mantissa.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    return applyDecimalMark(`${clean}×10^${Number(exponent)}`, decimalMark);
  }
  return applyDecimalMark(rounded.toFixed().replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''), decimalMark);
}

export function formatEngineering(value: Scalar, exponentMultipleOf3: number, decimalMark: DecimalMark = 'Dot'): string {
  const d = value.decimal;
  if (d.isZero()) return `0×10^${exponentMultipleOf3}`;
  const rounded = d.toSignificantDigits(10);
  const scaled = rounded.times(`1e${-exponentMultipleOf3}`);
  const clean = scaled.toFixed(12).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return applyDecimalMark(`${clean}×10^${exponentMultipleOf3}`, decimalMark);
}

export function initialEngExponent(value: Scalar): number {
  const d = value.decimal.abs();
  if (d.isZero()) return 0;
  const rounded = d.toSignificantDigits(10);
  return Math.floor(rounded.e / 3) * 3;
}

export function formatDms(value: Scalar, decimalMark: DecimalMark = 'Dot'): string {
  const d = value.decimal;
  const totalSeconds = d.abs().times(3600).toDecimalPlaces(2);
  let deg = totalSeconds.divToInt(3600);
  const remAfterDeg = totalSeconds.minus(deg.times(3600));
  let min = remAfterDeg.divToInt(60);
  let sec = remAfterDeg.minus(min.times(60));
  if (sec.gte(60)) {
    sec = sec.minus(60);
    min = min.plus(1);
  }
  if (min.gte(60)) {
    min = min.minus(60);
    deg = deg.plus(1);
  }
  const isZeroShown = deg.isZero() && min.isZero() && sec.isZero();
  const negative = d.isNegative() && !d.isZero() && !isZeroShown;
  const secText = applyDecimalMark(sec.toFixed(2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''), decimalMark);
  return `${negative ? '−' : ''}${deg.toFixed(0)}°${min.toFixed(0)}’${secText}”`;
}

export function defaultResultFormat(value: Scalar): ResultFormat {
  return value.preferDecimal ? 'decimal' : 'exact';
}

export function formatResult(
  value: Scalar,
  format: ResultFormat,
  options?: {
    fractionStyle?: FractionStyle;
    numberFormat?: NumberFormatSetting;
    override?: DisplayOverride;
    engExponent?: number | null;
    factoredText?: string | null;
    decimalMark?: DecimalMark;
  },
): DisplayValue {
  const override = options?.override ?? 'none';
  const mark = options?.decimalMark ?? 'Dot';

  if (override === 'dms') return { type: 'text', text: formatDms(value, mark) };
  if (override === 'fact' && options?.factoredText) return { type: 'text', text: options.factoredText };
  if (override === 'eng' && options?.engExponent !== null && options?.engExponent !== undefined) {
    return { type: 'text', text: formatEngineering(value, options.engExponent, mark) };
  }
  if (override === 'recur' && value.exact) {
    const rec = computeRecurringDecimal(value.exact.n, value.exact.d);
    if (rec) {
      return {
        type: 'recurring-decimal',
        sign: rec.sign,
        intPart: rec.intPart,
        nonRepeat: rec.nonRepeat,
        repeat: rec.repeat,
      };
    }
  }

  const setting = options?.numberFormat ?? DEFAULT_NUMBER_FORMAT;
  if (format === 'exact' && setting.mode === 'Norm') {
    if (value.simpUnreduced) {
      const { n, d } = value.simpUnreduced;
      const sf = value.simpFactor?.toString();
      if (d === 1n) return { type: 'text', text: formatDecimal(value, setting, mark) };
      const absN = n < 0n ? -n : n;
      const sign = n < 0n ? '−' : '';
      const style = options?.fractionStyle ?? 'improper';
      if (style === 'mixed' && absN > d) {
        const whole = (absN / d).toString();
        const rem = (absN % d).toString();
        const den = d.toString();
        if (whole.length + rem.length + den.length <= 11) {
          return { type: 'mixed-fraction', sign, whole, numerator: rem, denominator: den, simpFactor: sf };
        }
      }
      return { type: 'fraction', sign, numerator: absN.toString(), denominator: d.toString(), simpFactor: sf };
    }

    if (value.exact) {
      const { n, d } = value.exact;
      if (d === 1n) return { type: 'text', text: formatDecimal(value, setting, mark) };
      const absN = n < 0n ? -n : n;
      const sign = n < 0n ? '−' : '';
      const style = options?.fractionStyle ?? 'improper';
      if (style === 'mixed' && absN > d) {
        const whole = (absN / d).toString();
        const rem = (absN % d).toString();
        const den = d.toString();
        if (whole.length + rem.length + den.length <= 11) {
          return { type: 'mixed-fraction', sign, whole, numerator: rem, denominator: den };
        }
      }
      const numerator = absN.toString();
      const denominator = d.toString();
      if (numerator.length + denominator.length <= 10) {
        return { type: 'fraction', sign, numerator, denominator };
      }
    }

    if (value.symbolic?.kind === 'pi') {
      const { n, d } = value.symbolic;
      const absN = n < 0n ? -n : n;
      if (absN.toString().length + d.toString().length <= 10) {
        return {
          type: 'symbolic-pi',
          sign: n < 0n ? '−' : '',
          numerator: absN.toString(),
          denominator: d.toString(),
        };
      }
    }

    if (value.symbolic?.kind === 'surd') {
      const { a, b, rad, d } = value.symbolic;
      const totalChars = a.toString().length + b.toString().length + rad.toString().length + d.toString().length;
      if (totalChars <= 16) {
        return {
          type: 'symbolic-surd',
          a: a.toString(),
          b: b.toString(),
          rad: rad.toString(),
          d: d.toString(),
        };
      }
    }

    if (value.symbolic?.kind === 'multi-surd') {
      const { terms, d } = value.symbolic;
      const totalChars =
        d.toString().length +
        terms.reduce((acc, t) => acc + t.coef.toString().length + t.rad.toString().length, 0);
      if (totalChars <= 20) {
        return {
          type: 'symbolic-multisurd',
          terms: terms.map((t) => ({ coef: t.coef.toString(), rad: t.rad.toString() })),
          d: d.toString(),
        };
      }
    }
  }
  return { type: 'text', text: formatDecimal(value, setting, mark) };
}
