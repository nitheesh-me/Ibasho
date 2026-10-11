/**
 * Sample data for the studio: golden building documents, places and the Hyderabad city pack
 * (agent A, WP-14 and WP-17). Owner: WP-08.
 *
 * Fixtures are parsed through `@ibasho/core/schemas` (untrusted input rule). City tiles load once
 * per session (about 72 KB gzip), lazily, and are shared by the scene, the site stages and search.
 */
import type { BuildingDoc, CityTile, ContextBuilding, Place } from '@ibasho/core';
import { BuildingDocSchema, PlaceSchema } from '@ibasho/core/schemas';
import gb1Json from '@ibasho/fixtures/buildings/gb1.building.json';
import gb2Json from '@ibasho/fixtures/buildings/gb2.building.json';
import gb3Json from '@ibasho/fixtures/buildings/gb3.building.json';
import gb4Json from '@ibasho/fixtures/buildings/gb4.building.json';
import placesJson from '@ibasho/fixtures/buildings/places.json';
import { HERO_CONTEXT_IDS } from '@ibasho/pack-city-hyderabad/engine';

export const HERO_ID = 'gb1';
export const IIIT_PLACE_ID = 'pl_iiit';

const DOCS: Record<string, unknown> = { gb1: gb1Json, gb2: gb2Json, gb3: gb3Json, gb4: gb4Json };

/** A fresh copy of a golden document (documents are values; callers may edit the copy). */
export function sampleDoc(id: string): BuildingDoc {
  const raw = DOCS[id];
  if (!raw) throw new Error(`no sample building ${id}`);
  return BuildingDocSchema.parse(structuredClone(raw)) as BuildingDoc;
}

export function samplePlaces(): Place[] {
  return (placesJson as unknown[]).map((p) => PlaceSchema.parse(p) as Place);
}

/** OSM ids a modelled building replaces (hide them in the scene, merge them in search). */
export const contextIdsFor = (buildingId: string): readonly string[] => HERO_CONTEXT_IDS[buildingId] ?? [];

let tilesPromise: Promise<CityTile[]> | undefined;
/** Hyderabad tiles, loaded once (lazy chunk). Empty on failure: everything still works without context. */
export function cityTiles(): Promise<CityTile[]> {
  if (!tilesPromise) {
    tilesPromise = import('@ibasho/pack-city-hyderabad/engine')
      .then((m) => m.loadCityTiles())
      .catch(() => []);
  }
  return tilesPromise;
}

/** Every context building across tiles (pack frame, mm). */
export const contextOf = (tiles: readonly CityTile[]): ContextBuilding[] => tiles.flatMap((t) => t.buildings);

/** The city a place belongs to, for search and the scene. */
export const cityOf = (place: Pick<Place, 'cityPackId'> | undefined): string =>
  place?.cityPackId ?? 'city-hyderabad';

/** Local standard time offset of a place, in hours (IST 5.5 for India, GMT for the UK). */
export function tzHoursOf(place: Pick<Place, 'lat' | 'lon'> | undefined): number {
  if (!place) return 5.5;
  if (place.lon > 68 && place.lon < 98 && place.lat > 6 && place.lat < 37) return 5.5;
  return Math.round(place.lon / 15);
}

/** The city a weather year belongs to, in words. */
export function weatherCity(place: Pick<Place, 'climatePackId' | 'name'> | undefined): string {
  const id = place?.climatePackId ?? '';
  if (id.includes('london')) return 'London';
  if (id.includes('hyderabad')) return 'Hyderabad';
  return place?.name ?? 'this place';
}

/** True between the tropics, where the noon sun stands in the north for part of the year. */
export const inTropics = (place: Pick<Place, 'lat'> | undefined): boolean => Math.abs(place?.lat ?? 17) < 23.44;
