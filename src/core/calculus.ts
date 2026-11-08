import { CalculatorError, mathError } from './errors';
import { D, add, makeScalar, multiply, scalarFromInteger, type Scalar } from './value';

/**
 * Numerical derivative d/dx f(x) at x0 using 34-digit central differences
 * with two-level Richardson extrapolation.
 */
export function numericDerivative(fn: (x: Scalar) => Scalar, x0: Scalar): Scalar {
  const center = x0.decimal;
  const scale = D.max(new D(1), center.abs());
  const h1 = scale.times('1e-6');
  const h2 = h1.div(2);

  const evalAt = (val: InstanceType<typeof D>) => fn(makeScalar(val, undefined, true)).decimal;
  const d1 = evalAt(center.plus(h1)).minus(evalAt(center.minus(h1))).div(h1.times(2));
  const d2 = evalAt(center.plus(h2)).minus(evalAt(center.minus(h2))).div(h2.times(2));
  const extrapolated = d2.times(4).minus(d1).div(3);

  if (!extrapolated.isFinite()) mathError('Derivative failed to converge');
  const cleaned = extrapolated.abs().lt('1e-22') ? new D(0) : extrapolated;
  return makeScalar(cleaned, undefined, true);
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
 * Composite 8-point Gauss-Legendre definite integral ∫_a^b f(x) dx over 24 subintervals.
 */
export function numericIntegral(fn: (x: Scalar) => Scalar, lower: Scalar, upper: Scalar): Scalar {
  const a = lower.decimal;
  const b = upper.decimal;
  if (a.eq(b)) return scalarFromInteger(0);
  const sign = b.lt(a) ? -1 : 1;
  const start = sign === 1 ? a : b;
  const end = sign === 1 ? b : a;

  const panels = 24;
  const panelWidth = end.minus(start).div(panels);
  const halfWidth = panelWidth.div(2);
  let total = new D(0);

  for (let i = 0; i < panels; i++) {
    const mid = start.plus(panelWidth.times(i + 0.5));
    let sub = new D(0);
    for (let j = 0; j < GL8_NODES.length; j++) {
      const sampleX = mid.plus(halfWidth.times(GL8_NODES[j]));
      const fx = fn(makeScalar(sampleX, undefined, true)).decimal;
      sub = sub.plus(GL8_WEIGHTS[j].times(fx));
    }
    total = total.plus(sub.times(halfWidth));
  }

  if (sign === -1) total = total.neg();
  if (total.abs().lt('1e-22')) total = new D(0);
  return makeScalar(total, undefined, true);
}

export function numericSummation(fn: (x: Scalar) => Scalar, start: Scalar, end: Scalar): Scalar {
  if (!start.decimal.isInteger() || !end.decimal.isInteger()) mathError('Summation bounds must be integers');
  const s = Number(start.decimal.toFixed(0));
  const e = Number(end.decimal.toFixed(0));
  if (!Number.isSafeInteger(s) || !Number.isSafeInteger(e) || e < s) mathError('Invalid summation range');
  if (e - s > 1000) mathError('Summation range exceeds 1000 terms');
  let acc = scalarFromInteger(0);
  for (let k = s; k <= e; k++) {
    acc = add(acc, fn(scalarFromInteger(k)));
  }
  return acc;
}

export function numericProduct(fn: (x: Scalar) => Scalar, start: Scalar, end: Scalar): Scalar {
  if (!start.decimal.isInteger() || !end.decimal.isInteger()) mathError('Product bounds must be integers');
  const s = Number(start.decimal.toFixed(0));
  const e = Number(end.decimal.toFixed(0));
  if (!Number.isSafeInteger(s) || !Number.isSafeInteger(e) || e < s) mathError('Invalid product range');
  if (e - s > 500) mathError('Product range exceeds 500 terms');
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
  ];

  for (const seed of seeds) {
    let x = seed;
    let fx = safeEval(x);
    if (fx === null) continue;

    for (let iter = 0; iter < 60; iter++) {
      if (fx.abs().lte('1e-24')) {
        const cleanRoot = x.abs().lt('1e-22') ? new D(0) : x;
        const finalRes = safeEval(cleanRoot) ?? fx;
        return {
          root: makeScalar(cleanRoot, undefined, true),
          residual: makeScalar(finalRes.abs().lt('1e-20') ? new D(0) : finalRes, undefined, true),
        };
      }
      const step = D.max(new D('1e-8'), x.abs().times('1e-8'));
      const fPlus = safeEval(x.plus(step));
      const fMinus = safeEval(x.minus(step));
      if (fPlus === null || fMinus === null) break;
      const slope = fPlus.minus(fMinus).div(step.times(2));
      if (slope.abs().lt('1e-26')) {
        x = x.plus('0.37');
        fx = safeEval(x);
        if (fx === null) break;
        continue;
      }
      const delta = fx.div(slope);
      let damping = new D(1);
      let accepted = false;
      for (let ls = 0; ls < 8; ls++) {
        const candidate = x.minus(delta.times(damping));
        if (candidate.abs().gte('1e99')) {
          damping = damping.div(2);
          continue;
        }
        const fCand = safeEval(candidate);
        if (fCand !== null && (fCand.abs().lt(fx.abs()) || ls === 7)) {
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
      const finalRes = safeEval(cleanRoot) ?? fx;
      return {
        root: makeScalar(cleanRoot, undefined, true),
        residual: makeScalar(finalRes.abs().lt('1e-16') ? new D(0) : finalRes, undefined, true),
      };
    }
  }

  return mathError('CanNotSolve');
}
