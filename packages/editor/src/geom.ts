/**
 * Plan geometry helpers for the editor (integer mm). Owner: WP-15. Layer L3.
 *
 * Editor-side only: snapping, hit tests, live previews and quick meters while drawing. The
 * canonical geometry (Clipper2 booleans, exact quantities, adjacency) is `packages/plan` (WP-14);
 * when it lands, `checks.ts` reads its `compile()` and these stay for interaction.
 */
import type { FacadeBin, Mm, PointMm, PolygonMm } from '@ibasho/core';
import { facadeBin } from '@ibasho/core';

/** Twice the signed area, mm² (positive for counter-clockwise). Exact for safe integers. */
export function signedArea2(ring: readonly PointMm[]): bigint {
  let s = 0n;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i] as PointMm;
    const [x1, y1] = ring[(i + 1) % ring.length] as PointMm;
    s += BigInt(x0) * BigInt(y1) - BigInt(x1) * BigInt(y0);
  }
  return s;
}

/** Exact area of a polygon with holes, mm². */
export function areaMm2(p: PolygonMm): bigint {
  const abs = (v: bigint) => (v < 0n ? -v : v);
  let a = abs(signedArea2(p.outer));
  for (const h of p.holes) a -= abs(signedArea2(h));
  return a / 2n;
}

/** Area in m² for drawing and labels (not a result). */
export const areaM2 = (p: PolygonMm): number => Number(areaMm2(p)) / 1e6;

/** Counter-clockwise copy of a ring. */
export function ccw(ring: PointMm[]): PointMm[] {
  return signedArea2(ring) < 0n ? [...ring].reverse() : ring;
}

export interface Box {
  x0: Mm;
  y0: Mm;
  x1: Mm;
  y1: Mm;
}

export function bbox(ring: readonly PointMm[]): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of ring) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

/** A counter-clockwise rectangle from two corners. */
export function rect(a: PointMm, b: PointMm): PointMm[] {
  const x0 = Math.min(a[0], b[0]);
  const x1 = Math.max(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]);
  const y1 = Math.max(a[1], b[1]);
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

export function isAxisRect(ring: readonly PointMm[]): boolean {
  if (ring.length !== 4) return false;
  const b = bbox(ring);
  return ring.every(([x, y]) => (x === b.x0 || x === b.x1) && (y === b.y0 || y === b.y1));
}

export function centroid(ring: readonly PointMm[]): [number, number] {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i] as PointMm;
    const [x1, y1] = ring[(i + 1) % ring.length] as PointMm;
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (a === 0) {
    const b = bbox(ring);
    return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

export function pointInPolygon(p: readonly [number, number], ring: readonly PointMm[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as PointMm;
    const [xj, yj] = ring[j] as PointMm;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Edge `i` of a ring: from vertex i to vertex i + 1. */
export function edge(ring: readonly PointMm[], i: number): [PointMm, PointMm] {
  return [ring[i] as PointMm, ring[(i + 1) % ring.length] as PointMm];
}

export const edgeLength = ([a, b]: [PointMm, PointMm]): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * Outward normal azimuth of edge `i` of a counter-clockwise ring in plan millidegrees (0 = plan
 * north, clockwise), plus the building rotation from true north.
 */
export function edgeAzimuthMdeg(ring: readonly PointMm[], i: number, rotationMdeg = 0): number {
  const [a, b] = edge(ring, i);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  // Outward normal of a CCW ring is (nx, ny) = (dy, -dx); azimuth from +y clockwise is atan2(nx, ny).
  const az = Math.round(((Math.atan2(dy, -dx) * 180) / Math.PI) * 1000);
  return (((az + rotationMdeg) % 360_000) + 360_000) % 360_000;
}

export function edgeBin(ring: readonly PointMm[], i: number, rotationMdeg = 0): FacadeBin {
  return facadeBin(edgeAzimuthMdeg(ring, i, rotationMdeg));
}

/** Distance from point to segment, and the parameter along it (0 to 1). */
export function distToSegment(
  p: readonly [number, number],
  a: PointMm,
  b: PointMm,
): { d: number; t: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  const x = a[0] + t * dx;
  const y = a[1] + t * dy;
  return { d: Math.hypot(p[0] - x, p[1] - y), t };
}

/** Two collinear edges that overlap along a stretch (shared wall), with the overlap length. */
export function sharedLength(e1: [PointMm, PointMm], e2: [PointMm, PointMm], tol = 1): number {
  const [a, b] = e1;
  const [c, d] = e2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return 0;
  const cross = (p: PointMm) => Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
  if (cross(c) > tol || cross(d) > tol) return 0;
  const proj = (p: PointMm) => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len;
  const lo = Math.max(0, Math.min(proj(c), proj(d)));
  const hi = Math.min(len, Math.max(proj(c), proj(d)));
  return Math.max(0, hi - lo);
}

/**
 * Clip a convex or concave ring by the half plane `n · p <= k` (Sutherland and Hodgman). Exact for
 * axis-aligned cuts on integer rings, which is what the split tool makes.
 */
export function clipHalfPlane(ring: readonly PointMm[], nx: number, ny: number, k: number): PointMm[] {
  const out: PointMm[] = [];
  const inside = (p: PointMm) => nx * p[0] + ny * p[1] <= k;
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i] as PointMm;
    const prev = ring[(i + ring.length - 1) % ring.length] as PointMm;
    const ci = inside(cur);
    const pi = inside(prev);
    if (ci !== pi) {
      const t = (k - (nx * prev[0] + ny * prev[1])) / (nx * (cur[0] - prev[0]) + ny * (cur[1] - prev[1]));
      out.push([Math.round(prev[0] + t * (cur[0] - prev[0])), Math.round(prev[1] + t * (cur[1] - prev[1]))]);
    }
    if (ci) out.push(cur);
  }
  return dedupe(out);
}

function dedupe(ring: PointMm[]): PointMm[] {
  return ring.filter((p, i) => {
    const q = ring[(i + ring.length - 1) % ring.length] as PointMm;
    return ring.length < 2 || p[0] !== q[0] || p[1] !== q[1];
  });
}

/** Split a ring by a vertical (`x`) or horizontal (`y`) line. Returns two rings or null. */
export function splitRing(ring: readonly PointMm[], axis: 'x' | 'y', at: Mm): [PointMm[], PointMm[]] | null {
  const [nx, ny] = axis === 'x' ? [1, 0] : [0, 1];
  const a = clipHalfPlane(ring, nx, ny, at);
  const b = clipHalfPlane(ring, -nx, -ny, -at);
  if (a.length < 3 || b.length < 3) return null;
  if (signedArea2(a) === 0n || signedArea2(b) === 0n) return null;
  return [ccw(a), ccw(b)];
}

/** Overlap area of two axis-aligned boxes, mm² (fast pre-check for overlapping rooms). */
export function boxOverlap(a: Box, b: Box): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Overlap area of two rings (exact for rectangles, convex clip otherwise), mm². */
export function overlapArea(r1: readonly PointMm[], r2: readonly PointMm[]): number {
  if (boxOverlap(bbox(r1), bbox(r2)) === 0) return 0;
  // Clip r1 by every edge of r2 (r2 treated as convex; rooms from the tools are).
  let poly: PointMm[] = [...r1];
  const ring = ccw([...r2]);
  for (let i = 0; i < ring.length && poly.length >= 3; i++) {
    const [a, b] = edge(ring, i);
    // Inside of a CCW edge is to the left: cross(b - a, p - a) >= 0  <=>  n · p <= k with n = (dy, -dx).
    const nx = b[1] - a[1];
    const ny = -(b[0] - a[0]);
    poly = clipHalfPlane(poly, nx, ny, nx * a[0] + ny * a[1]);
  }
  if (poly.length < 3) return 0;
  const s = signedArea2(poly);
  return Number(s < 0n ? -s : s) / 2;
}
