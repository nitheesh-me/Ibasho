/**
 * Real codes, baselines and rating ladders (WP-19, V-5). Engine-side only.
 */
export type { AppGData, CodesCatalogue, CodesInData, CodesUkData } from './catalogue.ts';
export {
  designLpd,
  evaluateCodes,
  familiesFor,
  inEngland,
  inGreaterLondon,
  inIndia,
  inTelangana,
} from './evaluate.ts';
export { goalGap, goalGaps } from './gaps.ts';
export { computeRealCodes, createRealCodesProvider, REAL_CODES_VERSION } from './provider.ts';
