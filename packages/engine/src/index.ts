/**
 * @ibasho/engine public entry. Owner: WP-02 (this file); the pipeline (WP-01) and rules (WP-03)
 * surfaces are re-exported from their owners' barrels.
 *
 * Apps use `exposeEngine` in their worker and talk to it through Comlink (`EngineApi` in
 * `@ibasho/core`). Node callers (tests, the CI proxy, `pnpm m0`) use `createEngine` directly.
 */
export { createEngine, type Engine, EngineNotReady, type EngineOptions, NotImplementedYet } from './api.ts';
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
