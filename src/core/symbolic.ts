export type SymbolicValue =
  | { kind: 'pi'; n: bigint; d: bigint } // (n / d) * π, d > 0, gcd(|n|, d) = 1, n != 0
  | { kind: 'surd'; a: bigint; b: bigint; rad: bigint; d: bigint }; // (a + b*√rad) / d, rad > 1 square-free, b != 0, d > 0

const ZERO = 0n;
const ONE = 1n;
const MAX_SYM_DIGITS = 40;

function absBig(x: bigint): bigint {
  return x < ZERO ? -x : x;
}

export function gcdBig(a: bigint, b: bigint): bigint {
  a = absBig(a);
  b = absBig(b);
  while (b !== ZERO) {
    [a, b] = [b, a % b];
  }
  return a;
}

function tooLarge(...nums: bigint[]): boolean {
  return nums.some((x) => absBig(x).toString().length > MAX_SYM_DIGITS);
}

export function makePiMultiple(n: bigint, d = ONE): SymbolicValue | { rationalZero: true } | undefined {
  if (d === ZERO) return undefined;
  if (n === ZERO) return { rationalZero: true };
  if (d < ZERO) { n = -n; d = -d; }
  const g = gcdBig(n, d);
  n /= g;
  d /= g;
  if (tooLarge(n, d)) return undefined;
  return { kind: 'pi', n, d };
}

/** Extracts largest square factor from positive integer n <= 10^12: n = sq^2 * rem */
export function extractSquareFactor(n: bigint): { sq: bigint; rem: bigint } | undefined {
  if (n <= ZERO) return undefined;
  if (n === ONE) return { sq: ONE, rem: ONE };
  if (n > 1_000_000_000_000n) return undefined;

  let sq = ONE;
  let rem = n;

  const pull = (p: bigint) => {
    let count = 0;
    while (rem % p === ZERO) {
      rem /= p;
      count++;
    }
    if (count >= 2) sq *= p ** BigInt(Math.floor(count / 2));
    if (count % 2 === 1) rem *= p;
  };

  pull(2n);
  pull(3n);
  let f = 5n;
  // Cap trial division so huge primes never stall
  let steps = 0;
  while (f * f <= rem && steps < 25000) {
    if (rem % f === ZERO) pull(f);
    if (rem % (f + 2n) === ZERO) pull(f + 2n);
    f += 6n;
    steps++;
  }
  if (f * f <= rem) {
    // Check if remaining cofactor is a perfect square
    let x = 1n << BigInt(Math.ceil(rem.toString(2).length / 2));
    for (;;) {
      const next = (x + rem / x) >> 1n;
      if (next >= x) break;
      x = next;
    }
    if (x * x === rem) {
      sq *= x;
      rem = ONE;
    }
  }
  return { sq, rem };
}

export function normalizeSurd(
  a: bigint,
  b: bigint,
  rad: bigint,
  d: bigint,
): SymbolicValue | { rational: { n: bigint; d: bigint } } | undefined {
  if (d === ZERO || rad <= ZERO) return undefined;
  if (d < ZERO) {
    a = -a;
    b = -b;
    d = -d;
  }
  if (b === ZERO || rad === ONE) {
    const n = rad === ONE ? a + b : a;
    const g = gcdBig(n, d);
    const rn = n / g;
    const rd = d / g;
    if (tooLarge(rn, rd)) return undefined;
    return { rational: { n: rn, d: rd } };
  }

  const sqf = extractSquareFactor(rad);
  if (!sqf) return undefined;
  b *= sqf.sq;
  rad = sqf.rem;
  if (rad === ONE) {
    const n = a + b;
    const g = gcdBig(n, d);
    return { rational: { n: n / g, d: d / g } };
  }

  const g = gcdBig(gcdBig(a, b), d);
  a /= g;
  b /= g;
  d /= g;
  if (tooLarge(a, b, rad, d)) return undefined;
  return { kind: 'surd', a, b, rad, d };
}

export function symbolicSqrtRational(n: bigint, d: bigint): SymbolicValue | { rational: { n: bigint; d: bigint } } | undefined {
  if (n < ZERO || d <= ZERO) return undefined;
  if (n === ZERO) return { rational: { n: ZERO, d: ONE } };
  const prod = n * d;
  if (prod > 1_000_000_000_000n) return undefined;
  const sqf = extractSquareFactor(prod);
  if (!sqf) return undefined;
  return normalizeSurd(ZERO, sqf.sq, sqf.rem, d);
}

export function negateSymbolic(sym: SymbolicValue): SymbolicValue {
  if (sym.kind === 'pi') return { kind: 'pi', n: -sym.n, d: sym.d };
  return { kind: 'surd', a: -sym.a, b: -sym.b, rad: sym.rad, d: sym.d };
}

export function addSymbolic(
  left: { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue },
  right: { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue },
): { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue } {
  const ls = left.symbolic;
  const rs = right.symbolic;

  // π + π (or 0 + π)
  if (ls?.kind === 'pi' && rs?.kind === 'pi') {
    const out = makePiMultiple(ls.n * rs.d + rs.n * ls.d, ls.d * rs.d);
    if (!out) return {};
    if ('rationalZero' in out) return { exact: { n: ZERO, d: ONE } };
    return { symbolic: out };
  }
  if (ls?.kind === 'pi' && right.exact?.n === ZERO) return { symbolic: ls };
  if (rs?.kind === 'pi' && left.exact?.n === ZERO) return { symbolic: rs };

  // Surd + Rational
  if (ls?.kind === 'surd' && right.exact) {
    const norm = normalizeSurd(ls.a * right.exact.d + right.exact.n * ls.d, ls.b * right.exact.d, ls.rad, ls.d * right.exact.d);
    if (!norm) return {};
    return 'rational' in norm ? { exact: norm.rational } : { symbolic: norm };
  }
  if (rs?.kind === 'surd' && left.exact) {
    const norm = normalizeSurd(left.exact.n * rs.d + rs.a * left.exact.d, rs.b * left.exact.d, rs.rad, rs.d * left.exact.d);
    if (!norm) return {};
    return 'rational' in norm ? { exact: norm.rational } : { symbolic: norm };
  }
  // Surd + Surd with matching radicand
  if (ls?.kind === 'surd' && rs?.kind === 'surd' && ls.rad === rs.rad) {
    const norm = normalizeSurd(
      ls.a * rs.d + rs.a * ls.d,
      ls.b * rs.d + rs.b * ls.d,
      ls.rad,
      ls.d * rs.d,
    );
    if (!norm) return {};
    return 'rational' in norm ? { exact: norm.rational } : { symbolic: norm };
  }

  return {};
}

export function multiplySymbolic(
  left: { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue },
  right: { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue },
): { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue } {
  const ls = left.symbolic;
  const rs = right.symbolic;

  // Rational * π
  if (ls?.kind === 'pi' && right.exact) {
    const out = makePiMultiple(ls.n * right.exact.n, ls.d * right.exact.d);
    if (!out) return {};
    return 'rationalZero' in out ? { exact: { n: ZERO, d: ONE } } : { symbolic: out };
  }
  if (rs?.kind === 'pi' && left.exact) {
    const out = makePiMultiple(rs.n * left.exact.n, rs.d * left.exact.d);
    if (!out) return {};
    return 'rationalZero' in out ? { exact: { n: ZERO, d: ONE } } : { symbolic: out };
  }

  // Rational * Surd
  if (ls?.kind === 'surd' && right.exact) {
    const norm = normalizeSurd(ls.a * right.exact.n, ls.b * right.exact.n, ls.rad, ls.d * right.exact.d);
    if (!norm) return {};
    return 'rational' in norm ? { exact: norm.rational } : { symbolic: norm };
  }
  if (rs?.kind === 'surd' && left.exact) {
    const norm = normalizeSurd(rs.a * left.exact.n, rs.b * left.exact.n, rs.rad, rs.d * left.exact.d);
    if (!norm) return {};
    return 'rational' in norm ? { exact: norm.rational } : { symbolic: norm };
  }

  // Surd * Surd
  if (ls?.kind === 'surd' && rs?.kind === 'surd') {
    if (ls.rad === rs.rad) {
      const a = ls.a * rs.a + ls.b * rs.b * ls.rad;
      const b = ls.a * rs.b + ls.b * rs.a;
      const norm = normalizeSurd(a, b, ls.rad, ls.d * rs.d);
      if (!norm) return {};
      return 'rational' in norm ? { exact: norm.rational } : { symbolic: norm };
    }
    if (ls.a === ZERO && rs.a === ZERO) {
      const norm = normalizeSurd(ZERO, ls.b * rs.b, ls.rad * rs.rad, ls.d * rs.d);
      if (!norm) return {};
      return 'rational' in norm ? { exact: norm.rational } : { symbolic: norm };
    }
  }

  return {};
}

export function divideSymbolic(
  left: { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue },
  right: { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue },
): { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue } {
  const ls = left.symbolic;
  const rs = right.symbolic;

  // (n1/d1 π) / (n2/d2 π) -> exact rational!
  if (ls?.kind === 'pi' && rs?.kind === 'pi') {
    const num = ls.n * rs.d;
    const den = ls.d * rs.n;
    if (den === ZERO) return {};
    const sign = den < ZERO ? -ONE : ONE;
    const g = gcdBig(num, den);
    return { exact: { n: (sign * num) / g, d: absBig(den) / g } };
  }

  // (n1/d1 π) / rational
  if (ls?.kind === 'pi' && right.exact && right.exact.n !== ZERO) {
    const out = makePiMultiple(ls.n * right.exact.d, ls.d * right.exact.n);
    if (!out) return {};
    return 'rationalZero' in out ? { exact: { n: ZERO, d: ONE } } : { symbolic: out };
  }

  // Divide by surd: rationalize denominator (a - b√r)
  if (rs?.kind === 'surd') {
    const conjDen = rs.a * rs.a - rs.b * rs.b * rs.rad;
    if (conjDen === ZERO) return {};
    // 1 / rs = rs.d * (rs.a - rs.b√r) / conjDen
    const invNorm = normalizeSurd(rs.d * rs.a, -rs.d * rs.b, rs.rad, conjDen);
    if (!invNorm) return {};
    const inv = 'rational' in invNorm ? { exact: invNorm.rational } : { symbolic: invNorm };
    return multiplySymbolic(left, inv);
  }

  // Surd / Rational
  if (ls?.kind === 'surd' && right.exact && right.exact.n !== ZERO) {
    const norm = normalizeSurd(ls.a * right.exact.d, ls.b * right.exact.d, ls.rad, ls.d * right.exact.n);
    if (!norm) return {};
    return 'rational' in norm ? { exact: norm.rational } : { symbolic: norm };
  }

  return {};
}

/** Exact special-angle trig lookup for integer/half-integer degrees mod 360 */
export function exactTrigDegrees(
  fn: 'sin' | 'cos' | 'tan',
  degNum: bigint,
  degDen: bigint,
): { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue } | null {
  if (degDen !== ONE) return null;
  const mod = ((degNum % 360n) + 360n) % 360n;
  const m = Number(mod);

  if (fn === 'cos') {
    return exactTrigDegrees('sin', degNum + 90n, ONE);
  }

  if (fn === 'sin') {
    // Map to [0, 180] with sign
    const neg = m > 180 ? -ONE : ONE;
    const base = m > 180 ? 360 - m : m;
    const acute = base > 90 ? 180 - base : base;
    switch (acute) {
      case 0: return { exact: { n: ZERO, d: ONE } };
      case 30: return { exact: { n: neg, d: 2n } };
      case 45: return { symbolic: { kind: 'surd', a: ZERO, b: neg, rad: 2n, d: 2n } };
      case 60: return { symbolic: { kind: 'surd', a: ZERO, b: neg, rad: 3n, d: 2n } };
      case 90: return { exact: { n: neg, d: ONE } };
      default: return null;
    }
  }

  // tan (period 180)
  const tMod = m % 180;
  const neg = tMod > 90 ? -ONE : ONE;
  const acute = tMod > 90 ? 180 - tMod : tMod;
  switch (acute) {
    case 0: return { exact: { n: ZERO, d: ONE } };
    case 15: return { symbolic: { kind: 'surd', a: 2n * neg, b: -neg, rad: 3n, d: ONE } };
    case 30: return { symbolic: { kind: 'surd', a: ZERO, b: neg, rad: 3n, d: 3n } };
    case 45: return { exact: { n: neg, d: ONE } };
    case 60: return { symbolic: { kind: 'surd', a: ZERO, b: neg, rad: 3n, d: ONE } };
    case 75: return { symbolic: { kind: 'surd', a: 2n * neg, b: neg, rad: 3n, d: ONE } };
    default: return null;
  }
}

/** Exact inverse trig returning exact degrees in [-90..90] or [0..180] */
export function exactInverseTrigDegrees(
  fn: 'asin' | 'acos' | 'atan',
  input: { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue },
): bigint | null {
  if (fn === 'asin' || fn === 'acos') {
    let degSin: bigint | null = null;
    if (input.exact) {
      const { n, d } = input.exact;
      if (n === ZERO && d === ONE) degSin = 0n;
      else if (n === ONE && d === 2n) degSin = 30n;
      else if (n === -ONE && d === 2n) degSin = -30n;
      else if (n === ONE && d === ONE) degSin = 90n;
      else if (n === -ONE && d === ONE) degSin = -90n;
    } else if (input.symbolic?.kind === 'surd' && input.symbolic.a === ZERO && input.symbolic.d === 2n) {
      const { b, rad } = input.symbolic;
      if (rad === 2n && absBig(b) === ONE) degSin = b > ZERO ? 45n : -45n;
      if (rad === 3n && absBig(b) === ONE) degSin = b > ZERO ? 60n : -60n;
    }
    if (degSin === null) return null;
    return fn === 'asin' ? degSin : 90n - degSin;
  }

  // atan
  if (input.exact) {
    const { n, d } = input.exact;
    if (n === ZERO && d === ONE) return 0n;
    if (n === ONE && d === ONE) return 45n;
    if (n === -ONE && d === ONE) return -45n;
  } else if (input.symbolic?.kind === 'surd' && input.symbolic.a === ZERO) {
    const { b, rad, d } = input.symbolic;
    if (rad === 3n && d === 3n && absBig(b) === ONE) return b > ZERO ? 30n : -30n;
    if (rad === 3n && d === ONE && absBig(b) === ONE) return b > ZERO ? 60n : -60n;
  }
  return null;
}
