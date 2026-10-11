import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnyStageEvent, BuildingResult, EvidenceGraph, JobRequest, StageId } from '@ibasho/core';
import { createRegistry, dominates, END_USES, isPreview, isZoneTwin, Q, STUDIO_STAGES } from '@ibasho/core';
import {
  BuildingResultSchema,
  CodesOutSchema,
  CompiledBuildingSchema,
  OptimiseResultSchema,
  SiteResultSchema,
  toWireJson,
} from '@ibasho/core/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { AS_OF, FIXTURE_BUILDINGS, fixtureInputs, PREVIEW_DIR } from '../scripts/fixture-inputs.ts';
import {
  createPreviewStudio,
  PREVIEW_PROVIDERS,
  PreviewAbort,
  previewEnergy,
  runPreviewJob,
  setPreviewTimer,
} from '../src/index.ts';
import { slabMicroPaise } from '../src/model/money.ts';

const SCHEMA = {
  geometry: CompiledBuildingSchema,
  sun: SiteResultSchema,
  radiation: SiteResultSchema,
  daylight: SiteResultSchema,
  energy: BuildingResultSchema,
  codes: CodesOutSchema,
  optimise: OptimiseResultSchema,
} as const;

const read = (id: string, s: StageId) => JSON.parse(readFileSync(join(PREVIEW_DIR, id, `${s}.json`), 'utf8'));
const req = (id: string, stages: StageId[] = [...STUDIO_STAGES], generation = 1): JobRequest => ({
  jobId: `t_${id}_${generation}`,
  generation,
  placeId: 'p',
  buildingId: id,
  stages,
  resolution: 'standard',
  asOf: AS_OF,
});

beforeAll(() => setPreviewTimer(async () => {}));

describe('P1 fixtures validate and are reproduced exactly', () => {
  it.each(FIXTURE_BUILDINGS)('%s', async (id) => {
    const inputs = fixtureInputs(id);
    const { end, outputs } = await runPreviewJob(req(id), inputs, () => {}, { deviceFactor: 0 });
    expect(end.status).toBe('done');
    for (const s of STUDIO_STAGES) {
      const text = readFileSync(join(PREVIEW_DIR, id, `${s}.json`), 'utf8').trim();
      expect(text).toBe(toWireJson(outputs[s]));
      expect(SCHEMA[s].parse(JSON.parse(text))).toEqual(outputs[s]);
    }
  });
});

describe('P2 arithmetic identities', () => {
  it.each(FIXTURE_BUILDINGS)('%s', (id) => {
    const e = BuildingResultSchema.parse(read(id, 'energy'));
    const total = END_USES.reduce(
      (s, u) => s + e.endUses[u].reduce<bigint>((a, v) => a + (v === 'unknown' ? 0n : v), 0n),
      0n,
    );
    const geo = CompiledBuildingSchema.parse(read(id, 'geometry'));
    const central = e.evidence.nodes.find((n) => n.quantity === 'eui.site.central');
    expect(
      central &&
        'exact' in central.value &&
        Q.eq(central.value.exact, Q.of(total * 1000n, geo.quantities.ncaMm2)),
    ).toBe(true);
    const mid = Q.toNumber(Q.of(total * 1000n, geo.quantities.ncaMm2));
    expect(e.eui.site.lo).toBeLessThanOrEqual(mid);
    expect(e.eui.site.hi).toBeGreaterThanOrEqual(mid);
    for (const b of e.bills) expect(b.byMonth.reduce((s, v) => s + v, 0n)).toBe(b.total);
    expect(e.eui.partial).toBe(false);
    const site = SiteResultSchema.parse(read(id, 'radiation'));
    for (const l of site.ledger) expect(l.lostWh >= 0n).toBe(true);
    const o = OptimiseResultSchema.parse(read(id, 'optimise'));
    expect(o.tried).toBe(o.candidates.length);
    const byId = new Map(o.candidates.map((c) => [c.id, c]));
    for (const f of o.front)
      for (const g of o.front)
        if (f !== g) expect(dominates(byId.get(g)!.axes, byId.get(f)!.axes, o.objectives)).toBe(false);
    for (const w of o.witnesses)
      expect(dominates(byId.get(w.by)!.axes, byId.get(w.dominated)!.axes, o.objectives)).toBe(true);
    expect(o.front.length + o.witnesses.length).toBe(o.candidates.filter((c) => c.feasible).length);
    const c = CodesOutSchema.parse(read(id, 'codes'));
    for (const r of c.ratings) {
      if (r.points.likely !== 'unknown' && r.points.possible !== undefined)
        expect(r.points.possible).toBeGreaterThanOrEqual(r.points.likely);
    }
  });

  it('slab bills are exact and telescopic (AC-BR2)', () => {
    // LT-I (BT 7.1): 200 units cost 820 rupees in LT-I(B)(i); 201 units move to LT-I(B)(ii) and cost 1,027.70.
    expect(slabMicroPaise(200_000n)).toBe(82_000_000_000n);
    expect(slabMicroPaise(201_000n)).toBe(102_770_000_000n);
    expect(slabMicroPaise(80_000n)).toBe((50n * 195n + 30n * 310n) * 1_000_000n);
  });
});

describe('P3 every value is Preview', () => {
  it.each(FIXTURE_BUILDINGS)('%s', (id) => {
    const graphs: EvidenceGraph[] = [
      BuildingResultSchema.parse(read(id, 'energy')).evidence,
      CodesOutSchema.parse(read(id, 'codes')).result.evidence,
    ];
    const opt = OptimiseResultSchema.parse(read(id, 'optimise'));
    if (opt.evidence) graphs.push(opt.evidence);
    for (const g of graphs) {
      expect(g.nodes.length).toBeGreaterThan(0);
      for (const n of g.nodes) {
        expect(n.provenance.kind).toBe('preview');
        expect(n.seal).toBe('preview');
      }
    }
    for (const s of ['sun', 'radiation', 'daylight', 'energy', 'optimise'] as const)
      expect(isPreview(read(id, s).stamp)).toBe(true);
  });
});

describe('P4 stage-provider contract', () => {
  it('all seven register and declare their stage', () => {
    const reg = createRegistry();
    for (const p of PREVIEW_PROVIDERS) reg.register(p);
    expect(PREVIEW_PROVIDERS.map((p) => p.stage)).toEqual([...STUDIO_STAGES]);
    expect(PREVIEW_PROVIDERS.every((p) => p.impl === 'preview')).toBe(true);
  });

  it('events: fraction rises to 1, tiers in order, one final, last', async () => {
    const events: AnyStageEvent[] = [];
    await runPreviewJob(req('gb4'), fixtureInputs('gb4'), (e) => events.push(e), { deviceFactor: 0.01 });
    for (const s of STUDIO_STAGES) {
      const ev = events.filter((e) => e.stage === s);
      expect(ev.length).toBeGreaterThanOrEqual(4);
      const fr = ev.map((e) => e.fraction);
      expect([...fr].sort((a, b) => a - b)).toEqual(fr);
      expect(ev.filter((e) => e.final !== undefined)).toHaveLength(1);
      expect(ev[ev.length - 1]?.final).toBeDefined();
      expect(ev[ev.length - 1]?.fraction).toBe(1);
      expect(ev.filter((e) => e.partial !== undefined).map((e) => e.tier)).toEqual(['rough', 'refined']);
    }
    const roughEnergy = events.find((e) => e.stage === 'energy' && e.tier === 'rough' && e.partial)
      ?.partial as BuildingResult;
    expect(roughEnergy.eui.partial).toBe(true);
  });

  it('cancel returns within one slice', async () => {
    let now = 0;
    setPreviewTimer(async (ms) => {
      now += ms;
    });
    const abort = new PreviewAbort();
    const inputs = fixtureInputs('gb4');
    const { outputs } = await runPreviewJob(
      req('gb4', ['geometry', 'sun', 'radiation', 'daylight', 'energy']),
      inputs,
      () => {},
      { deviceFactor: 0 },
    );
    const run = previewEnergy.run(
      {
        compiled: outputs.geometry!,
        site: { place: inputs.place, tiles: [], weatherHash: 'w' },
        settings: [],
        asOf: AS_OF,
      },
      {
        jobId: 'j',
        generation: 1,
        signal: abort,
        resolution: { level: 'standard', grid: 1000, stepMin: 15, skyPatches: 145, contextRadiusM: 300 },
        deviceFactor: 1,
      },
    );
    const it = run[Symbol.asyncIterator]();
    await it.next();
    const before = now;
    abort.abort();
    await expect(it.next()).rejects.toThrow();
    expect(now - before).toBeLessThanOrEqual(50);
    setPreviewTimer(async () => {});
  });

  it('a late older generation never replaces the live job (H9, reversed order)', async () => {
    const studio = createPreviewStudio({ deviceFactor: 0 });
    const inputs = fixtureInputs('gh1');
    const seen: number[] = [];
    const newer = studio.runJob(req('gh1', [...STUDIO_STAGES], 5), inputs, (e) => seen.push(e.generation));
    const older = studio.runJob(req('gh1', [...STUDIO_STAGES], 4), inputs, (e) => seen.push(e.generation));
    const [rn, ro] = await Promise.all([newer.done, older.done]);
    expect(ro.end.status).toBe('superseded');
    expect(rn.end.status).toBe('done');
    expect(seen.every((g) => g === 5)).toBe(true);
  });

  it('progress events never claim a tier that has not been delivered', async () => {
    const events: AnyStageEvent[] = [];
    await runPreviewJob(req('gh1', ['geometry', 'energy']), fixtureInputs('gh1'), (e) => events.push(e), {
      deviceFactor: 0.5,
    });
    const rank = { rough: 0, refined: 1, final: 2 } as const;
    for (const s of ['geometry', 'energy'] as const) {
      let delivered = -1;
      for (const e of events.filter((x) => x.stage === s)) {
        if (e.partial === undefined && e.final === undefined && e.fraction > 0)
          expect(rank[e.tier]).toBeLessThanOrEqual(Math.max(0, delivered));
        if (e.partial !== undefined || e.final !== undefined) delivered = rank[e.tier];
      }
    }
  });

  it('a newer generation supersedes the older job (H9)', async () => {
    const studio = createPreviewStudio({ deviceFactor: 0 });
    const inputs = fixtureInputs('gh1');
    const seen: number[] = [];
    const a = studio.runJob(req('gh1', [...STUDIO_STAGES], 1), inputs, (e) => seen.push(e.generation));
    const b = studio.runJob(req('gh1', [...STUDIO_STAGES], 2), inputs, (e) => seen.push(e.generation));
    const [ra, rb] = await Promise.all([a.done, b.done]);
    expect(rb.end.status).toBe('done');
    expect(['superseded', 'done']).toContain(ra.end.status);
    expect(seen.filter((g) => g === 1).length).toBeLessThan(seen.filter((g) => g === 2).length);
  });

  it('an edited document is recomputed, not replayed (what-if)', async () => {
    const inputs = fixtureInputs('gb4');
    const doc = structuredClone(inputs.doc);
    for (const st of doc.storeys)
      for (const r of st.rooms)
        for (const s of r.segments) if (s.window.kind === 'ratio') s.window.wwrPm = 400;
    const base = await runPreviewJob(req('gb4', ['geometry', 'energy']), inputs, () => {}, {
      deviceFactor: 0,
    });
    const more = await runPreviewJob(req('gb4', ['geometry', 'energy']), { ...inputs, doc }, () => {}, {
      deviceFactor: 0,
    });
    expect(more.outputs.energy!.eui.site.hi).toBeGreaterThan(base.outputs.energy!.eui.site.hi);
  });
});

describe('QA round 1: site, daylight and codes rules', () => {
  it('daylight only for regularly occupied rooms, no copied ECBC share', () => {
    const d = SiteResultSchema.parse(read('gb1', 'daylight'));
    const geo = CompiledBuildingSchema.parse(read('gb1', 'geometry'));
    const zones = isZoneTwin(geo.twin) ? geo.twin.zones : [];
    const typeOf = new Map(zones.flatMap((z) => z.roomIds.map((r) => [r, z.spaceTypeIds[0]] as const)));
    for (const r of d.rooms) {
      expect(['stair', 'circulation', 'plant', 'toilet-core', 'data-centre']).not.toContain(typeOf.get(r.id));
      expect(r.ecbcShare).toBeUndefined();
    }
  });

  it('unknown-height neighbours never shade, and only listed ids are replaced', () => {
    const inputs = fixtureInputs('gb1');
    const known = new Set(
      inputs.tiles
        .flatMap((t) => t.buildings)
        .filter((b) => b.height.source !== 'unknown')
        .map((b) => b.id),
    );
    const rad = SiteResultSchema.parse(read('gb1', 'radiation'));
    for (const l of rad.ledger) expect(known.has(l.blocker)).toBe(true);
  });

  it('ECSBC is judged by the ratio to the reference design; a straddling range is unknown', () => {
    for (const id of ['gb1', 'gb2', 'gb3'] as const) {
      const c = CodesOutSchema.parse(read(id, 'codes'));
      const row = c.codes.find((r) => r.ruleId === 'ECSBC.EPI-RATIO');
      const ratio = c.baselines[0]!.ratio;
      const expected = ratio.hi <= 1 ? true : ratio.lo > 1 ? false : 'unknown';
      expect(row?.status).toBe(expected);
    }
  });
});
