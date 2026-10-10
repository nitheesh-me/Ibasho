/**
 * Hot water and cooking sub-measures and cylinder measures (SPEC 9, BP 3.9, 6.1). Owner: WP-01.
 * - `cylinder-new` (sub-measure of the heat pump): a new factory-insulated cylinder; the DHW class
 *   becomes `cylinder` (heavy key) and the dhw stage applies the new-cylinder standing loss.
 *   Facts: floor space 0.5 to 0.7 m2 (SPEC 9), replaces a combi.
 * - `hob-induction-gas-disconnect` (sub-measure of the heat pump): induction hob; with no other
 *   gas use the supply is capped and the gas standing charge goes (money pack, by option id).
 * - `cylinder-jacket` and `solar-thermal-3m2`: PLACEHOLDER physics. The twin has no cylinder or
 *   collector description yet (INTERFACES request), so these patch nothing; their facts mark them
 *   not applicable to a combi, which the rules use to exclude them. GH1 has a combi.
 */
import { type MeasureModel, type TwinPatch } from '@ibasho/core';
import { identity, provenance } from './common.ts';

const SAP_T2 = {
  id: 'sap-10-2-t2',
  title: 'SAP 10.2 Table 2, hot water storage loss factors',
  url: 'https://files.bregroup.com/SAP/SAP%2010.2%20-%2011-04-2023.pdf',
  clause: 'Table 2',
  retrieved: '2026-10-11',
} as const;
const DOE_COOKING = {
  id: 'doe-cooking-efficiency',
  title: 'US DOE cooking product test procedures: hob efficiencies (gas about 0.4, induction about 0.85)',
  url: 'https://www.energy.gov/eere/buildings/cooking-products',
  retrieved: '2026-10-11',
} as const;

export const cylinderMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('cylinder', 'sub-cylinder', 'light', 'cylinder'),
  version: '0.2.0',
  title: 'measure.cylinder.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([SAP_T2], 'estimate'),
  options: [
    {
      id: 'cylinder-new',
      title: 'measure.cylinder-new.title',
      params: { floorSpaceM2: { value: 0.6, min: 0.5, max: 0.7, unit: 'm2' } },
    },
  ],
  touches: [],
  lifetimeYears: 25,
  prereq: ['ashp'],
  apply(twin): TwinPatch {
    return twin.systems.dhw.class === 'cylinder'
      ? { set: [] }
      : { set: [{ path: '/systems/dhw/class', value: 'cylinder' }] };
  },
  facts(twin) {
    return {
      'm.cylinder.replacesCombi': twin.systems.dhw.class === 'combi',
      'm.cylinder.floorSpaceM2': 0.6,
    };
  },
};

export const hobMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('hob-induction', 'sub-hob', 'light', 'hob'),
  version: '0.2.0',
  title: 'measure.hob-induction.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([DOE_COOKING], 'estimate'),
  options: [{ id: 'hob-induction-gas-disconnect', title: 'measure.hob-induction-gas-disconnect.title', params: {} }],
  touches: [],
  lifetimeYears: 15,
  apply(): TwinPatch {
    return {
      set: [
        {
          path: '/systems/hob',
          value: { state: 'known', value: 'induction', source: { kind: 'default', pluginId: 'hob-induction' } },
        },
      ],
    };
  },
  facts(twin) {
    return {
      'm.hob.gasBefore': twin.systems.hob.state !== 'unknown' && twin.systems.hob.value === 'gas',
      'm.hob.gasDisconnect': true,
    };
  },
};

export const cylinderJacketMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('cylinder-jacket', 'cylinder', 'light', 'cylinder-jacket'),
  version: '0.2.0',
  title: 'measure.cylinder-jacket.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([SAP_T2], 'estimate'),
  options: [{ id: 'cylinder-jacket', title: 'measure.cylinder-jacket.title', params: {} }],
  touches: [],
  lifetimeYears: 10,
  apply(): TwinPatch {
    return { set: [] };
  },
  facts(twin) {
    return { 'm.cylinder-jacket.applicable': twin.systems.dhw.class === 'cylinder' ? 'unknown' : false };
  },
};

export const solarThermalMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('solar-thermal', 'solar-thermal', 'light', 'solar-thermal'),
  version: '0.2.0',
  title: 'measure.solar-thermal.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([], 'estimate'),
  options: [
    {
      id: 'solar-thermal-3m2',
      title: 'measure.solar-thermal-3m2.title',
      params: { areaM2: { value: 3, unit: 'm2' } },
    },
  ],
  touches: ['roof'],
  lifetimeYears: 25,
  apply(): TwinPatch {
    return { set: [] };
  },
  facts(twin) {
    return { 'm.solar-thermal.applicable': twin.systems.dhw.class === 'cylinder' ? 'unknown' : false };
  },
};
