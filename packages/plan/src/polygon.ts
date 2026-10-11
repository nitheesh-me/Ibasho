/**
 * Exact polygon helpers on integer millimetres (BE 2, AC-ED2). Areas are bigint mm², never floats.
 */
import type { Mm, Mm2, PointMm, PolygonMm } from '@ibasho/core';

/** Twice the signed area of a ring, exact (positive when counter-clockwise). */
export function ringArea2(ring: readonly PointMm[]): bigint {
  let s = 0n;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i] as PointMm;
    const b = ring[(i + 1) % n] as PointMm;
    s += BigInt(a[0]) * BigInt(b[1]) - BigInt(b[0]) * BigInt(a[1]);
  }
  return s;
}

/** Unsigned ring area in mm². Exact for integer vertices up to rounding of the final halving. */
export function ringAreaMm2(ring: readonly PointMm[]): Mm2 {
  const a = ringArea2(ring);
  return (a < 0n ? -a : a) / 2n;
}

/** Polygon area (outer minus holes) in mm². */
export function polygonAreaMm2(p: PolygonMm): Mm2 {
  let a = ringAreaMm2(p.outer);
  for (const h of p.holes) a -= ringAreaMm2(h);
  return a;
}

export const isCCW = (ring: readonly PointMm[]): boolean => ringArea2(ring) > 0n;

/** Counter-clockwise copy without repeated or closing points. */
export function normaliseRing(ring: readonly PointMm[], ccw = true): PointMm[] {
  const out: PointMm[] = [];
  for (const p of ring) {
    const l = out[out.length - 1];
    if (!l || l[0] !== p[0] || l[1] !== p[1]) out.push([p[0], p[1]]);
  }
  const f = out[0];
  const l = out[out.length - 1];
  if (out.length > 1 && f && l && f[0] === l[0] && f[1] === l[1]) out.pop();
  return isCCW(out) === ccw ? out : out.reverse();
}

/** Axis-aligned rectangle ring, counter-clockwise, from two corners. */
export function rectRing(x0: Mm, y0: Mm, x1: Mm, y1: Mm): PointMm[] {
  const [a, c] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [b, d] = [Math.min(y0, y1), Math.max(y0, y1)];
  return [
    [a, b],
    [c, b],
    [c, d],
    [a, d],
  ];
}

/** Point in ring by crossings; points on the boundary count as inside. */
export function pointInRing(p: PointMm, ring: readonly PointMm[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i] as PointMm;
    const b = ring[j] as PointMm;
    if (onSegment(p, a, b)) return true;
    if (a[1] > p[1] !== b[1] > p[1]) {
      // Compare p.x with the crossing x exactly in integers.
      const lhs = BigInt(p[0] - a[0]) * BigInt(b[1] - a[1]);
      const rhs = BigInt(b[0] - a[0]) * BigInt(p[1] - a[1]);
      if (b[1] - a[1] > 0 ? lhs < rhs : lhs > rhs) c = !c;
    }
  }
  return c;
}

export function pointInPolygon(p: PointMm, poly: PolygonMm): boolean {
  if (!pointInRing(p, poly.outer)) return false;
  return !poly.holes.some(
    (h) =>
      pointInRing(p, h) && !h.some((_, i) => onSegment(p, h[i] as PointMm, h[(i + 1) % h.length] as PointMm)),
  );
}

/** Exact: p lies on the closed segment ab. */
export function onSegment(p: PointMm, a: PointMm, b: PointMm): boolean {
  const cross = BigInt(b[0] - a[0]) * BigInt(p[1] - a[1]) - BigInt(b[1] - a[1]) * BigInt(p[0] - a[0]);
  if (cross !== 0n) return false;
  return (
    p[0] >= Math.min(a[0], b[0]) &&
    p[0] <= Math.max(a[0], b[0]) &&
    p[1] >= Math.min(a[1], b[1]) &&
    p[1] <= Math.max(a[1], b[1])
  );
}

export function bounds(ring: readonly PointMm[]): { minX: Mm; minY: Mm; maxX: Mm; maxY: Mm } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/** Area centroid of a ring, rounded to whole mm (vertex mean for a degenerate ring). */
export function centroid(ring: readonly PointMm[]): PointMm {
  const a2 = ringArea2(ring);
  if (a2 === 0n) {
    const n = ring.length || 1;
    return [
      Math.round(ring.reduce((s, p) => s + p[0], 0) / n),
      Math.round(ring.reduce((s, p) => s + p[1], 0) / n),
    ];
  }
  let cx = 0n;
  let cy = 0n;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as PointMm;
    const b = ring[(i + 1) % ring.length] as PointMm;
    const k = BigInt(a[0]) * BigInt(b[1]) - BigInt(b[0]) * BigInt(a[1]);
    cx += (BigInt(a[0]) + BigInt(b[0])) * k;
    cy += (BigInt(a[1]) + BigInt(b[1])) * k;
  }
  const d = 3n * a2;
  return [Number(cx / d), Number(cy / d)];
}

/** Edge length in mm (float; sqrt is exact-rounded). */
export function edgeLength(a: PointMm, b: PointMm): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/** Perimeter of a ring in mm. */
export function perimeter(ring: readonly PointMm[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++)
    s += edgeLength(ring[i] as PointMm, ring[(i + 1) % ring.length] as PointMm);
  return s;
}

/** mm² to m² as a float for display only. */
export const m2 = (a: Mm2): number => Number(a) / 1e6;
