/**
 * Indian space types (WP-18): loads, ventilation, occupancy, set points and schedules, each value
 * a low, typical and high with its source (Sourced). Outdoor air from ASHRAE 62.1 Table 6-1 (NBC
 * Part 8 points to the same rates), densities from NBC Part 4 and ECBC defaults, lighting from
 * ECBC 2017 Table 6-2 levels, plug loads from the BT brief. Grades: `secondary` where a code table
 * gives the value, `estimate` otherwise.
 */
import type { Grade, Sourced, SourceRef, SpaceTypePlugin } from '@ibasho/core';
import { PROV, SRC } from './sources.ts';

const S = (
  low: number,
  typical: number,
  high: number,
  source: SourceRef,
  grade: Grade = 'estimate',
): Sourced => ({
  low,
  typical,
  high,
  source,
  grade,
});

interface Spec {
  conditioned: boolean;
  habitable: boolean;
  rp: [number, number, number];
  ra: [number, number, number];
  density: [number, number, number];
  lpd: [number, number, number];
  epd: [number, number, number];
  cool?: [number, number, number];
  heat?: [number, number, number];
  dhw?: [number, number, number];
  lux?: [number, number, number];
  /** Outdoor air changes per hour while running (labs). */
  ach?: [number, number, number];
  schedules: SpaceTypePlugin['schedules'];
}

const OFFICE = {
  occupancy: 'office-occ',
  lighting: 'office-light',
  equipment: 'office-equip',
  hvac: 'office-hvac',
};
const SCHOOL = {
  occupancy: 'school-occ',
  lighting: 'school-light',
  equipment: 'school-equip',
  hvac: 'school-hvac',
};
const LAB = { occupancy: 'lab-occ', lighting: 'office-light', equipment: 'lab-equip', hvac: 'lab-hvac' };
const UNCOND = {
  occupancy: 'office-occ',
  lighting: 'circulation-light',
  equipment: 'office-equip',
  hvac: 'none',
};

const SPECS: Record<string, Spec> = {
  office: {
    conditioned: true,
    habitable: true,
    rp: [2.5, 2.5, 2.5],
    ra: [0.3, 0.3, 0.3],
    density: [4, 6, 10],
    lpd: [6, 9.5, 12],
    epd: [8, 12, 18],
    lux: [300, 400, 500],
    dhw: [1, 2, 4],
    schedules: OFFICE,
  },
  'office-open': {
    conditioned: true,
    habitable: true,
    rp: [2.5, 2.5, 2.5],
    ra: [0.3, 0.3, 0.3],
    density: [8, 12, 20],
    lpd: [6, 9, 12],
    epd: [10, 15, 22],
    lux: [300, 400, 500],
    dhw: [1, 2, 4],
    schedules: OFFICE,
  },
  lab: {
    conditioned: true,
    habitable: true,
    rp: [5, 5, 5],
    ra: [0.9, 0.9, 0.9],
    density: [3, 5, 8],
    lpd: [8, 10, 14],
    epd: [12, 18, 30],
    lux: [400, 500, 750],
    dhw: [1, 3, 6],
    schedules: LAB,
  },
  /** Wet or chemistry lab with fume hoods: once-through outdoor air (ANSI/AIHA Z9.5). */
  'lab-wet': {
    conditioned: true,
    habitable: true,
    rp: [5, 5, 5],
    ra: [0.9, 0.9, 0.9],
    density: [3, 5, 8],
    lpd: [8, 10, 14],
    epd: [15, 25, 40],
    lux: [400, 500, 750],
    dhw: [2, 5, 10],
    ach: [4, 6, 8],
    schedules: LAB,
  },
  'lab-heavy': {
    conditioned: true,
    habitable: true,
    rp: [5, 5, 5],
    ra: [0.9, 0.9, 0.9],
    density: [2, 3, 5],
    lpd: [8, 10, 14],
    epd: [12, 20, 35],
    lux: [300, 400, 500],
    dhw: [1, 3, 6],
    ach: [2, 4, 6],
    schedules: LAB,
  },
  'data-centre': {
    conditioned: true,
    habitable: false,
    rp: [2.5, 2.5, 2.5],
    ra: [0.3, 0.3, 0.3],
    density: [0.5, 1, 2],
    lpd: [6, 10, 12],
    epd: [300, 450, 600],
    cool: [24, 25, 27],
    schedules: {
      occupancy: 'office-occ',
      lighting: 'office-light',
      equipment: 'always-equip',
      hvac: 'always',
    },
  },
  library: {
    conditioned: true,
    habitable: true,
    rp: [2.5, 2.5, 2.5],
    ra: [0.6, 0.6, 0.6],
    density: [5, 10, 20],
    lpd: [8, 10, 12],
    epd: [3, 5, 8],
    lux: [300, 400, 500],
    schedules: {
      occupancy: 'library-occ',
      lighting: 'office-light',
      equipment: 'office-equip',
      hvac: 'library-hvac',
    },
  },
  classroom: {
    conditioned: true,
    habitable: true,
    rp: [5, 5, 5],
    ra: [0.6, 0.6, 0.6],
    density: [25, 35, 50],
    lpd: [8, 10, 12],
    epd: [3, 6, 10],
    lux: [300, 300, 500],
    schedules: SCHOOL,
  },
  assembly: {
    conditioned: true,
    habitable: true,
    rp: [2.5, 2.5, 3.8],
    ra: [0.3, 0.3, 0.3],
    density: [50, 80, 150],
    lpd: [8, 10, 12],
    epd: [2, 4, 6],
    schedules: {
      occupancy: 'assembly-occ',
      lighting: 'school-light',
      equipment: 'school-equip',
      hvac: 'assembly-hvac',
    },
  },
  lobby: {
    conditioned: true,
    habitable: true,
    rp: [2.5, 2.5, 2.5],
    ra: [0.3, 0.3, 0.3],
    density: [5, 10, 30],
    lpd: [6, 8, 10],
    epd: [1, 2, 4],
    schedules: OFFICE,
  },
  bank: {
    conditioned: true,
    habitable: true,
    rp: [2.5, 2.5, 3.8],
    ra: [0.3, 0.3, 0.3],
    density: [5, 8, 15],
    lpd: [8, 10, 12],
    epd: [8, 12, 16],
    dhw: [1, 2, 4],
    schedules: OFFICE,
  },
  circulation: {
    conditioned: false,
    habitable: false,
    rp: [0, 0, 0],
    ra: [0.3, 0.3, 0.3],
    density: [0.5, 1, 3],
    lpd: [3, 5, 7],
    epd: [0, 0, 1],
    schedules: UNCOND,
  },
  stair: {
    conditioned: false,
    habitable: false,
    rp: [0, 0, 0],
    ra: [0.3, 0.3, 0.3],
    density: [0, 0.5, 1],
    lpd: [3, 4, 6],
    epd: [0, 0, 0.5],
    schedules: UNCOND,
  },
  'toilet-core': {
    conditioned: false,
    habitable: false,
    rp: [0, 0, 0],
    ra: [0.3, 0.3, 0.3],
    density: [0, 1, 2],
    lpd: [4, 6, 8],
    epd: [0, 0, 1],
    schedules: UNCOND,
  },
  plant: {
    conditioned: false,
    habitable: false,
    rp: [0, 0, 0],
    ra: [0.3, 0.3, 0.3],
    density: [0, 0, 0.5],
    lpd: [2, 3, 5],
    epd: [0, 0, 1],
    schedules: { ...UNCOND, equipment: 'always-equip' },
  },
  parking: {
    conditioned: false,
    habitable: false,
    rp: [0, 0, 0],
    ra: [0.75, 0.75, 0.75],
    density: [0, 0, 0.5],
    lpd: [1, 2, 3],
    epd: [0, 3, 5],
    schedules: { ...UNCOND, lighting: 'always-equip', equipment: 'always-equip' },
  },
  living: {
    conditioned: true,
    habitable: true,
    rp: [2.5, 2.5, 2.5],
    ra: [0.3, 0.3, 0.3],
    density: [2, 4, 6],
    lpd: [2, 3, 5],
    epd: [3, 5, 10],
    cool: [25, 26, 27],
    heat: [19, 21, 22],
    dhw: [10, 20, 35],
    schedules: {
      occupancy: 'home-occ',
      lighting: 'home-light',
      equipment: 'home-equip',
      hvac: 'living-ac',
      dhw: 'home-dhw',
    },
  },
  bedroom: {
    conditioned: true,
    habitable: true,
    rp: [2.5, 2.5, 2.5],
    ra: [0.3, 0.3, 0.3],
    density: [6, 9.5, 12],
    lpd: [2, 2.5, 4],
    epd: [1, 3, 5],
    cool: [24, 26, 27],
    heat: [16, 18, 20],
    dhw: [10, 20, 35],
    schedules: {
      occupancy: 'home-occ',
      lighting: 'home-light',
      equipment: 'home-equip',
      hvac: 'bedroom-ac',
      dhw: 'home-dhw',
    },
  },
  kitchen: {
    conditioned: true,
    habitable: true,
    rp: [2.5, 2.5, 2.5],
    ra: [0.3, 0.3, 0.3],
    density: [0, 1, 2],
    lpd: [4, 6, 8],
    epd: [8, 15, 25],
    cool: [26, 27, 28],
    heat: [18, 20, 21],
    schedules: { occupancy: 'home-occ', lighting: 'home-light', equipment: 'home-equip', hvac: 'none' },
  },
  'guest-room': {
    conditioned: true,
    habitable: true,
    rp: [2.5, 2.5, 2.5],
    ra: [0.3, 0.3, 0.3],
    density: [3, 5, 8],
    lpd: [5, 7, 10],
    epd: [4, 6, 10],
    dhw: [80, 120, 180],
    schedules: {
      occupancy: 'hotel-occ',
      lighting: 'home-light',
      equipment: 'home-equip',
      hvac: 'always',
      dhw: 'home-dhw',
    },
  },
  ward: {
    conditioned: true,
    habitable: true,
    rp: [2.5, 3, 5],
    ra: [0.3, 0.6, 0.9],
    density: [8, 12, 20],
    lpd: [8, 10, 12],
    epd: [8, 12, 20],
    dhw: [40, 60, 90],
    schedules: {
      occupancy: 'ward-occ',
      lighting: 'office-light',
      equipment: 'always-equip',
      hvac: 'always',
      dhw: 'home-dhw',
    },
  },
};

const SOURCE_FOR: Record<string, SourceRef> = {
  rp: SRC.ashrae621,
  ra: SRC.ashrae621,
  density: SRC.nbc,
  lpd: SRC.ecbc,
  epd: SRC.brief,
  cool: SRC.ecbc,
  heat: SRC.ecbc,
  dhw: SRC.brief,
  lux: SRC.ecbc,
};
const GRADE_FOR: Record<string, Grade> = {
  rp: 'secondary',
  ra: 'secondary',
  density: 'estimate',
  lpd: 'secondary',
  epd: 'estimate',
  cool: 'secondary',
  heat: 'estimate',
  dhw: 'estimate',
  lux: 'secondary',
};
const src = (k: string, v: [number, number, number]) =>
  S(v[0], v[1], v[2], SOURCE_FOR[k] as SourceRef, GRADE_FOR[k] as Grade);

export const SPACE_TYPES: SpaceTypePlugin[] = Object.entries(SPECS).map(([spaceTypeId, sp]) => ({
  kind: 'space-type',
  id: `types-in-space-${spaceTypeId}`,
  version: '0.1.0',
  title: `types.space.${spaceTypeId}`,
  side: 'both',
  regions: ['IN'],
  provenance: PROV,
  spaceTypeId,
  label: `types.space.${spaceTypeId}`,
  conditioned: sp.conditioned,
  habitable: sp.habitable,
  rpLsPerPerson: src('rp', sp.rp),
  raLsPerM2: src('ra', sp.ra),
  densityPer100m2: src('density', sp.density),
  lpdWm2: src('lpd', sp.lpd),
  epdWm2: src('epd', sp.epd),
  coolSetC: src('cool', sp.cool ?? [23, 24, 26]),
  heatSetC: src('heat', sp.heat ?? [18, 20, 21]),
  dhwLPerPersonDay: sp.dhw ? src('dhw', sp.dhw) : 'unknown',
  ...(sp.lux ? { daylightLux: src('lux', sp.lux) } : {}),
  ...(sp.ach ? { minAirChangesPerHour: S(sp.ach[0], sp.ach[1], sp.ach[2], SRC.z95, 'estimate') } : {}),
  schedules: sp.schedules,
}));
