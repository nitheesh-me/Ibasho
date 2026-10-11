import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { Q } from '../src/exact/q.ts';
import {
  BuildingDocSchema,
  BuildingResultSchema,
  CityTileSchema,
  OptimiseResultSchema,
  PlaceSchema,
  SiteResultSchema,
  toWireJson,
} from '../src/schemas/index.ts';
import {
  type BuildingDoc,
  type BuildingResult,
  type CityTile,
  downstreamStages,
  END_USES,
  euiIsPartial,
  facadeBin,
  isPreview,
  type OptimiseResult,
  type Place,
  type ResultStamp,
  type SiteResult,
} from '../src/v3/index.ts';

const roundTrip = <T>(schema: z.ZodType<T>, value: T) => {
  const parsed = schema.parse(JSON.parse(toWireJson(value)));
  expect(parsed).toEqual(value);
};

const stamp: ResultStamp = {
  impl: 'preview',
  providers: [{ stage: 'energy', id: 'preview.energy', version: '0.1.0', impl: 'preview' }],
  tier: 'final',
  computedAt: '2026-10-11',
};
const m12 = <T>(v: T): T[] => Array.from({ length: 12 }, () => v);

const doc: BuildingDoc = {
  schema: 'ibasho.building/1',
  id: 'b_test',
  version: 1,
  placeId: 'pl_test',
  name: 'Test block',
  typeId: 'education',
  origin: { x: 0, y: 0 },
  rotationMdeg: 0,
  storeys: [
    {
      id: 'st_0',
      name: 'Ground',
      elevation: 0,
      floorToFloor: 3600,
      multiplier: 1,
      belowGrade: false,
      rooms: [
        {
          id: 'rm_a',
          floor: {
            outer: [
              [0, 0],
              [6000, 0],
              [6000, 4000],
              [0, 4000],
            ],
            holes: [],
          },
          ceiling: 3300,
          spaceTypeId: 'classroom',
          segments: ['s', 'e', 'n', 'w'].map((k) => ({
            id: `sg_${k}`,
            boundary: { kind: 'outdoors' as const },
            window: { kind: 'ratio' as const, wwrPm: 300, sill: 900 },
            shading: [{ kind: 'overhang' as const, depth: 600, aboveHead: 0, extension: 0 }],
          })),
          floorBoundary: 'ground',
          ceilingBoundary: 'roof',
        },
      ],
      rooms3d: [],
      cores: [],
    },
  ],
  roofs: [],
  shades: [],
  zones: [{ id: 'z_1', roomIds: ['rm_a'], conditioned: true }],
  systems: [],
};

describe('v3 schema round trips (V-0)', () => {
  it('BuildingDoc', () => roundTrip(BuildingDocSchema, doc));

  it('Place and CityTile', () => {
    const place: Place = {
      id: 'pl_test',
      name: 'IIIT',
      lat: 17.4453,
      lon: 78.349,
      elevationM: 540,
      trueNorthMdeg: 0,
      climatePackId: 'climate.hyderabad',
      codePackIds: ['codes-in'],
      moneyPackIds: ['money-in'],
      buildingIds: ['b_test'],
    };
    roundTrip(PlaceSchema, place);
    const tile: CityTile = {
      schema: 'ibasho.city/1',
      packId: 'city-hyderabad',
      tx: 0,
      ty: 0,
      buildings: [
        {
          id: 'osm_w1',
          footprint: [
            [0, 0],
            [10000, 0],
            [10000, 10000],
          ],
          height: { lo: 6000, likely: 9000, hi: 12000, source: 'osm-levels' },
          levels: 3,
          sources: ['osm:way/1'],
        },
      ],
      trees: [],
    };
    roundTrip(CityTileSchema, tile);
  });

  it('SiteResult', () => {
    const site: SiteResult = {
      inputsHash: 'h',
      weatherHash: 'w',
      sceneHash: 's',
      method: 'T0',
      kernel: 'cpu',
      resolution: { level: 'sketch', grid: 2000, stepMin: 60, skyPatches: 145, contextRadiusM: 200 },
      stamp,
      surfaces: [{ id: 'sg_s', irrWhm2: m12(100_000n), svf: Q.of(3n, 5n) }],
      windows: [{ id: 'sg_s', shadingFactor: m12(Q.of(9n, 10n)) }],
      rooms: [{ id: 'rm_a', sda: { lo: 40, hi: 55 }, tier: 'T0' }],
      ledger: [{ receiver: 'sg_s', blocker: 'osm_w1', lostWh: 1234n }],
    };
    roundTrip(SiteResultSchema, site);
  });

  it('BuildingResult and OptimiseResult', () => {
    const endUses = Object.fromEntries(
      END_USES.map((u) => [u, m12(1000n)]),
    ) as unknown as BuildingResult['endUses'];
    const res: BuildingResult = {
      inputsHash: 'h',
      stamp,
      endUses,
      eui: { site: { lo: 90, hi: 120 }, source: { lo: 250, hi: 330 }, partial: false },
      conditionedM2: 24,
      bills: [
        {
          carrier: 'electricity',
          tariffId: 'tgspdcl.ht-ii',
          currency: 'INR',
          byMonth: m12(5n),
          total: 60n,
          cliffMonths: [4],
        },
      ],
      carbon: { op: 100n, factorIds: ['cea.2024'] },
      comfort: [],
      codes: [
        {
          ruleId: 'ECSBC.EPI',
          edition: '2024',
          status: 'unknown',
          applicability: 'partial',
          grade: 'estimate',
        },
      ],
      ratings: [],
      evidence: {
        schema: 'ibasho.evidence/1',
        nodes: [
          {
            id: 'ev_1',
            quantity: 'b.eui.site',
            subject: { homeId: 'b_test', mode: 'standard' },
            value: { interval: { lo: 90, hi: 120 } },
            unit: 'kWh/m2.yr',
            formula: { id: 'EUI', doc: 'sum of end uses over area' },
            inputs: [],
            provenance: { kind: 'preview' },
            seal: 'preview',
            rounding: { mode: 'sig', value: 2 },
          },
        ],
        external: [],
      },
      asOf: '2026-10-11',
    };
    roundTrip(BuildingResultSchema, res);
    expect(euiIsPartial(res.endUses)).toBe(false);
    const opt: OptimiseResult = {
      inputsHash: 'h',
      stamp,
      objectives: [
        { id: 'capex', dir: 'min' },
        { id: 'eui', dir: 'min' },
      ],
      method: 'exhaustive',
      tried: 2,
      candidates: [
        { id: 'c1', ops: [], axes: [1n, 2n], feasible: true, evidence: ['ev_1'] },
        { id: 'c2', ops: [], axes: [2n, 3n], feasible: true, evidence: ['ev_1'] },
      ],
      front: ['c1'],
      witnesses: [{ dominated: 'c2', by: 'c1' }],
      picks: [],
      sweeps: [],
    };
    roundTrip(OptimiseResultSchema, opt);
  });
});

describe('v3 helpers', () => {
  it('downstream stages follow the bar', () => {
    expect(downstreamStages(['energy'])).toEqual(['energy', 'codes', 'optimise']);
    expect(downstreamStages(['geometry'])).toHaveLength(7);
  });
  it('facade bins and preview stamps', () => {
    expect(facadeBin(0)).toBe('N');
    expect(facadeBin(180_000)).toBe('S');
    expect(facadeBin(350_000)).toBe('N');
    expect(isPreview(stamp)).toBe(true);
  });
});
