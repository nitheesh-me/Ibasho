/**
 * One camera model for WebGL and SVG (BUILD_PLAN WP-07 G4: the two must match within 2 px at
 * the Pencil to Ink handover). Pure math, no three.js. Owner: WP-07.
 *
 * Azimuth is degrees clockwise from north (twin convention): the camera sits on that side of
 * the target, so azimuth 0 looks south at a north-facing front. Elevation is degrees above the
 * horizon. `zoom` is screen pixels per metre (CSS pixels).
 */
import type { Vec3 } from '@ibasho/core';
import { add, cross, dot, normalize, scale, sub } from '../twin/frame.ts';

export interface CameraModel {
  azimuthDeg: number;
  elevationDeg: number;
  target: Vec3;
  /** Pixels per metre. */
  zoom: number;
  /** Distance from target to eye, metres (orthographic: only near and far planes care). */
  distance: number;
  viewport: { width: number; height: number };
}

export const AZIMUTH_STEP = 45;
export const DEFAULT_ELEVATION = 30;

export function snapAzimuth(deg: number): number {
  const s = Math.round(deg / AZIMUTH_STEP) * AZIMUTH_STEP;
  return ((s % 360) + 360) % 360;
}

/** Unit vector from target towards the eye. */
export function eyeDirection(azimuthDeg: number, elevationDeg: number): Vec3 {
  const a = (azimuthDeg * Math.PI) / 180;
  const e = (elevationDeg * Math.PI) / 180;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
}

export interface CameraBasis {
  eye: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
}

export function cameraBasis(m: Pick<CameraModel, 'azimuthDeg' | 'elevationDeg' | 'target' | 'distance'>): CameraBasis {
  const d = eyeDirection(m.azimuthDeg, m.elevationDeg);
  const eye = add(m.target, scale(d, m.distance));
  const forward = normalize(sub(m.target, eye));
  // three.js lookAt with up (0, 1, 0): right = forward x up.
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  return { eye, forward, right, up };
}

export interface Projected {
  x: number;
  y: number;
  /** Distance along the view direction (larger is farther). */
  depth: number;
}

/** Orthographic projection to CSS pixels (origin top-left), the same as three.js would give. */
export function projectOrtho(m: CameraModel, p: Vec3, basis: CameraBasis = cameraBasis(m)): Projected {
  const d = sub(p, basis.eye);
  const x = dot(d, basis.right);
  const y = dot(d, basis.up);
  return {
    x: m.viewport.width / 2 + x * m.zoom,
    y: m.viewport.height / 2 - y * m.zoom,
    depth: dot(d, basis.forward),
  };
}

/** Orthographic frustum half extents in metres (three.js `left/right/top/bottom` with zoom 1). */
export function orthoFrustum(m: CameraModel): { left: number; right: number; top: number; bottom: number } {
  const hw = m.viewport.width / 2 / m.zoom;
  const hh = m.viewport.height / 2 / m.zoom;
  return { left: -hw, right: hw, top: hh, bottom: -hh };
}

/** Zoom and target that fit the given points in the viewport with a margin (fraction). */
export function fitCamera(
  m: Omit<CameraModel, 'zoom' | 'target'> & { target?: Vec3 },
  points: readonly Vec3[],
  margin = 0.12,
): CameraModel {
  const target0: Vec3 = m.target ?? [0, 0, 0];
  const base: CameraModel = { ...m, target: target0, zoom: 1 };
  const basis = cameraBasis(base);
  let x0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    const d = sub(p, basis.eye);
    const x = dot(d, basis.right);
    const y = dot(d, basis.up);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const w = Math.max(1e-6, x1 - x0);
  const h = Math.max(1e-6, y1 - y0);
  const zoom =
    Math.min(m.viewport.width / w, m.viewport.height / h) * (1 - 2 * margin);
  // Shift the target so the box centre lands in the middle of the viewport.
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const target = add(add(target0, scale(basis.right, cx)), scale(basis.up, cy));
  return { ...m, target, zoom };
}

/** Is a surface with outward normal `n` facing the camera (seen from outside)? */
export function facesCamera(n: Vec3, azimuthDeg: number, elevationDeg: number, threshold = 0.3): boolean {
  return dot(n, eyeDirection(azimuthDeg, elevationDeg)) > threshold;
}
