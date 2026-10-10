/**
 * Engine half of pack `home-uk`. Owner: WP-01.
 * Every SPEC 9 measure model (ids equal to `../ids.ts`, checked by test), UK systems and the
 * SPEC 14 maintenance decay models.
 * PLACEHOLDER: RdSAP 10 construction plugins and archetypes with `seed()` (stranger homes, AC-SG1)
 * are not built yet; `cylinder-jacket` and `solar-thermal` patch nothing until the twin describes
 * cylinders and collectors.
 */
import { ashpMeasure, draughtMeasure, loftMeasure } from './measures/index.ts';

/** The M-0 measure models (loft, draught, ASHP), kept for the M-0 option set. */
export const M0_MEASURES = [ashpMeasure, draughtMeasure, loftMeasure] as const;

export {
  draughtDecay,
  gasBoilerDecay,
  heatPumpDecay,
  UK_MAINTENANCE,
} from './maintenance/index.ts';
export {
  addLayer,
  junctionChanges,
} from './measures/common.ts';
export * from './measures/index.ts';
export { pvRoof } from './measures/pv.ts';
export { default as homeUkEngineModule } from './module.ts';
export {
  ashpSystem,
  directElectric,
  electricImmersion,
  gasCombiCondensing,
  gasNonCondensing,
  gasRegularCondensing,
  oilBoiler,
  UK_SYSTEMS,
} from './systems.ts';
