/**
 * Massing auto-zoning (BE 2.4, ASHRAE 90.1 Appendix G): a core plus one perimeter zone per facade
 * edge, `perimeterDepth` deep (default 4570 mm). Exact for convex footprints: the inset ring is
 * built from offset edge lines, so perimeter zone i is the quad between edge i and inset edge i.
 * A non-convex footprint falls back to one core and one perimeter ring (Clipper difference).
 */
import type { Mm, PointMm, PolygonMm } from '@ibasho/core';
import { difference, offset } from './clip.ts';
import { edgeLength, normaliseRing, ringArea2 } from './polygon.ts';

export interface ZoneShape {
  id: string;
  kind: 'core' | 'perimeter';
  /** Footprint edge index for a perimeter zone. */
  edge?: number;
  polygon: PolygonMm;
}

function isConvex(ring: readonly PointMm[]): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i] as PointMm;
    const b = ring[(i + 1) % n] as PointMm;
    const c = ring[(i + 2) % n] as PointMm;
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross < 0) return false;
  }
  return true;
}

/** Inset ring of a convex counter-clockwise ring by `d`, or undefined when it collapses. */
function insetConvex(ring: readonly PointMm[], d: Mm): PointMm[] | undefined {
  const n = ring.length;
  const lines = ring.map((a, i) => {
    const b = ring[(i + 1) % n] as PointMm;
    const len = edgeLength(a, b);
    // Inward normal of a CCW edge is (-dy, dx) / len.
    const nx = (-(b[1] - a[1]) / len) * d;
    const ny = ((b[0] - a[0]) / len) * d;
    return {
      p: [a[0] + nx, a[1] + ny] as [number, number],
      v: [b[0] - a[0], b[1] - a[1]] as [number, number],
    };
  });
  const out: PointMm[] = [];
  for (let i = 0; i < n; i++) {
    const l1 = lines[(i + n - 1) % n] as (typeof lines)[number];
    const l2 = lines[i] as (typeof lines)[number];
    const den = l1.v[0] * l2.v[1] - l1.v[1] * l2.v[0];
    if (den === 0) return undefined;
    const t = ((l2.p[0] - l1.p[0]) * l2.v[1] - (l2.p[1] - l1.p[1]) * l2.v[0]) / den;
    out.push([Math.round(l1.p[0] + t * l1.v[0]), Math.round(l1.p[1] + t * l1.v[1])]);
  }
  return ringArea2(out) > 0n ? out : undefined;
}

export function autoZone(footprint: readonly PointMm[], perimeterDepth: Mm = 4570): ZoneShape[] {
  const ring = normaliseRing(footprint, true);
  if (isConvex(ring)) {
    const inner = insetConvex(ring, perimeterDepth);
    if (!inner) return [{ id: 'z_core', kind: 'core', polygon: { outer: ring, holes: [] } }];
    const zones: ZoneShape[] = ring.map((a, i) => ({
      id: `z_perim_${i}`,
      kind: 'perimeter',
      edge: i,
      polygon: {
        outer: normaliseRing(
          [
            a,
            ring[(i + 1) % ring.length] as PointMm,
            inner[(i + 1) % ring.length] as PointMm,
            inner[i] as PointMm,
          ],
          true,
        ),
        holes: [],
      },
    }));
    return [{ id: 'z_core', kind: 'core', polygon: { outer: inner, holes: [] } }, ...zones];
  }
  const fp: PolygonMm = { outer: ring, holes: [] };
  const core = offset([fp], -perimeterDepth);
  const perim = difference([fp], core);
  return [
    ...core.map((p, i) => ({ id: `z_core${i ? `_${i}` : ''}`, kind: 'core' as const, polygon: p })),
    ...perim.map((p, i) => ({ id: `z_perim_${i}`, kind: 'perimeter' as const, polygon: p })),
  ];
}
