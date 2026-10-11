/**
 * Find a building, floor or room by name in the loaded areas (owner request). Owner: WP-08.
 *
 * Agent A's index (`buildPlaceIndex`, `searchPlaces` in `@ibasho/plan`) over the city pack tiles
 * and every building document in the studio (samples and your own), with the pack ids a document
 * stands in for so the two merge into one hit. This file only maps hits to studio paths.
 */
import type { CityTile, PlaceHit } from '@ibasho/core';
import { buildPlaceIndex, type PlaceIndex, searchPlaces } from '@ibasho/plan';
import { cityOf, contextIdsFor, hasSampleDoc, sampleDoc, samplePlaces } from '../data.ts';
import type { StudioState } from '../state/studio.ts';

type Loaded = Pick<StudioState, 'places' | 'buildings'> & { areas: Readonly<Record<string, readonly CityTile[]>> };

/** On-demand sample places (offices of interest, King's Cross) and their buildings, searchable before they load. */
let onDemand: { places: ReturnType<typeof samplePlaces>; docs: { doc: ReturnType<typeof sampleDoc>; placeId: string; city: string }[] } | undefined;
function onDemandSamples() {
  if (!onDemand) {
    const places = samplePlaces().filter((p) => p.onDemand);
    onDemand = {
      places,
      docs: places.flatMap((p) =>
        p.buildingIds.filter(hasSampleDoc).map((id) => ({ doc: sampleDoc(id), placeId: p.id, city: cityOf(p) })),
      ),
    };
  }
  return onDemand;
}

/** The sample place a building belongs to, when it is not in the studio yet. */
export const samplePlaceOf = (buildingId: string): string | undefined =>
  onDemandSamples().docs.find((d) => d.doc.id === buildingId)?.placeId;

let memo: { key: unknown[]; index: PlaceIndex } | undefined;

/** The index over what is loaded; rebuilt only when tiles or buildings change. */
export function placeIndex(s: Loaded): PlaceIndex {
  const key = [s.areas, s.buildings, s.places];
  if (memo && memo.key.every((k, i) => k === key[i])) return memo.index;
  const extra = onDemandSamples();
  const index = buildPlaceIndex({
    places: [
      ...Object.values(s.places).map((p) => p.place),
      ...extra.places.filter((p) => !s.places[p.id]),
    ],
    cities: Object.entries(s.areas)
      .filter(([, tiles]) => tiles.length)
      .map(([city, tiles]) => ({ city, tiles })),
    buildings: [
      ...Object.values(s.buildings).map((b) => ({
        doc: b.doc,
        city: cityOf(s.places[b.placeId]?.place),
        ...(contextIdsFor(b.id).length ? { contextIds: contextIdsFor(b.id) } : {}),
      })),
      ...extra.docs
        .filter((d) => !s.buildings[d.doc.id])
        .map((d) => ({ doc: d.doc, city: d.city, ...(contextIdsFor(d.doc.id).length ? { contextIds: contextIdsFor(d.doc.id) } : {}) })),
    ],
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
  if (h.kind === 'place') return h.id;
  const sample = samplePlaceOf(h.buildingId);
  if (sample) return sample;
  return Object.values(s.places).find((p) => cityOf(p.place) === h.city)?.place.id;
}

/** Where a hit takes you: the building and the zoom level, with the scene focus. */
export function hitPath(s: Pick<StudioState, 'places' | 'buildings'>, h: PlaceHit): string {
  const placeId = placeOfHit(s, h) ?? 'pl_iiit';
  if (h.kind === 'place') return `/p/${h.id}`;
  const box = `&bbox=${h.bbox.minX},${h.bbox.minY},${h.bbox.maxX},${h.bbox.maxY}`;
  const ours = s.buildings[h.buildingId] ?? (samplePlaceOf(h.buildingId) ? { id: h.buildingId } : undefined);
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
  const placeName = placeId
    ? (s.places[placeId]?.place.name ?? onDemandSamples().places.find((p) => p.id === placeId)?.name)
    : undefined;
  if (h.kind === 'room') return [h.storeyName, h.buildingName].filter(Boolean).join(', ');
  if (h.kind === 'storey') return h.buildingName;
  if (h.kind === 'place') return 'A place';
  const ours = s.buildings[h.buildingId] ?? samplePlaceOf(h.buildingId);
  return [ours ? 'Modelled building' : 'Neighbour from the map', placeName].filter(Boolean).join(', ');
}

export const cityLabel = (city: string): string =>
  city.startsWith('city-hyderabad') ? 'Hyderabad' : city.startsWith('city-london') ? 'London' : '';
