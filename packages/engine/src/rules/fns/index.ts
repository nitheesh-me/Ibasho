/**
 * Named rule functions (ARCH 5.4 `NamedFn`, each defined in Lean). Owner: WP-03.
 *
 * `DEFAULT_FNS` is the table `evaluateRules` uses unless the caller passes its own. Every function
 * returns three-valued truth and reads only known arguments; malformed arguments give `'unknown'`.
 * Pack rules use named functions only in `consent`, `oblige`, `warn` and `info` effects, so the
 * package status never depends on a function the checker has not wired yet (`lintRules`).
 */
import type { NamedFn, Tri } from '@ibasho/core';
import { adfCategoryFn } from './adf.ts';
import { dtHostingFn } from './dt.ts';
import { ensRetvFn } from './ens.ts';
import { meesCapFn } from './mees.ts';
import { mcs020aLpLeFn } from './noise.ts';

export const DEFAULT_FNS: Readonly<Record<NamedFn, (args: readonly (number | string)[]) => Tri>> = {
  mcs020a_Lp_le: mcs020aLpLeFn,
  adf_category: adfCategoryFn,
  ens_retv: ensRetvFn,
  mees_cap: meesCapFn,
  dt_hosting: dtHostingFn,
};

/**
 * Constant facts (`k.*`) merged into every environment, so rules can pass thresholds to named
 * functions (whose arguments are fact references). Values are exact numbers.
 */
export const K_FACTS = {
  'k.adf.A': 0,
  'k.adf.B': 1,
  'k.adf.C': 2,
  'k.ens.retv.max': 15,
  'k.ens.retv.target': 12,
} as const;

export { type AdfCategory, adfCategory, adfCategoryFn, adfRank } from './adf.ts';
export { dtHosting, dtHostingFn, qOf } from './dt.ts';
export { ENS_COEFFS, type EnsClimate, ensRetv, ensRetvFn, type RetvInput } from './ens.ts';
export { MEES_CAP_GBP, MEES_LOW_VALUE_GBP, meesCapFn, meesCapMp } from './mees.ts';
export {
  attenuationDdB,
  type Barrier,
  decidePosition,
  decodeNoiseSites,
  directivity,
  eHi,
  eLo,
  encodeNoiseSites,
  energyBounds,
  inDomain,
  lpDisplay,
  mcs020aLpLe,
  mcs020aLpLeFn,
  p10Hi,
  p10Lo,
  type UnitAt,
  type View,
} from './noise.ts';
export {
  barrierBetween,
  type NoisePosition,
  noise,
  noiseFact,
  noisePositions,
  reflectingSurfaces,
  UNIT_HEIGHT_M,
  unitAt,
} from './noise-site.ts';
