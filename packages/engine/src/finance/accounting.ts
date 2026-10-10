/**
 * Per (fuel, month) accounting in integer fixed point (SPEC 7.2, R6, LV 6.2). Owner: WP-02.
 *
 * Mirrors Lean `Accounting.lean`: a saving is `before - after` per fuel and month with its sign
 * kept (a heat pump saves gas and uses more electricity, so the electricity saving is negative).
 * Carbon is the sum over fuels and months of `saving * factor`, with the factor in micro-grams per
 * Wh, so every product is an exact integer in micro-grams. The only rounding point is the final
 * conversion to grams (`ROUND_CARBON_G`, half even), which keeps `carbonSaving = emissions(before)
 * - emissions(after)` exact before rounding (Lean `carbonSaving_eq`).
 */
import {
  type CarbonPack,
  type CarbonTrajectory,
  FUELS,
  type Fuel,
  type FuelMonthly,
  type GCO2e,
  MONTHS,
  roundHalfEven,
  type Wh,
} from '@ibasho/core';

/** Micro-grams per gram. */
export const UG_PER_G = 1_000_000n;

export type FuelMonthVec = Record<Fuel, bigint[]>;

export function zeroVec(): FuelMonthVec {
  const out = {} as FuelMonthVec;
  for (const f of FUELS) out[f] = MONTHS.map(() => 0n);
  return out;
}

/** `before - after` per fuel and month, signs kept (acct.saving). */
export function saving(before: FuelMonthly<Wh>, after: FuelMonthly<Wh>): FuelMonthVec {
  const out = {} as FuelMonthVec;
  for (const f of FUELS) out[f] = MONTHS.map((m) => before[f][m]! - after[f][m]!);
  return out;
}

/** Annual total per fuel. */
export function annualByFuel(v: FuelMonthly<bigint> | FuelMonthVec): Record<Fuel, bigint> {
  const out = {} as Record<Fuel, bigint>;
  for (const f of FUELS) {
    let s = 0n;
    for (const x of v[f]) s += x;
    out[f] = s;
  }
  return out;
}

/** Fuels with any non-zero entry. A factor is asked only for these. */
export function usedFuels(...vs: (FuelMonthly<bigint> | FuelMonthVec)[]): Fuel[] {
  return FUELS.filter((f) => vs.some((v) => v[f].some((x) => x !== 0n)));
}

/**
 * Monthly carbon of a fuel-month vector, micro-grams per fuel (exact). Fuels that are zero in every
 * month are skipped, so a pack without a factor for an unused fuel is fine.
 */
export function carbonUg(v: FuelMonthly<bigint> | FuelMonthVec, pack: CarbonPack): Record<Fuel, bigint> {
  const out = {} as Record<Fuel, bigint>;
  for (const f of FUELS) {
    let s = 0n;
    if (v[f].some((x) => x !== 0n)) for (const m of MONTHS) s += v[f][m]! * pack.factor(f, m);
    out[f] = s;
  }
  return out;
}

/** Named rounding point: micro-grams to grams, half even. */
export function ROUND_CARBON_G(ug: bigint): GCO2e {
  return roundHalfEven(ug, UG_PER_G);
}

/** Annual operational carbon saving in grams (acct.carbon_saving), monthly factors (R6). */
export function carbonSavingG(sav: FuelMonthVec, pack: CarbonPack): GCO2e {
  let ug = 0n;
  for (const x of Object.values(carbonUg(sav, pack))) ug += x;
  return ROUND_CARBON_G(ug);
}

/**
 * Lifetime operational carbon saved in grams over `years` (fin.lifetime_tco2e, R6): the annual
 * saving per fuel times the trajectory factor of each calendar year, year 1 being `firstYear`.
 * Exact in micro-grams, rounded once at the end.
 */
export function lifetimeCarbonG(
  sav: FuelMonthVec,
  traj: CarbonTrajectory,
  firstYear: number,
  years: number,
): GCO2e {
  const annual = annualByFuel(sav);
  let ug = 0n;
  for (const f of FUELS) {
    if (annual[f] === 0n) continue;
    for (let t = 0; t < years; t++) ug += annual[f] * traj.factor(f, firstYear + t);
  }
  return ROUND_CARBON_G(ug);
}
