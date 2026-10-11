/**
 * @ibasho/engine public entry. Owner: WP-02 (this file); the pipeline (WP-01) and rules (WP-03)
 * surfaces are re-exported from their owners' barrels.
 *
 * Apps use `exposeEngine` in their worker and talk to it through Comlink (`EngineApi` in
 * `@ibasho/core`). Node callers (tests, the CI proxy, `pnpm m0`) use `createEngine` directly.
 */
export { createEngine, type Engine, EngineNotReady, type EngineOptions, NotImplementedYet } from './api.ts';
// Real codes stage (WP-19, V-5): swap `codes: 'preview.codes'` for `'real.codes'` in the manifest.
export {
  type CodesCatalogue,
  computeRealCodes,
  createRealCodesProvider,
  evaluateCodes,
  REAL_CODES_VERSION,
} from './codes/index.ts';
// Real energy stage (WP-18, V-4): swap `energy: 'preview.energy'` for `'real.energy'` in the manifest.
export {
  coarseBuilding,
  computeRealEnergy,
  createRealEnergyProvider,
  REAL_ENERGY_VERSION,
  runEnergyModel,
} from './enduse/index.ts';
export { addBookkeeping, bookkeepingDrafts } from './evidence/index.ts';
export { addOutcomes, negativesOf, outcomeDrafts } from './evidence/outcomes.ts';
export * from './finance/index.ts';
export {
  DISCOUNT_STEP_PPB,
  FlipError,
  type FlipOptions,
  type FlipParam,
  flipAt,
  flips,
} from './flips/index.ts';
export * from './pipeline/index.ts';
export * from './rules/index.ts';
export * from './score/index.ts';
export * from './search/index.ts';
export { type ExposedEngine, exposedEngine, exposeEngine } from './worker.ts';
