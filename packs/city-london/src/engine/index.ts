/**
 * City pack `city-london` (ARCH 15.7, WP-17): STUB context around GH1, a terrace street in north
 * London built by `tools/city` from OpenStreetMap (ODbL 1.0). GH1 itself is not placed on a real
 * address. Same API as `city-hyderabad`.
 */
import type { CityTile } from '@ibasho/core';
import { loadKingsCrossTiles } from './kings-cross/area.ts';
import { decodeTile, fetchReader, type TileReader } from './load.ts';
import { TILE_FILES } from './tiles.gen.ts';

export { cityLondonKingsCross, KINGS_CROSS_TILE_FILES, loadKingsCrossTiles } from './kings-cross/area.ts';
export { decodeTile, fetchReader, type TileReader } from './load.ts';
export { cityLondonEngineModule } from './module.ts';
export { cityLondon, HERO_CONTEXT_IDS } from './plugin.ts';
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

/** Areas by city pack id: `city-london` is the GH1 street; King's Cross is on demand (SPEC 27). */
export const CITY_AREAS: Readonly<
  Record<string, { onDemand: boolean; loadTiles: (read?: TileReader) => Promise<CityTile[]> }>
> = {
  'city-london': { onDemand: false, loadTiles: loadCityTiles },
  'city-london-kings-cross': { onDemand: true, loadTiles: loadKingsCrossTiles },
};
