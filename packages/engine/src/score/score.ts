/**
 * The Green Home Score in exact rationals (SPEC R2, R4, R5, section 8; SF 2). Owner: WP-02.
 *
 * Mirrors Lean `Ibasho.Spec.V2.Score` term for term, with every constant taken from
 * `@ibasho/spec-gen` (weights, groups, anchors, R target, T caps):
 * - `unit_d = clamp01(gain_d(x) / span_d)` with gain `worst - x` (lower is better: F, C, E, A) or
 *   `x - worst` (higher is better: H, R, T);
 * - `score.sub.<d> = 100 unit_d`; `score.total = 100 sum_d w_d unit_d`;
 * - `score.group.<g> = 100 sum_{d in g} w_d unit_d / sum_{d in g} w_d`;
 * - R and T enter as their composites (`rComposite`, `tComposite`).
 *
 * Inputs are quantised to milli-units before normalising (SPEC 8): each raw float indicator goes
 * through `quantise(x * 1000)` once, so the score is an exact function of integers.
 *
 * T needs comfort hours from the 5R1C model (WP-01). Until a run carries them, T is unknown and
 * its unit sub-score spans [0, 1]: the total and the comfort group are then ranges (`lo`, `hi`),
 * exact once comfort lands. The A indicator uses the per-area mode at reference prices (R4).
 */
import { Q, quantise } from '@ibasho/core';
import {
  ANCHORS,
  type AnchorMode,
  type AnchorZone,
  R_TARGET,
  SCORE_DIMS,
  SCORE_GROUPS,
  SCORE_WEIGHTS,
  type ScoreDim,
  type ScoreGroup,
  T_CAPS,
} from '@ibasho/spec-gen';

export class ScoreError extends Error {
  override name = 'ScoreError';
}

/** Direction of each stored indicator (Lean `Dim.dir`). */
export const DIM_DIR: Readonly<Record<ScoreDim, 'lower' | 'higher'>> = {
  F: 'lower',
  C: 'lower',
  E: 'lower',
  A: 'lower',
  H: 'higher',
  R: 'higher',
  T: 'higher',
};

/** Raw physical inputs of one home in one standard run (SF 2.1). */
export interface ScoreRaw {
  /** Heat loss parameter HTC / TFA, W/m2K. */
  hlpWm2K: number;
  /** Operational carbon, kgCO2e per m2 per year. */
  carbonKgM2: number;
  /** Delivered energy net of on-site use, kWh per m2 per year. */
  energyKWhM2: number;
  /** Running cost at the reference price pack, pounds per m2 per year (R4 per-area mode). */
  costGbpM2: number;
  /** Primary heat delivery efficiency: seasonal efficiency / primary energy factor. */
  etaPe: number;
  /** On-site renewable generation / delivered demand. */
  fRen: number;
  /** Smart readiness points 0..4. */
  kSmart: number;
  /** Occupied hours too hot and too cold; absent until 5R1C comfort lands (WP-01). */
  comfort?: { hotHours: number; coldHours: number };
}

/** Indicators as Lean stores them (R and T as composites); T is null when comfort is unknown. */
export type ScoreIndicators = Record<Exclude<ScoreDim, 'T'>, Q> & { T: Q | null };

/**
 * Parse a spec-gen rational (`"n/d"`). spec-gen writes `"4/1"` for integers, which core
 * `Q.fromWire` rejects as not normalised, so this parses and normalises.
 */
export function specQ(s: string): Q {
  const m = /^(-?\d+)(?:\/(\d+))?$/.exec(s);
  if (!m) throw new ScoreError(`bad spec rational ${JSON.stringify(s)}`);
  return Q.of(BigInt(m[1]!), m[2] ? BigInt(m[2]) : 1n);
}

/** Quantise a float to milli-units, exactly (SPEC 8). */
export function milli(x: number): Q {
  return Q.of(quantise(x * 1000), 1000n);
}

/** Lean `rComposite`: 3/4 min(1, fRen / target) + 1/16 max(0, min(k, 4)). */
export function rComposite(fRen: Q, target: Q, kSmart: Q): Q {
  const share = Q.min(Q.ONE, Q.div(fRen, target));
  const k = Q.max(Q.ZERO, Q.min(kSmart, Q.of(4)));
  return Q.add(Q.mul(Q.of(3, 4), share), Q.mul(Q.of(1, 16), k));
}

/** Lean `tComposite`: 1 - 3/5 hot / capHot - 2/5 cold / capCold. */
export function tComposite(hot: Q, cold: Q, capHot: Q, capCold: Q): Q {
  return Q.sub(Q.sub(Q.ONE, Q.mul(Q.of(3, 5), Q.div(hot, capHot))), Q.mul(Q.of(2, 5), Q.div(cold, capCold)));
}

export function indicatorsOf(raw: ScoreRaw, zone: AnchorZone = 'uk'): ScoreIndicators {
  const caps = T_CAPS[zone];
  return {
    F: milli(raw.hlpWm2K),
    C: milli(raw.carbonKgM2),
    E: milli(raw.energyKWhM2),
    A: milli(raw.costGbpM2),
    H: milli(raw.etaPe),
    R: rComposite(milli(raw.fRen), specQ(R_TARGET[zone]), milli(raw.kSmart)),
    T: raw.comfort
      ? tComposite(
          milli(raw.comfort.hotHours),
          milli(raw.comfort.coldHours),
          specQ(caps.hot),
          specQ(caps.cold),
        )
      : null,
  };
}

const clamp01 = (x: Q): Q => Q.max(Q.ZERO, Q.min(Q.ONE, x));

/** Lean `Anchor.unit`. */
export function unitScore(d: ScoreDim, x: Q, zone: AnchorZone, mode: AnchorMode): Q {
  const a = ANCHORS[zone][mode][d];
  const best = specQ(a.best);
  const worst = specQ(a.worst);
  const lower = DIM_DIR[d] === 'lower';
  const span = lower ? Q.sub(worst, best) : Q.sub(best, worst);
  if (!Q.lt(Q.ZERO, span)) throw new ScoreError(`anchor of ${d} is not valid (best must beat worst)`);
  const gain = lower ? Q.sub(worst, x) : Q.sub(x, worst);
  return clamp01(Q.div(gain, span));
}

/** An exact value, or a range when an input (T) is unknown. */
export interface QRange {
  lo: Q;
  hi: Q;
}

export interface ScoreResult {
  zone: AnchorZone;
  mode: AnchorMode;
  indicators: ScoreIndicators;
  /** `score.sub.<d>`, 0..100. */
  sub: Record<ScoreDim, QRange>;
  /** `score.group.<g>`, 0..100. */
  group: Record<ScoreGroup, QRange>;
  /** `score.total`, 0..100. */
  total: QRange;
  /** True when every indicator is known (lo = hi everywhere). */
  exact: boolean;
}

const HUNDRED = Q.of(100);

export function scoreOf(
  ind: ScoreIndicators,
  zone: AnchorZone = 'uk',
  mode: AnchorMode = 'per-area',
): ScoreResult {
  const unit = {} as Record<ScoreDim, QRange>;
  for (const d of SCORE_DIMS) {
    const x = ind[d];
    unit[d] =
      x === null
        ? { lo: Q.ZERO, hi: Q.ONE }
        : { lo: unitScore(d, x, zone, mode), hi: unitScore(d, x, zone, mode) };
  }
  const w = (d: ScoreDim) => specQ(SCORE_WEIGHTS[d]);
  const weighted = (ds: readonly ScoreDim[]): QRange => ({
    lo: Q.sum(ds.map((d) => Q.mul(w(d), unit[d].lo))),
    hi: Q.sum(ds.map((d) => Q.mul(w(d), unit[d].hi))),
  });
  const sub = {} as Record<ScoreDim, QRange>;
  for (const d of SCORE_DIMS) sub[d] = { lo: Q.mul(HUNDRED, unit[d].lo), hi: Q.mul(HUNDRED, unit[d].hi) };
  const group = {} as Record<ScoreGroup, QRange>;
  for (const g of Object.keys(SCORE_GROUPS) as ScoreGroup[]) {
    const ds = SCORE_GROUPS[g];
    const gw = Q.sum(ds.map(w));
    const s = weighted(ds);
    group[g] = { lo: Q.div(Q.mul(HUNDRED, s.lo), gw), hi: Q.div(Q.mul(HUNDRED, s.hi), gw) };
  }
  const t = weighted(SCORE_DIMS);
  return {
    zone,
    mode,
    indicators: ind,
    sub,
    group,
    total: { lo: Q.mul(HUNDRED, t.lo), hi: Q.mul(HUNDRED, t.hi) },
    exact: ind.T !== null,
  };
}

/** Integer display score (SPEC 8: an integer score), half even, of each end of the range. */
export function displayScore(r: QRange): { lo: bigint; hi: bigint } {
  return { lo: Q.roundHalfEven(r.lo), hi: Q.roundHalfEven(r.hi) };
}
