/**
 * Engine half of pack `climate`. Owner: WP-01.
 * M-0: the London pack with tabulated orientation irradiance. Other cities at M-A.
 */
export { LONDON_CLIMATE_ID, londonClimate } from './london.ts';
export { default as climateEngineModule } from './module.ts';
export { type OrientationTable, planeIrradiance, verticalIrradiance } from './tabulated.ts';
