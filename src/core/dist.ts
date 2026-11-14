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

/** High-precision complementary error function erfc(x) for x >= 0 in 34-digit Decimal */
function erfcPositive(x: InstanceType<typeof D>): InstanceType<typeof D> {
  if (x.isZero()) return new D(1);
  const piSqrt = D.acos(-1).sqrt();
  if (x.lte('3.0')) {
    let term = x;
    let sum = x;
    const x2 = x.pow(2);
    for (let n = 1; n <= 95; n++) {
      term = term.times(x2).neg().div(n);
      const contrib = term.div(2 * n + 1);
      sum = sum.plus(contrib);
      if (contrib.abs().lt('1e-34')) break;
    }
    const erf = sum.times(2).div(piSqrt);
    return D.max(new D(0), new D(1).minus(erf));
  }

  // Lentz continued fraction for erfc(x) = (exp(-x^2)/√π) * CF — zero cancellation in the tail!
  const x2 = x.pow(2);
  let f = x;
  let C = f;
  let Dden = new D(0);
  for (let m = 1; m <= 140; m++) {
    const a = new D(m).div(2);
    const b = x;
    Dden = b.plus(a.times(Dden));
    if (Dden.abs().lt('1e-60')) Dden = new D('1e-60');
    C = b.plus(a.div(C));
    if (C.abs().lt('1e-60')) C = new D('1e-60');
    Dden = new D(1).div(Dden);
    const delta = C.times(Dden);
    f = f.times(delta);
    if (delta.minus(1).abs().lt('1e-32')) break;
  }
  return x2.neg().exp().div(piSqrt.times(f));
}

function stdNormPdf(z: InstanceType<typeof D>): InstanceType<typeof D> {
  const twoPiSqrt = D.acos(-1).times(2).sqrt();
  return z.pow(2).div(-2).exp().div(twoPiSqrt);
}

/** P(Z <= z) without tail cancellation for negative z */
function stdNormCdf(z: InstanceType<typeof D>): InstanceType<typeof D> {
  const sqrt2 = new D(2).sqrt();
  if (z.isNegative()) {
    return new D('0.5').times(erfcPositive(z.abs().div(sqrt2)));
  }
  return new D(1).minus(new D('0.5').times(erfcPositive(z.div(sqrt2))));
}

/** P(Z >= z) without tail cancellation for positive z */
function stdNormUpperTail(z: InstanceType<typeof D>): InstanceType<typeof D> {
  const sqrt2 = new D(2).sqrt();
  if (!z.isNegative()) {
    return new D('0.5').times(erfcPositive(z.div(sqrt2)));
  }
  return new D(1).minus(new D('0.5').times(erfcPositive(z.abs().div(sqrt2))));
}

/** High-precision ln(n!) for non-negative integer n in 34-digit Decimal */
function lnFactorial(n: number): InstanceType<typeof D> {
  if (n <= 1) return new D(0);
  if (n <= 80) {
    let s = new D(0);
    for (let i = 2; i <= n; i++) s = s.plus(new D(i).ln());
    return s;
  }
  // Stirling asymptotic series with Bernoulli numbers B_2..B_12 (accurate to >34 digits for n > 80)
  const x = new D(n);
  const invX = new D(1).div(x);
  const invX2 = invX.times(invX);
  const halfLn2Pi = D.acos(-1).times(2).ln().div(2);
  const series = invX.times(
    new D(1).div(12).minus(
      invX2.times(
        new D(1).div(360).minus(
          invX2.times(
            new D(1).div(1260).minus(
              invX2.times(
                new D(1).div(1680).minus(
                  invX2.times(new D(1).div(1188).minus(invX2.times(new D(691).div(360360)))),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  return x.plus('0.5').times(x.ln()).minus(x).plus(halfLn2Pi).plus(series);
}

/** STAT 1-VAR Distr functions: P(t) = P(Z <= t), Q(t) = P(0 <= Z <= t) signed, R(t) = P(Z >= t). */
export function statNormP(t: Scalar): Scalar {
  return makeScalar(stdNormCdf(t.decimal), undefined, true);
}

export function statNormQ(t: Scalar): Scalar {
  return makeScalar(stdNormCdf(t.decimal).minus('0.5'), undefined, true);
}

export function statNormR(t: Scalar): Scalar {
  return makeScalar(stdNormUpperTail(t.decimal), undefined, true);
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
  // Avoid 1 - tail cancellation when both bounds lie in the upper tail
  const prob = zLow.gt(0)
    ? D.max(new D(0), stdNormUpperTail(zLow).minus(stdNormUpperTail(zHigh)))
    : D.max(new D(0), stdNormCdf(zHigh).minus(stdNormCdf(zLow)));
  return makeScalar(prob, undefined, true);
}

export function inverseNormal(area: Scalar, mu: Scalar, sigma: Scalar): Scalar {
  if (sigma.decimal.lte(0)) mathError('σ must be positive');
  const p = area.decimal;
  if (area.exact) {
    if (area.exact.n < 0n || area.exact.n > area.exact.d) mathError('Area must be in [0, 1]');
    if (area.exact.n === 0n || area.exact.n === area.exact.d) mathError('Extreme tail probability');
  } else {
    if (p.lt(0) || p.gt(1)) mathError('Area must be in [0, 1]');
    if (p.isZero() || p.eq(1)) mathError('Extreme tail probability');
  }

  // Use the smaller tail directly. Exact complements preserve probabilities such
  // as 1 - 1e-100 that round to 1 at the Decimal working precision.
  const upperTail = area.exact
    ? new D((area.exact.d - area.exact.n).toString()).div(area.exact.d.toString())
    : new D(1).minus(p);
  const isUpper = area.exact
    ? area.exact.n * 2n > area.exact.d
    : p.gt('0.5');
  const tail = isUpper ? upperTail : p;
  if (tail.isZero()) mathError('Extreme tail probability');

  // Acklam rational initial guess using Decimal.ln() so tiny tails never underflow to Math.log(0) = -Infinity
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  let z0: number;
  if (tail.lt('0.02425')) {
    const q = Math.sqrt(Number(tail.ln().times(-2).toFixed(12)));
    const lowerApprox = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    z0 = isUpper ? -lowerApprox : lowerApprox;
  } else {
    const q = p.toNumber() - 0.5;
    const r = q * q;
    z0 = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  let z = new D(z0);
  for (let i = 0; i < 10; i++) {
    const err = isUpper
      ? tail.minus(stdNormUpperTail(z))
      : stdNormCdf(z).minus(tail);
    if (err.abs().div(tail).lt('1e-30')) break;
    const pdf = stdNormPdf(z);
    if (pdf.isZero()) break;
    z = z.minus(err.div(pdf));
  }
  return makeScalar(mu.decimal.plus(sigma.decimal.times(z)), undefined, true);
}

function binomialPmDecimal(k: number, n: number, pDec: InstanceType<typeof D>): InstanceType<typeof D> {
  if (k < 0 || k > n) return new D(0);
  if (pDec.isZero()) return k === 0 ? new D(1) : new D(0);
  if (pDec.eq(1)) return k === n ? new D(1) : new D(0);
  if (n <= 200) {
    const comb = combinatoric(scalarFromInteger(n), scalarFromInteger(k), false).decimal;
    return comb.times(pDec.pow(k)).times(new D(1).minus(pDec).pow(n - k));
  }
  const qDec = new D(1).minus(pDec);
  const logComb = lnFactorial(n).minus(lnFactorial(k)).minus(lnFactorial(n - k));
  const logProb = logComb.plus(pDec.ln().times(k)).plus(qDec.ln().times(n - k));
  return logProb.exp();
}

export function binomialPd(x: Scalar, n: Scalar, p: Scalar): Scalar {
  if (!n.decimal.isInteger() || n.decimal.lt(0) || n.decimal.gt(100000)) mathError('Invalid N in Binomial');
  if (p.decimal.lt(0) || p.decimal.gt(1)) mathError('Invalid p in Binomial');
  if (!x.decimal.isInteger()) mathError('x must be integer');
  if (x.decimal.lt(0) || x.decimal.gt(n.decimal)) return makeScalar(0, undefined, true);
  const prob = binomialPmDecimal(x.decimal.toNumber(), n.decimal.toNumber(), p.decimal);
  return makeScalar(prob, undefined, true);
}

export function binomialCd(x: Scalar, n: Scalar, p: Scalar): Scalar {
  if (!n.decimal.isInteger() || n.decimal.lt(0) || n.decimal.gt(10000)) mathError('Invalid N in Binomial');
  if (p.decimal.lt(0) || p.decimal.gt(1)) mathError('Invalid p in Binomial');
  if (!x.decimal.isInteger()) mathError('x must be integer');
  if (x.decimal.lt(0)) return makeScalar(0, undefined, true);
  if (x.decimal.gte(n.decimal)) return makeScalar(1, undefined, true);
  const nn = n.decimal.toNumber();
  const cap = x.decimal.toNumber();
  if (p.decimal.isZero()) return makeScalar(1, undefined, true);
  if (p.decimal.eq(1)) return makeScalar(0, undefined, true);
  let sum = new D(0);
  for (let k = 0; k <= cap; k++) {
    sum = sum.plus(binomialPmDecimal(k, nn, p.decimal));
  }
  return makeScalar(D.min(new D(1), sum), undefined, true);
}

function poissonPmDecimal(k: number, lam: InstanceType<typeof D>): InstanceType<typeof D> {
  if (k < 0) return new D(0);
  if (k <= 69 && lam.lte(500)) {
    const fact = factorial(scalarFromInteger(k)).decimal;
    return lam.neg().exp().times(lam.pow(k)).div(fact);
  }
  const logProb = lam.ln().times(k).minus(lam).minus(lnFactorial(k));
  return logProb.exp();
}

export function poissonPd(x: Scalar, lambda: Scalar): Scalar {
  if (lambda.decimal.lte(0)) mathError('λ must be positive');
  if (!x.decimal.isInteger()) mathError('x must be integer');
  if (x.decimal.lt(0)) return makeScalar(0, undefined, true);
  // poissonPmDecimal takes k as a JS number; beyond the safe-integer range it
  // would silently round distinct integer outcomes to the same value.
  if (x.decimal.gt('9007199254740991')) mathError('Poisson x too large');
  const k = x.decimal.toNumber();
  return makeScalar(poissonPmDecimal(k, lambda.decimal), undefined, true);
}

export function poissonCd(x: Scalar, lambda: Scalar): Scalar {
  if (lambda.decimal.lte(0)) mathError('λ must be positive');
  if (!x.decimal.isInteger()) mathError('x must be integer');
  if (x.decimal.lt(0)) return makeScalar(0, undefined, true);
  if (x.decimal.gt(10000)) mathError('Poisson x too large');
  const cap = x.decimal.toNumber();
  let sum = new D(0);
  for (let k = 0; k <= cap; k++) {
    sum = sum.plus(poissonPmDecimal(k, lambda.decimal));
  }
  return makeScalar(D.min(new D(1), sum), undefined, true);
}
