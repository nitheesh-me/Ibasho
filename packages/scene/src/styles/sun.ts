/**
 * Sun direction from suncalc for the home's coordinates (DESIGN_SYSTEM 10: "sun from
 * suncalc"). Owner: WP-07.
 */
import type { Vec3 } from '@ibasho/core';
import * as SunCalcNs from 'suncalc';
import { eyeDirection } from '../camera/model.ts';

// suncalc is CommonJS: Node exposes it as `default`, bundlers as named exports.
const SunCalc: typeof SunCalcNs =
  (SunCalcNs as unknown as { default?: typeof SunCalcNs }).default ?? SunCalcNs;

export interface SunPosition {
  /** Degrees clockwise from north. */
  azimuthDeg: number;
  /** Degrees above the horizon. */
  altitudeDeg: number;
  /** Unit vector towards the sun, house coordinates. */
  dir: Vec3;
}

export function sunAt(date: Date, lat: number, lon: number): SunPosition {
  const p = SunCalc.getPosition(date, lat, lon);
  // suncalc azimuth is radians from south, positive towards west.
  const azimuthDeg = ((((p.azimuth * 180) / Math.PI + 180) % 360) + 360) % 360;
  const altitudeDeg = (p.altitude * 180) / Math.PI;
  return { azimuthDeg, altitudeDeg, dir: eyeDirection(azimuthDeg, altitudeDeg) };
}

/** A spring afternoon in the UK: low western light that rakes a terrace front. */
export const DEFAULT_SUN_TIME = '2026-04-21T16:40:00Z';
