/**
 * Overpass JSON to `ibasho.city/1` tiles (ARCH 15.7, WP-17). Pure and deterministic: the same
 * cache gives byte-identical tiles (Y3). Every building carries a height range and its source (Y1):
 * a tagged `height` is a narrow range, `building:levels` a wider one, and no tag at all is an
 * honest wide range with source `unknown` (drawn hatched, R29), never zero.
 */
import type { CityTile, ContextBuilding, ContextTree, HeightSource, PointMm } from '@ibasho/core';
import type { CityArea } from './areas.ts';
import type { OverpassElement, OverpassJson } from './fetch.ts';

const R = 6_371_008.8; // mean Earth radius, m
const GRID = 100; // footprint vertices snap to 100 mm: plenty for context, keeps the pack small

/** Local tangent-plane projection around the pack origin, integer mm, x east, y north. */
export function projector(origin: { lat: number; lon: number }) {
  const k = (Math.PI / 180) * R * 1000;
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  return (lat: number, lon: number): PointMm => [
    Math.round(((lon - origin.lon) * cosLat * k) / GRID) * GRID,
    Math.round(((lat - origin.lat) * k) / GRID) * GRID,
  ];
}

/** Twice the signed area (mm²), positive for counter-clockwise. */
function area2(ring: readonly PointMm[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i] as PointMm;
    const [x2, y2] = ring[(i + 1) % ring.length] as PointMm;
    s += x1 * y2 - x2 * y1;
  }
  return s;
}

/** Drop the closing point and repeats; counter-clockwise; undefined when degenerate. */
export function cleanRing(pts: PointMm[]): PointMm[] | undefined {
  const out: PointMm[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && out.length > 1 && first[0] === last[0] && first[1] === last[1]) out.pop();
  if (out.length < 3) return undefined;
  const a = area2(out);
  if (a === 0) return undefined;
  return a > 0 ? out : out.reverse();
}

const num = (s: string | undefined): number | undefined => {
  if (s === undefined) return undefined;
  const m = /^\s*([0-9]+(?:\.[0-9]+)?)\s*(m)?\s*$/.exec(s);
  return m ? Number(m[1]) : undefined;
};

type Use = keyof CityArea['levelHeight'];
function useOf(tags: Record<string, string>): Use {
  const b = tags['building'] ?? '';
  const amenity = tags['amenity'] ?? '';
  if (/^(apartments|residential|house|dormitory|hostel|terrace|detached)$/.test(b)) return 'residential';
  if (/^(university|college|school)$/.test(b) || /^(university|college|school)$/.test(amenity))
    return 'academic';
  if (/^(office|commercial)$/.test(b) || tags['office']) return 'office';
  return 'other';
}

/** Height range in mm with its source (Y1). */
export function heightOf(
  tags: Record<string, string>,
  area: CityArea,
  footprintM2 = 0,
): { h: ContextBuilding['height']; levels?: number } {
  const h = num(tags['height']) ?? num(tags['building:height']);
  const levels = num(tags['building:levels']);
  const lv = levels !== undefined ? Math.round(levels) : undefined;
  if (h !== undefined && h > 0) {
    const likely = Math.round(h * 1000);
    return {
      h: { lo: Math.round(likely * 0.95), likely, hi: Math.round(likely * 1.05), source: 'osm-height' },
      ...(lv !== undefined ? { levels: lv } : {}),
    };
  }
  if (lv !== undefined && lv > 0) {
    const per = area.levelHeight[useOf(tags)];
    const likely = lv * per;
    // Storey height spread of +/- 500 mm, plus up to 1.5 m of parapet or roof structure.
    return {
      h: { lo: lv * (per - 500), likely, hi: lv * (per + 500) + 1500, source: 'osm-levels' },
      levels: lv,
    };
  }
  const source: HeightSource = 'unknown';
  // Unknown (R29: a range, never zero). The likely value is a guess from the footprint size only,
  // so the scene has a plausible skyline; the source stays `unknown` and the range stays wide.
  const per = area.levelHeight[useOf(tags)];
  const storeys = /^(house|detached|hut|shed|garage|kiosk)$/.test(tags['building'] ?? '')
    ? 2
    : footprintM2 < 150
      ? 2
      : footprintM2 < 600
        ? 4
        : footprintM2 < 3000
          ? 5
          : 6;
  const likely = storeys * per;
  return { h: { lo: 3000, likely, hi: Math.min(2 * likely + 6000, 60_000), source } };
}

/** Inner rings (courtyards) of a relation, clockwise. */
function innerRings(e: OverpassElement, project: ReturnType<typeof projector>): PointMm[][] {
  const out: PointMm[][] = [];
  for (const m of e.members ?? []) {
    if (m.role !== 'inner' || !m.geometry) continue;
    const r = cleanRing(m.geometry.map((g) => project(g.lat, g.lon)));
    if (r) out.push(r.reverse());
  }
  return out;
}

/** Ray-casting point in ring (for assigning courtyards to their outer ring). */
function inside(p: PointMm, ring: readonly PointMm[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as PointMm;
    const [xj, yj] = ring[j] as PointMm;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function outerRings(e: OverpassElement, project: ReturnType<typeof projector>): PointMm[][] {
  if (e.type === 'way' && e.geometry) {
    const r = cleanRing(e.geometry.map((g) => project(g.lat, g.lon)));
    return r ? [r] : [];
  }
  if (e.type === 'relation' && e.members) {
    const out: PointMm[][] = [];
    for (const m of e.members) {
      if (m.role !== 'outer' || !m.geometry) continue;
      const r = cleanRing(m.geometry.map((g) => project(g.lat, g.lon)));
      if (r) out.push(r);
    }
    return out;
  }
  return [];
}

function centroid(ring: readonly PointMm[]): PointMm {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}

const ALIAS_TAGS = ['alt_name', 'short_name', 'official_name', 'name:en', 'old_name', 'loc_name'];

/** Search names and address from OSM tags (aliases may be `;` separated). */
function namesOf(tags: Record<string, string>): { aliases?: string[]; addr?: string } {
  const aliases = [
    ...new Set(
      ALIAS_TAGS.flatMap((k) => (tags[k] ?? '').split(';').map((x) => x.trim())).filter(
        (x) => x && x !== tags['name'],
      ),
    ),
  ];
  const addr = [
    tags['addr:housename'],
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:suburb'] ?? tags['addr:city'],
  ]
    .filter((x) => x && x.trim())
    .join(', ');
  return { ...(aliases.length ? { aliases } : {}), ...(addr ? { addr } : {}) };
}

export interface BuiltPack {
  tiles: CityTile[];
  stats: { buildings: number; bySource: Record<string, number>; trees: number };
}

/** Members of building relations are drawn once, by the relation. */
function relationMemberWays(els: readonly OverpassElement[]): Set<number> {
  const s = new Set<number>();
  for (const e of els)
    if (e.type === 'relation') for (const m of e.members ?? []) if (m.type === 'way') s.add(m.ref);
  return s;
}

export function buildPack(json: OverpassJson, area: CityArea): BuiltPack {
  const project = projector(area.origin);
  const skip = relationMemberWays(json.elements);
  const tiles = new Map<string, CityTile>();
  const tileOf = (p: PointMm): CityTile => {
    const tx = Math.floor(p[0] / area.tileSize);
    const ty = Math.floor(p[1] / area.tileSize);
    const key = `${tx},${ty}`;
    let t = tiles.get(key);
    if (!t) {
      t = { schema: 'ibasho.city/1', packId: area.packId, tx, ty, buildings: [], trees: [] };
      tiles.set(key, t);
    }
    return t;
  };
  const bySource: Record<string, number> = {};
  let buildings = 0;
  let trees = 0;
  for (const e of json.elements) {
    const tags = e.tags ?? {};
    if (e.type === 'node' && tags['natural'] === 'tree' && e.lat !== undefined && e.lon !== undefined) {
      const at = project(e.lat, e.lon);
      const ht = num(tags['height']);
      const tree: ContextTree = {
        id: `osm_n${e.id}`,
        at,
        crownRadius: 3000,
        height: ht
          ? { lo: Math.round(ht * 900), likely: Math.round(ht * 1000), hi: Math.round(ht * 1100) }
          : { lo: 5000, likely: 8000, hi: 12000 },
        // Hyderabad street trees are mostly evergreen; leaf-on all year unless known.
        leafOn: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        source: 'osm',
      };
      tileOf(at).trees.push(tree);
      trees++;
      continue;
    }
    if (!tags['building'] || (e.type === 'way' && skip.has(e.id))) continue;
    const rings = outerRings(e, project);
    const holes = e.type === 'relation' ? innerRings(e, project) : [];
    const m2 =
      rings.reduce((acc, r) => acc + area2(r) / 2e6, 0) + holes.reduce((acc, r) => acc + area2(r) / 2e6, 0);
    const { h, levels } = heightOf(tags, area, m2);
    rings.forEach((ring, i) => {
      const id = `osm_${e.type === 'way' ? 'w' : 'r'}${e.id}${rings.length > 1 ? `_${i}` : ''}`;
      const b: ContextBuilding = {
        id,
        footprint: ring,
        ...(() => {
          const mine = holes.filter((hr) => inside(hr[0] as PointMm, ring));
          return mine.length ? { holes: mine } : {};
        })(),
        height: h,
        ...(levels !== undefined ? { levels } : {}),
        ...(tags['roof:shape'] ? { roof: tags['roof:shape'] } : {}),
        sources: [`osm:${e.type}/${e.id}`],
        ...(tags['name'] ? { name: tags['name'] } : {}),
        ...namesOf(tags),
      };
      tileOf(centroid(ring)).buildings.push(b);
      bySource[h.source] = (bySource[h.source] ?? 0) + 1;
      buildings++;
    });
  }
  const out = [...tiles.values()].sort((a, b) => a.ty - b.ty || a.tx - b.tx);
  for (const t of out) {
    t.buildings.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    t.trees.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  return { tiles: out, stats: { buildings, bySource, trees } };
}
