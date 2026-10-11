/**
 * Inputs for the recorded Preview fixtures: each golden building with its sample place and the
 * city tiles around it (read from the packs with node:zlib). Shared by the generator and tests.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { BuildingDoc, CityTile, Place } from '@ibasho/core';
import { BuildingDocSchema, CityTileSchema, PlaceSchema } from '@ibasho/core/schemas';

export const root = join(import.meta.dirname, '..', '..', '..');
export const PREVIEW_DIR = join(root, 'packages/fixtures/src/preview');
const bdir = join(root, 'packages/fixtures/src/buildings');

export const FIXTURE_BUILDINGS = ['gb1', 'gb2', 'gb3', 'gb4', 'gh1', 'gb5', 'gb6', 'gb7'] as const;
export const AS_OF = '2026-10-11' as const;

function tilesOf(pack: string | undefined): CityTile[] {
  if (!pack) return [];
  const dir =
    pack === 'city-hyderabad-raidurg'
      ? join(root, 'packs/city-hyderabad/src/engine/raidurg/tiles')
      : join(root, 'packs', pack, 'src/engine/tiles');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json.gz'))
    .sort()
    .map((f) => CityTileSchema.parse(JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString())));
}

/** OSM ids each golden building replaces (mirrors the packs' HERO_CONTEXT_IDS). */
export const REPLACED: Readonly<Record<string, string[]>> = {
  gb1: ['osm_r2829427'],
  gb2: ['osm_w187896823', 'osm_w211078709'],
  gb5: ['osm_w1133460476'],
  gb6: ['osm_w1133269186'],
  gb7: ['osm_w852979202'],
};

export function fixtureInputs(id: string): {
  doc: BuildingDoc;
  place: Place;
  tiles: CityTile[];
  replacedIds: string[];
} {
  const doc = BuildingDocSchema.parse(JSON.parse(readFileSync(join(bdir, `${id}.building.json`), 'utf8')));
  const places = (JSON.parse(readFileSync(join(bdir, 'places.json'), 'utf8')) as unknown[]).map((p) =>
    PlaceSchema.parse(p),
  );
  const place = places.find((p) => p.id === doc.placeId);
  if (!place) throw new Error(`no place ${doc.placeId}`);
  return { doc, place, tiles: tilesOf(place.cityPackId), replacedIds: REPLACED[id] ?? [] };
}
