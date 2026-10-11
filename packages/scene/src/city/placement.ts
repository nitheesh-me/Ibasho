/**
 * Design before you build (SPEC 27): placing a designed building on a plot. Pure helpers for the
 * stage: apply a placement to a document, compose a drag and a turn into a new placement, and the
 * site check (overlaps with existing buildings, and the neighbours that shade it). Owner: WP-07.
 *
 * Frames: placement origin in the place frame (integer mm), bearing as `rotationMdeg` with the
 * same convention as `BuildingDoc` (plan +y points to that bearing, clockwise from true north).
 */
import type { BuildingDoc, Mm } from '@ibasho/core';
import { boxOf, type EN, pointInRing } from './frame.ts';
import type { ContextMass } from './geometry.ts';
import type { HeroModel } from './hero.ts';
import { shadowPolygons } from './shadow.ts';
import { sunOf } from './sun.ts';

export interface Placement {
  origin: { x: Mm; y: Mm };
  rotationMdeg: number;
  /** Ground level of the plot relative to the city datum, mm (default 0). */
  groundMm?: Mm;
}

export interface ShadingNeighbour {
  id: string;
  name?: string;
  /** Hours of the test days in which this neighbour shades part of the building (21 Dec, 21 Mar). */
  hours: number;
  /** Height used, m, and whether it is an estimate. */
  heightM: number;
  estimated: boolean;
}

export interface PlacementCheck {
  /** Existing buildings the footprint overlaps (ids, place frame). */
  overlaps: string[];
  /** Neighbours that cast shade on the building on the test days, most hours first. */
  shading: ShadingNeighbour[];
  /** No overlap with any known building. */
  free: boolean;
}

export function placementOf(doc: Pick<BuildingDoc, 'origin' | 'rotationMdeg'>): Placement {
  return { origin: { ...doc.origin }, rotationMdeg: doc.rotationMdeg };
}

/** The document moved to a placement (a copy; storeys and rooms are shared). */
export function applyPlacement(doc: BuildingDoc, p: Placement | undefined): BuildingDoc {
  if (!p) return doc;
  return {
    ...doc,
    origin: { x: Math.round(p.origin.x), y: Math.round(p.origin.y) },
    rotationMdeg: Math.round(p.rotationMdeg),
  };
}

/** Rotate an east, north vector clockwise by `deg` (a bearing increase). */
export function rotateCw([e, n]: EN, deg: number): EN {
  const r = (deg * Math.PI) / 180;
  return [e * Math.cos(r) + n * Math.sin(r), -e * Math.sin(r) + n * Math.cos(r)];
}

/**
 * A placement after a drag by `move` (m, east and north) and a turn of `turnDeg` (clockwise)
 * about `pivot` (m, place frame), keeping the plot's ground level.
 */
export function movePlacement(p: Placement, pivot: EN, move: EN, turnDeg: number): Placement {
  const o: EN = [p.origin.x / 1000, p.origin.y / 1000];
  const rel = rotateCw([o[0] - pivot[0], o[1] - pivot[1]], turnDeg);
  const rot = (((p.rotationMdeg + turnDeg * 1000) % 360_000) + 360_000) % 360_000;
  return {
    origin: {
      x: Math.round((pivot[0] + move[0] + rel[0]) * 1000),
      y: Math.round((pivot[1] + move[1] + rel[1]) * 1000),
    },
    rotationMdeg: Math.round(rot),
    ...(p.groundMm !== undefined ? { groundMm: p.groundMm } : {}),
  };
}

function segmentsCross(a: EN, b: EN, c: EN, d: EN): boolean {
  const o = (p: EN, q: EN, r: EN): number => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** True when two simple rings overlap (a vertex inside the other, or crossing edges). */
export function ringsOverlap(a: readonly EN[], b: readonly EN[]): boolean {
  const ba = boxOf(a);
  const bb = boxOf(b);
  if (ba.maxE < bb.minE || bb.maxE < ba.minE || ba.maxN < bb.minN || bb.maxN < ba.minN) return false;
  if (a.some(([e, n]) => pointInRing(e, n, b)) || b.some(([e, n]) => pointInRing(e, n, a))) return true;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++)
      if (segmentsCross(a[i]!, a[(i + 1) % a.length]!, b[j]!, b[(j + 1) % b.length]!)) return true;
  return false;
}

/**
 * The site check (SPEC 27 step 3): overlaps with existing buildings (a 0.5 m tolerance shrinks
 * touching walls out), and the neighbours that shade the building's footprint on 21 December and
 * 21 March between 08:00 and 16:00, hour by hour, at their likely height (estimates say so;
 * unknown heights never shade).
 */
export function placementCheck(
  hero: HeroModel,
  masses: readonly ContextMass[],
  place: { lat: number; lon: number; tzHours?: number },
  year = 2026,
): PlacementCheck {
  const ground = hero.storeys.find((s) => !s.belowGrade);
  const rings = hero.rooms.filter((r) => r.storeyId === ground?.id).map((r) => r.ring);
  if (!rings.length) return { overlaps: [], shading: [], free: true };
  const box = boxOf(rings.flat());
  const shrink = (ring: readonly EN[]): EN[] => {
    const c = ring.reduce<EN>((s, p) => [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length], [0, 0]);
    return ring.map(([e, n]) => {
      const d = Math.hypot(e - c[0], n - c[1]) || 1;
      return [e - ((e - c[0]) / d) * 0.5, n - ((n - c[1]) / d) * 0.5] as EN;
    });
  };
  const overlaps: string[] = [];
  const near = masses.filter((m) => {
    const b = boxOf(m.ring);
    return (
      b.maxE > box.minE - 400 && b.minE < box.maxE + 400 && b.maxN > box.minN - 400 && b.minN < box.maxN + 400
    );
  });
  for (const m of near) {
    const b = boxOf(m.ring);
    if (b.maxE < box.minE || b.minE > box.maxE || b.maxN < box.minN || b.minN > box.maxN) continue;
    const mr = shrink(m.ring);
    if (rings.some((r) => ringsOverlap(shrink(r), mr))) overlaps.push(m.id);
  }
  // Sample points: room centres and corners, at ground level.
  const samples: EN[] = [];
  for (const r of rings) {
    const c = r.reduce<EN>((s, p) => [s[0] + p[0] / r.length, s[1] + p[1] / r.length], [0, 0]);
    samples.push(c, ...r.map(([e, n]) => [e * 0.8 + c[0] * 0.2, n * 0.8 + c[1] * 0.2] as EN));
  }
  const hours = new Map<string, number>();
  const overlapSet = new Set(overlaps);
  for (const date of [`${year}-12-21`, `${year}-03-21`]) {
    for (let h = 8; h <= 16; h++) {
      const sun = sunOf({ date, minutes: h * 60 }, place.lat, place.lon, place.tzHours);
      if (sun.altitudeDeg < 3) continue;
      for (const m of near) {
        // Unknown heights never shade (Agent A rule): they are reported as estimates elsewhere.
        if (overlapSet.has(m.id) || (m.source === 'unknown' && m.user === undefined)) continue;
        const height = m.user ?? m.likely;
        if (height <= 0.5) continue;
        const polys = shadowPolygons(m.ring, height, sun);
        if (samples.some(([e, n]) => polys.some((poly) => pointInRing(e, n, poly))))
          hours.set(m.id, (hours.get(m.id) ?? 0) + 1);
      }
    }
  }
  const shading: ShadingNeighbour[] = [...hours]
    .map(([id, hrs]) => {
      const m = near.find((x) => x.id === id)!;
      return {
        id,
        ...(m.name ? { name: m.name } : {}),
        hours: hrs,
        heightM: m.user ?? m.likely,
        estimated: m.user === undefined && m.hi - m.lo > 0.5,
      };
    })
    .sort((a, b) => b.hours - a.hours || a.id.localeCompare(b.id))
    .slice(0, 8);
  return { overlaps, shading, free: overlaps.length === 0 };
}
