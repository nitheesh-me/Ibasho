/**
 * M-0 step 3 (WP-02): the GH1 search over 8 packages, fixed-point bookkeeping, front, witnesses,
 * picks, certificate input and lazy evidence.
 */
import {
  applyFactor,
  canonicalJson,
  discountFactors,
  FUELS,
  MONTHS,
  PACKAGE_STATUS,
  RUN_MODES,
  roundHalfEven,
  type SearchResult,
} from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { ukCapElectricity2026q4, ukCapGas2026q4 } from '../../../packs/money-uk/src/engine/tariffs.ts';
import { NotImplementedYet } from '../src/api.ts';
import { dominates, NO_WITNESS } from '../src/search/pareto.ts';
import { BUILTIN_MEMORY, BUILTIN_TARGET } from '../src/search/run.ts';
import { decodeI64, decodeU8, decodeU32 } from '../src/search/wire.ts';
import { ASOF, allPlugins, gh1, readyEngine, request } from './gh1.ts';

const engine = await readyEngine();
const run = async (req = request()): Promise<SearchResult> => (await engine.search(req)).result;
const res = await run();
const row = (id: string) => {
  const r = res.packages.ids.indexOf(id);
  if (r < 0) throw new Error(`no row ${id}`);
  return r;
};
const POUND = 100_000_000n;

describe('plan (M-0 slice)', () => {
  it('enumerates 2 x 2 x 2 = 8 packages, row 0 is the empty package', () => {
    expect(res.packages.ids).toHaveLength(8);
    expect(res.packages.ids[0]).toBe('baseline');
    expect(new Set(res.packages.ids).size).toBe(8);
    expect(res.packages.ids).toContain('draught-proofing-chimney-balloon+heat-ashp+loft-300');
  });

  it('keys heavy runs by heavy options and DHW class (the heat pump makes a cylinder)', () => {
    expect(res.heavy.keys).toHaveLength(8);
    expect(res.heavy.keys).toContain('baseline|dhw=combi');
    expect(res.heavy.keys).toContain('baseline|dhw=cylinder');
    expect(res.heavy.deliveredWh['your-home']).toHaveLength(8 * FUELS.length * 12);
    expect(res.packages.lightGroups).toEqual(['heat']);
  });

  it('with every M-0 option registered, the product is 3 x 2 x 3 = 18', async () => {
    const full = await readyEngine({}, true);
    const r = await (await full.search(request())).result;
    expect(r.packages.ids).toHaveLength(18);
  });
});

describe('bookkeeping (fixed point, your-home)', () => {
  const base = res.baseline['your-home'].deliveredWh;
  const sim = (id: string) => engine.stateOf(res.hash)!.money[row(id)]!;

  it('savings are before minus after per fuel and month, signs kept (acct.saving)', () => {
    const hp = sim('heat-ashp');
    let gas = 0n;
    let elec = 0n;
    for (const m of MONTHS) {
      gas += hp.saving.gas[m]!;
      elec += hp.saving.electricity[m]!;
    }
    expect(gas).toBeGreaterThan(0n);
    expect(elec).toBeLessThan(0n); // a heat pump uses more electricity
  });

  it('bills are slab exact: Wh times micro-pence per Wh plus standing charge', () => {
    const b = sim('baseline').bills;
    let gasWh = 0n;
    let elecWh = 0n;
    for (const m of MONTHS) {
      gasWh += base.gas[m]!;
      elecWh += base.electricity[m]!;
    }
    expect(b.byFuel.gas).toBe(gasWh * 7_970n + 365n * 29_680_000n);
    expect(b.byFuel.electricity).toBe(elecWh * 26_320n + 365n * 54_830_000n);
  });

  it('loft 300: N0 is the BP 6.1 cost at 0% VAT; NPV re-derives by hand', () => {
    const m = sim('loft-300');
    expect(m.grossCost).toBe(720n * POUND); // 300 + 10 * 42 m2
    expect(m.grantTotal).toBe(0n);
    expect(m.n0).toBe(720n * POUND);
    const D = discountFactors(35_000_000n, 25);
    const B = m.billSaving;
    expect(m.flows.b[0]).toBe(B);
    let npv = -m.n0;
    for (let t = 1; t <= 25; t++) npv += applyFactor(B, D[t]!);
    // Lifetime 40 > 25: residual value 720 * 15 / 40 = 270 pounds at year 25, no replacement.
    npv += applyFactor(roundHalfEven(720n * POUND * 15n, 40n), D[25]!);
    expect(m.flows.npv).toBe(npv);
    expect(m.flows.npv).toBeGreaterThan(0n);
  });

  it('the heat pump gets BUS and is replaced once inside 25 years (lifetime 18)', () => {
    const m = sim('heat-ashp');
    expect(m.grants.map((g) => g.grantId)).toEqual(['grant-bus']);
    expect(m.grantTotal).toBe(7_500n * POUND);
    expect(m.n0).toBe(m.grossCost - 7_500n * POUND);
    const D = discountFactors(35_000_000n, 25);
    let npv = -m.n0;
    for (let t = 1; t <= 25; t++) npv += applyFactor(m.billSaving, D[t]!);
    npv -= applyFactor(m.grossCost, D[18]!);
    npv += applyFactor(roundHalfEven(m.grossCost * 11n, 18n), D[25]!);
    expect(m.flows.npv).toBe(npv);
  });

  it('carbon is per (fuel, month) with SAP 10.2 monthly factors, rounded once to grams', () => {
    const m = sim('draught-proofing-chimney-balloon+loft-300');
    const elec = [163n, 160n, 153n, 143n, 132n, 120n, 111n, 112n, 122n, 136n, 151n, 163n].map(
      (g) => g * 1000n,
    );
    let ug = 0n;
    for (const mo of MONTHS) ug += m.saving.gas[mo]! * 210_000n + m.saving.electricity[mo]! * elec[mo]!;
    expect(m.carbonAnnualG).toBe(roundHalfEven(ug, 1_000_000n));
    let gas = 0n;
    let el = 0n;
    for (const mo of MONTHS) {
      gas += m.saving.gas[mo]!;
      el += m.saving.electricity[mo]!;
    }
    expect(m.lifetimeCarbonG).toBe(roundHalfEven(25n * (gas * 210_000n + el * 136_000n), 1_000_000n));
  });

  it('a package is recomputed whole: loft plus draught saving is not the sum of the two', () => {
    const both = sim('draught-proofing-chimney-balloon+loft-300').billSaving;
    const sum = sim('loft-300').billSaving + sim('draught-proofing-chimney-balloon').billSaving;
    expect(both).not.toBe(sum);
  });

  it('the table columns match the bookkeeping', () => {
    const st = engine.stateOf(res.hash)!;
    st.money.forEach((m, r) => {
      expect(res.packages.n0[r]).toBe(m.n0);
      expect(res.packages.npv[r]).toBe(m.flows.npv);
      expect(res.packages.carbonSaved[r]).toBe(m.lifetimeCarbonG);
    });
  });
});

describe('rules, target and status', () => {
  it('GH1 does not know if its supply is looped: every heat pump package is needs-check', () => {
    res.packages.ids.forEach((id, r) => {
      if (id.includes('heat-ashp')) {
        expect(res.packages.status[r]).toBe(PACKAGE_STATUS['needs-check']);
        expect(res.packages.ruleIds[r]).toContain('UK.DNO.HP.LOOPED');
      }
    });
  });

  it('the empty package misses the default target (saves nothing)', () => {
    expect(res.packages.status[0]).toBe(PACKAGE_STATUS['target-miss']);
    expect(res.packages.ruleIds[0]).toEqual([BUILTIN_TARGET]);
  });

  it('fabric packages are feasible and in the target set', () => {
    for (const id of [
      'loft-300',
      'draught-proofing-chimney-balloon',
      'draught-proofing-chimney-balloon+loft-300',
    ])
      expect(res.packages.status[row(id)]).toBe(PACKAGE_STATUS.feasible);
  });

  it('a recorded DNO approval moves heat pump packages into the target set or a target miss', async () => {
    const twin = {
      ...gh1,
      checks: [{ kind: 'dno-approval' as const, at: '2026-09-01' as const, result: 'pass' as const }],
    };
    const r = await run(request({ twin }));
    for (const [i, id] of r.packages.ids.entries())
      if (id.includes('heat-ashp')) expect(r.packages.status[i]).not.toBe(PACKAGE_STATUS['needs-check']);
  });

  it('memory: a rejected option blocks every package with it, and never reaches the front', async () => {
    const r = await run(request({ memory: { rejected: ['loft-300'], completed: [] } }));
    r.packages.ids.forEach((id, i) => {
      if (id.includes('loft-300')) {
        expect(r.packages.status[i]).toBe(PACKAGE_STATUS.blocked);
        expect(r.packages.ruleIds[i]).toContain(BUILTIN_MEMORY);
        expect([...r.front]).not.toContain(i);
      }
    });
  });

  it('budget (R24): no budget never blocks; a tiny budget blocks everything but the empty package', async () => {
    const r = await run(request({ owner: { ...request().owner, budget: 100n * POUND } }));
    r.packages.ids.forEach((id, i) => {
      if (id !== 'baseline') {
        expect(r.packages.status[i]).toBe(PACKAGE_STATUS.blocked);
        expect(r.packages.ruleIds[i]).toContain('BUILTIN.BUDGET');
      }
    });
    expect(r.front).toHaveLength(0);
    expect(r.picks).toEqual({});
  });

  it('the EPC band target reads the rating proxy; band A is out of reach for GH1 (never guessed)', async () => {
    // A separate engine, so the shared one keeps its four remembered results.
    const other = await readyEngine();
    const r = await (await other.search(request({ target: { kind: 'epc-band-at-least', band: 'A' } })))
      .result;
    expect([...r.packages.status].includes(PACKAGE_STATUS.feasible)).toBe(false);
    expect(r.picks).toEqual({});
  });
});

describe('front, witnesses, picks (R7, R8)', () => {
  const st = engine.stateOf(res.hash)!;
  const o = (r: number) => ({
    row: r,
    n0: st.money[r]!.n0,
    carbon: st.money[r]!.lifetimeCarbonG,
    npv: st.money[r]!.flows.npv,
  });
  const feasible = res.packages.ids.flatMap((_, r) =>
    res.packages.status[r] === PACKAGE_STATUS.feasible ? [r] : [],
  );

  it('the front is exactly the non-dominated feasible packages', () => {
    expect(res.front.length).toBeGreaterThan(0);
    for (const f of res.front) {
      expect(res.packages.status[f]).toBe(PACKAGE_STATUS.feasible);
      for (const q of feasible) expect(dominates(o(q), o(f))).toBe(false);
    }
    for (const q of feasible) {
      if ([...res.front].includes(q)) continue;
      expect(feasible.some((r) => dominates(o(r), o(q)))).toBe(true);
    }
  });

  it('every feasible package off the front has a dominating front witness; others have none', () => {
    res.packages.ids.forEach((_, r) => {
      const w = res.packages.witness[r]!;
      if (res.packages.status[r] === PACKAGE_STATUS.feasible && ![...res.front].includes(r)) {
        expect([...res.front]).toContain(w);
        expect(dominates(o(w), o(r))).toBe(true);
      } else expect(w).toBe(NO_WITNESS);
    });
  });

  it('picks lie on the front, inside the target set, and are never the empty package', () => {
    const p = res.picks;
    for (const r of [p.leastUpfront, p.bestReturn, p.lowestRunningCarbon]) {
      expect(r).toBeDefined();
      expect(r).not.toBe(0);
      expect([...res.front]).toContain(r);
    }
    const lu = o(p.leastUpfront!);
    for (const q of feasible.filter((x) => x !== 0)) expect(lu.n0 <= o(q).n0).toBe(true);
    const br = o(p.bestReturn!);
    for (const q of feasible.filter((x) => x !== 0)) expect(br.npv >= o(q).npv).toBe(true);
    const lc = o(p.lowestRunningCarbon!);
    for (const q of feasible.filter((x) => x !== 0)) expect(lc.carbon >= o(q).carbon).toBe(true);
  });

  it('no needs-check package is in the front; the lane lists them when they meet the target', () => {
    for (const f of res.front) expect(res.packages.status[f]).not.toBe(PACKAGE_STATUS['needs-check']);
    for (const r of res.needsCheck) expect(res.packages.status[r]).toBe(PACKAGE_STATUS['needs-check']);
  });
});

describe('certificate input (ibasho.cert/2)', () => {
  const c = res.certificate;

  it('carries the claimed columns exactly as the table', () => {
    expect(c.schema).toBe('ibasho.cert/2');
    expect(decodeU8(c.claimed.status)).toEqual([...res.packages.status]);
    expect(decodeI64(c.claimed.n0)).toEqual([...res.packages.n0]);
    expect(decodeI64(c.claimed.npv)).toEqual([...res.packages.npv]);
    expect(decodeI64(c.claimed.carbonSaved)).toEqual([...res.packages.carbonSaved]);
    expect(decodeU32(c.claimed.witness)).toEqual([...res.packages.witness]);
    expect(decodeU32(c.front)).toEqual([...res.front]);
    expect(decodeU32(c.needsCheck)).toEqual([...res.needsCheck]);
    expect(c.picks).toEqual(res.picks);
  });

  it('groups rebuild the package product (enum.complete) and carry facts and costs', () => {
    expect(c.groups.map((g) => g.id)).toEqual(['draught', 'heat', 'loft']);
    expect(c.groups.reduce((n, g) => n * g.options.length, 1)).toBe(res.packages.ids.length);
    expect(c.groups.find((g) => g.id === 'loft')!.facts['loft-300']!['c.mid']).toBe(
      (720n * POUND).toString(),
    );
    expect(c.groups.find((g) => g.id === 'heat')!.facts['heat-ashp']!['m.ashp.flowOk55']).toBe('unknown');
  });

  it('heavy plus light deltas rebuild every package delivered vector in every mode', async () => {
    const st = engine.stateOf(res.hash)!;
    const light = decodeI64(c.light.delivered);
    const heavy = RUN_MODES.map((m) => decodeI64(c.heavy.delivered[m]!));
    let p = 0;
    for (const [r, pkg] of st.rows.entries()) {
      const k = Number(light[p++]);
      const n = Number(light[p++]);
      expect(k).toBe(res.packages.heavyIdx[r]);
      const vec = RUN_MODES.map((_, mi) => heavy[mi]!.slice(k * 72, k * 72 + 72));
      for (let i = 0; i < n; i++) {
        const slot = Number(light[p++]);
        const mi = (slot - (slot % 72)) / 72;
        vec[mi]![slot % 72]! += light[p++]!;
      }
      const full = await engine.simulate({
        twin: gh1,
        modes: [...RUN_MODES],
        asOf: ASOF,
        ...(pkg.id === 'baseline' ? {} : { pkg }),
      });
      RUN_MODES.forEach((mode, mi) => {
        expect(vec[mi]).toEqual(FUELS.flatMap((f) => [...full.byMode[mode]!.deliveredWh[f]]));
      });
    }
    expect(p).toBe(light.length);
    expect(decodeI64(c.baseline['your-home'])).toEqual(
      FUELS.flatMap((f) => [...res.baseline['your-home'].deliveredWh[f]]),
    );
  });

  it('pack data travels as plain data (tariffs, monthly carbon, trajectory, grants, rules)', () => {
    const gas = c.packs.tariffs.find((t) => t.id === 'uk-cap-2026q4-gas')!.data as Record<string, unknown>;
    expect(gas.slabs).toEqual([{ uptoWh: null, price: '7970' }]);
    expect(gas.standingWhenUnused).toBe(false);
    const carbon = c.packs.carbon.data as { factors: Record<string, string[]> };
    expect(carbon.factors.electricity).toHaveLength(12);
    expect(carbon.factors.biomass).toBeUndefined();
    const bus = c.packs.grants.find((g) => g.id === 'grant-bus')!.data as { applied: string[][] };
    expect(bus.applied.length).toBe(res.packages.ids.filter((id) => id.includes('heat-ashp')).length);
    expect(c.packs.rules.map((r) => r.id)).toEqual(['rules-uk']);
    expect(JSON.parse(JSON.stringify(c))).toEqual(c); // no bigint, no undefined in arrays
  });
});

describe('determinism (B6) and evidence (B10)', () => {
  it('the same request twice gives the same hash and certificate bytes', async () => {
    const again = await run();
    expect(again.hash).toBe(res.hash);
    expect(canonicalJson(again.certificate)).toBe(canonicalJson(res.certificate));
  });

  it('a fresh engine gives the same hash', async () => {
    const other = await readyEngine();
    expect((await (await other.search(request())).result).hash).toBe(res.hash);
  });

  it('the eager graph covers the baseline, front and picks with bookkeeping nodes', () => {
    const npvNodes = res.graph.nodes.filter((n) => n.quantity === 'fin.npv');
    const eager = new Set([
      ...res.front,
      res.picks.leastUpfront,
      res.picks.bestReturn,
      res.picks.lowestRunningCarbon,
    ]);
    expect(npvNodes.map((n) => n.subject.packageId).sort()).toEqual(
      [...eager].map((r) => res.packages.ids[r!]).sort(),
    );
    expect(res.graph.nodes.length).toBeLessThanOrEqual(5_000);
    for (const n of res.graph.nodes) expect(n.seal).toBe('unverified');
  });

  it('evidence() returns any package node on demand, inputs walking back to delivered energy', async () => {
    const lazy = res.packages.ids.find(
      (_, r) => !res.graph.nodes.some((n) => n.subject.packageId === res.packages.ids[r]),
    )!;
    expect(lazy).toBeDefined();
    const nodes = await engine.evidence(res.hash, { quantity: 'acct.saving', packageId: lazy });
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.every((n) => n.quantity.startsWith('acct.saving.'))).toBe(true);
    const npv = await engine.evidence(res.hash, { quantity: 'fin.npv', packageId: lazy });
    expect(npv).toHaveLength(1);
    expect((npv[0]!.value as { fixed: string }).fixed).toBe(
      res.packages.npv[res.packages.ids.indexOf(lazy)]!.toString(),
    );
    const byId = await engine.evidence(res.hash, [npv[0]!.id]);
    expect(byId).toEqual(npv);
  });
});

describe('jobs: progress and cancel (B8)', () => {
  it('reports progress through every phase', async () => {
    const phases = new Set<string>();
    const { result } = await engine.search(request(), (p) => phases.add(p.phase));
    await result;
    expect([...phases]).toEqual(['plan', 'heavy', 'light', 'bookkeeping', 'rules', 'front', 'evidence']);
  });

  it('cancel stops a running search between slices', async () => {
    const e = await readyEngine({ sliceMs: 0 });
    const { jobId, result } = await e.search(request());
    e.cancel(jobId);
    const t0 = Date.now();
    await expect(result).rejects.toMatchObject({ name: 'SearchCancelled', jobId });
    expect(Date.now() - t0).toBeLessThan(50);
  });

  it('API methods of later milestones say so instead of guessing', async () => {
    await expect(engine.uncertainty(res.hash, [], 200)).rejects.toBeInstanceOf(NotImplementedYet);
  });

  it('simulate returns one result per mode and the same delivered energy as the search baseline', async () => {
    const b = await engine.simulate({ twin: gh1, modes: ['your-home', 'standard'], asOf: ASOF });
    expect(b.byMode['your-home']!.deliveredWh).toEqual(res.baseline['your-home'].deliveredWh);
    expect(b.byMode.rating).toBeUndefined();
  });

  it('init rejects a shared fingerprint mismatch', async () => {
    const plugins = await allPlugins();
    const { createEngine } = await import('../src/api.ts');
    const e = createEngine({ plugins });
    await expect(e.init([], 'not-the-fingerprint')).rejects.toThrow(/fingerprint/);
  });
});

describe('tariff sanity used above', () => {
  it('the Q4 2026 cap prices are the BP 7.1 values', () => {
    expect(
      ukCapGas2026q4.bill(
        MONTHS.map(() => 1000n),
        { days: MONTHS.map(() => 0) },
      ).total,
    ).toBe(12n * 7_970_000n);
    expect(
      ukCapElectricity2026q4.bill(
        MONTHS.map(() => 0n),
        { days: MONTHS.map(() => 1) },
      ).total,
    ).toBe(12n * 54_830_000n);
  });
});
