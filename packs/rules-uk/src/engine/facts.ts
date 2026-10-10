/**
 * Option facts (`m.*`) the rules-uk rules read (RP 4 "ASHP siting", "Fabric"). Owner: WP-03.
 *
 * Measure models (WP-01, `MeasureModel.facts`) emit these; a fact a model does not emit is unknown,
 * and the rule reads it at its worst case (a consent is listed, a block becomes needs-check).
 * Units: metres, cubic metres, watts; shares are fractions 0 to 1.
 */
export const OPTION_FACTS: Readonly<
  Record<string, { kinds: readonly string[]; type: string; meaning: string }>
> = {
  'm.wall.share': {
    kinds: ['ewi', 'iwi'],
    type: 'number',
    meaning: 'share of the external wall area treated (0 to 1)',
  },
  'm.ewi.renovatedM2': { kinds: ['ewi'], type: 'number', meaning: 'wall area renovated, m2' },
  'm.iwi.renovatedM2': { kinds: ['iwi'], type: 'number', meaning: 'wall area renovated, m2' },
  'm.cavity.renovatedM2': { kinds: ['cavity'], type: 'number', meaning: 'wall area filled, m2' },
  'm.roof-insulation.renovatedM2': {
    kinds: ['roof-insulation'],
    type: 'number',
    meaning: 'roof area renovated, m2',
  },
  'm.ewi.finish': {
    kinds: ['ewi'],
    type: "'render' | 'stone' | 'pebbledash' | 'timber' | 'plastic' | 'tiles' | 'brick-slip'",
    meaning: 'the new external finish',
  },
  'm.ewi.matches': {
    kinds: ['ewi'],
    type: 'Tri',
    meaning: 'the finish is similar in appearance to the existing walls (GPDO Pt1 A.3(a))',
  },
  'm.glazing.share': {
    kinds: ['glazing-double'],
    type: 'number',
    meaning: 'share of windows replaced (0 to 1)',
  },
  'm.pv.mount': { kinds: ['pv'], type: "'roof' | 'wall' | 'flat'", meaning: 'where the panels go' },
  'm.pv.frontsHighway': { kinds: ['pv'], type: 'Tri', meaning: 'wall panels front a highway' },
  'm.pv.projectionM': { kinds: ['pv'], type: 'number', meaning: 'projection from the roof slope or wall, m' },
  'm.pv.exportW': { kinds: ['pv'], type: 'number', meaning: 'inverter export capacity, W' },
  'm.battery.exportW': { kinds: ['battery'], type: 'number', meaning: 'battery inverter export capacity, W' },
  'm.ashp.noise': {
    kinds: ['ashp'],
    type: 'string',
    meaning: 'MCS 020 a) inputs, `noiseFact(twin, units)` from @ibasho/engine',
  },
  'm.ashp.volumeM3': { kinds: ['ashp'], type: 'number', meaning: 'outdoor unit volume, m3' },
  'm.ashp.units': { kinds: ['ashp'], type: 'number', meaning: 'number of outdoor units' },
  'm.ashp.mount': {
    kinds: ['ashp'],
    type: "'ground' | 'wall' | 'flat-roof' | 'pitched-roof'",
    meaning: 'mounting',
  },
  'm.ashp.edgeDistM': { kinds: ['ashp'], type: 'number', meaning: 'distance to the flat roof edge, m' },
  'm.ashp.frontsHighway': { kinds: ['ashp'], type: 'Tri', meaning: 'on a wall or roof fronting a highway' },
  'm.ashp.nearerHighway': { kinds: ['ashp'], type: 'Tri', meaning: 'nearer the highway than the house' },
  'm.ashp.coolingOnly': { kinds: ['ashp'], type: 'Tri', meaning: 'used for cooling only' },
  'm.ashp.boundaryDistM': {
    kinds: ['ashp'],
    type: 'number',
    meaning: 'distance to the property boundary, m (rule retired 2025-05-28)',
  },
  'm.loft.accessible': { kinds: ['loft'], type: 'Tri', meaning: 'the loft can be reached and boarded' },
  'm.draught.openChimneys': {
    kinds: ['draught'],
    type: 'number',
    meaning: 'open chimneys sealed by the option',
  },
};
