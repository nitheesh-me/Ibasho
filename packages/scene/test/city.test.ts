/** City stage pure parts (WP-07, V-P): frames, stand ins, hero surfaces, shadows, ramps, views. */
import { describe, expect, it } from 'vitest';
import { enToLatLon, latLonToEN, planToEN, pointInRing, ringArea } from '../src/city/frame.ts';
import { heroFromDoc, windowRects } from '../src/city/hero.ts';
import { cityModel, lanternStrength } from '../src/city/model.ts';
import { phototropicGeometry } from '../src/city/phototropic.ts';
import { annualKwh, previewDaylight, previewSite, sdaShare } from '../src/city/preview.ts';
import { CITY_RAMPS, type CityRampId, rampLab } from '../src/city/ramps.ts';
import {
  type Grid,
  penumbraPolygons,
  rasterise,
  shadowOffset,
  shadowPolygons,
  sunHoursGrid,
  sunHoursUpTo,
} from '../src/city/shadow.ts';
import { standInCity } from '../src/city/standin.ts';
import { dayWindow, sunOf } from '../src/city/sun.ts';
import { ZOOM_LEVELS } from '../src/city/types.ts';
import { blendView, levelView, resolveFocus } from '../src/city/view.ts';
import { IIIT_ORIGIN, VINDHYA_EN, vindhyaStandIn } from '../src/city/vindhya.ts';

const doc = vindhyaStandIn();
const hero = heroFromDoc(doc);

describe('frames', () => {
  it('round trips lat and lon through the pack frame to the centimetre', () => {
    const en = latLonToEN(IIIT_ORIGIN, 17.4458, 78.3498);
    const back = enToLatLon(IIIT_ORIGIN, en);
    expect(Math.abs(back.lat - 17.4458)).toBeLessThan(1e-9);
    expect(Math.abs(back.lon - 78.3498)).toBeLessThan(1e-9);
    // 0.0008 deg of longitude at 17.45 N is about 85 m east.
    expect(en[0]).toBeGreaterThan(80);
    expect(en[0]).toBeLessThan(90);
  });

  it('places plan +x on bearing 310 for the Vindhya rotation', () => {
    const a = planToEN(doc, [0, 0]);
    const b = planToEN(doc, [1000, 0]);
    const bearing = ((Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI + 360) % 360;
    expect(bearing).toBeCloseTo(310, 6);
  });
});

describe('stand in city', () => {
  const city = standInCity();
  const all = city.tiles.flatMap((t) => t.buildings);
  it('is shaped like ibasho.city/1 with honest height ranges', () => {
    expect(city.tiles.every((t) => t.schema === 'ibasho.city/1')).toBe(true);
    expect(all.length).toBeGreaterThan(150);
    for (const b of all) {
      expect(b.height.lo).toBeLessThanOrEqual(b.height.likely);
      expect(b.height.likely).toBeLessThanOrEqual(b.height.hi);
      expect(Number.isInteger(b.footprint[0]![0])).toBe(true);
      expect(b.sources).toContain('standin');
    }
    expect(all.some((b) => b.height.source === 'unknown' && b.height.hi - b.height.lo > 10_000)).toBe(true);
  });

  it('keeps every neighbour off the hero footprint', () => {
    for (const r of hero.rooms) {
      for (const b of all) {
        const ring = b.footprint.map(([x, y]) => [x / 1000, y / 1000] as const);
        for (const p of r.ring) expect(pointInRing(p[0], p[1], ring)).toBe(false);
      }
    }
  });

  it('groups buildings into 250 m tiles by centre', () => {
    for (const t of city.tiles)
      for (const b of t.buildings) {
        const cx = b.footprint.reduce((a, p) => a + p[0], 0) / b.footprint.length / 1000;
        expect(Math.floor(cx / 250)).toBe(t.tx);
      }
  });
});

describe('hero from the Vindhya stand in', () => {
  it('has a cellar and three storeys at 3.9 m, about 143 by 63 m', () => {
    expect(hero.storeys.map((s) => s.belowGrade)).toEqual([true, false, false, false]);
    expect(hero.height).toBeCloseTo(11.7, 6);
    const area = hero.rooms.filter((r) => r.storeyId === 'st_l1').reduce((a, r) => a + ringArea(r.ring), 0);
    // Rows, links, spine and pavilions, courts excluded.
    expect(area).toBeGreaterThan(4500);
    expect(area).toBeLessThan(7000);
  });

  it('draws only outdoor walls, with outward normals and unique ids', () => {
    const ids = new Set<string>();
    for (const s of hero.surfaces) {
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
      if (s.kind !== 'wall') continue;
      // The centre plus the normal is outside every room of that storey.
      const probe = [s.centre[0] + s.normal[0] * 0.4, -(s.centre[2] + s.normal[2] * 0.4)] as const;
      const inside = hero.rooms
        .filter((r) => r.storeyId === s.storeyId)
        .some((r) => pointInRing(probe[0], probe[1], r.ring));
      expect(inside).toBe(false);
    }
    // Courtyard facades exist: walls facing each of the four campus bearings.
    const bins = new Set(
      hero.surfaces.filter((s) => s.kind === 'wall').map((s) => Math.round(s.bearingDeg / 90) % 4),
    );
    expect(bins.size).toBe(4);
  });

  it('lays glass inside each wall, never wider than the wall', () => {
    expect(
      windowRects({ kind: 'ratio', wwrPm: 300, sill: 900, head: 2400 }, 9, 3.9).reduce(
        (a, [u0, u1, v0, v1]) => a + (u1 - u0) * (v1 - v0),
        0,
      ),
    ).toBeCloseTo(0.3 * 9 * 3.9, 6);
    for (const [u0, u1] of windowRects({ kind: 'ratio', wwrPm: 950, sill: 0, head: 3000 }, 4, 3)) {
      expect(u0).toBeGreaterThanOrEqual(0);
      expect(u1).toBeLessThanOrEqual(4);
    }
  });
});

describe('shadows', () => {
  const noon = { azimuthDeg: 180, altitudeDeg: 45, up: true };
  it('casts h / tan(altitude) away from the sun', () => {
    const [e, n] = shadowOffset(10, noon);
    expect(e).toBeCloseTo(0, 9);
    expect(n).toBeCloseTo(10, 9);
  });

  it('covers footprint plus displaced copy for a box', () => {
    const ring: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    const [hull] = shadowPolygons(ring, 10, noon);
    expect(Math.abs(ringArea(hull!))).toBeCloseTo(200, 6);
    // Non convex (an L): footprint plus edge quads.
    const l: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 4],
      [4, 4],
      [4, 10],
      [0, 10],
    ];
    expect(shadowPolygons(l, 5, noon).length).toBe(7);
  });

  it('rasterises cell centres inside a polygon', () => {
    const g: Grid = { minE: 0, minN: 0, cell: 1, cols: 10, rows: 10 };
    const out = new Uint8Array(100);
    rasterise(
      [
        [2, 2],
        [6, 2],
        [6, 5],
        [2, 5],
      ],
      g,
      out,
    );
    expect(out.reduce((a, v) => a + v, 0)).toBe(12);
  });

  it('sun hours: an open cell sees the whole day, a cell north of a tower loses it in winter', () => {
    const g: Grid = { minE: -20, minN: -20, cell: 4, cols: 10, rows: 10 };
    const tower = {
      id: 't',
      ring: [
        [-5, -15],
        [5, -15],
        [5, -5],
        [-5, -5],
      ] as [number, number][],
      z1: 60,
    };
    const s = sunHoursGrid({
      grid: g,
      casters: [tower],
      date: '2026-12-21',
      lat: 17.4453,
      lon: 78.349,
      stepMin: 15,
    });
    const all = sunHoursUpTo(s, 1440);
    const w = dayWindow('2026-12-21', 17.4453, 78.349);
    const day = (w.set - w.rise) / 60;
    const corner = all[0 * 10 + 9]!; // south east corner: the winter sun stays south, so no shadow reaches it
    const north = all[6 * 10 + 5]!; // just north of the tower
    expect(corner).toBeGreaterThan(day - 1.5);
    expect(north).toBeLessThan(corner - 2);
    // Monotone build up through the day.
    expect(sunHoursUpTo(s, 720)[0 * 10 + 9]!).toBeLessThanOrEqual(corner);
  });

  it('draws the penumbra only for uncertain heights and only by day', () => {
    const ring: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(penumbraPolygons([{ ring, likely: 10, hi: 10 }], { ...noon })).toHaveLength(0);
    expect(penumbraPolygons([{ ring, likely: 10, hi: 20 }], { ...noon })).toHaveLength(1);
    expect(
      penumbraPolygons([{ ring, likely: 10, hi: 20 }], { ...noon, up: false, altitudeDeg: -3 }),
    ).toHaveLength(0);
  });

  it('puts the May noon sun in the north at Hyderabad', () => {
    const may = sunOf({ date: '2026-05-21', minutes: 12 * 60 + 25 }, 17.4453, 78.349);
    const dec = sunOf({ date: '2026-12-21', minutes: 12 * 60 + 25 }, 17.4453, 78.349);
    expect(may.altitudeDeg).toBeGreaterThan(85);
    expect(Math.abs(may.azimuthDeg - 180)).toBeGreaterThan(90);
    expect(dec.altitudeDeg).toBeGreaterThan(45);
    expect(dec.altitudeDeg).toBeLessThan(52);
  });
});

describe('ramps', () => {
  it('every v3 ramp is lightness monotone (greyscale safe)', () => {
    for (const id of Object.keys(CITY_RAMPS) as CityRampId[]) {
      let prev = -1;
      for (let i = 0; i <= 50; i++) {
        const L = rampLab(id, i / 50)[0];
        expect(L).toBeGreaterThan(prev);
        prev = L;
      }
    }
  });
});

describe('views and the model', () => {
  const model = cityModel({});
  it('uses stand ins only for undefined props', () => {
    expect(model.standIn).toEqual({ context: true, hero: true });
    const empty = cityModel({ tiles: [], hero: null });
    expect(empty.hero).toBeNull();
    expect(empty.masses).toHaveLength(0);
    expect(empty.standIn).toEqual({ context: false, hero: false });
  });

  it('zooms in monotonically down the ladder', () => {
    const halves = ZOOM_LEVELS.map(
      (level) =>
        levelView({ level, hero: model.hero, cityBox: model.cityBox, azimuthDeg: 225, aspect: 1.6 }).halfH,
    );
    for (let i = 1; i < halves.length; i++) expect(halves[i]).toBeLessThan(halves[i - 1]!);
    const site = levelView({
      level: 'site',
      hero: model.hero,
      cityBox: model.cityBox,
      azimuthDeg: 225,
      aspect: 1.6,
    });
    expect(site.target[0]).toBeCloseTo(VINDHYA_EN[0], 0);
    expect(site.target[2]).toBeCloseTo(VINDHYA_EN[1], 0);
  });

  it('blends views the short way round', () => {
    const a = levelView({
      level: 'site',
      hero: model.hero,
      cityBox: model.cityBox,
      azimuthDeg: 350,
      aspect: 1,
    });
    const b = { ...a, azimuthDeg: 10 };
    expect(blendView(a, b, 0.5).azimuthDeg).toBeCloseTo(360, 6);
  });

  it('lantern strength follows EUI and the hourly load', () => {
    const d = {
      buildingId: 'x',
      euiKwhM2: 150,
      dominant: 'cooling' as const,
      hourly: [0.1, ...new Array(23).fill(1)],
    };
    expect(lanternStrength(d, 12)).toBeGreaterThan(lanternStrength(d, 0));
    expect(lanternStrength({ ...d, euiKwhM2: 300 }, 12)).toBeGreaterThan(lanternStrength(d, 12));
  });
});

describe('find (focus)', () => {
  const model = cityModel({});
  const base = { hero: model.hero, masses: model.masses, azimuthDeg: 135, aspect: 1.6 };
  it('maps hero storeys and rooms to the floor and room levels', () => {
    const room = model.hero!.rooms.find((r) => r.storeyId === 'st_l2')!;
    expect(resolveFocus({ ...base, focus: { kind: 'building', buildingId: model.hero!.id } })).toEqual({
      kind: 'hero',
      level: 'building',
    });
    expect(
      resolveFocus({ ...base, focus: { kind: 'storey', buildingId: model.hero!.id, storeyId: 'st_l3' } }),
    ).toEqual({ kind: 'hero', level: 'floor', storeyId: 'st_l3' });
    expect(
      resolveFocus({ ...base, focus: { kind: 'room', buildingId: model.hero!.id, roomId: room.id } }),
    ).toEqual({ kind: 'hero', level: 'room', roomId: room.id, storeyId: 'st_l2' });
  });
  it('frames a neighbour, a bare bounding box, or nothing', () => {
    const m = model.masses[0]!;
    const f = resolveFocus({ ...base, focus: { kind: 'building', buildingId: m.id } });
    expect(f?.kind === 'frame' && f.contextId).toBe(m.id);
    const b = resolveFocus({
      ...base,
      focus: { kind: 'building', buildingId: 'x', bboxMm: { minX: 0, minY: 0, maxX: 20_000, maxY: 10_000 } },
    });
    expect(b?.kind === 'frame' && b.view.target[0]).toBe(10);
    expect(resolveFocus({ ...base, focus: { kind: 'building', buildingId: 'nope' } })).toBeNull();
  });
});

describe('preview analysis (stand in until WP-13 and WP-16)', () => {
  const model = cityModel({});
  const site = previewSite(model.hero!, model.casters, model.place);
  it('is stamped preview and keyed by hero surface ids', () => {
    expect(site.stamp.impl).toBe('preview');
    const ids = new Set(hero.surfaces.map((s) => s.id));
    for (const s of site.surfaces) expect(ids.has(s.id)).toBe(true);
  });

  it('roofs collect more than walls, in a plausible Hyderabad range', () => {
    const roof = site.surfaces.filter((s) => s.id.endsWith(':roof')).map((s) => annualKwh(s)!);
    const walls = site.surfaces.filter((s) => !s.id.endsWith(':roof')).map((s) => annualKwh(s)!);
    const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
    expect(mean(roof)).toBeGreaterThan(1400);
    expect(mean(roof)).toBeLessThan(2300);
    expect(mean(walls)).toBeLessThan(mean(roof) * 0.75);
  });

  it('daylight grids fall off from the glass and mark ASE near low sun facades', () => {
    const grids = previewDaylight(doc);
    expect(grids.map((g) => g.storeyId)).toEqual(['st_l1', 'st_l2', 'st_l3']);
    const share = sdaShare(grids[0]!);
    expect(share).toBeGreaterThan(30);
    expect(share).toBeLessThan(95);
    expect(grids[0]!.ase!.some((v) => (v ?? 0) > 250)).toBe(true);
  });

  it('the phototropic variant is empty at t = 0 and grows a canopy and fins at t = 1', () => {
    const none = phototropicGeometry(doc, hero, { t: 0 });
    expect(none.canopy).toHaveLength(0);
    const full = phototropicGeometry(doc, hero, { t: 1 });
    expect(full.canopyM2).toBeGreaterThan(600);
    expect(full.finCount).toBeGreaterThan(100);
  });
});
