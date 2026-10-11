/**
 * City frames (ARCH 15.7). Owner: WP-07.
 *
 * Three frames meet here:
 * - the pack frame: metres east and north of the city pack origin (tiles store integer mm);
 * - the building frame: a `BuildingDoc` plan in mm, placed by `origin` and `rotationMdeg`;
 * - the world frame of the scene: metres, x east, y up, z south (so north is -z), which keeps
 *   three.js right handed.
 *
 * Building rotation convention (posted on the blackboard): the plan +y axis points to the
 * bearing `rotationMdeg` (clockwise from true north), so plan +x points to that bearing plus 90.
 */
import type { BuildingDoc, PointMm } from '@ibasho/core';

/** A point east and north of the pack origin, metres. */
export type EN = readonly [east: number, north: number];

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON_EQ = 111_320;
const RAD = Math.PI / 180;

/** Equirectangular offset of `lat`, `lon` from `origin`, in metres (good to centimetres over 2 km). */
export function latLonToEN(origin: { lat: number; lon: number }, lat: number, lon: number): EN {
  const east = (lon - origin.lon) * M_PER_DEG_LON_EQ * Math.cos(origin.lat * RAD);
  const north = (lat - origin.lat) * M_PER_DEG_LAT;
  return [east, north];
}

/** Inverse of `latLonToEN`. */
export function enToLatLon(origin: { lat: number; lon: number }, [e, n]: EN): { lat: number; lon: number } {
  return {
    lat: origin.lat + n / M_PER_DEG_LAT,
    lon: origin.lon + e / (M_PER_DEG_LON_EQ * Math.cos(origin.lat * RAD)),
  };
}

/** Pack frame (mm) to east and north metres. */
export const mmToEN = ([x, y]: PointMm): EN => [x / 1000, y / 1000];

/** East, north (m) and height (m) to world [x, y, z]. */
export function enToWorld([e, n]: EN, h = 0): [number, number, number] {
  return [e, h, -n];
}

/** A building plan point (mm) to the pack frame (m east, north). */
export function planToEN(doc: Pick<BuildingDoc, 'origin' | 'rotationMdeg'>, [x, y]: PointMm): EN {
  const r = (doc.rotationMdeg / 1000) * RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const bx = x / 1000;
  const by = y / 1000;
  return [doc.origin.x / 1000 + bx * c + by * s, doc.origin.y / 1000 - bx * s + by * c];
}

/** Bearing (degrees clockwise from north) of a plan direction rotated into the pack frame. */
export function planBearing(doc: Pick<BuildingDoc, 'rotationMdeg'>, dx: number, dy: number): number {
  const r = (doc.rotationMdeg / 1000) * RAD;
  const e = dx * Math.cos(r) + dy * Math.sin(r);
  const n = -dx * Math.sin(r) + dy * Math.cos(r);
  return (((Math.atan2(e, n) / RAD) % 360) + 360) % 360;
}

/** Signed area of a ring (positive when counter-clockwise). */
export function ringArea(ring: readonly EN[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Counter-clockwise copy of a ring. */
export function ccw(ring: readonly EN[]): EN[] {
  return ringArea(ring) < 0 ? [...ring].reverse() : [...ring];
}

export function pointInRing(x: number, y: number, ring: readonly EN[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface Box2 {
  minE: number;
  minN: number;
  maxE: number;
  maxN: number;
}

export function boxOf(points: Iterable<EN>): Box2 {
  const b = { minE: Infinity, minN: Infinity, maxE: -Infinity, maxN: -Infinity };
  for (const [e, n] of points) {
    if (e < b.minE) b.minE = e;
    if (e > b.maxE) b.maxE = e;
    if (n < b.minN) b.minN = n;
    if (n > b.maxN) b.maxN = n;
  }
  return b;
}

export function growBox(b: Box2, m: number): Box2 {
  return { minE: b.minE - m, minN: b.minN - m, maxE: b.maxE + m, maxN: b.maxN + m };
}

/** An oriented rectangle, centre (m), size (m) and long axis bearing (degrees). */
export function orientedRect(c: EN, length: number, width: number, bearingDeg: number): EN[] {
  const r = bearingDeg * RAD;
  const ux = Math.sin(r);
  const uy = Math.cos(r);
  const vx = uy;
  const vy = -ux;
  const hl = length / 2;
  const hw = width / 2;
  return ccw([
    [c[0] - ux * hl - vx * hw, c[1] - uy * hl - vy * hw],
    [c[0] + ux * hl - vx * hw, c[1] + uy * hl - vy * hw],
    [c[0] + ux * hl + vx * hw, c[1] + uy * hl + vy * hw],
    [c[0] - ux * hl + vx * hw, c[1] - uy * hl + vy * hw],
  ]);
}

export const toMm = (ring: readonly EN[]): PointMm[] =>
  ring.map(([e, n]) => [Math.round(e * 1000), Math.round(n * 1000)] as PointMm);
