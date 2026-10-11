/**
 * PLACEHOLDER city context: a procedural stand in for `packs/city-hyderabad` (WP-17), shaped
 * exactly like `ibasho.city/1` tiles (ARCH 15.7), so the stage reads the real pack unchanged.
 * Owner: WP-07.
 *
 * Named campus buildings use the centres, areas and levels in RB 5 (OSM ids there); footprints are
 * oriented rectangles on the 40/130 campus grid. Filler blocks outside the campus are seeded and
 * carry wide estimated ranges, so the penumbra has something honest to draw. Nothing here is a
 * measurement: every record lists `standin` in its sources.
 */
import type { CityTile, ContextBuilding, ContextTree, HeightSource, Mm } from '@ibasho/core';
import { type EN, latLonToEN, orientedRect, pointInRing, toMm } from './frame.ts';
import { IIIT_ORIGIN, VINDHYA_EN } from './vindhya.ts';

export const STAND_IN_PACK_ID = 'city-hyderabad.standin';
export const TILE_M = 250;

interface Named {
  id: string;
  name: string;
  lat: number;
  lon: number;
  length: number;
  width: number;
  bearing?: number;
  levels?: number;
  /** Metres: lo, likely, hi. */
  h: [number, number, number];
  source: HeightSource;
}

/** RB 5 table, plus the Himalaya blocks of RB 4 placed along the 130 degree axis from Block D. */
const NAMED: Named[] = [
  {
    id: 'osm_w1173384711',
    name: 'Academic office',
    lat: 17.445,
    lon: 78.3499,
    length: 26,
    width: 24,
    levels: 5,
    h: [17.5, 19.5, 20],
    source: 'osm-levels',
  },
  {
    id: 'osm_w187896590',
    name: 'Residence block (6 storeys)',
    lat: 17.444,
    lon: 78.3485,
    length: 40,
    width: 25,
    levels: 6,
    h: [19.5, 21, 24],
    source: 'osm-levels',
  },
  {
    id: 'osm_w227239535',
    name: 'Residence block (6 storeys)',
    lat: 17.4433,
    lon: 78.3485,
    length: 40,
    width: 25,
    levels: 6,
    h: [19.5, 21, 24],
    source: 'osm-levels',
  },
  {
    id: 'osm_w1378100098',
    name: 'Residence block C',
    lat: 17.4443,
    lon: 78.3478,
    length: 42,
    width: 26,
    levels: 6,
    h: [19.5, 21, 24],
    source: 'osm-levels',
  },
  {
    id: 'osm_w1378100099',
    name: 'Residence block D',
    lat: 17.4438,
    lon: 78.3478,
    length: 42,
    width: 26,
    levels: 6,
    h: [19.5, 21, 24],
    source: 'osm-levels',
  },
  {
    id: 'osm_w1378100100',
    name: 'Residence block E',
    lat: 17.4433,
    lon: 78.3478,
    length: 42,
    width: 26,
    levels: 6,
    h: [19.5, 21, 24],
    source: 'osm-levels',
  },
  {
    id: 'osm_w412935829',
    name: 'Hostel (4 storeys)',
    lat: 17.4472,
    lon: 78.3476,
    length: 80,
    width: 40,
    levels: 4,
    h: [13, 14, 16],
    source: 'osm-levels',
  },
  {
    id: 'osm_w639403214',
    name: 'Hostel wing',
    lat: 17.447,
    lon: 78.3469,
    length: 26,
    width: 16,
    levels: 4,
    h: [13, 14, 16],
    source: 'osm-levels',
  },
  {
    id: 'osm_w639403215',
    name: 'Hostel wing',
    lat: 17.4473,
    lon: 78.3472,
    length: 26,
    width: 16,
    levels: 4,
    h: [13, 14, 16],
    source: 'osm-levels',
  },
  {
    id: 'osm_w639403216',
    name: 'Hostel wing',
    lat: 17.4476,
    lon: 78.3474,
    length: 26,
    width: 16,
    levels: 4,
    h: [13, 14, 16],
    source: 'osm-levels',
  },
  {
    id: 'osm_w639403217',
    name: 'Hostel (5 storeys)',
    lat: 17.4482,
    lon: 78.3485,
    length: 56,
    width: 30,
    levels: 5,
    h: [16, 17.5, 20],
    source: 'osm-levels',
  },
  {
    id: 'osm_w96346275',
    name: 'Dining hall',
    lat: 17.4448,
    lon: 78.3457,
    length: 30,
    width: 20,
    h: [4, 6, 9],
    source: 'unknown',
  },
  {
    id: 'osm_w1549736302',
    name: 'Building under construction',
    lat: 17.4462,
    lon: 78.3481,
    length: 66,
    width: 50,
    h: [4, 12, 30],
    source: 'unknown',
  },
  {
    id: 'osm_w211070668',
    name: 'Indoor stadium',
    lat: 17.4481,
    lon: 78.3452,
    length: 90,
    width: 70,
    bearing: 0,
    h: [12, 20, 25],
    source: 'unknown',
  },
  {
    id: 'osm_w116087827_e',
    name: 'Athletic stadium stand',
    lat: 17.4462,
    lon: 78.3449,
    length: 130,
    width: 16,
    bearing: 0,
    h: [10, 15, 18],
    source: 'unknown',
  },
  {
    id: 'osm_w116087827_w',
    name: 'Athletic stadium stand',
    lat: 17.4462,
    lon: 78.3433,
    length: 130,
    width: 16,
    bearing: 0,
    h: [10, 15, 18],
    source: 'unknown',
  },
  {
    id: 'osm_w342258075',
    name: 'Hotel',
    lat: 17.442,
    lon: 78.3444,
    length: 60,
    width: 48,
    bearing: 20,
    h: [12, 24, 40],
    source: 'unknown',
  },
  {
    id: 'osm_w477923815',
    name: 'Office tower',
    lat: 17.4471,
    lon: 78.3541,
    length: 48,
    width: 40,
    bearing: 20,
    h: [30, 55, 80],
    source: 'open-buildings',
  },
  {
    id: 'osm_w356021378',
    name: 'Office block',
    lat: 17.447,
    lon: 78.352,
    length: 80,
    width: 60,
    bearing: 20,
    h: [20, 32, 50],
    source: 'open-buildings',
  },
  {
    id: 'osm_w356021380',
    name: 'Office block',
    lat: 17.4468,
    lon: 78.353,
    length: 70,
    width: 60,
    bearing: 20,
    h: [20, 36, 50],
    source: 'open-buildings',
  },
  {
    id: 'osm_w1428328638',
    name: 'Office block',
    lat: 17.4474,
    lon: 78.354,
    length: 90,
    width: 65,
    bearing: 20,
    h: [20, 40, 55],
    source: 'open-buildings',
  },
  {
    id: 'osm_w413274269_a',
    name: 'IT tower',
    lat: 17.4482,
    lon: 78.3548,
    length: 60,
    width: 40,
    bearing: 20,
    h: [45, 60, 75],
    source: 'open-buildings',
  },
  {
    id: 'osm_w413274269_b',
    name: 'IT tower',
    lat: 17.4477,
    lon: 78.3562,
    length: 60,
    width: 40,
    bearing: 20,
    h: [45, 60, 75],
    source: 'open-buildings',
  },
  {
    id: 'osm_w413274269_c',
    name: 'IT tower',
    lat: 17.4486,
    lon: 78.3566,
    length: 60,
    width: 40,
    bearing: 20,
    h: [45, 66, 80],
    source: 'open-buildings',
  },
];

/** Himalaya (RB 4): Block D, Bodh, Shodh, Vrithi in a row along bearing 130 from Block D. */
function himalaya(): ContextBuilding[] {
  const d = latLonToEN(IIIT_ORIGIN, 17.4457, 78.3488);
  const u: EN = [Math.sin((130 * Math.PI) / 180), Math.cos((130 * Math.PI) / 180)];
  const blocks: [string, string, number, number, number, number][] = [
    // id, name, along, length, width, levels
    ['osm_w211078709', 'Himalaya Block D', 0, 37, 26, 6],
    ['himalaya_bodh', 'Himalaya teaching block', 44, 46, 45, 3],
    ['himalaya_shodh', 'Himalaya research block', 97, 44, 44, 4],
    ['himalaya_vrithi', 'Himalaya admin block', 137, 23, 19, 3],
  ];
  return blocks.map(([id, name, s, l, w, lv]) => {
    const c: EN = [d[0] + u[0] * s, d[1] + u[1] * s];
    const likely = lv * 3.85;
    return {
      id,
      name,
      footprint: toMm(orientedRect(c, l, w, 130)),
      height: { lo: mm(likely - 0.6), likely: mm(likely), hi: mm(likely + 1.5), source: 'osm-levels' },
      levels: lv,
      roof: 'flat',
      sources: ['standin', 'RB 4'],
    };
  });
}

const mm = (m: number): Mm => Math.round(m * 1000);

/** Small deterministic generator (mulberry32) for the filler blocks and trees. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rough campus boundary (m, pack frame): fillers stay outside, trees inside. */
export const CAMPUS: EN[] = [
  [-260, -260],
  [230, -260],
  [260, 120],
  [200, 380],
  [-280, 380],
];

/** Footprint keep-out around the hero (m), so context never intersects the building. */
export const HERO_KEEPOUT: EN[] = orientedRect(VINDHYA_EN, 168, 90, 130);

function overlapsAny(ring: EN[], others: EN[][], gap: number): boolean {
  for (const o of others) {
    for (const p of ring) if (pointInRing(p[0], p[1], o)) return true;
    for (const p of o) if (pointInRing(p[0], p[1], ring)) return true;
    // Centre distance check for near misses.
    const ca = centre(ring);
    const cb = centre(o);
    if (Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) < gap) return true;
  }
  return false;
}

function centre(r: EN[]): EN {
  let e = 0;
  let n = 0;
  for (const p of r) {
    e += p[0];
    n += p[1];
  }
  return [e / r.length, n / r.length];
}

export interface StandInCity {
  packId: string;
  origin: { lat: number; lon: number };
  tiles: CityTile[];
  /** Road centrelines (m) with widths; not part of `ibasho.city/1`, drawn as debossed paper. */
  roads: { points: EN[]; width: number }[];
}

let cached: StandInCity | null = null;

/** The stand in pack, built once. Deterministic. */
export function standInCity(): StandInCity {
  if (cached) return cached;
  const buildings: ContextBuilding[] = [];
  for (const b of NAMED) {
    const c = latLonToEN(IIIT_ORIGIN, b.lat, b.lon);
    buildings.push({
      id: b.id,
      name: b.name,
      footprint: toMm(orientedRect(c, b.length, b.width, b.bearing ?? 130)),
      height: { lo: mm(b.h[0]), likely: mm(b.h[1]), hi: mm(b.h[2]), source: b.source },
      ...(b.levels ? { levels: b.levels } : {}),
      roof: 'flat',
      sources: ['standin', 'RB 5'],
    });
  }
  buildings.push(...himalaya());
  const rings: EN[][] = [
    HERO_KEEPOUT,
    ...buildings.map((b) => b.footprint.map(([x, y]) => [x / 1000, y / 1000] as EN)),
  ];

  // Fillers on a jittered lattice outside the campus: Gachibowli apartments and offices.
  const r = rng(17_4453);
  const step = 52;
  for (let n = -900; n <= 900; n += step) {
    for (let e = -900; e <= 900; e += step) {
      const ce: EN = [e + (r() - 0.5) * 20, n + (r() - 0.5) * 20];
      const keep = r();
      if (pointInRing(ce[0], ce[1], CAMPUS) || keep < 0.38) continue;
      const office = ce[0] > 280 && r() < 0.6;
      const l = office ? 30 + r() * 30 : 14 + r() * 22;
      const w = office ? 22 + r() * 20 : 12 + r() * 14;
      const bearing = r() < 0.5 ? 130 : 20 + (r() - 0.5) * 10;
      const ring = orientedRect(ce, l, w, bearing);
      if (overlapsAny(ring, rings, 6)) continue;
      const kind = r();
      const levels = office ? 4 + Math.floor(r() * 9) : 2 + Math.floor(r() * 5);
      const likely = levels * (office ? 3.9 : 3.3);
      let height: ContextBuilding['height'];
      if (kind < 0.2)
        height = { lo: mm(likely - 0.5), likely: mm(likely), hi: mm(likely + 0.8), source: 'osm-levels' };
      else if (kind < 0.75)
        height = {
          lo: mm(likely * 0.75),
          likely: mm(likely),
          hi: mm(likely * 1.35),
          source: 'open-buildings',
        };
      else height = { lo: mm(3), likely: mm(likely), hi: mm(likely * 1.8 + 6), source: 'unknown' };
      rings.push(ring);
      buildings.push({
        id: `fill_${buildings.length}`,
        footprint: toMm(ring),
        height,
        ...(kind < 0.2 ? { levels } : {}),
        roof: 'flat',
        sources: ['standin'],
      });
    }
  }

  // Trees: dense on the campus (rocky scrub and planted avenues), sparse outside.
  const trees: ContextTree[] = [];
  for (let i = 0; i < 900 && trees.length < 420; i++) {
    const at: EN = [-900 + r() * 1800, -900 + r() * 1800];
    const inCampus = pointInRing(at[0], at[1], CAMPUS);
    if (!inCampus && r() < 0.7) continue;
    let clash = false;
    for (const ring of rings) {
      if (pointInRing(at[0], at[1], ring)) {
        clash = true;
        break;
      }
      const c = centre(ring);
      if (Math.hypot(c[0] - at[0], c[1] - at[1]) < 12) {
        clash = true;
        break;
      }
    }
    if (clash) continue;
    const h = 6 + r() * 8;
    trees.push({
      id: `tree_${trees.length}`,
      at: [mm(at[0]), mm(at[1])],
      crownRadius: mm(2.5 + r() * 3),
      height: { lo: mm(h * 0.8), likely: mm(h), hi: mm(h * 1.2) },
      leafOn: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      source: 'unknown',
    });
  }

  const tiles = new Map<string, CityTile>();
  const tileOf = (e: number, n: number): CityTile => {
    const tx = Math.floor(e / TILE_M);
    const ty = Math.floor(n / TILE_M);
    const key = `${tx},${ty}`;
    let t = tiles.get(key);
    if (!t) {
      t = { schema: 'ibasho.city/1', packId: STAND_IN_PACK_ID, tx, ty, buildings: [], trees: [] };
      tiles.set(key, t);
    }
    return t;
  };
  for (const b of buildings) {
    const c = centre(b.footprint.map(([x, y]) => [x / 1000, y / 1000] as EN));
    tileOf(c[0], c[1]).buildings.push(b);
  }
  for (const t of trees) tileOf(t.at[0] / 1000, t.at[1] / 1000).trees.push(t);

  const roads: StandInCity['roads'] = [
    // Prof C R Rao Road along the campus east edge, Gachibowli main road to the south.
    {
      points: [
        [300, -900],
        [290, -300],
        [275, 120],
        [240, 500],
        [180, 900],
      ],
      width: 18,
    },
    {
      points: [
        [-900, -330],
        [-300, -300],
        [290, -300],
        [900, -260],
      ],
      width: 22,
    },
    {
      points: [
        [275, 120],
        [600, 160],
        [900, 200],
      ],
      width: 14,
    },
    // Campus loop.
    {
      points: [
        [-220, -220],
        [200, -220],
        [215, 330],
        [-240, 330],
        [-220, -220],
      ],
      width: 7,
    },
    {
      points: [
        [-10, -220],
        [0, 150],
        [215, 150],
      ],
      width: 6,
    },
  ];
  cached = { packId: STAND_IN_PACK_ID, origin: IIIT_ORIGIN, tiles: [...tiles.values()], roads };
  return cached;
}
