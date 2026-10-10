/**
 * Heating controls: TRVs plus weather compensation (BP 6.1, SAP Tables 4c, 4e and 9). Owner: WP-01.
 * Physics: control type 3 (SAP Table 9: rest-of-home off-periods 9 and 8 h, T_h2 by the type 2
 * formula) and, for a gas boiler, seasonal efficiency + 0.02 (lower return temperature, BP 6.1;
 * SAP Table 4c weather compensation adjustment, secondary). Heat pumps already compensate.
 * Facts (`m.controls.*`): wet system, control type before.
 */
import { choiceValue, type MeasureModel, numCentral, type TwinPatch } from '@ibasho/core';
import { identity, measureValue, optionOf, param, provenance } from './common.ts';

const SAP_T4 = {
  id: 'sap-10-2-t4c-t4e',
  title: 'SAP 10.2 Tables 4c and 4e, control types and efficiency adjustments',
  url: 'https://files.bregroup.com/SAP/SAP%2010.2%20-%2011-04-2023.pdf',
  clause: 'Tables 4c, 4e',
  retrieved: '2026-10-11',
} as const;

export const controlsMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('controls', 'controls', 'heavy', 'controls'),
  version: '0.2.0',
  title: 'measure.controls.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([SAP_T4], 'secondary'),
  options: [
    {
      id: 'controls-trv-weather-comp',
      title: 'measure.controls-trv-weather-comp.title',
      params: { boilerGain: { value: 0.02, min: 0, max: 0.03, unit: '1' } },
    },
  ],
  touches: [],
  lifetimeYears: 15,
  apply(twin, optionId): TwinPatch {
    const gain = param(optionOf(controlsMeasure, optionId), 'boilerGain');
    const set: TwinPatch['set'] = [
      {
        path: '/systems/controls',
        value: { state: 'known', value: 'trvs-weather-compensation', source: { kind: 'default', pluginId: 'controls' } },
      },
    ];
    const space = twin.systems.space;
    if (space.fuel === 'gas' && space.efficiency)
      set.push({
        path: '/systems/space/efficiency',
        value: measureValue(Math.min(0.98, numCentral(space.efficiency) + gain), 'controls'),
      });
    return { set };
  },
  facts(twin) {
    return {
      'm.controls.wet': twin.systems.space.fuel !== 'electricity' || /ashp|heat-pump/.test(twin.systems.space.systemId),
      'm.controls.before': choiceValue(twin.systems.controls) ?? 'unknown',
    };
  },
};
