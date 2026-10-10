/**
 * SAP 10.2 Appendix U climate for `rating` mode (SPEC R3, DEC SC-5). Owner: WP-01.
 *
 * Primary source: SAP 10.2 (11-04-2023), Appendix U, Tables U1 (mean external temperature), U2
 * (wind speed), U3 (horizontal solar irradiance in W/m2 and solar declination), U4 (latitude) and
 * U5 (constants k1 to k9), read from the BRE PDF on 2026-10-11.
 *
 * Irradiance on a plane (equations U1 to U3):
 *   S(orient, p, m) = S_h,m * (A cos^2(phi - delta) + B cos(phi - delta) + C)
 *   A = k1 s^3 + k2 s^2 + k3 s,  B = k4 s^3 + k5 s^2 + k6 s,  C = k7 s^3 + k8 s^2 + k9 s + 1,
 *   s = sin(p / 2). k1..k9 interpolate linearly between the Table U5 columns N, NE, E, SE, S
 *   (west side mirrors east). Monthly kWh/m2 = S * 0.024 * n_m (U4).
 * Diffuse fraction and humidity are not in Appendix U; they take the London POWER values
 * (estimate, no `rating` stage reads them).
 */
import type { ClimateMonth, ClimatePack } from '@ibasho/core';
import { cos, PI, sin } from '@ibasho/dmath';

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Table U3 solar declination, degrees (all regions). */
export const SAP_DECLINATION = [-20.7, -12.8, -1.8, 9.8, 18.8, 23.1, 21.2, 13.7, 2.9, -8.7, -18.4, -23.0];

/** Table U5 columns N, NE/NW, E/W, SE/SW, S: rows k1..k9. */
const U5: readonly (readonly number[])[] = [
  [26.3, -38.5, 14.8, -16.5, 27.3, -11.9, -1.06, 0.0872, -0.191],
  [0.165, -3.68, 3.0, 6.38, -4.53, -0.405, -4.38, 4.89, -1.99],
  [1.44, -2.36, 1.07, -0.514, 1.89, -1.64, -0.542, -0.757, 0.604],
  [-2.95, 2.89, 1.17, 5.67, -3.54, -4.28, -2.72, -0.25, 3.07],
  [-0.66, -0.106, 2.93, 3.63, -0.374, -7.4, -2.71, -0.991, 4.59],
];

export interface SapRegion {
  id: number;
  name: string;
  latitudeDeg: number;
  /** Table U1, degC. */
  thetaE: readonly number[];
  /** Table U2, m/s. */
  wind: readonly number[];
  /** Table U3, W/m2. */
  horizontalW: readonly number[];
}

export const SAP_UK_AVERAGE: SapRegion = {
  id: 0,
  name: 'UK average',
  latitudeDeg: 53.5,
  thetaE: [4.3, 4.9, 6.5, 8.9, 11.7, 14.6, 16.6, 16.4, 14.1, 10.6, 7.1, 4.2],
  wind: [5.1, 5.0, 4.9, 4.4, 4.3, 3.8, 3.8, 3.7, 4.0, 4.3, 4.5, 4.7],
  horizontalW: [26, 54, 96, 150, 192, 200, 189, 157, 115, 66, 33, 21],
};

export const SAP_THAMES: SapRegion = {
  id: 1,
  name: 'Thames',
  latitudeDeg: 51.6,
  thetaE: [5.1, 5.6, 7.4, 9.9, 13.0, 16.0, 17.9, 17.8, 15.2, 11.6, 8.0, 5.1],
  wind: [4.2, 4.0, 4.0, 3.7, 3.7, 3.3, 3.4, 3.2, 3.3, 3.5, 3.5, 3.8],
  horizontalW: [30, 56, 98, 157, 195, 217, 203, 173, 127, 73, 39, 24],
};

/** k1..k9 for an azimuth in degrees from north (any value; west mirrors east). */
export function sapK(azimuthDeg: number): number[] {
  if (!Number.isFinite(azimuthDeg)) throw new RangeError(`azimuth must be finite, got ${azimuthDeg}`);
  let az = azimuthDeg % 360;
  if (az < 0) az += 360;
  const fromNorth = az > 180 ? 360 - az : az; // 0 (N) .. 180 (S)
  const pos = fromNorth / 45;
  const i = pos >= 4 ? 3 : Math.floor(pos);
  const w = pos - i;
  return U5[i]!.map((k, j) => k + (U5[i + 1]![j]! - k) * w);
}

/** Mean irradiance on a plane, W/m2, per SAP equations U1 to U3. */
export function sapPlaneW(r: SapRegion, azimuthDeg: number, tiltDeg: number): number[] {
  if (!(tiltDeg >= 0 && tiltDeg <= 180)) throw new RangeError(`tilt must be in [0, 180], got ${tiltDeg}`);
  const p = tiltDeg >= 70 && tiltDeg <= 90 ? 90 : tiltDeg > 90 ? 90 : tiltDeg;
  const k = sapK(azimuthDeg);
  const s = sin((p * PI) / 360);
  const s2 = s * s;
  const s3 = s2 * s;
  const A = k[0]! * s3 + k[1]! * s2 + k[2]! * s;
  const B = k[3]! * s3 + k[4]! * s2 + k[5]! * s;
  const C = k[6]! * s3 + k[7]! * s2 + k[8]! * s + 1;
  return r.horizontalW.map((sh, m) => {
    const c = cos(((r.latitudeDeg - SAP_DECLINATION[m]!) * PI) / 180);
    return sh * (A * c * c + B * c + C);
  });
}

/** Monthly irradiation on a plane, kWh/m2 per month (U4). */
export function sapPlaneKWh(r: SapRegion, azimuthDeg: number, tiltDeg: number): number[] {
  return sapPlaneW(r, azimuthDeg, tiltDeg).map((w, m) => w * 0.024 * DAYS[m]!);
}

/** London POWER diffuse fraction and humidity, used as estimates for the SAP regions. */
const DIFFUSE_FRACTION = [0.544, 0.544, 0.551, 0.53, 0.538, 0.553, 0.536, 0.555, 0.528, 0.544, 0.54, 0.549];
const RH = [93, 90, 86, 81, 79, 78, 76, 78, 81, 87, 92, 94];

function sapMonths(r: SapRegion): ClimateMonth[] {
  return r.thetaE.map((thetaE, m) => {
    const ghi = r.horizontalW[m]! * 0.024 * DAYS[m]!;
    return {
      thetaE,
      thetaMax: thetaE + 3.5,
      thetaMin: thetaE - 3.5,
      ghi,
      dhi: ghi * DIFFUSE_FRACTION[m]!,
      rh: RH[m]!,
      windMs: r.wind[m]!,
    };
  });
}

export const SAP_RATING_CLIMATE_ID = 'climate-sap-uk-average';

const SAP_10_2_U = {
  id: 'sap-10-2-appendix-u',
  title: 'SAP 10.2 Appendix U, Tables U1 to U5 (region 0, UK average)',
  url: 'https://files.bregroup.com/SAP/SAP%2010.2%20-%2011-04-2023.pdf',
  clause: 'Appendix U',
  retrieved: '2026-10-11',
} as const;

/**
 * The `rating` climate: SAP 10.2 region 0 (UK average). Ratings use UK average weather (SAP 10.2
 * Appendix U preamble); daily range, diffuse and humidity are estimates no `rating` stage reads.
 */
export const sapUkAverageClimate: ClimatePack = {
  kind: 'climate',
  id: SAP_RATING_CLIMATE_ID,
  version: '0.2.0',
  title: 'climate.sap-uk-average.title',
  regions: ['GB'],
  side: 'engine',
  provenance: { sources: [SAP_10_2_U], lastChecked: '2026-10-11', grade: 'primary' },
  location: { lat: 53.5, lon: -1.5, name: 'climate.sap-uk-average.name' },
  zone: 'uk-temperate',
  months: sapMonths(SAP_UK_AVERAGE),
  design: { thetaEdC: -3.0, grade: 'estimate' },
  irradiance: (azimuthDeg, tiltDeg) => sapPlaneKWh(SAP_UK_AVERAGE, azimuthDeg, tiltDeg),
};
