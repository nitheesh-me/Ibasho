/**
 * Space heating stage: steady monthly heat balance (BP 3.7) with utilisation eta = 1 (M-0).
 * Owner: WP-01.
 *
 * Per month m, with H_m = H_tr + H_ve,m, HLP_m = H_m / TFA, G_m = solar + internal (+ opaque):
 * - Zone set-points (SAP 10.2 Table 9): living area theta_1 (21 degC in `rating` and `standard`,
 *   the twin's set-point in `your-home`); elsewhere theta_2 = theta_1 - 0.5 HLP (control type 1)
 *   or theta_1 - HLP + HLP^2 / 12 (types 2 and 3), with HLP capped at 6.
 * - Heating off-periods (SAP Table 9 intermittency): time constant tau = TMP / (3.6 HLP) h,
 *   t_c = 4 + 0.25 tau, unheated temperature theta_sc = theta_e + eta G / H (responsive emitters,
 *   R = 1). Each off-period of t hours lowers the daily mean by
 *   u = 0.5 t^2 (theta_h - theta_sc) / (24 t_c) when t <= t_c, else (theta_h - theta_sc)(t - 0.5 t_c) / 24.
 *   `rating` and `standard`: weekday off-periods 7 h and 8 h, weekend 8 h, both zones.
 *   `your-home`: 24 h minus the stated heating hours, as two equal off-periods every day.
 *   M-0 status: SAP's longer rest-of-home off-periods for control type 3 arrive at M-A.
 * - theta_i = f_LA theta_1,mean + (1 - f_LA) theta_2,mean.
 * - Q_H,m = max(0, 0.024 (H_m (theta_i - theta_e) - eta G_m) n_m) with eta = 1.
 *   `rating` counts October to May only (SAP); the other modes let the climate decide.
 * The utilisation factor of BP 3.7 (eta < 1, needs dmath.pow on gamma) replaces eta = 1 at M-A.
 */
import { type ControlType, choiceValue, type DemandMonthly, type PhysicsStage } from '@ibasho/core';
import { central, days, monthly, monthlyDrafts } from './common.ts';

const ETA = 1;
const SAP_SETPOINT_C = 21;
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

/** Mean temperature reduction (K) over a day from heating off-periods (SAP Table 9). */
export function offPeriodReduction(offHours: readonly number[], thetaH: number, thetaSc: number, tc: number): number {
  const dT = Math.max(0, thetaH - thetaSc);
  let u = 0;
  for (const t of offHours) {
    if (t <= 0) continue;
    u += t <= tc ? (0.5 * t * t * dT) / (24 * tc) : (dT * (t - 0.5 * tc)) / 24;
  }
  return u;
}

interface Schedule {
  weekday: number[];
  weekend: number[];
}

const SAP_SCHEDULE: Schedule = { weekday: [7, 8], weekend: [8] };

function yourHomeSchedule(heatingHours: number): Schedule {
  const off = Math.min(24, Math.max(0, 24 - heatingHours));
  return { weekday: [off / 2, off / 2], weekend: [off / 2, off / 2] };
}

export const heatBalanceStage: PhysicsStage<'heat-balance'> = {
  kind: 'physics-stage',
  id: 'stage-heat-balance-m0',
  version: '0.1.0',
  title: 'engine.stage.heat-balance',
  side: 'engine',
  stage: 'heat-balance',
  modes: ['rating', 'standard', 'your-home'],
  run({ geometry, fabric, vent, gains }, ctx) {
    const twin = geometry.twin;
    const tfa = geometry.tfaM2;
    const fLA = Math.min(1, Math.max(0, central(twin.zones.livingAreaFrac, 'zones.livingAreaFrac')));
    const theta1 = ctx.mode === 'your-home' ? central(twin.occupancy.setpointC, 'occupancy.setpointC') : SAP_SETPOINT_C;
    const control = sapControlType(choiceValue(twin.systems.controls));
    const sched =
      ctx.mode === 'your-home'
        ? yourHomeSchedule(central(twin.occupancy.heatingHours, 'occupancy.heatingHours'))
        : SAP_SCHEDULE;

    const thetaIC = monthly((m) => {
      const H = fabric.htrWK + vent.hveWK[m]!;
      const hlp = Math.min(6, H / tfa);
      const theta2 = control === 1 ? theta1 - 0.5 * hlp : theta1 - hlp + (hlp * hlp) / 12;
      const G = gains.solarW[m]! + gains.internalW[m]! + gains.opaqueW[m]!;
      const thetaE = ctx.climate.months[m]!.thetaE;
      const tau = fabric.tmpKJm2K / (3.6 * (H / tfa));
      const tc = 4 + 0.25 * tau;
      const thetaSc = thetaE + (ETA * G) / H;
      const zoneMean = (thetaH: number) =>
        thetaH -
        (5 / 7) * offPeriodReduction(sched.weekday, thetaH, thetaSc, tc) -
        (2 / 7) * offPeriodReduction(sched.weekend, thetaH, thetaSc, tc);
      return fLA * zoneMean(theta1) + (1 - fLA) * zoneMean(theta2);
    });

    const qhKWh = monthly((m) => {
      if (ctx.mode === 'rating' && !RATING_MONTHS.has(m)) return 0;
      const H = fabric.htrWK + vent.hveWK[m]!;
      const G = gains.solarW[m]! + gains.internalW[m]! + gains.opaqueW[m]!;
      const loss = H * (thetaIC[m]! - ctx.climate.months[m]!.thetaE);
      return Math.max(0, 0.024 * (loss - ETA * G) * days(m));
    });
    const util = monthly(() => ETA);
    const output: DemandMonthly = { qhKWh, util, thetaIC };

    const evidence = [
      ...monthlyDrafts(ctx, 'heat.util', util, '1', { id: 'BP-3.7', doc: 'utilisation factor (eta = 1 at M-0)' }),
      ...monthlyDrafts(ctx, 'heat.theta_i', thetaIC, 'degC', { id: 'BP-3.7', doc: 'SAP two-zone mean internal temperature' }, (m) => [
        { key: 'fabric.htr', role: 'htr' },
        { key: `vent.hve.${m}`, role: 'hve' },
        { key: 'fabric.tmp', role: 'tmp' },
      ]),
      ...monthlyDrafts(ctx, 'heat.qh', qhKWh, 'kWh', { id: 'BP-3.7', doc: 'Q_H = 0.024 (H (theta_i - theta_e) - eta G) n' }, (m) => [
        { key: 'fabric.htr', role: 'htr' },
        { key: `vent.hve.${m}`, role: 'hve' },
        { key: `heat.theta_i.${m}`, role: 'theta_i' },
        { key: `gain.solar.${m}`, role: 'solar' },
        { key: `gain.int.${m}`, role: 'internal' },
        { key: `heat.util.${m}`, role: 'eta' },
      ]),
    ];
    return { output, evidence };
  },
};
