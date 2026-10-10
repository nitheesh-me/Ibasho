/**
 * Solid wall insulation: external (EWI) and internal (IWI) (BP 6.1, SPEC 9 and R19, DEC SC-4).
 * Owner: WP-01.
 *
 * Both apply to external `wall` elements whose construction is solid masonry (`solid-*`, `stone-*`).
 * - `wall-ewi-100`: 100 mm EPS or mineral wool, lambda 0.038, U = 1 / (1/U0 + d/lambda) (about
 *   0.30 from 1.5, BP 5.1 gives 0.32). Thermal mass stays (insulation outside). Junctions the wall
 *   touches fall to the accredited-detail psi (SAP 2012 Table K1): lintel 0.30, sill 0.04, jamb 0.05,
 *   ground floor 0.16, eaves 0.06, party wall 0.06 (shared, halved from 0.12), intermediate floor
 *   0.07 (ESTIMATE where the detail is not accredited). Only lower values are written.
 * - `wall-iwi-woodfibre`: 50 mm vapour-open wood fibre board, lambda 0.040, U about 0.52 from 1.5
 *   (SPEC 9: 0.5 to 0.6). The construction id gains `-iwi`, which drops the thermal mass parameter
 *   to 100 kJ/m2K (RdSAP 10 Table 22). Oracle 9: IWI raises psi where floor joists and party walls
 *   meet the wall (insulation interrupted): intermediate floor 0.14 to 0.28 and party wall 0.12 to
 *   0.24 (ESTIMATE, doubled; BRE IP 1/06 shows uninterrupted IWI junctions of this order). Only
 *   higher values are written; the scene draws them as new-risk hatches.
 * Facts (`m.wall.*`): solid masonry present, area treated, U before and after, front elevation
 * included, finish (for the conservation-area rules).
 */
import { type HomeTwin, type MeasureModel, numCentral, type TwinPatch } from '@ibasho/core';
import {
  addLayer,
  identity,
  indicesOf,
  junctionChanges,
  measureValue,
  optionOf,
  param,
  provenance,
  SAP_K1,
} from './common.ts';

const EST_SOLID = {
  id: 'est-solid-wall',
  title: 'Energy Saving Trust, solid wall insulation',
  url: 'https://energysavingtrust.org.uk/home-insulation/solid-wall',
  retrieved: '2026-10-10',
} as const;

function solidWalls(twin: HomeTwin): number[] {
  return indicesOf(twin, 'wall', (e) => /^(solid|stone)/.test(e.constructionId) && !/-(ewi|iwi)/.test(e.constructionId));
}

function wallFacts(twin: HomeTwin, uAfter: (u: number) => number) {
  const idx = solidWalls(twin);
  const area = idx.reduce((a, i) => a + numCentral(twin.elements[i]!.areaM2), 0);
  const uBefore = idx.length ? Math.max(...idx.map((i) => numCentral(twin.elements[i]!.u))) : 0;
  const front = idx.some((i) => twin.elements[i]!.id.includes('front'));
  return { idx, area, uBefore, uAfter: idx.length ? uAfter(uBefore) : 0, front };
}

const EWI_PSI = {
  lintel: 0.3,
  sill: 0.04,
  jamb: 0.05,
  'ground-floor': 0.16,
  eaves: 0.06,
  'party-wall': 0.06,
  'intermediate-floor': 0.07,
} as const;
const IWI_PSI = { 'intermediate-floor': 0.28, 'party-wall': 0.24, 'joist-end': 0.28 } as const;

function ewiJunctions(twin: HomeTwin) {
  const ids = new Set(solidWalls(twin).map((i) => twin.elements[i]!.id));
  return junctionChanges(twin, ids, EWI_PSI, 'lower', 'wall-ewi');
}
function iwiJunctions(twin: HomeTwin) {
  const ids = new Set(solidWalls(twin).map((i) => twin.elements[i]!.id));
  return junctionChanges(twin, ids, IWI_PSI, 'raise', 'wall-iwi');
}

export const wallEwiMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('wall-ewi', 'wall', 'heavy', 'ewi'),
  version: '0.2.0',
  title: 'measure.wall-ewi.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([EST_SOLID, SAP_K1], 'secondary'),
  options: [
    {
      id: 'wall-ewi-100',
      title: 'measure.wall-ewi-100.title',
      params: { thicknessM: { value: 0.1, unit: 'm' }, lambda: { value: 0.038, unit: 'W/mK' } },
    },
  ],
  touches: ['wall'],
  lifetimeYears: 36,
  conflicts: ['wall-iwi'],
  apply(twin, optionId): TwinPatch {
    const o = optionOf(wallEwiMeasure, optionId);
    const d = param(o, 'thicknessM');
    const l = param(o, 'lambda');
    const set: TwinPatch['set'] = [];
    for (const i of solidWalls(twin)) {
      const e = twin.elements[i]!;
      set.push({ path: `/elements/${i}/u`, value: measureValue(addLayer(numCentral(e.u), d, l), 'wall-ewi') });
      set.push({ path: `/elements/${i}/constructionId`, value: `${e.constructionId}-ewi` });
    }
    set.push(...ewiJunctions(twin).set);
    return { set };
  },
  junctionEffects: (twin) => ewiJunctions(twin).effects,
  facts(twin, optionId) {
    const o = optionOf(wallEwiMeasure, optionId);
    const f = wallFacts(twin, (u) => addLayer(u, param(o, 'thicknessM'), param(o, 'lambda')));
    return {
      'm.wall.solid': f.idx.length > 0,
      'm.wall.areaM2': f.area,
      'm.wall.uBefore': f.uBefore,
      'm.wall.uAfter': f.uAfter,
      'm.wall.frontElevation': f.front,
      'm.wall.finish': 'render',
    };
  },
};

export const wallIwiMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('wall-iwi', 'wall', 'heavy', 'iwi'),
  version: '0.2.0',
  title: 'measure.wall-iwi.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([EST_SOLID, SAP_K1], 'estimate'),
  options: [
    {
      id: 'wall-iwi-woodfibre',
      title: 'measure.wall-iwi-woodfibre.title',
      params: { thicknessM: { value: 0.05, unit: 'm' }, lambda: { value: 0.04, unit: 'W/mK' } },
    },
  ],
  touches: ['wall'],
  lifetimeYears: 36,
  conflicts: ['wall-ewi'],
  apply(twin, optionId): TwinPatch {
    const o = optionOf(wallIwiMeasure, optionId);
    const d = param(o, 'thicknessM');
    const l = param(o, 'lambda');
    const set: TwinPatch['set'] = [];
    for (const i of solidWalls(twin)) {
      const e = twin.elements[i]!;
      set.push({ path: `/elements/${i}/u`, value: measureValue(addLayer(numCentral(e.u), d, l), 'wall-iwi') });
      set.push({ path: `/elements/${i}/constructionId`, value: `${e.constructionId}-iwi` });
    }
    set.push(...iwiJunctions(twin).set);
    return { set };
  },
  junctionEffects: (twin) => iwiJunctions(twin).effects,
  facts(twin, optionId) {
    const o = optionOf(wallIwiMeasure, optionId);
    const f = wallFacts(twin, (u) => addLayer(u, param(o, 'thicknessM'), param(o, 'lambda')));
    return {
      'm.wall.solid': f.idx.length > 0,
      'm.wall.areaM2': f.area,
      'm.wall.uBefore': f.uBefore,
      'm.wall.uAfter': f.uAfter,
      'm.wall.frontElevation': f.front,
      'm.wall.vapourOpen': true,
    };
  },
};
