/**
 * Seeded PRNG and Latin hypercube sampling (ARCH 4.3). Owner: WP-00.
 *
 * Generator: xoshiro128** 1.1 (Blackman and Vigna), 32-bit state words, period 2^128 - 1.
 * Seeding: four words from SplitMix32 (golden-ratio increment, Murmur3 fmix32 finaliser) over a
 * 32-bit seed, or the first 16 bytes of SHA-256 for a string seed. Integer-only, so the stream
 * is bit-identical in every engine.
 */
import { sha256Bytes, utf8 } from './sha256.ts';

export interface Rng {
  /** Next uniform 32-bit unsigned integer. */
  nextU32(): number;
  /** Uniform float in [0, 1) with 32 bits of resolution. */
  nextFloat(): number;
  /** Uniform integer in [0, n), unbiased (rejection sampling). n must be in [1, 2^32]. */
  int(n: number): number;
  /** Copy of the internal state, for checkpoints. */
  state(): Uint32Array;
}

const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

/** SplitMix32 stream used for seeding. */
export function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

function seedState(seed: number | string | Uint32Array): Uint32Array {
  let st: Uint32Array;
  if (typeof seed === 'number') {
    if (!Number.isInteger(seed)) throw new RangeError('numeric seed must be an integer');
    const sm = splitmix32(seed);
    st = new Uint32Array([sm(), sm(), sm(), sm()]);
  } else if (typeof seed === 'string') {
    const h = sha256Bytes(utf8(seed));
    const v = new DataView(h.buffer);
    st = new Uint32Array([v.getUint32(0), v.getUint32(4), v.getUint32(8), v.getUint32(12)]);
  } else {
    if (seed.length !== 4) throw new RangeError('state must have 4 words');
    st = new Uint32Array(seed);
  }
  if ((st[0]! | st[1]! | st[2]! | st[3]!) === 0) st[0] = 1; // all-zero state is a fixed point
  return st;
}

/** xoshiro128** generator. */
export function xoshiro128ss(seed: number | string | Uint32Array): Rng {
  const s = seedState(seed);
  const nextU32 = (): number => {
    const result = Math.imul(rotl(Math.imul(s[1]!, 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1]! << 9) >>> 0;
    s[2] = s[2]! ^ s[0]!;
    s[3] = s[3]! ^ s[1]!;
    s[1] = s[1]! ^ s[2]!;
    s[0] = s[0]! ^ s[3]!;
    s[2] = s[2]! ^ t;
    s[3] = rotl(s[3]!, 11);
    return result;
  };
  const int = (n: number): number => {
    if (!Number.isInteger(n) || n < 1 || n > 0x100000000)
      throw new RangeError(`int(n) needs 1 <= n <= 2^32, got ${n}`);
    const limit = 0x100000000 - (0x100000000 % n); // largest multiple of n not above 2^32
    for (;;) {
      const x = nextU32();
      if (x < limit) return x % n;
    }
  };
  return {
    nextU32,
    nextFloat: () => nextU32() / 0x100000000,
    int,
    state: () => new Uint32Array(s),
  };
}

/** Fisher-Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/**
 * Latin hypercube sample: `n` points in [0, 1)^dims. In every dimension each stratum
 * [k/n, (k+1)/n) holds exactly one point. Returns `n` rows of length `dims`.
 */
export function latinHypercube(n: number, dims: number, rng: Rng): Float64Array[] {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('n must be a positive integer');
  if (!Number.isInteger(dims) || dims < 1) throw new RangeError('dims must be a positive integer');
  const rows = Array.from({ length: n }, () => new Float64Array(dims));
  const strata = Array.from({ length: n }, (_, k) => k);
  for (let d = 0; d < dims; d++) {
    const perm = shuffle(strata, rng);
    for (let i = 0; i < n; i++) {
      rows[i]![d] = (perm[i]! + rng.nextFloat()) / n;
    }
  }
  return rows;
}
