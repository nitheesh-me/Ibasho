/**
 * Space cooling stage (BP 3.8) with eta_c = 1 (M-0). Owner: WP-01.
 *
 * Runs only when the twin has cooling systems; otherwise the cooled fraction is 0 and Q_C = 0.
 * L_c = H (theta_c - theta_e), theta_c = 24 degC (UK) or 26 degC (India), and
 * Q_C,m = max(0, 0.024 (G - eta_c L_c) n_m f_cool f_int) with eta_c = 1, which is finite and
 * non-negative even when L_c <= 0 (DEC SC-6). f_cool = 1 (whole home) and
 * f_int = AC hours per night / 24 (SAP default 0.25) at M-0.
 * M-0 status: latent load Q_lat, opaque gains and the cooled-floor fraction arrive at M-A.
 */
import { type CoolingMonthly, numCentral, type PhysicsStage } from '@ibasho/core';
import { days, monthly, monthlyDrafts, ZERO12 } from './common.ts';

export const coolingStage: PhysicsStage<'cooling'> = {
  kind: 'physics-stage',
  id: 'stage-cooling-m0',
  version: '0.1.0',
  title: 'engine.stage.cooling',
  side: 'engine',
  stage: 'cooling',
  modes: ['rating', 'standard', 'your-home'],
  run({ geometry, fabric, vent, gains }, ctx) {
    const twin = geometry.twin;
    const cooled = (twin.systems.cooling?.length ?? 0) > 0;
    let qcKWh = ZERO12;
    if (cooled) {
      const thetaC = twin.region.startsWith('IN') ? 26 : 24;
      const acHours = twin.occupancy.acHoursPerNight;
      const fInt = acHours !== undefined ? Math.min(24, Math.max(0, numCentral(acHours))) / 24 : 0.25;
      qcKWh = monthly((m) => {
        const H = fabric.htrWK + vent.hveWK[m]!;
        const G = gains.solarW[m]! + gains.internalW[m]! + gains.opaqueW[m]!;
        const lc = H * (thetaC - ctx.climate.months[m]!.thetaE);
        return Math.max(0, 0.024 * (G - lc) * days(m) * fInt);
      });
    }
    const output: CoolingMonthly = { qcKWh, qlatKWh: ZERO12 };
    const evidence = monthlyDrafts(ctx, 'cool.qc', qcKWh, 'kWh', {
      id: 'BP-3.8',
      doc: 'Q_C = 0.024 (G - eta_c L_c) n f_cool f_int, eta_c = 1',
    });
    return { output, evidence };
  },
};
