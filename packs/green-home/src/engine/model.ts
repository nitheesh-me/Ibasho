/**
 * Energy model for the Green Home engine: the Ibasho home physics run on a property twin, with
 * retrofits applied as measure packages (recomputed whole, so interactions are modelled, never
 * summed). Owner: WP-25.
 *
 * Accounting (brief section 3): purchased energy = grid electricity imported + gas, kWh a year.
 * The physics reports delivered energy per fuel (grid import, after PV self use) and export
 * separately; export never reduces purchased energy.
 */
import type { GhProperty, GhRetrofitId, HomeTwin, PackageSpec, SimResult } from '@ibasho/core';
import { type PipelineConfig, simulate } from '@ibasho/engine';
import { climateById, sapUkAverageClimate } from '@ibasho/pack-climate/engine';
import { UK_MEASURES, UK_SYSTEMS } from '@ibasho/pack-home-uk/engine';
import { bandOfSap, epcProxyRating } from '@ibasho/pack-money-uk/engine';
import type { Band } from '@ibasho/core';
import { cavityFillMeasure } from './measures.ts';
import { buildTwin, type HiddenTruth } from './twin.ts';

const MEASURES = [...UK_MEASURES, cavityFillMeasure];

/**
 * The rating proxy prices every electricity use, appliances included, while published SAP leaves
 * appliances out, so it reads lower than a certificate for the same home. Modelled ratings shown as
 * certificates add this documented offset (fitted so the synthetic stock matches the English
 * Housing Survey band mix; README "Calibration"). Rating changes use the proxy's own differences.
 */
export const PROXY_SAP_OFFSET = 8;
const cfgCache = new Map<string, PipelineConfig>();

export function pipelineFor(climatePackId: string): PipelineConfig {
  let c = cfgCache.get(climatePackId);
  if (!c) {
    c = { climate: climateById(climatePackId), ratingClimate: sapUkAverageClimate, measures: MEASURES, systems: UK_SYSTEMS };
    cfgCache.set(climatePackId, c);
  }
  return c;
}

/** Group and option each retrofit uses in the engine package, for this property. */
export function optionFor(r: GhRetrofitId, p: GhProperty): [group: string, option: string] {
  const sensitive = p.constraints.conservationArea || p.constraints.listed;
  switch (r) {
    case 'loft':
      return ['loft', 'loft-270'];
    case 'cavity-wall':
      return ['cavity', 'cavity-fill'];
    case 'solid-wall':
      return ['wall', sensitive ? 'wall-iwi-woodfibre' : 'wall-ewi-100'];
    case 'floor':
      return ['floor', 'floor-suspended-insulation'];
    case 'glazing':
      return ['glazing', sensitive ? 'glazing-secondary-lowe' : 'glazing-double-a'];
    case 'smart-thermostat':
      return ['controls', 'controls-trv-weather-comp'];
    case 'heat-pump':
      return ['heat', 'heat-ashp'];
    case 'solar':
      return ['pv', p.floorAreaM2 < 70 ? 'pv-2kwp' : 'pv-3kwp'];
  }
}

export function packageOf(retrofits: readonly GhRetrofitId[], p: GhProperty): PackageSpec | undefined {
  if (retrofits.length === 0) return undefined;
  const options: Record<string, string> = {};
  for (const r of retrofits) {
    const [g, o] = optionFor(r, p);
    options[g] = o;
  }
  return { id: Object.values(options).sort().join('+'), options };
}

export interface FuelRun {
  /** Grid electricity imported, kWh a year. */
  electricityKwh: number;
  gasKwh: number;
  exportKwh: number;
  /** Space heating demand, kWh a year (before the heating system). */
  heatDemandKwh: number;
}

const kwh = (xs: readonly bigint[]) => Number(xs.reduce((s, x) => s + x, 0n)) / 1000;

function fuelsOf(r: SimResult): FuelRun {
  return {
    electricityKwh: kwh(r.deliveredWh.electricity),
    gasKwh: kwh(r.deliveredWh.gas),
    exportKwh: kwh(r.exportWh),
    heatDemandKwh: r.qhKWh.reduce((s, x) => s + x, 0),
  };
}

const ASOF = '2026-10-11' as const;
const runCache = new Map<string, { fuels: FuelRun; sap: number; band: Band }>();

/** Physics run of a property with a retrofit list: purchased energy per fuel and the rating proxy. */
export function runProperty(
  p: GhProperty,
  retrofits: readonly GhRetrofitId[],
  opts: { hidden?: HiddenTruth; mode?: 'your-home' | 'standard'; twin?: HomeTwin } = {},
): { fuels: FuelRun; sap: number; band: Band } {
  const key = opts.hidden || opts.twin ? undefined : `${p.propertyId}|${JSON.stringify(p)}|${[...retrofits].sort().join(',')}|${opts.mode ?? 'your-home'}`;
  const hit = key ? runCache.get(key) : undefined;
  if (hit) return hit;
  const twin = opts.twin ?? buildTwin(p, opts.hidden);
  const cfg = pipelineFor(twin.climatePackId);
  const pkg = packageOf(retrofits, p);
  const run = simulate({ twin, mode: opts.mode ?? 'your-home', asOf: ASOF, ...(pkg ? { pkg } : {}) }, cfg).result;
  const rating = simulate({ twin, mode: 'rating', asOf: ASOF, ...(pkg ? { pkg } : {}) }, cfg).result;
  const est = epcProxyRating.sapFor(rating, p.floorAreaM2);
  const sap = Math.min(100, est.sap + PROXY_SAP_OFFSET);
  const out = { fuels: fuelsOf(run), sap, band: bandOfSap(sap) };
  if (key) {
    if (runCache.size > 5000) runCache.clear();
    runCache.set(key, out);
  }
  return out;
}

/** Monthly purchased energy (kWh, January first) for the label simulator and the usage generator. */
export function runMonthly(
  p: GhProperty,
  retrofits: readonly GhRetrofitId[],
  hidden?: HiddenTruth,
): { electricity: number[]; gas: number[]; exportKwh: number; sap: number; band: Band } {
  const twin = buildTwin(p, hidden);
  const cfg = pipelineFor(twin.climatePackId);
  const pkg = packageOf(retrofits, p);
  const run = simulate({ twin, mode: 'your-home', asOf: ASOF, ...(pkg ? { pkg } : {}) }, cfg).result;
  const rating = simulate({ twin, mode: 'rating', asOf: ASOF, ...(pkg ? { pkg } : {}) }, cfg).result;
  const est = epcProxyRating.sapFor(rating, p.floorAreaM2);
  const sap = Math.min(100, est.sap + PROXY_SAP_OFFSET);
  return {
    electricity: run.deliveredWh.electricity.map((x) => Number(x) / 1000),
    gas: run.deliveredWh.gas.map((x) => Number(x) / 1000),
    exportKwh: kwh(run.exportWh),
    sap,
    band: bandOfSap(sap),
  };
}
