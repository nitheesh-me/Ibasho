/**
 * Pinned reference prices for the A indicator and primary energy factors for the H indicator
 * (SPEC R4, SF 2.1 and 2.3). Owner: WP-02.
 *
 * PLACEHOLDER: SPEC R4 says the reference price pack `prices/reference-v1` is owned by the Lean
 * spec. Until `@ibasho/spec-gen` exports it (INTERFACES request to WP-04), the values live here,
 * transcribed from BP 7.1 and 7.2 (SAP 10.2 Table 12, graded `secondary`). Oil and LPG factors are
 * SAP 10.2 Table 12 values recalled by the reviewer (grade `estimate`). A tariff change never moves
 * the score: these prices are fixed per spec version.
 */
import type { Fuel } from '@ibasho/core';

export const REFERENCE_PRICES_ID = 'prices/reference-v1';

/** SAP 10.2 Table 12 unit prices (p/kWh, exact decimals) and standing charges (pounds per year). */
export const REFERENCE_PRICES: Readonly<
  Partial<Record<Fuel, { unitPence: string; standingPounds: string }>>
> = {
  electricity: { unitPence: '16.49', standingPounds: '81' },
  gas: { unitPence: '3.64', standingPounds: '92' },
  oil: { unitPence: '4.94', standingPounds: '0' },
};
/** SAP 10.2 Table 12 export price, p/kWh (BP 7.1). */
export const REFERENCE_EXPORT_PENCE = '5.59';

/** SAP 10.2 Table 12 primary energy factors, exact decimals (kWh primary per kWh delivered). */
export const PRIMARY_ENERGY_FACTORS: Readonly<Partial<Record<Fuel, string>>> = {
  gas: '1.130',
  electricity: '1.501',
  oil: '1.180',
  lpg: '1.141',
};
