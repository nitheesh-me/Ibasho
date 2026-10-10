/**
 * Raw score inputs and the estimated EPC band of one package (SF 2.1, SPEC R3, R4). Owner: WP-02.
 *
 * The score reads the `standard` run (SAP occupancy, the home's climate, fixed reference prices);
 * the EPC band reads the `rating` run through the `epc-proxy` plugin. Neither reads the owner's
 * tariff, so a tariff change never moves them (R4).
 *
 * - F: (H_tr + mean monthly H_ve) / TFA.
 * - C: sum over fuels and months of delivered Wh times the carbon pack's monthly factor, per m2.
 * - E: delivered kWh per m2 (the delivered stage already nets on-site self use).
 * - A: cost at `prices/reference-v1` (unit prices, standing charge for each used fuel and always
 *   for electricity, export credited at the reference export price), pounds per m2.
 * - H: space heating efficiency over its fuel's primary energy factor.
 * - R: on-site generation / delivered demand, plus smart points. PLACEHOLDER: a run does not yet
 *   carry PV yield or self use, so generation is taken as exported energy (a lower bound; zero for
 *   every T1 package until PV lands at M-A). Smart points count a battery and a controllable heat
 *   load (heat pump); smart meter and time-of-use points wait for twin fields.
 * - T: the run's comfort hours when present.
 */
import {
  type Band,
  type CarbonPack,
  FUELS,
  type Fuel,
  type HomeTwin,
  MONTHS,
  numCentral,
  type SemVer,
  type SimResult,
  type SystemPlugin,
} from '@ibasho/core';
import { efficiencyOf } from '../physics/systems.ts';
import type { SimRun } from '../pipeline/index.ts';
import { PRIMARY_ENERGY_FACTORS, REFERENCE_EXPORT_PENCE, REFERENCE_PRICES } from './reference.ts';
import { ScoreError, type ScoreRaw } from './score.ts';

const POUND = 100_000_000;

/** Pence per kWh (exact decimal string) to micro-pence per Wh, exactly (1 p/kWh = 1000). */
function microPencePerWh(pence: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,3}))?$/.exec(pence);
  if (!m) throw new ScoreError(`reference price ${pence} must have at most 3 decimals`);
  return BigInt(m[1]!) * 1000n + BigInt((m[2] ?? '').padEnd(3, '0'));
}

/** Annual cost of a run at the reference price pack, micro-pence (exact). */
export function referenceCost(r: SimResult): bigint {
  let total = 0n;
  for (const f of FUELS) {
    let wh = 0n;
    for (const x of r.deliveredWh[f]) wh += x;
    if (wh === 0n && f !== 'electricity') continue;
    const p = REFERENCE_PRICES[f];
    if (!p) throw new ScoreError(`no reference price for ${f}`);
    total += wh * microPencePerWh(p.unitPence) + BigInt(p.standingPounds) * BigInt(POUND);
  }
  let exported = 0n;
  for (const x of r.exportWh) exported += x;
  return total - exported * microPencePerWh(REFERENCE_EXPORT_PENCE);
}

/** Annual operational carbon of a run, micro-grams (exact). */
export function runCarbonUg(r: SimResult, pack: CarbonPack): bigint {
  let ug = 0n;
  for (const f of FUELS) {
    if (!r.deliveredWh[f].some((x) => x !== 0n)) continue;
    for (const m of MONTHS) ug += r.deliveredWh[f][m]! * pack.factor(f, m);
  }
  return ug;
}

function pef(f: Fuel): number {
  const s = PRIMARY_ENERGY_FACTORS[f];
  if (s === undefined) throw new ScoreError(`no primary energy factor for ${f}`);
  return Number(s);
}

export interface ScoreRunInput {
  /** The standard-mode run of the package (twin with the package applied is `run.heavy.twin`). */
  run: SimRun;
  /** Twin after the whole package (heavy and light). */
  twin: HomeTwin;
  carbon: CarbonPack;
  systems: readonly SystemPlugin[];
}

export function scoreRaw(i: ScoreRunInput): ScoreRaw {
  const { run, twin } = i;
  if (run.result.mode !== 'standard')
    throw new ScoreError(`the score reads the standard run, got ${run.result.mode}`);
  const tfa = run.heavy.geometry.tfaM2;
  if (!(tfa > 0)) throw new ScoreError('floor area must be positive');
  const hve = run.heavy.vent.hveWK;
  let hveSum = 0;
  for (const x of hve) hveSum += x;
  const htc = run.heavy.fabric.htrWK + hveSum / hve.length;
  let deliveredWh = 0n;
  for (const f of FUELS) for (const x of run.result.deliveredWh[f]) deliveredWh += x;
  let exportedWh = 0n;
  for (const x of run.result.exportWh) exportedWh += x;
  const sysMap = new Map(i.systems.map((s) => [s.id, s]));
  const space = twin.systems.space;
  const eff = efficiencyOf(space, sysMap, 'space');
  const category = sysMap.get(space.systemId)?.category;
  const battery = twin.systems.battery !== undefined && numCentral(twin.systems.battery) > 0 ? 1 : 0;
  const controllableHeat = category === 'heat-pump' ? 1 : 0;
  const raw: ScoreRaw = {
    hlpWm2K: htc / tfa,
    carbonKgM2: Number(runCarbonUg(run.result, i.carbon)) / 1e9 / tfa,
    energyKWhM2: Number(deliveredWh) / 1000 / tfa,
    costGbpM2: Number(referenceCost(run.result)) / POUND / tfa,
    etaPe: eff / pef(space.fuel),
    fRen: deliveredWh > 0n ? Number(exportedWh) / Number(deliveredWh) : 0,
    kSmart: battery + controllableHeat,
  };
  if (run.result.comfort) raw.comfort = { ...run.result.comfort };
  return raw;
}

/** What `epc-proxy` plugins offer beyond the core contract (see money-uk `EpcProxyWithArea`). */
export interface EpcProxyLike {
  id: string;
  version: SemVer;
  sap(r: SimResult): { sap: number; band: Band; nearThreshold: boolean };
  sapFor?(r: SimResult, tfaM2: number): { sap: number; band: Band; nearThreshold: boolean };
}

export const BANDS: readonly Band[] = ['G', 'F', 'E', 'D', 'C', 'B', 'A'];

export interface EpcEstimate {
  proxyId: string;
  proxyVersion: SemVer;
  sap: number;
  band: Band;
  /** One band either side until AC-R1 passes (SPEC 8). */
  lo: Band;
  hi: Band;
  nearThreshold: boolean;
}

/** `epc.sap_est`, `epc.band_est` from a rating run and its floor area. */
export function epcEstimate(proxy: EpcProxyLike, rating: SimResult, tfaM2: number): EpcEstimate {
  const e = proxy.sapFor ? proxy.sapFor(rating, tfaM2) : proxy.sap(rating);
  const k = BANDS.indexOf(e.band);
  return {
    proxyId: proxy.id,
    proxyVersion: proxy.version,
    sap: e.sap,
    band: e.band,
    lo: BANDS[Math.max(0, k - 1)]!,
    hi: BANDS[Math.min(BANDS.length - 1, k + 1)]!,
    nearThreshold: e.nearThreshold,
  };
}

/** Band rank, G = 0 .. A = 6 (Lean `Band.rank`). */
export function bandRank(b: Band): number {
  return BANDS.indexOf(b);
}
