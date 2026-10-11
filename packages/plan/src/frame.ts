/**
 * Building frame to place frame (ARCH 15.4). The building frame is x east, y north before
 * rotation; `rotationMdeg` turns it clockwise about `origin`, then the place's `trueNorthMdeg`
 * relates the place frame to true north. City pack tiles use the place frame when the place origin
 * is the pack origin (the samples do this).
 */
import type { BuildingDoc, Mdeg, PointMm } from '@ibasho/core';
import { azimuthMdeg, normMdeg, sinCosMdeg } from './angle.ts';

/** A building-frame point in the place frame, whole mm. */
export function toPlaceFrame(doc: Pick<BuildingDoc, 'origin' | 'rotationMdeg'>, p: PointMm): PointMm {
  const [s, c] = sinCosMdeg(doc.rotationMdeg);
  return [Math.round(doc.origin.x + p[0] * c + p[1] * s), Math.round(doc.origin.y - p[0] * s + p[1] * c)];
}

/** Inverse of `toPlaceFrame`. */
export function fromPlaceFrame(doc: Pick<BuildingDoc, 'origin' | 'rotationMdeg'>, p: PointMm): PointMm {
  const [s, c] = sinCosMdeg(doc.rotationMdeg);
  const x = p[0] - doc.origin.x;
  const y = p[1] - doc.origin.y;
  return [Math.round(x * c - y * s), Math.round(x * s + y * c)];
}

/**
 * True azimuth (clockwise from true north) of a building-frame direction, millidegrees.
 * `trueNorthMdeg` is the place frame's rotation from true north (0 when the frame's +y is north).
 */
export function trueAzimuthMdeg(dx: number, dy: number, rotationMdeg: Mdeg, trueNorthMdeg: Mdeg = 0): Mdeg {
  return normMdeg(azimuthMdeg(dx, dy) + rotationMdeg + trueNorthMdeg);
}
