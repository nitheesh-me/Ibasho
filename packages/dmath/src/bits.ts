/**
 * IEEE 754 binary64 word access, endian independent (DataView is big endian by default).
 * Owner: WP-01. fdlibm reads and writes the high and low 32-bit words of a double; these helpers
 * do the same without depending on the platform byte order.
 */

const view = new DataView(new ArrayBuffer(8));

/** High word (sign, exponent, top 20 mantissa bits) as a signed 32-bit integer, like fdlibm `__HI`. */
export function hiWord(x: number): number {
  view.setFloat64(0, x);
  return view.getInt32(0);
}

/** Low word (bottom 32 mantissa bits) as an unsigned 32-bit integer, like fdlibm `__LO`. */
export function loWord(x: number): number {
  view.setFloat64(0, x);
  return view.getUint32(4);
}

/** Build a double from its high and low words. */
export function fromWords(hi: number, lo: number): number {
  view.setInt32(0, hi | 0);
  view.setUint32(4, lo >>> 0);
  return view.getFloat64(0);
}

/** Replace the high word of `x`, keeping its low word (fdlibm `__HI(x) = hi`). */
export function withHi(x: number, hi: number): number {
  view.setFloat64(0, x);
  view.setInt32(0, hi | 0);
  return view.getFloat64(0);
}

/** Exactly 2^p for -1022 <= p <= 1023 (a normal power of two). */
export function pow2(p: number): number {
  if (!Number.isInteger(p) || p < -1022 || p > 1023) throw new RangeError(`pow2: ${p} out of range`);
  return fromWords((p + 1023) << 20, 0);
}
