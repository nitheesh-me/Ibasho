/**
 * `noise()` fast path: MCS 020 a) inputs from the twin's site geometry (RP 6.1, ARCH 5.5 `noise`).
 * Owner: WP-03.
 *
 * Builds, for each heat pump unit and each assessment position, the `UnitAt` inputs of the rational
 * enclosure (`noise.ts`), then decides each position. Geometry (house coordinates: metres, x east,
 * y up, z south; boundary paths are plan points `[x, z]`):
 * - Assessment positions are `site.neighbours` openings whose `habitable` is not `false` (MCS 020 a):
 *   1 m outside a neighbour's habitable room window or door). An opening with `habitable` unknown is
 *   assessed; if it fails there, the result is unknown, not a fail.
 * - `r` is the straight distance from the unit centre to the position, rounded to 0.1 m (at least 0.1).
 * - Reflecting surfaces within 1 m: the mounting plane (ground or roof) counts one; each external
 *   wall element whose bounding box lies within 1 m, and each boundary wall or fence segment within
 *   1 m in plan, counts one more. A wall-mounted unit counts at least two. More than three fails
 *   outright (MCS 020 a) Step 4).
 * - Barrier: a boundary `wall` is type 1 (masonry); a `fence` is type 2 (its thickness is not
 *   recorded, so it gets the smaller credit); hedges and open boundaries are no barrier; a barrier
 *   with unknown height earns no credit. The view is `hidden` when the barrier top is at or above
 *   the sight line to the unit top, `partly` when above the line to the unit base, else `full`.
 *   The best barrier on the path counts. The house itself earns no credit (conservative).
 * Unit size: `UNIT_HEIGHT_M` (0.9 m, a typical split outdoor unit) for the sight lines.
 */
import type { AshpUnit, HomeTwin, NoiseResult, Tri, Vec2, Vec3 } from '@ibasho/core';
import { triAnd } from '@ibasho/core';
import { sqrt } from '@ibasho/dmath';
import {
  type Barrier,
  decidePosition,
  encodeNoiseSites,
  lpDisplay,
  type UnitAt,
  type View,
} from './noise.ts';

/** Height assumed for an outdoor unit when drawing sight lines, m. */
export const UNIT_HEIGHT_M = 0.9;
/** Distance within which a surface reflects (MCS 020 a)). */
const REFLECT_M = 1.0;

export interface NoisePosition {
  id: string;
  habitable: Tri;
  units: UnitAt[];
}

function dist3(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return sqrt(dx * dx + dy * dy + dz * dz);
}

/** Distance from a point to an axis-aligned box. */
function distToBox(p: Vec3, lo: Vec3, hi: Vec3): number {
  let s = 0;
  for (let i = 0; i < 3; i++) {
    const v = p[i]!;
    const d = v < lo[i]! ? lo[i]! - v : v > hi[i]! ? v - hi[i]! : 0;
    s += d * d;
  }
  return sqrt(s);
}

function bbox(poly: readonly Vec3[]): [Vec3, Vec3] | undefined {
  if (poly.length === 0) return undefined;
  const lo: Vec3 = [...poly[0]!];
  const hi: Vec3 = [...poly[0]!];
  for (const q of poly)
    for (let i = 0; i < 3; i++) {
      if (q[i]! < lo[i]!) lo[i] = q[i]!;
      if (q[i]! > hi[i]!) hi[i] = q[i]!;
    }
  return [lo, hi];
}

/** Distance from plan point p to segment ab. */
function distToSeg(p: Vec2, a: Vec2, b: Vec2): number {
  const ux = b[0] - a[0];
  const uz = b[1] - a[1];
  const len2 = ux * ux + uz * uz;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * ux + (p[1] - a[1]) * uz) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = p[0] - (a[0] + t * ux);
  const dz = p[1] - (a[1] + t * uz);
  return sqrt(dx * dx + dz * dz);
}

/** Parameter t in [0, 1] along p0 to p1 where it crosses segment ab, if it does. */
function crossT(p0: Vec2, p1: Vec2, a: Vec2, b: Vec2): number | undefined {
  const rx = p1[0] - p0[0];
  const rz = p1[1] - p0[1];
  const sx = b[0] - a[0];
  const sz = b[1] - a[1];
  const den = rx * sz - rz * sx;
  if (den === 0) return undefined;
  const qx = a[0] - p0[0];
  const qz = a[1] - p0[1];
  const t = (qx * sz - qz * sx) / den;
  const u = (qx * rz - qz * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : undefined;
}

const segments = (path: readonly Vec2[]): [Vec2, Vec2][] =>
  path.slice(1).map((b, i) => [path[i]!, b] as [Vec2, Vec2]);

/** Reflecting surfaces within 1 m of a unit. */
export function reflectingSurfaces(twin: HomeTwin, unit: AshpUnit): number {
  let n = 1; // ground or roof plane
  let walls = 0;
  for (const e of twin.elements) {
    if (e.kind !== 'wall') continue;
    const bb = bbox(e.geometry.polygon);
    if (bb !== undefined && distToBox(unit.position, bb[0], bb[1]) <= REFLECT_M) walls++;
  }
  const plan: Vec2 = [unit.position[0], unit.position[2]];
  for (const b of twin.site.boundaries ?? []) {
    if (b.kind !== 'wall' && b.kind !== 'fence') continue;
    if (segments(b.path).some(([a, c]) => distToSeg(plan, a, c) <= REFLECT_M)) walls++;
  }
  if (unit.mount === 'wall' && walls === 0) walls = 1;
  n += walls;
  return n;
}

const ATT: Record<string, number> = {
  n: 0,
  '1hidden': 100,
  '1partly': 50,
  '1full': 0,
  '2hidden': 50,
  '2partly': 25,
  '2full': 0,
};
const attOf = (b: Barrier): number => (b.type === 'none' ? 0 : (ATT[`${b.type}${b.view}`] ?? 0));

/** The best barrier between a unit and an assessment position. */
export function barrierBetween(twin: HomeTwin, unit: AshpUnit, pos: Vec3): Barrier {
  const p0: Vec2 = [unit.position[0], unit.position[2]];
  const p1: Vec2 = [pos[0], pos[2]];
  const top = unit.position[1] + UNIT_HEIGHT_M / 2;
  const base = unit.position[1] - UNIT_HEIGHT_M / 2;
  let best: Barrier = { type: 'none' };
  for (const b of twin.site.boundaries ?? []) {
    if ((b.kind !== 'wall' && b.kind !== 'fence') || b.heightM === undefined) continue;
    for (const [a, c] of segments(b.path)) {
      const t = crossT(p0, p1, a, c);
      if (t === undefined) continue;
      const lineTop = top + t * (pos[1] - top);
      const lineBase = base + t * (pos[1] - base);
      const view: View | undefined =
        b.heightM >= lineTop ? 'hidden' : b.heightM > lineBase ? 'partly' : undefined;
      if (view === undefined) continue;
      const cand: Barrier = { type: b.kind === 'wall' ? 1 : 2, view };
      if (attOf(cand) > attOf(best)) best = cand;
    }
  }
  return best;
}

/** One unit seen from one position. */
export function unitAt(twin: HomeTwin, unit: AshpUnit, pos: Vec3): UnitAt {
  const r = Math.max(1, Math.round(dist3(unit.position, pos) * 10));
  return {
    lwaDdB: Math.round(unit.lwa * 10),
    surfaces: reflectingSurfaces(twin, unit),
    rDm: r,
    barrier: barrierBetween(twin, unit, pos),
  };
}

/** Assessment positions with their unit inputs; `undefined` when the neighbours are not recorded. */
export function noisePositions(twin: HomeTwin, units: readonly AshpUnit[]): NoisePosition[] | undefined {
  const ns = twin.site.neighbours;
  if (ns === undefined) return undefined;
  return ns
    .filter((o) => o.habitable !== false)
    .map((o) => ({ id: o.id, habitable: o.habitable, units: units.map((u) => unitAt(twin, u, o.position)) }));
}

/**
 * The `m.ashp.noise` fact for a heat pump option: the encoded sites, or `'unknown'` when the
 * neighbours are not recorded. Measure models (WP-01) call this in `facts()`.
 */
export function noiseFact(twin: HomeTwin, units: readonly AshpUnit[]): string | 'unknown' {
  const ps = noisePositions(twin, units);
  return ps === undefined ? 'unknown' : encodeNoiseSites(ps.map((p) => p.units));
}

/** `EngineApi.noise`: under 5 ms for 2 units and 6 positions, enclosure included. */
export function noise(req: { twin: HomeTwin; units: readonly AshpUnit[] }): NoiseResult {
  const ps = noisePositions(req.twin, req.units);
  if (ps === undefined) return { positions: [], ok: 'unknown' };
  const positions = ps.map((p) => {
    const d = decidePosition(p.units);
    const pass: Tri = d === false && p.habitable === 'unknown' ? 'unknown' : d;
    const lp = lpDisplay(p.units);
    return { id: p.id, lp: { lo: lp.lo, hi: lp.hi }, pass };
  });
  return { positions, ok: triAnd(...positions.map((p) => p.pass)) };
}
