/**
 * Renewables stage: PV yield and self-use (BP 3.11, SAP 10.2 Appendix M1). Owner: WP-01.
 *
 * Yield per array and month:
 * - `rating` (SAP M1): E_PV,m = 0.8 kWp S_m Z_PV, S_m the plane irradiation of the rating climate.
 * - other modes (BP 3.11): E_PV,m = kWp H_poa,m PR_m Z_PV with PR_m = 0.86 [1 - 0.004 (theta_cell
 *   - 25)], theta_cell = theta_e,m + 25 G_m and G_m = H_poa,m / (6 n_m) the mean daytime plane
 *   irradiance in kW/m2 (crude NOCT term). Checked against PVGIS in the validation suite.
 * Z_PV (SAP Table M1) from the array's SAP Table 6d overshading class (ESTIMATE mapping, one class
 * step): very little 1.0, average 0.8, more than average 0.5, heavy 0.35.
 * Self-use (SAP M1 step 3, re-read 2026-10-11, DEC SC-F2): R_m = E_PV,m / D_m with D_m the
 * electricity demand before PV (lights, appliances, cooking, fans, electric space and water
 * heating); C1 = 1.610 - 0.0973 C_bat, C2 = 0.415 - 0.00776 C_bat, C3 = 0.511 + 0.0866 C_bat with
 * C_bat the usable battery capacity in kWh, at most 15; beta_m = min(exp(-C1 (R_m C2)^C3), D_m / E_PV,m).
 * The operator inside the bracket is a product (the brief's sum was a transcription error: it
 * gave beta = 0.36 as R tends to 0, where the product gives 1).
 * Solar thermal: PLACEHOLDER (0); the twin has no collector field yet (INTERFACES request).
 */
import {
  numCentral,
  type OvershadingClass,
  type PhysicsStage,
  type RenewOut,
} from '@ibasho/core';
import { exp, pow } from '@ibasho/dmath';
import { days, monthly, monthlyDrafts, ZERO12 } from './common.ts';

const Z_PV: Record<OvershadingClass, number> = {
  'very-little': 1.0,
  average: 0.8,
  'more-than-average': 0.5,
  heavy: 0.35,
};

/** SAP 10.2 M1 self-use fraction for one month. */
export function pvBeta(eKWh: number, dKWh: number, batteryKWh: number): number {
  if (!(eKWh > 0)) return 0;
  if (!(dKWh > 0)) return 0;
  const c = Math.min(15, Math.max(0, batteryKWh));
  const c1 = 1.61 - 0.0973 * c;
  const c2 = 0.415 - 0.00776 * c;
  const c3 = 0.511 + 0.0866 * c;
  const r = eKWh / dKWh;
  return Math.min(exp(-c1 * pow(r * c2, c3)), dKWh / eKWh);
}

/** BP 3.11 temperature-corrected performance ratio. */
export function pvPerformanceRatio(hPoaKWh: number, thetaE: number, nDays: number): number {
  const g = hPoaKWh / (6 * nDays);
  const cell = thetaE + 25 * g;
  return 0.86 * (1 - 0.004 * (cell - 25));
}

export const renewablesStage: PhysicsStage<'renewables'> = {
  kind: 'physics-stage',
  id: 'stage-renewables',
  version: '0.2.0',
  title: 'engine.stage.renewables',
  side: 'engine',
  stage: 'renewables',
  modes: ['rating', 'standard', 'your-home'],
  run(input, ctx) {
    const arrays = ctx.twin.systems.pv ?? [];
    if (arrays.length === 0) {
      const output: RenewOut = {
        pvYieldKWh: ZERO12,
        selfUseKWh: ZERO12,
        exportKWh: ZERO12,
        solarThermalKWh: ZERO12,
      };
      return { output, evidence: [] };
    }
    const yieldM = new Array<number>(12).fill(0);
    for (const a of arrays) {
      const kwp = numCentral(a.kWp);
      const z = Z_PV[a.overshading];
      const s = ctx.climate.irradiance(a.azimuthDeg, a.tiltDeg);
      for (let m = 0; m < 12; m++) {
        const pr =
          ctx.mode === 'rating' ? 0.8 : pvPerformanceRatio(s[m]!, ctx.climate.months[m]!.thetaE, days(m));
        yieldM[m] = yieldM[m]! + kwp * s[m]! * pr * z;
      }
    }
    const bat = ctx.twin.systems.battery ? numCentral(ctx.twin.systems.battery) : 0;
    const beta = monthly((m) => pvBeta(yieldM[m]!, input.electricityKWh[m]!, bat));
    const pvYieldKWh = monthly((m) => yieldM[m]!);
    const selfUseKWh = monthly((m) => yieldM[m]! * beta[m]!);
    const exportKWh = monthly((m) => yieldM[m]! - selfUseKWh[m]!);
    const output: RenewOut = { pvYieldKWh, selfUseKWh, exportKWh, solarThermalKWh: ZERO12 };
    const evidence = [
      ...monthlyDrafts(ctx, 'pv.yield', pvYieldKWh, 'kWh', {
        id: 'BP-3.11',
        doc: 'E_PV = kWp H_poa PR Z_PV (rating: 0.8 kWp S Z_PV)',
      }),
      ...monthlyDrafts(ctx, 'pv.beta', beta, '1', {
        id: 'SAP-M1',
        doc: 'beta = min(exp(-C1 (R C2)^C3), D / E)',
      }),
      ...monthlyDrafts(ctx, 'pv.selfuse', selfUseKWh, 'kWh', { id: 'SAP-M1', doc: 'E_PV beta' }, (m) => [
        { key: `pv.yield.${m}`, role: 'yield' },
        { key: `pv.beta.${m}`, role: 'beta' },
      ]),
      ...monthlyDrafts(ctx, 'pv.export', exportKWh, 'kWh', { id: 'SAP-M1', doc: 'E_PV (1 - beta)' }, (m) => [
        { key: `pv.yield.${m}`, role: 'yield' },
        { key: `pv.beta.${m}`, role: 'beta' },
      ]),
    ];
    return { output, evidence };
  },
};
