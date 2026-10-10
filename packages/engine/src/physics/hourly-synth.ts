/**
 * Hourly temperatures synthesised from monthly climate (deterministic). Owner: WP-01.
 *
 * Used where no TMY is available (EN 14825 bins for any pack, and the 5R1C model outside London).
 * Each day of month m has mean theta_e,m + sigma_m z_k, where z_k are the standard normal quantiles
 * at (k + 0.5) / n_m (Acklam's rational approximation) assigned to days in the fixed order
 * k = (11 d) mod n_m, and sigma_m = (theta_max - theta_min) / 2 (ESTIMATE: day-to-day spread taken
 * as half the mean diurnal range; London January gives 2.7 K). Within a day the temperature
 * follows theta_day + (range / 2) cos(2 pi (h - 15) / 24), peaking at 15:00 local standard time.
 * The monthly mean is preserved exactly up to rounding (the quantiles and the cosine sum to 0).
 */
import type { ClimateMonth } from '@ibasho/core';
import { cos, log, PI, sqrt } from '@ibasho/dmath';
import { days } from './common.ts';

const A = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
const B = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
const C = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const D = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];

/** Inverse standard normal CDF (Acklam 2003, relative error < 1.2e-9). */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError(`quantile needs 0 < p < 1, got ${p}`);
  const lo = 0.02425;
  if (p < lo) {
    const q = sqrt(-2 * log(p));
    return (((((C[0]! * q + C[1]!) * q + C[2]!) * q + C[3]!) * q + C[4]!) * q + C[5]!) / ((((D[0]! * q + D[1]!) * q + D[2]!) * q + D[3]!) * q + 1);
  }
  if (p > 1 - lo) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((A[0]! * r + A[1]!) * r + A[2]!) * r + A[3]!) * r + A[4]!) * r + A[5]!) * q) / (((((B[0]! * r + B[1]!) * r + B[2]!) * r + B[3]!) * r + B[4]!) * r + 1);
}

const quantileCache = new Map<number, Float64Array>();
function dayOffsets(n: number): Float64Array {
  let q = quantileCache.get(n);
  if (!q) {
    q = new Float64Array(n);
    for (let d = 0; d < n; d++) q[d] = normalQuantile((((11 * d) % n) + 0.5) / n);
    quantileCache.set(n, q);
  }
  return q;
}

const DIURNAL = (() => {
  const out = new Float64Array(24);
  for (let h = 0; h < 24; h++) out[h] = cos((2 * PI * (h - 15)) / 24);
  return out;
})();

/** 8,760 hourly temperatures, January 1st 00:00 first. */
export function synthesiseHourlyTemps(months: readonly ClimateMonth[]): Float64Array {
  const out = new Float64Array(8760);
  let i = 0;
  for (let m = 0; m < 12; m++) {
    const cm = months[m]!;
    const range = Math.max(0, cm.thetaMax - cm.thetaMin);
    const sigma = range / 2;
    const z = dayOffsets(days(m));
    for (let d = 0; d < days(m); d++) {
      const day = cm.thetaE + sigma * z[d]!;
      for (let h = 0; h < 24; h++) out[i++] = day + (range / 2) * DIURNAL[h]!;
    }
  }
  return out;
}

/** First hour index of each month (non-leap year). */
export const MONTH_START_HOUR: readonly number[] = (() => {
  const out: number[] = [];
  let h = 0;
  for (let m = 0; m < 12; m++) {
    out.push(h);
    h += 24 * days(m);
  }
  return out;
})();
