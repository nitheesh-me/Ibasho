/**
 * Preview load intensities per space type (estimates from BE and BT briefs: BEE and ECBC
 * defaults, typical Indian institutional schedules). Used only by the Preview model; the real
 * values come from `types-in` and `types-global` packs at V-4 (WP-18).
 */
export interface SpaceLoads {
  /** Lighting and equipment power density, W/m². */
  lpd: number;
  epd: number;
  /** Occupied hours per day and days per week. */
  hours: number;
  days: number;
  /** People per m² (for hot water and latent load). */
  occ: number;
  conditioned: boolean;
  /** Share of the year the cooling runs while occupied (residential AC is partial). */
  acShare: number;
  /** Follows the academic calendar (summer vacation in May and June, winter break). */
  term?: boolean;
}

/** Monthly use on the Indian academic calendar (estimate: May vacation, June partial, December break). */
export const ACADEMIC_TERM = [1, 1, 1, 0.9, 0.2, 0.5, 1, 1, 1, 1, 0.9, 0.8];

const L = (
  lpd: number,
  epd: number,
  hours: number,
  days: number,
  occ: number,
  conditioned = true,
  acShare = 1,
): SpaceLoads => ({
  lpd,
  epd,
  hours,
  days,
  occ,
  conditioned,
  acShare,
});

export const SPACE_LOADS: Readonly<Record<string, SpaceLoads>> = {
  office: L(9.5, 12, 10, 5.5, 0.08),
  'office-open': L(9, 15, 10, 5.5, 0.12),
  lab: L(10, 18, 12, 5.5, 0.06),
  'lab-heavy': L(10, 20, 9, 5.5, 0.04),
  'data-centre': L(10, 450, 24, 7, 0.01),
  library: L(10, 5, 12, 6.5, 0.1),
  classroom: { ...L(10, 6, 7, 5.5, 0.5), term: true },
  assembly: { ...L(10, 4, 4, 5, 0.8), term: true },
  lobby: L(8, 2, 14, 7, 0.05),
  bank: L(10, 12, 9, 6, 0.1),
  circulation: L(5, 0, 12, 7, 0.02, false),
  stair: L(4, 0, 12, 7, 0.01, false),
  'toilet-core': L(6, 0, 12, 7, 0.02, false),
  plant: L(3, 0, 24, 7, 0, false),
  parking: L(2, 3, 24, 7, 0, false),
  living: L(3, 8, 8, 7, 0, true, 0.35),
  bedroom: L(2.5, 3, 5, 7, 0.095, true, 0.5),
  kitchen: L(6, 15, 3, 7, 0, true, 0.2),
};

/** Spaces people use for long periods: daylight metrics apply only to these (SD 6, LEED). */
export const REGULARLY_OCCUPIED: ReadonlySet<string> = new Set([
  'office',
  'office-open',
  'lab',
  'lab-heavy',
  'library',
  'classroom',
  'assembly',
  'bank',
  'living',
  'bedroom',
  'kitchen',
]);

/** Dwelling space types (domestic hot water, LT-I tariff). */
export const DWELLING: ReadonlySet<string> = new Set(['living', 'bedroom', 'kitchen']);

/** Untyped rooms use office loads and widen the EUI range (R33, AC-NW2). */
export const UNTYPED: SpaceLoads = SPACE_LOADS['office'] as SpaceLoads;
export const loadsFor = (spaceTypeId: string | undefined): { loads: SpaceLoads; typed: boolean } => {
  const l = spaceTypeId ? SPACE_LOADS[spaceTypeId] : undefined;
  return l ? { loads: l, typed: true } : { loads: UNTYPED, typed: false };
};
