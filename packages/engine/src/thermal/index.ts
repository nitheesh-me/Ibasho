/**
 * Thermal models (SPEC R5). Owner: WP-01.
 */
export {
  createFiveR1CModel,
  type FiveR1CResult,
  heatingBlocks,
  runFiveR1C,
  simulateZone,
  type ZoneParams,
  zoneMonthMean,
} from './five-r1c.ts';
