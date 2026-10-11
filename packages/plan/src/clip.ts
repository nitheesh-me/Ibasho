/**
 * Polygon booleans and offsets on integer millimetres via Clipper2 (clipper2-ts 2.0.1, Angus
 * Johnson, BSL-1.0; ARCH 15.9). Results are normalised: counter-clockwise outers, clockwise holes,
 * sorted for determinism.
 */
import type { Mm, PointMm, PolygonMm } from '@ibasho/core';
import { Clipper, EndType, FillRule, JoinType, type Paths64 } from 'clipper2-ts';
import { isCCW, normaliseRing, pointInRing } from './polygon.ts';

const toPaths = (polys: readonly PolygonMm[]): Paths64 =>
  polys.flatMap((p) => [p.outer, ...p.holes].map((r) => r.map(([x, y]) => ({ x, y }))));

function fromPaths(paths: Paths64): PolygonMm[] {
  const rings = paths
    .map((p) => p.map((q): PointMm => [Math.round(q.x), Math.round(q.y)]))
    .filter((r) => r.length >= 3);
  const outers = rings.filter((r) => isCCW(r)).map((r) => normaliseRing(r, true));
  const holes = rings.filter((r) => !isCCW(r)).map((r) => normaliseRing(r, false));
  const out: PolygonMm[] = outers.map((o) => ({ outer: o, holes: [] }));
  for (const h of holes) {
    const host = out.find((o) => pointInRing(h[0] as PointMm, o.outer));
    host?.holes.push(h);
  }
  const key = (p: PolygonMm) => `${p.outer[0]?.[0] ?? 0},${p.outer[0]?.[1] ?? 0}`;
  return out.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

export const union = (a: readonly PolygonMm[], b: readonly PolygonMm[] = []): PolygonMm[] =>
  fromPaths(Clipper.union(toPaths(a), toPaths(b), FillRule.NonZero));
export const intersect = (a: readonly PolygonMm[], b: readonly PolygonMm[]): PolygonMm[] =>
  fromPaths(Clipper.intersect(toPaths(a), toPaths(b), FillRule.NonZero));
export const difference = (a: readonly PolygonMm[], b: readonly PolygonMm[]): PolygonMm[] =>
  fromPaths(Clipper.difference(toPaths(a), toPaths(b), FillRule.NonZero));

/** Offset outward (positive) or inward (negative) with mitred corners. */
export const offset = (a: readonly PolygonMm[], delta: Mm): PolygonMm[] =>
  fromPaths(Clipper.inflatePaths(toPaths(a), delta, JoinType.Miter, EndType.Polygon, 4));

/** Triangulate a polygon with holes (Clipper2 constrained Delaunay); triangles as point triples. */
export function triangulate(p: PolygonMm): [PointMm, PointMm, PointMm][] {
  const res = Clipper.triangulate(toPaths([p]), true);
  return res.solution
    .filter((t) => t.length === 3)
    .map((t) => t.map((q): PointMm => [Math.round(q.x), Math.round(q.y)]) as [PointMm, PointMm, PointMm]);
}
