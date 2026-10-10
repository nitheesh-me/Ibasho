/**
 * Gains stage (BP 3.4 to 3.6). Owner: WP-01.
 *
 * - Solar through glazing: G_sol,m = sum 0.9 A S_m g FF Z_heat, as a mean power in W
 *   (S_m from the climate pack in kWh/m2 per month, times 1000 / (24 n_m)). Defaults: g 0.76
 *   (double glazing, SAP Table 6b) and FF 0.7 (wood or PVC frame) when the element has none;
 *   Z_heat from the site overshading class (SAP Table 6d: 0.3, 0.54, 0.77, 1.0).
 * - Internal (SAP Table 5, typical): 60 N metabolic - 40 N losses + (35 + 7 N) cooking
 *   + appliances 1000 E_A,m / (24 n_m) + lighting 850 E_L,m / (24 n_m).
 *   M-0 status: no pump or water-heating gains (the dhw stage runs after gains in STAGE_ORDER).
 * - Opaque solar gains (BP 3.5, DEC SC-6) are zero at M-0 and arrive with cooling at M-A;
 *   `rating` mode keeps them at zero by definition.
 */
import { choiceValue, type GainsOut, type OvershadingClass, type PhysicsStage } from '@ibasho/core';
import { days, monthly, monthlyDrafts, ZERO12 } from './common.ts';
import { householdOf } from './household.ts';

const Z_HEAT: Record<OvershadingClass, number> = {
  heavy: 0.3,
  'more-than-average': 0.54,
  average: 0.77,
  'very-little': 1.0,
};
const DEFAULT_G = 0.76;
const DEFAULT_FF = 0.7;

export const gainsStage: PhysicsStage<'gains'> = {
  kind: 'physics-stage',
  id: 'stage-gains-m0',
  version: '0.1.0',
  title: 'engine.stage.gains',
  side: 'engine',
  stage: 'gains',
  modes: ['rating', 'standard', 'your-home'],
  run(input, ctx) {
    const hh = householdOf(input);
    const geo = input.geometry;
    const twin = geo.twin;
    // Unknown overshading takes "average" (SAP default for unknown).
    const z = Z_HEAT[choiceValue(twin.site.overshading) ?? 'average'];
    const byId = new Map(twin.elements.map((e) => [e.id, e]));

    const solar = new Float64Array(12);
    for (const e of geo.elements) {
      if (e.kind !== 'window' && e.kind !== 'rooflight') continue;
      const src = byId.get(e.id);
      const g = e.g ?? DEFAULT_G;
      const ffField = src?.frameFactor;
      const ff = ffField && ffField.state !== 'unknown' ? ffField.value : DEFAULT_FF;
      const s = ctx.climate.irradiance(e.orientationDeg ?? 180, e.tiltDeg ?? 90);
      for (let m = 0; m < 12; m++) solar[m] = solar[m]! + (0.9 * e.areaM2 * s[m]! * g * ff * z * 1000) / (24 * days(m));
    }
    const solarW = monthly((m) => solar[m]!);

    const n = hh.occupancyN;
    const fixedW = 60 * n - 40 * n + (35 + 7 * n);
    const internalW = monthly(
      (m) => fixedW + (1000 * hh.appliancesKWh[m]!) / (24 * days(m)) + (850 * hh.lightingKWh[m]!) / (24 * days(m)),
    );
    const output: GainsOut = { solarW, opaqueW: ZERO12, internalW };

    const evidence = [
      ...monthlyDrafts(ctx, 'gain.solar', solarW, 'W', { id: 'BP-3.4', doc: 'G_sol = sum 0.9 A S g FF Z' }),
      ...monthlyDrafts(ctx, 'gain.int', internalW, 'W', { id: 'BP-3.6', doc: 'SAP Table 5 internal gains' }, () => [
        { key: 'occ.n', role: 'occupancy' },
      ]),
    ];
    return { output, evidence };
  },
};
