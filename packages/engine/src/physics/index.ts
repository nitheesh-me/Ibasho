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
import { gainsStage } from './gains.ts';
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
}

export const PHYSICS_DEFAULTS: PhysicsDefaults = { bridgingYWm2K: 0.15, cylinderLossKWhPerDay: 1.0 };

export function createDefaultStages(
  defaults: PhysicsDefaults = PHYSICS_DEFAULTS,
  systems: readonly SystemPlugin[] = [],
): StageSet {
  return {
    geometry: geometryStage,
    fabric: createFabricStage(defaults),
    ventilation: ventilationStage,
    gains: gainsStage,
    'heat-balance': heatBalanceStage,
    cooling: coolingStage,
    dhw: createDhwStage(defaults),
    systems: createSystemsStage({ systems: new Map(systems.map((s) => [s.id, s])) }),
    renewables: renewablesStage,
    delivered: deliveredStage,
  };
}

export { PhysicsError } from './common.ts';
export { quantiseWh, QuantiseError } from './delivered.ts';
export { type Household, household, sapOccupancy } from './household.ts';
export { offPeriodReduction, sapControlType } from './heat-balance.ts';
