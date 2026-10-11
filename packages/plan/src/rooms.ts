/** Room operations for the editor (BE 3): rectangle rooms and splitting a room by a line. */
import type { Mm, PointMm, PolygonMm } from '@ibasho/core';
import { intersect } from './clip.ts';
import { rectRing } from './polygon.ts';

export const rectPolygon = (x0: Mm, y0: Mm, x1: Mm, y1: Mm): PolygonMm => ({
  outer: rectRing(x0, y0, x1, y1),
  holes: [],
});

/**
 * Split a polygon by the infinite line through a and b: returns the left part and the right part
 * (either may be empty). Uses half-plane quads large enough for any plan (±10 km).
 */
export function splitPolygon(
  p: PolygonMm,
  a: PointMm,
  b: PointMm,
): { left: PolygonMm[]; right: PolygonMm[] } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const k = 10_000_000 / len;
  const ux = dx * k;
  const uy = dy * k;
  const p0: PointMm = [Math.round(a[0] - ux), Math.round(a[1] - uy)];
  const p1: PointMm = [Math.round(a[0] + ux), Math.round(a[1] + uy)];
  const nl: PointMm = [Math.round(-uy), Math.round(ux)];
  const left: PolygonMm = {
    outer: [p0, p1, [p1[0] + nl[0], p1[1] + nl[1]], [p0[0] + nl[0], p0[1] + nl[1]]],
    holes: [],
  };
  const right: PolygonMm = {
    outer: [p0, [p0[0] - nl[0], p0[1] - nl[1]], [p1[0] - nl[0], p1[1] - nl[1]], p1],
    holes: [],
  };
  return { left: intersect([p], [left]), right: intersect([p], [right]) };
}
