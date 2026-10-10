/**
 * London climate pack (M-0). Owner: WP-01.
 *
 * Sources and grades, per field:
 * - `thetaE`, `ghi` and the vertical N, E, S, W irradiation: BP 4.3 London table (NASA POWER
 *   2001 to 2020 climatology, transposed with Collares-Pereira-Rabl and an isotropic sky).
 *   West equals east in that table (one E/W column).
 * - `windMs`: SAP 10.2 Table U2, region 1 (Thames). Transcribed from the reviewer's reading, to be
 *   re-checked against the SAP 10.2 PDF (secondary).
 * - `thetaMax`, `thetaMin`, `dhi`, `rh`: ESTIMATE placeholders until NASA POWER T2M_MAX, T2M_MIN,
 *   ALLSKY_SFC_SW_DIFF and RH2M are read at M-A. No M-0 stage reads them.
 * - `design.thetaEdC`: CIBSE 99.6% London design temperature via the MCS heat load calculator
 *   reference (BP 3.10).
 * The pack is graded `estimate` overall until the placeholders are replaced (R17 badge).
 */
import type { ClimateMonth, ClimatePack } from '@ibasho/core';
import { type OrientationTable, planeIrradiance } from './tabulated.ts';

const THETA_E = [4.1, 4.3, 6.1, 9.0, 12.3, 15.5, 17.6, 17.3, 14.7, 11.3, 7.3, 4.8];
const TABLE: OrientationTable = {
  ghi: [26, 42, 82, 121, 151, 159, 158, 130, 97, 57, 30, 21],
  south: [55, 61, 82, 89, 90, 87, 89, 86, 86, 73, 56, 49],
  east: [20, 29, 52, 74, 91, 95, 95, 78, 61, 38, 22, 16],
  west: [20, 29, 52, 74, 91, 95, 95, 78, 61, 38, 22, 16],
  north: [10, 16, 31, 45, 62, 69, 66, 51, 35, 21, 11, 8],
};
const WIND_MS = [4.2, 4.0, 4.0, 3.7, 3.7, 3.3, 3.4, 3.2, 3.3, 3.5, 3.8, 3.8];
// ESTIMATE placeholders (see header).
const THETA_MAX = [8.6, 9.3, 12.1, 15.3, 18.7, 21.8, 24.1, 23.6, 20.6, 16.4, 11.9, 9.1];
const THETA_MIN = [2.3, 2.3, 3.9, 5.7, 8.6, 11.7, 13.8, 13.6, 11.3, 8.4, 5.0, 2.7];
const DHI_FRACTION = 0.55;
const RH = [86, 82, 77, 72, 70, 70, 70, 72, 76, 81, 85, 87];

const months: ClimateMonth[] = THETA_E.map((thetaE, m) => ({
  thetaE,
  thetaMax: THETA_MAX[m]!,
  thetaMin: THETA_MIN[m]!,
  ghi: TABLE.ghi[m]!,
  dhi: TABLE.ghi[m]! * DHI_FRACTION,
  rh: RH[m]!,
  windMs: WIND_MS[m]!,
}));

export const LONDON_CLIMATE_ID = 'climate-london';

export const londonClimate: ClimatePack = {
  kind: 'climate',
  id: LONDON_CLIMATE_ID,
  version: '0.1.0',
  title: 'climate.london.title',
  regions: ['GB'],
  side: 'engine',
  provenance: {
    sources: [
      {
        id: 'bp-4-3',
        title: 'Building Physics Brief 4.3, London monthly table (NASA POWER 2001-2020)',
        url: 'https://power.larc.nasa.gov/docs/services/api/temporal/climatology/',
        retrieved: '2026-10-10',
      },
      {
        id: 'sap-10-2-u2',
        title: 'SAP 10.2 Table U2, wind speed, region 1 Thames',
        url: 'https://files.bregroup.com/SAP/SAP%2010.2%20-%2011-04-2023.pdf',
        clause: 'Table U2',
        retrieved: '2026-10-11',
      },
      {
        id: 'mcs-design-conditions',
        title: 'MCS heat load calculator, design conditions (CIBSE 99.6%)',
        url: 'https://heatloadcalculator.mcscertified.com/docs/reference-sources/design-conditions',
        retrieved: '2026-10-10',
      },
    ],
    lastChecked: '2026-10-11',
    grade: 'estimate',
  },
  location: { lat: 51.51, lon: -0.13, name: 'climate.london.name' },
  zone: 'uk-temperate',
  months,
  design: { thetaEdC: -3.0, grade: 'secondary' },
  irradiance: (azimuthDeg, tiltDeg) => planeIrradiance(TABLE, azimuthDeg, tiltDeg),
};
