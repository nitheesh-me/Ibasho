/**
 * Irradiance on a plane from tabulated monthly orientation values. Owner: WP-01.
 *
 * A pack stores monthly irradiation on vertical planes facing N, E, S and W, the horizontal (GHI)
 * and, when known, the equator-facing plane at the PV tilt (about 0.9 x latitude), as published in
 * BP 4.3. Vertical planes interpolate linearly in azimuth between the four compass points.
 * Tilted planes interpolate linearly in tilt between the horizontal and the vertical plane of the
 * same azimuth, plus a correction that makes the equator-facing PV plane exact:
 *   corr(az, beta) = max(0, cos(az - az_eq)) * (PV - lin_eq(beta_pv)) * tri(beta),
 * where lin_eq is the linear tilt interpolation facing the equator and tri rises from 0 at the
 * horizontal to 1 at beta_pv and falls back to 0 at the vertical. Compass verticals and the
 * horizontal stay exact. The Collares-Pereira-Rabl transposition of BP 4.1 is the upgrade path.
 */
import { cos, PI } from '@ibasho/dmath';

export interface OrientationTable {
  /** Monthly irradiation, kWh/m2 per month, January first. */
  ghi: readonly number[];
  north: readonly number[];
  east: readonly number[];
  south: readonly number[];
  west: readonly number[];
  /** Equator-facing plane at `pvTiltDeg`, kWh/m2 per month (optional). */
  pv?: readonly number[];
  pvTiltDeg?: number;
  /** Azimuth of the equator, degrees from north: 180 in the northern hemisphere. Default 180. */
  equatorAzimuthDeg?: number;
}

/** Normalise an azimuth to [0, 360). */
function wrap(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

/** Monthly irradiation on a vertical plane facing `azimuthDeg` (clockwise from north). */
export function verticalIrradiance(t: OrientationTable, azimuthDeg: number): number[] {
  const az = wrap(azimuthDeg);
  const ring = [t.north, t.east, t.south, t.west, t.north];
  const seg = Math.min(3, Math.floor(az / 90));
  const frac = (az - seg * 90) / 90;
  const a = ring[seg]!;
  const b = ring[seg + 1]!;
  return a.map((v, m) => v + (b[m]! - v) * frac);
}

/** Monthly irradiation on a plane with the given azimuth and tilt (0 horizontal, 90 vertical). */
export function planeIrradiance(t: OrientationTable, azimuthDeg: number, tiltDeg: number): number[] {
  if (!Number.isFinite(azimuthDeg) || !Number.isFinite(tiltDeg) || tiltDeg < 0 || tiltDeg > 180) {
    throw new RangeError(`irradiance: bad plane azimuth ${azimuthDeg}, tilt ${tiltDeg}`);
  }
  const tilt = tiltDeg > 90 ? 90 : tiltDeg; // overhangs facing down see no more than a wall
  const vert = verticalIrradiance(t, azimuthDeg);
  const w = tilt / 90;
  const lin = t.ghi.map((h, m) => h + (vert[m]! - h) * w);
  const pv = t.pv;
  const bp = t.pvTiltDeg;
  if (!pv || bp === undefined || !(bp > 0 && bp < 90) || tilt === 0 || tilt === 90) return lin;
  const eqAz = t.equatorAzimuthDeg ?? 180;
  const facing = cos(((wrap(azimuthDeg) - eqAz) * PI) / 180);
  if (!(facing > 0)) return lin;
  const tri = tilt <= bp ? tilt / bp : (90 - tilt) / (90 - bp);
  const vertEq = verticalIrradiance(t, eqAz);
  const wp = bp / 90;
  return lin.map((v, m) => {
    const linEq = t.ghi[m]! + (vertEq[m]! - t.ghi[m]!) * wp;
    return v + facing * (pv[m]! - linEq) * tri;
  });
}
