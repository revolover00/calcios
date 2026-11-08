import { snapExactScalar, solveCubic } from './eqn';
import { mathError } from './errors';
import {
  DEFAULT_NUMBER_FORMAT, formatDecimal, formatResult, formatSymbolicLinear,
  type DecimalMark, type DisplayValue, type IneqSegmentDisplay, type NumberFormatSetting,
} from './format';
import { D, applyFunction, divide, multiply, negate, scalarFromInteger, subtract, type Scalar } from './value';

export type IneqDegree = 2 | 3;
export type IneqRelation = '>' | '<' | '≥' | '≤';

export interface IneqResult {
  roots: Scalar[];
  degree: IneqDegree;
  relation: IneqRelation;
  coeffs: Scalar[];
}

type RawSegment =
  | { kind: 'all' }
  | { kind: 'none' }
  | { kind: 'point'; at: Scalar }
  | { kind: 'not-equal'; at: Scalar }
  | { kind: 'left'; upper: Scalar }
  | { kind: 'right'; lower: Scalar }
  | { kind: 'between'; lower: Scalar; upper: Scalar };

function uniqueSortedRealRoots(degree: IneqDegree, coeffs: Scalar[]): Scalar[] {
  if (coeffs[0].decimal.abs().lt('1e-95') && coeffs[0].decimal.isZero()) {
    mathError('Leading coefficient cannot be zero');
  }
  if (coeffs[0].exact ? coeffs[0].exact.n === 0n : coeffs[0].decimal.isZero()) {
    mathError('Leading coefficient cannot be zero');
  }

  let rawRoots: Scalar[] = [];
  if (degree === 2) {
    const [a, b, c] = coeffs;
    const disc = subtract(multiply(b, b), multiply(multiply(scalarFromInteger(4), a), c));
    const coeffScale = b.decimal.pow(2).plus(a.decimal.times(c.decimal).abs().times(4));
    const zeroDisc = disc.exact ? disc.exact.n === 0n : disc.decimal.abs().lte(coeffScale.times('1e-26'));
    if (zeroDisc) {
      rawRoots = [snapExactScalar(divide(negate(b), multiply(scalarFromInteger(2), a)))];
    } else if (disc.decimal.gt(0)) {
      const sq = applyFunction('sqrt', [disc], 'DEG');
      const twoA = multiply(scalarFromInteger(2), a);
      rawRoots = [
        snapExactScalar(divide(subtract(negate(b), sq), twoA)),
        snapExactScalar(divide(subtract(negate(b), negate(sq)), twoA)),
      ];
    }
  } else {
    const out = solveCubic(coeffs);
    if (out.status === 'solved') {
      rawRoots = out.items.filter((it) => it.scalar !== undefined).map((it) => it.scalar!);
    }
  }

  rawRoots.sort((p, q) => p.decimal.comparedTo(q.decimal));
  const deduped: Scalar[] = [];
  for (const r of rawRoots) {
    if (!deduped.length) {
      deduped.push(r);
      continue;
    }
    const prev = deduped[deduped.length - 1].decimal;
    const mag = D.max(r.decimal.abs(), prev.abs());
    const dupTol = mag.isZero() ? new D('1e-24') : mag.times('1e-18');
    if (r.decimal.minus(prev).abs().gt(dupTol)) {
      deduped.push(r);
    }
  }
  return deduped;
}

export function solveInequality(degree: IneqDegree, relation: IneqRelation, coeffs: Scalar[]): IneqResult {
  const roots = uniqueSortedRealRoots(degree, coeffs);
  return { roots, degree, relation, coeffs };
}

function computeInequalitySegments(res: IneqResult): { ltSym: '<' | '≤'; segments: RawSegment[] } {
  const { roots, degree, relation, coeffs } = res;
  const inclusive = relation === '≥' || relation === '≤';
  const wantPositive = relation === '>' || relation === '≥';
  const ltSym: '<' | '≤' = inclusive ? '≤' : '<';
  const leadPos = coeffs[0].decimal.gt(0);
  const matchesSign = (isPos: boolean) => (wantPositive ? isPos : !isPos);

  if (roots.length === 0) {
    return {
      ltSym,
      segments: [{ kind: matchesSign(leadPos) ? 'all' : 'none' }],
    };
  }

  // Exact interval signs via algebraic root multiplicities (immune to underflow on tiny coefficients/roots)
  let intervalPositive: boolean[];
  if (degree === 2) {
    intervalPositive = roots.length === 1
      ? [leadPos, leadPos]
      : [leadPos, !leadPos, leadPos];
  } else if (roots.length === 1) {
    intervalPositive = [!leadPos, leadPos];
  } else if (roots.length === 3) {
    intervalPositive = [!leadPos, leadPos, !leadPos, leadPos];
  } else {
    // Cubic with 2 distinct real roots (1 double + 1 simple): inflection x = -b/(3a) lies 2x closer to double root
    const infl = coeffs[1].decimal.neg().div(coeffs[0].decimal.times(3));
    const r0IsDouble = infl.minus(roots[0].decimal).abs().lt(infl.minus(roots[1].decimal).abs());
    intervalPositive = r0IsDouble
      ? [!leadPos, !leadPos, leadPos]
      : [!leadPos, leadPos, leadPos];
  }

  const intervalActive = intervalPositive.map(matchesSign);

  if (roots.length === 1) {
    const leftOk = intervalActive[0];
    const rightOk = intervalActive[1];
    if (leftOk && rightOk) {
      return {
        ltSym,
        segments: [inclusive ? { kind: 'all' } : { kind: 'not-equal', at: roots[0] }],
      };
    }
    if (!leftOk && !rightOk) {
      return {
        ltSym,
        segments: [inclusive ? { kind: 'point', at: roots[0] } : { kind: 'none' }],
      };
    }
  }

  const segments: RawSegment[] = [];
  let i = 0;
  while (i < intervalActive.length) {
    if (!intervalActive[i]) {
      if (inclusive && i < roots.length && !intervalActive[i + 1]) {
        segments.push({ kind: 'point', at: roots[i] });
      }
      i++;
      continue;
    }
    const startInterval = i;
    let endInterval = i;
    if (inclusive) {
      while (endInterval + 1 < intervalActive.length && intervalActive[endInterval + 1]) {
        endInterval++;
      }
    }
    const hasLower = startInterval > 0;
    const hasUpper = endInterval < roots.length;
    if (!hasLower && !hasUpper) {
      return { ltSym, segments: [{ kind: 'all' }] };
    }
    if (!hasLower && hasUpper) {
      segments.push({ kind: 'left', upper: roots[endInterval] });
    } else if (hasLower && !hasUpper) {
      segments.push({ kind: 'right', lower: roots[startInterval - 1] });
    } else {
      segments.push({ kind: 'between', lower: roots[startInterval - 1], upper: roots[endInterval] });
    }
    i = endInterval + 1;
  }

  if (segments.length === 0) return { ltSym, segments: [{ kind: 'none' }] };
  return { ltSym, segments };
}

export function formatInequalityResult(
  res: IneqResult,
  preferExact: boolean,
  numberFormat: NumberFormatSetting = DEFAULT_NUMBER_FORMAT,
  decimalMark: DecimalMark = 'Dot',
): string {
  const { ltSym, segments } = computeInequalitySegments(res);
  const fmt = (s: Scalar) =>
    (preferExact && formatSymbolicLinear(s)) || formatDecimal(s, numberFormat, decimalMark);

  return segments
    .map((seg) => {
      if (seg.kind === 'all') return 'All Real Numbers';
      if (seg.kind === 'none') return 'No Solution';
      if (seg.kind === 'point') return `X=${fmt(seg.at)}`;
      if (seg.kind === 'not-equal') return `X≠${fmt(seg.at)}`;
      if (seg.kind === 'left') return `X${ltSym}${fmt(seg.upper)}`;
      if (seg.kind === 'right') return `${fmt(seg.lower)}${ltSym}X`;
      return `${fmt(seg.lower)}${ltSym}X${ltSym}${seg.upper ? fmt(seg.upper) : ''}`;
    })
    .join(', ');
}

/** Builds structured 2D inequality display with symbolic template header (e.g. X<A, B<X) + 2D roots! */
export function formatInequalityDisplay(
  res: IneqResult,
  preferExact: boolean,
  numberFormat: NumberFormatSetting = DEFAULT_NUMBER_FORMAT,
  decimalMark: DecimalMark = 'Dot',
): DisplayValue {
  const { ltSym, segments } = computeInequalitySegments(res);
  const letters = ['A', 'B', 'C', 'D'];
  let letterIdx = 0;
  const nextVar = () => letters[letterIdx++] ?? 'K';

  const headerParts: string[] = [];
  const dispSegments: IneqSegmentDisplay[] = [];

  const fmtVal = (s: Scalar): DisplayValue =>
    formatResult(s, preferExact ? 'exact' : 'decimal', {
      numberFormat,
      decimalMark,
    });

  for (const seg of segments) {
    if (seg.kind === 'all') {
      headerParts.push('All Real Numbers');
      dispSegments.push({ kind: 'all' });
    } else if (seg.kind === 'none') {
      headerParts.push('No Solution');
      dispSegments.push({ kind: 'none' });
    } else if (seg.kind === 'point') {
      headerParts.push(`X=${nextVar()}`);
      dispSegments.push({ kind: 'eq', val: fmtVal(seg.at) });
    } else if (seg.kind === 'not-equal') {
      headerParts.push(`X≠${nextVar()}`);
      dispSegments.push({ kind: 'neq', val: fmtVal(seg.at) });
    } else if (seg.kind === 'left') {
      headerParts.push(`X${ltSym}${nextVar()}`);
      dispSegments.push({ kind: 'left', op: ltSym, upper: fmtVal(seg.upper) });
    } else if (seg.kind === 'right') {
      headerParts.push(`${nextVar()}${ltSym}X`);
      dispSegments.push({ kind: 'right', op: ltSym, lower: fmtVal(seg.lower) });
    } else {
      const v1 = nextVar();
      const v2 = nextVar();
      headerParts.push(`${v1}${ltSym}X${ltSym}${v2}`);
      dispSegments.push({ kind: 'between', op: ltSym, lower: fmtVal(seg.lower), upper: fmtVal(seg.upper) });
    }
  }

  return {
    type: 'ineq-2d',
    header: headerParts.join(', '),
    segments: dispSegments,
  };
}
