import { mathError } from './errors';
import { D, makeScalar, type Scalar } from './value';

export type StatSubMode =
  | '1-VAR'
  | 'A+BX'
  | '_+CX2'
  | 'LN_X'
  | 'E_X'
  | 'AB_X'
  | 'AX_B'
  | 'INV_X';

export interface StatRow {
  x: string;
  y?: string;
  freq: string;
}

export interface StatSummary {
  n: Scalar;
  sumX: Scalar;
  sumX2: Scalar;
  meanX: Scalar;
  popSdX: Scalar;
  sampSdX: Scalar;
  minX: Scalar;
  maxX: Scalar;
  q1?: Scalar;
  med?: Scalar;
  q3?: Scalar;
  // 2-variable fields
  sumY?: Scalar;
  sumY2?: Scalar;
  sumXY?: Scalar;
  sumX3?: Scalar;
  sumX2Y?: Scalar;
  sumX4?: Scalar;
  meanY?: Scalar;
  popSdY?: Scalar;
  sampSdY?: Scalar;
  minY?: Scalar;
  maxY?: Scalar;
  regA?: Scalar;
  regB?: Scalar;
  regC?: Scalar;
  corrR?: Scalar;
}

function sc(v: InstanceType<typeof D>): Scalar {
  const clean = v.abs().lt('1e-24') ? new D(0) : v;
  return makeScalar(clean, undefined, true);
}

function medianSlice(sorted: InstanceType<typeof D>[]): InstanceType<typeof D> {
  const m = sorted.length;
  if (m === 0) mathError('Empty stat data');
  const mid = Math.floor(m / 2);
  return m % 2 === 1 ? sorted[mid] : sorted[mid - 1].plus(sorted[mid]).div(2);
}

export function computeStatSummary(subMode: StatSubMode, rows: StatRow[]): StatSummary {
  if (rows.length === 0) mathError('No statistical data');
  const is1Var = subMode === '1-VAR';

  let n = new D(0);
  let sumX = new D(0);
  let sumX2 = new D(0);
  let sumX3 = new D(0);
  let sumX4 = new D(0);
  let sumY = new D(0);
  let sumY2 = new D(0);
  let sumXY = new D(0);
  let sumX2Y = new D(0);

  let minX: InstanceType<typeof D> | null = null;
  let maxX: InstanceType<typeof D> | null = null;
  let minY: InstanceType<typeof D> | null = null;
  let maxY: InstanceType<typeof D> | null = null;

  const expandedX: InstanceType<typeof D>[] = [];
  const transformedPairs: Array<{ tx: InstanceType<typeof D>; ty: InstanceType<typeof D>; f: InstanceType<typeof D> }> = [];

  for (const row of rows) {
    const x = new D(row.x || '0');
    const y = new D(row.y || '0');
    const f = new D(row.freq || '1');
    if (f.lt(0) || !f.isInteger()) mathError('Invalid frequency');
    if (f.isZero()) continue;

    n = n.plus(f);
    sumX = sumX.plus(x.times(f));
    sumX2 = sumX2.plus(x.pow(2).times(f));
    if (minX === null || x.lt(minX)) minX = x;
    if (maxX === null || x.gt(maxX)) maxX = x;

    if (is1Var && f.lte(500) && expandedX.length < 2000) {
      const count = f.toNumber();
      for (let k = 0; k < count; k++) expandedX.push(x);
    }

    if (!is1Var) {
      sumY = sumY.plus(y.times(f));
      sumY2 = sumY2.plus(y.pow(2).times(f));
      sumXY = sumXY.plus(x.times(y).times(f));
      sumX3 = sumX3.plus(x.pow(3).times(f));
      sumX4 = sumX4.plus(x.pow(4).times(f));
      sumX2Y = sumX2Y.plus(x.pow(2).times(y).times(f));
      if (minY === null || y.lt(minY)) minY = y;
      if (maxY === null || y.gt(maxY)) maxY = y;

      if (subMode !== '_+CX2') {
        let tx = x;
        let ty = y;
        if (subMode === 'LN_X' || subMode === 'AX_B') {
          if (x.lte(0)) mathError('Domain error in regression X');
          tx = x.ln();
        } else if (subMode === 'INV_X') {
          if (x.isZero()) mathError('Zero X in 1/X regression');
          tx = new D(1).div(x);
        }
        if (subMode === 'E_X' || subMode === 'AB_X' || subMode === 'AX_B') {
          if (y.lte(0)) mathError('Domain error in regression Y');
          ty = y.ln();
        }
        transformedPairs.push({ tx, ty, f });
      }
    }
  }

  if (n.isZero() || minX === null || maxX === null) mathError('Empty statistical dataset');

  const meanX = sumX.div(n);
  const varPopX = D.max(new D(0), sumX2.div(n).minus(meanX.pow(2)));
  const popSdX = varPopX.sqrt();
  const sampSdX = n.gt(1)
    ? D.max(new D(0), sumX2.minus(n.times(meanX.pow(2))).div(n.minus(1))).sqrt()
    : new D(0);

  const summary: StatSummary = {
    n: sc(n),
    sumX: sc(sumX),
    sumX2: sc(sumX2),
    meanX: sc(meanX),
    popSdX: sc(popSdX),
    sampSdX: n.gt(1) ? sc(sampSdX) : sc(new D(0)),
    minX: sc(minX),
    maxX: sc(maxX),
  };

  if (is1Var && expandedX.length > 0) {
    expandedX.sort((a, b) => a.comparedTo(b));
    const len = expandedX.length;
    const med = medianSlice(expandedX);
    const lowerHalf = expandedX.slice(0, Math.floor(len / 2));
    const upperHalf = expandedX.slice(Math.ceil(len / 2));
    summary.med = sc(med);
    summary.q1 = sc(lowerHalf.length ? medianSlice(lowerHalf) : med);
    summary.q3 = sc(upperHalf.length ? medianSlice(upperHalf) : med);
    return summary;
  }

  if (!is1Var && minY !== null && maxY !== null) {
    const meanY = sumY.div(n);
    const varPopY = D.max(new D(0), sumY2.div(n).minus(meanY.pow(2)));
    const popSdY = varPopY.sqrt();
    const sampSdY = n.gt(1)
      ? D.max(new D(0), sumY2.minus(n.times(meanY.pow(2))).div(n.minus(1))).sqrt()
      : new D(0);

    summary.sumY = sc(sumY);
    summary.sumY2 = sc(sumY2);
    summary.sumXY = sc(sumXY);
    summary.sumX3 = sc(sumX3);
    summary.sumX4 = sc(sumX4);
    summary.sumX2Y = sc(sumX2Y);
    summary.meanY = sc(meanY);
    summary.popSdY = sc(popSdY);
    summary.sampSdY = sc(sampSdY);
    summary.minY = sc(minY);
    summary.maxY = sc(maxY);

    if (subMode === '_+CX2') {
      // Solve 3x3 normal equations:
      // [ n     sumX   sumX2 ] [ A ]   [ sumY   ]
      // [ sumX  sumX2  sumX3 ] [ B ] = [ sumXY  ]
      // [ sumX2 sumX3  sumX4 ] [ C ]   [ sumX2Y ]
      const mat = [
        [n, sumX, sumX2, sumY],
        [sumX, sumX2, sumX3, sumXY],
        [sumX2, sumX3, sumX4, sumX2Y],
      ];
      for (let col = 0; col < 3; col++) {
        let best = col;
        for (let r = col + 1; r < 3; r++) {
          if (mat[r][col].abs().gt(mat[best][col].abs())) best = r;
        }
        if (mat[best][col].abs().lt('1e-26')) continue;
        [mat[col], mat[best]] = [mat[best], mat[col]];
        const piv = mat[col][col];
        for (let c = col; c < 4; c++) mat[col][c] = mat[col][c].div(piv);
        for (let r = 0; r < 3; r++) {
          if (r === col) continue;
          const fac = mat[r][col];
          for (let c = col; c < 4; c++) mat[r][c] = mat[r][c].minus(fac.times(mat[col][c]));
        }
      }
      summary.regA = sc(mat[0][3]);
      summary.regB = sc(mat[1][3]);
      summary.regC = sc(mat[2][3]);
    } else if (transformedPairs.length > 0) {
      let sTx = new D(0), sTy = new D(0), sTxx = new D(0), sTyy = new D(0), sTxy = new D(0);
      for (const p of transformedPairs) {
        sTx = sTx.plus(p.tx.times(p.f));
        sTy = sTy.plus(p.ty.times(p.f));
        sTxx = sTxx.plus(p.tx.pow(2).times(p.f));
        sTyy = sTyy.plus(p.ty.pow(2).times(p.f));
        sTxy = sTxy.plus(p.tx.times(p.ty).times(p.f));
      }
      const sxx = sTxx.minus(sTx.pow(2).div(n));
      const syy = sTyy.minus(sTy.pow(2).div(n));
      const sxy = sTxy.minus(sTx.times(sTy).div(n));
      if (!sxx.abs().lt('1e-28')) {
        const bLin = sxy.div(sxx);
        const aLin = sTy.minus(bLin.times(sTx)).div(n);
        let A = aLin;
        let B = bLin;
        if (subMode === 'E_X' || subMode === 'AX_B') {
          A = aLin.exp();
        } else if (subMode === 'AB_X') {
          A = aLin.exp();
          B = bLin.exp();
        }
        summary.regA = sc(A);
        summary.regB = sc(B);
        if (!syy.abs().lt('1e-28')) {
          summary.corrR = sc(sxy.div(sxx.times(syy).sqrt()));
        }
      }
    }
  }

  return summary;
}

export function estimateStatYHat(subMode: StatSubMode, summary: StatSummary, xVal: Scalar): Scalar {
  if (!summary.regA || !summary.regB) mathError('Regression unavailable');
  const A = summary.regA.decimal;
  const B = summary.regB.decimal;
  const x = xVal.decimal;
  switch (subMode) {
    case 'A+BX': return sc(A.plus(B.times(x)));
    case '_+CX2': return sc(A.plus(B.times(x)).plus((summary.regC?.decimal ?? new D(0)).times(x.pow(2))));
    case 'LN_X': if (x.lte(0)) mathError('Domain'); return sc(A.plus(B.times(x.ln())));
    case 'E_X': return sc(A.times(B.times(x).exp()));
    case 'AB_X': return sc(A.times(B.pow(x)));
    case 'AX_B': if (x.lte(0)) mathError('Domain'); return sc(A.times(x.pow(B)));
    case 'INV_X': if (x.isZero()) mathError('Domain'); return sc(A.plus(B.div(x)));
    default: return mathError('ŷ unavailable in 1-VAR');
  }
}

export function estimateStatXHat(subMode: StatSubMode, summary: StatSummary, yVal: Scalar): Scalar {
  if (!summary.regA || !summary.regB) mathError('Regression unavailable');
  const A = summary.regA.decimal;
  const B = summary.regB.decimal;
  const y = yVal.decimal;
  if (B.isZero()) mathError('Slope is zero');
  switch (subMode) {
    case 'A+BX': return sc(y.minus(A).div(B));
    case 'LN_X': return sc(y.minus(A).div(B).exp());
    case 'E_X': if (y.div(A).lte(0)) mathError('Domain'); return sc(y.div(A).ln().div(B));
    case 'AB_X': if (y.div(A).lte(0) || B.lte(0) || B.eq(1)) mathError('Domain'); return sc(y.div(A).ln().div(B.ln()));
    case 'AX_B': if (y.div(A).lte(0)) mathError('Domain'); return sc(y.div(A).pow(new D(1).div(B)));
    case 'INV_X': if (y.eq(A)) mathError('Domain'); return sc(B.div(y.minus(A)));
    case '_+CX2': {
      const C = summary.regC?.decimal ?? new D(0);
      if (C.isZero()) {
        if (B.isZero()) mathError('Slope is zero');
        return sc(y.minus(A).div(B));
      }
      const disc = B.pow(2).minus(C.times(4).times(A.minus(y)));
      if (disc.lt(0)) mathError('Non-real x̂₁');
      return sc(B.neg().plus(disc.sqrt()).div(C.times(2)));
    }
    default: return mathError('x̂ unavailable in 1-VAR');
  }
}

export function estimateStatXHat2(subMode: StatSubMode, summary: StatSummary, yVal: Scalar): Scalar {
  if (subMode !== '_+CX2' || !summary.regA || !summary.regB || !summary.regC) {
    return mathError('x̂₂ only available in quadratic regression');
  }
  const A = summary.regA.decimal;
  const B = summary.regB.decimal;
  const C = summary.regC.decimal;
  const y = yVal.decimal;
  if (C.isZero()) mathError('Quadratic coefficient C is zero');
  const disc = B.pow(2).minus(C.times(4).times(A.minus(y)));
  if (disc.lt(0)) mathError('Non-real x̂₂');
  return sc(B.neg().minus(disc.sqrt()).div(C.times(2)));
}

export function standardizeStatT(summary: StatSummary, xVal: Scalar): Scalar {
  if (summary.popSdX.decimal.isZero()) mathError('σx is zero');
  return sc(xVal.decimal.minus(summary.meanX.decimal).div(summary.popSdX.decimal));
}
