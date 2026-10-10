/**
 * Air source heat pump chain (BP 3.10, DEC SC-2): design loss, size, emitters, flow temperature,
 * EN 14825 temperature bins and the Ruhnau et al. 2019 COP fit. Owner: WP-01.
 *
 * 1. Design heat loss Phi_d = H_d (21 - theta_e,d), H_d = H_tr + max_m H_ve,m.
 * 2. Size: smallest of 5, 6, 8, 10, 12, 14, 16 kW at least Phi_d (plus 0.5 kW for hot water when
 *    Phi_d < 6 kW).
 * 3. Emitters at dT 50: the twin's radiators if listed, else k_os Phi_d,base, where Phi_d,base is
 *    the design loss of the home before the package (DEC SC-2 prior k_os 1.0 to 1.8, central 1.3).
 * 4. Design mean water temperature theta_mw = 20 + 50 (Phi_d / Phi_rad,50)^(1/1.3); design flow
 *    theta_f,d = theta_mw + 2.5.
 * 5. Weather compensation: theta_f(T) = 20 + (theta_f,d - 20) ((20 - T) / (20 - theta_e,d))^(1/1.3)
 *    for T < 20, else 20.
 * 6. COP(dT) = 6.08 - 0.09 dT + 0.0005 dT^2 with dT = theta_f - T (Ruhnau, Hirth and Praktiknjo
 *    2019, ASHP fit; dT held within its 15 to 60 K validity range). Hot water: dT = 55 - theta_e,m.
 * 7. EN 14825 bins: hourly temperatures (8,760 h, synthesised from the climate pack) in 1 K bins;
 *    part load Ph(T) = Phi_d (16 - T) / (16 - theta_e,d) below 16 degC, else 0. Monthly
 *    SPF_m = f_field sum Ph / sum (Ph / COP), f_field 0.90 (defrost, cycling, auxiliaries; range
 *    0.80 to 1.0). A month with no bin load uses COP at its mean temperature.
 * 8. theta_f,d > 55 degC flags an emitter upgrade (`radiators-plus`) for rules.
 */
import type { ClimateMonth } from '@ibasho/core';
import { pow } from '@ibasho/dmath';
import { MONTH_START_HOUR, synthesiseHourlyTemps } from './hourly-synth.ts';

export const HP_SIZES_KW: readonly number[] = [5, 6, 8, 10, 12, 14, 16];
export const DESIGN_INDOOR_C = 21;
export const BALANCE_C = 16;
export const DEFAULT_FIELD_FACTOR = 0.9;

export function ruhnauCop(dT: number): number {
  const d = Math.min(60, Math.max(15, dT));
  return 6.08 - 0.09 * d + 0.0005 * d * d;
}

export function hpSizeKw(designLossW: number): number {
  const kw = designLossW / 1000 + (designLossW < 6000 ? 0.5 : 0);
  for (const s of HP_SIZES_KW) if (s >= kw) return s;
  return HP_SIZES_KW[HP_SIZES_KW.length - 1]!;
}

export function designFlowC(designLossW: number, emitterW50: number): number {
  if (!(emitterW50 > 0)) throw new RangeError(`emitter output must be positive, got ${emitterW50}`);
  return 20 + 50 * pow(designLossW / emitterW50, 1 / 1.3) + 2.5;
}

export function flowAt(tC: number, flowDesignC: number, thetaEd: number): number {
  if (tC >= 20) return 20;
  return 20 + (flowDesignC - 20) * pow((20 - tC) / (20 - thetaEd), 1 / 1.3);
}

export interface Bin {
  tC: number;
  hours: number;
  /** Hours per month (January first). */
  hoursByMonth: number[];
  loadW: number;
  cop: number;
}

export interface HpChain {
  designLossW: number;
  sizeKw: number;
  emitterW50: number;
  flowDesignC: number;
  needsEmitterUpgrade: boolean;
  bins: Bin[];
  /** Seasonal SCOP over the bins, field factor included. */
  scop: number;
  spfSpace: number[];
  spfDhw: number[];
}

const tempsCache = new WeakMap<readonly ClimateMonth[], Float64Array>();
function tempsFor(months: readonly ClimateMonth[]): Float64Array {
  let t = tempsCache.get(months);
  if (!t) {
    t = synthesiseHourlyTemps(months);
    tempsCache.set(months, t);
  }
  return t;
}

export function heatPumpChain(o: {
  designLossW: number;
  emitterW50: number;
  thetaEd: number;
  months: readonly ClimateMonth[];
  fieldFactor?: number;
  hourly?: Float64Array;
}): HpChain {
  const f = o.fieldFactor ?? DEFAULT_FIELD_FACTOR;
  const flowDesignC = designFlowC(o.designLossW, o.emitterW50);
  const temps = o.hourly ?? tempsFor(o.months);
  const byBin = new Map<number, number[]>();
  for (let m = 0; m < 12; m++) {
    const end = m === 11 ? 8760 : MONTH_START_HOUR[m + 1]!;
    for (let h = MONTH_START_HOUR[m]!; h < end; h++) {
      const b = Math.round(temps[h]!);
      let row = byBin.get(b);
      if (!row) {
        row = new Array<number>(12).fill(0);
        byBin.set(b, row);
      }
      row[m] = row[m]! + 1;
    }
  }
  const bins: Bin[] = [...byBin.keys()]
    .sort((a, b) => a - b)
    .map((tC) => {
      const hoursByMonth = byBin.get(tC)!;
      const hours = hoursByMonth.reduce((a, b) => a + b, 0);
      const loadW = tC < BALANCE_C ? (o.designLossW * (BALANCE_C - tC)) / (BALANCE_C - o.thetaEd) : 0;
      const cop = ruhnauCop(flowAt(tC, flowDesignC, o.thetaEd) - tC);
      return { tC, hours, hoursByMonth, loadW, cop };
    });
  let heat = 0;
  let elec = 0;
  const mHeat = new Array<number>(12).fill(0);
  const mElec = new Array<number>(12).fill(0);
  for (const b of bins) {
    if (!(b.loadW > 0)) continue;
    heat += b.hours * b.loadW;
    elec += (b.hours * b.loadW) / b.cop;
    for (let m = 0; m < 12; m++) {
      mHeat[m] = mHeat[m]! + b.hoursByMonth[m]! * b.loadW;
      mElec[m] = mElec[m]! + (b.hoursByMonth[m]! * b.loadW) / b.cop;
    }
  }
  const spfSpace = o.months.map((cm, m) =>
    mElec[m]! > 0
      ? (f * mHeat[m]!) / mElec[m]!
      : f * ruhnauCop(flowAt(cm.thetaE, flowDesignC, o.thetaEd) - cm.thetaE),
  );
  const spfDhw = o.months.map((cm) => f * ruhnauCop(55 - cm.thetaE));
  return {
    designLossW: o.designLossW,
    sizeKw: hpSizeKw(o.designLossW),
    emitterW50: o.emitterW50,
    flowDesignC,
    needsEmitterUpgrade: flowDesignC > 55,
    bins,
    scop: elec > 0 ? (f * heat) / elec : f * ruhnauCop(35),
    spfSpace,
    spfDhw,
  };
}
