/**
 * Mirror: the Green Home Score in exact rationals. Owner: WP-04.
 *
 * TS twin of Lean `Ibasho.Spec.V2.Score` (`subScore`, `groupScore`, `score`) and of the
 * `score.recompute` check in `Ibasho.Check.Check` (`scoreRowOk`, `chkScore`). Weights, groups and
 * anchors come from `@ibasho/spec-gen`, which Lean generates, so the constants cannot drift.
 * Arithmetic is `Q` from `@ibasho/core` (normalised bigint rationals), so equality is exact.
 */
import { Q } from '@ibasho/core';
import {
  ANCHORS,
  type AnchorMode,
  type AnchorZone,
  SCORE_DIMS,
  SCORE_GROUPS,
  SCORE_WEIGHTS,
  type ScoreDim,
  type ScoreGroup,
} from '@ibasho/spec-gen';
import type { Rat, ScoreClaim, ScoreRow } from './decode.ts';

/** A wire rational (`n` or `n/d`, not necessarily reduced, `d > 0`), e.g. a generated anchor. */
export function qWire(s: string): Q {
  const [n, d] = s.split('/');
  return Q.of(BigInt(n!), BigInt(d ?? '1'));
}
const ofRat = (r: Rat): Q => Q.of(r.n, r.d);

/** Lean `Dim.dir`: F, C, E, A lower is better; H, R, T higher is better. */
const HIGHER: ReadonlySet<ScoreDim> = new Set<ScoreDim>(['H', 'R', 'T']);
const GROUP_ORDER: readonly ScoreGroup[] = ['fabric-heating', 'running-cost', 'carbon', 'comfort'];
const HUNDRED = Q.of(100n);

const clamp01 = (x: Q): Q => Q.max(Q.ZERO, Q.min(Q.ONE, x));

/** Lean `Anchor.unit`: `clamp((gain) / span, 0, 1)`; a zero span gives 0 (Lean `0⁻¹ = 0`). */
function unit(zone: AnchorZone, mode: AnchorMode, d: ScoreDim, x: Q): Q {
  const a = ANCHORS[zone][mode][d];
  const best = qWire(a.best);
  const worst = qWire(a.worst);
  const higher = HIGHER.has(d);
  const span = higher ? Q.sub(best, worst) : Q.sub(worst, best);
  const gain = higher ? Q.sub(x, worst) : Q.sub(worst, x);
  return span.n === 0n ? Q.ZERO : clamp01(Q.div(gain, span));
}

export interface ScoreOut {
  sub: Q[];
  groups: Q[];
  total: Q;
}

/** Sub-scores, group scores and total of seven indicators in `SCORE_DIMS` order. */
export function scoreOf(zone: AnchorZone, mode: AnchorMode, ind: readonly Q[]): ScoreOut {
  const u = new Map<ScoreDim, Q>();
  for (const [i, d] of SCORE_DIMS.entries()) u.set(d, unit(zone, mode, d, ind[i] ?? Q.ZERO));
  const weighted = (ds: readonly ScoreDim[]): Q =>
    Q.sum(ds.map((d) => Q.mul(qWire(SCORE_WEIGHTS[d]), u.get(d)!)));
  return {
    sub: SCORE_DIMS.map((d) => Q.mul(HUNDRED, u.get(d)!)),
    groups: GROUP_ORDER.map((g) => {
      const ds = SCORE_GROUPS[g];
      const w = Q.sum(ds.map((d) => qWire(SCORE_WEIGHTS[d])));
      return Q.mul(HUNDRED, Q.div(weighted(ds), w));
    }),
    total: Q.mul(HUNDRED, weighted(SCORE_DIMS)),
  };
}

const listEq = (a: readonly Rat[], b: readonly Q[]): boolean =>
  a.length === b.length && a.every((x, i) => Q.eq(ofRat(x), b[i]!));

/** Lean `scoreRowOk`: seven indicators and every claimed figure equal to the definition. */
export function scoreRowOk(s: ScoreClaim, e: ScoreRow): boolean {
  if (e.ind.length !== 7) return false;
  const out = scoreOf(s.zone, s.mode, e.ind.map(ofRat));
  return listEq(e.sub, out.sub) && listEq(e.groups, out.groups) && Q.eq(ofRat(e.total), out.total);
}
