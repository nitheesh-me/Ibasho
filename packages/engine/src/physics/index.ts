/**
 * Physics stages (BP 2 and 3). Owner: WP-01.
 * Each stage is a `physics-stage` plugin: a pure `run(input, ctx) -> { output, evidence }`.
 * The pipeline runner (`../pipeline`) fixes the order (core `STAGE_ORDER`).
 */
import type { PhysicsStage, StageName, SystemPlugin } from '@ibasho/core';
import { coolingStage } from './cooling.ts';
import { deliveredStage } from './delivered.ts';
import { createDhwStage } from './dhw.ts';
import { createFabricStage } from './fabric.ts';
import { createGainsStage } from './gains.ts';
import { geometryStage } from './geometry.ts';
import { heatBalanceStage } from './heat-balance.ts';
import { renewablesStage } from './renewables.ts';
import { createSystemsStage } from './systems.ts';
import { ventilationStage } from './ventilation.ts';

export type StageSet = { [S in StageName]: PhysicsStage<S> };

export interface PhysicsDefaults {
  /** RdSAP 10 Table 21 thermal bridging y for age bands A to I, W/m2K. */
  bridgingYWm2K: number;
  /** Cylinder standing loss, kWh/day (BP 3.9 range 0.5 to 1.5; ESTIMATE central 1.0). */
  cylinderLossKWhPerDay: number;
  /** New factory-insulated heat pump cylinder (about 200 l), kWh/day (ESTIMATE, range 0.9 to 1.6). */
  newCylinderLossKWhPerDay: number;
  /** Heat pump field factor f_field (BP 3.10 step 7: 0.90, range 0.80 to 1.0). */
  hpFieldFactor: number;
}

export const PHYSICS_DEFAULTS: PhysicsDefaults = {
  bridgingYWm2K: 0.15,
  cylinderLossKWhPerDay: 1.0,
  newCylinderLossKWhPerDay: 1.2,
  hpFieldFactor: 0.9,
};

export function createDefaultStages(
  defaults: PhysicsDefaults = PHYSICS_DEFAULTS,
  systems: readonly SystemPlugin[] = [],
): StageSet {
  const byId = new Map(systems.map((s) => [s.id, s]));
  const heatPumpIds = new Set(systems.filter((s) => s.category === 'heat-pump').map((s) => s.id));
  const dhwDefaults = { ...defaults, heatPumpIds };
  return {
    geometry: geometryStage,
    fabric: createFabricStage(defaults),
    ventilation: ventilationStage,
    gains: createGainsStage(dhwDefaults),
    'heat-balance': heatBalanceStage,
    cooling: coolingStage,
    dhw: createDhwStage(dhwDefaults),
    systems: createSystemsStage({ systems: byId, hpFieldFactor: defaults.hpFieldFactor }),
    renewables: renewablesStage,
    delivered: deliveredStage,
  };
}

export { PhysicsError } from './common.ts';
export { QuantiseError, quantiseWh } from './delivered.ts';
export { coolingUtilisation, humidityRatio } from './cooling.ts';
export { type DhwModel, dhwModel } from './dhw.ts';
export { pumpGainW } from './gains.ts';
export {
  gainLossRatio,
  heatingSchedule,
  offPeriodReduction,
  restSetpoint,
  sapControlType,
  utilisation,
} from './heat-balance.ts';
export {
  type Bin,
  BALANCE_C,
  DEFAULT_FIELD_FACTOR,
  designFlowC,
  flowAt,
  HP_SIZES_KW,
  type HpChain,
  heatPumpChain,
  hpSizeKw,
  ruhnauCop,
} from './heat-pump.ts';
export { MONTH_START_HOUR, normalQuantile, synthesiseHourlyTemps } from './hourly-synth.ts';
export { type Household, household, sapOccupancy } from './household.ts';
export { pvBeta, pvPerformanceRatio } from './renewables.ts';
export { type HeatLossIn, isHeatPump, type SystemsInExt } from './systems.ts';
