/**
 * GH1 walking-skeleton physics (M-0 step 1). Owner: WP-01.
 * Tests may wire packs, engine and fixtures together (dependency-cruiser exempts tests).
 */
import {
  createRegistry,
  FUELS,
  type HomeTwin,
  type MeasureCost,
  type PackageSpec,
  Q,
  RUN_MODES,
  sumBig,
} from '@ibasho/core';
import { parseTwin } from '@ibasho/core/schemas';
import { describe, expect, it } from 'vitest';
import {
  applyPatch,
  type PipelineConfig,
  packagePatch,
  runHeavy,
  runLight,
  simulate,
  simulateBundle,
  splitPatch,
} from '../../../packages/engine/src/pipeline/index.ts';
import gh1Json from '../../../packages/fixtures/src/homes/gh1.twin.json' with { type: 'json' };
import { londonClimate } from '../../../packs/climate/src/engine/index.ts';
import { homeUkEngineModule, M0_MEASURES, UK_MEASURES, UK_SYSTEMS } from '../src/engine/index.ts';
import { GROUPS, MEASURES } from '../src/ids.ts';

const twin: HomeTwin = parseTwin(gh1Json);
const cfg: PipelineConfig = { climate: londonClimate, measures: M0_MEASURES, systems: UK_SYSTEMS };
const asOf = '2026-10-11';

function pkg(options: Record<string, string>): PackageSpec {
  const ids = Object.values(options)
    .filter((o) => o !== 'none')
    .sort();
  return { id: ids.length ? ids.join('+') : 'baseline', options };
}
const annual = (xs: readonly bigint[]) => Number(sumBig(xs)) / 1000; // kWh
const run = (p: PackageSpec | undefined, mode: 'rating' | 'standard' | 'your-home' = 'your-home') =>
  simulate({ twin, mode, asOf, ...(p ? { pkg: p } : {}) }, cfg).result;

describe('GH1 fixture and pack wiring', () => {
  it('the twin fixture is schema-valid', () => {
    expect(twin.id).toBe('gh1');
    expect(twin.form.builtForm).toBe('mid-terrace');
  });

  it('the home-uk engine module registers cleanly once every option is costed', async () => {
    const plugins = await homeUkEngineModule.load();
    // Costs come from money-uk (WP-02). Without them the registry rejects the join (ARCH 5.2).
    expect(() => createRegistry().registerAll(plugins)).toThrow(/has no measure-cost/);
    // Test-local adapter: one zero cost per option, standing in for money-uk.
    const costs: MeasureCost[] = UK_MEASURES.flatMap((m) =>
      m.options.map((o) => ({
        kind: 'measure-cost' as const,
        id: `test-cost-${o.id}`,
        version: '0.0.0',
        title: 'test.cost',
        regions: ['GB'],
        side: 'engine' as const,
        provenance: {
          sources: [{ id: 'test', title: 'test adapter', retrieved: '2026-10-11' }],
          lastChecked: '2026-10-11',
          grade: 'estimate' as const,
        },
        optionId: o.id,
        cost: () => ({ lo: 0n, mid: 0n, hi: 0n, vatRate: Q.ZERO, grade: 'estimate' as const }),
      })),
    );
    const reg = createRegistry();
    reg.registerAll([...plugins, ...costs]);
    expect(reg.all('measure')).toHaveLength(16);
    expect(reg.all('system').map((s) => s.id)).toContain('gas-combi-condensing');
    expect(reg.all('maintenance').map((m) => m.id)).toEqual(['maint-draught', 'maint-gas-boiler', 'maint-heat-pump']);
  });

  it('measure models follow the frozen ids', () => {
    for (const m of M0_MEASURES) {
      const id = m.id as keyof typeof MEASURES;
      expect(m.options.map((o) => o.id)).toEqual([...MEASURES[id].options]);
      expect(m.group).toBe(MEASURES[id].group);
      expect(m.measureKind).toBe(MEASURES[id].kind);
      expect(m.weight).toBe(GROUPS[m.group as keyof typeof GROUPS].weight);
    }
  });
});

describe('GH1 baseline (M-0 steady monthly balance)', () => {
  const base = run(undefined);

  it('is plausible for a leaky 1905 solid-wall terrace', () => {
    const gas = annual(base.deliveredWh.gas);
    const elec = annual(base.deliveredWh.electricity);
    // NEED 2023 median gas is 10,100 kWh; an uninsulated solid-wall terrace with an open chimney
    // sits above it. The M-0 model has no utilisation factor (eta = 1), which lowers demand.
    expect(gas).toBeGreaterThan(9_000);
    expect(gas).toBeLessThan(25_000);
    expect(elec).toBeGreaterThan(1_000);
    expect(elec).toBeLessThan(4_000);
    for (const f of FUELS)
      if (f !== 'gas' && f !== 'electricity') expect(annual(base.deliveredWh[f])).toBe(0);
  });

  it('heats in winter more than in summer and never goes negative', () => {
    expect(base.qhKWh[0]).toBeGreaterThan(base.qhKWh[6]!);
    for (const q of base.qhKWh) expect(q).toBeGreaterThanOrEqual(0);
    for (const q of base.qcKWh) expect(q).toBe(0);
  });

  it('rating mode heats only October to May', () => {
    const r = run(undefined, 'rating');
    for (const m of [5, 6, 7, 8]) expect(r.qhKWh[m]).toBe(0);
    expect(r.qhKWh[0]).toBeGreaterThan(0);
  });
});

describe('GH1 measures', () => {
  const base = run(undefined);
  const gasOf = (p: PackageSpec) => annual(run(p).deliveredWh.gas);
  const elecOf = (p: PackageSpec) => annual(run(p).deliveredWh.electricity);
  const baseGas = annual(base.deliveredWh.gas);

  it('loft 300 cuts gas, and more than loft 270', () => {
    const l300 = gasOf(pkg({ loft: 'loft-300' }));
    const l270 = gasOf(pkg({ loft: 'loft-270' }));
    expect(l300).toBeLessThan(l270);
    expect(l270).toBeLessThan(baseGas);
  });

  it('draught-proofing with a chimney balloon cuts gas', () => {
    expect(gasOf(pkg({ draught: 'draught-proofing-chimney-balloon' }))).toBeLessThan(baseGas);
  });

  it('ASHP removes space and water heating gas, leaving the gas hob, and raises electricity', () => {
    const p = pkg({ heat: 'heat-ashp' });
    const gas = gasOf(p);
    expect(gas).toBeGreaterThan(0);
    expect(gas).toBeLessThan(300); // cooking only: 138 + 28 N kWh/yr
    expect(elecOf(p)).toBeGreaterThan(annual(base.deliveredWh.electricity) + 2_000);
    expect(elecOf(pkg({ heat: 'heat-ashp-radiators-plus' }))).toBeLessThan(elecOf(p));
  });

  it('fabric first lowers heat pump electricity (BP 6.3 oracle 1, fixed-COP half)', () => {
    const hpOnly = elecOf(pkg({ heat: 'heat-ashp' }));
    const all = elecOf(
      pkg({ loft: 'loft-300', draught: 'draught-proofing-chimney-balloon', heat: 'heat-ashp' }),
    );
    expect(all).toBeLessThan(hpOnly);
  });

  it('a package is recomputed whole, not summed (BP P7)', () => {
    const dLoft = baseGas - gasOf(pkg({ loft: 'loft-300' }));
    const dDraught = baseGas - gasOf(pkg({ draught: 'draught-proofing-chimney-balloon' }));
    const both = baseGas - gasOf(pkg({ loft: 'loft-300', draught: 'draught-proofing-chimney-balloon' }));
    expect(both).toBeGreaterThan(0);
    expect(Math.abs(both - (dLoft + dDraught))).toBeGreaterThan(0);
  });
});

describe('light path (factorised search, ARCH 6)', () => {
  const groups: Record<string, string[]> = {
    loft: ['none', 'loft-270', 'loft-300'],
    draught: ['none', 'draught-proofing-chimney-balloon'],
    heat: ['none', 'heat-ashp', 'heat-ashp-radiators-plus'],
  };
  const all: PackageSpec[] = [];
  for (const l of groups.loft!)
    for (const d of groups.draught!)
      for (const h of groups.heat!) all.push(pkg({ loft: l, draught: d, heat: h }));

  it('equals full simulation bit for bit on every M-0 package and mode', () => {
    for (const mode of RUN_MODES) {
      for (const p of all) {
        const full = simulate({ twin, pkg: p, mode, asOf }, cfg).result;
        // Factorised: heavy key from the heavy part, then the light part on the cached heavy run.
        const { heavy, light } = splitPatch(packagePatch(twin, p, M0_MEASURES));
        const heavyTwin = applyPatch(twin, heavy);
        const h = runHeavy(heavyTwin, { mode, asOf, pkg: p, baseTwin: twin }, cfg);
        const viaLight = runLight(h, applyPatch(heavyTwin, light), cfg).result;
        expect(viaLight).toEqual(full);
      }
    }
  });

  it('the heat pump changes the heavy key only through the DHW class', () => {
    const { heavy } = splitPatch(packagePatch(twin, pkg({ heat: 'heat-ashp' }), M0_MEASURES));
    expect(heavy.set.map((s) => s.path)).toEqual(['/systems/dhw/class']);
  });
});

describe('determinism and evidence', () => {
  const p = pkg({ loft: 'loft-300', heat: 'heat-ashp' });

  it('the bundle hash is stable across runs', () => {
    const a = simulateBundle({ twin, pkg: p, modes: RUN_MODES, asOf }, cfg);
    const b = simulateBundle({ twin, pkg: p, modes: RUN_MODES, asOf }, cfg);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('every delivered value has an evidence node that agrees with the result', () => {
    const bundle = simulateBundle({ twin, pkg: p, modes: RUN_MODES, asOf }, cfg);
    for (const mode of RUN_MODES) {
      const res = bundle.byMode[mode]!;
      for (const f of ['gas', 'electricity'] as const) {
        for (let m = 0; m < 12; m++) {
          const node = bundle.graph.nodes.find(
            (n) => n.quantity === `energy.delivered.${f}.${m}` && n.subject.mode === mode,
          );
          expect(node, `${mode} ${f} ${m}`).toBeDefined();
          expect(node!.value).toEqual({ fixed: res.deliveredWh[f][m]!.toString(), unit: 'Wh' });
          expect(node!.seal).toBe('unverified');
          expect(node!.subject.packageId).toBe(p.id);
        }
      }
    }
    expect(bundle.graph.external).toEqual([]);
  });
});
