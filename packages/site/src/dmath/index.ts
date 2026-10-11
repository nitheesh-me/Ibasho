/**
 * Deterministic maths for the site worker (ARCH 15.2, SPEC R20). Owner: WP-16.
 *
 * LOCAL ADAPTER: `exp`, `log`, `sin`, `cos` are copies of `@ibasho/dmath` (WP-01); `atan`,
 * `atan2`, `asin`, `acos` are new fdlibm ports (`atan.ts`). When `@ibasho/dmath` is a declared
 * dependency of this package and exports the inverse functions, this file re-exports it instead.
 */
import { cos, sin } from './trig.ts';

export { acos, asin, atan, atan2 } from './atan.ts';
export { exp } from './exp.ts';
export { log } from './log.ts';
export { cos, sin } from './trig.ts';

export const PI = 3.141592653589793;
export const D2R = PI / 180;
export const R2D = 180 / PI;

/** tan as sin over cos (deterministic, within a few ulp). */
export function tan(x: number): number {
  return sin(x) / cos(x);
}

/** Degrees helpers. */
export const sind = (d: number): number => sin(d * D2R);
export const cosd = (d: number): number => cos(d * D2R);

/** x to an integer power n (binary powering, exact operations only). */
export function powi(x: number, n: number): number {
  let base = x;
  let k = n < 0 ? -n : n;
  let acc = 1;
  while (k > 0) {
    if (k % 2 === 1) acc *= base;
    k = Math.floor(k / 2);
    if (k > 0) base *= base;
  }
  return n < 0 ? 1 / acc : acc;
}
