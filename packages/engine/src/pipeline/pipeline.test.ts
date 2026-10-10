/**
 * Pipeline runner unit tests: patches, quantisation and runner guards. Owner: WP-01.
 * Colocated with the code because `packages/engine/test/**` belongs to WP-02 (ownership map).
 * The GH1 end-to-end physics tests live in `packs/home-uk/test/gh1.test.ts`.
 */
import type {
  ClimateMonth,
  ClimatePack,
  HomeTwin,
  MeasureModel,
  SystemPlugin,
  TwinPatch,
} from '@ibasho/core';
import { parseTwin } from '@ibasho/core/schemas';
import { describe, expect, it } from 'vitest';
import gh1Json from '../../../fixtures/src/homes/gh1.twin.json' with { type: 'json' };
import {
  applyPatch,
  composePatches,
  isLightPath,
  PatchError,
  type PipelineConfig,
  PipelineError,
  packagePatch,
  parsePointer,
  QuantiseError,
  quantiseWh,
  runHeavy,
  runLight,
  simulate,
  splitPatch,
} from './index.ts';

const twin: HomeTwin = parseTwin(gh1Json);
const asOf = '2026-10-11';

/** A flat synthetic climate (not London): enough to drive the runner without the climate pack. */
const month: ClimateMonth = { thetaE: 5, thetaMax: 9, thetaMin: 1, ghi: 50, dhi: 30, rh: 80, windMs: 4 };
const climate: ClimatePack = {
  kind: 'climate',
  id: twin.climatePackId,
  version: '0.0.0',
  title: 'test.climate',
  side: 'engine',
  location: { lat: 51.5, lon: 0, name: 'test.climate' },
  zone: 'uk-temperate',
  months: Array.from({ length: 12 }, () => month),
  design: { thetaEdC: -3, grade: 'estimate' },
  irradiance: () => Array.from({ length: 12 }, () => 40),
};
const boiler: SystemPlugin = {
  kind: 'system',
  id: 'gas-combi-condensing',
  version: '0.0.0',
  title: 'test.system',
  side: 'engine',
  category: 'boiler',
  fuel: 'gas',
  efficiency: 0.84,
};
const cfg: PipelineConfig = { climate, systems: [boiler] };

describe('JSON pointers', () => {
  it('unescapes ~1 and ~0 and rejects bad pointers', () => {
    expect(parsePointer('/a~1b/c~0d/0')).toEqual(['a/b', 'c~d', '0']);
    expect(() => parsePointer('a/b')).toThrow(PatchError);
    expect(() => parsePointer('/__proto__/x')).toThrow(PatchError);
    expect(() => parsePointer('/constructor')).toThrow(PatchError);
  });
});

describe('applyPatch', () => {
  it('sets values on a copy and never mutates the input', () => {
    const before = JSON.stringify(twin);
    const value = { state: 'known', value: 0.1, source: { kind: 'stated' } };
    const out = applyPatch(twin, { set: [{ path: '/elements/0/u', value }] });
    expect(out.elements[0]!.u).toEqual(value);
    expect(JSON.stringify(twin)).toBe(before);
    // The value is cloned, so later edits to it do not leak into the twin.
    value.value = 9;
    expect((out.elements[0]!.u as { value: number }).value).toBe(0.1);
  });

  it('rejects missing paths and out-of-range indices', () => {
    expect(() => applyPatch(twin, { set: [{ path: '/nope/x', value: 1 }] })).toThrow(PatchError);
    expect(() =>
      applyPatch(twin, { set: [{ path: `/elements/${twin.elements.length}/u`, value: 1 }] }),
    ).toThrow(PatchError);
    expect(() => applyPatch(twin, { set: [{ path: '/elements/01/u', value: 1 }] })).toThrow(PatchError);
  });

  it('removes elements with their junctions, then adds', () => {
    const j = twin.junctions[0];
    if (!j) return; // GH1 always lists junctions; guard keeps the test honest if it ever does not.
    const gone = j.elementIds[0]!;
    const added = { ...twin.elements[0]!, id: 'test-added' };
    const out = applyPatch(twin, { set: [], removeElementIds: [gone], addElements: [added] });
    expect(out.elements.some((e) => e.id === gone)).toBe(false);
    expect(out.junctions.some((x) => x.elementIds.includes(gone))).toBe(false);
    expect(out.elements.at(-1)!.id).toBe('test-added');
  });
});

describe('compose and split', () => {
  const a: TwinPatch = {
    set: [{ path: '/systems/space/fuel', value: 'electricity' }],
    removeElementIds: ['x'],
  };
  const b: TwinPatch = { set: [{ path: '/ventilation/chimneysOpen', value: 0 }] };

  it('composes by concatenation in order', () => {
    expect(composePatches([a, b])).toEqual({ set: [...a.set, ...b.set], removeElementIds: ['x'] });
    expect(composePatches([])).toEqual({ set: [] });
  });

  it('splits light paths (systems read only by light stages) from heavy ones', () => {
    expect(isLightPath('/systems/space')).toBe(true);
    expect(isLightPath('/systems/space/efficiency')).toBe(true);
    expect(isLightPath('/systems/spaceX')).toBe(false);
    expect(isLightPath('/systems/dhw/class')).toBe(false);
    expect(isLightPath('/systems/controls')).toBe(false);
    const { heavy, light } = splitPatch(composePatches([a, b]));
    expect(light.set.map((s) => s.path)).toEqual(['/systems/space/fuel']);
    expect(heavy.set.map((s) => s.path)).toEqual(['/ventilation/chimneysOpen']);
    expect(heavy.removeElementIds).toEqual(['x']);
  });
});

describe('packagePatch', () => {
  const model = {
    id: 'test',
    options: [{ id: 'opt-a', title: 'x', params: {} }],
    apply: (_t: HomeTwin, o: string): TwinPatch => ({ set: [{ path: '/archetypeId', value: o }] }),
  } as unknown as MeasureModel;

  it('applies chosen options and skips none', () => {
    expect(packagePatch(twin, { id: 'opt-a', options: { g: 'opt-a', h: 'none' } }, [model])).toEqual({
      set: [{ path: '/archetypeId', value: 'opt-a' }],
    });
  });

  it('fails clearly on an option with no measure model', () => {
    expect(() => packagePatch(twin, { id: 'zzz', options: { g: 'zzz' } }, [model])).toThrow(
      /no measure model/,
    );
  });
});

describe('quantiseWh (R20 boundary)', () => {
  it('rounds kWh to integer Wh, half to even', () => {
    expect(quantiseWh(1.2344)).toBe(1234n);
    expect(quantiseWh(1.2346)).toBe(1235n);
    expect(quantiseWh(0.0005)).toBe(0n); // 0.5 Wh to even 0
    expect(quantiseWh(0.0015)).toBe(2n); // 1.5 Wh to even 2
    expect(quantiseWh(0.0025)).toBe(2n); // 2.5 Wh to even 2
    expect(quantiseWh(-0.0015)).toBe(-2n);
    expect(quantiseWh(0)).toBe(0n);
  });

  it('rejects non-finite and out-of-range energy', () => {
    expect(() => quantiseWh(Number.NaN)).toThrow(QuantiseError);
    expect(() => quantiseWh(Number.POSITIVE_INFINITY)).toThrow(QuantiseError);
    expect(() => quantiseWh(1e20)).toThrow(QuantiseError);
  });
});

describe('runner guards', () => {
  it('runs end to end on a synthetic climate with integer Wh output', () => {
    const r = simulate({ twin, mode: 'standard', asOf }, cfg).result;
    expect(r.packageId).toBe('baseline');
    for (const wh of r.deliveredWh.gas) expect(typeof wh).toBe('bigint');
    expect(r.deliveredWh.gas.every((wh) => wh > 0n)).toBe(true);
  });

  it('refuses a climate the twin does not name', () => {
    expect(() =>
      simulate({ twin, mode: 'standard', asOf }, { ...cfg, climate: { ...climate, id: 'other' } }),
    ).toThrow(PipelineError);
  });

  it('refuses a light run in a different mode from its heavy run', () => {
    const h = runHeavy(twin, { mode: 'rating', asOf }, cfg);
    expect(() => runLight(h, twin, cfg, { mode: 'standard', asOf })).toThrow(PipelineError);
  });

  it('fails loudly when no efficiency is known (no silent default)', () => {
    const t = applyPatch(twin, {
      set: [
        { path: '/systems/space/systemId', value: 'unknown-system' },
        { path: '/systems/space/efficiency', value: undefined },
      ],
    });
    delete (t.systems.space as { efficiency?: unknown }).efficiency;
    expect(() => simulate({ twin: t, mode: 'standard', asOf }, cfg)).toThrow(/no efficiency/);
  });
});
