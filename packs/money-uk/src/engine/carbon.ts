/**
 * Carbon factors (SPEC R6, BP 7.2). Owner: WP-02.
 *
 * Factors are integer micro-grams CO2e per Wh (core `CarbonPack`): 1 g/kWh is 1 mg/Wh, which is
 * 1,000 ug/Wh, so 0.163 kg/kWh is 163,000. The tables below are in g/kWh as published and scaled
 * once, exactly, by `UG_PER_WH_PER_G_PER_KWH`.
 * Vectors are indexed by (fuel, month) everywhere (R6).
 *
 * - `carbon-sap10-2`: SAP 10.2 Table 12d monthly electricity and Table 12 fuel factors. Graded
 *   `secondary` (transcribed in BP 7.2, not yet re-read against the SAP PDF).
 *   PLACEHOLDER until M-B: the your-home DESNZ factor with T&D losses (R6) is a second pack.
 * - `carbon-trajectory-flat-sap10-2`: PLACEHOLDER lifetime trajectory that repeats the SAP 10.2
 *   annual factors every year. Graded `estimate` (R17 badge) until the DESNZ Green Book long-run
 *   marginal factors are read (M-B).
 *
 * Fuels the source does not give (biomass, district) have no factor. Asking for one throws, so a
 * missing factor can never silently count as zero (LV 6.2: a missing factor is unrepresentable).
 */
import type { CarbonPack, CarbonTrajectory, Fuel, Month } from '@ibasho/core';
import { provenance, SAP_10_2_T12 } from './sources.ts';

export class CarbonFactorError extends Error {
  override name = 'CarbonFactorError';
}

/** Micro-grams per Wh in one gram per kWh. */
export const UG_PER_WH_PER_G_PER_KWH = 1000n;

/** SAP 10.2 Table 12d, January first, g/kWh. */
const ELECTRICITY_MONTHLY = [163n, 160n, 153n, 143n, 132n, 120n, 111n, 112n, 122n, 136n, 151n, 163n] as const;
/** SAP 10.2 Table 12, g/kWh. */
const FLAT: Partial<Record<Fuel, bigint>> = { gas: 210n, oil: 298n, lpg: 241n };
/** SAP 10.2 Table 12 annual electricity, g/kWh. */
const ELECTRICITY_ANNUAL = 136n;

function flat(fuel: Fuel, pack: string): bigint {
  const f = FLAT[fuel];
  if (f === undefined) throw new CarbonFactorError(`${pack} has no factor for ${fuel}`);
  return f * UG_PER_WH_PER_G_PER_KWH;
}

export const carbonSap102: CarbonPack = {
  kind: 'carbon',
  id: 'carbon-sap10-2',
  version: '0.1.0',
  title: 'money.carbon.sap10-2',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([SAP_10_2_T12], 'secondary'),
  includesTD: false,
  factor(fuel: Fuel, month: Month): bigint {
    if (fuel === 'electricity') {
      const f = ELECTRICITY_MONTHLY[month];
      if (f === undefined) throw new CarbonFactorError(`bad month ${month}`);
      return f * UG_PER_WH_PER_G_PER_KWH;
    }
    return flat(fuel, 'carbon-sap10-2');
  },
};

export const carbonTrajectoryFlat: CarbonTrajectory = {
  kind: 'carbon-trajectory',
  id: 'carbon-trajectory-flat-sap10-2',
  version: '0.1.0',
  title: 'money.carbon-trajectory.flat-sap10-2',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([SAP_10_2_T12], 'estimate'),
  factor(fuel: Fuel, year: number): bigint {
    if (!Number.isInteger(year)) throw new CarbonFactorError(`bad year ${year}`);
    return fuel === 'electricity'
      ? ELECTRICITY_ANNUAL * UG_PER_WH_PER_G_PER_KWH
      : flat(fuel, 'carbon-trajectory-flat-sap10-2');
  },
};
