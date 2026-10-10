/**
 * Suspended timber floor insulation (BP 6.1). Owner: WP-01.
 * Physics: insulation between joists adds R 2.5 m2K/W, U = 1 / (1/U0 + 2.5), and seals the floor
 * (SAP infiltration floor term 0.2 to 0.1 ach: `floorType` becomes `suspended-sealed`).
 * Applies to `floor` elements with a suspended timber construction.
 * Facts (`m.floor.*`): suspended floor present, area, U before and after.
 */
import { type HomeTwin, type MeasureModel, numCentral, type TwinPatch } from '@ibasho/core';
import { identity, indicesOf, measureValue, optionOf, param, provenance } from './common.ts';

const WHICH_FLOOR = {
  id: 'which-floor',
  title: 'Which?, floor insulation costs and savings',
  url: 'https://www.which.co.uk/reviews/insulation/article/floor-insulation',
  retrieved: '2026-10-10',
} as const;

const suspended = (twin: HomeTwin) => indicesOf(twin, 'floor', (e) => /suspended/.test(e.constructionId) && !/insulated/.test(e.constructionId));

export const floorMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('floor', 'floor', 'heavy', 'floor'),
  version: '0.2.0',
  title: 'measure.floor.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([WHICH_FLOOR], 'secondary'),
  options: [
    {
      id: 'floor-suspended-insulation',
      title: 'measure.floor-suspended-insulation.title',
      params: { addedR: { value: 2.5 } },
    },
  ],
  touches: ['floor'],
  lifetimeYears: 40,
  apply(twin, optionId): TwinPatch {
    const r = param(optionOf(floorMeasure, optionId), 'addedR');
    const set: TwinPatch['set'] = [];
    for (const i of suspended(twin)) {
      const e = twin.elements[i]!;
      set.push({ path: `/elements/${i}/u`, value: measureValue(1 / (1 / numCentral(e.u) + r), 'floor') });
      set.push({ path: `/elements/${i}/constructionId`, value: `${e.constructionId}-insulated` });
    }
    if (set.length)
      set.push({
        path: '/ventilation/floorType',
        value: { state: 'known', value: 'suspended-sealed', source: { kind: 'default', pluginId: 'floor' } },
      });
    return { set };
  },
  facts(twin, optionId) {
    const r = param(optionOf(floorMeasure, optionId), 'addedR');
    const idx = suspended(twin);
    const u = idx.length ? numCentral(twin.elements[idx[0]!]!.u) : 0;
    return {
      'm.floor.suspended': idx.length > 0,
      'm.floor.areaM2': idx.reduce((a, i) => a + numCentral(twin.elements[i]!.areaM2), 0),
      'm.floor.uBefore': u,
      'm.floor.uAfter': u > 0 ? 1 / (1 / u + r) : 0,
    };
  },
};
