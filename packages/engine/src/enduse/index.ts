/**
 * Real energy stage (WP-18): zones (weather, sun, 5R1C), systems and end uses. Engine-side only.
 */

export { simulateRc } from '../zones/rc.ts';
export { hourlyWeather, sunPath, surfaceIrradiance } from '../zones/weather.ts';
export { type EnergyRun, runEnergyModel } from './model.ts';
export { coarseBuilding, computeRealEnergy, createRealEnergyProvider, moneyFor } from './provider.ts';
export { buildRealResult, REAL_ENERGY_VERSION } from './result.ts';
