import { CalculatorError, mathError } from './errors';
import { D, add, makeScalar, multiply, scalarFromInteger, type Scalar } from './value';

/**
 * Numerical derivative d/dx f(x) at x0 using 34-digit central differences
 * with two-level Richardson extrapolation and automatic boundary-safe step adaptation.
 */
export function numericDerivative(fn: (x: Scalar) => Scalar, x0: Scalar, tolerance?: InstanceType<typeof D>): Scalar {
  const center = x0.decimal;
  const safeEval = (val: InstanceType<typeof D>): InstanceType<typeof D> | null => {
    try {
      const res = fn(makeScalar(val, undefined, true)).decimal;
      return res.isFinite() ? res : null;
    } catch (err) {
      if (err instanceof CalculatorError && err.kind === 'Syntax ERROR') throw err;
      return null;
    }
  };

  const baseScale = center.isZero() ? new D(1) : D.max(new D('1e-24'), center.abs());
  const relativeStep = tolerance ? D.max(new D('1e-8'), D.min(new D('1e-2'), tolerance.sqrt())) : new D('1e-6');
  let h1 = baseScale.times(relativeStep);

  // Shrink h1 if center ± h1 crosses a nearby domain boundary (e.g. ln(X - 1) at X = 1.0000001)
  for (let shrink = 0; shrink < 24; shrink++) {
    const fp = safeEval(center.plus(h1));
    const fm = safeEval(center.minus(h1));
    if (fp !== null && fm !== null) {
      const h2 = h1.div(2);
      const fp2 = safeEval(center.plus(h2));
      const fm2 = safeEval(center.minus(h2));
      if (fp2 !== null && fm2 !== null) {
        const d1 = fp.minus(fm).div(h1.times(2));
        const d2 = fp2.minus(fm2).div(h2.times(2));
        const extrapolated = d2.times(4).minus(d1).div(3);
        if (!extrapolated.isFinite()) mathError('Derivative failed to converge');
        const cleaned = extrapolated.abs().lt('1e-22') ? new D(0) : extrapolated;
        return makeScalar(cleaned, undefined, true);
      }
    }
    h1 = h1.div(4);
  }

  // One-sided Richardson extrapolation if x0 sits right on a domain boundary (and f(x0) is finite)
  const f0 = safeEval(center);
  if (f0 !== null) {
    const h = baseScale.times(relativeStep);
    const fp1 = safeEval(center.plus(h));
    const fp2 = safeEval(center.plus(h.times(2)));
    const fpHalf = safeEval(center.plus(h.div(2)));
    if (fp1 !== null && fp2 !== null && fpHalf !== null) {
      const d1 = f0.times(-3).plus(fp1.times(4)).minus(fp2).div(h.times(2));
      const d2 = f0.times(-3).plus(fpHalf.times(4)).minus(fp1).div(h);
      const extrap = d2.times(4).minus(d1).div(3);
      if (extrap.isFinite()) {
        return makeScalar(extrap.abs().lt('1e-20') ? new D(0) : extrap, undefined, true);
      }
    }
    const fm1 = safeEval(center.minus(h));
    const fm2 = safeEval(center.minus(h.times(2)));
    const fmHalf = safeEval(center.minus(h.div(2)));
    if (fm1 !== null && fm2 !== null && fmHalf !== null) {
      const d1 = f0.times(3).minus(fm1.times(4)).plus(fm2).div(h.times(2));
      const d2 = f0.times(3).minus(fmHalf.times(4)).plus(fm1).div(h);
      const extrap = d2.times(4).minus(d1).div(3);
      if (extrap.isFinite()) {
        return makeScalar(extrap.abs().lt('1e-20') ? new D(0) : extrap, undefined, true);
      }
    }
  }

  return mathError('Derivative failed to converge');
}

// 8-point Gauss-Legendre nodes and weights on [-1, 1] (high precision)
const GL8_NODES = [
  new D('-0.96028985649753623168356086856947'),
  new D('-0.79666647741362673959155393647583'),
  new D('-0.52553240991632898581773904918925'),
  new D('-0.18343464249564980493947614236018'),
  new D('0.18343464249564980493947614236018'),
  new D('0.52553240991632898581773904918925'),
  new D('0.79666647741362673959155393647583'),
  new D('0.96028985649753623168356086856947'),
];

const GL8_WEIGHTS = [
  new D('0.10122853629037625915253135430996'),
  new D('0.22238103445337447054435599442624'),
  new D('0.31370664587788728733796220198660'),
  new D('0.36268378337836198296515044927720'),
  new D('0.36268378337836198296515044927720'),
  new D('0.31370664587788728733796220198660'),
  new D('0.22238103445337447054435599442624'),
  new D('0.10122853629037625915253135430996'),
];

/**
 * Adaptive 8-point Gauss-Legendre definite integral ∫_a^b f(x) dx
 * with recursive subdivision for endpoint singularities and oscillatory integrands.
 */
export function numericIntegral(fn: (x: Scalar) => Scalar, lower: Scalar, upper: Scalar, tolerance = new D('1e-13')): Scalar {
  const a = lower.decimal;
  const b = upper.decimal;
  if (a.eq(b)) return scalarFromInteger(0);
  const sign = b.lt(a) ? -1 : 1;
  const start = sign === 1 ? a : b;
  const end = sign === 1 ? b : a;

  const gl8Panel = (left: InstanceType<typeof D>, right: InstanceType<typeof D>): InstanceType<typeof D> => {
    const half = right.minus(left).div(2);
    const mid = left.plus(half);
    let sum = new D(0);
    for (let j = 0; j < GL8_NODES.length; j++) {
      const sampleX = mid.plus(half.times(GL8_NODES[j]));
      const fx = fn(makeScalar(sampleX, undefined, true)).decimal;
      if (!fx.isFinite()) mathError('Integral diverges');
      sum = sum.plus(GL8_WEIGHTS[j].times(fx));
    }
    return sum.times(half);
  };

  let evalPanels = 0;
  const MAX_PANELS = 2400;

  const adaptive = (
    left: InstanceType<typeof D>,
    right: InstanceType<typeof D>,
    whole: InstanceType<typeof D>,
    tol: InstanceType<typeof D>,
    depth: number,
  ): InstanceType<typeof D> => {
    const mid = left.plus(right).div(2);
    const leftVal = gl8Panel(left, mid);
    const rightVal = gl8Panel(mid, right);
    evalPanels += 2;
    const refined = leftVal.plus(rightVal);
    const err = refined.minus(whole).abs();
    const relBound = D.max(tol, refined.abs().times('1e-14'));
    if (err.lte(relBound) || depth >= 52 || evalPanels >= MAX_PANELS) {
      return refined.plus(refined.minus(whole).div(65535));
    }
    const halfTol = tol.div(2);
    return adaptive(left, mid, leftVal, halfTol, depth + 1).plus(
      adaptive(mid, right, rightVal, halfTol, depth + 1),
    );
  };

  const initialSlices = 8;
  const sliceWidth = end.minus(start).div(initialSlices);
  let total = new D(0);
  for (let i = 0; i < initialSlices; i++) {
    const sLeft = start.plus(sliceWidth.times(i));
    const sRight = i === initialSlices - 1 ? end : start.plus(sliceWidth.times(i + 1));
    const coarse = gl8Panel(sLeft, sRight);
    evalPanels++;
    total = total.plus(adaptive(sLeft, sRight, coarse, tolerance, 0));
  }

  if (sign === -1) total = total.neg();
  if (total.abs().lt('1e-22')) total = new D(0);
  return makeScalar(total, undefined, true);
}

export function numericSummation(fn: (x: Scalar) => Scalar, start: Scalar, end: Scalar): Scalar {
  if (!start.decimal.isInteger() || !end.decimal.isInteger()) mathError('Summation bounds must be integers');
  if (start.decimal.abs().gt('1e30') || end.decimal.abs().gt('1e30')) mathError('Invalid summation range');
  const s = BigInt(start.decimal.toFixed(0));
  const e = BigInt(end.decimal.toFixed(0));
  if (e < s) mathError('Invalid summation range');
  if (e - s > 1000n) mathError('Summation range exceeds 1000 terms');
  let acc = scalarFromInteger(0);
  for (let k = s; k <= e; k++) {
    acc = add(acc, fn(scalarFromInteger(k)));
  }
  return acc;
}

export function numericProduct(fn: (x: Scalar) => Scalar, start: Scalar, end: Scalar): Scalar {
  if (!start.decimal.isInteger() || !end.decimal.isInteger()) mathError('Product bounds must be integers');
  if (start.decimal.abs().gt('1e30') || end.decimal.abs().gt('1e30')) mathError('Invalid product range');
  const s = BigInt(start.decimal.toFixed(0));
  const e = BigInt(end.decimal.toFixed(0));
  if (e < s) mathError('Invalid product range');
  if (e - s > 500n) mathError('Product range exceeds 500 terms');
  let acc = scalarFromInteger(1);
  for (let k = s; k <= e; k++) {
    acc = multiply(acc, fn(scalarFromInteger(k)));
  }
  return acc;
}

export interface SolveOutcome {
  root: Scalar;
  residual: Scalar;
}

/**
 * Hybrid damped Newton-Secant numerical solver for f(X) = 0 starting near initialGuess.
 */
export function solveRoot(fn: (x: Scalar) => Scalar, initialGuess: Scalar): SolveOutcome {
  const safeEval = (x: InstanceType<typeof D>): InstanceType<typeof D> | null => {
    try {
      const v = fn(makeScalar(x, undefined, true)).decimal;
      return v.isFinite() ? v : null;
    } catch (err) {
      if (err instanceof CalculatorError && err.kind === 'Syntax ERROR') throw err;
      return null;
    }
  };

  const seeds = [
    initialGuess.decimal,
    new D('0.1'),
    new D('1'),
    new D('-1'),
    new D('2.5'),
    new D('-2.5'),
    new D('1e-4'),
  ];

  for (const seed of seeds) {
    let x = seed;
    let fx = safeEval(x);
    if (fx === null) continue;

    for (let iter = 0; iter < 80; iter++) {
      if (fx.abs().lte('1e-24')) {
        const cleanRoot = x.abs().lt('1e-22') ? new D(0) : x;
        const finalRes = safeEval(cleanRoot) ?? fx;
        if (finalRes.abs().lte('1e-18')) {
          return {
            root: makeScalar(cleanRoot, undefined, true),
            residual: makeScalar(finalRes.abs().lt('1e-20') ? new D(0) : finalRes, undefined, true),
          };
        }
        return {
          root: makeScalar(x, undefined, true),
          residual: makeScalar(fx.abs().lt('1e-20') ? new D(0) : fx, undefined, true),
        };
      }
      const step = D.max(new D('1e-24'), x.abs().times('1e-8'));
      const fPlus = safeEval(x.plus(step));
      const fMinus = safeEval(x.minus(step));
      let slope: InstanceType<typeof D> | null = null;
      if (fPlus !== null && fMinus !== null) {
        slope = fPlus.minus(fMinus).div(step.times(2));
      } else if (fPlus !== null) {
        slope = fPlus.minus(fx).div(step);
      } else if (fMinus !== null) {
        slope = fx.minus(fMinus).div(step);
      }
      if (slope === null) break;
      if (slope.abs().lt('1e-26')) {
        x = x.plus('0.37');
        fx = safeEval(x);
        if (fx === null) break;
        continue;
      }
      const delta = fx.div(slope);
      let damping = new D(1);
      let accepted = false;
      for (let ls = 0; ls < 32; ls++) {
        const stepVec = delta.times(damping);
        const candidate = x.minus(stepVec);
        if (candidate.abs().gte('1e99')) {
          damping = damping.div(2);
          continue;
        }
        const fCand = safeEval(candidate);
        if (
          fCand !== null &&
          (fCand.abs().lt(fx.abs()) || stepVec.abs().lte(D.max(new D('1e-26'), x.abs().times('1e-22'))))
        ) {
          x = candidate;
          fx = fCand;
          accepted = true;
          break;
        }
        damping = damping.div(2);
      }
      if (!accepted || fx === null) break;
    }

    if (fx !== null && fx.abs().lte('1e-9')) {
      const cleanRoot = x.abs().lt('1e-18') ? new D(0) : x;
      const finalRes = safeEval(cleanRoot);
      if (finalRes !== null && finalRes.abs().lte('1e-9')) {
        return {
          root: makeScalar(cleanRoot, undefined, true),
          residual: makeScalar(finalRes.abs().lt('1e-16') ? new D(0) : finalRes, undefined, true),
        };
      }
      return {
        root: makeScalar(x, undefined, true),
        residual: makeScalar(fx.abs().lt('1e-16') ? new D(0) : fx, undefined, true),
      };
    }
  }

  return mathError('CanNotSolve');
}
