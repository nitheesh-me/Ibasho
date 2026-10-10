/**
 * Unit and property tests for finance, Pareto and the certificate wire (WP-02, M-0).
 */
import {
  applyFactor,
  discountFactors,
  FUELS,
  type Fuel,
  type GrantPlugin,
  type OwnerCtx,
  type PackageSpec,
} from '@ibasho/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyGrants, cashFlows, lifecycle, netUpfront } from '../src/finance/index.ts';
import { dominates, type Outcome, paretoFront, picks, witnesses } from '../src/search/pareto.ts';
import { packageId, planGroups, rowChoice } from '../src/search/plan.ts';
import { base64, decodeI64, decodeU32, fromBase64, i64b64, u32b64 } from '../src/search/wire.ts';
import { gh1 } from './gh1.ts';

const owner: OwnerCtx = { tenure: 'owner', discountRatePpb: 35_000_000n, horizonYears: 25 };
const pkg: PackageSpec = { id: 'heat-ashp', options: { heat: 'heat-ashp' } };
const zeroSaving = () => Object.fromEntries(FUELS.map((f) => [f, 0n])) as Record<Fuel, bigint>;

function grant(
  id: string,
  amount: bigint,
  stacksWith: string[],
  validTo?: `${number}-${number}-${number}`,
): GrantPlugin {
  return {
    kind: 'grant',
    id,
    version: '0.1.0',
    title: id,
    side: 'engine',
    ...(validTo ? { validTo } : {}),
    eligible: () => ({ amount, conditions: [], stacksWith }),
  };
}

describe('grants (SF 6 stacking, Lean grants_le_cost)', () => {
  const ctx = { twin: gh1, owner, pkg, asOf: '2026-10-11' as const, grossCost: 10_000n };
  it('non-stacking grants: the larger wins', () => {
    const g = applyGrants([grant('a', 3_000n, []), grant('b', 5_000n, [])], ctx);
    expect(g.map((x) => x.grantId)).toEqual(['b']);
  });
  it('stacking grants add up but never exceed the cost', () => {
    const g = applyGrants([grant('a', 6_000n, ['b']), grant('b', 7_000n, [])], ctx);
    expect(g.map((x) => [x.grantId, x.amount])).toEqual([
      ['b', 7_000n],
      ['a', 3_000n],
    ]);
  });
  it('an expired grant is never applied (SF 10 injection)', () => {
    expect(applyGrants([grant('old', 5_000n, [], '2026-03-31')], ctx)).toEqual([]);
  });
  it('N0 is never negative', () => {
    expect(netUpfront(100n, 300n)).toBe(0n);
    expect(netUpfront(300n, 100n)).toBe(200n);
  });
});

describe('cash flows (SF 5.2)', () => {
  it('replacements at multiples of the lifetime, residual value of the last install', () => {
    expect(lifecycle({ optionId: 'x', cost: 1_800n, lifetimeYears: 18 }, 25)).toEqual({
      replacements: [{ atYear: 18, cost: 1_800n }],
      residual: 1_100n,
    });
    expect(lifecycle({ optionId: 'y', cost: 400n, lifetimeYears: 40 }, 25)).toEqual({
      replacements: [],
      residual: 150n,
    });
    expect(
      lifecycle({ optionId: 'z', cost: 100n, lifetimeYears: 5 }, 25).replacements.map((r) => r.atYear),
    ).toEqual([5, 10, 15, 20]);
  });

  it('NPV is -N0 plus discounted savings; the saving sign flows through (SF 10: flipped sign)', () => {
    const s = zeroSaving();
    s.gas = 1_000n;
    s.electricity = -400n;
    const f = cashFlows({
      billSavingByFuel: s,
      installed: [],
      n0: 5_000n,
      discountRatePpb: 35_000_000n,
      horizonYears: 25,
    });
    const D = discountFactors(35_000_000n, 25);
    let npv = -5_000n;
    for (let t = 1; t <= 25; t++) npv += applyFactor(600n, D[t]!);
    expect(f.b.every((b) => b === 600n)).toBe(true);
    expect(f.npv).toBe(npv);
    const flipped = cashFlows({
      billSavingByFuel: { ...s, gas: -1_000n },
      installed: [],
      n0: 5_000n,
      discountRatePpb: 35_000_000n,
      horizonYears: 25,
    });
    expect(flipped.npv).toBeLessThan(f.npv);
  });

  it('escalation uses the growth recurrence per fuel', () => {
    const s = zeroSaving();
    s.gas = 1_000_000n;
    const f = cashFlows({
      billSavingByFuel: s,
      escalationPpb: { gas: 20_000_000n },
      installed: [],
      n0: 0n,
      discountRatePpb: 0n,
      horizonYears: 2,
    });
    expect(f.b).toEqual([1_020_000n, 1_040_400n]);
  });
});

const outcome = fc.record({
  n0: fc.bigInt({ min: 0n, max: 20n }),
  carbon: fc.bigInt({ min: 0n, max: 20n }),
  npv: fc.bigInt({ min: -20n, max: 20n }),
});
const outcomes = fc
  .array(outcome, { minLength: 1, maxLength: 40 })
  .map((xs) => xs.map((x, row) => ({ row, ...x })));

describe('Pareto (R7, R8; LV 6.4 checkFront, witnesses, lexMin_nondominated)', () => {
  it('the front is sound and complete', () => {
    fc.assert(
      fc.property(outcomes, (cands) => {
        const front = paretoFront(cands);
        const on = new Set(front.map((f) => f.row));
        for (const f of front) for (const q of cands) expect(dominates(q, f)).toBe(false);
        for (const q of cands) if (!on.has(q.row)) expect(cands.some((r) => dominates(r, q))).toBe(true);
      }),
    );
  });

  it('every package off the front has a front witness that dominates it', () => {
    fc.assert(
      fc.property(outcomes, (cands) => {
        const front = paretoFront(cands);
        const w = witnesses(cands, front);
        const byRow = new Map(cands.map((c) => [c.row, c]));
        for (const [row, wr] of w) expect(dominates(byRow.get(wr)!, byRow.get(row)!)).toBe(true);
        expect(w.size + front.length).toBe(cands.length);
      }),
    );
  });

  it('picks lie on the front, satisfy their objective, and skip the empty package', () => {
    fc.assert(
      fc.property(outcomes, (cands) => {
        const p = picks(cands, 0);
        const rest = cands.filter((c) => c.row !== 0);
        const on = new Set(paretoFront(cands).map((f) => f.row));
        if (rest.length === 0) {
          expect(p).toEqual({});
          return;
        }
        const get = (r: number | undefined) => cands.find((c) => c.row === r)!;
        for (const r of [p.leastUpfront, p.bestReturn, p.lowestRunningCarbon]) {
          expect(r).not.toBe(0);
          // A pick is non-dominated within the candidates (it may tie the empty package).
          for (const q of rest) expect(dominates(q, get(r))).toBe(false);
          if (!cands.some((q) => q.row === 0 && dominates(q, get(r)))) expect(on.has(r!)).toBe(true);
        }
        for (const q of rest) {
          expect(get(p.leastUpfront).n0 <= q.n0).toBe(true);
          expect(get(p.bestReturn).npv >= q.npv).toBe(true);
          expect(get(p.lowestRunningCarbon).carbon >= q.carbon).toBe(true);
        }
      }),
    );
  });

  it('least upfront breaks a cost tie by more carbon saved (the LV 6.4 bug class)', () => {
    const c: Outcome[] = [
      { row: 1, n0: 5n, carbon: 1n, npv: 9n },
      { row: 2, n0: 5n, carbon: 3n, npv: 0n },
    ];
    expect(picks(c, 0).leastUpfront).toBe(2);
  });
});

describe('plan and wire', () => {
  it('mixed radix rows cover the product once, last group fastest', () => {
    const groups = [
      { id: 'a', weight: 'heavy' as const, options: ['none', 'a1', 'a2'] },
      { id: 'b', weight: 'light' as const, options: ['none', 'b1'] },
    ];
    expect([0, 1, 2, 3, 4, 5].map((r) => rowChoice(groups, r).join(''))).toEqual([
      '00',
      '01',
      '10',
      '11',
      '20',
      '21',
    ]);
    expect(packageId(['none', 'b1', 'a2'])).toBe('a2+b1');
    expect(packageId(['none'])).toBe('baseline');
  });

  it('planGroups refuses a group that mixes heavy and light measures', () => {
    const m = (id: string, weight: 'heavy' | 'light') =>
      ({ id, group: 'g', weight, options: [{ id: `${id}-o`, title: '', params: {} }] }) as never;
    expect(() => planGroups([m('x', 'heavy'), m('y', 'light')])).toThrow(/mixes/);
  });

  it('base64 round trips and matches the standard alphabet', () => {
    expect(base64(Uint8Array.from([77, 97, 110]))).toBe('TWFu');
    expect(base64(Uint8Array.from([77, 97]))).toBe('TWE=');
    expect(base64(Uint8Array.from([77]))).toBe('TQ==');
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), (b) => {
        expect([...fromBase64(base64(b))]).toEqual([...b]);
      }),
    );
    fc.assert(
      fc.property(fc.array(fc.bigInt({ min: -(1n << 63n), max: (1n << 63n) - 1n })), (xs) => {
        expect(decodeI64(i64b64(xs))).toEqual(xs);
      }),
    );
    expect(decodeU32(u32b64([0, 1, 0xffffffff]))).toEqual([0, 1, 0xffffffff]);
  });
});
