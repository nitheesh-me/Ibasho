/**
 * Air source heat pump (BP 3.10, 6.1, DEC SC-2). Owner: WP-01.
 *
 * Physics: the space and hot water systems become `ashp-air-water` on electricity. The engine's
 * heat pump chain (EN 14825 bins, Ruhnau 2019 COP, design flow from emitters) gives the seasonal
 * performance; the efficiency the patch writes is only the BP 3.10 field range for display and is
 * tagged `default`, so the chain overrides it. A combi or instantaneous hot water system becomes
 * a cylinder (SPEC 9: the heat pump brings a cylinder), which changes the DHW class and therefore
 * the heavy key (ARCH 6).
 * - `heat-ashp`: keeps the existing radiators.
 * - `heat-ashp-radiators-plus`: emitter output x 1.6 (rooms upgraded to K2 or K3 panels, BP 6.1),
 *   via `emitters.kOversize` (or each listed radiator), so the design flow temperature falls.
 * Facts (`m.ashp.*`): replaces a combi, emitter multiplier, and whether 55 degC flow is enough
 * (`unknown` here; the engine evidence `hp.flow_design` answers it per package).
 */
import { type MeasureModel, type NumField, numCentral, type TwinPatch } from '@ibasho/core';
import { identity, measureValue, optionOf, param, provenance } from './common.ts';

const BP_3_10 = {
  id: 'bp-3-10',
  title: 'Building Physics Brief 3.10, heat pump model and worked example',
  retrieved: '2026-10-10',
} as const;
const RUHNAU = {
  id: 'ruhnau-2019',
  title: 'Ruhnau, Hirth and Praktiknjo (2019), heat pump COP time series, Scientific Data 6, 189',
  url: 'https://doi.org/10.1038/s41597-019-0199-y',
  retrieved: '2026-10-11',
} as const;
const EOH = {
  id: 'eoh-spf',
  title: 'Electrification of Heat field SPF (HPA summary)',
  url: 'https://hpauk.org.uk/?p=273',
  retrieved: '2026-10-10',
} as const;

function spfRange(): NumField {
  return { state: 'estimated', value: 2.9, range: [2.5, 3.8], source: { kind: 'default', pluginId: 'ashp' } };
}

export const ashpMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('ashp', 'heat', 'light', 'ashp'),
  version: '0.1.0',
  title: 'measure.ashp.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([BP_3_10, RUHNAU, EOH], 'secondary'),
  options: [
    { id: 'heat-ashp', title: 'measure.heat-ashp.title', params: { emitterFactor: { value: 1, unit: '1' } } },
    {
      id: 'heat-ashp-radiators-plus',
      title: 'measure.heat-ashp-radiators-plus.title',
      params: { emitterFactor: { value: 1.6, min: 1.3, max: 2, unit: '1' } },
    },
  ],
  subMeasures: [
    { id: 'cylinder', group: 'sub-cylinder' },
    { id: 'hob-induction', group: 'sub-hob' },
  ],
  touches: [],
  lifetimeYears: 18,
  apply(twin, optionId): TwinPatch {
    const k = param(optionOf(ashpMeasure, optionId), 'emitterFactor');
    const set: TwinPatch['set'] = [
      { path: '/systems/space/systemId', value: 'ashp-air-water' },
      { path: '/systems/space/fuel', value: 'electricity' },
      { path: '/systems/space/efficiency', value: spfRange() },
      { path: '/systems/dhw/systemId', value: 'ashp-air-water' },
      { path: '/systems/dhw/fuel', value: 'electricity' },
      { path: '/systems/dhw/efficiency', value: spfRange() },
    ];
    if (twin.systems.dhw.class !== 'cylinder') set.push({ path: '/systems/dhw/class', value: 'cylinder' });
    if (k !== 1) {
      const rads = twin.systems.emitters.radiators ?? [];
      if (rads.length > 0)
        rads.forEach((r, i) => {
          set.push({
            path: `/systems/emitters/radiators/${i}/outputW50`,
            value: measureValue(numCentral(r.outputW50) * k, 'ashp'),
          });
        });
      else
        set.push({
          path: '/systems/emitters/kOversize',
          value: measureValue(numCentral(twin.systems.emitters.kOversize) * k, 'ashp'),
        });
    }
    return { set };
  },
  facts(twin, optionId) {
    const o = optionOf(ashpMeasure, optionId);
    return {
      'm.ashp.replacesCombi': twin.systems.dhw.class === 'combi',
      'm.ashp.emitterFactor': param(o, 'emitterFactor'),
      'm.ashp.flowOk55': 'unknown',
    };
  },
};
