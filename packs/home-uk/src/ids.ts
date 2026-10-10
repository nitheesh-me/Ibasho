/**
 * Measure and option ids for the UK home pack (SPEC 9, BUILD_PLAN 2 "one measure, five owners,
 * one id"). Owner: WP-01. Created by WP-00 at G0; frozen at M-0 (changes go through INTERFACES).
 *
 * Joined by id:
 * - physics model (`measure`, WP-01, `src/engine/measures/`), id = measure id
 * - cost (`measure-cost`, WP-02, `packs/money-uk/src/costs/`), keyed by option id
 * - applicability and regulatory facts (`APPL.*` rules, WP-03, `packs/rules-uk/src/`)
 * - presentation (`measure-ui`, WP-07, `src/ui/`), `measureId` = measure id
 * - disruption and next step (WP-09, `packages/content/measures/`), keyed by measure id
 *
 * Pure data: importable from both the engine and the ui halves. Ids are kebab-case (ARCH 12).
 */

/** Choice groups. Heavy groups change demand and run full physics; light groups reuse it (SPEC R9). */
export const GROUPS = {
  loft: { weight: 'heavy' },
  wall: { weight: 'heavy' },
  floor: { weight: 'heavy' },
  draught: { weight: 'heavy' },
  glazing: { weight: 'heavy' },
  controls: { weight: 'heavy' },
  vent: { weight: 'heavy' },
  heat: { weight: 'light' },
  pv: { weight: 'light' },
  battery: { weight: 'light' },
  cylinder: { weight: 'light' },
  'solar-thermal': { weight: 'light' },
} as const;
export type GroupId = keyof typeof GROUPS;

/** Sub-measure groups chosen inside a light option (SPEC 9: cylinder with a heat pump, hob sub-choice). */
export const SUB_GROUPS = {
  'sub-cylinder': { parent: 'heat' },
  'sub-hob': { parent: 'heat' },
} as const;
export type SubGroupId = keyof typeof SUB_GROUPS;

/**
 * Measures. `kind` is the `MeasureKind` that rules talk about (one kind per measure).
 * Option order is the display order. The empty choice `none` is implicit in every group.
 */
export const MEASURES = {
  loft: { group: 'loft', kind: 'loft', options: ['loft-270', 'loft-300'] },
  'wall-ewi': { group: 'wall', kind: 'ewi', options: ['wall-ewi-100'] },
  'wall-iwi': { group: 'wall', kind: 'iwi', options: ['wall-iwi-woodfibre'] },
  floor: { group: 'floor', kind: 'floor', options: ['floor-suspended-insulation'] },
  draught: { group: 'draught', kind: 'draught', options: ['draught-proofing-chimney-balloon'] },
  'glazing-secondary': { group: 'glazing', kind: 'glazing-secondary', options: ['glazing-secondary-lowe'] },
  'glazing-double': { group: 'glazing', kind: 'glazing-double', options: ['glazing-double-a'] },
  controls: { group: 'controls', kind: 'controls', options: ['controls-trv-weather-comp'] },
  mvhr: { group: 'vent', kind: 'mvhr', options: ['vent-mvhr'] },
  ashp: { group: 'heat', kind: 'ashp', options: ['heat-ashp', 'heat-ashp-radiators-plus'] },
  pv: { group: 'pv', kind: 'pv', options: ['pv-2kwp', 'pv-3kwp', 'pv-4kwp'] },
  battery: { group: 'battery', kind: 'battery', options: ['battery-5kwh', 'battery-10kwh'] },
  'cylinder-jacket': { group: 'cylinder', kind: 'cylinder-jacket', options: ['cylinder-jacket'] },
  'solar-thermal': { group: 'solar-thermal', kind: 'solar-thermal', options: ['solar-thermal-3m2'] },
  // Sub-measures (SPEC 9): a heat pump replacing a combi brings a cylinder; the hob sub-choice is
  // "keep gas hob" (none) or "induction hob plus gas disconnect" (removes the gas standing charge).
  cylinder: { group: 'sub-cylinder', kind: 'cylinder', options: ['cylinder-new'] },
  'hob-induction': { group: 'sub-hob', kind: 'hob', options: ['hob-induction-gas-disconnect'] },
} as const;
export type MeasureId = keyof typeof MEASURES;
export type OptionId = (typeof MEASURES)[MeasureId]['options'][number];

/** Costed assessments that rules oblige (SPEC 9: `ENG.MOIST.IWI`, `UK.PAS2035`). Costed by WP-02. */
export const ASSESSMENTS = ['assess-moisture', 'assess-pas2035'] as const;
export type AssessmentId = (typeof ASSESSMENTS)[number];

/** DHW system classes that key heavy simulations (ARCH 6 factorisation assumption). */
export const DHW_CLASSES = ['combi', 'cylinder'] as const;

export const MEASURE_IDS = Object.keys(MEASURES) as MeasureId[];
export const OPTION_IDS: readonly OptionId[] = MEASURE_IDS.flatMap((m) => MEASURES[m].options);

/** Measure id that owns an option id. */
export function measureOfOption(optionId: string): MeasureId | undefined {
  return MEASURE_IDS.find((m) => (MEASURES[m].options as readonly string[]).includes(optionId));
}
