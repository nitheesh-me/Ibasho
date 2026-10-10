/**
 * `measure-ui` for every home-uk measure id (ARCH 5.6, BUILD_PLAN 2 "one measure, five owners,
 * one id"): the mon crest and how the measure folds onto the house in the fold-assembly layer.
 * Owner: WP-07. Pure data.
 *
 * Mon ids are keys of `MONS` in `@ibasho/ui` (`packages/ui/src/mon/set.ts`, DESIGN_SYSTEM 7).
 * The hob sub-measure is induction plus gas disconnect, so it takes `gas-disconnect`. Fold targets
 * are twin element kinds (`roof`, `wall`, `floor`, `window`, `door`), plus `system` for plant
 * the scene draws as props rather than as fabric (heat pump, cylinder, hob, controls, battery,
 * MVHR unit).
 */
import type { FoldSpec, MeasureUi, MonId } from '@ibasho/core';
import { MEASURE_IDS, type MeasureId } from '../ids.ts';

/** One `--t-ori` crease (DESIGN_SYSTEM 6: 900 ms). */
const ORI_MS = 900;

const fold = (kind: FoldSpec['kind'], targets: string[], creases = 1): FoldSpec => ({
  kind,
  targets,
  durationMs: ORI_MS * creases,
});

/** Mon and fold per measure. Same mon for the two solid wall routes, as DESIGN_SYSTEM 7 says. */
export const MEASURE_PRESENTATION: Readonly<Record<MeasureId, { mon: MonId; fold: FoldSpec }>> = {
  loft: { mon: 'loft', fold: fold('lay', ['roof']) },
  'wall-ewi': { mon: 'wall', fold: fold('wrap', ['wall'], 2) },
  'wall-iwi': { mon: 'wall', fold: fold('slide', ['wall'], 2) },
  floor: { mon: 'floor', fold: fold('lay', ['floor']) },
  draught: { mon: 'draught', fold: fold('slide', ['door', 'window']) },
  'glazing-secondary': { mon: 'glazing', fold: fold('slide', ['window']) },
  'glazing-double': { mon: 'glazing', fold: fold('swap', ['window']) },
  controls: { mon: 'controls', fold: fold('mount', ['system']) },
  mvhr: { mon: 'mvhr', fold: fold('mount', ['system', 'wall']) },
  ashp: { mon: 'heat-pump', fold: fold('swap', ['system'], 2) },
  pv: { mon: 'pv', fold: fold('lay', ['roof']) },
  battery: { mon: 'battery', fold: fold('mount', ['system']) },
  'cylinder-jacket': { mon: 'cylinder', fold: fold('wrap', ['system']) },
  'solar-thermal': { mon: 'solar-thermal', fold: fold('lay', ['roof']) },
  cylinder: { mon: 'cylinder', fold: fold('swap', ['system']) },
  'hob-induction': { mon: 'gas-disconnect', fold: fold('swap', ['system']) },
};

/** Every mon id this pack names (for the icon set contract test). */
export const HOME_UK_MON_IDS: readonly MonId[] = [
  ...new Set(MEASURE_IDS.map((m) => MEASURE_PRESENTATION[m].mon)),
].sort();

export function measureUiId(measureId: string): string {
  return `home-uk.measure-ui.${measureId}`;
}

/** The `measure-ui` plugins, one per measure id, in `MEASURE_IDS` order. */
export const HOME_UK_MEASURE_UI: readonly MeasureUi[] = MEASURE_IDS.map((m) => ({
  kind: 'measure-ui',
  id: measureUiId(m),
  version: '0.1.0',
  title: `measure.${m}.title`,
  regions: ['GB'],
  side: 'ui',
  measureId: m,
  mon: MEASURE_PRESENTATION[m].mon,
  fold: MEASURE_PRESENTATION[m].fold,
}));
