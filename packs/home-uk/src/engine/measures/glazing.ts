/**
 * Glazing: secondary low-E and A-rated double (BP 5.1 Table 24, 6.1). Owner: WP-01.
 * - `glazing-secondary-lowe`: a low-E secondary pane inside existing single glazing (U above 3):
 *   U 2.2 (RdSAP 10 Table 24, secondary low-E), g x 0.85 (second pane, ESTIMATE). The sash stays,
 *   so it suits listed and conservation-area homes.
 * - `glazing-double-a`: every window becomes A-rated double glazing, U 1.4 and g 0.63 (BP 6.1).
 * Low g cuts winter solar gain as well as summer (oracle 3: the sign of the net effect depends on
 * the climate).
 * Facts (`m.glazing.*`): windows changed, area, front elevation included.
 */
import { type HomeTwin, type MeasureModel, numCentral, type TwinPatch } from '@ibasho/core';
import { identity, indicesOf, measureValue, optionOf, param, provenance } from './common.ts';

const RDSAP_T24 = {
  id: 'rdsap-10-t24',
  title: 'RdSAP 10 Table 24, window U-values and g (via BP 5.1)',
  url: 'https://bregroup.com/documents/d/bre-group/rdsap-10-specification-10-06-2025',
  clause: 'Table 24',
  retrieved: '2026-10-10',
} as const;

function glazingFacts(twin: HomeTwin, idx: number[]) {
  return {
    'm.glazing.windows': idx.length,
    'm.glazing.areaM2': idx.reduce((a, i) => a + numCentral(twin.elements[i]!.areaM2), 0),
    'm.glazing.frontElevation': idx.some((i) => twin.elements[i]!.id.includes('front')),
  };
}

const single = (twin: HomeTwin) => indicesOf(twin, 'window', (e) => numCentral(e.u) > 3);
const allWindows = (twin: HomeTwin, u: number) => indicesOf(twin, 'window', (e) => numCentral(e.u) > u);

export const glazingSecondaryMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('glazing-secondary', 'glazing', 'heavy', 'glazing-secondary'),
  version: '0.2.0',
  title: 'measure.glazing-secondary.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([RDSAP_T24], 'secondary'),
  options: [
    {
      id: 'glazing-secondary-lowe',
      title: 'measure.glazing-secondary-lowe.title',
      params: { uAfter: { value: 2.2, unit: 'W/m2K' }, gFactor: { value: 0.85, unit: '1' } },
    },
  ],
  touches: ['window'],
  lifetimeYears: 30,
  conflicts: ['glazing-double'],
  apply(twin, optionId): TwinPatch {
    const o = optionOf(glazingSecondaryMeasure, optionId);
    const set: TwinPatch['set'] = [];
    for (const i of single(twin)) {
      const e = twin.elements[i]!;
      set.push({ path: `/elements/${i}/u`, value: measureValue(param(o, 'uAfter'), 'glazing-secondary') });
      const g = e.g ? numCentral(e.g) : 0.85;
      set.push({ path: `/elements/${i}/g`, value: measureValue(g * param(o, 'gFactor'), 'glazing-secondary') });
      set.push({ path: `/elements/${i}/constructionId`, value: `${e.constructionId}-secondary-lowe` });
    }
    return { set };
  },
  facts: (twin) => glazingFacts(twin, single(twin)),
};

export const glazingDoubleMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('glazing-double', 'glazing', 'heavy', 'glazing-double'),
  version: '0.2.0',
  title: 'measure.glazing-double.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([RDSAP_T24], 'secondary'),
  options: [
    {
      id: 'glazing-double-a',
      title: 'measure.glazing-double-a.title',
      params: { uAfter: { value: 1.4, unit: 'W/m2K' }, gAfter: { value: 0.63, unit: '1' } },
    },
  ],
  touches: ['window'],
  lifetimeYears: 30,
  conflicts: ['glazing-secondary'],
  apply(twin, optionId): TwinPatch {
    const o = optionOf(glazingDoubleMeasure, optionId);
    const u = param(o, 'uAfter');
    const set: TwinPatch['set'] = [];
    for (const i of allWindows(twin, u)) {
      set.push({ path: `/elements/${i}/u`, value: measureValue(u, 'glazing-double') });
      set.push({ path: `/elements/${i}/g`, value: measureValue(param(o, 'gAfter'), 'glazing-double') });
      set.push({ path: `/elements/${i}/constructionId`, value: 'window-double-a-rated' });
    }
    return { set };
  },
  facts: (twin, optionId) => glazingFacts(twin, allWindows(twin, param(optionOf(glazingDoubleMeasure, optionId), 'uAfter'))),
};
