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
  sampSdX?: Scalar;
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
  quadraticFit?: { center: Scalar; scale: Scalar; a: Scalar; b: Scalar; c: Scalar };
}

function sc(v: InstanceType<typeof D>): Scalar {
  return makeScalar(v, undefined, true);
}

function parseStatCellDecimal(raw: string | undefined, fallback: string): InstanceType<typeof D> {
  const text = (raw ?? '').trim();
  if (!text) return new D(fallback);
  const normalized = text
    .replace(/×10\^/g, 'e')
    .replace(/−/g, '-')
    .replace(/,/g, '.');
  try {
    const val = new D(normalized);
    if (!val.isFinite()) mathError('Invalid statistical value');
    return val;
  } catch {
    return mathError('Invalid statistical value');
  }
}

export function computeStatSummary(subMode: StatSubMode, rows: StatRow[], useFreq = true): StatSummary {
  if (rows.length === 0) mathError('No statistical data');
  const is1Var = subMode === '1-VAR';

  let n = new D(0);
  let totalFreqBig = 0n;
  // Track centered second moments online. E[x²] - E[x]² loses all low-order
  // variance when observations have a large common offset.
  let stableMeanX = new D(0);
  let stableM2X = new D(0);
  let stableMeanY = new D(0);
  let stableM2Y = new D(0);
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

  const weightedX: Array<{ x: InstanceType<typeof D>; freq: bigint }> = [];
  const transformedPairs: Array<{ tx: InstanceType<typeof D>; ty: InstanceType<typeof D>; f: InstanceType<typeof D> }> = [];
  const quadraticPairs: Array<{ x: InstanceType<typeof D>; y: InstanceType<typeof D>; f: InstanceType<typeof D> }> = [];

  for (const row of rows) {
    const x = parseStatCellDecimal(row.x, '0');
    const y = parseStatCellDecimal(row.y, '0');
    const f = useFreq ? parseStatCellDecimal(row.freq, '1') : new D(1);
    if (f.lt(0) || !f.isInteger() || f.gte('1e15')) mathError('Invalid frequency');
    if (f.isZero()) continue;

    // Combine this frequency-weighted batch with the observations already seen.
    // This is the parallel/weighted form of Welford's stable variance update.
    const nextN = n.plus(f);
    if (n.isZero()) {
      stableMeanX = x;
      stableMeanY = y;
    } else {
      const deltaX = x.minus(stableMeanX);
      const deltaY = y.minus(stableMeanY);
      const crossWeight = n.times(f).div(nextN);
      stableM2X = stableM2X.plus(deltaX.pow(2).times(crossWeight));
      stableM2Y = stableM2Y.plus(deltaY.pow(2).times(crossWeight));
      stableMeanX = stableMeanX.plus(deltaX.times(f).div(nextN));
      stableMeanY = stableMeanY.plus(deltaY.times(f).div(nextN));
    }
    n = nextN;
    sumX = sumX.plus(x.times(f));
    sumX2 = sumX2.plus(x.pow(2).times(f));
    if (minX === null || x.lt(minX)) minX = x;
    if (maxX === null || x.gt(maxX)) maxX = x;

    if (is1Var) {
      const fBig = BigInt(f.toFixed(0));
      weightedX.push({ x, freq: fBig });
      totalFreqBig += fBig;
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

      if (subMode === '_+CX2') quadraticPairs.push({ x, y, f });
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
  const popSdX = D.max(new D(0), stableM2X.div(n)).sqrt();
  const sampSdX = n.gt(1)
    ? D.max(new D(0), stableM2X.div(n.minus(1))).sqrt()
    : undefined;

  const summary: StatSummary = {
    n: sc(n),
    sumX: sc(sumX),
    sumX2: sc(sumX2),
    meanX: sc(meanX),
    popSdX: sc(popSdX),
    sampSdX: sampSdX ? sc(sampSdX) : undefined,
    minX: sc(minX),
    maxX: sc(maxX),
  };

  if (is1Var && weightedX.length > 0 && totalFreqBig > 0n) {
    weightedX.sort((a, b) => a.x.comparedTo(b.x));
    const cumEnds: bigint[] = [];
    let running = 0n;
    for (const item of weightedX) {
      running += item.freq;
      cumEnds.push(running);
    }
    const atIndex = (idx0: bigint): InstanceType<typeof D> => {
      for (let i = 0; i < cumEnds.length; i++) {
        if (idx0 < cumEnds[i]) return weightedX[i].x;
      }
      return weightedX[weightedX.length - 1].x;
    };
    const rangeMedian = (start: bigint, len: bigint): InstanceType<typeof D> => {
      const half = len / 2n;
      if (len % 2n === 1n) return atIndex(start + half);
      return atIndex(start + half - 1n).plus(atIndex(start + half)).div(2);
    };
    const med = rangeMedian(0n, totalFreqBig);
    const halfLen = totalFreqBig / 2n;
    const upperStart = (totalFreqBig + 1n) / 2n;
    summary.med = sc(med);
    summary.q1 = sc(halfLen > 0n ? rangeMedian(0n, halfLen) : med);
    summary.q3 = sc(halfLen > 0n ? rangeMedian(upperStart, halfLen) : med);
    return summary;
  }

  if (!is1Var && minY !== null && maxY !== null) {
    const meanY = sumY.div(n);
    const popSdY = D.max(new D(0), stableM2Y.div(n)).sqrt();
    const sampSdY = n.gt(1)
      ? D.max(new D(0), stableM2Y.div(n.minus(1))).sqrt()
      : undefined;

    summary.sumY = sc(sumY);
    summary.sumY2 = sc(sumY2);
    summary.sumXY = sc(sumXY);
    summary.sumX3 = sc(sumX3);
    summary.sumX4 = sc(sumX4);
    summary.sumX2Y = sc(sumX2Y);
    summary.meanY = sc(meanY);
    summary.popSdY = sc(popSdY);
    summary.sampSdY = sampSdY ? sc(sampSdY) : undefined;
    summary.minY = sc(minY);
    summary.maxY = sc(maxY);

    if (subMode === '_+CX2') {
      // Fit in a centered, scaled coordinate z = (x - center) / scale.
      // Raw normal equations in x lose the low-order differences when x has
      // a large offset or a very small magnitude.
      const center = stableMeanX;
      const scale = quadraticPairs.reduce(
        (mx, p) => D.max(mx, p.x.minus(center).abs()),
        new D(0),
      );
      if (!scale.isZero()) {
        const mat: InstanceType<typeof D>[][] = Array.from(
          { length: 3 },
          () => Array.from({ length: 4 }, () => new D(0)),
        );
        for (const p of quadraticPairs) {
          const z = p.x.minus(center).div(scale);
          const powers = [new D(1), z, z.pow(2), z.pow(3), z.pow(4)];
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              mat[r][c] = mat[r][c].plus(powers[r + c].times(p.f));
            }
            mat[r][3] = mat[r][3].plus(powers[r].times(p.y).times(p.f));
          }
        }

        let singular = false;
        for (let col = 0; col < 3; col++) {
          let best = col;
          for (let r = col + 1; r < 3; r++) {
            if (mat[r][col].abs().gt(mat[best][col].abs())) best = r;
          }
          const columnScale = mat.slice(col).reduce((mx, row) => D.max(mx, row[col].abs()), new D(0));
          if (columnScale.isZero() || mat[best][col].abs().lte(columnScale.times('1e-24'))) {
            singular = true;
            break;
          }
          [mat[col], mat[best]] = [mat[best], mat[col]];
          const piv = mat[col][col];
          for (let c = col; c < 4; c++) mat[col][c] = mat[col][c].div(piv);
          for (let r = 0; r < 3; r++) {
            if (r === col) continue;
            const fac = mat[r][col];
            for (let c = col; c < 4; c++) mat[r][c] = mat[r][c].minus(fac.times(mat[col][c]));
          }
        }
        if (!singular) {
          const alpha = mat[0][3];
          const beta = mat[1][3];
          const gamma = mat[2][3];
          const scaledB = beta.div(scale);
          const scaledC = gamma.div(scale.pow(2));
          const A = alpha.minus(center.times(scaledB)).plus(center.pow(2).times(scaledC));
          const B = scaledB.minus(center.times(2).times(scaledC));
          summary.regA = sc(A);
          summary.regB = sc(B);
          summary.regC = sc(scaledC);
          summary.quadraticFit = {
            center: sc(center), scale: sc(scale),
            a: sc(alpha), b: sc(beta), c: sc(gamma),
          };
        }
      }
    } else if (transformedPairs.length > 0) {
      // Centered weighted co-moments avoid catastrophic cancellation in
      // Σ(tx²) - Σ(tx)²/n for large-offset regression data.
      let pairN = new D(0);
      let meanTx = new D(0), meanTy = new D(0);
      let sxx = new D(0), syy = new D(0), sxy = new D(0);
      for (const p of transformedPairs) {
        const nextN = pairN.plus(p.f);
        if (pairN.isZero()) {
          meanTx = p.tx;
          meanTy = p.ty;
        } else {
          const dx = p.tx.minus(meanTx);
          const dy = p.ty.minus(meanTy);
          const crossWeight = pairN.times(p.f).div(nextN);
          sxx = sxx.plus(dx.pow(2).times(crossWeight));
          syy = syy.plus(dy.pow(2).times(crossWeight));
          sxy = sxy.plus(dx.times(dy).times(crossWeight));
          meanTx = meanTx.plus(dx.times(p.f).div(nextN));
          meanTy = meanTy.plus(dy.times(p.f).div(nextN));
        }
        pairN = nextN;
      }
      if (!sxx.isZero()) {
        const bLin = sxy.div(sxx);
        const aLin = meanTy.minus(bLin.times(meanTx));
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
        if (!syy.isZero()) {
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
    case '_+CX2': {
      const fit = summary.quadraticFit;
      if (fit) {
        const z = x.minus(fit.center.decimal).div(fit.scale.decimal);
        return sc(fit.a.decimal.plus(fit.b.decimal.times(z)).plus(fit.c.decimal.times(z.pow(2))));
      }
      return sc(A.plus(B.times(x)).plus((summary.regC?.decimal ?? new D(0)).times(x.pow(2))));
    }
    case 'LN_X': if (x.lte(0)) mathError('Domain'); return sc(A.plus(B.times(x.ln())));
    case 'E_X': return sc(A.times(B.times(x).exp()));
    case 'AB_X': return sc(A.times(B.pow(x)));
    case 'AX_B': if (x.lte(0)) mathError('Domain'); return sc(A.times(x.pow(B)));
    case 'INV_X': if (x.isZero()) mathError('Domain'); return sc(A.plus(B.div(x)));
    default: return mathError('ŷ unavailable in 1-VAR');
  }
}

function stableQuadraticRoots(
  a: InstanceType<typeof D>,
  b: InstanceType<typeof D>,
  c: InstanceType<typeof D>,
  y: InstanceType<typeof D>,
  errorMessage: string,
) {
  const discriminant = b.pow(2).minus(c.times(4).times(a.minus(y)));
  if (discriminant.lt(0)) mathError(errorMessage);
  const sqrtDiscriminant = discriminant.sqrt();
  if (sqrtDiscriminant.isZero()) {
    const root = b.neg().div(c.times(2));
    return { plus: root, minus: root };
  }
  // Avoid subtracting two nearly equal values in the conventional quadratic
  // formula; one root is computed from the product of roots instead.
  const q = b.gte(0)
    ? b.plus(sqrtDiscriminant).neg().div(2)
    : sqrtDiscriminant.minus(b).div(2);
  const directRoot = q.div(c);
  const companionRoot = a.minus(y).div(q);
  return b.gte(0)
    ? { plus: companionRoot, minus: directRoot }
    : { plus: directRoot, minus: companionRoot };
}

export function estimateStatXHat(subMode: StatSubMode, summary: StatSummary, yVal: Scalar): Scalar {
  if (!summary.regA || !summary.regB) mathError('Regression unavailable');
  const A = summary.regA.decimal;
  const B = summary.regB.decimal;
  const y = yVal.decimal;
  if (subMode === '_+CX2') {
    const fit = summary.quadraticFit;
    if (fit) {
      const qa = fit.a.decimal, qb = fit.b.decimal, qc = fit.c.decimal;
      if (qc.isZero()) {
        if (qb.isZero()) mathError('Slope is zero');
        return sc(fit.center.decimal.plus(fit.scale.decimal.times(y.minus(qa).div(qb))));
      }
      const roots = stableQuadraticRoots(qa, qb, qc, y, 'Non-real x̂₁');
      return sc(fit.center.decimal.plus(fit.scale.decimal.times(roots.plus)));
    }
    const C = summary.regC?.decimal ?? new D(0);
    if (C.isZero()) {
      if (B.isZero()) mathError('Slope is zero');
      return sc(y.minus(A).div(B));
    }
    const roots = stableQuadraticRoots(A, B, C, y, 'Non-real x̂₁');
    return sc(roots.plus);
  }
  if (B.isZero()) mathError('Slope is zero');
  switch (subMode) {
    case 'A+BX': return sc(y.minus(A).div(B));
    case 'LN_X': return sc(y.minus(A).div(B).exp());
    case 'E_X': if (y.div(A).lte(0)) mathError('Domain'); return sc(y.div(A).ln().div(B));
    case 'AB_X': if (y.div(A).lte(0) || B.lte(0) || B.eq(1)) mathError('Domain'); return sc(y.div(A).ln().div(B.ln()));
    case 'AX_B': if (y.div(A).lte(0)) mathError('Domain'); return sc(y.div(A).pow(new D(1).div(B)));
    case 'INV_X': if (y.eq(A)) mathError('Domain'); return sc(B.div(y.minus(A)));
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
  const fit = summary.quadraticFit;
  if (fit) {
    const qa = fit.a.decimal, qb = fit.b.decimal, qc = fit.c.decimal;
    if (qc.isZero()) mathError('Quadratic coefficient C is zero');
    const roots = stableQuadraticRoots(qa, qb, qc, y, 'Non-real x̂₂');
    return sc(fit.center.decimal.plus(fit.scale.decimal.times(roots.minus)));
  }
  if (C.isZero()) mathError('Quadratic coefficient C is zero');
  const roots = stableQuadraticRoots(A, B, C, y, 'Non-real x̂₂');
  return sc(roots.minus);
}

export function standardizeStatT(summary: StatSummary, xVal: Scalar): Scalar {
  if (summary.popSdX.decimal.isZero()) mathError('σx is zero');
  return sc(xVal.decimal.minus(summary.meanX.decimal).div(summary.popSdX.decimal));
}
