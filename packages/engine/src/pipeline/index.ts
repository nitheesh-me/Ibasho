/**
 * Pipeline runner public surface. Owner: WP-01.
 * WP-02 (api, search) calls these; it never reorders stages (BUILD_PLAN 2).
 */

export {
  createDefaultStages,
  type Household,
  household,
  offPeriodReduction,
  PHYSICS_DEFAULTS,
  type PhysicsDefaults,
  PhysicsError,
  QuantiseError,
  quantiseWh,
  type StageSet,
  sapControlType,
  sapOccupancy,
} from '../physics/index.ts';
export {
  applyPatch,
  composePatches,
  isLightPath,
  PatchError,
  packagePatch,
  parsePointer,
  splitPatch,
} from './patch.ts';
export {
  type HeavyRun,
  type LightRun,
  makeSimFn,
  type PipelineConfig,
  PipelineError,
  type RunOpts,
  runHeavy,
  runLight,
  type SimRun,
  simulate,
  simulateBundle,
} from './runner.ts';
