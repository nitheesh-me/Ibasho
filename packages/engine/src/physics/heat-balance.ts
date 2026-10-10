/**
 * Space heating stage: SAP 10.2 Tables 9, 9a, 9b and 9c (BP 3.7). Owner: WP-01.
 *
 * Per month m, with H_m = H_tr + H_ve,m, HLP_m = H_m / TFA, G_m = solar + internal + opaque:
 * - Utilisation (Table 9a): tau = TMP / (3.6 HLP), a = 1 + tau / 15, gamma = G / L with
 *   L = H (T_i - T_e); eta = (1 - gamma^a) / (1 - gamma^(a+1)) for gamma > 0 and != 1,
 *   a / (a + 1) at gamma = 1 (gamma within 5e-9 of 1, the 8 decimal rounding), 1 for gamma <= 0;
 *   L = 0 sets gamma = 1e6.
 * - Zone set-points (Table 9): living area T_h1 (21 degC in `rating` and `standard`, the twin's
 *   set-point in `your-home`); elsewhere T_h2 = T_h1 - 0.5 HLP (control type 1) or
 *   T_h1 - HLP + HLP^2 / 12 (types 2 and 3), with HLP capped at 6 for T_h2.
 * - Off-periods (Table 9b): t_c = 4 + 0.25 tau, T_sc = (1 - R)(T_h - 2) + R (T_e + eta G / H) with
 *   eta from the zone's own T_h, responsiveness R = 1 (radiators, SAP Table 4d);
 *   u = 0.5 t^2 (T_h - T_sc) / (24 t_c) for t <= t_c, else (T_h - T_sc)(t - 0.5 t_c) / 24.
 *   `rating` and `standard`: living area off 7 and 8 h; elsewhere 7 and 8 h (control types 1 and
 *   2) or 9 and 8 h (type 3). `your-home`: 24 h minus the stated heating hours, as two equal
 *   off-periods, in both zones.
 * - T_i = f_LA T_1 + (1 - f_LA) T_2 (Table 9c step 7), then eta is recomputed at T_i (step 9).
 * - Q_H,m = 0.024 (L_m - eta_m G_m) n_m, floored at 0. `rating` counts October to May only and
 *   sets results under 1 kWh to 0 (Table 9c step 10); the other modes let the climate decide.
 */
import { type ControlType, choiceValue, type DemandMonthly, type PhysicsStage } from '@ibasho/core';
import { pow } from '@ibasho/dmath';
import { central, days, monthly, monthlyDrafts } from './common.ts';

const SAP_SETPOINT_C = 21;
const RESPONSIVENESS = 1;
/** SAP heating season for `rating`: October to May. */
const RATING_MONTHS: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 9, 10, 11]);

/** SAP control type (1, 2 or 3) from the twin's controls. */
export function sapControlType(c: ControlType | undefined): 1 | 2 | 3 {
  switch (c) {
    case 'programmer-thermostat':
    case 'programmer-thermostat-trvs':
      return 2;
    case 'zone-control':
    case 'trvs-weather-compensation':
      return 3;
    default:
      return 1;
  }
}

/** SAP Table 9a utilisation factor for gains/loss ratio gamma and parameter a. */
export function utilisation(gamma: number, a: number): number {
  if (!(gamma > 0)) return 1;
  if (gamma > 1 - 5e-9 && gamma < 1 + 5e-9) return a / (a + 1);
  return (1 - pow(gamma, a)) / (1 - pow(gamma, a + 1));
}

/** gamma = G / L with SAP's L = 0 rule. */
export function gainLossRatio(gainsW: number, lossW: number): number {
  if (lossW === 0) return 1e6;
  return gainsW / lossW;
}

/** Mean temperature reduction (K) over a day from heating off-periods (SAP Table 9b). */
export function offPeriodReduction(
  offHours: readonly number[],
  thetaH: number,
  thetaSc: number,
  tc: number,
): number {
  const dT = Math.max(0, thetaH - thetaSc);
  let u = 0;
  for (const t of offHours) {
    if (t <= 0) continue;
    u += t <= tc ? (0.5 * t * t * dT) / (24 * tc) : (dT * (t - 0.5 * tc)) / 24;
  }
  return u;
}

export interface Schedule {
  living: number[];
  rest: number[];
}

/** Off-periods per day by mode and control type (SAP 10.2 Table 9). */
export function heatingSchedule(mode: string, control: 1 | 2 | 3, heatingHours: number): Schedule {
  if (mode === 'your-home') {
    const off = Math.min(24, Math.max(0, 24 - heatingHours));
    return { living: [off / 2, off / 2], rest: [off / 2, off / 2] };
  }
  return { living: [7, 8], rest: control === 3 ? [9, 8] : [7, 8] };
}

/** Rest-of-home heating temperature (SAP Table 9). */
export function restSetpoint(theta1: number, control: 1 | 2 | 3, hlp: number): number {
  const h = Math.min(6, hlp);
  return control === 1 ? theta1 - 0.5 * h : theta1 - h + (h * h) / 12;
}

export const heatBalanceStage: PhysicsStage<'heat-balance'> = {
  kind: 'physics-stage',
  id: 'stage-heat-balance',
  version: '0.2.0',
  title: 'engine.stage.heat-balance',
  side: 'engine',
  stage: 'heat-balance',
  modes: ['rating', 'standard', 'your-home'],
  run({ geometry, fabric, vent, gains }, ctx) {
    const twin = geometry.twin;
    const tfa = geometry.tfaM2;
    const fLA = Math.min(1, Math.max(0, central(twin.zones.livingAreaFrac, 'zones.livingAreaFrac')));
    const theta1 =
      ctx.mode === 'your-home' ? central(twin.occupancy.setpointC, 'occupancy.setpointC') : SAP_SETPOINT_C;
    const control = sapControlType(choiceValue(twin.systems.controls));
    const hours = ctx.mode === 'your-home' ? central(twin.occupancy.heatingHours, 'occupancy.heatingHours') : 9;
    const sched = heatingSchedule(ctx.mode, control, hours);

    const thetaIC: number[] = [];
    const util: number[] = [];
    const qh: number[] = [];
    for (let m = 0; m < 12; m++) {
      const H = fabric.htrWK + vent.hveWK[m]!;
      const hlp = H / tfa;
      const G = gains.solarW[m]! + gains.internalW[m]! + gains.opaqueW[m]!;
      const thetaE = ctx.climate.months[m]!.thetaE;
      const tau = fabric.tmpKJm2K / (3.6 * hlp);
      const a = 1 + tau / 15;
      const tc = 4 + 0.25 * tau;
      const zoneMean = (thetaH: number, off: readonly number[]) => {
        const eta = utilisation(gainLossRatio(G, H * (thetaH - thetaE)), a);
        const thetaSc = (1 - RESPONSIVENESS) * (thetaH - 2) + RESPONSIVENESS * (thetaE + (eta * G) / H);
        return thetaH - offPeriodReduction(off, thetaH, thetaSc, tc);
      };
      const t1 = zoneMean(theta1, sched.living);
      const t2 = zoneMean(restSetpoint(theta1, control, hlp), sched.rest);
      const ti = fLA * t1 + (1 - fLA) * t2;
      const loss = H * (ti - thetaE);
      const eta = utilisation(gainLossRatio(G, loss), a);
      let q = Math.max(0, 0.024 * (loss - eta * G) * days(m));
      if (ctx.mode === 'rating' && (!RATING_MONTHS.has(m) || q < 1)) q = 0;
      thetaIC.push(ti);
      util.push(eta);
      qh.push(q);
    }
    const output: DemandMonthly = {
      qhKWh: monthly((m) => qh[m]!),
      util: monthly((m) => util[m]!),
      thetaIC: monthly((m) => thetaIC[m]!),
    };

    const evidence = [
      ...monthlyDrafts(
        ctx,
        'heat.util',
        output.util,
        '1',
        { id: 'SAP-9a', doc: 'eta = (1 - gamma^a) / (1 - gamma^(a+1)), a = 1 + tau / 15' },
        (m) => [
          { key: `gain.solar.${m}`, role: 'solar' },
          { key: `gain.int.${m}`, role: 'internal' },
          { key: 'fabric.tmp', role: 'tmp' },
        ],
      ),
      ...monthlyDrafts(
        ctx,
        'heat.theta_i',
        output.thetaIC,
        'degC',
        { id: 'SAP-9c', doc: 'SAP two-zone mean internal temperature with off-periods' },
        (m) => [
          { key: 'fabric.htr', role: 'htr' },
          { key: `vent.hve.${m}`, role: 'hve' },
          { key: 'fabric.tmp', role: 'tmp' },
        ],
      ),
      ...monthlyDrafts(
        ctx,
        'heat.qh',
        output.qhKWh,
        'kWh',
        { id: 'BP-3.7', doc: 'Q_H = 0.024 (H (theta_i - theta_e) - eta G) n' },
        (m) => [
          { key: 'fabric.htr', role: 'htr' },
          { key: `vent.hve.${m}`, role: 'hve' },
          { key: `heat.theta_i.${m}`, role: 'theta_i' },
          { key: `gain.solar.${m}`, role: 'solar' },
          { key: `gain.int.${m}`, role: 'internal' },
          { key: `gain.opaque.${m}`, role: 'opaque' },
          { key: `heat.util.${m}`, role: 'eta' },
        ],
      ),
    ];
    return { output, evidence };
  },
};
