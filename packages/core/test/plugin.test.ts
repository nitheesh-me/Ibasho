import { describe, expect, it, vi } from 'vitest';
import type { Provenance } from '../src/common.ts';
import type { MeasureCost, MeasureModel, RegionPlugin, RulePackPlugin, TariffPlugin } from '../src/engine.ts';
import { Q } from '../src/exact/q.ts';
import type { AnyPlugin } from '../src/plugin/kind-map.ts';
import {
  assertSharedFingerprint,
  checkPlugin,
  createRegistry,
  FingerprintMismatchError,
  loadModules,
  matchesQuery,
  RegistryError,
} from '../src/plugin/registry.ts';
import { gradeNeedsBadge, PLUGIN_KINDS } from '../src/plugin/types.ts';
import type { Rule } from '../src/rules.ts';
import { EMPTY_PATCH } from '../src/twin.ts';
import type { VisualLayerPlugin } from '../src/ui.ts';

const prov: Provenance = {
  sources: [
    { id: 'ofgem-cap', title: 'Ofgem price cap', url: 'https://www.ofgem.gov.uk', retrieved: '2026-10-01' },
  ],
  lastChecked: '2026-10-01',
  grade: 'primary',
};

const region = (id: string, extra: Partial<RegionPlugin> = {}): RegionPlugin => ({
  kind: 'region',
  id,
  version: '1.0.0',
  title: `region.${id}`,
  side: 'both',
  provenance: prov,
  region: 'GB-ENG',
  currency: 'GBP',
  locale: 'en-GB',
  defaultClimatePackId: 'climate-london',
  ...extra,
});

const measure = (id: string, options: string[], regions?: MeasureModel['regions']): MeasureModel => ({
  kind: 'measure',
  id,
  version: '0.1.0',
  title: `measure.${id}`,
  side: 'engine',
  provenance: prov,
  ...(regions ? { regions } : {}),
  group: id,
  weight: 'heavy',
  options: options.map((o) => ({ id: o, title: `option.${o}`, params: {} })),
  measureKind: 'loft',
  touches: ['roof'],
  apply: () => EMPTY_PATCH,
  lifetimeYears: 40,
  facts: () => ({}),
});

const cost = (id: string, optionId: string, regions?: MeasureCost['regions']): MeasureCost => ({
  kind: 'measure-cost',
  id,
  version: '0.1.0',
  title: `cost.${optionId}`,
  side: 'engine',
  provenance: prov,
  ...(regions ? { regions } : {}),
  optionId,
  cost: () => ({ lo: 1n, mid: 2n, hi: 3n, vatRate: Q.ZERO, grade: 'estimate' }),
});

const rule = (id: string, extra: Partial<Rule> = {}): Rule => ({
  id,
  jurisdiction: 'GB-ENG',
  measures: ['ashp'],
  scope: 'measure',
  when: { fn: 'mcs020a_Lp_le', args: [{ fact: 'p.noise.lp' }] },
  effect: { kind: 'block', reason: 'rules.noise' },
  effectiveFrom: '2025-05-29',
  source: { url: 'https://www.legislation.gov.uk', clause: 'Class G', grade: 'primary' },
  explain: 'rules.noise.explain',
  ...extra,
});

const rulePack = (id: string, rules: Rule[]): RulePackPlugin => ({
  kind: 'rule-pack',
  id,
  version: '1.0.0',
  title: `rules.${id}`,
  side: 'engine',
  provenance: prov,
  rules,
});

const layer = (id: string, extra: Partial<VisualLayerPlugin> = {}): VisualLayerPlugin => ({
  kind: 'visual-layer',
  id,
  version: '0.1.0',
  title: `layer.${id}`,
  side: 'ui',
  layerId: id,
  quantities: ['fabric.htr'],
  encodesNumbers: true,
  Overlay: () => null,
  ReducedMotion: () => null,
  Legend: () => null,
  evidenceAt: () => undefined,
  budget: { drawCalls: 1, triangles: 100 },
  ...extra,
});

const issuesOf = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof RegistryError) return e.issues.map((i) => `${i.check}:${i.pluginId}`);
    throw e;
  }
  return [];
};

describe('registry basics', () => {
  it('registers, gets, lists sorted by id, and reports size', () => {
    const r = createRegistry();
    r.register(region('region-b'));
    r.register(region('region-a'));
    expect(r.has('region-a')).toBe(true);
    expect(r.get('region', 'region-b').id).toBe('region-b');
    expect(r.all('region').map((p) => p.id)).toEqual(['region-a', 'region-b']);
    expect(r.ids()).toEqual(['region-a', 'region-b']);
    expect(r.size).toBe(2);
    expect(r.all('tariff')).toEqual([]);
  });

  it('get throws on absent id or wrong kind', () => {
    const r = createRegistry();
    r.register(region('region-a'));
    expect(() => r.get('region', 'nope')).toThrow(RegistryError);
    expect(() => r.get('tariff', 'region-a')).toThrow(/is a region, not a tariff/);
  });

  it('rejects duplicates', () => {
    const r = createRegistry();
    r.register(region('region-a'));
    expect(issuesOf(() => r.register(region('region-a')))).toEqual(['ids:region-a']);
  });

  it('notifies listeners and unsubscribes', () => {
    const r = createRegistry();
    const cb = vi.fn();
    const off = r.onChange(cb);
    r.register(region('region-a'));
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    r.register(region('region-b'));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('queries and fingerprint', () => {
  const plugins: AnyPlugin[] = [
    region('r-gb', { regions: ['GB'] }),
    region('r-in', { regions: ['IN'] }),
    region('r-any'),
    region('r-old', { validFrom: '2020-01-01', validTo: '2024-12-31' }),
    region('r-new', { validFrom: '2026-01-01' }),
  ];

  it('filters by region containment, date, ids and side', () => {
    const r = createRegistry();
    r.registerAll(plugins);
    expect(r.all('region', { region: 'GB-ENG' }).map((p) => p.id)).toEqual([
      'r-any',
      'r-gb',
      'r-new',
      'r-old',
    ]);
    expect(r.all('region', { asOf: '2025-06-01' }).map((p) => p.id)).toEqual(['r-any', 'r-gb', 'r-in']);
    expect(r.all('region', { asOf: '2024-12-31' }).map((p) => p.id)).toContain('r-old');
    expect(r.all('region', { ids: ['r-in', 'r-gb'] }).map((p) => p.id)).toEqual(['r-gb', 'r-in']);
    expect(r.all('region', { side: 'engine' })).toEqual([]);
    expect(matchesQuery(plugins[0]!, {})).toBe(true);
  });

  it('fingerprint is order independent and changes with versions', () => {
    const a = createRegistry();
    a.registerAll(plugins);
    const b = createRegistry();
    b.registerAll([...plugins].reverse());
    expect(a.fingerprint()).toBe(b.fingerprint());
    expect(a.fingerprint()).toMatch(/^[0-9a-f]{64}$/);
    const c = createRegistry();
    c.registerAll([...plugins.slice(1), region('r-gb', { regions: ['GB'], version: '1.0.1' })]);
    expect(c.fingerprint()).not.toBe(a.fingerprint());
    expect(a.fingerprint({ side: 'both' })).toBe(a.fingerprint());
    expect(a.fingerprint({ side: 'ui' })).not.toBe(a.fingerprint());
  });
});

describe('per-plugin checks (ARCH 4.1)', () => {
  it('ids, versions, kinds and sides', () => {
    expect(checkPlugin(region('Bad_ID')).map((i) => i.check)).toEqual(['ids']);
    expect(checkPlugin(region('ok', { version: '1.0' as never })).map((i) => i.check)).toEqual(['shape']);
    expect(checkPlugin({ ...region('ok'), kind: 'nope' } as never).map((i) => i.check)).toContain('shape');
    expect(checkPlugin({ ...region('ok'), side: 'worker' } as never).map((i) => i.check)).toEqual(['shape']);
  });

  it('dates', () => {
    expect(checkPlugin(region('ok', { validFrom: '2026-02-30' as never })).map((i) => i.check)).toEqual([
      'dates',
    ]);
    expect(checkPlugin(region('ok', { validTo: 'soon' as never })).map((i) => i.check)).toEqual(['dates']);
    expect(
      checkPlugin(region('ok', { validFrom: '2026-02-01', validTo: '2026-01-01' })).map((i) => i.check),
    ).toEqual(['dates']);
  });

  it('numeric plugins need provenance with sources and a date', () => {
    const { provenance: _p, ...noProv } = region('ok');
    expect(checkPlugin(noProv as RegionPlugin).map((i) => i.check)).toEqual(['provenance']);
    expect(checkPlugin(region('ok', { provenance: { ...prov, sources: [] } })).map((i) => i.check)).toEqual([
      'provenance',
    ]);
    expect(
      checkPlugin(region('ok', { provenance: { ...prov, lastChecked: 'x' as never } })).map((i) => i.check),
    ).toEqual(['provenance']);
    expect(checkPlugin(layer('lens'))).toEqual([]);
  });

  it("side 'both' is for pure data plugins", () => {
    const t: TariffPlugin = {
      kind: 'tariff',
      id: 'tariff-cap',
      version: '1.0.0',
      title: 't',
      side: 'both',
      provenance: prov,
      fuel: 'gas',
      currency: 'GBP',
      bill: () => ({ total: 0n, byMonth: [] }),
    };
    expect(checkPlugin(t).map((i) => i.check)).toEqual(['side']);
    expect(checkPlugin({ ...t, side: 'engine' })).toEqual([]);
  });

  it('visual layers that encode numbers need Legend and evidenceAt (AC-15)', () => {
    const { Legend: _l, evidenceAt: _e, ...bare } = layer('heat-flow');
    expect(checkPlugin(bare as VisualLayerPlugin).map((i) => i.check)).toEqual([
      'visual-layers',
      'visual-layers',
    ]);
    expect(checkPlugin({ ...(bare as VisualLayerPlugin), encodesNumbers: false })).toEqual([]);
  });

  it('rule packs: named functions must exist in spec-gen unless marked unverified', () => {
    expect(checkPlugin(rulePack('rules-ok', [rule('ENG.PD.ASHP.NOISE')]))).toEqual([]);
    const unknownFn = rule('ENG.X', { when: { fn: 'nope' as never, args: [] } });
    expect(checkPlugin(rulePack('rules-x', [unknownFn])).map((i) => i.check)).toEqual(['rule-packs']);
    expect(checkPlugin(rulePack('rules-x', [{ ...unknownFn, unverifiedRule: true }]))).toEqual([]);
    expect(checkPlugin(rulePack('rules-x', [unknownFn]), { namedFns: ['nope'] })).toEqual([]);
    expect(checkPlugin(rulePack('rules-d', [rule('A'), rule('A')])).map((i) => i.message)).toEqual([
      'duplicate rule id A',
    ]);
    expect(
      checkPlugin(
        rulePack('rules-e', [rule('B', { effectiveFrom: '2026-01-02', effectiveTo: '2026-01-01' })]),
      ).map((i) => i.check),
    ).toEqual(['rule-packs']);
  });
});

describe('cross-plugin checks', () => {
  it('requires must be present', () => {
    const r = createRegistry();
    expect(issuesOf(() => r.registerAll([region('a', { requires: ['missing'] })]))).toEqual([
      'dependencies:a',
    ]);
    const ok = createRegistry();
    ok.registerAll([region('a', { requires: ['b'] }), region('b')]);
    expect(ok.validate()).toEqual([]);
  });

  it('every measure option has a measure-cost for its regions', () => {
    const r = createRegistry();
    const issues = issuesOf(() =>
      r.registerAll([
        measure('loft', ['loft-270', 'loft-300'], ['GB-ENG']),
        cost('cost-loft-270', 'loft-270', ['GB']),
        cost('cost-loft-300', 'loft-300', ['IN']),
      ]),
    );
    expect(issues).toEqual(['measure-ids:loft']);
    const ok = createRegistry();
    ok.registerAll([measure('loft', ['loft-300']), cost('cost-loft-300', 'loft-300')]);
    expect(ok.validate()).toEqual([]);
  });

  it('registerAll reports every issue at once and keeps the valid plugins', () => {
    const r = createRegistry();
    const issues = issuesOf(() => r.registerAll([region('Bad'), region('good'), region('good')]));
    expect(issues).toEqual(['ids:Bad', 'ids:good']);
    expect(r.ids()).toEqual(['good']);
    expect(() => r.registerAll([])).not.toThrow();
  });
});

describe('plugin kinds', () => {
  it('lists every kind once', () => {
    expect(new Set(PLUGIN_KINDS).size).toBe(PLUGIN_KINDS.length);
    expect(PLUGIN_KINDS.length).toBe(31);
  });
  it('grades that need a badge (R17)', () => {
    expect(gradeNeedsBadge('estimate')).toBe(true);
    expect(gradeNeedsBadge('announced')).toBe(true);
    expect(gradeNeedsBadge('primary')).toBe(false);
  });
});

describe('boot helpers', () => {
  it('loads modules in order and registers them as one batch', async () => {
    const r = createRegistry();
    const mod = (id: string, plugins: AnyPlugin[]) => ({
      id,
      load: async () => ({ default: { id, load: () => plugins } }),
    });
    const res = await loadModules(r, [mod('m-a', [region('r-b')]), mod('m-b', [region('r-a')])]);
    expect(res).toEqual({ moduleIds: ['m-a', 'm-b'], pluginIds: ['r-a', 'r-b'] });
    await expect(
      loadModules(createRegistry(), [mod('m-x', [region('r-c', { requires: ['zz'] })])]),
    ).rejects.toThrow(RegistryError);
  });

  it('compares the shared fingerprint only', () => {
    const engine = createRegistry();
    engine.registerAll([region('r-a'), cost('cost-x', 'x')]);
    const ui = createRegistry();
    ui.registerAll([region('r-a'), layer('lens')]);
    expect(assertSharedFingerprint(ui, engine.fingerprint({ side: 'both' }))).toBe(
      engine.fingerprint({ side: 'both' }),
    );
    const other = createRegistry();
    other.registerAll([region('r-b')]);
    expect(() => assertSharedFingerprint(ui, other.fingerprint({ side: 'both' }))).toThrow(
      FingerprintMismatchError,
    );
  });
});
