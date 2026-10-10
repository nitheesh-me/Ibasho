/**
 * Engine half of pack `climate`. Owner: WP-01.
 * Six cities (BP 4.3 tables plus NASA POWER), the London PVGIS TMY, and the SAP 10.2 Appendix U
 * UK-average climate that `rating` mode runs on.
 */
export {
  CITY_SPECS,
  type CitySpec,
  cityMonths,
  cityPack,
  DELHI,
  EDINBURGH,
  HYDERABAD,
  LONDON,
  MANCHESTER,
  MUMBAI,
} from './cities.ts';
export { LONDON_CLIMATE_ID, londonClimate } from './london.ts';
export { LONDON_TMY_SOURCE } from './london-tmy-data.ts';
export { default as climateEngineModule } from './module.ts';
export {
  CLIMATE_PACKS,
  climateById,
  delhiClimate,
  edinburghClimate,
  hyderabadClimate,
  manchesterClimate,
  mumbaiClimate,
} from './packs.ts';
export {
  SAP_DECLINATION,
  SAP_RATING_CLIMATE_ID,
  SAP_THAMES,
  SAP_UK_AVERAGE,
  type SapRegion,
  sapK,
  sapPlaneKWh,
  sapPlaneW,
  sapUkAverageClimate,
} from './sap-u.ts';
export { type OrientationTable, planeIrradiance, verticalIrradiance } from './tabulated.ts';
export { HOURS_PER_YEAR, londonTmy } from './tmy.ts';
