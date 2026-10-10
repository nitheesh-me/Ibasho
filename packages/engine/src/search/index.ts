/**
 * Search (SPEC R7 to R9, ARCH 6). Owner: WP-02.
 */
export {
  type BookkeepCtx,
  BookkeepingError,
  bookkeep,
  type OptionCost,
  optionCosts,
  type RowMoney,
} from './bookkeeping.ts';
export { type CertInput, ENGINE_VERSION, emitCertificate, flatFuelMonth } from './certificate.ts';
export { ageSeries, DoNothingError, matchModels, runDoNothing } from './do-nothing.ts';
export { envFromRegistry, type SearchEnv, SearchEnvError } from './env.ts';
export {
  type ExtrasInput,
  type RowExtras,
  type RowReturns,
  type RuleRisk,
  riskOfRule,
  rowExtras,
  rowReturns,
  ruleRisks,
  zoneOf,
} from './extras.ts';
export { dominates, NO_WITNESS, type Outcome, type Picks, paretoFront, picks, witnesses } from './pareto.ts';
export {
  BASELINE_ID,
  type GroupPlan,
  M0_OPTION_IDS,
  NONE,
  packageId,
  planGroups,
  rowChoice,
  rowPackage,
  SearchPlanError,
} from './plan.ts';
export {
  addPackageEvidence,
  BUILTIN_MEMORY,
  BUILTIN_TARGET,
  meetsTarget,
  type ProgressFn,
  runSearch,
  SearchError,
  type SearchState,
} from './run.ts';
export { SearchCancelled, Slicer, yieldMacrotask } from './slicer.ts';
export { base64, decodeI64, decodeU8, decodeU32, fromBase64, i64b64, u8b64, u32b64 } from './wire.ts';
