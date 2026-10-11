/**
 * Global type pack (WP-18): UK space types and schedules (NCM activity database and SAP 10.2 style
 * values; estimates), used for London buildings. Space type ids match the Indian pack so a
 * document keeps its room functions when it moves; merge with `mergeTypeLibraries(typesIn,
 * typesGlobal)` so these win for UK places.
 */
import type {
  IbashoModule,
  Schedule24x3,
  SchedulePlugin,
  Sourced,
  SourceRef,
  SpaceTypePlugin,
  TypeLibrary,
} from '@ibasho/core';

const src = (id: string, title: string, url: string): SourceRef => ({
  id,
  title,
  url,
  retrieved: '2026-10-11',
});
const NCM = src(
  'ncm-2021',
  'UK National Calculation Methodology activity database (2021)',
  'https://www.uk-ncm.org.uk',
);
const SAP = src('sap-10.2', 'BRE, SAP 10.2 Standard Assessment Procedure', 'https://bregroup.com/sap');
const CIBSE = src('cibse-guide-a', 'CIBSE Guide A Environmental design (2015)', 'https://www.cibse.org');
const PROV = { sources: [NCM, SAP, CIBSE], lastChecked: '2026-10-11' as const, grade: 'estimate' as const };

const S = (low: number, typical: number, high: number, source: SourceRef): Sourced => ({
  low,
  typical,
  high,
  source,
  grade: 'estimate',
});
const day = (base: number, blocks: [number, number, number][] = []) => {
  const out = Array.from({ length: 24 }, () => base);
  for (const [a, b, v] of blocks) for (let h = a; h < b; h++) out[h] = v;
  return out;
};
const sch = (scheduleId: string, use: SchedulePlugin['use'], profile: Schedule24x3): SchedulePlugin => ({
  kind: 'schedule',
  id: `types-global-sched-${scheduleId}`,
  version: '0.1.0',
  title: `types.schedule.${scheduleId}`,
  side: 'both',
  regions: ['GB'],
  provenance: PROV,
  scheduleId,
  use,
  profile,
});

const UK_HEAT = day(0, [
  [7, 9, 1],
  [16, 23, 1],
]);
export const SCHEDULES_GLOBAL: SchedulePlugin[] = [
  sch('uk-home-heat', 'hvac', { weekday: UK_HEAT, saturday: UK_HEAT, sunday: UK_HEAT }),
  sch('uk-office-occ', 'occupancy', { weekday: day(0, [[8, 18, 0.9]]), saturday: day(0), sunday: day(0) }),
  sch('uk-office-hvac', 'hvac', { weekday: day(0, [[7, 19, 1]]), saturday: day(0), sunday: day(0) }),
];

const space = (
  spaceTypeId: string,
  v: {
    rp: number;
    ra: number;
    density: [number, number, number];
    lpd: [number, number, number];
    epd: [number, number, number];
    heat: number;
    cool: number;
    dhw?: number;
  },
  schedules: SpaceTypePlugin['schedules'],
): SpaceTypePlugin => ({
  kind: 'space-type',
  id: `types-global-space-${spaceTypeId}`,
  version: '0.1.0',
  title: `types.space.${spaceTypeId}`,
  side: 'both',
  regions: ['GB'],
  provenance: PROV,
  spaceTypeId,
  label: `types.space.${spaceTypeId}`,
  conditioned: true,
  habitable: true,
  rpLsPerPerson: S(v.rp, v.rp, v.rp, NCM),
  raLsPerM2: S(v.ra, v.ra, v.ra, NCM),
  densityPer100m2: S(...v.density, NCM),
  lpdWm2: S(...v.lpd, NCM),
  epdWm2: S(...v.epd, NCM),
  coolSetC: S(v.cool - 1, v.cool, v.cool + 2, CIBSE),
  heatSetC: S(v.heat - 2, v.heat, v.heat + 1, SAP),
  dhwLPerPersonDay: v.dhw ? S(v.dhw * 0.7, v.dhw, v.dhw * 1.4, SAP) : 'unknown',
  schedules,
});

const HOME = {
  occupancy: 'home-occ',
  lighting: 'home-light',
  equipment: 'home-equip',
  hvac: 'uk-home-heat',
  dhw: 'home-dhw',
};
export const SPACE_TYPES_GLOBAL: SpaceTypePlugin[] = [
  space(
    'living',
    { rp: 7, ra: 0, density: [2, 4, 6], lpd: [2, 3, 5], epd: [3, 5, 8], heat: 21, cool: 26, dhw: 45 },
    HOME,
  ),
  space(
    'bedroom',
    { rp: 7, ra: 0, density: [6, 9.5, 12], lpd: [1.5, 2.5, 4], epd: [1, 2, 4], heat: 18, cool: 26, dhw: 45 },
    HOME,
  ),
  space(
    'kitchen',
    { rp: 7, ra: 0, density: [0, 1, 2], lpd: [3, 5, 8], epd: [8, 12, 20], heat: 18, cool: 26 },
    HOME,
  ),
  space(
    'office',
    { rp: 10, ra: 0, density: [5, 9, 12], lpd: [6, 8, 12], epd: [8, 12, 15], heat: 21, cool: 24, dhw: 4 },
    {
      occupancy: 'uk-office-occ',
      lighting: 'office-light',
      equipment: 'office-equip',
      hvac: 'uk-office-hvac',
    },
  ),
];

export const typesGlobalLibrary: TypeLibrary = {
  spaceTypes: SPACE_TYPES_GLOBAL,
  schedules: SCHEDULES_GLOBAL,
  buildingTypes: [],
};

export const typesGlobalEngineModule: IbashoModule = {
  id: 'pack-types-global/engine',
  load: () => [...SCHEDULES_GLOBAL, ...SPACE_TYPES_GLOBAL],
};
