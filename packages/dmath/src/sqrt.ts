/**
 * sqrt(x), correctly rounded (round to nearest, ties to even), as IEEE 754 requires. Owner: WP-01.
 *
 * Computed exactly with BigInt: write x = m * 2^e with integer m, take the integer square root of
 * m scaled by an even power of two, keep a sticky bit for the remainder, and let the exact
 * BigInt to Number conversion (ECMAScript rounds it to nearest, ties to even) do the one rounding.
 * Slower than hardware sqrt but bit-identical everywhere by construction. Physics uses sqrt rarely.
 */
import { hiWord, loWord, pow2 } from './bits.ts';

function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = 1n << BigInt((n.toString(2).length + 1) >> 1);
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

/** Number of extra bits of root precision kept before rounding (root has at least 26 + 53 bits). */
const SCALE = 60;

export function sqrt(x: number): number {
  if (Number.isNaN(x) || x < 0) return Number.NaN;
  if (x === 0 || x === Infinity) return x; // sqrt(+-0) = +-0
  const hi = hiWord(x);
  const lo = loWord(x);
  const expField = (hi >>> 20) & 0x7ff;
  let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e: number;
  if (expField === 0) {
    e = -1074; // subnormal
  } else {
    m |= 1n << 52n;
    e = expField - 1075;
  }
  if (e % 2 !== 0) {
    m <<= 1n;
    e -= 1;
  }
  const scaled = m << BigInt(2 * SCALE);
  const r = isqrt(scaled);
  const sticky = scaled - r * r === 0n ? 0n : 1n;
  // Root = (2r + sticky) / 2 * 2^(e/2 - SCALE): the sticky bit sits below every rounding position.
  const twice = Number((r << 1n) | sticky);
  return twice * pow2(e / 2 - SCALE - 1);
}
