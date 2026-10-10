/**
 * Space cooling stage (BP 3.8, SAP 10.2 Tables 10a and 10b, DEC SC-6). Owner: WP-01.
 *
 * Runs only when the twin has cooling systems; otherwise Q_C = Q_lat = 0.
 * - L_c = H (theta_c - theta_e), theta_c = 24 degC (UK, SAP) or 26 degC (India default, BP 3.8).
 * - gamma_c = G / L_c; eta_c = (1 - gamma^-a) / (1 - gamma^-(a+1)) for gamma > 0 and != 1,
 *   a / (a + 1) at gamma = 1, and eta_c = 1 when L_c <= 0 (DEC SC-6), so Q_C stays finite.
 * - Q_C,m = max(0, 0.024 (G - eta_c L_c) n_m f_cool f_int). f_int = AC hours per night / 24
 *   (SAP default 0.25 = 6 h). f_cool, the cooled floor fraction: 1 in the UK (SAP fixed AC) and 0.4
 *   in India (bedrooms, BP 3.8 example; ESTIMATE until the twin records cooled rooms).
 * - Latent (humid climates, BP 3.8): Q_lat,m = 0.024 n_m f_int [0.817 n_eff V f_cool
 *   max(0, w_e - w_i) + 50 N] kWh, w in g/kg; w_e from the month's theta_e and RH (Magnus
 *   saturation pressure, sea-level pressure), w_i = 11.6 g/kg (26 degC, 55% RH).
 * - `rating` follows SAP: June to August only, f_int 0.25, results under 1 kWh set to 0, and no
 *   latent load (SAP has none).
 */
import { type CoolingMonthly, numCentral, type PhysicsStage } from '@ibasho/core';
import { exp, pow } from '@ibasho/dmath';
import { days, monthly, monthlyDrafts, ZERO12 } from './common.ts';
import { gainLossRatio } from './heat-balance.ts';
import { sapOccupancy } from './household.ts';

const RATING_COOL_MONTHS: ReadonlySet<number> = new Set([5, 6, 7]);
const OMEGA_I = 11.6;

/** SAP Table 10a utilisation factor for cooling. */
export function coolingUtilisation(gamma: number, a: number): number {
  if (!(gamma > 0)) return 1;
  if (gamma > 1 - 5e-9 && gamma < 1 + 5e-9) return a / (a + 1);
  return (1 - pow(gamma, -a)) / (1 - pow(gamma, -(a + 1)));
}

/** Humidity ratio, g/kg dry air, from temperature (degC) and relative humidity (%). */
export function humidityRatio(thetaC: number, rhPct: number): number {
  const pSat = 610.94 * exp((17.625 * thetaC) / (thetaC + 243.04));
  const pv = (Math.min(100, Math.max(0, rhPct)) / 100) * pSat;
  return (622 * pv) / (101325 - pv);
}

export const coolingStage: PhysicsStage<'cooling'> = {
  kind: 'physics-stage',
  id: 'stage-cooling',
  version: '0.2.0',
  title: 'engine.stage.cooling',
  side: 'engine',
  stage: 'cooling',
  modes: ['rating', 'standard', 'your-home'],
  run({ geometry, fabric, vent, gains }, ctx) {
    const twin = geometry.twin;
    const cooled = (twin.systems.cooling?.length ?? 0) > 0;
    let qcKWh = ZERO12;
    let qlatKWh = ZERO12;
    if (cooled) {
      const india = twin.region.startsWith('IN');
      const thetaC = india ? 26 : 24;
      const fCool = india ? 0.4 : 1;
      const acHours = twin.occupancy.acHoursPerNight;
      const rating = ctx.mode === 'rating';
      const fInt =
        !rating && acHours !== undefined ? Math.min(24, Math.max(0, numCentral(acHours))) / 24 : 0.25;
      qcKWh = monthly((m) => {
        if (rating && !RATING_COOL_MONTHS.has(m)) return 0;
        const H = fabric.htrWK + vent.hveWK[m]!;
        const G = gains.solarW[m]! + gains.internalW[m]! + gains.opaqueW[m]!;
        const lc = H * (thetaC - ctx.climate.months[m]!.thetaE);
        const tau = fabric.tmpKJm2K / (3.6 * (H / geometry.tfaM2));
        const eta = lc <= 0 ? 1 : coolingUtilisation(gainLossRatio(G, lc), 1 + tau / 15);
        const q = Math.max(0, 0.024 * (G - eta * lc) * days(m) * fCool * fInt);
        return rating && q < 1 ? 0 : q;
      });
      if (!rating) {
        const people =
          ctx.mode === 'your-home' ? numCentral(twin.occupancy.people) : sapOccupancy(geometry.tfaM2);
        qlatKWh = monthly((m) => {
          if (!(qcKWh[m]! > 0)) return 0;
          const cm = ctx.climate.months[m]!;
          const dw = Math.max(0, humidityRatio(cm.thetaE, cm.rh) - OMEGA_I);
          const w = 0.817 * vent.nEffAch[m]! * geometry.volumeM3 * fCool * dw + 50 * people;
          return 0.024 * days(m) * fInt * w;
        });
      }
    }
    const output: CoolingMonthly = { qcKWh, qlatKWh };
    const evidence = [
      ...monthlyDrafts(ctx, 'cool.qc', qcKWh, 'kWh', {
        id: 'SAP-10b',
        doc: 'Q_C = 0.024 (G - eta_c L_c) n f_cool f_int, eta_c = 1 when L_c <= 0',
      }),
      ...monthlyDrafts(ctx, 'cool.qlat', qlatKWh, 'kWh', {
        id: 'BP-3.8',
        doc: 'Q_lat = 0.024 n f_int (0.817 n_eff V f_cool dw + 50 N)',
      }),
    ];
    return { output, evidence };
  },
};
