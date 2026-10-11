/** City stage on real data (QA round): the city-hyderabad pack, GB1 compiled by @ibasho/plan. */
import type { BuildingDoc, CityTile } from '@ibasho/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { HERO_CONTEXT_IDS, loadCityTiles } from '../../../packs/city-hyderabad/src/engine/index.ts';
import gb1 from '../../fixtures/src/buildings/gb1.building.json' with { type: 'json' };
import rad from '../../fixtures/src/preview/gb1/radiation.json' with { type: 'json' };
import { compile } from '../../plan/src/index.ts';
import { chromeInsets, layoutOf, radiationDomain } from '../src/city/CityStage.tsx';
import { pointInRing } from '../src/city/frame.ts';
import { heroFromCompiled, heroFromDoc } from '../src/city/hero.ts';
import { cityModel, defaultLanterns } from '../src/city/model.ts';
import {
  annualKwh,
  passMask,
  previewDaylight,
  previewSite,
  sdaShare,
  surfaceKey,
} from '../src/city/preview.ts';
import { plinthRing } from '../src/city/sceneParts.ts';
import { focusFromHit, resolveFocus } from '../src/city/view.ts';

const doc = gb1 as unknown as BuildingDoc;
// The scene has no Node types: load fs by a computed specifier (vitest runs in Node).
const fsReader = async (url: string): Promise<Uint8Array> => {
  const fs = (await import(`node:${'fs/promises'}`)) as { readFile(p: URL): Promise<Uint8Array> };
  return new Uint8Array(await fs.readFile(new URL(url)));
};
let tiles: CityTile[] = [];
beforeAll(async () => {
  tiles = await loadCityTiles(fsReader);
});

describe('GB1 on the city-hyderabad pack', () => {
  it('draws the compiled hero and hides the OSM building it stands for', () => {
    const model = cityModel({
      tiles,
      hero: doc,
      compiled: compile(doc),
      hideContextIds: HERO_CONTEXT_IDS.gb1 ?? [],
    });
    expect(model.standIn).toEqual({ context: false, hero: false });
    expect(model.masses.length).toBeGreaterThan(900);
    expect(model.masses.some((m) => (HERO_CONTEXT_IDS.gb1 ?? []).includes(m.id))).toBe(false);
    expect(model.hero!.surfaces.filter((s) => s.kind === 'wall').length).toBeGreaterThan(100);
    // No remaining neighbour footprint covers the middle of a hero room.
    for (const r of model.hero!.rooms.filter((x) => x.storeyId === 'st_1')) {
      const c = r.ring.reduce((a, p) => [a[0] + p[0] / r.ring.length, a[1] + p[1] / r.ring.length], [0, 0]);
      for (const m of model.masses) expect(pointInRing(c[0]!, c[1]!, m.ring)).toBe(false);
    }
    // Preview lanterns: the hero plus named neighbours, more than one hue.
    const l = defaultLanterns(model);
    expect(l.length).toBeGreaterThan(2);
    expect(new Set(l.map((x) => x.dominant)).size).toBeGreaterThan(1);
  });

  it('keys the preview site result by compiled surface ids, with a view domain inside the data', () => {
    const model = cityModel({
      tiles,
      hero: doc,
      compiled: compile(doc),
      hideContextIds: HERO_CONTEXT_IDS.gb1 ?? [],
    });
    const site = previewSite(model.hero!, model.casters, model.place);
    const ids = new Set(model.hero!.surfaces.map((s) => s.id));
    for (const s of site.surfaces) expect(ids.has(s.id)).toBe(true);
    const [lo, hi] = radiationDomain(site);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi - lo).toBeGreaterThanOrEqual(100);
  });

  it('the daylight share is the painted pass mask, cell for cell', () => {
    for (const g of previewDaylight(doc)) {
      const mask = passMask(g);
      const valid = g.sda.filter((v) => v !== null).length;
      const painted = mask.reduce((a, v) => a + v, 0);
      expect(sdaShare(g)).toBeCloseTo((100 * painted) / valid, 9);
    }
  });

  it('never lets an unknown height cast a shadow', () => {
    const model = cityModel({ tiles, hero: doc, compiled: compile(doc) });
    const unknown = new Set(model.masses.filter((m) => m.source === 'unknown').map((m) => m.id));
    expect(unknown.size).toBeGreaterThan(100);
    expect(model.casters.some((c) => unknown.has(c.id))).toBe(false);
  });

  it('frames a place or a building part by its box', () => {
    const model = cityModel({ tiles, hero: doc, compiled: compile(doc) });
    const bbox = { minX: 0, minY: 0, maxX: 40_000, maxY: 20_000 };
    for (const hit of [
      { kind: 'place' as const, id: 'pl_iiit', buildingId: 'gb1', bbox },
      { kind: 'building' as const, id: 'gb2#shodh', buildingId: 'gb2', bbox },
    ]) {
      const r = resolveFocus({
        focus: focusFromHit(hit),
        hero: model.hero,
        masses: model.masses,
        azimuthDeg: 135,
        aspect: 1.5,
      });
      expect(r?.kind).toBe('frame');
      expect(r?.kind === 'frame' && r.view.target[0]).toBe(20);
    }
  });

  it('turns a place search hit into a focus the stage resolves', () => {
    const model = cityModel({ tiles, hero: doc, compiled: compile(doc) });
    const f = focusFromHit({
      kind: 'storey',
      id: 'st_2',
      buildingId: doc.id,
      bbox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    });
    expect(
      resolveFocus({ focus: f, hero: model.hero, masses: model.masses, azimuthDeg: 135, aspect: 1.5 }),
    ).toEqual({
      kind: 'hero',
      level: 'floor',
      storeyId: 'st_2',
    });
  });
});

describe('round 8 checks', () => {
  it('no neighbour footprint overlaps GB1 or its site board (the close view only looks past them)', () => {
    const m = cityModel({ tiles, hero: doc, hideContextIds: HERO_CONTEXT_IDS.gb1 ?? [] });
    const hero = m.hero!;
    const rings = hero.rooms.map((r) => r.ring);
    const board = plinthRing(m.heroDoc, hero);
    for (const c of m.masses) {
      for (const p of c.ring) {
        expect(pointInRing(p[0], p[1], board)).toBe(false);
        for (const r of rings) expect(pointInRing(p[0], p[1], r)).toBe(false);
      }
    }
  });

  it('the compiled hero is rotated once: same footprint as the document path', () => {
    const a = heroFromDoc(doc);
    const b = heroFromCompiled(doc, compile(doc).meshes);
    const box = (h: typeof a) => {
      const w = h.surfaces.filter((s) => s.kind === 'wall');
      const xs = w.flatMap((s) => s.tris.filter((_, i) => i % 3 === 0));
      const zs = w.flatMap((s) => s.tris.filter((_, i) => i % 3 === 2));
      return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    };
    const [ax0, ax1, az0, az1] = box(a);
    const [bx0, bx1, bz0, bz1] = box(b);
    for (const [u, v] of [
      [ax0, bx0],
      [ax1, bx1],
      [az0, bz0],
      [az1, bz1],
    ] as const)
      expect(Math.abs(u! - v!)).toBeLessThan(0.6);
  });

  it('radiation paints the compiled facades, not only the roof', () => {
    const hero = heroFromCompiled(doc, compile(doc).meshes);
    const surfaces = (rad as unknown as { surfaces: { id: string; irrWhm2: string[] }[] }).surfaces;
    const by = new Map(surfaces.flatMap((s) => [[s.id, s] as const, [surfaceKey(s.id), s] as const]));
    const walls = hero.surfaces.filter((s) => s.kind === 'wall');
    const painted = walls.filter((s) => {
      const d = by.get(s.id) ?? by.get(surfaceKey(s.id));
      return d && annualKwh(d as never) !== null;
    });
    expect(painted.length / walls.length).toBeGreaterThan(0.8);
  });
});

describe('layouts (DS 13.7)', () => {
  it('picks phone, tablet and desktop at the breakpoints and always leaves a free stage', () => {
    expect([360, 767, 768, 1279, 1280, 1600].map(layoutOf)).toEqual([
      'phone',
      'phone',
      'tablet',
      'tablet',
      'desktop',
      'desktop',
    ]);
    for (const [w, h] of [
      [360, 740],
      [768, 1024],
      [1280, 800],
      [1600, 900],
    ] as const) {
      const s = chromeInsets(layoutOf(w), h, true);
      expect(w - s.left - s.right).toBeGreaterThan(w * 0.3);
      expect(h - s.top - s.bottom).toBeGreaterThan(h * 0.3);
    }
  });
});
