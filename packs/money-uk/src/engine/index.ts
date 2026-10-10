/**
 * Engine half of pack `money-uk`. Owner: WP-02.
 * Tariffs, carbon, trajectory (PLACEHOLDER), costs for every SPEC 9 option, BUS, loan stub, EPC
 * rating proxy, value v1. PLACEHOLDER until later M-B passes: SEG export, DESNZ your-home factors
 * with T&D, Green Book trajectory, WH:LG, ECO4 and GBIS shown closed, Halifax reward.
 */
export { CarbonFactorError, carbonSap102, carbonTrajectoryFlat, UG_PER_WH_PER_G_PER_KWH } from './carbon.ts';
export {
  CostError,
  CYLINDER_NEW,
  costAshp,
  costAshpRadiatorsPlus,
  costAssessMoisture,
  costAssessPas2035,
  costBattery5,
  costBattery10,
  costBoilerGasCombi,
  costControls,
  costCylinderJacket,
  costCylinderNew,
  costDraught,
  costFloor,
  costGlazingDouble,
  costGlazingSecondary,
  costHobInduction,
  costLoft270,
  costLoft300,
  costMvhr,
  costPv2,
  costPv3,
  costPv4,
  costSolarThermal,
  costWallEwi,
  costWallIwi,
  ESM_ZERO_VAT_TO,
  esmVatRate,
  externalWallAreaM2,
  floorAreaM2,
  heatPumpSizeKw,
  loftAreaM2,
  openingCount,
  PV_INVERTER,
  RADIATOR_REPLACED,
  radiatorCount,
  radiatorsReplaced,
  tfaM2,
  UK_MEASURE_COSTS,
  UK_SYSTEM_COSTS,
  windowAreaM2,
} from './costs/index.ts';
export {
  bandOfSap,
  EpcProxyError,
  type EpcProxyWithArea,
  epcProxyRating,
  RDSAP_10_EXPORT_PENCE,
  RDSAP_10_PRICES,
  ratingCost,
  SAP_DEFLATOR,
  type SapEstimate,
  sapEstimate,
} from './epc-proxy.ts';
export { financeLoanStub, UK_FINANCE } from './finance.ts';
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
