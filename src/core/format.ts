import type { Scalar } from './value';

export type ResultFormat = 'exact' | 'decimal';
export type FractionStyle = 'improper' | 'mixed';
export type DisplayOverride = 'none' | 'dms' | 'fact' | 'eng';

export type NumberFormatSetting =
  | { mode: 'Norm'; sub: 1 | 2 }
  | { mode: 'Fix'; digits: number }
  | { mode: 'Sci'; digits: number };

export type DisplayValue =
  | { type: 'text'; text: string }
  | { type: 'fraction'; sign: string; numerator: string; denominator: string }
  | { type: 'mixed-fraction'; sign: string; whole: string; numerator: string; denominator: string }
  | { type: 'pair'; label1: string; value1: string; label2: string; value2: string };

export const DEFAULT_NUMBER_FORMAT: NumberFormatSetting = { mode: 'Norm', sub: 1 };

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};

export function toSuperscript(text: string): string {
  return [...text].map((ch) => SUPERSCRIPTS[ch] ?? ch).join('');
}

/** A 10-digit display approximation with optional Fix/Sci/Norm formatting. */
export function formatDecimal(value: Scalar, setting: NumberFormatSetting = DEFAULT_NUMBER_FORMAT): string {
  const d = value.decimal;
  if (d.isZero()) {
    if (setting.mode === 'Fix') return (0).toFixed(setting.digits);
    if (setting.mode === 'Sci') {
      const sig = setting.digits === 0 ? 10 : setting.digits;
      return `${(0).toFixed(Math.max(0, sig - 1))}×10^0`;
    }
    return '0';
  }

  if (setting.mode === 'Sci') {
    const sig = setting.digits === 0 ? 10 : Math.max(1, Math.min(10, setting.digits));
    const rounded = d.toSignificantDigits(sig);
    const [mantissa, exponent] = rounded.toExponential(sig - 1).split('e');
    return `${mantissa}×10^${Number(exponent)}`;
  }

  if (setting.mode === 'Fix') {
    const places = Math.max(0, Math.min(9, setting.digits));
    const abs = d.abs();
    if (abs.gte('1e10')) {
      const rounded = d.toSignificantDigits(10);
      const [mantissa, exponent] = rounded.toExponential(9).split('e');
      const clean = mantissa.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
      return `${clean}×10^${Number(exponent)}`;
    }
    const fixed = d.toDecimalPlaces(places).toFixed(places);
    return fixed === `-0.${'0'.repeat(places)}` || fixed === '-0' ? fixed.slice(1) : fixed;
  }

  const rounded = d.toSignificantDigits(10);
  const absolute = rounded.abs();
  const lowThreshold = setting.sub === 2 ? '1e-9' : '1e-2';
  if (absolute.gte('1e10') || absolute.lt(lowThreshold)) {
    const [mantissa, exponent] = rounded.toExponential(9).split('e');
    const clean = mantissa.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    return `${clean}×10^${Number(exponent)}`;
  }
  return rounded.toFixed().replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export function formatEngineering(value: Scalar, exponentMultipleOf3: number): string {
  const d = value.decimal;
  if (d.isZero()) return `0×10^${exponentMultipleOf3}`;
  const rounded = d.toSignificantDigits(10);
  const scaled = rounded.times(`1e${-exponentMultipleOf3}`);
  const clean = scaled.toFixed(12).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return `${clean}×10^${exponentMultipleOf3}`;
}

export function initialEngExponent(value: Scalar): number {
  const d = value.decimal.abs();
  if (d.isZero()) return 0;
  const exp = Math.floor(Number(d.log(10).toFixed(8)));
  return Math.floor(exp / 3) * 3;
}

export function formatDms(value: Scalar): string {
  const d = value.decimal;
  const negative = d.isNegative() && !d.isZero();
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
  const secText = sec.toFixed(2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
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
  },
): DisplayValue {
  const override = options?.override ?? 'none';
  if (override === 'dms') return { type: 'text', text: formatDms(value) };
  if (override === 'fact' && options?.factoredText) return { type: 'text', text: options.factoredText };
  if (override === 'eng' && options?.engExponent !== null && options?.engExponent !== undefined) {
    return { type: 'text', text: formatEngineering(value, options.engExponent) };
  }

  const setting = options?.numberFormat ?? DEFAULT_NUMBER_FORMAT;
  if (format === 'exact' && value.exact && setting.mode === 'Norm') {
    const { n, d } = value.exact;
    if (d === 1n) return { type: 'text', text: formatDecimal(value, setting) };
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
    // Very large fractional displays are less useful on the small LCD; keep numeric output.
    if (numerator.length + denominator.length <= 10) {
      return { type: 'fraction', sign, numerator, denominator };
    }
  }
  return { type: 'text', text: formatDecimal(value, setting) };
}
