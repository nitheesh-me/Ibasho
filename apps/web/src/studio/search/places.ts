/**
 * Find a building, floor or room by name in the loaded areas (owner request). Owner: WP-08.
 *
 * Agent A's index (`buildPlaceIndex`, `searchPlaces` in `@ibasho/plan`) over the city pack tiles
 * and every building document in the studio (samples and your own), with the pack ids a document
 * stands in for so the two merge into one hit. This file only maps hits to studio paths.
 */
import type { CityTile, PlaceHit } from '@ibasho/core';
import { buildPlaceIndex, type PlaceIndex, searchPlaces } from '@ibasho/plan';
import { cityOf, contextIdsFor } from '../data.ts';
import type { StudioState } from '../state/studio.ts';

type Loaded = Pick<StudioState, 'places' | 'buildings'> & { tiles: readonly CityTile[] };

let memo: { key: unknown[]; index: PlaceIndex } | undefined;

/** The index over what is loaded; rebuilt only when tiles or buildings change. */
export function placeIndex(s: Loaded): PlaceIndex {
  const key = [s.tiles, s.buildings, s.places];
  if (memo && memo.key.every((k, i) => k === key[i])) return memo.index;
  const index = buildPlaceIndex({
    places: Object.values(s.places).map((p) => p.place),
    cities: s.tiles.length ? [{ city: 'city-hyderabad', tiles: s.tiles }] : [],
    buildings: Object.values(s.buildings).map((b) => ({
      doc: b.doc,
      city: cityOf(s.places[b.placeId]?.place),
      ...(contextIdsFor(b.id).length ? { contextIds: contextIdsFor(b.id) } : {}),
    })),
  });
  memo = { key, index };
  return index;
}

export function findPlaces(s: Loaded, query: string, limit = 24): PlaceHit[] {
  if (!query.trim()) return [];
  return searchPlaces(placeIndex(s), query, { limit });
}

/** The studio place a hit belongs to. */
export function placeOfHit(s: Pick<StudioState, 'places' | 'buildings'>, h: PlaceHit): string | undefined {
  const b = s.buildings[h.buildingId];
  if (b) return b.placeId;
  if (s.places[h.id]) return h.id;
  return Object.values(s.places).find((p) => cityOf(p.place) === h.city)?.place.id;
}

/** Where a hit takes you: the building and the zoom level, with the scene focus. */
export function hitPath(s: Pick<StudioState, 'places' | 'buildings'>, h: PlaceHit): string {
  const placeId = placeOfHit(s, h) ?? 'pl_iiit';
  if (h.kind === 'place') return `/p/${h.id}`;
  const box = `&bbox=${h.bbox.minX},${h.bbox.minY},${h.bbox.maxX},${h.bbox.maxY}`;
  const ours = s.buildings[h.buildingId];
  if (!ours) return `/p/${placeId}?level=site&focus=${encodeURIComponent(h.id)}${box}`;
  const base = `/p/${placeId}/b/${h.buildingId}`;
  // A part of one of your buildings (`gb2#shodh`): focus that block by its box.
  if (h.kind === 'building' && h.id !== h.buildingId)
    return `${base}?level=building&focus=${encodeURIComponent(h.id)}${box}`;
  if (h.kind === 'building') return `${base}?level=building&focus=${encodeURIComponent(h.buildingId)}`;
  if (h.kind === 'storey') return `${base}?level=floor&floor=${h.storeyId}&focus=${h.storeyId}`;
  return `${base}?level=room&floor=${h.storeyId}&room=${h.id}&focus=${h.id}`;
}

/** Second line of a result, in plain words. */
export function hitDetail(s: Pick<StudioState, 'places' | 'buildings'>, h: PlaceHit): string {
  const placeId = placeOfHit(s, h);
  const placeName = placeId ? s.places[placeId]?.place.name : undefined;
  if (h.kind === 'room') return [h.storeyName, h.buildingName].filter(Boolean).join(', ');
  if (h.kind === 'storey') return h.buildingName;
  if (h.kind === 'place') return 'A place';
  const ours = s.buildings[h.buildingId];
  return [ours ? 'Your model' : 'Neighbour from the map', placeName].filter(Boolean).join(', ');
}

export const cityLabel = (city: string): string =>
  city === 'city-hyderabad' ? 'Hyderabad' : city === 'city-london' ? 'London' : city.replace(/^pl_/, '');
