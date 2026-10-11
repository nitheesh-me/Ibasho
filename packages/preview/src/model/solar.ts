/**
 * Monthly irradiation on a tilted, oriented surface (isotropic sky, beam from the monthly DNI
 * spread over sun-up hours on the 15th). Preview only: the real site stage uses the SPA port,
 * Perez sky and the visibility kernel (WP-16).
 */
import type { MonthlyClimate } from './climate.gen.ts';

const D2R = Math.PI / 180;
const MID = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

export interface SurfaceSun {
  /** Monthly irradiation, Wh/m² (unshaded). */
  irr: number[];
  /** Monthly beam share reaching the surface, Wh/m². */
  beam: number[];
  /** Mean hours per day with the sun in front of the surface, per month. */
  sunHours: number[];
}

/** azimuthDeg clockwise from true north; tiltDeg 0 is a roof facing up, 90 a wall. */
export function surfaceSun(c: MonthlyClimate, azimuthDeg: number, tiltDeg: number): SurfaceSun {
  const lat = c.lat * D2R;
  const az = azimuthDeg * D2R;
  const tilt = tiltDeg * D2R;
  const n = [Math.sin(tilt) * Math.sin(az), Math.sin(tilt) * Math.cos(az), Math.cos(tilt)];
  const irr: number[] = [];
  const beam: number[] = [];
  const sunHours: number[] = [];
  for (let m = 0; m < 12; m++) {
    const decl = 23.45 * D2R * Math.sin((2 * Math.PI * (284 + (MID[m] as number))) / 365);
    let up = 0;
    let cosSum = 0;
    let front = 0;
    for (let h = 0; h < 24; h += 0.25) {
      const ha = (h + 0.125 - 12) * 15 * D2R;
      const sinAlt = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
      if (sinAlt <= 0.02) continue;
      up++;
      const cosAlt = Math.sqrt(1 - sinAlt * sinAlt);
      // Sun vector: east, north, up.
      const cosAz = (Math.sin(decl) - sinAlt * Math.sin(lat)) / (cosAlt * Math.cos(lat));
      const azSun =
        ha > 0
          ? 2 * Math.PI - Math.acos(Math.max(-1, Math.min(1, cosAz)))
          : Math.acos(Math.max(-1, Math.min(1, cosAz)));
      const s = [cosAlt * Math.sin(azSun), cosAlt * Math.cos(azSun), sinAlt];
      const ci =
        (n[0] as number) * (s[0] as number) +
        (n[1] as number) * (s[1] as number) +
        (n[2] as number) * (s[2] as number);
      if (ci > 0) {
        cosSum += ci;
        front++;
      }
    }
    const dni = (c.dniKwhM2[m] as number) * 1000;
    const dhi = (c.dhiKwhM2[m] as number) * 1000;
    const ghi = (c.ghiKwhM2[m] as number) * 1000;
    const b = up > 0 ? (dni * cosSum) / up : 0;
    const diffuse = (dhi * (1 + Math.cos(tilt))) / 2;
    const ground = (ghi * 0.2 * (1 - Math.cos(tilt))) / 2;
    beam.push(b);
    irr.push(b + diffuse + ground);
    // Hours per day in front of the surface, scaled by how clear the month is (DNI over its clear-sky value).
    const clear = Math.min(1, dni / Math.max(1, ghi * 1.1));
    sunHours.push((front / 4) * clear);
  }
  return { irr, beam, sunHours };
}
