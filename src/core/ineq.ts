import { solveCubic } from './eqn';
import { mathError } from './errors';
import { formatDecimal, formatSymbolicLinear } from './format';
import { D, applyFunction, divide, multiply, negate, scalarFromInteger, subtract, type Scalar } from './value';

export type IneqDegree = 2 | 3;
export type IneqRelation = '>' | '<' | '≥' | '≤';

export interface IneqResult {
  roots: Scalar[];
  degree: IneqDegree;
  relation: IneqRelation;
  coeffs: Scalar[];
}

function evalPoly(coeffs: Scalar[], x: InstanceType<typeof D>): InstanceType<typeof D> {
  return coeffs.reduce((acc, c) => acc.times(x).plus(c.decimal), new D(0));
}

function uniqueSortedRealRoots(degree: IneqDegree, coeffs: Scalar[]): Scalar[] {
  if (coeffs[0].decimal.abs().lt('1e-26')) mathError('Leading coefficient cannot be zero');

  let rawRoots: Scalar[] = [];
  if (degree === 2) {
    const [a, b, c] = coeffs;
    const disc = subtract(multiply(b, b), multiply(multiply(scalarFromInteger(4), a), c));
    if (disc.decimal.abs().lt('1e-24')) {
      rawRoots = [divide(negate(b), multiply(scalarFromInteger(2), a))];
    } else if (disc.decimal.gt(0)) {
      const sq = applyFunction('sqrt', [disc], 'DEG');
      const twoA = multiply(scalarFromInteger(2), a);
      rawRoots = [
        divide(subtract(sq, b), twoA),
        divide(negate(subtract(b, negate(sq))), twoA),
      ];
      // Cleaner: (-b - sq)/(2a) and (-b + sq)/(2a)
      rawRoots = [
        divide(subtract(negate(b), sq), twoA),
        divide(subtract(negate(b), negate(sq)), twoA),
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
    if (!deduped.length || r.decimal.minus(deduped[deduped.length - 1].decimal).abs().gt('1e-16')) {
      deduped.push(r);
    }
  }
  return deduped;
}

export function solveInequality(degree: IneqDegree, relation: IneqRelation, coeffs: Scalar[]): IneqResult {
  const roots = uniqueSortedRealRoots(degree, coeffs);
  return { roots, degree, relation, coeffs };
}

export function formatInequalityResult(res: IneqResult, preferExact: boolean): string {
  const { roots, relation, coeffs } = res;
  const inclusive = relation === '≥' || relation === '≤';
  const wantPositive = relation === '>' || relation === '≥';
  const ltSym = inclusive ? '≤' : '<';

  const fmt = (s: Scalar) => (preferExact && formatSymbolicLinear(s)) || formatDecimal(s);

  const satisfiesStrict = (val: InstanceType<typeof D>): boolean => {
    const y = evalPoly(coeffs, val);
    return wantPositive ? y.gt('1e-20') : y.lt('-1e-20');
  };

  if (roots.length === 0) {
    return satisfiesStrict(new D(0)) ? 'All Real Numbers' : 'No Solution';
  }

  // Test intervals (-inf, r0), (r0, r1), ..., (rk, +inf)
  const samplePoints: InstanceType<typeof D>[] = [];
  samplePoints.push(roots[0].decimal.minus(1));
  for (let i = 0; i + 1 < roots.length; i++) {
    samplePoints.push(roots[i].decimal.plus(roots[i + 1].decimal).div(2));
  }
  samplePoints.push(roots[roots.length - 1].decimal.plus(1));

  const intervalActive = samplePoints.map(satisfiesStrict);

  // Merge adjacent intervals when inclusive root bridges two active intervals!
  type Segment =
    | { kind: 'all' }
    | { kind: 'left'; upper: Scalar }
    | { kind: 'right'; lower: Scalar }
    | { kind: 'between'; lower: Scalar; upper: Scalar }
    | { kind: 'point'; at: Scalar }
    | { kind: 'not-equal'; at: Scalar };

  // Special clean cases for single double-root quadratic:
  if (roots.length === 1) {
    const leftOk = intervalActive[0];
    const rightOk = intervalActive[1];
    if (leftOk && rightOk) {
      return inclusive ? 'All Real Numbers' : `X≠${fmt(roots[0])}`;
    }
    if (!leftOk && !rightOk) {
      return inclusive ? `X=${fmt(roots[0])}` : 'No Solution';
    }
  }

  const segments: Segment[] = [];
  let i = 0;
  while (i < intervalActive.length) {
    if (!intervalActive[i]) {
      // Check isolated point solution when inclusive and neither adjacent interval is active
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
      return 'All Real Numbers';
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

  if (segments.length === 0) return 'No Solution';

  return segments
    .map((seg) => {
      if (seg.kind === 'all') return 'All Real Numbers';
      if (seg.kind === 'point') return `X=${fmt(seg.at)}`;
      if (seg.kind === 'not-equal') return `X≠${fmt(seg.at)}`;
      if (seg.kind === 'left') return `X${ltSym}${fmt(seg.upper)}`;
      if (seg.kind === 'right') return `${fmt(seg.lower)}${ltSym}X`;
      return `${fmt(seg.lower)}${ltSym}X${ltSym}${fmt(seg.upper)}`;
    })
    .join(', ');
}
