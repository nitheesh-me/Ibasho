/**
 * Named functions (WP-03 M-B): C1 noise golden, C4 adf monotone, mees_cap, dt_hosting, ens_retv.
 */

import { Q } from '@ibasho/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { evalExpr } from './expr.ts';
import { adfCategory, adfCategoryFn, adfRank } from './fns/adf.ts';
import { dtHostingFn } from './fns/dt.ts';
import { ensRetv, ensRetvFn } from './fns/ens.ts';
import { DEFAULT_FNS, K_FACTS } from './fns/index.ts';
import { meesCapFn, meesCapMp } from './fns/mees.ts';
import {
  decidePosition,
  decodeNoiseSites,
  encodeNoiseSites,
  lpDisplay,
  mcs020aLpLe,
  mcs020aLpLeFn,
  type UnitAt,
} from './fns/noise.ts';

/** MCS 020 a) worked example: LwA 60, Q 4, r 8.0 m, brick wall with partial view: 32.0 dB(A). */
const golden: UnitAt = { lwaDdB: 600, surfaces: 2, rDm: 80, barrier: { type: 1, view: 'partly' } };

describe('C1 mcs020a_Lp_le golden (AC-8)', () => {
  it('the enclosure of the worked example lies inside [31.95, 32.05)', () => {
    const lp = lpDisplay([golden]);
    expect(lp.lo).toBeGreaterThanOrEqual(31.95);
    expect(lp.hi).toBeLessThan(32.05);
    expect(lp.lo).toBeLessThanOrEqual(lp.hi);
  });
  it('32.0 passes; the same unit 5.1 dB louder fails, 4.9 dB louder passes', () => {
    expect(decidePosition([golden])).toBe(true);
    expect(decidePosition([{ ...golden, lwaDdB: 651 }])).toBe(false);
    expect(decidePosition([{ ...golden, lwaDdB: 649 }])).toBe(true);
  });
  it('two equal units add 3 dB; more than three reflecting surfaces fails outright', () => {
    const two = lpDisplay([golden, golden]);
    expect(two.lo).toBeGreaterThan(34.9);
    expect(two.hi).toBeLessThan(35.1);
    expect(decidePosition([{ ...golden, surfaces: 4 }])).toBe(false);
  });
  it('every position must pass; none is a pass (as in Lean)', () => {
    expect(mcs020aLpLe([[golden], [{ ...golden, lwaDdB: 700 }]])).toBe(false);
    expect(mcs020aLpLe([])).toBe(true);
  });
  it('the fact encoding round-trips and drives the named function', () => {
    const sites = [[golden, { ...golden, barrier: { type: 'none' } as const }], [golden]];
    const s = encodeNoiseSites(sites);
    expect(decodeNoiseSites(s)).toEqual(sites);
    expect(mcs020aLpLeFn([encodeNoiseSites([[golden]])])).toBe(true);
    expect(mcs020aLpLeFn(['garbage'])).toBe('unknown');
    expect(
      evalExpr(
        { fn: 'mcs020a_Lp_le', args: [{ fact: 'm.ashp.noise' }] },
        { 'm.ashp.noise': 'unknown' },
        DEFAULT_FNS,
      ),
    ).toBe('unknown');
  });
  it('enclosure soundness against floats: a definite answer agrees with 10 log10 rounded to 0.1 dB', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 750 }),
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 5, max: 300 }),
        fc.constantFrom('n', '1h', '1p', '2f'),
        (lwa, surfaces, r, b) => {
          const barrier =
            b === 'n'
              ? ({ type: 'none' } as const)
              : ({
                  type: Number(b[0]) as 1 | 2,
                  view: b[1] === 'h' ? 'hidden' : b[1] === 'p' ? 'partly' : 'full',
                } as const);
          const u: UnitAt = { lwaDdB: lwa, surfaces, rDm: r, barrier };
          const d = decidePosition([u]);
          const lp = lpDisplay([u]);
          if (d === true) expect(lp.hi).toBeLessThan(37.06);
          if (d === false) expect(lp.lo).toBeGreaterThan(37.04);
        },
      ),
    );
  });
});

describe('C4 adf_category', () => {
  it('matches Diagram 3.1 corners and saturates', () => {
    expect(adfCategory(0, 0)).toBe('A');
    expect(adfCategory(0, 3)).toBe('B');
    expect(adfCategory(1, 6)).toBe('C');
    expect(adfCategory(9, 0)).toBe('C');
    expect(adfCategory(2, 40)).toBe('C');
  });
  it('is monotone in both arguments', () => {
    fc.assert(
      fc.property(fc.nat(8), fc.nat(10), fc.nat(8), fc.nat(10), (a, b, c, d) => {
        const [i, i2] = a <= c ? [a, c] : [c, a];
        const [j, j2] = b <= d ? [b, d] : [d, b];
        expect(adfRank(adfCategory(i, j))).toBeLessThanOrEqual(adfRank(adfCategory(i2, j2)));
      }),
    );
  });
  it('named form compares against a k.adf rank', () => {
    expect(adfCategoryFn([1, 1, K_FACTS['k.adf.B']])).toBe(true);
    expect(adfCategoryFn([1, 1, K_FACTS['k.adf.C']])).toBe(false);
    expect(adfCategoryFn(['x', 1, 1])).toBe('unknown');
  });
});

describe('mees_cap, dt_hosting, ens_retv', () => {
  it('mees cap: 10,000 pounds, or 10% of a value under 100,000 pounds', () => {
    expect(meesCapMp(250_000n)).toBe(10_000n * 100_000_000n);
    expect(meesCapMp(80_000n)).toBe(8_000n * 100_000_000n);
    expect(meesCapFn([10_000 * 100_000_000, 250_000])).toBe(true);
    expect(meesCapFn([10_001 * 100_000_000, 250_000])).toBe(false);
    expect(meesCapFn([8_001 * 100_000_000, 80_000])).toBe(false);
  });
  it('dt hosting: at most half the transformer rating, exact at the boundary', () => {
    expect(dtHostingFn([45, 5, 100])).toBe(true);
    expect(dtHostingFn([45, 5.1, 100])).toBe(false);
    expect(dtHostingFn([0.1, 0.2, 0.6])).toBe(true);
  });
  it('ens retv: composite coefficients, limit 15', () => {
    const r = ensRetv({ climate: 'composite', envelopeM2: 100, opaque: 100, glazingU: 50, glazingSolar: 10 });
    expect(Q.toNumber(r)).toBeCloseTo((6.06 * 100 + 1.85 * 50 + 68.99 * 10) / 100, 9);
    expect(ensRetvFn(['composite', 100, 100, 50, 10, 15])).toBe(true);
    expect(ensRetvFn(['composite', 100, 100, 50, 10, 12])).toBe(false);
    expect(ensRetvFn(['cold', 100, 1, 1, 1, 15])).toBe('unknown');
  });
});
