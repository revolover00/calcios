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

/** 3: aX² + bX + c = 0 (with vertex min/max like fx-95ES / fx-991ES PLUS) */
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
      return { status: 'solved', items: [{ label: 'X', scalar: cleanScalar(shift.neg()) }] };
    }
    const u = halfQ.neg().cbrt();
    const x1 = u.times(2).minus(shift);
    const x2 = u.neg().minus(shift);
    return {
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
    const complexReal = u.plus(v).div(-2).minus(shift);
    const complexImag = u.minus(v).abs().times(new D(3).sqrt()).div(2);
    const [z1, z2] = formatComplex(complexReal, complexImag);
    return {
      status: 'solved',
      items: [
        { label: 'X₁', scalar: cleanScalar(realRoot) },
        { label: 'X₂', complexText: z1 },
        { label: 'X₃', complexText: z2 },
      ],
    };
  }

  // Three distinct real roots via trigonometric method
  const r = thirdP.neg().sqrt();
  const cosArg = D.max(new D(-1), D.min(new D(1), halfQ.neg().div(r.pow(3))));
  const phi = cosArg.acos();
  const pi = D.acos(-1);
  const t1 = r.times(2).times(phi.div(3).cos()).minus(shift);
  const t2 = r.times(2).times(phi.plus(pi.times(2)).div(3).cos()).minus(shift);
  const t3 = r.times(2).times(phi.plus(pi.times(4)).div(3).cos()).minus(shift);

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
