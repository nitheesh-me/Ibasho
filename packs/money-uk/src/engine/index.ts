/**
 * Engine half of pack `money-uk`. Owner: WP-02.
 * M-0: tariffs, carbon, trajectory (PLACEHOLDER), measure costs for the M-0 options, BUS, value v1.
 * PLACEHOLDER until M-B: SEG export, DESNZ your-home factors with T&D, Green Book trajectory, WH:LG,
 * loan stub, ECO4 and GBIS closed, Halifax reward, `epc-proxy/rating`, the other option costs.
 */
export { CarbonFactorError, carbonSap102, carbonTrajectoryFlat, UG_PER_WH_PER_G_PER_KWH } from './carbon.ts';
export {
  CostError,
  CYLINDER_NEW,
  costAshp,
  costAshpRadiatorsPlus,
  costDraught,
  costLoft270,
  costLoft300,
  ESM_ZERO_VAT_TO,
  esmVatRate,
  heatPumpSizeKw,
  loftAreaM2,
  openingCount,
  RADIATOR_REPLACED,
  radiatorsReplaced,
  UK_MEASURE_COSTS,
} from './costs/index.ts';
export { BUS_AMOUNT, BUS_OPTION_IDS, grantBus, UK_GRANTS } from './grants.ts';
export { default as moneyUkEngineModule } from './module.ts';
export {
  checkSlabTable,
  flatTariff,
  pencePerDayToMicroPence,
  pencePerKwhToMicroPencePerWh,
  type SlabTariff,
  slabBill,
  slabCharge,
  TariffError,
  UK_TARIFFS,
  ukCapElectricity2026q4,
  ukCapGas2026q4,
} from './tariffs.ts';
export { VALUE_TABLE_V1, valueUkOwnerOccupierV1 } from './value.ts';
