/** Heat-flow motes (DESIGN_SYSTEM 10 honesty rule: one mote is 10 W). */
import { describe, expect, it } from 'vitest';
import { buildMotes, densityToT, moteCount } from '../src/layers/motes.ts';
import { WATTS_PER_MOTE } from '../src/quantities/types.ts';
import { house, quantities } from './helpers.ts';

describe('motes', () => {
  it('one mote per 10 W, rounded, none for zero or negative', () => {
    expect(WATTS_PER_MOTE).toBe(10);
    expect(moteCount(0)).toBe(0);
    expect(moteCount(-30)).toBe(0);
    expect(moteCount(4)).toBe(0);
    expect(moteCount(5)).toBe(1);
    expect(moteCount(149)).toBe(15);
  });

  it('each source carries exactly moteCount(watts) motes, and buffers agree', () => {
    const f = buildMotes(house, quantities);
    expect(f.sources.length).toBeGreaterThan(0);
    for (const s of f.sources) expect(s.count).toBe(moteCount(s.watts));
    const total = f.sources.reduce((a, s) => a + s.count, 0);
    expect(f.count).toBe(total);
    expect(f.origins.length).toBe(total * 3);
    expect(f.dirs.length).toBe(total * 3);
    expect(f.params.length).toBe(total * 4);
  });

  it('is deterministic for a seed and finite everywhere', () => {
    const a = buildMotes(house, quantities);
    const b = buildMotes(house, quantities);
    expect(Array.from(a.origins)).toEqual(Array.from(b.origins));
    expect(Array.from(a.params)).toEqual(Array.from(b.params));
    expect(Array.from(a.origins).every(Number.isFinite)).toBe(true);
    const c = buildMotes(house, quantities, 'another-seed');
    expect(Array.from(c.origins)).not.toEqual(Array.from(a.origins));
  });

  it('origins stay inside the house bounds (plus a little drift)', () => {
    const f = buildMotes(house, quantities);
    const { min, max } = house.bounds;
    for (let i = 0; i < f.count; i++) {
      for (let k = 0; k < 3; k++) {
        const v = f.origins[i * 3 + k]!;
        expect(v).toBeGreaterThanOrEqual(min[k]! - 0.5);
        expect(v).toBeLessThanOrEqual(max[k]! + 0.5);
      }
    }
  });

  it('colour t is in [0.3, 1] and rises with density', () => {
    expect(densityToT(0, 'fabric')).toBeCloseTo(0.3, 12);
    expect(densityToT(1e6, 'fabric')).toBeCloseTo(1, 12);
    expect(densityToT(30, 'fabric')).toBeLessThan(densityToT(50, 'fabric'));
  });
});
