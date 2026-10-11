/**
 * Cavity wall insulation, the one brief retrofit the home-uk measure set lacks. Owner: WP-25.
 * Physics: external `wall` elements with an unfilled cavity get the RdSAP 10 filled-cavity U
 * (0.55 W/m²K before 1976, 0.4 after), the same patch style as the home-uk wall models.
 */
import { type MeasureModel, numCentral, type TwinPatch } from '@ibasho/core';

const RDSAP_WALL = {
  id: 'rdsap-10-t6',
  title: 'RdSAP 10 Tables 6 to 8, wall U-values by construction and age band',
  url: 'https://bregroup.com/documents/d/bre-group/rdsap-10-specification-10-06-2025',
  retrieved: '2026-10-11',
} as const;

export const cavityFillMeasure: MeasureModel = {
  kind: 'measure',
  id: 'cavity-fill',
  group: 'cavity',
  weight: 'heavy',
  measureKind: 'cavity',
  version: '0.1.0',
  title: 'measure.cavity-fill.title',
  regions: ['GB'],
  side: 'engine',
  provenance: { sources: [RDSAP_WALL], lastChecked: '2026-10-11', grade: 'secondary' },
  options: [{ id: 'cavity-fill', title: 'measure.cavity-fill.title', params: { uAfter: { value: 0.55, unit: 'W/m2K' } } }],
  touches: ['wall'],
  lifetimeYears: 40,
  apply(twin): TwinPatch {
    const set: TwinPatch['set'] = [];
    twin.elements.forEach((e, i) => {
      if (e.kind !== 'wall' || e.constructionId !== 'cavity-unfilled') return;
      const u = Math.min(numCentral(e.u), 0.55);
      set.push({ path: `/elements/${i}/u`, value: { state: 'known', value: u, source: { kind: 'default', pluginId: 'cavity-fill' } } });
      set.push({ path: `/elements/${i}/constructionId`, value: 'cavity-filled' });
    });
    return { set };
  },
  facts(twin) {
    return { 'm.cavity.present': twin.elements.some((e) => e.constructionId === 'cavity-unfilled') };
  },
};
