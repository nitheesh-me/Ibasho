/**
 * Loft insulation top-up (BP 6.1). Owner: WP-01.
 * Physics: every loft-ceiling `roof` element gets the RdSAP 10 Table 16 U for the target joist
 * insulation depth (270 mm 0.16, 300 mm 0.14 W/m2K) when that is lower than its current U.
 * Facts for rules (`m.loft.*`): accessible (pitched roof true, flat false, rafters or unknown
 * unknown), U before and after, area treated.
 */
import { choiceValue, type HomeTwin, type MeasureModel, numCentral, type TwinPatch } from '@ibasho/core';
import { identity, measureValue, optionOf, param, provenance } from './common.ts';

const RDSAP_T16 = {
  id: 'rdsap-10-t16',
  title: 'RdSAP 10 Table 16, loft U-value by insulation thickness (via BP 5.1)',
  url: 'https://bregroup.com/documents/d/bre-group/rdsap-10-specification-10-06-2025',
  clause: 'Table 16',
  retrieved: '2026-10-10',
} as const;

function lofts(twin: HomeTwin): number[] {
  const out: number[] = [];
  twin.elements.forEach((e, i) => {
    if (e.kind === 'roof' && !/rafter|flat/.test(e.constructionId)) out.push(i);
  });
  return out;
}

export const loftMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('loft', 'loft', 'heavy', 'loft'),
  version: '0.1.0',
  title: 'measure.loft.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([RDSAP_T16], 'secondary'),
  options: [
    {
      id: 'loft-270',
      title: 'measure.loft-270.title',
      params: { depthMm: { value: 270 }, uAfter: { value: 0.16, unit: 'W/m2K' } },
    },
    {
      id: 'loft-300',
      title: 'measure.loft-300.title',
      params: { depthMm: { value: 300 }, uAfter: { value: 0.14, unit: 'W/m2K' } },
    },
  ],
  touches: ['roof'],
  lifetimeYears: 40,
  apply(twin, optionId): TwinPatch {
    const uAfter = param(optionOf(loftMeasure, optionId), 'uAfter');
    const set: TwinPatch['set'] = [];
    for (const i of lofts(twin)) {
      const e = twin.elements[i]!;
      if (numCentral(e.u) <= uAfter) continue;
      set.push({ path: `/elements/${i}/u`, value: measureValue(uAfter, 'loft') });
      set.push({ path: `/elements/${i}/constructionId`, value: `loft-joists-${optionId.slice(5)}mm` });
    }
    return { set };
  },
  facts(twin, optionId) {
    const uAfter = param(optionOf(loftMeasure, optionId), 'uAfter');
    const idx = lofts(twin);
    const roof = choiceValue(twin.form.roof);
    const uBefore = idx.length ? Math.max(...idx.map((i) => numCentral(twin.elements[i]!.u))) : 0;
    const area = idx.reduce((s, i) => s + numCentral(twin.elements[i]!.areaM2), 0);
    return {
      'm.loft.accessible': roof === 'pitched' ? true : roof === 'flat' ? false : 'unknown',
      'm.loft.uBefore': uBefore,
      'm.loft.uAfter': uAfter,
      'm.loft.areaM2': area,
    };
  },
};
