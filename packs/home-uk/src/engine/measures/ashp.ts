/**
 * Air source heat pump (BP 3.10, 6.1). Owner: WP-01.
 *
 * M-0 physics: fixed seasonal COPs replace the boiler for space heating and hot water. A combi or
 * instantaneous hot water system becomes a cylinder (SPEC 9: the heat pump brings a cylinder),
 * which changes the DHW class and therefore the heavy key (ARCH 6).
 * - `heat-ashp`, space SPF 2.65: BP 3.10 worked example, radiators sized for the unimproved home
 *   (about 72 degC design flow).
 * - `heat-ashp-radiators-plus`, space SPF 3.1: the same worked example at about 54 degC design
 *   flow, which larger emitters allow.
 * - Hot water COP 2.75: BP 3.10 COP fit at a 55 degC store and the London annual mean (lift
 *   44.6 K, COP 3.06) times the 0.9 field factor; range 2.3 to 3.3 spans lifts 50 to 40 K and field
 *   factors 0.8 to 1.0.
 * Space ranges are the BP 3.10 field SPF range 2.5 to 3.8. Graded `estimate` until EN 14825 bin
 * SCOP with the Ruhnau 2019 fit replaces fixed COPs at M-A (WP-01 A8, DEC SC-2).
 * Facts (`m.ashp.*`): replaces a combi, COPs, and whether 55 degC flow is enough (unknown at M-0).
 */
import type { MeasureModel, NumField, TwinPatch } from '@ibasho/core';
import { identity, optionOf, param, provenance } from './common.ts';

const BP_3_10 = {
  id: 'bp-3-10',
  title: 'Building Physics Brief 3.10, heat pump model and worked example',
  retrieved: '2026-10-10',
} as const;
const EOH = {
  id: 'eoh-spf',
  title: 'Electrification of Heat field SPF (HPA summary)',
  url: 'https://hpauk.org.uk/?p=273',
  retrieved: '2026-10-10',
} as const;

function cop(value: number, range: [number, number]): NumField {
  return { state: 'estimated', value, range, source: { kind: 'default', pluginId: 'ashp' } };
}

export const ashpMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('ashp', 'heat', 'light', 'ashp'),
  version: '0.1.0',
  title: 'measure.ashp.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([BP_3_10, EOH], 'estimate'),
  options: [
    {
      id: 'heat-ashp',
      title: 'measure.heat-ashp.title',
      params: {
        copSpace: { value: 2.65, min: 2.5, max: 3.8, unit: '1' },
        copDhw: { value: 2.75, min: 2.3, max: 3.3, unit: '1' },
      },
    },
    {
      id: 'heat-ashp-radiators-plus',
      title: 'measure.heat-ashp-radiators-plus.title',
      params: {
        copSpace: { value: 3.1, min: 2.5, max: 3.8, unit: '1' },
        copDhw: { value: 2.75, min: 2.3, max: 3.3, unit: '1' },
      },
    },
  ],
  subMeasures: [
    { id: 'cylinder', group: 'sub-cylinder' },
    { id: 'hob-induction', group: 'sub-hob' },
  ],
  touches: [],
  lifetimeYears: 18,
  apply(twin, optionId): TwinPatch {
    const o = optionOf(ashpMeasure, optionId);
    const space = param(o, 'copSpace');
    const dhw = param(o, 'copDhw');
    const set: TwinPatch['set'] = [
      { path: '/systems/space/systemId', value: 'ashp-air-water' },
      { path: '/systems/space/fuel', value: 'electricity' },
      {
        path: '/systems/space/efficiency',
        value: cop(space, [o.params.copSpace!.min!, o.params.copSpace!.max!]),
      },
      { path: '/systems/dhw/systemId', value: 'ashp-air-water' },
      { path: '/systems/dhw/fuel', value: 'electricity' },
      { path: '/systems/dhw/efficiency', value: cop(dhw, [o.params.copDhw!.min!, o.params.copDhw!.max!]) },
    ];
    if (twin.systems.dhw.class !== 'cylinder') set.push({ path: '/systems/dhw/class', value: 'cylinder' });
    return { set };
  },
  facts(twin, optionId) {
    const o = optionOf(ashpMeasure, optionId);
    return {
      'm.ashp.replacesCombi': twin.systems.dhw.class === 'combi',
      'm.ashp.copSpace': param(o, 'copSpace'),
      'm.ashp.copDhw': param(o, 'copDhw'),
      'm.ashp.flowOk55': 'unknown',
    };
  },
};
