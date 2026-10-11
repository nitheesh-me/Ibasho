/**
 * Copy for the eight building types (SPEC 18.1, DESIGN_SYSTEM 13.4). Owner: WP-09.
 *
 * What a person reads when choosing or looking at a type: its name, a one line picture of how it
 * is used, who uses it, what matters most in its energy, and which goals people usually set.
 * Keyed by `BuildingTypeId`, so a new type fails typecheck until it has words.
 */
import type { BuildingTypeId } from '@ibasho/core';

export interface BuildingTypeCopy {
  id: BuildingTypeId;
  /** Singular label, sentence case. */
  label: string;
  /** Singular in running text ("1 apartment building"). */
  one: string;
  /** Plural, for lists and counts ("3 offices"). */
  plural: string;
  /** How the building is used, in one sentence. */
  blurb: string;
  /** Who is inside, as a plural noun ("staff", "guests"). */
  people: string;
  /** What usually matters most in its energy, in one sentence. */
  watch: string;
  /** Goals people often set for this type, as labels. */
  usualGoals: readonly string[];
}

export const BUILDING_TYPE_COPY: Readonly<Record<BuildingTypeId, BuildingTypeCopy>> = {
  office: {
    id: 'office',
    one: 'office',
    label: 'Office',
    plural: 'offices',
    blurb: 'Desks, meeting rooms and a core. Busy on weekdays, quiet at night.',
    people: 'staff',
    watch: 'Cooling, lighting and computers by day, and glare at desks near west glass.',
    usualGoals: ['Lowest running cost', 'ECSBC Super', 'LEED Gold'],
  },
  hotel: {
    id: 'hotel',
    one: 'hotel',
    label: 'Hotel',
    plural: 'hotels',
    blurb: 'Guest rooms full at night, with a lobby, kitchen and laundry busy by day.',
    people: 'guests',
    watch: 'Hot water, cooling around the clock and the kitchen.',
    usualGoals: ['Lowest running cost', 'LEED Gold'],
  },
  education: {
    id: 'education',
    one: 'school or college',
    label: 'School or college',
    plural: 'schools and colleges',
    blurb: 'Classrooms, labs and a library. Term dates shape the year.',
    people: 'students and staff',
    watch: 'Daylight in classrooms, fan-first comfort and the hours rooms stand empty.',
    usualGoals: ['ECSBC Super', 'Lowest running cost'],
  },
  hospital: {
    id: 'hospital',
    one: 'hospital',
    label: 'Hospital',
    plural: 'hospitals',
    blurb: 'Wards around the clock, with theatres and clinics busy by day.',
    people: 'patients and staff',
    watch: 'Fresh air, cooling and hot water that never stop, and backup power.',
    usualGoals: ['Lowest running cost', 'ECSBC Super'],
  },
  lab: {
    id: 'lab',
    one: 'laboratory',
    label: 'Laboratory',
    plural: 'laboratories',
    blurb: 'Fume cupboards and lots of fresh air, often with equipment running late.',
    people: 'researchers',
    watch: 'Fans and the energy spent cooling or heating fresh air.',
    usualGoals: ['Lowest running cost', 'LEED Gold'],
  },
  apartments: {
    id: 'apartments',
    one: 'apartment building',
    label: 'Apartments',
    plural: 'apartment buildings',
    blurb: 'Many homes stacked, busiest in the mornings and evenings.',
    people: 'residents',
    watch: 'Heat through walls and windows, the top floor in summer, and bills for each flat.',
    usualGoals: ['Lowest running cost', 'Future Homes Standard'],
  },
  rental: {
    id: 'rental',
    one: 'rented home',
    label: 'Rented home',
    plural: 'rented homes',
    blurb: 'A home someone else owns, where who pays and who decides are different people.',
    people: 'tenants',
    watch: 'Changes a tenant can make, what to ask the landlord, and a fair split of the gains.',
    usualGoals: ['Lowest running cost'],
  },
  'single-family': {
    id: 'single-family',
    one: 'house',
    label: 'House',
    plural: 'houses',
    blurb: 'One household under one roof.',
    people: 'the household',
    watch: 'Heating or cooling, hot water and the bills that follow.',
    usualGoals: ['Lowest running cost', 'Net zero ready', 'Future Homes Standard'],
  },
};

/** The label for a type, or a plain fallback for an id we do not know. */
export function typeLabel(id: string): string {
  return (BUILDING_TYPE_COPY as Record<string, BuildingTypeCopy>)[id]?.label ?? 'Building';
}

/** "1 office", "3 offices", "2 schools and colleges". */
export function countOf(id: BuildingTypeId, n: number): string {
  const c = BUILDING_TYPE_COPY[id];
  return `${n} ${n === 1 ? c.one : c.plural}`;
}

/**
 * A room label, function first, then its name when it has one (PLAN-V3 8):
 * `roomLabel('Library', 'IIIT Library')` is "Library, IIIT Library".
 */
export function roomLabel(fn: string, name?: string): string {
  const n = name?.trim();
  return n && n.toLowerCase() !== fn.trim().toLowerCase() ? `${fn}, ${n}` : fn;
}
