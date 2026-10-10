/**
 * Occupancy and lights, appliances and cooking (LAC). Owner: WP-01.
 *
 * - Occupancy N (SAP 10.2 Table 1b, BP 3.1): `rating` and `standard` use the SAP formula on TFA;
 *   `your-home` uses the twin's stated occupants.
 * - Appliances E_A = 207.8 (TFA N)^0.4714 kWh/yr and lighting E_L = 11.2 * 59.73 (TFA N)^0.4714 / 80
 *   kWh/yr (LED efficacy 80 lm/W, daylight factor 1), cooking E_cook = 138 + 28 N kWh/yr (BP 3.6).
 * M-0 spreads annual LAC energy by days in the month; the seasonal cosine profiles of BP 3.6 need
 * `dmath.cos` and arrive at M-A.
 *
 * INTERFACES (local adapter): ARCH `GainsIn` and `SystemsIn` carry no LAC energy, so the runner
 * passes `Household` alongside them (`GainsInWithHousehold`, `SystemsInWithHousehold`). Requested on
 * the blackboard as a core contract change.
 */
import type { GainsIn, Monthly, RunMode, StageCtx, SystemsIn } from '@ibasho/core';
import { exp, pow } from '@ibasho/dmath';
import { central, days, monthly, PhysicsError } from './common.ts';

export interface Household {
  occupancyN: number;
  lightingKWh: Monthly<number>;
  appliancesKWh: Monthly<number>;
  cookingKWh: Monthly<number>;
}
export type GainsInWithHousehold = GainsIn & { household: Household };
export type SystemsInWithHousehold = SystemsIn & { household: Household };

/** SAP 10.2 Table 1b standard occupancy. */
export function sapOccupancy(tfaM2: number): number {
  if (!(tfaM2 > 0)) throw new PhysicsError(`TFA must be positive, got ${tfaM2}`);
  if (tfaM2 <= 13.9) return 1;
  const d = tfaM2 - 13.9;
  return 1 + 1.76 * (1 - exp(-0.000349 * d * d)) + 0.0013 * d;
}

export function occupancyFor(mode: RunMode, tfaM2: number, ctx: StageCtx): number {
  if (mode === 'your-home') return central(ctx.twin.occupancy.people, 'occupancy.people');
  return sapOccupancy(tfaM2);
}

const LED_EFFICACY_LM_PER_W = 80;

export function household(mode: RunMode, tfaM2: number, ctx: StageCtx): Household {
  const n = occupancyFor(mode, tfaM2, ctx);
  const scale = pow(tfaM2 * n, 0.4714);
  const appliancesYr = 207.8 * scale;
  const lightingYr = (11.2 * 59.73 * scale) / LED_EFFICACY_LM_PER_W;
  const cookingYr = 138 + 28 * n;
  const spread = (annual: number) => monthly((m) => (annual * days(m)) / 365);
  return {
    occupancyN: n,
    lightingKWh: spread(lightingYr),
    appliancesKWh: spread(appliancesYr),
    cookingKWh: spread(cookingYr),
  };
}

/** Read the household from an extended stage input, or fail clearly. */
export function householdOf(input: object): Household {
  const h = (input as { household?: Household }).household;
  if (!h) throw new PhysicsError('stage input has no household (run it through the WP-01 pipeline runner)');
  return h;
}
