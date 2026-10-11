import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnyStageEvent, BuildingResult, EvidenceGraph, JobRequest, Place, StageId } from '@ibasho/core';
import {
  createRegistry,
  dominates,
  END_USES,
  GOAL_PRESETS,
  isPreview,
  isZoneTwin,
  Q,
  STUDIO_STAGES,
} from '@ibasho/core';
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
  computeGeometry,
  createPreviewStudio,
  DEFAULT_DEVICE_FACTOR,
  headlineBill,
  PARAM_PRESETS,
  PREVIEW_PROVIDERS,
  PreviewAbort,
  placementChange,
  previewEnergy,
  runPreviewJob,
  setPreviewTimer,
  stagesForPlacementChange,
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

describe('QA round 2 and design parameters', () => {
  it('lists unknown-height neighbours it left out (R2-m1)', () => {
    const rad = SiteResultSchema.parse(read('gb1', 'radiation'));
    const ids = rad.unknownHeightIds ?? [];
    expect(ids.length).toBeGreaterThan(0);
    expect([...ids].sort()).toEqual(ids);
    const blockers = new Set(rad.ledger.map((l) => l.blocker));
    for (const id of ids) expect(blockers.has(id)).toBe(false);
  });

  it('AC hours fall when the set point rises (R2-m2)', () => {
    for (const id of ['gb1', 'gb2', 'gb4'] as const) {
      const e = BuildingResultSchema.parse(read(id, 'energy'));
      for (const c of e.comfort) {
        const at = (s: number) => c.acHours.find((a) => a.setpointC === s)!.hours.hi;
        expect(at(26), `${id} ${c.roomId}`).toBeLessThan(at(24));
      }
    }
  });

  it('a London home gets no Indian code baseline (R2-m4)', () => {
    const c = CodesOutSchema.parse(read('gh1', 'codes'));
    expect(c.baselines).toEqual([]);
    expect(c.codes.some((r) => r.ruleId.startsWith('ECSBC') || r.ruleId.startsWith('ECBC'))).toBe(false);
  });

  it('GB2 cooling is 1,500 to 2,200 full load hours on its 400 TR plant (R2-m5)', () => {
    const e = BuildingResultSchema.parse(read('gb2', 'energy'));
    const kwh = e.endUses.cooling.reduce<number>((s, v) => s + (v === 'unknown' ? 0 : Number(v)), 0) / 1000;
    const eflh = (kwh * 3.4) / 1407;
    expect(eflh).toBeGreaterThan(1500);
    expect(eflh).toBeLessThan(2200);
  });

  it('energy reads design parameters from its input; none leaves the result unchanged', async () => {
    const inputs = fixtureInputs('gb1');
    const stages: StageId[] = ['geometry', 'energy'];
    const run = (energyParams?: object) =>
      runPreviewJob(req('gb1', stages), { ...inputs, ...(energyParams ? { energyParams } : {}) }, () => {}, {
        deviceFactor: 0,
      });
    const base = await run();
    const same = await run({});
    expect(same.outputs.energy!.inputsHash).toBe(base.outputs.energy!.inputsHash);
    const levers = await run({
      ...PARAM_PRESETS.glazing['low-e'],
      ...PARAM_PRESETS.lighting.led,
      setpointC: 26,
      pvKwp: 100,
    });
    const sum = (r: BuildingResult, u: (typeof END_USES)[number]) =>
      r.endUses[u].reduce<number>((s, v) => s + (v === 'unknown' ? 0 : Number(v)), 0);
    const a = base.outputs.energy!;
    const b = levers.outputs.energy!;
    expect(b.inputsHash).not.toBe(a.inputsHash);
    expect(sum(b, 'cooling')).toBeLessThan(sum(a, 'cooling'));
    expect(sum(b, 'lighting')).toBeLessThan(sum(a, 'lighting'));
    expect(sum(b, 'pv')).toBeLessThan(0);
    expect(b.eui.site.hi).toBeLessThan(a.eui.site.hi);
  });
});

describe('studio review A-M2 and A-M3', () => {
  it('one canonical bill: energy, codes and the optimiser baseline agree', async () => {
    const { outputs } = await runPreviewJob(req('gb1'), fixtureInputs('gb1'), () => {}, { deviceFactor: 0 });
    const bill = headlineBill(outputs.energy!);
    expect(headlineBill(outputs.codes!.result).total).toBe(bill.total);
    const opt = outputs.optimise!;
    const opexAt = opt.objectives.findIndex((o) => o.id === 'opex');
    const baseline = opt.candidates.find((c) => /^c0+$/.test(c.id));
    expect(baseline?.axes[opexAt]).toBe(bill.whole);
  });

  it('each rough stage result is ready within 300 ms of the stage starting', async () => {
    const started = new Map<string, number>();
    const late: string[] = [];
    await runPreviewJob(
      req('gb1'),
      fixtureInputs('gb1'),
      (e) => {
        if (e.fraction === 0) started.set(e.stage, performance.now());
        if (e.partial !== undefined && e.tier === 'rough') {
          const ms = performance.now() - (started.get(e.stage) ?? 0);
          if (ms > 300) late.push(`${e.stage} ${Math.round(ms)} ms`);
        }
      },
      { deviceFactor: 0 },
    );
    expect(late).toEqual([]);
    expect(DEFAULT_DEVICE_FACTOR).toBeLessThanOrEqual(0.1);
  });
});

describe('SPEC 27 design before you build', () => {
  const london = () => fixtureInputs('gh1').place;

  it('codes follow the plot: a designed office in London gets Part L, FHS and the London Plan', async () => {
    const office = fixtureInputs('gb3');
    const doc = { ...office.doc, placeId: 'pl_london' };
    const goals = GOAL_PRESETS.filter((p) =>
      ['part-l', 'fhs-2025', 'london-plan', 'leed-gold', 'net-zero-ready-uk'].includes(p.id),
    ).map((p) => ({
      goal: p.goal,
      scope: { level: 'building' as const, id: 'gb3' },
      strength: 'prefer' as const,
    }));
    const { outputs } = await runPreviewJob(
      req('gb3', ['geometry', 'energy', 'codes']),
      { doc, place: london(), tiles: [], goals },
      () => {},
      {
        deviceFactor: 0,
      },
    );
    const ids = outputs.codes!.codes.map((c) => c.ruleId);
    expect(ids).toEqual(expect.arrayContaining(['UK.PARTL.ENERGY', 'UK.FHS.2025', 'LONDON.PLAN.SI2']));
    expect(ids.some((i) => i.startsWith('ECSBC'))).toBe(false);
    expect(outputs.codes!.baselines[0]?.code).toBe('Part L 2021');
    const gaps = outputs.codes!.gaps!;
    expect(gaps).toHaveLength(5);
    for (const g of gaps) {
      expect(['met', 'not-met', 'unknown']).toContain(g.status);
      expect(g.sources.length).toBeGreaterThan(0);
    }
    // A gas-heated design is never net zero ready.
    expect(gaps.find((g) => g.presetId === 'fhs-2025')?.status).toBe('not-met');
    expect(gaps.find((g) => g.presetId === 'leed-gold')?.status).toBe('unknown');
    expect(CodesOutSchema.parse(JSON.parse(toWireJson(outputs.codes)))).toBeTruthy();
  });

  it('existing UK homes keep the existing-home row only; Indian plots get the ECSBC tier gap', async () => {
    const gh = await runPreviewJob(
      req('gh1', ['geometry', 'energy', 'codes']),
      fixtureInputs('gh1'),
      () => {},
      { deviceFactor: 0 },
    );
    expect(gh.outputs.codes!.codes.map((c) => c.ruleId)).toEqual(['UK.EPC.ESTIMATE']);
    const goals = [
      {
        goal: { kind: 'code' as const, ruleStem: 'ECSBC', tier: 3 as const },
        scope: { level: 'building' as const, id: 'gb1' },
        strength: 'must' as const,
      },
    ];
    const gb = await runPreviewJob(
      req('gb1', ['geometry', 'energy', 'codes']),
      { ...fixtureInputs('gb1'), goals },
      () => {},
      { deviceFactor: 0 },
    );
    const gap = gb.outputs.codes!.gaps![0]!;
    expect(gap.target).toBe(0.7);
    expect(gap.status).toBe('not-met');
  });

  it('a move reuses the compiled geometry; a rotation does not', () => {
    const { doc } = fixtureInputs('gb4');
    const moved = { ...doc, origin: { x: doc.origin.x + 20_000, y: doc.origin.y } };
    const turned = { ...doc, rotationMdeg: doc.rotationMdeg + 15_000 };
    expect(placementChange(doc, moved)).toBe('move');
    expect(placementChange(doc, turned)).toBe('rotate');
    expect(placementChange(doc, { ...doc })).toBe('none');
    const a = computeGeometry({ doc, packsFingerprint: 'p' }, 'final');
    const b = computeGeometry({ doc: moved, packsFingerprint: 'p' }, 'final');
    expect(b.quantities).toBe(a.quantities);
    expect(b.docHash).not.toBe(a.docHash);
    expect(b.placement?.origin.x).toBe(moved.origin.x);
    const c = computeGeometry({ doc: turned, packsFingerprint: 'p' }, 'final');
    expect(c.quantities).not.toBe(a.quantities);
    expect(stagesForPlacementChange('move')).toContain('sun');
  });
});

describe('Preview follows the plot (studio review round 3)', () => {
  it('a London plot gets London weather, pounds and UK codes even with Indian pack ids', async () => {
    const inputs = fixtureInputs('gb3');
    const { cityPackId: _c, ...rest } = inputs.place;
    const london: Place = {
      ...rest,
      id: 'pl_test_london',
      lat: 51.5352,
      lon: -0.125,
      climatePackId: 'climate.hyderabad',
      moneyPackIds: [],
      codePackIds: ['codes-in'],
    };
    const hyd = await runPreviewJob(
      req('gb3', ['geometry', 'sun', 'radiation', 'energy', 'codes']),
      { ...inputs, tiles: [] },
      () => {},
      { deviceFactor: 0 },
    );
    const ldn = await runPreviewJob(
      req('gb3', ['geometry', 'sun', 'radiation', 'energy', 'codes']),
      { ...inputs, place: london, tiles: [] },
      () => {},
      { deviceFactor: 0 },
    );
    expect(ldn.outputs.energy?.bills[0]?.currency).toBe('GBP');
    expect(hyd.outputs.energy?.bills[0]?.currency).toBe('INR');
    expect(
      ldn.outputs.codes?.codes.some((r) => r.ruleId.startsWith('ECSBC') || r.ruleId.startsWith('ECBC')),
    ).toBe(false);
    const roofHours = (o: typeof ldn) =>
      Math.max(...(o.outputs.sun?.surfaces.map((s) => s.sunHours?.annual ?? 0) ?? [0]));
    expect(roofHours(ldn)).toBeLessThan(roofHours(hyd));
    expect(roofHours(ldn) / 365).toBeLessThan(6);
  });

  it('picks mean different things and do not all name one bundle', () => {
    const o = OptimiseResultSchema.parse(read('gb1', 'optimise'));
    const id = (r: string) => o.picks.find((p) => p.role === r)?.id;
    expect(id('lowest-running')).not.toBe(id('lowest-energy'));
    expect(id('least-upfront')).not.toBe(id('best-return'));
  });

  it('ranges read low to high', () => {
    for (const b of FIXTURE_BUILDINGS) {
      const e = BuildingResultSchema.parse(read(b, 'energy'));
      expect(e.eui.site.lo).toBeLessThan(e.eui.site.hi);
      expect(e.eui.source.lo).toBeLessThan(e.eui.source.hi);
    }
  });
});
