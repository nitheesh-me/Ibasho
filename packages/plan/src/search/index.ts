/**
 * Place search (contract `PlaceHit` in `@ibasho/core`): an offline index over city pack buildings
 * and building documents, ranked by exact, prefix, token and fuzzy matches on names and aliases.
 * Storeys and rooms answer to their own names plus their building's ("Vindhya floor 2",
 * "A3 lab"). Pure; build the index once per loaded area, search on every keystroke.
 */
import type {
  BuildingDoc,
  CityTile,
  Mm,
  Place,
  PlaceHit,
  PlaceSearchOptions,
  PointMm,
  Storey,
} from '@ibasho/core';
import { toPlaceFrame } from '../frame.ts';
import { CURATED_ALIASES, ORDINAL_SUFFIX, ORDINALS } from './aliases.ts';
import { normalise, tokenMatch, tokens } from './text.ts';

interface Entry {
  hit: Omit<PlaceHit, 'score' | 'matched'>;
  /** Own names (name first), normalised token lists. */
  own: { text: string; toks: string[] }[];
  /** Parent names (building for a storey or room). */
  parent: { text: string; toks: string[] }[];
}

export interface PlaceIndex {
  entries: Entry[];
}

export interface PlaceIndexInput {
  /** Loaded city packs: pack id and its tiles. */
  cities?: { city: string; tiles: readonly CityTile[] }[];
  /**
   * Building documents with their city (pack id or place id) and, when the document stands in
   * for OSM buildings, their ids (`HERO_CONTEXT_IDS` from the pack) so the two merge into one hit.
   */
  buildings?: { doc: BuildingDoc; city: string; contextIds?: readonly string[] }[];
  /** Places (campuses, sites): indexed as `place` hits centred on their buildings. */
  places?: readonly Place[];
}

const names = (xs: readonly string[]) =>
  [...new Set(xs.filter((x) => x && x.trim()))].map((text) => ({ text, toks: tokens(text) }));
const withCurated = (name: string, extra: readonly string[] = []) => {
  const curated = [name, ...extra].flatMap((n) => CURATED_ALIASES[normalise(n)] ?? []);
  return [...new Set([...extra, ...curated])].filter((a) => normalise(a) !== normalise(name));
};

function bboxOf(pts: readonly PointMm[]) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}
const centreOf = (b: { minX: Mm; minY: Mm; maxX: Mm; maxY: Mm }): [Mm, Mm] => [
  Math.round((b.minX + b.maxX) / 2),
  Math.round((b.minY + b.maxY) / 2),
];

/** Names a storey answers to: its name, "floor N", "level N", "LN", "Nth floor", ordinal words. */
function storeyNames(st: Storey, index: number, aboveGrade: number): string[] {
  const extra = st.aliases ?? [];
  if (st.belowGrade) return [st.name, ...extra, 'basement', 'cellar', 'lower ground', 'B1'];
  // A storey named with a number ("Second floor", "Floor 4") keeps that number; else count up from 0.
  const words = tokens(st.name);
  const named = words
    .map((w) => (ORDINALS.indexOf(w) >= 0 ? ORDINALS.indexOf(w) : /^\d+$/.test(w) ? Number(w) : -1))
    .find((x) => x >= 0);
  const n = named ?? aboveGrade;
  const out = [st.name, ...extra, `floor ${n}`, `level ${n}`, `L${n}`, `storey ${n}`];
  if (ORDINALS[n]) out.push(`${ORDINALS[n]} floor`);
  if (ORDINAL_SUFFIX[n]) out.push(`${ORDINAL_SUFFIX[n]} floor`);
  if (n === 0) out.push('ground floor', 'G');
  void index;
  return out;
}

export function buildPlaceIndex(input: PlaceIndexInput): PlaceIndex {
  const entries: Entry[] = [];
  const merged = new Set<string>();
  for (const b of input.buildings ?? []) for (const id of b.contextIds ?? []) merged.add(id);
  const osmNames = new Map<string, string[]>();
  for (const c of input.cities ?? []) {
    for (const t of c.tiles) {
      for (const cb of t.buildings) {
        if (!cb.name && !cb.aliases?.length && !cb.addr) continue;
        const name = cb.name ?? cb.aliases?.[0] ?? cb.addr ?? cb.id;
        if (merged.has(cb.id)) {
          osmNames.set(cb.id, [name, ...(cb.aliases ?? [])]);
          continue;
        }
        const bbox = bboxOf(cb.footprint);
        const aliases = withCurated(name, cb.aliases ?? []);
        entries.push({
          hit: {
            kind: 'building',
            id: cb.id,
            name,
            aliases,
            buildingId: cb.id,
            buildingName: name,
            city: c.city,
            tile: [t.tx, t.ty],
            centre: centreOf(bbox),
            bbox,
            heightRange: { lo: cb.height.lo, hi: cb.height.hi },
            source: 'osm',
          },
          own: names([name, ...aliases, ...(cb.addr ? [cb.addr] : [])]),
          parent: [],
        });
      }
    }
  }
  for (const { doc, city, contextIds } of input.buildings ?? []) {
    const fromOsm = (contextIds ?? []).flatMap((id) => osmNames.get(id) ?? []);
    const aliases = withCurated(doc.name, fromOsm);
    const allPts: PointMm[] = [];
    const storeyBoxes = doc.storeys.map((st) => {
      const pts = st.rooms.flatMap((r) => r.floor.outer.map((p) => toPlaceFrame(doc, p)));
      allPts.push(...pts);
      return pts.length ? bboxOf(pts) : undefined;
    });
    if (!allPts.length && doc.massing) allPts.push(...doc.massing.footprint.map((p) => toPlaceFrame(doc, p)));
    const bbox = allPts.length
      ? bboxOf(allPts)
      : { minX: doc.origin.x, minY: doc.origin.y, maxX: doc.origin.x, maxY: doc.origin.y };
    const top = Math.max(0, ...doc.storeys.map((s) => s.elevation + s.floorToFloor * s.multiplier));
    const bottom = Math.min(0, ...doc.storeys.map((s) => s.elevation));
    const bName = names([doc.name, ...aliases]);
    const base = {
      buildingId: doc.id,
      buildingName: doc.name,
      city,
      ...(contextIds?.length ? { contextIds: [...contextIds] } : {}),
    };
    entries.push({
      hit: {
        kind: 'building',
        id: doc.id,
        name: doc.name,
        aliases,
        ...base,
        centre: centreOf(bbox),
        bbox,
        heightRange: { lo: bottom, hi: top },
        source: contextIds?.length ? 'merged' : 'document',
      },
      own: bName,
      parent: [],
    });
    let above = 0;
    doc.storeys.forEach((st, i) => {
      const sb = storeyBoxes[i] ?? bbox;
      const sNames = storeyNames(st, i, st.belowGrade ? -1 : above);
      if (!st.belowGrade) above += st.multiplier;
      const hr = { lo: st.elevation, hi: st.elevation + st.floorToFloor * st.multiplier };
      entries.push({
        hit: {
          kind: 'storey',
          id: st.id,
          name: st.name,
          aliases: sNames.slice(1),
          ...base,
          storeyId: st.id,
          storeyName: st.name,
          centre: centreOf(sb),
          bbox: sb,
          heightRange: hr,
          source: 'document',
        },
        own: names(sNames),
        parent: bName,
      });
      for (const r of st.rooms) {
        const rb = bboxOf(r.floor.outer.map((p) => toPlaceFrame(doc, p)));
        const fn = r.spaceTypeId ? r.spaceTypeId.replace(/-/g, ' ') : undefined;
        const rName = r.name ?? r.id;
        const own = [rName, ...(r.aliases ?? []), ...(fn ? [fn, `${rName} ${fn}`] : [])];
        entries.push({
          hit: {
            kind: 'room',
            id: r.id,
            name: rName,
            aliases: own.slice(1),
            ...base,
            storeyId: st.id,
            storeyName: st.name,
            centre: centreOf(rb),
            bbox: rb,
            heightRange: hr,
            source: 'document',
          },
          own: names(own),
          parent: [...bName, ...names(sNames)],
        });
      }
    });
  }
  addBlocks(input, entries);
  addPlaces(input, entries);
  return { entries };
}

/**
 * Named parts of a document building (Himalaya's Shodh, Bodh, Vrithi, Block D): rooms whose first
 * alias also starts their name and that recur on two or more storeys form one `building` hit with
 * id `<buildingId>#<slug>` and the union box of those rooms.
 */
function addBlocks(input: PlaceIndexInput, entries: Entry[]): void {
  for (const { doc, city } of input.buildings ?? []) {
    const groups = new Map<
      string,
      { storeys: Set<string>; pts: PointMm[]; aliases: Set<string>; lo: Mm; hi: Mm }
    >();
    for (const st of doc.storeys) {
      for (const r of st.rooms) {
        const first = r.aliases?.[0];
        if (!first || !normalise(r.name ?? '').startsWith(normalise(first))) continue;
        const g = groups.get(first) ?? {
          storeys: new Set<string>(),
          pts: [],
          aliases: new Set<string>(),
          lo: st.elevation,
          hi: st.elevation,
        };
        g.storeys.add(st.id);
        for (const a of r.aliases ?? []) if (a !== first) g.aliases.add(a);
        g.pts.push(...r.floor.outer.map((p) => toPlaceFrame(doc, p)));
        g.lo = Math.min(g.lo, st.elevation);
        g.hi = Math.max(g.hi, st.elevation + st.floorToFloor * st.multiplier);
        groups.set(first, g);
      }
    }
    for (const [label, g] of groups) {
      if (g.storeys.size < 2) continue;
      const bbox = bboxOf(g.pts);
      const aliases = [label, ...g.aliases];
      entries.push({
        hit: {
          kind: 'building',
          id: `${doc.id}#${normalise(label).replace(/ /g, '-')}`,
          name: `${label} (${doc.name})`,
          aliases,
          buildingId: doc.id,
          buildingName: doc.name,
          city,
          centre: centreOf(bbox),
          bbox,
          heightRange: { lo: g.lo, hi: g.hi },
          source: 'document',
        },
        own: names(aliases),
        parent: names([doc.name, ...withCurated(doc.name)]),
      });
    }
  }
}

/** Places (campus, site) as `place` hits, boxed around their modelled buildings. */
function addPlaces(input: PlaceIndexInput, entries: Entry[]): void {
  for (const p of input.places ?? []) {
    const boxes = entries
      .filter(
        (e) =>
          e.hit.kind === 'building' && e.hit.source !== 'osm' && p.buildingIds.includes(e.hit.buildingId),
      )
      .map((e) => e.hit.bbox);
    const bbox = boxes.length
      ? bboxOf(
          boxes.flatMap((b): PointMm[] => [
            [b.minX, b.minY],
            [b.maxX, b.maxY],
          ]),
        )
      : { minX: -250_000, minY: -250_000, maxX: 250_000, maxY: 250_000 };
    const aliases = withCurated(p.name);
    entries.push({
      hit: {
        kind: 'place',
        id: p.id,
        name: p.name,
        aliases,
        buildingId: p.buildingIds[0] ?? '',
        buildingName: '',
        city: p.cityPackId ?? p.id,
        centre: centreOf(bbox),
        bbox,
        source: 'place',
      },
      own: names([p.name, ...aliases]),
      parent: [],
    });
  }
}

const KIND_RANK = { place: 4, building: 3, storey: 2, room: 1 } as const;

/** `strictShort`: a one-letter query word in a longer query must match a word exactly. */
function best(q: string, list: Entry['own'], strictShort = false): { s: number; text?: string } {
  let s = 0;
  let text: string | undefined;
  for (const n of list) {
    for (const t of n.toks) {
      const v = strictShort && q.length === 1 && !/\d/.test(q) ? (q === t ? 1 : 0) : tokenMatch(q, t);
      if (v > s) {
        s = v;
        text = n.text;
      }
    }
  }
  return text === undefined ? { s } : { s, text };
}

/** Ranked hits for `query` (empty query gives none). */
export function searchPlaces(index: PlaceIndex, query: string, opts: PlaceSearchOptions = {}): PlaceHit[] {
  const q = tokens(query);
  if (!q.length) return [];
  const nq = normalise(query);
  const minScore = opts.minScore ?? 30;
  const out: PlaceHit[] = [];
  for (const e of index.entries) {
    const h = e.hit;
    if (opts.kinds && !opts.kinds.includes(h.kind)) continue;
    if (opts.city && h.city !== opts.city) continue;
    if (opts.buildingId && h.buildingId !== opts.buildingId) continue;
    let sum = 0;
    let ownHits = 0;
    const matched = new Set<string>();
    let ok = true;
    for (const t of q) {
      const o = best(t, e.own, q.length > 1);
      const p = best(t, e.parent, q.length > 1);
      if (o.s === 0 && p.s === 0) {
        ok = false;
        break;
      }
      if (o.s >= p.s * 0.9 && o.s > 0) {
        sum += o.s;
        ownHits++;
        if (o.text) matched.add(o.text);
      } else {
        sum += p.s * 0.8;
        if (p.text) matched.add(p.text);
      }
    }
    // Every query word must match, and a storey or room must match on something of its own.
    if (!ok || ownHits === 0) continue;
    let score = (sum / q.length) * 80;
    const exact = e.own.some((n) => normalise(n.text) === nq);
    const prefix = !exact && e.own.some((n) => normalise(n.text).startsWith(nq));
    if (exact) score += 20;
    else if (prefix) score += 10;
    // Words that only match the parent: prefer the parent itself unless the query names this level.
    if (h.kind !== 'building' && ownHits < q.length) score -= 2;
    score = Math.max(0, Math.min(100, Math.round(score)));
    if (score < minScore) continue;
    out.push({ ...h, score, matched: [...matched] });
  }
  out.sort(
    (a, b) =>
      b.score - a.score ||
      KIND_RANK[b.kind] - KIND_RANK[a.kind] ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
      (a.id < b.id ? -1 : 1),
  );
  return out.slice(0, opts.limit ?? 10);
}
