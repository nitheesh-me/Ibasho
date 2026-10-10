/**
 * Irradiance on a plane from tabulated monthly orientation values. Owner: WP-01.
 *
 * M-0 method: the pack stores monthly irradiation on vertical planes facing N, E, S and W plus the
 * horizontal (GHI), as published in BP 4.3. Vertical planes interpolate linearly in azimuth
 * between the four compass points; tilted planes interpolate linearly in tilt between horizontal
 * (0 deg) and vertical (90 deg). Linear tilt interpolation underestimates well-oriented tilted
 * planes (London south at 46 deg: about 990 against the tabulated 1,220 kWh/m2 per year), so the
 * Collares-Pereira-Rabl transposition of BP 4.1 replaces it at M-A. Vertical planes, which carry
 * all window gains at M-0, are exact at the compass points.
 */

export interface OrientationTable {
  /** Monthly irradiation, kWh/m2 per month, January first. */
  ghi: readonly number[];
  north: readonly number[];
  east: readonly number[];
  south: readonly number[];
  west: readonly number[];
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
  return t.ghi.map((h, m) => h + (vert[m]! - h) * w);
}
