/**
 * Hourly 5R1C thermal model per zone (SPEC R5, ISO 13790:2008 simple hourly method, Annex C;
 * the ISO 52016-1 family). Owner: WP-01.
 *
 * Two zones (SAP living area and rest of home), each a 5R1C network fed by the same monthly
 * physics the pipeline computes, so the hourly and monthly models agree by construction:
 * - Conductances scale with the zone's floor share f (f_LA or 1 - f_LA): H_ve = f H_ve,m,
 *   H_tr,w = f sum A U_eff over windows and doors, H_tr,op = f (H_tr - windows and doors).
 *   A_f = f TFA, A_t = 4.5 A_f, H_tr,is = 3.45 A_t, A_m = 3.0 A_f (TMP >= 250) else 2.5 A_f,
 *   H_tr,ms = 9.1 A_m, H_tr,em = 1 / (1/H_tr,op - 1/H_tr,ms), C_m = TMP A_f (kJ, so x 1000 J).
 * - Gains: the month's mean internal gain, constant through the day; the month's solar plus opaque
 *   gain spread over its hours in proportion to hourly GHI, so each month's energy matches the
 *   monthly model. Split 0.5 internal to air, the rest by ISO 13790 C.2 and C.3.
 * - Supply air at the outdoor temperature (no heat recovery term; MVHR enters through H_ve).
 * - Heating: ideal, unlimited, to the zone set-point during heating hours (SAP Table 9 schedule:
 *   living 07-09 and 16-23; rest 07-09 and 18-23 for control type 3; `your-home` heats the stated
 *   hours as a morning block from 07 and an evening block ending at 23). No cooling.
 * - Hours (TM59 style): hot = occupied hours above 26 degC (living 07 to 23, rest 22 to 07 as
 *   bedrooms); cold = occupied living-area hours below 18 degC.
 * Crank-Nicolson step of ISO 13790 C.3, one hour, mass temperature carried over; the year runs
 * twice and the second pass is reported (warm start).
 */
import {
  choiceValue,
  type EvidenceDraft,
  type HomeTwin,
  type HourlyClimate,
  numCentral,
  type StageCtx,
  type ThermalModel,
  type TwinPatch,
} from '@ibasho/core';
import { floatDraft } from '../physics/common.ts';
import { restSetpoint, sapControlType } from '../physics/heat-balance.ts';
import { MONTH_START_HOUR } from '../physics/hourly-synth.ts';
import { applyPatch } from '../pipeline/patch.ts';
import { type PipelineConfig, runHeavy } from '../pipeline/runner.ts';

export interface ZoneParams {
  areaM2: number;
  hve: number[];
  htrW: number;
  htrEm: number;
  htrMs: number;
  htrIs: number;
  am: number;
  at: number;
  cmJ: number;
  setpoint: number[];
  heated: (hourOfDay: number) => boolean;
}

export interface FiveR1CResult {
  /** Air temperature per zone (living, rest), 8,760 h. */
  zoneTempsC: Float64Array[];
  hotHours: number;
  coldHours: number;
  /** Heating energy per zone, kWh. */
  heatingKWh: number[];
}

/** One zone over the year: air temperatures and heating energy. */
export function simulateZone(
  p: ZoneParams,
  thetaE: Float64Array,
  phiInt: Float64Array,
  phiSol: Float64Array,
): { air: Float64Array; heatingKWh: number } {
  const air = new Float64Array(8760);
  let thetaM = 18;
  let heat = 0;
  const cm = p.cmJ / 3600;
  for (let pass = 0; pass < 2; pass++) {
    heat = 0;
    let month = 0;
    for (let h = 0; h < 8760; h++) {
      if (month < 11 && h >= MONTH_START_HOUR[month + 1]!) month++;
      const te = thetaE[h]!;
      const hve = p.hve[month]!;
      const h1 = 1 / (1 / hve + 1 / p.htrIs);
      const h2 = h1 + p.htrW;
      const h3 = 1 / (1 / h2 + 1 / p.htrMs);
      const pi = phiInt[h]! * p.areaM2;
      const ps = phiSol[h]! * p.areaM2;
      const phiIa = 0.5 * pi;
      const base = 0.5 * pi + ps;
      const phiSt = (1 - p.am / p.at - p.htrW / (9.1 * p.at)) * base;
      const phiMBase = (p.am / p.at) * base;
      const solve = (phiHC: number) => {
        const phiMTot = phiMBase + p.htrEm * te + (h3 * (phiSt + p.htrW * te + h1 * ((phiIa + phiHC) / hve + te))) / h2;
        const mNew = (thetaM * (cm - 0.5 * (h3 + p.htrEm)) + phiMTot) / (cm + 0.5 * (h3 + p.htrEm));
        const mAvg = 0.5 * (mNew + thetaM);
        const s = (p.htrMs * mAvg + phiSt + p.htrW * te + h1 * (te + (phiIa + phiHC) / hve)) / (p.htrMs + p.htrW + h1);
        const a = (p.htrIs * s + hve * te + phiIa + phiHC) / (p.htrIs + hve);
        return { mNew, a };
      };
      let r = solve(0);
      let phi = 0;
      const set = p.setpoint[month]!;
      if (p.heated(h % 24) && r.a < set) {
        const r10 = solve(10 * p.areaM2);
        phi = (10 * p.areaM2 * (set - r.a)) / (r10.a - r.a);
        r = solve(phi);
      }
      thetaM = r.mNew;
      air[h] = r.a;
      heat += phi / 1000;
    }
  }
  return { air, heatingKWh: heat };
}

function inBlocks(blocks: [number, number][]): (h: number) => boolean {
  return (h) => blocks.some(([a, b]) => h >= a && h < b);
}

/** Heating blocks [start, end) per zone by mode and control type. */
export function heatingBlocks(mode: string, control: 1 | 2 | 3, hours: number): { living: [number, number][]; rest: [number, number][] } {
  if (mode === 'your-home') {
    const half = Math.max(0, Math.min(24, hours)) / 2;
    const b: [number, number][] = [
      [7, 7 + half],
      [23 - half, 23],
    ];
    return { living: b, rest: b };
  }
  return {
    living: [
      [7, 9],
      [16, 23],
    ],
    rest:
      control === 3
        ? [
            [7, 9],
            [18, 23],
          ]
        : [
            [7, 9],
            [16, 23],
          ],
  };
}

const GLAZED = new Set(['window', 'rooflight', 'door']);

/** Run the two-zone model for a twin (with a package patch) on hourly climate. */
export function runFiveR1C(
  twin: HomeTwin,
  patch: TwinPatch,
  climate: HourlyClimate,
  ctx: StageCtx,
  cfg: PipelineConfig,
): FiveR1CResult {
  const t = applyPatch(twin, patch);
  const heavy = runHeavy(t, { mode: ctx.mode, asOf: ctx.asOf, ...(ctx.pkg ? { pkg: ctx.pkg } : {}) }, cfg);
  const { geometry: geo, fabric, vent, gains } = heavy;
  const fLA = Math.min(1, Math.max(0, numCentral(t.zones.livingAreaFrac)));
  let hW = 0;
  for (const e of geo.elements) if (GLAZED.has(e.kind)) hW += fabric.byElementWK[e.id] ?? 0;
  const hOp = Math.max(1e-6, fabric.htrWK - hW);
  const tmp = fabric.tmpKJm2K;
  const control = sapControlType(choiceValue(t.systems.controls));
  const theta1 = ctx.mode === 'your-home' ? numCentral(t.occupancy.setpointC) : 21;
  const blocks = heatingBlocks(ctx.mode, control, ctx.mode === 'your-home' ? numCentral(t.occupancy.heatingHours) : 9);

  // Hourly gains per m2 of floor (W/m2), from the monthly means.
  const phiInt = new Float64Array(8760);
  const phiSol = new Float64Array(8760);
  for (let m = 0; m < 12; m++) {
    const start = MONTH_START_HOUR[m]!;
    const end = m === 11 ? 8760 : MONTH_START_HOUR[m + 1]!;
    let ghiSum = 0;
    for (let h = start; h < end; h++) ghiSum += climate.ghi[h]!;
    const solarWh = (gains.solarW[m]! + gains.opaqueW[m]!) * (end - start);
    for (let h = start; h < end; h++) {
      phiInt[h] = gains.internalW[m]! / geo.tfaM2;
      phiSol[h] = ghiSum > 0 ? (solarWh * (climate.ghi[h]! / ghiSum)) / geo.tfaM2 : 0;
    }
  }

  const zone = (f: number, setpoint: number[], heated: (h: number) => boolean): ZoneParams => {
    const af = f * geo.tfaM2;
    const at = 4.5 * af;
    const am = (tmp >= 250 ? 3.0 : 2.5) * af;
    const htrMs = 9.1 * am;
    const htrOp = f * hOp;
    return {
      areaM2: af,
      hve: vent.hveWK.map((v) => Math.max(1e-6, f * v)),
      htrW: f * hW,
      htrEm: 1 / (1 / htrOp - 1 / htrMs),
      htrMs,
      htrIs: 3.45 * at,
      am,
      at,
      cmJ: tmp * 1000 * af,
      setpoint,
      heated,
    };
  };
  const set1 = new Array<number>(12).fill(theta1);
  const set2 = vent.hveWK.map((v) => restSetpoint(theta1, control, (fabric.htrWK + v) / geo.tfaM2));
  const living = simulateZone(zone(fLA, set1, inBlocks(blocks.living)), climate.thetaE, phiInt, phiSol);
  const rest = simulateZone(zone(1 - fLA, set2, inBlocks(blocks.rest)), climate.thetaE, phiInt, phiSol);
  let hot = 0;
  let cold = 0;
  for (let h = 0; h < 8760; h++) {
    const hod = h % 24;
    const day = hod >= 7 && hod < 23;
    if (day && living.air[h]! > 26) hot++;
    if ((hod >= 22 || hod < 7) && rest.air[h]! > 26) hot++;
    if (day && living.air[h]! < 18) cold++;
  }
  return {
    zoneTempsC: [living.air, rest.air],
    hotHours: hot,
    coldHours: cold,
    heatingKWh: [living.heatingKWh, rest.heatingKWh],
  };
}

/** Mean of one zone's air temperature over a month (0-based). */
export function zoneMonthMean(temps: Float64Array, month: number): number {
  const start = MONTH_START_HOUR[month]!;
  const end = month === 11 ? 8760 : MONTH_START_HOUR[month + 1]!;
  let s = 0;
  for (let h = start; h < end; h++) s += temps[h]!;
  return s / (end - start);
}

/** The `thermal-model` plugin (5R1C, two zones), bound to a pipeline config. */
export function createFiveR1CModel(cfg: PipelineConfig): ThermalModel {
  return {
    kind: 'thermal-model',
    id: 'thermal-5r1c-two-zone',
    version: '0.1.0',
    title: 'engine.thermal.5r1c',
    side: 'engine',
    zones: ['living', 'rest'],
    run(twin, pkgPatch, climate, ctx) {
      const r = runFiveR1C(twin, pkgPatch, climate, ctx, cfg);
      const doc = { id: 'SPEC-R5', doc: 'ISO 13790 5R1C, two zones, hourly' };
      const evidence: EvidenceDraft[] = [
        floatDraft(ctx, 'comfort.hot_hours', r.hotHours, 'h', doc),
        floatDraft(ctx, 'comfort.cold_hours', r.coldHours, 'h', doc),
        ...r.zoneTempsC.flatMap((z, i) =>
          Array.from({ length: 12 }, (_, m) =>
            floatDraft(ctx, `thermal.zone.${i === 0 ? 'living' : 'rest'}.mean.${m}`, zoneMonthMean(z, m), 'degC', doc, {
              month: m,
            }),
          ),
        ),
      ];
      return { zoneTempsC: r.zoneTempsC, hotHours: r.hotHours, coldHours: r.coldHours, evidence };
    },
  };
}
