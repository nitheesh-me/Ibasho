/**
 * en-GB measure names and synonyms, keyed by the frozen ids in `packs/home-uk/src/ids.ts`.
 *
 * LOCAL ADAPTER. `@ibasho/ai` may not depend on a pack (ARCH 3: ai imports L0), and the real display
 * names live in the pack ui halves (`measure-ui`, WP-07) and `packages/content` (WP-09). Until a
 * catalogue reaches ai through the narrator registry, this table is the source for `[[m:..]]`
 * display, the intent parser and G6. `test/measures.test.ts` checks it against `ids.ts`.
 */

export interface MeasureEntry {
  /** Measure id (`loft`, `ashp`, ...). */
  id: string;
  /** Display name, lower case, used mid-sentence. */
  name: string;
  /** Option ids with their display names. */
  options: Record<string, string>;
  /** Words people use for it (lower case, longest first is not required). */
  synonyms: string[];
}

export const MEASURE_CATALOGUE: readonly MeasureEntry[] = [
  {
    id: 'loft',
    name: 'loft insulation',
    options: { 'loft-270': '270 mm loft insulation', 'loft-300': '300 mm loft insulation' },
    synonyms: [
      'loft insulation',
      'loft',
      'attic insulation',
      'attic',
      'roof insulation',
      'insulate the roof',
    ],
  },
  {
    id: 'wall-ewi',
    name: 'external wall insulation',
    options: { 'wall-ewi-100': '100 mm external wall insulation' },
    synonyms: [
      'external wall insulation',
      'external insulation',
      'outside wall insulation',
      'insulate the outside',
      'ewi',
      'render',
    ],
  },
  {
    id: 'wall-iwi',
    name: 'internal wall insulation',
    options: { 'wall-iwi-woodfibre': 'wood fibre internal wall insulation' },
    synonyms: [
      'internal wall insulation',
      'internal insulation',
      'inside wall insulation',
      'insulate the inside',
      'iwi',
      'wood fibre',
    ],
  },
  {
    id: 'floor',
    name: 'floor insulation',
    options: { 'floor-suspended-insulation': 'suspended timber floor insulation' },
    synonyms: ['floor insulation', 'underfloor insulation', 'insulate the floor', 'floor', 'floorboards'],
  },
  {
    id: 'draught',
    name: 'draught-proofing',
    options: { 'draught-proofing-chimney-balloon': 'draught-proofing and a chimney balloon' },
    synonyms: [
      'draught-proofing',
      'draught proofing',
      'draughtproofing',
      'draughts',
      'chimney balloon',
      'draft proofing',
      'draughty',
      'drafty',
      'chimney',
    ],
  },
  {
    id: 'glazing-secondary',
    name: 'secondary glazing',
    options: { 'glazing-secondary-lowe': 'low-E secondary glazing' },
    synonyms: ['secondary glazing', 'secondary windows'],
  },
  {
    id: 'glazing-double',
    name: 'double glazing',
    options: { 'glazing-double-a': 'A-rated double glazing' },
    synonyms: ['double glazing', 'double-glazing', 'new windows', 'windows', 'glazing'],
  },
  {
    id: 'controls',
    name: 'heating controls',
    options: { 'controls-trv-weather-comp': 'radiator valves and weather compensation' },
    synonyms: [
      'heating controls',
      'controls',
      'trvs',
      'trv',
      'thermostatic valves',
      'thermostatic radiator valves',
      'weather compensation',
      'smart thermostat',
    ],
  },
  {
    id: 'mvhr',
    name: 'heat recovery ventilation',
    options: { 'vent-mvhr': 'mechanical ventilation with heat recovery' },
    synonyms: ['mvhr', 'heat recovery ventilation', 'heat recovery', 'mechanical ventilation'],
  },
  {
    id: 'ashp',
    name: 'air source heat pump',
    options: {
      'heat-ashp': 'air source heat pump',
      'heat-ashp-radiators-plus': 'heat pump with larger radiators',
    },
    synonyms: ['air source heat pump', 'heat pump', 'ashp', 'heatpump'],
  },
  {
    id: 'pv',
    name: 'solar panels',
    options: {
      'pv-2kwp': '2 kWp solar panels',
      'pv-3kwp': '3 kWp solar panels',
      'pv-4kwp': '4 kWp solar panels',
    },
    synonyms: ['solar panels', 'solar pv', 'pv', 'solar', 'photovoltaics', 'panels on the roof'],
  },
  {
    id: 'battery',
    name: 'home battery',
    options: { 'battery-5kwh': '5 kWh home battery', 'battery-10kwh': '10 kWh home battery' },
    synonyms: ['home battery', 'battery', 'batteries', 'powerwall'],
  },
  {
    id: 'cylinder-jacket',
    name: 'cylinder jacket',
    options: { 'cylinder-jacket': 'hot water cylinder jacket' },
    synonyms: ['cylinder jacket', 'tank jacket', 'lagging'],
  },
  {
    id: 'solar-thermal',
    name: 'solar hot water',
    options: { 'solar-thermal-3m2': '3 m² solar hot water panels' },
    synonyms: ['solar thermal', 'solar hot water', 'solar water heating'],
  },
  {
    id: 'cylinder',
    name: 'hot water cylinder',
    options: { 'cylinder-new': 'new hot water cylinder' },
    synonyms: ['hot water cylinder', 'cylinder', 'hot water tank'],
  },
  {
    id: 'hob-induction',
    name: 'induction hob',
    options: { 'hob-induction-gas-disconnect': 'induction hob and gas disconnection' },
    synonyms: ['induction hob', 'induction', 'electric hob', 'disconnect the gas', 'gas disconnection'],
  },
];

const BY_ID = new Map<string, MeasureEntry>();
const BY_OPTION = new Map<string, MeasureEntry>();
for (const m of MEASURE_CATALOGUE) {
  BY_ID.set(m.id, m);
  for (const o of Object.keys(m.options)) BY_OPTION.set(o, m);
}

/** Measure that owns a measure or option id. */
export function measureOf(id: string): MeasureEntry | undefined {
  return BY_ID.get(id) ?? BY_OPTION.get(id);
}

/** Display name of a measure or option id, or undefined when unknown. */
export function measureName(id: string): string | undefined {
  const m = BY_ID.get(id);
  if (m) return m.name;
  return BY_OPTION.get(id)?.options[id];
}

/** All (synonym, measure id) pairs, longest synonym first, for greedy matching. */
export const SYNONYMS: readonly { phrase: string; measureId: string }[] = MEASURE_CATALOGUE.flatMap((m) =>
  m.synonyms.map((phrase) => ({ phrase, measureId: m.id })),
).sort((a, b) => b.phrase.length - a.phrase.length || (a.phrase < b.phrase ? -1 : 1));
