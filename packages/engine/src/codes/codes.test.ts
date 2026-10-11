/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BuildingDoc,
  BuildingResult,
  CodesOut,
  CompiledBuilding,
  EnergyParams,
  Place,
} from '@ibasho/core';
import { createRegistry, mergeTypeLibraries } from '@ibasho/core';
import {
  BuildingDocSchema,
  CodesOutSchema,
  CompiledBuildingSchema,
  PlaceSchema,
  toWireJson,
} from '@ibasho/core/schemas';
import { describe, expect, it } from 'vitest';
import { ASHRAE_APPG, CODES_UK } from '../../../../packs/codes-global/src/engine/index.ts';
import { CODES_IN, ECSBC_EDITIONS } from '../../../../packs/codes-in/src/engine/index.ts';
import { RATING_SCHEMES } from '../../../../packs/ratings/src/engine/index.ts';
import { typesGlobalLibrary } from '../../../../packs/types-global/src/engine/index.ts';
import { typesInLibrary } from '../../../../packs/types-in/src/engine/index.ts';
import { computeRealEnergy } from '../enduse/provider.ts';
import type { CodesCatalogue } from './catalogue.ts';
import { computeRealCodes, createRealCodesProvider } from './provider.ts';

const root = join(import.meta.dirname, '..', '..', '..', '..');
const json = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const places: Place[] = json('packages/fixtures/src/buildings/places.json').map((p: unknown) =>
  PlaceSchema.parse(p),
);
const LIB = mergeTypeLibraries(typesInLibrary, typesGlobalLibrary);
const CAT: CodesCatalogue = {
  india: CODES_IN,
  indiaEditions: ECSBC_EDITIONS,
  uk: CODES_UK,
  appG: ASHRAE_APPG,
  ratings: RATING_SCHEMES,
};

function codesFor(
  id: string,
  opts: { params?: EnergyParams; place?: string; doc?: (d: BuildingDoc) => BuildingDoc } = {},
): CodesOut {
  const compiled: CompiledBuilding = CompiledBuildingSchema.parse(
    json(`packages/fixtures/src/preview/${id}/geometry.json`),
  );
  let doc = BuildingDocSchema.parse(json(`packages/fixtures/src/buildings/${id}.building.json`));
  if (opts.doc) doc = opts.doc(doc);
  const place = places.find((p) => p.id === (opts.place ?? doc.placeId)) as Place;
  const site = { place, tiles: [], weatherHash: place.climatePackId };
  const energy: BuildingResult = computeRealEnergy(
    { compiled, site, settings: [], ...(opts.params ? { params: opts.params } : {}), asOf: '2026-10-11' },
    LIB,
  );
  return computeRealCodes(
    {
      compiled,
      doc,
      energy,
      site,
      codePackIds: place.codePackIds,
      ...(opts.params ? { params: opts.params } : {}),
      asOf: '2026-10-11',
    },
    CAT,
    LIB,
  );
}
const rule = (c: CodesOut, id: string) => c.codes.find((r) => r.ruleId === id);

describe('real codes (WP-19)', () => {
  it('GB1 (education, Hyderabad): ECSBC by ratio to the standard design, App G baseline, ladders', () => {
    const c = codesFor('gb1');
    CodesOutSchema.parse(JSON.parse(toWireJson(c)));
    expect(c.baselines.map((b) => b.code)).toEqual(['ECSBC 2024', 'ASHRAE 90.1-2022 App G']);
    const epi = rule(c, 'ECSBC.EPI-RATIO');
    const r = c.baselines[0]?.ratio;
    expect(epi?.status).toBe(r && (r.hi <= 1 ? true : r.lo > 1 ? false : 'unknown'));
    // Undeclared envelope values stay unknown, never the model's assumed defaults.
    expect(rule(c, 'ECSBC.ENV.UWALL')?.status).toBe('unknown');
    expect(rule(c, 'ECSBC.ENV.SHGC')?.status).toBe('unknown');
    expect(rule(c, 'TSECBC.SCOPE')?.status).toBe(true);
    expect(c.ratings.map((x) => x.scheme)).toEqual(
      expect.arrayContaining(['GHMC-stars', 'LEED', 'IGBC', 'GRIHA', 'EDGE']),
    );
    expect(c.result.stamp.providers.find((p) => p.stage === 'codes')?.impl).toBe('real');
  });

  it('declared design values decide prescriptive rows and tiers', () => {
    const good = codesFor('gb3', {
      params: { uWall: 0.3, uRoof: 0.2, uWin: 2.0, shgc: 0.24, roofAbsorptance: 0.3, lpdScale: 0.6 },
    });
    expect(rule(good, 'ECSBC.ENV.UWALL')?.status).toBe(true);
    expect(rule(good, 'ECSBC.ENV.UWALL')?.tier).toBe(2);
    expect(rule(good, 'ECSBC.ENV.UROOF')?.tier).toBe(3);
    expect(rule(good, 'ECSBC.ENV.COOLROOF')?.status).toBe(true);
    const bad = codesFor('gb3', { params: { uWall: 1.9, shgc: 0.62 } });
    expect(rule(bad, 'ECSBC.ENV.UWALL')?.status).toBe(false);
    expect(rule(bad, 'ECSBC.ENV.SHGC')?.status).toBe(false);
    // The better envelope moves the performance ratio down.
    expect((good.baselines[0]?.ratio.hi ?? 9) < (bad.baselines[0]?.ratio.hi ?? 0)).toBe(true);
    // Offices get the BEE star band.
    expect(good.ratings.some((x) => x.scheme === 'BEE-star')).toBe(true);
  });

  it('GB4 apartments: Eco Niwas Samhita rows, no ECSBC', () => {
    const c = codesFor('gb4');
    expect(rule(c, 'ENS.RETV')).toBeDefined();
    expect(rule(c, 'ENS.OPENABLE')).toBeDefined();
    expect(rule(c, 'ECSBC.EPI-RATIO')).toBeUndefined();
    const declared = codesFor('gb4', { params: { uWall: 0.6, uWin: 2.0, shgc: 0.3, uRoof: 0.9 } });
    expect(rule(declared, 'ENS.RETV')?.status).not.toBe('unknown');
    expect(rule(declared, 'ENS.UROOF')?.status).toBe(true);
  });

  it('GH1: an existing London home gets no Indian rows; as a new build at King’s Cross it gets Part L, FHS, Part O and the London Plan', () => {
    const old = codesFor('gh1');
    expect(old.codes.some((r) => r.ruleId.startsWith('ECSBC') || r.ruleId.startsWith('ENS'))).toBe(false);
    expect(rule(old, 'UK.EPC.ESTIMATE')).toBeDefined();
    const nb = codesFor('gh1', {
      place: 'pl_kings_cross',
      doc: (d) => {
        const { permitDate: _p, ...rest } = d;
        return rest as BuildingDoc;
      },
    });
    expect(rule(nb, 'UK.PARTL.CO2')).toBeDefined();
    expect(rule(nb, 'UK.FHS.2025')?.status).toBe(false); // gas boiler
    expect(rule(nb, 'UK.PARTO.GLAZING')).toBeDefined();
    expect(rule(nb, 'LONDON.PLAN.SI2')).toBeDefined();
    const hp = codesFor('gh1', {
      place: 'pl_kings_cross',
      params: { heatPumpScop: 3, uWall: 0.18, uRoof: 0.11, uWin: 1.2 },
      doc: (d) => {
        const { permitDate: _p, ...rest } = d;
        return rest as BuildingDoc;
      },
    });
    expect(rule(hp, 'UK.FHS.2025')?.status).not.toBe(false);
    expect(rule(hp, 'UK.PARTL.FABRIC')?.status).toBe(true);
  });

  it('never says compliant or certified; rating tables register (monotone)', () => {
    const c = codesFor('gb1');
    expect(JSON.stringify(c.codes) + JSON.stringify(c.ratings)).not.toMatch(/\bcompliant\b|\bcertified\b/i);
    const reg = createRegistry();
    for (const s of RATING_SCHEMES) reg.register(s);
    reg.register(createRealCodesProvider(CAT, LIB));
  });

  it('provider: rough (no baselines) before final', async () => {
    const compiled = CompiledBuildingSchema.parse(json('packages/fixtures/src/preview/gb3/geometry.json'));
    const doc = BuildingDocSchema.parse(json('packages/fixtures/src/buildings/gb3.building.json'));
    const place = places.find((p) => p.id === doc.placeId) as Place;
    const site = { place, tiles: [], weatherHash: 'w' };
    const energy = computeRealEnergy({ compiled, site, settings: [], asOf: '2026-10-11' }, LIB);
    const events: { partial?: CodesOut; final?: CodesOut }[] = [];
    const signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
    for await (const e of createRealCodesProvider(CAT, LIB).run(
      { compiled, doc, energy, site, codePackIds: place.codePackIds, asOf: '2026-10-11' },
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
    expect(rough?.baselines).toEqual([]);
    expect(rule(rough as CodesOut, 'ECSBC.EPI-RATIO')?.status).toBe('unknown');
    expect(events[events.length - 1]?.final?.baselines.length).toBe(2);
  });
});
