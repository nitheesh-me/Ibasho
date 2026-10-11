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
import gb5Json from '@ibasho/fixtures/buildings/gb5.building.json';
import gb6Json from '@ibasho/fixtures/buildings/gb6.building.json';
import gb7Json from '@ibasho/fixtures/buildings/gb7.building.json';
import placesJson from '@ibasho/fixtures/buildings/places.json';
import { HERO_CONTEXT_IDS as HERO_LONDON } from '@ibasho/pack-city-london/engine';
import { HERO_CONTEXT_IDS as HERO_HYDERABAD } from '@ibasho/pack-city-hyderabad/engine';

export const HERO_ID = 'gb1';
export const IIIT_PLACE_ID = 'pl_iiit';

const DOCS: Record<string, unknown> = {
  gb1: gb1Json,
  gb2: gb2Json,
  gb3: gb3Json,
  gb4: gb4Json,
  gb5: gb5Json,
  gb6: gb6Json,
  gb7: gb7Json,
};

/** True when a golden document exists for this id. */
export const hasSampleDoc = (id: string): boolean => id in DOCS;

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
export const contextIdsFor = (buildingId: string): readonly string[] =>
  HERO_HYDERABAD[buildingId] ?? HERO_LONDON[buildingId] ?? [];

const areaPromises = new Map<string, Promise<CityTile[]>>();
/**
 * Tiles of one city area by pack id (`Place.cityPackId`), loaded once, lazily. Default areas
 * (central Hyderabad, the London terrace) and on-demand ones (Raidurg and Knowledge City, King's
 * Cross) come from each pack's `CITY_AREAS`; on-demand areas load only when a place there is
 * searched for or picked. Empty on failure: everything still works without context.
 */
export function areaTiles(packId: string | undefined): Promise<CityTile[]> {
  const id = packId ?? 'city-hyderabad';
  let p = areaPromises.get(id);
  if (!p) {
    p = (
      id.startsWith('city-london')
        ? import('@ibasho/pack-city-london/engine').then((m) => m.CITY_AREAS[id]?.loadTiles() ?? [])
        : import('@ibasho/pack-city-hyderabad/engine').then((m) => m.CITY_AREAS[id]?.loadTiles() ?? [])
    ).catch(() => []);
    areaPromises.set(id, p);
  }
  return p;
}

/** Central Hyderabad tiles (the default area). */
export const cityTiles = (): Promise<CityTile[]> => areaTiles('city-hyderabad');

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

/** Climate, code, money and city packs for a plot, from where it is (UK or India for now). */
export function packsFor(lat: number, lon: number): Pick<Place, 'climatePackId' | 'codePackIds' | 'moneyPackIds' | 'cityPackId'> {
  const uk = lat > 49 && lat < 61 && lon > -9 && lon < 2;
  return uk
    ? { climatePackId: 'climate.london', codePackIds: ['codes-uk'], moneyPackIds: ['money-uk'], cityPackId: 'city-london' }
    : { climatePackId: 'climate.hyderabad', codePackIds: ['codes-in'], moneyPackIds: ['money-in'], cityPackId: 'city-hyderabad' };
}
