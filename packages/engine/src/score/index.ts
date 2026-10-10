/**
 * Score and estimated EPC band (SPEC R2 to R5, section 8; SF 2 and 3). Owner: WP-02.
 * Exact rationals with every constant from `@ibasho/spec-gen`; inputs from the standard run;
 * the band from the rating run through the `epc-proxy` plugin, always one band either side.
 */
export {
  BANDS,
  bandRank,
  type EpcEstimate,
  type EpcProxyLike,
  epcEstimate,
  referenceCost,
  runCarbonUg,
  type ScoreRunInput,
  scoreRaw,
} from './inputs.ts';
export {
  PRIMARY_ENERGY_FACTORS,
  REFERENCE_EXPORT_PENCE,
  REFERENCE_PRICES,
  REFERENCE_PRICES_ID,
} from './reference.ts';
export {
  DIM_DIR,
  displayScore,
  indicatorsOf,
  milli,
  type QRange,
  rComposite,
  ScoreError,
  type ScoreIndicators,
  type ScoreRaw,
  type ScoreResult,
  scoreOf,
  specQ,
  tComposite,
  unitScore,
} from './score.ts';
