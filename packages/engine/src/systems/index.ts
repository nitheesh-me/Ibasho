/**
 * HVAC, fan, hot water and PV system models for the real energy stage (WP-18). Efficiencies are
 * typical Indian and UK values (ECBC 2017 Table 5 minimums, BEE star labels, CIBSE Guide F, SAP
 * 10.2); each is named where it is used so the evidence can cite it.
 */
import { exp } from '@ibasho/dmath';

export type PlantKind = 'split' | 'vrf' | 'chilled-water';

export interface Plant {
  kind: PlantKind;
  /** Seasonal compressor COP at 35 degC outdoor (air cooled) or rated (water cooled). */
  cop: number;
  /** Fan energy as a share of thermal cooling for DX units (indoor fans); AHU fans are separate. */
  fanShare: number;
  /** Pump energy (chilled and condenser water) as a share of thermal cooling. */
  pumpShare: number;
  /** Air cooled: COP improves as outdoor air cools. */
  airCooled: boolean;
}

/** Plant from the building's system references (ECBC 2017 Table 5-1, 5-4; BEE 5 star split EER). */
export function plantFor(systemIds: readonly string[]): Plant {
  const ids = systemIds.join(' ');
  if (/chiller|chilled/.test(ids))
    return { kind: 'chilled-water', cop: 5.2, fanShare: 0.012, pumpShare: 0.035, airCooled: false };
  if (/vrf/.test(ids)) return { kind: 'vrf', cop: 3.9, fanShare: 0.05, pumpShare: 0, airCooled: true };
  return { kind: 'split', cop: 3.3, fanShare: 0.04, pumpShare: 0, airCooled: true };
}

/** Compressor COP at an outdoor temperature (air-cooled units gain about 2.5% per K below 35). */
export function copAt(p: Plant, tOut: number, setpointC = 24): number {
  const t = p.airCooled ? Math.max(0.7, Math.min(1.35, 1 + 0.025 * (35 - tOut))) : 1;
  return p.cop * t * (1 + 0.03 * (setpointC - 24));
}

/** Precision cooling for data centres (CRAC units, 24 h fans). */
export const PRECISION = { cop: 2.8, fanShare: 0.12 };

/** Air handling: specific fan power W per L/s (CIBSE Guide F, VAV systems) and part-load mean. */
export const AHU = { sfpWPerLs: 1.2, partLoad: 0.5, supplyDeltaK: 11 };

/** Gas boiler seasonal efficiency (SAP 10.2 condensing combi) and electric storage heater. */
export const HEATERS = { gasBoiler: 0.89, electricGeyser: 0.9, electricResistive: 1 };

/** Ceiling fans (BEE 5 star 1200 mm sweep): one per 15 m², 50 W, on when air is above 27 degC. */
export const CEILING_FAN = { m2PerFan: 15, watts: 50, onAboveC: 27, airSpeedMs: 0.8 };

/**
 * IMAC mixed-mode neutral temperature (Manu et al. 2016): Tn = 0.28 Trm + 17.87, 80% band of
 * about 3.5 K either side; fans at 0.8 m/s lift the upper limit by about 2 K.
 */
export function imacBand(runningMeanC: number): { neutral: number; upper: number; upperWithFan: number } {
  const neutral = 0.28 * runningMeanC + 17.87;
  return { neutral, upper: neutral + 3.5, upperWithFan: neutral + 5.5 };
}

/** Humidity ratio, g/kg, from dry bulb and RH (Magnus saturation pressure, sea level). */
export function humidityRatio(tC: number, rhPct: number): number {
  const pvs = 0.6108 * exp((17.27 * tC) / (tC + 237.3));
  const pv = (rhPct / 100) * pvs;
  return (622 * pv) / (101.325 - pv);
}

/** Domestic hot water energy, Wh, for `litres` heated from mains to the delivery temperature. */
export function dhwWh(litres: number, mainsC: number, deliveryC: number, efficiency: number): number {
  return (litres * 4.186 * Math.max(0, deliveryC - mainsC)) / 3.6 / efficiency;
}

/** PV output, Wh in the hour, from plane-of-array irradiance (PR 0.8, -0.4%/K above 25 degC cell). */
export function pvWh(kwp: number, poa: number, tAir: number): number {
  if (poa <= 0 || kwp <= 0) return 0;
  const tCell = tAir + 0.03 * poa;
  return kwp * poa * 0.8 * (1 - 0.004 * Math.max(0, tCell - 25));
}
