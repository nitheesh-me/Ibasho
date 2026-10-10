/**
 * `dt_hosting`: distribution transformer hosting limit for rooftop PV (RP 5.5 `IN.TG.DT50`,
 * TGERC draft 2025 clauses 5.1 and 5.2, graded `primary (draft)`). Owner: WP-03.
 *
 * The aggregate LT rooftop capacity on a transformer, including the new plant, must not exceed
 * 50% of the transformer rating. All quantities are exact decimals (kW and kVA, unity power factor).
 */
import { Q, type Tri } from '@ibasho/core';

/** An exact rational from a finite JS number via its fixed six-decimal form (deterministic). */
export function qOf(x: number): Q {
  return Q.fromDecimal(x.toFixed(6));
}

/** True when `existingKw + addKw <= 0.5 * ratedKva`. */
export function dtHosting(existingKw: number, addKw: number, ratedKva: number): boolean {
  return Q.le(Q.add(qOf(existingKw), qOf(addKw)), Q.mul(qOf(ratedKva), Q.of(1n, 2n)));
}

/** Named-function form: `dt_hosting(existingKw, addKw, ratedKva)`. Bad arguments are unknown. */
export function dtHostingFn(args: readonly (number | string)[]): Tri {
  if (args.length !== 3 || !args.every((a) => typeof a === 'number' && Number.isFinite(a) && a >= 0))
    return 'unknown';
  const [e, a, r] = args as number[];
  return dtHosting(e!, a!, r!);
}
