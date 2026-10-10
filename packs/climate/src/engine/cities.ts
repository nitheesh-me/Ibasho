/**
 * City climate packs: London, Manchester, Edinburgh, Hyderabad, Mumbai, Delhi. Owner: WP-01.
 *
 * Sources and grades, per field:
 * - `thetaE`, `ghi` and the plane tables (N, E or W, S vertical and the equator-facing PV plane):
 *   BP 4.3 tables (NASA POWER 2001 to 2020 climatology transposed with Collares-Pereira-Rabl and an
 *   isotropic sky). West equals east in those tables (one E/W column).
 * - `dhi`, `rh` and the daily range: NASA POWER climatology API 2001 to 2020 (community RE),
 *   parameters ALLSKY_SFC_SW_DIFF (kWh/m2 per day, times the days in the month), RH2M and
 *   T2M_RANGE, retrieved 2026-10-11. Daily max and min (DEC SC-6) are theta_e +- range / 2: the
 *   mean diurnal swing, symmetric about the monthly mean (POWER's T2M_MAX and T2M_MIN are the
 *   extremes of the period, not daily means, so they are not used).
 * - `windMs`: UK cities use SAP 10.2 Table U2 (London region 1 Thames, Manchester region 7 West
 *   Pennines, Edinburgh region 15 East Scotland); India uses the BP 3.3 default of 3.0 m/s.
 * - `design.thetaEdC`: CIBSE 99.6% via the MCS heat load calculator (London -3.0, Edinburgh -5.4),
 *   Manchester -3.5 (BP estimate, MIS 3005-D Table 2 to be read). India: the 1st percentile of the
 *   coldest month from theta_min (estimate; no heat pump sizing runs there in T1).
 */
import type { AnchorZone, ClimateMonth, ClimatePack, Grade, Provenance, RegionCode } from '@ibasho/core';
import { type OrientationTable, planeIrradiance } from './tabulated.ts';

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const POWER_SOURCE = {
  id: 'nasa-power-climatology',
  title: 'NASA POWER climatology API 2001 to 2020 (RE community): T2M_RANGE, RH2M, ALLSKY_SFC_SW_DIFF',
  url: 'https://power.larc.nasa.gov/api/temporal/climatology/point',
  retrieved: '2026-10-11',
} as const;
export const BP_4_3 = {
  id: 'bp-4-3',
  title: 'Building Physics Brief 4.3, monthly city tables (NASA POWER 2001 to 2020, CPR transposition)',
  url: 'https://power.larc.nasa.gov/docs/services/api/temporal/climatology/',
  retrieved: '2026-10-10',
} as const;
export const SAP_U2 = {
  id: 'sap-10-2-u2',
  title: 'SAP 10.2 Appendix U, Table U2 wind speed',
  url: 'https://files.bregroup.com/SAP/SAP%2010.2%20-%2011-04-2023.pdf',
  clause: 'Table U2',
  retrieved: '2026-10-11',
} as const;
const MCS_DESIGN = {
  id: 'mcs-design-conditions',
  title: 'MCS heat load calculator, design conditions (CIBSE 99.6%)',
  url: 'https://heatloadcalculator.mcscertified.com/docs/reference-sources/design-conditions',
  retrieved: '2026-10-10',
} as const;

export interface CitySpec {
  id: string;
  key: string;
  lat: number;
  lon: number;
  zone: AnchorZone;
  regions: RegionCode[];
  thetaE: readonly number[];
  /** NASA POWER T2M_RANGE, K. */
  rangeK: readonly number[];
  /** NASA POWER ALLSKY_SFC_SW_DIFF, kWh/m2 per day. */
  dhiDaily: readonly number[];
  rh: readonly number[];
  wind: readonly number[];
  table: OrientationTable;
  design: { thetaEdC: number; grade: Grade };
  windSource: 'sap-u2' | 'bp-default';
}

export function cityMonths(c: CitySpec): ClimateMonth[] {
  return c.thetaE.map((thetaE, m) => ({
    thetaE,
    thetaMax: thetaE + c.rangeK[m]! / 2,
    thetaMin: thetaE - c.rangeK[m]! / 2,
    ghi: c.table.ghi[m]!,
    dhi: c.dhiDaily[m]! * DAYS[m]!,
    rh: c.rh[m]!,
    windMs: c.wind[m]!,
  }));
}

export function cityPack(c: CitySpec): ClimatePack {
  const sources: Provenance['sources'] = [BP_4_3, POWER_SOURCE];
  if (c.windSource === 'sap-u2') sources.push(SAP_U2);
  if (c.design.grade !== 'estimate') sources.push(MCS_DESIGN);
  return {
    kind: 'climate',
    id: c.id,
    version: '0.2.0',
    title: `climate.${c.key}.title`,
    regions: c.regions,
    side: 'engine',
    provenance: { sources, lastChecked: '2026-10-11', grade: 'secondary' },
    location: { lat: c.lat, lon: c.lon, name: `climate.${c.key}.name` },
    zone: c.zone,
    months: cityMonths(c),
    design: c.design,
    irradiance: (azimuthDeg, tiltDeg) => planeIrradiance(c.table, azimuthDeg, tiltDeg),
  };
}

const IN_WIND = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];

export const LONDON: CitySpec = {
  id: 'climate-london',
  key: 'london',
  lat: 51.51,
  lon: -0.13,
  zone: 'uk-temperate',
  regions: ['GB'],
  thetaE: [4.1, 4.3, 6.1, 9.0, 12.3, 15.5, 17.6, 17.3, 14.7, 11.3, 7.3, 4.8],
  rangeK: [5.33, 6.32, 7.92, 9.53, 9.7, 9.87, 10.02, 9.8, 9.62, 7.63, 6.01, 4.97],
  dhiDaily: [0.4552, 0.8202, 1.4549, 2.1387, 2.6222, 2.9277, 2.7279, 2.3213, 1.7069, 1.0062, 0.5329, 0.3637],
  rh: [93.25, 90.04, 85.87, 81.3, 79.26, 77.84, 75.82, 77.55, 80.77, 87.05, 92.21, 94.39],
  wind: [4.2, 4.0, 4.0, 3.7, 3.7, 3.3, 3.4, 3.2, 3.3, 3.5, 3.5, 3.8],
  table: {
    ghi: [26, 42, 82, 121, 151, 159, 158, 130, 97, 57, 30, 21],
    south: [55, 61, 82, 89, 90, 87, 89, 86, 86, 73, 56, 49],
    east: [20, 29, 52, 74, 91, 95, 95, 78, 61, 38, 22, 16],
    west: [20, 29, 52, 74, 91, 95, 95, 78, 61, 38, 22, 16],
    north: [10, 16, 31, 45, 62, 69, 66, 51, 35, 21, 11, 8],
    pv: [54, 66, 102, 129, 144, 145, 147, 131, 114, 83, 57, 46],
    pvTiltDeg: 46,
  },
  design: { thetaEdC: -3.0, grade: 'secondary' },
  windSource: 'sap-u2',
};

export const MANCHESTER: CitySpec = {
  id: 'climate-manchester',
  key: 'manchester',
  lat: 53.48,
  lon: -2.24,
  zone: 'uk-temperate',
  regions: ['GB'],
  thetaE: [3.6, 3.6, 5.1, 7.7, 10.8, 13.8, 15.4, 15.1, 13.0, 9.9, 6.5, 4.3],
  rangeK: [4.14, 4.97, 6.53, 7.88, 8.19, 7.99, 7.65, 7.35, 7.22, 5.98, 4.61, 4.06],
  dhiDaily: [0.408, 0.7559, 1.3943, 2.0711, 2.4907, 2.7063, 2.5853, 2.224, 1.6357, 0.9255, 0.4886, 0.3199],
  rh: [94.6, 92.82, 89.35, 85.48, 82.59, 82.75, 83.6, 85.26, 87.0, 90.59, 93.77, 95.06],
  wind: [4.8, 4.7, 4.6, 4.2, 4.1, 3.7, 3.7, 3.7, 3.7, 4.2, 4.3, 4.5],
  table: {
    ghi: [20, 37, 78, 118, 152, 151, 149, 124, 87, 50, 24, 15],
    south: [40, 56, 81, 90, 92, 85, 87, 85, 78, 64, 43, 34],
    east: [15, 26, 51, 74, 93, 92, 91, 76, 55, 33, 17, 12],
    west: [15, 26, 51, 74, 93, 92, 91, 76, 55, 33, 17, 12],
    north: [8, 14, 29, 44, 61, 66, 63, 49, 33, 19, 10, 6],
    pv: [39, 60, 100, 127, 146, 139, 139, 126, 102, 73, 44, 33],
    pvTiltDeg: 48,
  },
  design: { thetaEdC: -3.5, grade: 'estimate' },
  windSource: 'sap-u2',
};

export const EDINBURGH: CitySpec = {
  id: 'climate-edinburgh',
  key: 'edinburgh',
  lat: 55.95,
  lon: -3.19,
  zone: 'uk-temperate',
  regions: ['GB'],
  thetaE: [3.4, 3.4, 4.6, 6.9, 9.8, 12.7, 14.4, 14.1, 12.2, 9.2, 6.1, 3.9],
  rangeK: [3.67, 4.36, 5.38, 6.42, 6.88, 6.64, 6.67, 6.53, 6.24, 5.07, 4.13, 3.69],
  dhiDaily: [0.3147, 0.6324, 1.2566, 1.995, 2.4507, 2.7047, 2.5309, 2.0926, 1.4835, 0.7985, 0.3763, 0.2273],
  rh: [93.6, 91.91, 88.93, 85.88, 83.16, 83.56, 83.96, 85.35, 86.94, 90.34, 93.12, 94.11],
  wind: [5.7, 5.8, 5.7, 5.0, 4.8, 4.6, 4.1, 4.1, 4.7, 5.0, 5.2, 5.0],
  table: {
    ghi: [17, 34, 70, 110, 146, 137, 136, 113, 79, 45, 21, 12],
    south: [46, 59, 77, 87, 92, 80, 82, 80, 75, 66, 53, 40],
    east: [14, 25, 46, 70, 91, 84, 84, 70, 51, 32, 18, 11],
    west: [14, 25, 46, 70, 91, 84, 84, 70, 51, 32, 18, 11],
    north: [7, 12, 26, 42, 60, 63, 60, 46, 30, 17, 8, 5],
    pv: [43, 62, 93, 120, 141, 125, 127, 115, 96, 72, 51, 37],
    pvTiltDeg: 50,
  },
  design: { thetaEdC: -5.4, grade: 'secondary' },
  windSource: 'sap-u2',
};

export const HYDERABAD: CitySpec = {
  id: 'climate-hyderabad',
  key: 'hyderabad',
  lat: 17.39,
  lon: 78.49,
  zone: 'in-composite',
  regions: ['IN'],
  thetaE: [21.6, 24.9, 28.7, 31.7, 33.3, 28.8, 26.5, 25.5, 25.2, 24.1, 22.1, 20.8],
  rangeK: [14.99, 16.08, 16.17, 15.01, 13.21, 9.43, 8.24, 7.5, 7.52, 9.3, 11.79, 13.74],
  dhiDaily: [1.7583, 1.924, 2.3442, 2.3564, 2.5057, 2.7367, 2.7178, 2.6115, 2.5556, 2.2002, 1.8212, 1.6462],
  rh: [52.98, 44.05, 37.41, 38.18, 37.85, 62.48, 73.99, 80.3, 82.95, 78.36, 71.63, 62.43],
  wind: IN_WIND,
  table: {
    ghi: [152, 161, 193, 200, 207, 164, 143, 142, 146, 156, 146, 144],
    south: [136, 116, 101, 68, 59, 57, 56, 57, 70, 100, 123, 138],
    east: [85, 89, 105, 107, 110, 87, 76, 76, 79, 86, 82, 82],
    west: [85, 89, 105, 107, 110, 87, 76, 76, 79, 86, 82, 82],
    north: [42, 43, 56, 59, 80, 78, 68, 58, 53, 50, 42, 40],
    pv: [172, 175, 199, 196, 194, 153, 136, 138, 146, 165, 163, 166],
    pvTiltDeg: 16,
  },
  design: { thetaEdC: 10.0, grade: 'estimate' },
  windSource: 'bp-default',
};

export const MUMBAI: CitySpec = {
  id: 'climate-mumbai',
  key: 'mumbai',
  lat: 19.08,
  lon: 72.88,
  zone: 'in-warm-humid',
  regions: ['IN'],
  thetaE: [23.2, 25.7, 28.7, 30.7, 31.2, 28.7, 26.6, 26.1, 26.2, 26.2, 24.6, 23.3],
  rangeK: [15.53, 16.21, 16.28, 15.33, 11.56, 5.64, 3.53, 3.77, 5.17, 9.23, 11.97, 13.98],
  dhiDaily: [1.6847, 1.8004, 2.0411, 2.3522, 2.5769, 2.6093, 2.4138, 2.4553, 2.4387, 2.1369, 1.7371, 1.5895],
  rh: [51.18, 44.45, 44.74, 52.5, 60.19, 79.51, 89.56, 90.36, 88.55, 77.57, 68.9, 59.83],
  wind: IN_WIND,
  table: {
    ghi: [151, 161, 204, 212, 220, 150, 118, 125, 143, 162, 145, 141],
    south: [142, 122, 109, 74, 62, 54, 49, 53, 71, 108, 128, 140],
    east: [86, 90, 112, 114, 117, 80, 63, 67, 78, 89, 82, 80],
    west: [86, 90, 112, 114, 117, 80, 63, 67, 78, 89, 82, 80],
    north: [41, 41, 52, 60, 81, 70, 55, 52, 51, 49, 40, 39],
    pv: [175, 178, 213, 208, 206, 141, 112, 121, 144, 172, 165, 165],
    pvTiltDeg: 17,
  },
  design: { thetaEdC: 14.0, grade: 'estimate' },
  windSource: 'bp-default',
};

export const DELHI: CitySpec = {
  id: 'climate-delhi',
  key: 'delhi',
  lat: 28.61,
  lon: 77.21,
  zone: 'in-composite',
  regions: ['IN'],
  thetaE: [13.6, 17.4, 23.6, 30.4, 35.0, 35.9, 32.3, 29.8, 28.3, 25.2, 20.1, 15.2],
  rangeK: [15.5, 16.5, 17.5, 17.2, 15.57, 12.38, 8.89, 7.88, 10.23, 13.99, 14.96, 15.16],
  dhiDaily: [1.5289, 1.7673, 2.0253, 2.463, 2.8295, 3.0269, 2.9225, 2.6545, 2.2627, 1.8874, 1.6281, 1.4049],
  rh: [44.2, 41.2, 32.92, 24.19, 23.38, 36.42, 62.72, 74.9, 69.39, 51.25, 43.34, 42.18],
  wind: IN_WIND,
  table: {
    ghi: [96, 122, 175, 197, 208, 183, 155, 151, 152, 145, 107, 94],
    south: [100, 109, 118, 91, 77, 68, 65, 70, 88, 118, 110, 107],
    east: [56, 71, 100, 109, 113, 99, 84, 83, 85, 84, 63, 56],
    west: [56, 71, 100, 109, 113, 99, 84, 83, 85, 84, 63, 56],
    north: [33, 37, 49, 59, 74, 75, 66, 58, 49, 44, 35, 31],
    pv: [118, 144, 191, 196, 194, 168, 145, 146, 158, 166, 132, 120],
    pvTiltDeg: 26,
  },
  design: { thetaEdC: 4.0, grade: 'estimate' },
  windSource: 'bp-default',
};

export const CITY_SPECS: readonly CitySpec[] = [LONDON, MANCHESTER, EDINBURGH, HYDERABAD, MUMBAI, DELHI];
