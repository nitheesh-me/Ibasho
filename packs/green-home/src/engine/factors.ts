/**
 * Emissions factors (brief section 6): kg CO2e per kWh, per fuel, with source. Owner: WP-25.
 * UK Government GHG Conversion Factors for Company Reporting 2024 (DESNZ), condensed set:
 * electricity generation (UK grid, kWh) 0.20705; natural gas (gross CV, kWh) 0.18290.
 * Delta C = sum over fuels of delta E_f x EF_f; a positive delta E is a saving.
 */
import type { GhEmissionFactor } from '@ibasho/core';

const URL = 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024';

export const EMISSION_FACTORS: readonly GhEmissionFactor[] = [
  {
    fuel: 'electricity',
    kgCo2ePerKwh: 0.20705,
    source: 'UK Government GHG Conversion Factors for Company Reporting 2024 (DESNZ), UK electricity',
    url: URL,
    year: 2024,
  },
  {
    fuel: 'gas',
    kgCo2ePerKwh: 0.1829,
    source: 'UK Government GHG Conversion Factors for Company Reporting 2024 (DESNZ), natural gas, gross CV',
    url: URL,
    year: 2024,
  },
];

export const EF_ELEC = 0.20705;
export const EF_GAS = 0.1829;

/** Carbon change in kg CO2e a year from per-fuel energy changes (positive delta E = saving). */
export function carbonKg(deltaElecKwh: number, deltaGasKwh: number): number {
  return Math.round((deltaElecKwh * EF_ELEC + deltaGasKwh * EF_GAS) * 10) / 10;
}
