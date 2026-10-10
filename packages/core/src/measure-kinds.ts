/**
 * Measure kinds used by rules (`Rule.measures`) and by `MeasureModel.measureKind`. Owner: WP-00.
 * Kinds are physical categories that rules talk about; measure and option ids (packs/home-uk/src/ids.ts)
 * are product choices. One measure has exactly one kind.
 */
export const MEASURE_KINDS = [
  'loft',
  'roof-insulation',
  'cavity',
  'ewi',
  'iwi',
  'floor',
  'draught',
  'glazing-double',
  'glazing-secondary',
  'glazing-film',
  'controls',
  'mvhr',
  'ashp',
  'gshp',
  'radiators',
  'cylinder',
  'cylinder-jacket',
  'hob',
  'gas-disconnect',
  'pv',
  'battery',
  'solar-thermal',
  'cool-roof',
  'shading',
  'ac-upgrade',
  'fans',
  'swh',
  'wall-reskin',
] as const;
export type MeasureKind = (typeof MEASURE_KINDS)[number];
