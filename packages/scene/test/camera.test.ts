/**
 * Camera model parity (BUILD_PLAN WP-07 G4): the pure model that drives the SVG renderer must
 * project exactly as a three.js OrthographicCamera set up from the same model.
 */
import { OrthographicCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  type CameraModel,
  cameraBasis,
  eyeDirection,
  facesCamera,
  fitCamera,
  orthoFrustum,
  projectOrtho,
  snapAzimuth,
} from '../src/camera/model.ts';
import { house } from './helpers.ts';

const model: CameraModel = {
  azimuthDeg: 45,
  elevationDeg: 30,
  target: [1, 2, -3],
  zoom: 40,
  distance: 30,
  viewport: { width: 960, height: 600 },
};

function threeProject(m: CameraModel, p: [number, number, number]): { x: number; y: number } {
  const f = orthoFrustum(m);
  const cam = new OrthographicCamera(f.left, f.right, f.top, f.bottom, 0.1, 200);
  const b = cameraBasis(m);
  cam.position.set(...b.eye);
  cam.up.set(0, 1, 0);
  cam.lookAt(...m.target);
  cam.updateMatrixWorld();
  const v = new Vector3(...p).project(cam);
  return { x: ((v.x + 1) / 2) * m.viewport.width, y: ((1 - v.y) / 2) * m.viewport.height };
}

describe('camera model', () => {
  it('snaps azimuth to 45 degree steps in [0, 360)', () => {
    expect(snapAzimuth(23)).toBe(45);
    expect(snapAzimuth(-10)).toBe(0);
    expect(snapAzimuth(350)).toBe(0);
    expect(snapAzimuth(-100)).toBe(270);
    expect(snapAzimuth(720 + 90)).toBe(90);
  });

  it('eye direction is a unit vector on the azimuth side (0 is north, -z)', () => {
    for (const [az, el] of [
      [0, 0],
      [90, 30],
      [225, 60],
    ] as const) {
      const d = eyeDirection(az, el);
      expect(Math.hypot(...d)).toBeCloseTo(1, 12);
    }
    const n = eyeDirection(0, 0);
    expect(n[2]).toBeCloseTo(-1, 12);
    const e = eyeDirection(90, 0);
    expect(e[0]).toBeCloseTo(1, 12);
  });

  it('the basis is orthonormal and right-handed like three.js lookAt', () => {
    const b = cameraBasis(model);
    const dot = (a: number[], c: number[]) => a[0]! * c[0]! + a[1]! * c[1]! + a[2]! * c[2]!;
    expect(dot(b.right, b.up)).toBeCloseTo(0, 12);
    expect(dot(b.right, b.forward)).toBeCloseTo(0, 12);
    expect(dot(b.up, b.forward)).toBeCloseTo(0, 12);
    expect(b.up[1]).toBeGreaterThan(0);
  });

  it('matches three.js orthographic projection to well under 2 px (G4)', () => {
    const pts: [number, number, number][] = [
      [1, 2, -3],
      [0, 0, 0],
      [4.5, 7.2, 1],
      [-3, 0.5, -8],
      ...house.surfaces.slice(0, 20).flatMap((s) => s.polygon),
    ];
    for (const az of [0, 45, 135, 270, 315]) {
      const m = { ...model, azimuthDeg: az };
      for (const p of pts) {
        const ours = projectOrtho(m, p);
        const theirs = threeProject(m, p);
        expect(Math.abs(ours.x - theirs.x)).toBeLessThan(1e-6);
        expect(Math.abs(ours.y - theirs.y)).toBeLessThan(1e-6);
      }
    }
  });

  it('fitCamera puts every point inside the viewport with the margin', () => {
    const pts = house.surfaces.flatMap((s) => s.polygon);
    const margin = 0.12;
    const m = fitCamera(
      { azimuthDeg: 45, elevationDeg: 30, distance: 40, viewport: { width: 960, height: 600 } },
      pts,
      margin,
    );
    let x0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;
    for (const p of pts) {
      const q = projectOrtho(m, p);
      x0 = Math.min(x0, q.x);
      x1 = Math.max(x1, q.x);
      y0 = Math.min(y0, q.y);
      y1 = Math.max(y1, q.y);
    }
    const eps = 1e-6;
    expect(x0).toBeGreaterThanOrEqual(960 * margin - eps);
    expect(x1).toBeLessThanOrEqual(960 * (1 - margin) + eps);
    expect(y0).toBeGreaterThanOrEqual(600 * margin - eps);
    expect(y1).toBeLessThanOrEqual(600 * (1 - margin) + eps);
    // Centred: the box midpoint lands in the viewport centre, and one axis is tight.
    expect((x0 + x1) / 2).toBeCloseTo(480, 6);
    expect((y0 + y1) / 2).toBeCloseTo(300, 6);
    const tight =
      Math.abs(x1 - x0 - 960 * (1 - 2 * margin)) < 1e-6 || Math.abs(y1 - y0 - 600 * (1 - 2 * margin)) < 1e-6;
    expect(tight).toBe(true);
  });

  it('facesCamera agrees with the eye side', () => {
    expect(facesCamera([0, 0, -1], 0, 30)).toBe(true);
    expect(facesCamera([0, 0, 1], 0, 30)).toBe(false);
    expect(facesCamera([0, 1, 0], 0, 60)).toBe(true);
  });
});
