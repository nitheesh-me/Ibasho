/**
 * Closed intervals for ranges and posteriors (ARCH 4.3). Owner: WP-00.
 * Number intervals use ordinary float arithmetic without outward rounding, so they describe
 * modelled ranges (seal Modelled), not rigorous enclosures. Rigorous enclosures (noise rule)
 * use rationals in the rules package and in Lean.
 */

export interface Ival<T = number> {
  lo: T;
  hi: T;
}

export class IntervalError extends Error {
  override name = 'IntervalError';
}

/** Build [lo, hi]; throws on NaN or lo > hi. */
export function ival(lo: number, hi: number = lo): Ival<number> {
  if (Number.isNaN(lo) || Number.isNaN(hi)) throw new IntervalError('NaN bound');
  if (lo > hi) throw new IntervalError(`empty interval [${lo}, ${hi}]`);
  return { lo, hi };
}

export const Iv = {
  of: ival,
  point: (x: number): Ival<number> => ival(x, x),
  add: (a: Ival, b: Ival): Ival => ival(a.lo + b.lo, a.hi + b.hi),
  sub: (a: Ival, b: Ival): Ival => ival(a.lo - b.hi, a.hi - b.lo),
  neg: (a: Ival): Ival => ival(-a.hi, -a.lo),
  scale: (a: Ival, k: number): Ival => (k >= 0 ? ival(a.lo * k, a.hi * k) : ival(a.hi * k, a.lo * k)),
  mul: (a: Ival, b: Ival): Ival => {
    const p = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi];
    let lo = p[0]!;
    let hi = p[0]!;
    for (const x of p) {
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
    return ival(lo, hi);
  },
  hull: (a: Ival, b: Ival): Ival => ival(a.lo < b.lo ? a.lo : b.lo, a.hi > b.hi ? a.hi : b.hi),
  intersect: (a: Ival, b: Ival): Ival | null => {
    const lo = a.lo > b.lo ? a.lo : b.lo;
    const hi = a.hi < b.hi ? a.hi : b.hi;
    return lo <= hi ? { lo, hi } : null;
  },
  contains: (a: Ival, x: number): boolean => a.lo <= x && x <= a.hi,
  containsIval: (outer: Ival, inner: Ival): boolean => outer.lo <= inner.lo && inner.hi <= outer.hi,
  width: (a: Ival): number => a.hi - a.lo,
  mid: (a: Ival): number => a.lo + (a.hi - a.lo) / 2,
  isPoint: (a: Ival): boolean => a.lo === a.hi,
} as const;

/** Exact integer intervals (bigint), e.g. cost ranges in micro-pence. */
export const IvBig = {
  of: (lo: bigint, hi: bigint = lo): Ival<bigint> => {
    if (lo > hi) throw new IntervalError(`empty interval [${lo}, ${hi}]`);
    return { lo, hi };
  },
  add: (a: Ival<bigint>, b: Ival<bigint>): Ival<bigint> => ({ lo: a.lo + b.lo, hi: a.hi + b.hi }),
  sub: (a: Ival<bigint>, b: Ival<bigint>): Ival<bigint> => ({ lo: a.lo - b.hi, hi: a.hi - b.lo }),
  contains: (a: Ival<bigint>, x: bigint): boolean => a.lo <= x && x <= a.hi,
} as const;
