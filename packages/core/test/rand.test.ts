import { describe, expect, it } from 'vitest';
import { latinHypercube, shuffle, splitmix32, xoshiro128ss } from '../src/rand.ts';

describe('xoshiro128**', () => {
  it('matches the reference implementation from state {1, 2, 3, 4}', () => {
    const r = xoshiro128ss(Uint32Array.from([1, 2, 3, 4]));
    expect([1, 2, 3, 4, 5, 6].map(() => r.nextU32())).toEqual([
      11520, 0, 5927040, 70819200, 2031721883, 1637235492,
    ]);
  });

  it('seeds from SplitMix32 (reference vector, seed 42)', () => {
    const sm = splitmix32(42);
    expect([sm(), sm(), sm(), sm()]).toEqual([939911724, 3948730756, 321366731, 3317318717]);
    const a = xoshiro128ss(42);
    const b = xoshiro128ss(Uint32Array.from([939911724, 3948730756, 321366731, 3317318717]));
    for (let i = 0; i < 10; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it('string seeds are stable and distinct', () => {
    const a = xoshiro128ss('gh1');
    const b = xoshiro128ss('gh1');
    const c = xoshiro128ss('gh2');
    const xa = a.nextU32();
    expect(b.nextU32()).toBe(xa);
    expect(c.nextU32()).not.toBe(xa);
  });

  it('never stays in the all-zero state', () => {
    const r = xoshiro128ss(Uint32Array.from([0, 0, 0, 0]));
    const xs = [r.nextU32(), r.nextU32(), r.nextU32(), r.nextU32()];
    expect(xs.some((x) => x !== 0)).toBe(true);
  });

  it('floats lie in [0, 1) and ints in [0, n)', () => {
    const r = xoshiro128ss(7);
    for (let i = 0; i < 2000; i++) {
      const f = r.nextFloat();
      expect(f >= 0 && f < 1).toBe(true);
      const k = r.int(7);
      expect(Number.isInteger(k) && k >= 0 && k < 7).toBe(true);
    }
    expect(r.int(1)).toBe(0);
    expect(r.int(2 ** 32)).toBeGreaterThanOrEqual(0);
  });

  it('int is roughly uniform', () => {
    const r = xoshiro128ss(99);
    const counts = [0, 0, 0];
    for (let i = 0; i < 30000; i++) counts[r.int(3)]!++;
    for (const c of counts) expect(Math.abs(c - 10000)).toBeLessThan(400);
  });

  it('checkpoints state', () => {
    const r = xoshiro128ss(5);
    r.nextU32();
    const s = r.state();
    const next = r.nextU32();
    expect(xoshiro128ss(s).nextU32()).toBe(next);
  });

  it('rejects bad seeds and ranges', () => {
    expect(() => xoshiro128ss(1.5)).toThrow(RangeError);
    expect(() => xoshiro128ss(new Uint32Array(3))).toThrow(RangeError);
    const r = xoshiro128ss(1);
    expect(() => r.int(0)).toThrow(RangeError);
    expect(() => r.int(2 ** 32 + 1)).toThrow(RangeError);
    expect(() => r.int(2.5)).toThrow(RangeError);
  });
});

describe('shuffle', () => {
  it('returns a permutation and leaves the input alone', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(items, xoshiro128ss(3));
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('latinHypercube', () => {
  it('puts exactly one point in each stratum of every dimension', () => {
    const n = 200;
    const rows = latinHypercube(n, 5, xoshiro128ss('lhs'));
    expect(rows.length).toBe(n);
    for (let d = 0; d < 5; d++) {
      const strata = rows.map((r) => Math.floor(r[d]! * n)).sort((a, b) => a - b);
      expect(strata).toEqual(Array.from({ length: n }, (_, k) => k));
    }
  });

  it('is deterministic for a seed', () => {
    const a = latinHypercube(10, 3, xoshiro128ss(11));
    const b = latinHypercube(10, 3, xoshiro128ss(11));
    expect(a).toEqual(b);
  });

  it('rejects bad sizes', () => {
    expect(() => latinHypercube(0, 2, xoshiro128ss(1))).toThrow(RangeError);
    expect(() => latinHypercube(2, 0, xoshiro128ss(1))).toThrow(RangeError);
  });
});
