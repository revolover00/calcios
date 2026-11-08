import { mathError } from './errors';
import { formatDecimal, formatResult, formatSymbolicLinear, type DisplayValue } from './format';
import {
  D, add, applyFunction, divide, makeScalar, multiply, negate, scalarFromInteger, scalarPi, subtract,
  type Scalar,
} from './value';

export type EqnType = 'lin2' | 'lin3' | 'quad' | 'cubic';

export interface EqnSolutionItem {
  label: string;
  scalar?: Scalar;
  complexText?: string;
  complexParts?: { re: Scalar; im: Scalar };
}

export type EqnOutcome =
  | { status: 'solved'; items: EqnSolutionItem[] }
  | { status: 'infinite' }
  | { status: 'no-solution' };

function isTiny(s: Scalar): boolean {
  if (s.exact) return s.exact.n === 0n;
  return s.decimal.abs().lt('1e-26');
}

export function snapExactScalar(s: Scalar): Scalar {
  if (s.exact || s.symbolic) return s;
  return cleanScalar(s.decimal);
}

function cleanScalar(d: InstanceType<typeof D>): Scalar {
  const cleaned = d.abs().lt('1e-22') ? new D(0) : d;
  if (cleaned.isZero()) return scalarFromInteger(0);
  if (cleaned.isInteger() && cleaned.abs().lt('1e15')) {
    return scalarFromInteger(BigInt(cleaned.toFixed(0)));
  }
  // Recognize exact small rationals p/q via continued fractions (e.g. -1/2, 2/3 in cubic deflation)
  if (cleaned.abs().lt('1e9')) {
    let x = cleaned.abs();
    let hPrev = 0n;
    let hCur = 1n;
    let kPrev = 1n;
    let kCur = 0n;
    for (let step = 0; step < 12; step++) {
      const fl = x.floor();
      if (fl.gt('1e9')) break;
      const a = BigInt(fl.toFixed(0));
      const hNext = a * hCur + hPrev;
      const kNext = a * kCur + kPrev;
      if (kNext > 10000n) break;
      hPrev = hCur; hCur = hNext;
      kPrev = kCur; kCur = kNext;
      if (kCur > 0n) {
        const approx = new D(hCur.toString()).div(kCur.toString());
        if (cleaned.abs().minus(approx).abs().lt('1e-22')) {
          const signedN = cleaned.isNegative() ? -hCur : hCur;
          return divide(scalarFromInteger(signedN), scalarFromInteger(kCur));
        }
      }
      const frac = x.minus(fl);
      if (frac.lt('1e-20')) break;
      x = new D(1).div(frac);
    }
  }
  // Recognize exact small rational multiples of π (e.g. ±1/2 π in INEQ/EQN)
  const piVal = D.acos(-1);
  const overPi = cleaned.div(piVal);
  for (let q = 1; q <= 24; q++) {
    const prod = overPi.times(q);
    const nearest = prod.round();
    if (!nearest.isZero() && nearest.abs().lte(48) && prod.minus(nearest).abs().lt('1e-24')) {
      return divide(
        multiply(scalarFromInteger(BigInt(nearest.toFixed(0))), scalarPi()),
        scalarFromInteger(BigInt(q)),
      );
    }
  }
  return makeScalar(cleaned, undefined, false);
}

function formatComplex(real: InstanceType<typeof D>, imagAbs: InstanceType<typeof D>): [string, string] {
  const rClean = real.abs().lt('1e-22') ? new D(0) : real;
  const iClean = imagAbs.abs().lt('1e-22') ? new D(0) : imagAbs;
  const rStr = formatDecimal(makeScalar(rClean, undefined, true));
  const iStr = iClean.eq(1) ? '' : formatDecimal(makeScalar(iClean, undefined, true));
  if (rClean.isZero()) {
    return [`${iStr}i`, `−${iStr}i`];
  }
  return [`${rStr}+${iStr}i`, `${rStr}−${iStr}i`];
}

/** 1: a1*X + b1*Y = c1, a2*X + b2*Y = c2 */
export function solveLinear2(coeffs: Scalar[]): EqnOutcome {
  const [a1, b1, c1, a2, b2, c2] = coeffs;
  const det = subtract(multiply(a1, b2), multiply(b1, a2));
  const dx = subtract(multiply(c1, b2), multiply(b1, c2));
  const dy = subtract(multiply(a1, c2), multiply(c1, a2));
  if (isTiny(det)) {
    if (isTiny(dx) && isTiny(dy)) {
      if (isTiny(a1) && isTiny(b1) && !isTiny(c1)) return { status: 'no-solution' };
      if (isTiny(a2) && isTiny(b2) && !isTiny(c2)) return { status: 'no-solution' };
      return { status: 'infinite' };
    }
    return { status: 'no-solution' };
  }
  return {
    status: 'solved',
    items: [
      { label: 'X', scalar: divide(dx, det) },
      { label: 'Y', scalar: divide(dy, det) },
    ],
  };
}

/** 2: 3x3 linear system using Gaussian elimination with partial pivoting */
export function solveLinear3(coeffs: Scalar[]): EqnOutcome {
  const m: Scalar[][] = [
    [coeffs[0], coeffs[1], coeffs[2], coeffs[3]],
    [coeffs[4], coeffs[5], coeffs[6], coeffs[7]],
    [coeffs[8], coeffs[9], coeffs[10], coeffs[11]],
  ];

  let row = 0;
  const pivotCols: number[] = [];
  for (let col = 0; col < 3 && row < 3; col++) {
    let best = row;
    for (let r = row + 1; r < 3; r++) {
      if (m[r][col].decimal.abs().gt(m[best][col].decimal.abs())) best = r;
    }
    if (isTiny(m[best][col])) continue;
    [m[row], m[best]] = [m[best], m[row]];
    const pivot = m[row][col];
    for (let c = col; c < 4; c++) m[row][c] = divide(m[row][c], pivot);
    for (let r = 0; r < 3; r++) {
      if (r === row || isTiny(m[r][col])) continue;
      const factor = m[r][col];
      for (let c = col; c < 4; c++) {
        m[r][c] = subtract(m[r][c], multiply(factor, m[row][c]));
      }
    }
    pivotCols.push(col);
    row++;
  }

  for (let r = row; r < 3; r++) {
    if (!isTiny(m[r][3])) return { status: 'no-solution' };
  }
  if (pivotCols.length < 3) return { status: 'infinite' };

  return {
    status: 'solved',
    items: [
      { label: 'X', scalar: m[0][3] },
      { label: 'Y', scalar: m[1][3] },
      { label: 'Z', scalar: m[2][3] },
    ],
  };
}

/** 3: aX² + bX + c = 0 (with vertex min/max like Calcios / Calcios) */
export function solveQuadratic(coeffs: Scalar[]): EqnOutcome {
  const [a, b, c] = coeffs;
  if (isTiny(a)) mathError('Leading coefficient a cannot be zero');

  const twoA = multiply(scalarFromInteger(2), a);
  const fourAC = multiply(multiply(scalarFromInteger(4), a), c);
  const disc = subtract(multiply(b, b), fourAC);
  const vx = negate(divide(b, twoA));
  const vy = subtract(c, divide(multiply(b, b), multiply(scalarFromInteger(4), a)));
  const extremumKind = a.decimal.gt(0) ? 'Minimum' : 'Maximum';

  const items: EqnSolutionItem[] = [];
  if (isTiny(disc)) {
    items.push({ label: 'X', scalar: snapExactScalar(vx) });
  } else if (disc.decimal.gt(0)) {
    const sq = applyFunction('sqrt', [disc], 'DEG');
    const r1 = snapExactScalar(divide(add(negate(b), sq), twoA));
    const r2 = snapExactScalar(divide(subtract(negate(b), sq), twoA));
    items.push({ label: 'X₁', scalar: r1 });
    items.push({ label: 'X₂', scalar: r2 });
  } else {
    const realS = divide(negate(b), twoA);
    const absTwoA = twoA.decimal.isNegative() ? negate(twoA) : twoA;
    const imagS = divide(applyFunction('sqrt', [negate(disc)], 'DEG'), absTwoA);
    const rSym = formatSymbolicLinear(realS);
    const iSym = formatSymbolicLinear(imagS);
    if (rSym !== null && iSym !== null) {
      const iPart = iSym === '1' ? 'i' : iSym.includes('+') || iSym.includes('−') ? `(${iSym})i` : `${iSym}i`;
      if (realS.decimal.abs().lt('1e-24')) {
        items.push({ label: 'X₁', complexText: iPart, complexParts: { re: realS, im: imagS } });
        items.push({ label: 'X₂', complexText: `−${iPart}`, complexParts: { re: realS, im: negate(imagS) } });
      } else {
        items.push({ label: 'X₁', complexText: `${rSym}+${iPart}`, complexParts: { re: realS, im: imagS } });
        items.push({ label: 'X₂', complexText: `${rSym}−${iPart}`, complexParts: { re: realS, im: negate(imagS) } });
      }
    } else {
      const [c1, c2] = formatComplex(realS.decimal, imagS.decimal.abs());
      items.push({ label: 'X₁', complexText: c1, complexParts: { re: realS, im: imagS } });
      items.push({ label: 'X₂', complexText: c2, complexParts: { re: realS, im: negate(imagS) } });
    }
  }

  items.push({ label: `X-Value ${extremumKind}`, scalar: vx });
  items.push({ label: `Y-Value ${extremumKind}`, scalar: vy });

  return { status: 'solved', items };
}

function buildComplexConjugatePair(
  realS: Scalar,
  imagPosS: Scalar,
  label1: string,
  label2: string,
): [EqnSolutionItem, EqnSolutionItem] {
  const rSym = formatSymbolicLinear(realS);
  const iSym = formatSymbolicLinear(imagPosS);
  if (rSym !== null && iSym !== null) {
    const iPart = iSym === '1' ? 'i' : iSym.includes('+') || iSym.includes('−') ? `(${iSym})i` : `${iSym}i`;
    if (realS.decimal.abs().lt('1e-24')) {
      return [
        { label: label1, complexText: iPart, complexParts: { re: realS, im: imagPosS } },
        { label: label2, complexText: `−${iPart}`, complexParts: { re: realS, im: negate(imagPosS) } },
      ];
    }
    return [
      { label: label1, complexText: `${rSym}+${iPart}`, complexParts: { re: realS, im: imagPosS } },
      { label: label2, complexText: `${rSym}−${iPart}`, complexParts: { re: realS, im: negate(imagPosS) } },
    ];
  }
  const [c1, c2] = formatComplex(realS.decimal, imagPosS.decimal.abs());
  return [
    { label: label1, complexText: c1, complexParts: { re: realS, im: imagPosS } },
    { label: label2, complexText: c2, complexParts: { re: realS, im: negate(imagPosS) } },
  ];
}

function tryDeflateCubicWithExactRoot(coeffs: Scalar[], approxCandidates: InstanceType<typeof D>[]): EqnOutcome | null {
  const [aS, bS, cS, dS] = coeffs;
  for (const cand of approxCandidates) {
    const rExact = cleanScalar(cand);
    if (!rExact.exact && !rExact.symbolic) continue;
    // Horner check: ((a * r + b) * r + c) * r + d === 0
    const q1 = add(multiply(aS, rExact), bS);
    const q0 = add(multiply(q1, rExact), cS);
    const rem = add(multiply(q0, rExact), dS);
    const scale = aS.decimal.abs().plus(bS.decimal.abs()).plus(cS.decimal.abs()).plus(dS.decimal.abs()).plus(1);
    if (!isTiny(rem) && rem.decimal.abs().gt(scale.times('1e-22'))) continue;

    // Deflated quadratic: aS * X^2 + q1 * X + q0 = 0
    const twoA = multiply(scalarFromInteger(2), aS);
    const disc = subtract(multiply(q1, q1), multiply(multiply(scalarFromInteger(4), aS), q0));
    if (isTiny(disc)) {
      const rDouble = snapExactScalar(divide(negate(q1), twoA));
      if (rExact.decimal.minus(rDouble.decimal).abs().lt('1e-20')) {
        return { status: 'solved', items: [{ label: 'X', scalar: rExact }] };
      }
      return {
        status: 'solved',
        items: [
          { label: 'X₁', scalar: rExact },
          { label: 'X₂', scalar: rDouble },
        ],
      };
    }
    if (disc.decimal.gt(0)) {
      const sq = applyFunction('sqrt', [disc], 'DEG');
      const r2 = snapExactScalar(divide(add(negate(q1), sq), twoA));
      const r3 = snapExactScalar(divide(subtract(negate(q1), sq), twoA));
      const allReal = [rExact, r2, r3];
      const unique: Scalar[] = [];
      for (const rt of allReal) {
        if (!unique.some((u) => u.decimal.minus(rt.decimal).abs().lt('1e-20'))) {
          unique.push(rt);
        }
      }
      if (unique.length === 1) return { status: 'solved', items: [{ label: 'X', scalar: unique[0] }] };
      if (unique.length === 2) {
        return {
          status: 'solved',
          items: [
            { label: 'X₁', scalar: unique[0] },
            { label: 'X₂', scalar: unique[1] },
          ],
        };
      }
      return {
        status: 'solved',
        items: [
          { label: 'X₁', scalar: unique[0] },
          { label: 'X₂', scalar: unique[1] },
          { label: 'X₃', scalar: unique[2] },
        ],
      };
    }
    const realPart = divide(negate(q1), twoA);
    const absTwoA = twoA.decimal.isNegative() ? negate(twoA) : twoA;
    const imagPos = divide(applyFunction('sqrt', [negate(disc)], 'DEG'), absTwoA);
    const [z2, z3] = buildComplexConjugatePair(realPart, imagPos, 'X₂', 'X₃');
    return {
      status: 'solved',
      items: [{ label: 'X₁', scalar: rExact }, z2, z3],
    };
  }
  return null;
}

/** 4: aX³ + bX² + cX + d = 0 */
export function solveCubic(coeffs: Scalar[]): EqnOutcome {
  const [aS, bS, cS, dS] = coeffs;
  if (isTiny(aS)) mathError('Leading coefficient a cannot be zero');

  const a = aS.decimal;
  const b = bS.decimal.div(a);
  const c = cS.decimal.div(a);
  const d = dS.decimal.div(a);

  const shift = b.div(3);
  const p = c.minus(b.pow(2).div(3));
  const q = b.pow(3).times(2).div(27).minus(b.times(c).div(3)).plus(d);

  const halfQ = q.div(2);
  const thirdP = p.div(3);
  const disc = halfQ.pow(2).plus(thirdP.pow(3));

  if (disc.abs().lte('1e-24')) {
    if (p.abs().lte('1e-24')) {
      const triple = shift.neg();
      return tryDeflateCubicWithExactRoot(coeffs, [triple]) ?? {
        status: 'solved',
        items: [{ label: 'X', scalar: cleanScalar(triple) }],
      };
    }
    const u = halfQ.neg().cbrt();
    const x1 = u.times(2).minus(shift);
    const x2 = u.neg().minus(shift);
    return tryDeflateCubicWithExactRoot(coeffs, [x1, x2]) ?? {
      status: 'solved',
      items: [
        { label: 'X₁', scalar: cleanScalar(x1) },
        { label: 'X₂', scalar: cleanScalar(x2) },
      ],
    };
  }

  if (disc.gt(0)) {
    const sqrtD = disc.sqrt();
    const u = halfQ.neg().plus(sqrtD).cbrt();
    const v = halfQ.neg().minus(sqrtD).cbrt();
    const realRoot = u.plus(v).minus(shift);
    const deflated = tryDeflateCubicWithExactRoot(coeffs, [realRoot]);
    if (deflated) return deflated;

    const complexReal = u.plus(v).div(-2).minus(shift);
    const complexImag = u.minus(v).abs().times(new D(3).sqrt()).div(2);
    const reScalar = cleanScalar(complexReal);
    const imScalar = makeScalar(complexImag, undefined, true);
    const [z2, z3] = buildComplexConjugatePair(reScalar, imScalar, 'X₂', 'X₃');
    return {
      status: 'solved',
      items: [
        { label: 'X₁', scalar: cleanScalar(realRoot) },
        z2,
        z3,
      ],
    };
  }

  // Three distinct real roots via trigonometric method (+ exact symbolic deflation when a rational root exists!)
  const r = thirdP.neg().sqrt();
  const cosArg = D.max(new D(-1), D.min(new D(1), halfQ.neg().div(r.pow(3))));
  const phi = cosArg.acos();
  const pi = D.acos(-1);
  const t1 = r.times(2).times(phi.div(3).cos()).minus(shift);
  const t2 = r.times(2).times(phi.plus(pi.times(2)).div(3).cos()).minus(shift);
  const t3 = r.times(2).times(phi.plus(pi.times(4)).div(3).cos()).minus(shift);

  const deflated = tryDeflateCubicWithExactRoot(coeffs, [t1, t2, t3]);
  if (deflated) return deflated;

  return {
    status: 'solved',
    items: [
      { label: 'X₁', scalar: cleanScalar(t1) },
      { label: 'X₂', scalar: cleanScalar(t2) },
      { label: 'X₃', scalar: cleanScalar(t3) },
    ],
  };
}

export function solveEqn(type: EqnType, coeffs: Scalar[]): EqnOutcome {
  switch (type) {
    case 'lin2': return solveLinear2(coeffs);
    case 'lin3': return solveLinear3(coeffs);
    case 'quad': return solveQuadratic(coeffs);
    case 'cubic': return solveCubic(coeffs);
  }
}

export function formatEqnItem(item: EqnSolutionItem, preferExact: boolean): DisplayValue {
  if (item.complexText !== undefined) return { type: 'text', text: item.complexText };
  if (!item.scalar) return { type: 'text', text: '0' };
  return formatResult(item.scalar, preferExact ? 'exact' : 'decimal');
}
