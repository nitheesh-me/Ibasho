/**
 * Gains stage (BP 3.4 to 3.6, SAP 10.2 Table 5 column A). Owner: WP-01.
 *
 * - Solar through glazing: G_sol,m = sum 0.9 A S_m g FF Z_heat, as a mean power in W
 *   (S_m from the climate pack in kWh/m2 per month, times 1000 / (24 n_m)). Defaults: g 0.76
 *   (double glazing, SAP Table 6b) and FF 0.7 (wood or PVC frame) when the element has none;
 *   Z_heat from the site overshading class (SAP Table 6d: 0.3, 0.54, 0.77, 1.0).
 * - Opaque solar and sky gains (BP 3.5, ISO 13790 11.3.4; off in `rating`, where SAP ignores them):
 *   Phi_op,m = sum_k R_se U_k A_k (alpha_k I_k,m - F_r,k h_r d_theta_er), R_se 0.04 m2K/W,
 *   h_r = 4.5 W/m2K, d_theta_er 11 K (temperate) or 13 K (tropical), F_r 1 for roofs and 0.5 for
 *   walls and doors, alpha from the element or 0.6 (ISO 52016-1 default). Party walls and ground
 *   floors see no sky. Roofs use their own tilt (0 for a loft ceiling, so GHI). The sky term can
 *   make the sum negative in a UK winter; it is reported, not floored.
 * - Internal (SAP Table 5 column A): 60 N metabolic - 40 N losses + (35 + 7 N) cooking
 *   + appliances 1000 E_A,m / (24 n_m) + lighting 850 E_L,m / (24 n_m) + pumps (Table 5a: wet
 *   heating pump 3 W if installed 2013 or later, 10 W if earlier, 7 W unknown) + water heating
 *   1000 [0.25 (0.85 Q_W) + 0.8 (Q_dist + Q_store)] / (24 n_m) (BP 3.6), with Q_W from the shared
 *   DHW model (the dhw stage itself runs later in STAGE_ORDER).
 */
import { choiceValue, type GainsOut, type OvershadingClass, type PhysicsStage } from '@ibasho/core';
import { days, monthly, monthlyDrafts, ZERO12 } from './common.ts';
import { dhwModel } from './dhw.ts';
import { householdOf } from './household.ts';

const Z_HEAT: Record<OvershadingClass, number> = {
  heavy: 0.3,
  'more-than-average': 0.54,
  average: 0.77,
  'very-little': 1.0,
};
const DEFAULT_G = 0.76;
const DEFAULT_FF = 0.7;
const R_SE = 0.04;
const H_R = 4.5;
const DEFAULT_ALPHA = 0.6;

/** SAP Table 5a central heating pump gain, W, for a wet system. */
export function pumpGainW(installedYear: number | undefined, wet: boolean): number {
  if (!wet) return 0;
  if (installedYear === undefined) return 7;
  return installedYear >= 2013 ? 3 : 10;
}

export interface GainsDefaults {
  /** Standing loss of a hot water cylinder, kWh/day (shared with the dhw stage). */
  cylinderLossKWhPerDay: number;
  newCylinderLossKWhPerDay: number;
  heatPumpIds: ReadonlySet<string>;
}

export function createGainsStage(d: GainsDefaults): PhysicsStage<'gains'> {
  return {
    kind: 'physics-stage',
    id: 'stage-gains',
    version: '0.2.0',
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
      const opaque = new Float64Array(12);
      const dTer = ctx.climate.zone === 'uk-temperate' ? 11 : 13;
      for (const e of geo.elements) {
        const src = byId.get(e.id);
        if (e.kind === 'window' || e.kind === 'rooflight') {
          const g = e.g ?? DEFAULT_G;
          const ffField = src?.frameFactor;
          const ff = ffField && ffField.state !== 'unknown' ? ffField.value : DEFAULT_FF;
          const s = ctx.climate.irradiance(e.orientationDeg ?? 180, e.tiltDeg ?? 90);
          for (let m = 0; m < 12; m++)
            solar[m] = solar[m]! + (0.9 * e.areaM2 * s[m]! * g * ff * z * 1000) / (24 * days(m));
          continue;
        }
        if (ctx.mode === 'rating') continue;
        if (e.kind !== 'wall' && e.kind !== 'roof' && e.kind !== 'door') continue;
        const aField = src?.absorptance;
        const alpha = aField && aField.state !== 'unknown' ? aField.value : DEFAULT_ALPHA;
        const fr = e.kind === 'roof' ? 1 : 0.5;
        const s = ctx.climate.irradiance(e.orientationDeg ?? 180, e.tiltDeg ?? (e.kind === 'roof' ? 0 : 90));
        const k = R_SE * e.u * e.areaM2;
        for (let m = 0; m < 12; m++) {
          const iW = (s[m]! * 1000) / (24 * days(m));
          opaque[m] = opaque[m]! + k * (alpha * iW - fr * H_R * dTer);
        }
      }
      const solarW = monthly((m) => solar[m]!);
      const opaqueW = ctx.mode === 'rating' ? ZERO12 : monthly((m) => opaque[m]!);

      const n = hh.occupancyN;
      const space = twin.systems.space;
      const wet = !/direct-electric|storage|ac-|split/.test(space.systemId);
      const pump = pumpGainW(space.installedYear, wet);
      const dhw = dhwModel(twin, n, ctx, d);
      const fixedW = 60 * n - 40 * n + (35 + 7 * n) + pump;
      const internalW = monthly((m) => {
        const per = 1000 / (24 * days(m));
        const water = (0.25 * 0.85 * dhw.contentKWh[m]! + 0.8 * (dhw.distKWh[m]! + dhw.storeKWh[m]!)) * per;
        return fixedW + hh.appliancesKWh[m]! * per + 0.85 * hh.lightingKWh[m]! * per + water;
      });
      const output: GainsOut = { solarW, opaqueW, internalW };

      const evidence = [
        ...monthlyDrafts(ctx, 'gain.solar', solarW, 'W', { id: 'BP-3.4', doc: 'G_sol = sum 0.9 A S g FF Z' }),
        ...monthlyDrafts(ctx, 'gain.opaque', opaqueW, 'W', {
          id: 'BP-3.5',
          doc: 'Phi_op = sum R_se U A (alpha I - F_r h_r d_theta_er); 0 in rating',
        }),
        ...monthlyDrafts(
          ctx,
          'gain.int',
          internalW,
          'W',
          { id: 'BP-3.6', doc: 'SAP Table 5 internal gains (metabolic, LAC, pumps, water heating)' },
          () => [{ key: 'occ.n', role: 'occupancy' }],
        ),
      ];
      return { output, evidence };
    },
  };
}
