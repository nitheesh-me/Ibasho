/**
 * Planar frames for twin polygons. Pure math (no three.js), shared by the WebGL geometry
 * builder and the SVG renderer so both draw the same shapes. Owner: WP-07.
 *
 * Twin coordinates (core `twin.ts`): metres, x east, y up, z south, origin at the front-left
 * ground corner. Outer rings are counter-clockwise seen from outside, so the Newell normal
 * points outwards.
 */
import type { Vec2, Vec3 } from '@ibasho/core';

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export function normalize(a: Vec3): Vec3 {
  const l = length(a);
  return l === 0 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
}
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Newell normal of a polygon (unit length). Robust for concave and slightly non-planar rings. */
export function newellNormal(poly: readonly Vec3[]): Vec3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return normalize([nx, ny, nz]);
}

export function centroid(poly: readonly Vec3[]): Vec3 {
  let c: Vec3 = [0, 0, 0];
  for (const p of poly) c = add(c, p);
  return scale(c, 1 / Math.max(1, poly.length));
}

/**
 * Orthonormal frame on a plane: `u` and `v` span it, `n` is the outward normal.
 * Walls get a horizontal `u` and an upward `v`, so brick courses stay level.
 * Horizontal planes get `u` along x.
 */
export interface PlaneFrame {
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  n: Vec3;
}

export function planeFrame(poly: readonly Vec3[]): PlaneFrame {
  const n = newellNormal(poly);
  const origin = poly[0] ?? [0, 0, 0];
  const up: Vec3 = [0, 1, 0];
  let u: Vec3;
  if (Math.abs(n[1]) > 0.999) {
    // Horizontal: keep u along +x; v follows so that (u, v, n) is right handed.
    u = [1, 0, 0];
  } else {
    u = normalize(cross(up, n));
  }
  const v = normalize(cross(n, u));
  return { origin, u, v, n };
}

export function toPlane(f: PlaneFrame, p: Vec3): Vec2 {
  const d = sub(p, f.origin);
  return [dot(d, f.u), dot(d, f.v)];
}

export function fromPlane(f: PlaneFrame, q: Vec2, offset = 0): Vec3 {
  return add(add(add(f.origin, scale(f.u, q[0])), scale(f.v, q[1])), scale(f.n, offset));
}

/** Signed area of a 2D ring (positive when counter-clockwise). */
export function signedArea2(ring: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Point in polygon (even-odd), 2D. */
export function pointInRing(p: Vec2, ring: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

export interface Bounds2 {
  min: Vec2;
  max: Vec2;
}
export function bounds2(ring: readonly Vec2[]): Bounds2 {
  const min: Vec2 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vec2 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const p of ring) {
    min[0] = Math.min(min[0], p[0]);
    min[1] = Math.min(min[1], p[1]);
    max[0] = Math.max(max[0], p[0]);
    max[1] = Math.max(max[1], p[1]);
  }
  return { min, max };
}

export interface Bounds3 {
  min: Vec3;
  max: Vec3;
}
export function bounds3(points: readonly Vec3[]): Bounds3 {
  const min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const p of points) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, p[k]!);
      max[k] = Math.max(max[k]!, p[k]!);
    }
  }
  return { min, max };
}

/** Polyline length. */
export function polylineLength(path: readonly Vec3[]): number {
  let l = 0;
  for (let i = 1; i < path.length; i++) l += length(sub(path[i]!, path[i - 1]!));
  return l;
}
