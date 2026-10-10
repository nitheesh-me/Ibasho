/**
 * `mees_cap`: the private rented sector spending cap (RP 5.3 `EW.MEES.2030`, government response
 * of 21 January 2026, graded `announced`). Owner: WP-03.
 *
 * The cap is 10,000 pounds per property, or 10% of the property value when the value is below
 * 100,000 pounds. Money is exact: spend in micro-pence (1 pound = 10^8), value in whole pounds.
 */
import type { Tri } from '@ibasho/core';

/** Micro-pence per pound. */
const MP_PER_GBP = 100_000_000n;
export const MEES_CAP_GBP = 10_000n;
export const MEES_LOW_VALUE_GBP = 100_000n;

/** The cap in micro-pence for a property value in whole pounds (truncated toward zero). */
export function meesCapMp(valueGbp: bigint): bigint {
  if (valueGbp < 0n) throw new RangeError('property value must not be negative');
  return valueGbp < MEES_LOW_VALUE_GBP ? (valueGbp * MP_PER_GBP) / 10n : MEES_CAP_GBP * MP_PER_GBP;
}

/** Named-function form: `mees_cap(spendMp, valueGbp)` is true when the spend is within the cap. */
export function meesCapFn(args: readonly (number | string)[]): Tri {
  const [spend, value] = args;
  if (args.length !== 2 || typeof spend !== 'number' || typeof value !== 'number') return 'unknown';
  if (!Number.isSafeInteger(spend) || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER)
    return 'unknown';
  // Whole pounds; a fractional value is truncated, which only lowers the cap (conservative).
  const v = BigInt(Math.trunc(value));
  return BigInt(spend) <= meesCapMp(v);
}
