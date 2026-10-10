// PLACEHOLDER: replaced by ibasho-gen.
// Values are transcribed from SPEC R2 and SPEC 8 so engine code can be written against the
// final shape. Anchors and reference prices are not here yet: they come only from Lean.
// Rationals are wire strings ("n/d"), parsed with `Q.fromWire` in @ibasho/core.

export type ScoreDim = 'F' | 'C' | 'E' | 'A' | 'H' | 'R' | 'T';
export const SCORE_DIMS: readonly ScoreDim[] = ['F', 'C', 'E', 'A', 'H', 'R', 'T'];

/** SPEC R2. Sum is 1 (Lean `weights_sum_one`). */
export const SCORE_WEIGHTS: Readonly<Record<ScoreDim, string>> = {
  F: '1/5',
  C: '1/5',
  E: '3/20',
  A: '3/20',
  H: '1/10',
  R: '1/10',
  T: '1/10',
};

export type ScoreGroup = 'fabric-heating' | 'running-cost' | 'carbon' | 'comfort';
/** SPEC R2 display groups. */
export const SCORE_GROUPS: Readonly<Record<ScoreGroup, readonly ScoreDim[]>> = {
  'fabric-heating': ['F', 'H'],
  'running-cost': ['A', 'E'],
  carbon: ['C', 'R'],
  comfort: ['T'],
};

/** SPEC 8: estimated EPC band thresholds on the SAP scale (A flagged in SPEC). */
export const BAND_THRESHOLDS: readonly { band: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'; minSap: number }[] = [
  { band: 'A', minSap: 92 },
  { band: 'B', minSap: 81 },
  { band: 'C', minSap: 69 },
  { band: 'D', minSap: 55 },
  { band: 'E', minSap: 39 },
  { band: 'F', minSap: 21 },
];

/** SPEC 7.4 fixed-point constants. */
export const FIXED = {
  /** Discount and growth factor scale. */
  dfScale: '1000000000000',
  /** Rates are integer parts per billion. */
  ppb: '1000000000',
  /** Micro-pence per pound. */
  microPencePerPound: '100000000',
} as const;

/** SPEC R9 completeness limits of the exhaustive search. */
export const SEARCH_LIMITS = { heavy: 1024, packages: 65536 } as const;

/** SPEC 7.3 claim ids. Theorem lists and plain sentences live in seals.json. */
export type ClaimKey =
  | 'nothing-better-hidden'
  | 'rejected-never-returned'
  | 'every-rule-passed'
  | 'picks-as-named'
  | 'noise-decided-soundly'
  | 'score-bookkeeping';
