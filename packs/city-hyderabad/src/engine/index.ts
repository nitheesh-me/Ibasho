/**
 * City pack `city-hyderabad` (ARCH 15.7, WP-17): IIIT Hyderabad campus and Gachibowli, a 2 km box
 * around 17.4453 N, 78.3490 E, built by `tools/city` from OpenStreetMap (ODbL 1.0).
 *
 * Use: `cityHyderabad` (the `city-pack` plugin), `loadCityTiles()` for every tile, or
 * `loadCityTile(tx, ty)`. Frame: x east, y north, integer mm from the pack origin. Heights are
 * ranges with a source; `unknown` heights are guesses from footprint size, drawn hatched (R29).
 */
import type { CityTile } from '@ibasho/core';
import { decodeTile, fetchReader, type TileReader } from './load.ts';
import { loadRaidurgTiles } from './raidurg/area.ts';
import { TILE_FILES } from './tiles.gen.ts';

export { decodeTile, fetchReader, type TileReader } from './load.ts';
export { cityHyderabadEngineModule } from './module.ts';
export { cityHyderabad, HERO_CONTEXT_IDS } from './plugin.ts';
export { cityHyderabadRaidurg, loadRaidurgTiles, RAIDURG_TILE_FILES } from './raidurg/area.ts';
export { EXTENT, ORIGIN, PACK_ID, TILE_FILES, TILE_SIZE } from './tiles.gen.ts';

/** One tile, or undefined when the pack has no tile there. */
export async function loadCityTile(
  tx: number,
  ty: number,
  read: TileReader = fetchReader,
): Promise<CityTile | undefined> {
  const f = TILE_FILES.find((t) => t.tx === tx && t.ty === ty);
  return f ? decodeTile(await read(f.url)) : undefined;
}

/** Every tile, in south-west to north-east order. */
export async function loadCityTiles(read: TileReader = fetchReader): Promise<CityTile[]> {
  return Promise.all(TILE_FILES.map(async (f) => decodeTile(await read(f.url))));
}

/**
 * Areas by city pack id (`Place.cityPackId`). `city-hyderabad` is the default view;
 * `city-hyderabad-raidurg` is on demand (load it when a place there is searched for or picked).
 */
export const CITY_AREAS: Readonly<
  Record<string, { onDemand: boolean; loadTiles: (read?: TileReader) => Promise<CityTile[]> }>
> = {
  'city-hyderabad': { onDemand: false, loadTiles: loadCityTiles },
  'city-hyderabad-raidurg': { onDemand: true, loadTiles: loadRaidurgTiles },
};
