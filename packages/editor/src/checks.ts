/**
 * Live plan checks and no-simulation meters while editing (SPEC 20, BE 3.7, DS 13.4). Owner: WP-15.
 *
 * Errors are drawn on the model (overlap hatch, torn edge, dashed window); meters (WWR per facade,
 * projection factor) are quiet chips in the inspector. These are editor previews: the canonical
 * checks come from `packages/plan` `compile()` (WP-14), which the app swaps in when it lands.
 */
import type { BuildingDoc, FacadeBin, PlanCheck, PointMm, Room2D, Storey } from '@ibasho/core';
import { FACADE_BINS } from '@ibasho/core';
import { areaMm2, bbox, edge, edgeBin, edgeLength, overlapArea } from './geom.ts';

/** ECBC 2017 4.3.2(a): WWR limit, per mille. Grade estimate until checked against the code PDF. */
export const ECBC_WWR_LIMIT_PM = 400;

export function storeyChecks(s: Storey): PlanCheck[] {
  const out: PlanCheck[] = [];
  const rooms = s.rooms as Room2D[];
  for (let i = 0; i < rooms.length; i++) {
    const a = rooms[i] as Room2D;
    const area = Number(areaMm2(a.floor));
    const b = bbox(a.floor.outer);
    if (area < 1_000_000 || Math.min(b.x1 - b.x0, b.y1 - b.y0) < 600) {
      out.push({
        id: `tiny:${a.id}`,
        kind: 'tiny-room',
        severity: 'warn',
        targets: [a.id],
        message: 'plan.check.tiny',
      });
    }
    if (!a.spaceTypeId) {
      out.push({
        id: `untyped:${a.id}`,
        kind: 'untyped-room',
        severity: 'info',
        targets: [a.id],
        message: 'plan.check.untyped',
      });
    }
    a.segments.forEach((seg, k) => {
      const len = edgeLength(edge(a.floor.outer, k));
      const w = seg.window;
      const over =
        (w.kind === 'ratio' && w.wwrPm > 950) ||
        (w.kind === 'single' && (w.width > len || w.sill + w.height > a.ceiling)) ||
        (w.kind === 'ratio' && w.head !== undefined && w.head > a.ceiling);
      if (over) {
        out.push({
          id: `win:${seg.id}`,
          kind: 'window-over-wall',
          severity: 'error',
          targets: [a.id, seg.id],
          message: 'plan.check.window',
        });
      }
    });
    for (let j = i + 1; j < rooms.length; j++) {
      const c = rooms[j] as Room2D;
      if (overlapArea(a.floor.outer, c.floor.outer) > 0) {
        out.push({
          id: `overlap:${a.id}:${c.id}`,
          kind: 'overlap',
          severity: 'error',
          targets: [a.id, c.id],
          message: 'plan.check.overlap',
        });
      }
    }
  }
  return out;
}

export interface FacadeMeter {
  bin: FacadeBin;
  /** Gross wall, m² (above grade, multipliers counted). */
  wallM2: number;
  windowM2: number;
  /** Window to wall ratio, per mille. */
  wwrPm: number;
  /** Largest overhang projection factor on this facade, or undefined when none. */
  pf?: number;
}

/** Window height a ratio rule implies on a wall of `len` mm (strip between sill and head). */
function ratioWindowArea(len: number, ftf: number, rule: { wwrPm: number }): number {
  return (len * ftf * rule.wwrPm) / 1000;
}

export function facadeMeters(doc: BuildingDoc): FacadeMeter[] {
  const acc = new Map<FacadeBin, { wall: number; win: number; pf?: number }>();
  for (const s of doc.storeys) {
    if (s.belowGrade) continue;
    const mult = Math.max(1, s.multiplier);
    for (const r of s.rooms as Room2D[]) {
      r.segments.forEach((seg, i) => {
        if (seg.boundary.kind !== 'outdoors') return;
        const len = edgeLength(edge(r.floor.outer as PointMm[], i));
        const bin = edgeBin(r.floor.outer as PointMm[], i, doc.rotationMdeg);
        const cur = acc.get(bin) ?? { wall: 0, win: 0 };
        cur.wall += len * s.floorToFloor * mult;
        const w = seg.window;
        if (w.kind === 'ratio' || w.kind === 'repeating')
          cur.win += ratioWindowArea(len, s.floorToFloor, w) * mult;
        if (w.kind === 'single') cur.win += w.width * w.height * mult;
        if (w.kind === 'detailed') for (const o of w.openings) cur.win += o.width * o.height * mult;
        for (const sh of seg.shading) {
          if (sh.kind !== 'overhang') continue;
          const sill = w.kind === 'ratio' || w.kind === 'repeating' || w.kind === 'single' ? w.sill : 900;
          const head =
            w.kind === 'ratio'
              ? (w.head ?? 2400)
              : w.kind === 'repeating'
                ? w.head
                : w.kind === 'single'
                  ? w.sill + w.height
                  : 2400;
          const v = head + sh.aboveHead - sill;
          if (v > 0) cur.pf = Math.max(cur.pf ?? 0, sh.depth / v);
        }
        acc.set(bin, cur);
      });
    }
  }
  return FACADE_BINS.filter((b) => acc.has(b)).map((bin) => {
    const v = acc.get(bin) as { wall: number; win: number; pf?: number };
    return {
      bin,
      wallM2: v.wall / 1e6,
      windowM2: v.win / 1e6,
      wwrPm: v.wall > 0 ? Math.round((1000 * v.win) / v.wall) : 0,
      ...(v.pf !== undefined ? { pf: v.pf } : {}),
    };
  });
}

/** Overall WWR, per mille. */
export function overallWwrPm(meters: readonly FacadeMeter[]): number {
  const wall = meters.reduce((s, m) => s + m.wallM2, 0);
  const win = meters.reduce((s, m) => s + m.windowM2, 0);
  return wall > 0 ? Math.round((1000 * win) / wall) : 0;
}

export interface QuickQuantities {
  gfaM2: number;
  conditionedM2: number;
  rooms: number;
  untyped: number;
  /** Share of floor area with no function, 0 to 1 (widens the EUI range, R33). */
  untypedShare: number;
  storeys: { id: string; name: string; areaM2: number; rooms: number }[];
}

export function quickQuantities(
  doc: BuildingDoc,
  conditioned: (spaceTypeId: string | undefined) => boolean,
): QuickQuantities {
  let gfa = 0;
  let cond = 0;
  let rooms = 0;
  let untyped = 0;
  let untypedArea = 0;
  const storeys = doc.storeys.map((s) => {
    let a = 0;
    for (const r of s.rooms as Room2D[]) {
      const m2 = (Number(areaMm2(r.floor)) / 1e6) * Math.max(1, s.multiplier);
      a += m2;
      rooms++;
      if (!r.spaceTypeId) {
        untyped++;
        untypedArea += m2;
      }
      if (conditioned(r.spaceTypeId)) cond += m2;
    }
    gfa += a;
    return { id: s.id, name: s.name, areaM2: a, rooms: s.rooms.length };
  });
  return {
    gfaM2: gfa,
    conditionedM2: cond,
    rooms,
    untyped,
    untypedShare: gfa > 0 ? untypedArea / gfa : 0,
    storeys,
  };
}
