/**
 * V-P studio on agent A's Preview stages: outputs carry the Preview seal (AC-PG3), the runner goes
 * rough then final and cancels (SPEC 19), variants differ only by their listed changes (AC-W5),
 * levers move the whole result, search finds buildings, floors and rooms (owner request).
 */
import { downstreamStages, type Place, type StageOut } from '@ibasho/core';
import { facadeMeters, overallWwrPm } from '@ibasho/editor';
import { describe, expect, it } from 'vitest';
import { IIIT_PLACE_ID, sampleDoc, samplePlaces } from '../src/studio/data.ts';
import { computeOne, headline, runPreviewJob, type StageInputs } from '../src/studio/preview/runner.ts';
import { defaultSettings } from '../src/studio/preview/settings.ts';
import { templateDoc } from '../src/studio/preview/template.ts';
import { energyParams, variantDoc } from '../src/studio/preview/variant.ts';
import { viewFor } from '../src/studio/preview/views.ts';
import { findPlaces, hitPath } from '../src/studio/search/places.ts';

const place = samplePlaces().find((p) => p.id === IIIT_PLACE_ID) as Place;
const inputs = (over: Partial<StageInputs> = {}): StageInputs => ({
  key: 'gb1~as-built',
  placeId: IIIT_PLACE_ID,
  variantId: 'as-built',
  doc: sampleDoc('gb1'),
  place,
  tiles: [],
  levers: {},
  settings: defaultSettings(),
  resolution: 'sketch',
  asOf: '2026-10-11T00:00:00Z',
  ...over,
});

describe('Preview stages through the studio (SPEC 19, R26)', () => {
  it('every stage returns core outputs and Preview-sealed views', () => {
    const inp = inputs();
    const out: Partial<StageOut> = {};
    for (const s of ['geometry', 'sun', 'radiation', 'daylight', 'energy', 'codes', 'optimise'] as const) {
      const o = computeOne(s, inp, out, 'final');
      (out as Record<string, unknown>)[s] = o;
      const v = viewFor(
        s,
        {
          key: inp.key,
          placeId: inp.placeId,
          variantId: 'as-built',
          doc: inp.doc,
          tier: 'final',
          outputs: out,
        },
        o,
      );
      expect(v.nodes.length, s).toBeGreaterThan(0);
      expect(v.nodes.every((n) => n.seal === 'preview' && n.provenance.kind === 'preview')).toBe(true);
    }
    expect(out.energy?.stamp.impl).toBe('preview');
  });

  it('runs rough then final per stage and cancels', async () => {
    const seen: string[] = [];
    const job = runPreviewJob(
      'j',
      1,
      ['geometry', 'sun'],
      inputs(),
      (e) => e.tier && seen.push(`${e.stage}:${e.tier}`),
      0.05,
    );
    expect((await job.done).status).toBe('done');
    expect(seen[0]).toBe('geometry:final');
    expect(seen[1]).toBe('sun:rough');
    expect(seen[seen.length - 1]).toBe('sun:final');
    const j2 = runPreviewJob('j2', 2, ['optimise'], inputs(), () => undefined, 1);
    j2.cancel();
    expect((await j2.done).status).toBe('cancelled');
  });
});

describe('flows', () => {
  it('a variant differs from the building only by its listed changes (AC-W5)', () => {
    const base = sampleDoc('gb1');
    expect(variantDoc(base, {})).toBe(base);
    const v = variantDoc(base, { wwr: 40 });
    expect(overallWwrPm(facadeMeters(v))).toBe(400);
    expect(JSON.stringify(base)).toBe(JSON.stringify(sampleDoc('gb1')));
  });

  it('design levers lower the whole energy result (EnergyParams into the Preview stage)', () => {
    const before = headline(inputs());
    const after = headline(inputs({ levers: { glazing: 'low-e', lighting: 'led', pv: 50 } }));
    expect(after.view.euiMid).toBeLessThan(before.view.euiMid);
    expect(after.view.billRs).toBeLessThan(before.view.billRs);
    const out: Partial<StageOut> = {};
    out.geometry = computeOne('geometry', inputs(), out, 'final') as StageOut['geometry'];
    expect(energyParams({}, out.geometry)).toEqual({});
    expect(energyParams({ glazing: 'low-e', pv: 50 }, out.geometry)).toMatchObject({ shgc: 0.3 });
    expect(energyParams({ pv: 50 }, out.geometry).pvKwp).toBeGreaterThan(0);
  });

  it('a tariff change re-runs codes and optimisation only (SPEC 18.5)', () => {
    expect(downstreamStages(['codes'])).toEqual(['codes', 'optimise']);
  });

  it('templates auto-zone perimeter and core', () => {
    const d = templateDoc(
      {
        typeId: 'office',
        name: 'T',
        placeId: 'p',
        widthM: 59,
        depthM: 37,
        storeys: 15,
        floorToFloorM: 3.6,
        wwrPct: 30,
        rotationDeg: 0,
        autoZone: true,
      },
      'bd_t',
    );
    expect(d.storeys).toHaveLength(2);
    expect(d.storeys[1]?.multiplier).toBe(14);
    expect(d.storeys[0]?.rooms).toHaveLength(5);
  });
});

describe('find by name (owner request)', () => {
  const doc = sampleDoc('gb1');
  const state = {
    tiles: [],
    places: { [IIIT_PLACE_ID]: { place, updatedAt: 0, area: 'Gachibowli, Hyderabad' } },
    buildings: {
      gb1: {
        id: 'gb1',
        placeId: IIIT_PLACE_ID,
        name: doc.name,
        typeId: doc.typeId,
        doc,
        history: { past: [], future: [] },
        versions: [],
        variants: [],
        focus: 'as-built',
      },
    },
  };
  it('finds the building, a floor and rooms, with paths that set the zoom level', () => {
    const b = findPlaces(state, 'vindya');
    expect(b[0]?.kind).toBe('building');
    expect(hitPath(state, b[0] as never)).toBe('/p/pl_iiit/b/gb1?level=building&focus=gb1');
    const f = findPlaces(state, 'Vindhya floor 2');
    const storey = f.find((h) => h.kind === 'storey');
    expect(storey).toBeTruthy();
    expect(hitPath(state, storey as never)).toMatch(/level=floor&floor=/);
    const r = findPlaces(state, 'teaching lab');
    const room = r.find((h) => h.kind === 'room');
    expect(room).toBeTruthy();
    expect(hitPath(state, room as never)).toMatch(/level=room&floor=\w+&room=\w+/);
    expect(findPlaces(state, 'zzzzqq')).toEqual([]);
    const pl = findPlaces(state, 'IIIT').find((h) => h.kind === 'place');
    expect(pl && hitPath(state, pl)).toBe('/p/pl_iiit');
  });
  it('a block of Himalaya focuses by its box', () => {
    const d2 = sampleDoc('gb2');
    const s2 = {
      ...state,
      buildings: { ...state.buildings, gb2: { ...state.buildings.gb1, id: 'gb2', name: d2.name, doc: d2 } },
    };
    const part = findPlaces(s2, 'Shodh').find((h) => h.id.startsWith('gb2#'));
    expect(part).toBeTruthy();
    expect(hitPath(s2, part as never)).toMatch(/^\/p\/pl_iiit\/b\/gb2\?level=building&focus=gb2%23\w+&bbox=/);
  });
});

describe('generations (review R2-m0)', () => {
  it('a late event from an older generation never replaces the live job', async () => {
    const { useStudio, jobKey } = await import('../src/studio/state/studio.ts');
    const st = useStudio.getState();
    st.hydrate(undefined);
    useStudio.setState({ deviceFactor: 0.01 });
    const key = jobKey('gb1', 'as-built');
    st.run('gb1', 'as-built');
    const first = useStudio.getState().jobs[key];
    st.run('gb1', 'as-built');
    const second = useStudio.getState().jobs[key];
    expect(second?.generation).toBe((first?.generation ?? 0) + 1);
    await first?.handle?.done;
    await second?.handle?.done;
    const live = useStudio.getState().jobs[key];
    expect(live?.generation).toBe(second?.generation);
    expect(live?.bar.jobId).toBe(second?.bar.jobId);
    expect(live?.views.energy).toBeTruthy();
  }, 60_000);
});

describe('design before you build (SPEC 27)', () => {
  it('goal gaps are met, not met or unknown with a source, never compliant (AC-PD3)', async () => {
    const { designGaps } = await import('../src/studio/pages/DesignFlow.tsx');
    const empty = designGaps(['ecsbc-super', 'part-l'], undefined, 'IN');
    expect(empty.map((g) => g.state)).toEqual(['unknown', 'not-here']);
    expect(empty.every((g) => g.source.length > 0)).toBe(true);
    const inp = inputs();
    const out: Partial<StageOut> = {};
    for (const s of ['geometry', 'energy', 'codes', 'optimise'] as const) {
      (out as Record<string, unknown>)[s] = computeOne(s, inp, out, 'final');
    }
    const gaps = designGaps(['ecsbc-super', 'leed-gold', 'lowest-opex'], out, 'IN');
    for (const g of gaps) expect(['met', 'not-met', 'unknown']).toContain(g.state);
    expect(JSON.stringify(gaps)).not.toMatch(/compliant|certified/i);
  });
});
