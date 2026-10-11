import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { BuildingDoc, CityTile, PointMm, PolygonMm } from '@ibasho/core';
import { BuildingDocSchema, PlaceSchema, toWireJson } from '@ibasho/core/schemas';
import { describe, expect, it } from 'vitest';
import {
  adjacencySymmetric,
  atan2,
  autoZone,
  compile,
  fromPlaceFrame,
  intersect,
  m2,
  pointInRing,
  polygonAreaMm2,
  projectionFactor,
  rectPolygon,
  rectRing,
  ringAreaMm2,
  splitPolygon,
  toPlaceFrame,
  union,
  weldRooms,
  windowGeom,
} from '../src/index.ts';

const root = join(import.meta.dirname, '..', '..', '..');
const dir = join(root, 'packages/fixtures/src/buildings');
const ids = ['gb1', 'gb2', 'gb3', 'gb4', 'gh1', 'gb5', 'gb6', 'gb7'];
const load = (id: string): BuildingDoc =>
  BuildingDocSchema.parse(JSON.parse(readFileSync(join(dir, `${id}.building.json`), 'utf8')));

describe('geometry helpers', () => {
  it('atan2 matches the platform to 1e-12', () => {
    for (const [y, x] of [
      [1, 1],
      [-3, 2],
      [5, -7],
      [-1, -1e-9],
      [0, -2],
      [1e6, 3],
    ] as const) {
      expect(Math.abs(atan2(y, x) - Math.atan2(y, x))).toBeLessThan(1e-12);
    }
  });

  it('exact areas, splits and unions', () => {
    const r = rectPolygon(0, 0, 4000, 3000);
    expect(polygonAreaMm2(r)).toBe(12_000_000n);
    const { left, right } = splitPolygon(r, [1000, -5], [1000, 5]);
    const sum = [...left, ...right].reduce((s, p) => s + polygonAreaMm2(p), 0n);
    expect(sum).toBe(12_000_000n);
    expect(union([r, rectPolygon(4000, 0, 6000, 3000)]).map(polygonAreaMm2)).toEqual([18_000_000n]);
    expect(pointInRing([4000, 1500], r.outer)).toBe(true);
  });

  it('auto-zoning covers the footprint exactly', () => {
    const fp = rectRing(0, 0, 40_000, 20_000);
    const zones = autoZone(fp);
    expect(zones).toHaveLength(5);
    expect(zones.reduce((s, z) => s + polygonAreaMm2(z.polygon), 0n)).toBe(ringAreaMm2(fp));
  });

  it('AC-ED1: projection factor 0.345 for a 345 mm overhang on a 1 m window', () => {
    const win = windowGeom({ kind: 'single', width: 1000, height: 1000, sill: 900, offset: 0 }, 3000, 3000);
    expect(projectionFactor([{ kind: 'overhang', depth: 345, aboveHead: 0, extension: 0 }], win)).toEqual({
      n: 345n,
      d: 1000n,
    });
  });

  it('place frame round trip', () => {
    const doc = { origin: { x: 1000, y: -2000 }, rotationMdeg: 40_000 };
    const p: PointMm = [12_345, -6_789];
    const q = fromPlaceFrame(doc, toPlaceFrame(doc, p));
    expect(Math.abs(q[0] - p[0])).toBeLessThanOrEqual(1);
    expect(Math.abs(q[1] - p[1])).toBeLessThanOrEqual(1);
  });

  it('welding two rooms gives a symmetric shared wall split at the T junction', () => {
    const rooms = weldRooms(
      [
        { id: 'rm_a', outer: rectRing(0, 0, 4000, 6000) },
        { id: 'rm_b', outer: rectRing(4000, 0, 8000, 3000) },
      ],
      { ceiling: 2700, floorBoundary: 'ground', ceilingBoundary: 'roof', exterior: { kind: 'outdoors' } },
    );
    expect(adjacencySymmetric(rooms)).toBe(true);
    expect(rooms[0]?.segments.filter((s) => s.boundary.kind === 'adjacent')).toHaveLength(1);
    expect(rooms[0]?.segments).toHaveLength(5);
  });
});

describe('golden buildings (SPEC 16)', () => {
  it('every fixture and the places validate and round-trip', () => {
    for (const id of ids) {
      const doc = load(id);
      expect(BuildingDocSchema.parse(JSON.parse(toWireJson(doc)))).toEqual(doc);
    }
    const places = JSON.parse(readFileSync(join(dir, 'places.json'), 'utf8')) as unknown[];
    for (const p of places) PlaceSchema.parse(p);
  });

  it('B14 adjacency is symmetric on every storey of every fixture', () => {
    for (const id of ids) for (const s of load(id).storeys) expect(adjacencySymmetric(s.rooms)).toBe(true);
  });

  it('compiles with zero overlap, plausible areas and deterministic output', () => {
    const gfaM2: Record<string, number> = {};
    for (const id of ids) {
      const doc = load(id);
      const c = compile(doc);
      for (const s of c.quantities.storeys) expect(s.overlapMm2).toBe(0n);
      expect(c.checks.filter((k) => k.severity === 'error')).toEqual([]);
      expect(toWireJson(compile(doc))).toBe(toWireJson(c));
      gfaM2[id] = m2(c.quantities.gfaMm2);
      expect(c.meshes.surfaces.length).toBeGreaterThan(0);
    }
    // GB1: the OSM footprint (about 9,200 m² net of courts) on three floors plus the partial cellar.
    expect(gfaM2['gb1']).toBeGreaterThan(26_000);
    expect(gfaM2['gb1']).toBeLessThan(30_000);
    // GB3: 15 storeys of 2,183 m² plus three basements.
    expect(gfaM2['gb3']).toBeCloseTo(2183 * 18, -1);
    expect(gfaM2['gh1']).toBeCloseTo(84, 0);
  });

  it('GB1 facades face the diagonal bins (no cardinal facade, RB 2)', () => {
    const bins = compile(load('gb1'), { meshes: false }).quantities.facades.map((f) => f.bin);
    expect(bins.sort()).toEqual(['NE', 'NW', 'SE', 'SW']);
  });

  it('GB1 fits its OSM outline (IoU at least 0.8) and golden buildings clear their neighbours', () => {
    const tilesDir = join(root, 'packs/city-hyderabad/src/engine/tiles');
    const tiles = readdirSync(tilesDir).map(
      (f) => JSON.parse(gunzipSync(readFileSync(join(tilesDir, f))).toString()) as CityTile,
    );
    const all = tiles.flatMap((t) => t.buildings);
    const footprint = (doc: BuildingDoc, storeyId: string): PolygonMm[] =>
      union(
        (doc.storeys.find((s) => s.id === storeyId)?.rooms ?? []).map((r) => ({
          outer: r.floor.outer.map((p) => toPlaceFrame(doc, p)),
          holes: [],
        })),
      );
    const area = (ps: PolygonMm[]) => ps.reduce((s, p) => s + polygonAreaMm2(p), 0n);
    const vindhya = all.find((b) => b.id === 'osm_r2829427');
    const osm: PolygonMm[] = vindhya ? [{ outer: vindhya.footprint, holes: vindhya.holes ?? [] }] : [];
    const fp = footprint(load('gb1'), 'st_1');
    const inter = area(intersect(fp, osm));
    const uni = area(union(fp, osm));
    expect(Number((inter * 1000n) / uni) / 1000).toBeGreaterThanOrEqual(0.8);
    const heroes: Record<string, string[]> = {
      gb1: ['osm_r2829427'],
      gb2: ['osm_w187896823', 'osm_w211078709'],
      gb4: [],
    };
    for (const [id, hero] of Object.entries(heroes)) {
      const doc = load(id);
      const plan = union(doc.storeys.filter((s) => !s.belowGrade).flatMap((s) => footprint(doc, s.id)));
      for (const b of all) {
        if (hero.includes(b.id)) continue;
        const overlap = area(intersect(plan, [{ outer: b.footprint, holes: b.holes ?? [] }]));
        expect(overlap, `${id} overlaps ${b.id} ${b.name ?? ''}`).toBeLessThan(2_000_000n);
      }
    }
  });

  it('GB1 labelled end wing rooms match their plan labels within 10% (QA R2-m6)', () => {
    const doc = load('gb1');
    const m2 = (id: string) => {
      const r = doc.storeys.flatMap((s) => s.rooms).find((x) => x.id === id);
      return r ? Number(polygonAreaMm2({ outer: r.floor.outer, holes: [] })) / 1e6 : 0;
    };
    // RB 3.2 sq ft labels: C1 2,047 (EERC), C7 2,145 (SBI), Seminar Hall I 2,088.
    for (const [id, sqft] of [
      ['rm_1_c1a', 2047],
      ['rm_1_c7', 2145],
      ['rm_3_c7', 2088],
    ] as const) {
      const label = sqft * 0.092903;
      expect(Math.abs(m2(id) - label) / label, id).toBeLessThan(0.1);
    }
  });

  it('on-demand GCC hosts (GB5, GB6) sit on their OSM outlines in the Raidurg area', () => {
    const dir = join(root, 'packs/city-hyderabad/src/engine/raidurg/tiles');
    const all = readdirSync(dir)
      .map((f) => JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString()) as CityTile)
      .flatMap((t) => t.buildings);
    const area = (ps: PolygonMm[]) => ps.reduce((sum, p) => sum + polygonAreaMm2(p), 0n);
    for (const [id, hero] of [
      ['gb5', 'osm_w1133460476'],
      ['gb6', 'osm_w1133269186'],
      ['gb7', 'osm_w852979202'],
    ] as const) {
      const doc = load(id);
      const st = doc.storeys.find((s) => s.id === 'st_typ');
      const fp = union(
        (st?.rooms ?? []).map((r) => ({ outer: r.floor.outer.map((p) => toPlaceFrame(doc, p)), holes: [] })),
      );
      const b = all.find((x) => x.id === hero);
      const osm: PolygonMm[] = b ? [{ outer: b.footprint, holes: b.holes ?? [] }] : [];
      const iou = Number((area(intersect(fp, osm)) * 1000n) / area(union(fp, osm))) / 1000;
      expect(iou, id).toBeGreaterThanOrEqual(0.8);
      for (const o of all) {
        if (o.id === hero) continue;
        expect(
          area(intersect(fp, [{ outer: o.footprint, holes: o.holes ?? [] }])),
          `${id} vs ${o.id}`,
        ).toBeLessThan(5_000_000n);
      }
    }
    const places = JSON.parse(
      readFileSync(join(dir, '../../../../../../packages/fixtures/src/buildings/places.json'), 'utf8'),
    ) as {
      id: string;
      onDemand?: true;
    }[];
    expect(places.find((p) => p.id === 'pl_knowledge_city')?.onDemand).toBe(true);
    expect(places.filter((p) => p.onDemand).map((p) => p.id)).toEqual([
      'pl_knowledge_city',
      'pl_kings_cross',
    ]);
  });
});
