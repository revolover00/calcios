import { mathError } from './errors';
import { D, combinatoric, factorial, makeScalar, scalarFromInteger, type Scalar } from './value';

export type DistSubMode =
  | 'norm-pd'
  | 'norm-cd'
  | 'inv-norm'
  | 'binom-pd'
  | 'binom-cd'
  | 'poisson-pd'
  | 'poisson-cd';

/** High-precision error function erf(z) using series / continued fraction in 34-digit Decimal */
function erfDecimal(z: InstanceType<typeof D>): InstanceType<typeof D> {
  if (z.isZero()) return new D(0);
  const sign = z.isNegative() ? -1 : 1;
  const x = z.abs();
  if (x.gt(9)) return new D(sign);

  const piSqrt = D.acos(-1).sqrt();
  if (x.lte('3.2')) {
    // Power series: (2 / √π) * sum_{n=0}^∞ (-1)^n x^(2n+1) / (n! (2n+1))
    let term = x;
    let sum = x;
    const x2 = x.pow(2);
    for (let n = 1; n <= 90; n++) {
      term = term.times(x2).neg().div(n);
      const contrib = term.div(2 * n + 1);
      sum = sum.plus(contrib);
      if (contrib.abs().lt('1e-32')) break;
    }
    const val = sum.times(2).div(piSqrt);
    return sign === -1 ? val.neg() : val;
  }

  // Lentz continued fraction for erfc(x) = exp(-x^2)/√π * CF
  const x2 = x.pow(2);
  let f = new D('1e-40');
  let C = f;
  let Dden = new D(0);
  // erfc(x) = (exp(-x^2)/√π) * (1 / (x + (1/2)/(x + 1/(x + (3/2)/(x + ...)))))
  let b0 = x;
  f = b0;
  C = f;
  for (let m = 1; m <= 120; m++) {
    const a = new D(m).div(2);
    const b = x;
    Dden = b.plus(a.times(Dden));
    if (Dden.abs().lt('1e-40')) Dden = new D('1e-40');
    C = b.plus(a.div(C));
    if (C.abs().lt('1e-40')) C = new D('1e-40');
    Dden = new D(1).div(Dden);
    const delta = C.times(Dden);
    f = f.times(delta);
    if (delta.minus(1).abs().lt('1e-30')) break;
  }
  const erfc = x2.neg().exp().div(piSqrt.times(f));
  const erf = new D(1).minus(erfc);
  return sign === -1 ? erf.neg() : erf;
}

function stdNormPdf(z: InstanceType<typeof D>): InstanceType<typeof D> {
  const twoPiSqrt = D.acos(-1).times(2).sqrt();
  return z.pow(2).div(-2).exp().div(twoPiSqrt);
}

function stdNormCdf(z: InstanceType<typeof D>): InstanceType<typeof D> {
  return new D('0.5').times(new D(1).plus(erfDecimal(z.div(new D(2).sqrt()))));
}

/** STAT 1-VAR Distr functions: P(t) = P(Z <= t), Q(t) = P(0 <= Z <= t) signed, R(t) = P(Z >= t). */
export function statNormP(t: Scalar): Scalar {
  return makeScalar(stdNormCdf(t.decimal), undefined, true);
}

export function statNormQ(t: Scalar): Scalar {
  return makeScalar(stdNormCdf(t.decimal).minus('0.5'), undefined, true);
}

export function statNormR(t: Scalar): Scalar {
  return makeScalar(new D(1).minus(stdNormCdf(t.decimal)), undefined, true);
}

export function normalPd(x: Scalar, mu: Scalar, sigma: Scalar): Scalar {
  if (sigma.decimal.lte(0)) mathError('σ must be positive');
  const z = x.decimal.minus(mu.decimal).div(sigma.decimal);
  return makeScalar(stdNormPdf(z).div(sigma.decimal), undefined, true);
}

export function normalCd(lower: Scalar, upper: Scalar, mu: Scalar, sigma: Scalar): Scalar {
  if (sigma.decimal.lte(0)) mathError('σ must be positive');
  if (upper.decimal.lt(lower.decimal)) return makeScalar(0, undefined, true);
  const zLow = lower.decimal.minus(mu.decimal).div(sigma.decimal);
  const zHigh = upper.decimal.minus(mu.decimal).div(sigma.decimal);
  const prob = D.max(new D(0), stdNormCdf(zHigh).minus(stdNormCdf(zLow)));
  return makeScalar(prob, undefined, true);
}

export function inverseNormal(area: Scalar, mu: Scalar, sigma: Scalar): Scalar {
  if (sigma.decimal.lte(0)) mathError('σ must be positive');
  const p = area.decimal;
  if (p.lt(0) || p.gt(1)) mathError('Area must be in [0, 1]');
  if (p.isZero() || p.eq(1)) mathError('Extreme tail probability');

  // Acklam rational initial guess in standard float, then 6 Halley/Newton steps in 34-digit Decimal!
  const pf = p.toNumber();
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  let z0: number;
  if (pf < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(pf));
    z0 = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (pf > 1 - 0.02425) {
    const q = Math.sqrt(-2 * Math.log(1 - pf));
    z0 = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else {
    const q = pf - 0.5;
    const r = q * q;
    z0 = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  let z = new D(z0);
  for (let i = 0; i < 7; i++) {
    const err = stdNormCdf(z).minus(p);
    if (err.abs().lt('1e-28')) break;
    const pdf = stdNormPdf(z);
    z = z.minus(err.div(pdf));
  }
  return makeScalar(mu.decimal.plus(sigma.decimal.times(z)), undefined, true);
}

export function binomialPd(x: Scalar, n: Scalar, p: Scalar): Scalar {
  if (!n.decimal.isInteger() || n.decimal.lt(0) || n.decimal.gt(1000)) mathError('Invalid N in Binomial');
  if (p.decimal.lt(0) || p.decimal.gt(1)) mathError('Invalid p in Binomial');
  if (!x.decimal.isInteger()) mathError('x must be integer');
  if (x.decimal.lt(0) || x.decimal.gt(n.decimal)) return makeScalar(0, undefined, true);
  const comb = combinatoric(n, x, false).decimal;
  const k = x.decimal;
  const nk = n.decimal.minus(k);
  const prob = comb.times(p.decimal.pow(k)).times(new D(1).minus(p.decimal).pow(nk));
  return makeScalar(prob, undefined, true);
}

export function binomialCd(x: Scalar, n: Scalar, p: Scalar): Scalar {
  if (!n.decimal.isInteger() || n.decimal.lt(0) || n.decimal.gt(1000)) mathError('Invalid N in Binomial');
  if (p.decimal.lt(0) || p.decimal.gt(1)) mathError('Invalid p in Binomial');
  if (!x.decimal.isInteger()) mathError('x must be integer');
  if (x.decimal.lt(0)) return makeScalar(0, undefined, true);
  const cap = Math.min(n.decimal.toNumber(), x.decimal.toNumber());
  let sum = new D(0);
  for (let k = 0; k <= cap; k++) {
    sum = sum.plus(binomialPd(scalarFromInteger(k), n, p).decimal);
  }
  return makeScalar(D.min(new D(1), sum), undefined, true);
}

export function poissonPd(x: Scalar, lambda: Scalar): Scalar {
  if (lambda.decimal.lte(0)) mathError('λ must be positive');
  if (!x.decimal.isInteger()) mathError('x must be integer');
  if (x.decimal.lt(0)) return makeScalar(0, undefined, true);
  const k = x.decimal.toNumber();
  if (k > 500) return makeScalar(0, undefined, true);
  let logProb = lambda.decimal.neg().plus(lambda.decimal.ln().times(k));
  if (k <= 69) {
    const fact = factorial(scalarFromInteger(k)).decimal;
    return makeScalar(lambda.decimal.neg().exp().times(lambda.decimal.pow(k)).div(fact), undefined, true);
  }
  for (let i = 2; i <= k; i++) logProb = logProb.minus(new D(i).ln());
  return makeScalar(logProb.exp(), undefined, true);
}

export function poissonCd(x: Scalar, lambda: Scalar): Scalar {
  if (lambda.decimal.lte(0)) mathError('λ must be positive');
  if (!x.decimal.isInteger()) mathError('x must be integer');
  if (x.decimal.lt(0)) return makeScalar(0, undefined, true);
  const cap = x.decimal.toNumber();
  if (cap > 600) mathError('Poisson x too large');
  let sum = new D(0);
  for (let k = 0; k <= cap; k++) {
    sum = sum.plus(poissonPd(scalarFromInteger(k), lambda).decimal);
  }
  return makeScalar(D.min(new D(1), sum), undefined, true);
}
