/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BuildingResult, CompiledBuilding, Place, TypeLibrary } from '@ibasho/core';
import { BUILDING_TYPES, createRegistry, END_USES, isPreview, mergeTypeLibraries, Q } from '@ibasho/core';
import {
  BuildingResultSchema,
  CompiledBuildingSchema,
  PlaceSchema,
  SiteResultSchema,
} from '@ibasho/core/schemas';
import { describe, expect, it } from 'vitest';
import { BENCHMARKS } from '../../../../packs/benchmarks/src/engine/index.ts';
import { typesGlobalLibrary } from '../../../../packs/types-global/src/engine/index.ts';
import { typesInLibrary } from '../../../../packs/types-in/src/engine/index.ts';
import { simulateRc } from '../zones/rc.ts';
import { computeRealEnergy, createRealEnergyProvider } from './provider.ts';

const root = join(import.meta.dirname, '..', '..', '..', '..');
const json = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const places: Place[] = json('packages/fixtures/src/buildings/places.json').map((p: unknown) =>
  PlaceSchema.parse(p),
);
const LIB_UK = mergeTypeLibraries(typesInLibrary, typesGlobalLibrary);

function setup(id: string): {
  compiled: CompiledBuilding;
  place: Place;
  lib: TypeLibrary;
  preview: BuildingResult;
} {
  const compiled = CompiledBuildingSchema.parse(json(`packages/fixtures/src/preview/${id}/geometry.json`));
  const preview = BuildingResultSchema.parse(json(`packages/fixtures/src/preview/${id}/energy.json`));
  const placeId = json(`packages/fixtures/src/buildings/${id}.building.json`).placeId as string;
  const place = places.find((p) => p.id === placeId) as Place;
  return { compiled, place, lib: place.climatePackId.includes('london') ? LIB_UK : typesInLibrary, preview };
}
const run = (id: string, params = {}) => {
  const s = setup(id);
  return computeRealEnergy(
    {
      compiled: s.compiled,
      site: { place: s.place, tiles: [], weatherHash: s.place.climatePackId },
      settings: [],
      params,
      asOf: '2026-10-11',
    },
    s.lib,
  );
};
const mid = (r: BuildingResult) => (r.eui.site.lo + r.eui.site.hi) / 2;
const annual = (r: BuildingResult, u: (typeof END_USES)[number]) =>
  r.endUses[u].reduce<number>((s, v) => s + (v === 'unknown' ? 0 : Number(v)), 0);

describe('5R1C zone (ISO 13790 Annex C)', () => {
  it('steady state: free floating air settles at outdoor temperature; held heating equals H x dT', () => {
    const n = 2000;
    const z = { af: 100, htrW: 50, htrOp: 100, cmJ: 165_000 * 100 };
    const te = new Float64Array(n).fill(5);
    const hve = new Float64Array(n).fill(30);
    const zeros = new Float64Array(n);
    const nan = new Float64Array(n).fill(Number.NaN);
    const free = simulateRc(z, { te, hve, phiInt: zeros, phiSol: zeros, heatSet: nan, coolSet: nan });
    expect(Math.abs((free.air[n - 1] as number) - 5)).toBeLessThan(1e-6);
    const held = simulateRc(z, {
      te,
      hve,
      phiInt: zeros,
      phiSol: zeros,
      heatSet: new Float64Array(n).fill(20),
      coolSet: nan,
    });
    // Steady state: total conductance from air to outdoors is hve + (window + opaque path through the mass node).
    const am = 2.5 * z.af;
    const htrMs = 9.1 * am;
    const htrEm = 1 / (1 / z.htrOp - 1 / htrMs);
    const opaque = 1 / (1 / htrMs + 1 / htrEm);
    const htrIs = 3.45 * 4.5 * z.af;
    const surfaceToOut = z.htrW + opaque;
    const htot = 30 + 1 / (1 / htrIs + 1 / surfaceToOut);
    expect((held.heat[n - 1] as number) / (htot * 15)).toBeCloseTo(1, 2);
  });
});

describe('real energy stage', () => {
  it('is deterministic and validates against the BuildingResult schema', () => {
    const a = run('gb3');
    const b = run('gb3');
    expect(
      BuildingResultSchema.parse(
        JSON.parse(JSON.stringify(a, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))),
      ),
    ).toEqual(a);
    expect(JSON.stringify(a, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).toBe(
      JSON.stringify(b, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
    );
    for (const bill of a.bills) expect(bill.byMonth.reduce((s, v) => s + v, 0n)).toBe(bill.total);
    expect(a.stamp.impl).toBe('real');
    const central = a.evidence.nodes.find((n) => n.quantity === 'eui.site.central');
    const total = END_USES.reduce(
      (s, u) => s + a.endUses[u].reduce<bigint>((x, v) => x + (v === 'unknown' ? 0n : v), 0n),
      0n,
    );
    const nca = setup('gb3').compiled.quantities.ncaMm2;
    expect(central && 'exact' in central.value && Q.eq(central.value.exact, Q.of(total * 1000n, nca))).toBe(
      true,
    );
    for (const n of a.evidence.nodes) expect(['modelled']).toContain(n.seal);
  });

  it('sits inside the benchmark ranges for its type (BEE, CBECS, ENS, TM46)', () => {
    const within = (id: string, benchmarkId: string, slack = 1.1) => {
      const b = BENCHMARKS.find((x) => x.benchmarkId === benchmarkId);
      const m = mid(run(id));
      expect(m, `${id} ${m}`).toBeGreaterThanOrEqual((b?.median?.low ?? 0) / slack);
      expect(m, `${id} ${m}`).toBeLessThanOrEqual((b?.median?.high ?? 1e9) * slack);
    };
    within('gb3', 'cbecs-office');
    within('gb3', 'bee-office-composite');
    within('gb2', 'cbecs-education');
    within('gb4', 'ens-apartments');
    within('gh1', 'tm46-dwelling');
  });

  it('agrees with the Preview model within a factor of two for every golden building', () => {
    for (const id of ['gb1', 'gb2', 'gb3', 'gb4', 'gh1']) {
      const r = mid(run(id));
      const p = mid(setup(id).preview);
      expect(r / p, id).toBeGreaterThan(0.5);
      expect(r / p, id).toBeLessThan(2);
    }
  });

  it('responds to the design levers', () => {
    const base = run('gb3');
    expect(annual(run('gb3', { lpdScale: 0.65 }), 'lighting')).toBeLessThan(annual(base, 'lighting') * 0.7);
    expect(annual(run('gb3', { setpointC: 26 }), 'cooling')).toBeLessThan(annual(base, 'cooling'));
    expect(annual(run('gb3', { shgc: 0.3, uWin: 2.8 }), 'cooling')).toBeLessThan(annual(base, 'cooling'));
    expect(annual(run('gb3', { pvKwp: 200 }), 'pv')).toBeLessThan(-250_000_000);
    expect(annual(run('gh1', { heatPumpScop: 3 }), 'heating')).toBeLessThan(annual(run('gh1'), 'heating'));
  });

  it('registers as the energy stage provider; a Preview input keeps the stamp Preview (R26)', () => {
    const reg = createRegistry();
    reg.register(createRealEnergyProvider(typesInLibrary));
    const s = setup('gb3');
    const radiation = SiteResultSchema.parse(json('packages/fixtures/src/preview/gb3/radiation.json'));
    const r = computeRealEnergy(
      {
        compiled: s.compiled,
        radiation,
        site: { place: s.place, tiles: [], weatherHash: 'w' },
        settings: [],
        asOf: '2026-10-11',
      },
      s.lib,
    );
    expect(isPreview(r.stamp)).toBe(true);
  });
});

describe('tiers: rough then final (stage contract)', () => {
  it('emits a rough partial from merged zones, close to the final, before the final', async () => {
    const s = setup('gb1');
    const provider = createRealEnergyProvider(s.lib);
    const events: { tier: string; partial?: BuildingResult; final?: BuildingResult; fraction: number }[] = [];
    const signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
    for await (const e of provider.run(
      {
        compiled: s.compiled,
        site: { place: s.place, tiles: [], weatherHash: 'w' },
        settings: [],
        asOf: '2026-10-11',
      },
      {
        jobId: 'j',
        generation: 1,
        signal,
        resolution: { level: 'standard', grid: 1000, stepMin: 15, skyPatches: 145, contextRadiusM: 300 },
        deviceFactor: 1,
      },
    ))
      events.push(e);
    const rough = events.find((e) => e.partial)?.partial;
    const final = events[events.length - 1]?.final;
    expect(rough?.stamp.tier).toBe('rough');
    expect(final?.stamp.tier).toBe('final');
    expect(events.findIndex((e) => e.partial) < events.findIndex((e) => e.final)).toBe(true);
    expect(Math.abs(mid(rough as BuildingResult) / mid(final as BuildingResult) - 1)).toBeLessThan(0.15);
  });
});

describe('all eight building types (R25)', () => {
  it('run on a generic plate and land in their benchmark range (labs: above offices)', async () => {
    const { sweepBenchmark, sweepRun } = await import('../../../fixtures/src/energy/type-sweep.ts');
    const euis = new Map<string, number>();
    for (const typeId of BUILDING_TYPES) {
      const r = sweepRun(typeId);
      BuildingResultSchema.parse(
        JSON.parse(JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))),
      );
      const m = mid(r);
      euis.set(typeId, m);
      const b = sweepBenchmark(typeId);
      // CBECS labs are US labs with reheat and 24 h exhaust; an Indian lab is checked against the office instead.
      if (typeId === 'lab' || !b) continue;
      expect(m, `${typeId} ${m}`).toBeGreaterThanOrEqual(b.low / 1.25);
      expect(m, `${typeId} ${m}`).toBeLessThanOrEqual(b.high * 1.25);
    }
    expect(euis.get('lab') ?? 0).toBeGreaterThan(1.5 * (euis.get('office') ?? 0));
    expect(euis.get('hospital') ?? 0).toBeGreaterThan(euis.get('office') ?? 0);
  });
});
