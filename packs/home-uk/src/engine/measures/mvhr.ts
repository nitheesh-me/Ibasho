/**
 * Mechanical ventilation with heat recovery (BP 6.1). Owner: WP-01.
 * Physics: ventilation system `mvhr`: n_eff = n_m + 0.5 (1 - 0.85 x 0.8) (SAP 10.2 section 2 via
 * BP 3.3, heat recovery 85%, in-use factor 0.8) plus fan electricity SFP 0.8 W/(l/s) at 0.5 ach all
 * year (systems stage). On a leaky home the infiltration stays, so fan energy can exceed the heat
 * saved (oracle 4); the rule pack allows MVHR only when AP50 <= 5.
 * Facts (`m.mvhr.*`): tested AP50 (or unknown).
 */
import { type MeasureModel, numCentral, type TwinPatch } from '@ibasho/core';
import { identity, provenance } from './common.ts';

const HW = {
  id: 'heriot-watt-mvhr',
  title: 'Heriot-Watt, energy saving in existing solid wall dwellings (MVHR needs airtightness)',
  url: 'https://researchportal.hw.ac.uk/en/publications/the-potential-for-energy-saving-in-existing-solid-wall-dwellings-/',
  retrieved: '2026-10-10',
} as const;

export const mvhrMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('mvhr', 'vent', 'heavy', 'mvhr'),
  version: '0.2.0',
  title: 'measure.mvhr.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([HW], 'secondary'),
  options: [{ id: 'vent-mvhr', title: 'measure.vent-mvhr.title', params: {} }],
  touches: [],
  lifetimeYears: 20,
  apply(): TwinPatch {
    return {
      set: [
        {
          path: '/ventilation/system',
          value: { state: 'known', value: 'mvhr', source: { kind: 'default', pluginId: 'mvhr' } },
        },
      ],
    };
  },
  facts(twin) {
    const ap = twin.ventilation.ap50;
    return { 'm.mvhr.ap50': ap && ap.state !== 'unknown' ? numCentral(ap) : 'unknown' };
  },
};
