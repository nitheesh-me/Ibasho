/**
 * pow(x, y). Owner: WP-01.
 *
 * M-0 implementation: special cases follow ECMAScript `Number::exponentiate` exactly; the general
 * case is exp(y * log(x)) on the deterministic fdlibm `exp` and `log`, so the result is
 * bit-identical in every engine. Small integer exponents (|y| <= 64) use binary powering
 * (exact for integer bases with representable results, a few ulp otherwise). Elsewhere accuracy is
 * about (2 + 2|y * ln x|) ulp, ample for the physics exponents (|y * ln x| < 10). The full fdlibm `e_pow.c` port (error < 1 ulp, AC-D1 and
 * WP-01 A5) replaces the general case at M-A; the exported signature does not change.
 */
import { exp } from './exp.ts';
import { log } from './log.ts';
import { sqrt } from './sqrt.ts';

function isOddInteger(y: number): boolean {
  return Number.isInteger(y) && Math.abs(y) <= Number.MAX_SAFE_INTEGER && Math.abs(y % 2) === 1;
}

export function pow(x: number, y: number): number {
  if (Number.isNaN(y)) return Number.NaN;
  if (y === 0) return 1;
  if (Number.isNaN(x)) return Number.NaN;
  if (y === 1) return x;

  const ax = Math.abs(x);
  if (y === Infinity) return ax > 1 ? Infinity : ax === 1 ? Number.NaN : 0;
  if (y === -Infinity) return ax > 1 ? 0 : ax === 1 ? Number.NaN : Infinity;

  const yOdd = isOddInteger(y);
  if (x === Infinity) return y > 0 ? Infinity : 0;
  if (x === -Infinity) {
    if (y > 0) return yOdd ? -Infinity : Infinity;
    return yOdd ? -0 : 0;
  }
  if (x === 0) {
    const negZero = Object.is(x, -0);
    if (y > 0) return negZero && yOdd ? -0 : 0;
    return negZero && yOdd ? -Infinity : Infinity;
  }
  if (x < 0 && !Number.isInteger(y)) return Number.NaN;

  if (y === 0.5) return sqrt(x); // x > 0 here
  if (Number.isInteger(y) && Math.abs(y) <= 64) {
    let base = x;
    let n = Math.abs(y);
    let acc = 1;
    while (n > 0) {
      if (n % 2 === 1) acc *= base;
      n = Math.floor(n / 2);
      if (n > 0) base *= base;
    }
    return y < 0 ? 1 / acc : acc;
  }

  const r = exp(y * log(ax));
  return x < 0 && yOdd ? -r : r;
}
