/**
 * M-B pieces without new physics (WP-02): paybacks, IRR, loan, score, EPC band, flips, the
 * "If nothing is done" run and per-package negatives (SPEC 14). B4 injections, B5 dominance
 * property, B9 two-flip slab fixture, AC-B1, AC-B3.
 */
import {
  FUELS,
  type Fuel,
  type MaintenancePlugin,
  type Negative,
  PACKAGE_STATUS,
  Q,
  type SearchResult,
  type TariffPlugin,
} from '@ibasho/core';
import { ANCHORS, SCORE_DIMS, SCORE_WEIGHTS } from '@ibasho/spec-gen';
import { describe, expect, it } from 'vitest';
import {
  annuityMonthly,
  cashFlows,
  discountedPayback,
  flowTerms,
  irr,
  loanView,
  npvAt,
  signChanges,
  simplePayback,
} from '../src/finance/index.ts';
import { flips } from '../src/flips/index.ts';
import { indicatorsOf, type ScoreIndicators, scoreOf, specQ, unitScore } from '../src/score/index.ts';
import type { RowMoney } from '../src/search/bookkeeping.ts';
import type { SearchState } from '../src/search/run.ts';
import { gh1, readyEngine, request } from './gh1.ts';

const POUND = 100_000_000n;

describe('paybacks, IRR and loan (SF 5.2)', () => {
  it('simple payback is N0 / B_1 exactly; immediate and never at the edges', () => {
    expect(simplePayback(0n, 5n)).toEqual({ kind: 'immediate' });
    expect(simplePayback(100n, 0n)).toEqual({ kind: 'never' });
    expect(simplePayback(100n, -1n)).toEqual({ kind: 'never' });
    const s = simplePayback(1000n * POUND, 300n * POUND);
    expect(s.kind === 'years' && Q.eq(s.years, Q.of(10, 3))).toBe(true);
  });

  it('discounted payback is the first year the discounted savings reach N0', () => {
    expect(discountedPayback(300n, [100n, 100n, 100n], 0n)).toEqual({ kind: 'year', year: 3 });
    expect(discountedPayback(301n, [100n, 100n, 100n], 0n)).toEqual({ kind: 'not-within-horizon' });
  });

  it('npvAt reproduces cashFlows at the owner rate (same rounding points)', () => {
    const installed = [{ optionId: 'x', cost: 900n * POUND, lifetimeYears: 10 }];
    const bill = Object.fromEntries(FUELS.map((f) => [f, 0n])) as Record<Fuel, bigint>;
    bill.gas = 150n * POUND;
    const flows = cashFlows({
      billSavingByFuel: bill,
      installed,
      n0: 900n * POUND,
      discountRatePpb: 35_000_000n,
      horizonYears: 25,
    });
    expect(npvAt(flowTerms(900n * POUND, flows, installed), 35_000_000n)).toBe(flows.npv);
  });

  it('npvAt rounds each replacement on its own when two fall in the same year', () => {
    // Two 1 micro-pence items replaced in year 10: each discounts to 1 (0.709 rounds up), the sum
    // of 2 would discount to 1. cashFlows rounds per replacement, so npvAt must too.
    const installed = [
      { optionId: 'a', cost: 1n, lifetimeYears: 10 },
      { optionId: 'b', cost: 1n, lifetimeYears: 10 },
    ];
    const bill = Object.fromEntries(FUELS.map((f) => [f, 0n])) as Record<Fuel, bigint>;
    const flows = cashFlows({
      billSavingByFuel: bill,
      installed,
      n0: 2n,
      discountRatePpb: 35_000_000n,
      horizonYears: 15,
    });
    expect(npvAt(flowTerms(2n, flows, installed), 35_000_000n)).toBe(flows.npv);
  });

  it('IRR on one sign change matches the textbook root (B4 IRR injection: two sign changes give n/a)', () => {
    // -1000, then 1100 in year 1: IRR is exactly 10%.
    const one = irr({ n0: 1000n * POUND, b: [1100n * POUND], replacements: [0n], residual: 0n });
    expect(one.kind).toBe('rate');
    if (one.kind === 'rate') expect(Number(one.ppb - 100_000_000n)).toBeLessThanOrEqual(1000);
    // -100, +230, -132: two sign changes (roots 10% and 20%): never reported.
    const two = irr({
      n0: 100n * POUND,
      b: [230n * POUND, 0n],
      replacements: [0n, 132n * POUND],
      residual: 0n,
    });
    expect(two).toEqual({ kind: 'n/a', reason: 'sign-changes' });
    expect(signChanges([-1n, 2n, 0n, -3n])).toBe(2);
  });

  it('loan annuity: 0% is L / n; 6% over 120 months on 10,000 pounds is 111.02 pounds', () => {
    expect(annuityMonthly(12_000n * POUND, 0n, 120)).toBe(100n * POUND);
    const m = annuityMonthly(10_000n * POUND, 60_000_000n, 120);
    expect(m / 1_000_000n).toBe(11_102n); // pence
    const v = loanView(
      [
        {
          kind: 'finance',
          id: 'l',
          version: '0.1.0',
          title: 't',
          side: 'engine',
          product: 'loan',
          aprPpb: 0n,
          termMonths: 120,
          maxAmount: 15_000n * POUND,
        } as never,
      ],
      20_000n * POUND,
      1_500n * POUND,
    );
    expect(v?.principal).toBe(15_000n * POUND);
    expect(v?.monthly).toBe(125n * POUND);
    expect(v?.cashPositiveM1).toBe(true); // 12 x 125 = 1,500 <= B_1
  });
});

describe('score (SPEC R2, section 8; Lean Score.lean)', () => {
  it('weights are exact and sum to one (B4: a weight of 0.21 would fail)', () => {
    const sum = Q.sum(SCORE_DIMS.map((d) => specQ(SCORE_WEIGHTS[d])));
    expect(Q.eq(sum, Q.ONE)).toBe(true);
    const bad = Q.sum(SCORE_DIMS.map((d) => (d === 'F' ? Q.of(21, 100) : specQ(SCORE_WEIGHTS[d]))));
    expect(Q.eq(bad, Q.ONE)).toBe(false);
  });

  it('best anchors score 100 and worst score 0 on every dimension; Lean spot check F = 12/5 gives 1/2', () => {
    const a = ANCHORS.uk['per-area'];
    for (const d of SCORE_DIMS) {
      expect(Q.eq(unitScore(d, specQ(a[d].best), 'uk', 'per-area'), Q.ONE)).toBe(true);
      expect(Q.eq(unitScore(d, specQ(a[d].worst), 'uk', 'per-area'), Q.ZERO)).toBe(true);
    }
    expect(Q.eq(unitScore('F', Q.of(12, 5), 'uk', 'burden'), Q.of(1, 2))).toBe(true);
  });

  it('B5: a home at least as good on every indicator never scores lower (random pairs)', () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 300; i++) {
      const raw = {
        hlpWm2K: 0.5 + 4 * rnd(),
        carbonKgM2: 90 * rnd(),
        energyKWhM2: 20 + 400 * rnd(),
        costGbpM2: 2 + 45 * rnd(),
        etaPe: 0.3 + 2.5 * rnd(),
        fRen: rnd(),
        kSmart: Math.floor(5 * rnd()),
        comfort: { hotHours: 400 * rnd(), coldHours: 1200 * rnd() },
      };
      const better = {
        ...raw,
        hlpWm2K: raw.hlpWm2K * rnd(),
        carbonKgM2: raw.carbonKgM2 * rnd(),
        etaPe: raw.etaPe + rnd(),
        kSmart: Math.min(4, raw.kSmart + 1),
        comfort: { hotHours: raw.comfort.hotHours * rnd(), coldHours: raw.comfort.coldHours },
      };
      const a = scoreOf(indicatorsOf(raw));
      const b = scoreOf(indicatorsOf(better));
      expect(Q.le(a.total.lo, b.total.lo)).toBe(true);
      expect(Q.le(Q.ZERO, a.total.lo) && Q.le(a.total.hi, Q.of(100))).toBe(true);
    }
  });

  it('unknown comfort makes T, the comfort group and the total ranges; exact once known', () => {
    const raw = {
      hlpWm2K: 2,
      carbonKgM2: 40,
      energyKWhM2: 200,
      costGbpM2: 20,
      etaPe: 0.75,
      fRen: 0,
      kSmart: 0,
    };
    const r = scoreOf(indicatorsOf(raw));
    expect(r.exact).toBe(false);
    expect(Q.toNumber(Q.sub(r.total.hi, r.total.lo))).toBe(10); // T weight 1/10 of 100
    const ind: ScoreIndicators = indicatorsOf({ ...raw, comfort: { hotHours: 0, coldHours: 0 } });
    const e = scoreOf(ind);
    expect(e.exact).toBe(true);
    expect(Q.eq(e.total.lo, e.total.hi)).toBe(true);
    // Total is the group-weighted mean of the groups (Lean score_eq_groups).
    const g = e.group;
    const viaGroups = Q.sum([
      Q.mul(Q.of(3, 10), g['fabric-heating'].lo),
      Q.mul(Q.of(3, 10), g['running-cost'].lo),
      Q.mul(Q.of(3, 10), g.carbon.lo),
      Q.mul(Q.of(1, 10), g.comfort.lo),
    ]);
    expect(Q.eq(viaGroups, e.total.lo)).toBe(true);
  });
});

const boilerDecay: MaintenancePlugin = {
  kind: 'maintenance',
  id: 'test-decay-boiler',
  version: '0.1.0',
  title: 'maintenance.boiler.title',
  side: 'engine',
  ages: { kind: 'system', category: 'boiler' },
  neglect: 'maintenance.boiler.neglect',
  effects: [
    {
      param: '/systems/space/efficiency',
      unit: '1',
      rate: { form: 'relative', ppbPerYear: { lo: -15_000_000n, mid: -10_000_000n, hi: -5_000_000n } },
      clamp: { min: Q.of(60, 100) },
      quantity: 'sys.efficiency.space',
      explain: 'maintenance.boiler.efficiency',
    },
  ],
  endOfLife: {
    ageYears: { lo: 12, mid: 15, hi: 20 },
    replaceWithSystemId: 'gas-combi-condensing',
    explain: 'maintenance.boiler.eol',
  },
  provenance: {
    sources: [{ id: 'test-source', title: 'Test decay source', retrieved: '2026-10-01' }],
    lastChecked: '2026-10-01',
    grade: 'estimate',
  },
};
const loftDecay: MaintenancePlugin = {
  ...boilerDecay,
  id: 'test-decay-draught',
  ages: { kind: 'measure', measureId: 'draught' },
  effects: [{ ...boilerDecay.effects[0]!, param: '/ventilation/draughtProofedFrac' }],
};
delete (loftDecay as Partial<MaintenancePlugin>).endOfLife;

const engine = await readyEngine({ plugins: [boilerDecay, loftDecay] });
const res: SearchResult = await (await engine.search(request())).result;
const state = engine.stateOf(res.hash)!;

describe('search outputs for shown packages', () => {
  const shown = [0, ...res.front, ...Object.values(res.picks)].map((r) => res.packages.ids[r]!);
  const nodeOf = (pkg: string, q: string) =>
    res.graph.nodes.find((n) => n.subject.packageId === pkg && n.quantity === q);

  it('every shown package has a negatives entry, the baseline an empty one', () => {
    expect(res.negatives).toBeDefined();
    for (const id of shown) expect(res.negatives![id]).toBeDefined();
    expect(res.negatives!.baseline).toEqual([]);
  });

  it('score, sub-scores, groups and the estimated band are in the eager graph', () => {
    for (const id of shown) {
      expect(nodeOf(id, 'score.total')).toBeDefined();
      for (const d of SCORE_DIMS) expect(nodeOf(id, `score.sub.${d}`)).toBeDefined();
      expect(nodeOf(id, 'score.group.fabric-heating')).toBeDefined();
      expect(nodeOf(id, 'epc.band_est')).toBeDefined();
    }
    const b = state.extras.get(0)!;
    expect(b.score!.exact).toBe(false); // T waits for 5R1C comfort
    const t = b.score!.total;
    expect(Q.le(Q.ZERO, t.lo) && Q.le(t.hi, Q.of(100))).toBe(true);
    expect(['A', 'B', 'C', 'D', 'E', 'F', 'G']).toContain(b.epc!.band);
  });

  it('AC-B3: every worsening indicator of every shown package is in its negatives list', () => {
    const base = state.extras.get(0)!;
    for (const id of shown) {
      if (id === 'baseline') continue;
      const r = res.packages.ids.indexOf(id);
      const m: RowMoney = state.money[r]!;
      const x = state.extras.get(r)!;
      const neg: Negative[] = res.negatives![id]!;
      const has = (ind: string) => neg.some((n) => n.indicator === ind);
      for (const f of FUELS) {
        const a = m.saving[f].reduce((s, v) => s + v, 0n);
        expect(has(`acct.saving.${f}`)).toBe(a < 0n);
        expect(has(`money.bill.${f}`)).toBe(m.billSavingByFuel[f] < 0n);
      }
      expect(has('fin.npv')).toBe(m.flows.npv < 0n);
      expect(has('fin.b.1')).toBe((m.flows.b[0] ?? 0n) < 0n);
      expect(has('acct.carbon_saving')).toBe(m.carbonAnnualG < 0n);
      expect(has('score.total')).toBe(Q.lt(x.score!.total.lo, base.score!.total.lo));
      for (const n of neg) expect(res.graph.nodes.some((g) => g.id === n.evidence)).toBe(true);
    }
  });

  it('lazy negatives exist for a package outside the eager set and point at lazy evidence', async () => {
    const eager = new Set(shown);
    const other = res.packages.ids.find((id) => !eager.has(id));
    if (!other) return;
    const out = await engine.negatives!(res.hash, [other]);
    expect(out[other]).toBeDefined();
    const nodes = await engine.evidence(
      res.hash,
      out[other]!.map((n) => n.evidence),
    );
    expect(nodes).toHaveLength(out[other]!.length);
  });

  it('the heat pump raises electricity: a fuel-rise negative (lazy if not shown)', async () => {
    const hp = res.packages.ids.find((id) => id === 'heat-ashp');
    if (!hp) return;
    const out = await engine.negatives!(res.hash, [hp]);
    expect(out[hp]!.some((n) => n.kind === 'fuel-rise' && n.indicator === 'acct.saving.electricity')).toBe(
      true,
    );
  });

  it('EPC band target uses the rating proxy (no longer refused)', async () => {
    const r = await (await engine.search(request({ target: { kind: 'epc-band-at-least', band: 'G' } })))
      .result;
    const feasible = [...r.packages.status].filter((s) => s === PACKAGE_STATUS.feasible).length;
    expect(feasible).toBeGreaterThan(0);
  });
});

describe('flips (B9 and GH1)', () => {
  /** Slab tariff whose first slab is 10 micro-pence per Wh. */
  const slabGas: TariffPlugin = {
    kind: 'tariff',
    id: 'test-slab-gas',
    version: '0.1.0',
    title: 't',
    side: 'engine',
    fuel: 'gas',
    currency: 'GBP',
    bill: (wh: bigint[]) => ({
      total: 0n,
      byMonth: wh.map(() => 0n),
      slabs: {
        period: 'year',
        slabs: [
          { uptoWh: 1000n, price: 10n },
          { uptoWh: null, price: 12n },
        ],
        standingPerDay: 0n,
      },
    }),
  } as unknown as TariffPlugin;
  const zero = () => Object.fromEntries(FUELS.map((f) => [f, 0n])) as Record<Fuel, bigint>;
  const row = (n0: bigint, gasWh: bigint, b0: bigint, carbon: bigint): RowMoney => {
    const saving = Object.fromEntries(
      FUELS.map((f) => [f, new Array<bigint>(12).fill(0n)]),
    ) as unknown as RowMoney['saving'];
    saving.gas[0] = gasWh;
    const bill = zero();
    bill.gas = b0;
    const flows = cashFlows({
      billSavingByFuel: bill,
      installed: [],
      n0,
      discountRatePpb: 0n,
      horizonYears: 1,
    });
    return {
      saving,
      billSavingByFuel: bill,
      n0,
      flows,
      installed: [],
      escalationPpb: {},
      carbonAnnualG: carbon,
      lifetimeCarbonG: carbon,
    } as unknown as RowMoney;
  };
  const fake = {
    req: { owner: { discountRatePpb: 0n, horizonYears: 1 }, target: { kind: 'default' } },
    env: { tariffs: new Map([['gas', slabGas]]) },
    rows: ['baseline', 'X', 'Y', 'Z'].map((id) => ({ id, options: {} })),
    money: [
      row(0n, 0n, 0n, 0n),
      row(100n, 0n, 300n, 900n),
      row(1000n, 100n, 1000n, 500n),
      row(5000n, 400n, 4000n, 100n),
    ],
    epc: [],
    result: { packages: { status: Uint8Array.from([0, 0, 0, 0]) } },
  } as unknown as SearchState;

  it('B9: a slab-tariff fixture with exactly two known flip points returns both', () => {
    const f = flips(fake, 'price.gas', { range: { lo: 1n, hi: 30n } });
    expect(f).toEqual([
      { param: 'price.gas', at: '0.013', pick: 'bestReturn', fromPackageId: 'X', toPackageId: 'Y' },
      { param: 'price.gas', at: '0.014', pick: 'bestReturn', fromPackageId: 'Y', toPackageId: 'Z' },
    ]);
  });

  it('GH1: each reported gas price flip changes the pick between adjacent grid values', async () => {
    const out = await engine.flips(res.hash, 'price.gas');
    for (const p of out) {
      expect(p.fromPackageId).not.toBe(p.toPackageId);
      expect(Number(p.at)).toBeGreaterThan(0);
    }
    const d = await engine.flips(res.hash, 'discount');
    for (const p of d) expect(p.fromPackageId).not.toBe(p.toPackageId);
  });
});

const dn = await engine.doNothing!({
  twin: gh1,
  owner: request().owner,
  asOf: request().asOf,
  reportYears: [0, 5, 10, 25],
});

describe('"If nothing is done" (SPEC 14, AC-B1)', () => {
  const ids = new Set(dn.graph.nodes.map((n) => n.id));

  it('reports the requested years and lists models that matched nothing', () => {
    expect(dn.years.map((y) => y.year)).toEqual([0, 5, 10, 25]);
    expect(dn.notApplicable).toContain('test-decay-draught'); // GH1 has no draught-proofing done
    expect(dn.horizonYears).toBe(25);
  });

  it('AC-B1: every value is an evidence node and reaches a decay source', () => {
    const all = [
      ...dn.years.flatMap((y) => [y.bill, y.carbon, ...Object.values(y.deliveredWh)]),
      ...dn.effects.flatMap((e) => [e.evidence, e.band!.lo, e.band!.hi]),
      ...dn.replacements.flatMap((r) => [r.evidence, ...(r.cost ? [r.cost] : [])]),
      dn.totals.costNpv,
      dn.totals.carbon,
      ...dn.negatives.map((n) => n.evidence),
    ];
    for (const id of all) expect(ids.has(id)).toBe(true);
    const byId = new Map(dn.graph.nodes.map((n) => [n.id, n]));
    const reachesDecay = (id: string, seen = new Set<string>()): boolean => {
      if (seen.has(id)) return false;
      seen.add(id);
      const n = byId.get(id as never);
      if (!n) return false;
      if (n.provenance.plugin?.id === 'test-decay-boiler' && (n.provenance.sources?.length ?? 0) > 0)
        return true;
      return n.inputs.some((i) => reachesDecay(i.id, seen));
    };
    for (const y of dn.years.filter((y) => y.year > 0)) expect(reachesDecay(y.bill)).toBe(true);
  });

  it('the boiler drifts, gas rises, and the replacement falls due at the central end of life', () => {
    expect(
      dn.negatives.some((n) => n.kind === 'performance' && n.maintenanceId === 'test-decay-boiler'),
    ).toBe(true);
    expect(
      dn.negatives.some((n) => n.kind === 'fuel-rise' && n.indicator === 'donothing.delivered.gas'),
    ).toBe(true);
    const r = dn.replacements[0]!;
    expect(r.dueYear).toEqual({ lo: 3, mid: 6, hi: 11 }); // installed 2017, age 9 in 2026
    expect(r.cost).toBeDefined();
  });

  it('is deterministic', async () => {
    const again = await engine.doNothing!({
      twin: gh1,
      owner: request().owner,
      asOf: request().asOf,
      reportYears: [0, 5, 10, 25],
    });
    expect(again.hash).toBe(dn.hash);
  });
});
