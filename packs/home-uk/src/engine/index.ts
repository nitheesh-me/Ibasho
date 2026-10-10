/**
 * Engine half of pack `home-uk`. Owner: WP-01.
 * M-0: measure models for loft, draught and ASHP (ids equal to `../ids.ts`, checked by test), and UK systems.
 * PLACEHOLDER until M-A: RdSAP 10 constructions, K1 junctions, archetypes with `seed()`, the other
 * nine measure groups and `junctionEffects`.
 */
import { ashpMeasure } from './measures/ashp.ts';
import { draughtMeasure } from './measures/draught.ts';
import { loftMeasure } from './measures/loft.ts';

/** The M-0 measure models, in id order. */
export const M0_MEASURES = [ashpMeasure, draughtMeasure, loftMeasure] as const;

export { default as homeUkEngineModule } from './module.ts';
export { ashpSystem, gasCombiCondensing, UK_SYSTEMS } from './systems.ts';
export { ashpMeasure, draughtMeasure, loftMeasure };
