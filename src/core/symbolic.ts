export interface SurdTerm {
  coef: bigint;
  rad: bigint; // square-free integer >= 1 (rad === 1n represents the rational term)
}

export type SymbolicValue =
  | { kind: 'pi'; n: bigint; d: bigint } // (n / d) * π, d > 0, gcd(|n|, d) = 1, n != 0
  | { kind: 'surd'; a: bigint; b: bigint; rad: bigint; d: bigint } // (a + b*√rad) / d, rad > 1 square-free, b != 0, d > 0
  | { kind: 'multi-surd'; terms: readonly SurdTerm[]; d: bigint }; // (sum coef_i * √rad_i) / d, 2..4 terms, d > 0

export interface RecurringDecimalParts {
  sign: '' | '−';
  intPart: string;
  nonRepeat: string;
  repeat: string;
}

const ZERO = 0n;
const ONE = 1n;
const MAX_SYM_DIGITS = 40;
const MAX_RAD_TERMS = 6;

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

export function lcmBig(a: bigint, b: bigint): bigint {
  a = absBig(a);
  b = absBig(b);
  if (a === ZERO || b === ZERO) return ZERO;
  return (a / gcdBig(a, b)) * b;
}

function isqrtBig(n: bigint): bigint {
  if (n <= ZERO) return ZERO;
  if (n < 4n) return ONE;
  let x = ONE << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const next = (x + n / x) >> ONE;
    if (next >= x) return x;
    x = next;
  }
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
  let steps = 0;
  while (f * f <= rem && steps < 25000) {
    if (rem % f === ZERO) pull(f);
    if (rem % (f + 2n) === ZERO) pull(f + 2n);
    f += 6n;
    steps++;
  }
  if (f * f <= rem) {
    const root = isqrtBig(rem);
    if (root * root === rem) {
      sq *= root;
      rem = ONE;
    }
  }
  return { sq, rem };
}

interface RadSum {
  terms: Map<bigint, bigint>; // rad (square-free >= 1) -> coef (non-zero)
  d: bigint; // positive denominator
}

function smallestPrimeFactor(n: bigint): bigint {
  if (n % 2n === ZERO) return 2n;
  if (n % 3n === ZERO) return 3n;
  let f = 5n;
  while (f * f <= n) {
    if (n % f === ZERO) return f;
    if (n % (f + 2n) === ZERO) return f + 2n;
    f += 6n;
  }
  return n;
}

function toRadSum(item: { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue }): RadSum | null {
  if (item.exact) {
    const m = new Map<bigint, bigint>();
    if (item.exact.n !== ZERO) m.set(ONE, item.exact.n);
    return { terms: m, d: item.exact.d };
  }
  const sym = item.symbolic;
  if (!sym) return null;
  if (sym.kind === 'surd') {
    const m = new Map<bigint, bigint>();
    if (sym.a !== ZERO) m.set(ONE, sym.a);
    if (sym.b !== ZERO) m.set(sym.rad, sym.b);
    return { terms: m, d: sym.d };
  }
  if (sym.kind === 'multi-surd') {
    const m = new Map<bigint, bigint>();
    for (const t of sym.terms) {
      if (t.coef !== ZERO) m.set(t.rad, (m.get(t.rad) ?? ZERO) + t.coef);
    }
    return { terms: m, d: sym.d };
  }
  return null;
}

function fromRadSum(rs: RadSum): { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue } {
  let d = rs.d;
  if (d === ZERO) return {};
  const entries = [...rs.terms.entries()].filter(([, c]) => c !== ZERO);
  if (entries.length === 0) return { exact: { n: ZERO, d: ONE } };
  if (entries.length > 4) return {};

  const sign = d < ZERO ? -ONE : ONE;
  d = absBig(d);
  let g = d;
  for (const [, c] of entries) g = gcdBig(g, c);
  d /= g;

  const cleaned: SurdTerm[] = entries.map(([rad, c]) => ({ rad, coef: (sign * c) / g }));
  if (tooLarge(d, ...cleaned.flatMap((t) => [t.coef, t.rad]))) return {};

  if (cleaned.length === 1 && cleaned[0].rad === ONE) {
    return { exact: { n: cleaned[0].coef, d } };
  }
  if (cleaned.length === 1 && cleaned[0].rad > ONE) {
    return { symbolic: { kind: 'surd', a: ZERO, b: cleaned[0].coef, rad: cleaned[0].rad, d } };
  }
  if (cleaned.length === 2) {
    const rat = cleaned.find((t) => t.rad === ONE);
    const irrat = cleaned.find((t) => t.rad > ONE);
    if (rat && irrat) {
      return { symbolic: { kind: 'surd', a: rat.coef, b: irrat.coef, rad: irrat.rad, d } };
    }
  }

  // Order multi-surd terms: rational first if present, else positive radicals descending (so (√6−√2)/4 matches Calcios!)
  cleaned.sort((p, q) => {
    if (p.rad === ONE) return -1;
    if (q.rad === ONE) return 1;
    if ((p.coef > ZERO) !== (q.coef > ZERO)) return p.coef > ZERO ? -1 : 1;
    return p.rad > q.rad ? -1 : p.rad < q.rad ? 1 : 0;
  });

  return { symbolic: { kind: 'multi-surd', terms: cleaned, d } };
}

function addRadSums(a: RadSum, b: RadSum): RadSum | null {
  const g = gcdBig(a.d, b.d);
  const scaleA = b.d / g;
  const scaleB = a.d / g;
  const d = scaleA * a.d;
  const m = new Map<bigint, bigint>();
  for (const [rad, c] of a.terms) m.set(rad, c * scaleA);
  for (const [rad, c] of b.terms) {
    const next = (m.get(rad) ?? ZERO) + c * scaleB;
    if (next === ZERO) m.delete(rad);
    else m.set(rad, next);
  }
  if (m.size > MAX_RAD_TERMS) return null;
  return { terms: m, d };
}

function mulRadMaps(a: Map<bigint, bigint>, b: Map<bigint, bigint>): Map<bigint, bigint> | null {
  const out = new Map<bigint, bigint>();
  for (const [r1, c1] of a) {
    for (const [r2, c2] of b) {
      const g = gcdBig(r1, r2);
      const newRad = (r1 / g) * (r2 / g);
      const newCoef = c1 * c2 * g;
      const sum = (out.get(newRad) ?? ZERO) + newCoef;
      if (sum === ZERO) out.delete(newRad);
      else out.set(newRad, sum);
      if (out.size > 12) return null;
    }
  }
  return out;
}

function mulRadSums(a: RadSum, b: RadSum): RadSum | null {
  const terms = mulRadMaps(a.terms, b.terms);
  if (!terms || terms.size > MAX_RAD_TERMS) return null;
  return { terms, d: a.d * b.d };
}

function invertRadSum(den: RadSum): RadSum | null {
  if (den.terms.size === 0) return null;
  let numMap = new Map<bigint, bigint>([[ONE, den.d]]);
  let curDen = new Map<bigint, bigint>(den.terms);

  for (let step = 0; step < 6; step++) {
    let maxRad = ONE;
    for (const r of curDen.keys()) {
      if (r > maxRad) maxRad = r;
    }
    if (maxRad === ONE) {
      const intDen = curDen.get(ONE) ?? ZERO;
      if (intDen === ZERO) return null;
      if (intDen < ZERO) {
        const flipped = new Map<bigint, bigint>();
        for (const [r, c] of numMap) flipped.set(r, -c);
        return { terms: flipped, d: -intDen };
      }
      return { terms: numMap, d: intDen };
    }

    const p = smallestPrimeFactor(maxRad);
    // Conjugate with respect to √p: negate all terms whose square-free rad is divisible by p
    const conj = new Map<bigint, bigint>();
    for (const [r, c] of curDen) {
      conj.set(r, r % p === ZERO ? -c : c);
    }
    const nextNum = mulRadMaps(numMap, conj);
    const nextDen = mulRadMaps(curDen, conj);
    if (!nextNum || !nextDen || nextDen.size === 0) return null;

    // Reduce common factor between nextNum and nextDen to prevent coefficient blow-up
    let g = ZERO;
    for (const c of nextNum.values()) g = gcdBig(g, c);
    for (const c of nextDen.values()) g = gcdBig(g, c);
    if (g > ONE) {
      for (const [r, c] of nextNum) nextNum.set(r, c / g);
      for (const [r, c] of nextDen) nextDen.set(r, c / g);
    }
    numMap = nextNum;
    curDen = nextDen;
  }
  return null;
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

/** Denests √((a + b√r)/d) when a^2 - b^2*r is a perfect square >= 0! */
export function symbolicSqrtSurd(
  sym: Extract<SymbolicValue, { kind: 'surd' }>,
): { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue } | null {
  const { a, b, rad, d } = sym;
  if (a <= ZERO) return null;
  const disc = a * a - b * b * rad;
  if (disc < ZERO) return null;
  const c = isqrtBig(disc);
  if (c * c !== disc) return null;

  // √((a + b√r)/d) = √((a+c)/(2d)) + sign(b)*√((a-c)/(2d))
  const term1 = symbolicSqrtRational(a + c, 2n * d);
  const term2 = symbolicSqrtRational(a - c, 2n * d);
  if (!term1 || !term2) return null;
  const s1 = 'rational' in term1 ? { exact: term1.rational } : { symbolic: term1 };
  const s2Raw = 'rational' in term2 ? { exact: term2.rational } : { symbolic: term2 };
  const s2 =
    b < ZERO
      ? s2Raw.exact
        ? { exact: { n: -s2Raw.exact.n, d: s2Raw.exact.d } }
        : { symbolic: negateSymbolic(s2Raw.symbolic!) }
      : s2Raw;
  return addSymbolic(s1, s2);
}

export function negateSymbolic(sym: SymbolicValue): SymbolicValue {
  if (sym.kind === 'pi') return { kind: 'pi', n: -sym.n, d: sym.d };
  if (sym.kind === 'surd') return { kind: 'surd', a: -sym.a, b: -sym.b, rad: sym.rad, d: sym.d };
  return { kind: 'multi-surd', terms: sym.terms.map((t) => ({ rad: t.rad, coef: -t.coef })), d: sym.d };
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

  const ra = toRadSum(left);
  const rb = toRadSum(right);
  if (ra && rb) {
    const sum = addRadSums(ra, rb);
    if (sum) return fromRadSum(sum);
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

  const ra = toRadSum(left);
  const rb = toRadSum(right);
  if (ra && rb) {
    const prod = mulRadSums(ra, rb);
    if (prod) return fromRadSum(prod);
  }
  return {};
}

export function divideSymbolic(
  left: { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue },
  right: { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue },
): { exact?: { n: bigint; d: bigint }; symbolic?: SymbolicValue } {
  const ls = left.symbolic;
  const rs = right.symbolic;

  // (n1/d1 π) / (n2/d2 π) -> exact rational
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

  const ra = toRadSum(left);
  const rb = toRadSum(right);
  if (ra && rb) {
    const invB = invertRadSum(rb);
    if (invB) {
      const quot = mulRadSums(ra, invB);
      if (quot) return fromRadSum(quot);
    }
  }
  return {};
}

/** Exact special-angle trig lookup for ALL multiples of 15° (including 15° & 75°!) */
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
    const neg = m > 180 ? -ONE : ONE;
    const base = m > 180 ? 360 - m : m;
    const acute = base > 90 ? 180 - base : base;
    switch (acute) {
      case 0: return { exact: { n: ZERO, d: ONE } };
      case 15:
        return {
          symbolic: {
            kind: 'multi-surd',
            terms: neg > ZERO
              ? [{ coef: ONE, rad: 6n }, { coef: -ONE, rad: 2n }]
              : [{ coef: ONE, rad: 2n }, { coef: -ONE, rad: 6n }],
            d: 4n,
          },
        };
      case 30: return { exact: { n: neg, d: 2n } };
      case 45: return { symbolic: { kind: 'surd', a: ZERO, b: neg, rad: 2n, d: 2n } };
      case 60: return { symbolic: { kind: 'surd', a: ZERO, b: neg, rad: 3n, d: 2n } };
      case 75:
        return {
          symbolic: {
            kind: 'multi-surd',
            terms: [{ coef: neg, rad: 6n }, { coef: neg, rad: 2n }],
            d: 4n,
          },
        };
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
    } else if (input.symbolic?.kind === 'multi-surd' && input.symbolic.d === 4n && input.symbolic.terms.length === 2) {
      const c6 = input.symbolic.terms.find((t) => t.rad === 6n)?.coef ?? ZERO;
      const c2 = input.symbolic.terms.find((t) => t.rad === 2n)?.coef ?? ZERO;
      if (c6 === ONE && c2 === -ONE) degSin = 15n;
      else if (c6 === -ONE && c2 === ONE) degSin = -15n;
      else if (c6 === ONE && c2 === ONE) degSin = 75n;
      else if (c6 === -ONE && c2 === -ONE) degSin = -75n;
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
  } else if (input.symbolic?.kind === 'surd') {
    const { a, b, rad, d } = input.symbolic;
    if (a === ZERO && rad === 3n && d === 3n && absBig(b) === ONE) return b > ZERO ? 30n : -30n;
    if (a === ZERO && rad === 3n && d === ONE && absBig(b) === ONE) return b > ZERO ? 60n : -60n;
    if (d === ONE && rad === 3n && absBig(a) === 2n && absBig(b) === ONE) {
      if (a === 2n && b === -ONE) return 15n;
      if (a === -2n && b === ONE) return -15n;
      if (a === 2n && b === ONE) return 75n;
      if (a === -2n && b === -ONE) return -75n;
    }
  }
  return null;
}

/** Exact recurring decimal decomposition for rational n/d (when non-terminating & period <= 24). */
export function computeRecurringDecimal(n: bigint, d: bigint): RecurringDecimalParts | null {
  if (d === ZERO) return null;
  if (d < ZERO) {
    n = -n;
    d = -d;
  }
  const g = gcdBig(n, d);
  n /= g;
  d /= g;
  if (d <= ONE) return null;
  const sign: '' | '−' = n < ZERO ? '−' : '';
  const an = absBig(n);

  let m = d;
  let c2 = 0;
  let c5 = 0;
  while (m % 2n === ZERO) { m /= 2n; c2++; }
  while (m % 5n === ZERO) { m /= 5n; c5++; }
  if (m === ONE) return null; // Terminating decimal, not recurring

  const nonRepLen = Math.max(c2, c5);
  if (nonRepLen > 12) return null;

  // Find multiplicative order of 10 mod m (cap at 24 so display fits LCD)
  let period = 0;
  let pow = 10n % m;
  for (let len = 1; len <= 24; len++) {
    if (pow === ONE) {
      period = len;
      break;
    }
    pow = (pow * 10n) % m;
  }
  if (period === 0 || nonRepLen + period > 28) return null;

  const intPart = (an / d).toString();
  let rem = an % d;
  let nonRepeat = '';
  for (let i = 0; i < nonRepLen; i++) {
    rem *= 10n;
    nonRepeat += (rem / d).toString();
    rem %= d;
  }
  let repeat = '';
  for (let i = 0; i < period; i++) {
    rem *= 10n;
    repeat += (rem / d).toString();
    rem %= d;
  }
  return { sign, intPart, nonRepeat, repeat };
}

/** Parses recurring decimal intPart . nonRepeat [repeat]... into exact reduced Rational. */
export function parseRecurringRational(
  intStr: string,
  nonRepeatStr: string,
  repeatStr: string,
): { n: bigint; d: bigint } | null {
  if (
    !/^-?\d*$/.test(intStr) ||
    !/^\d*$/.test(nonRepeatStr) ||
    !/^\d+$/.test(repeatStr) ||
    intStr.length > 18 ||
    nonRepeatStr.length > 18 ||
    repeatStr.length > 24
  ) {
    return null;
  }
  const neg = intStr.startsWith('-');
  const cleanInt = (neg ? intStr.slice(1) : intStr) || '0';
  const fullNum = BigInt(cleanInt + nonRepeatStr + repeatStr);
  const prefixNum = BigInt(cleanInt + nonRepeatStr);
  const num = fullNum - prefixNum;
  const powNon = 10n ** BigInt(nonRepeatStr.length);
  const powRepMinus1 = 10n ** BigInt(repeatStr.length) - ONE;
  const den = powNon * powRepMinus1;
  const g = gcdBig(num, den);
  return { n: (neg ? -num : num) / g, d: den / g };
}
