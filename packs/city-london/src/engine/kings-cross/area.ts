/**
 * On-demand area `city-london-kings-cross` (WP-17, SPEC 27): King's Cross, London, a 1 km box
 * around 51.5352 N, 0.1250 W, with real plots for designing a new building. Not part of the
 * default view: load these tiles only when the person picks this area. Own frame: x east, y north,
 * integer mm from this area's origin (the place `pl_kings_cross` uses the same origin).
 * Data: OpenStreetMap contributors, ODbL 1.0.
 */
import type { CityPackPlugin, CityTile } from '@ibasho/core';
import { decodeTile, fetchReader, type TileReader } from '../load.ts';
import { EXTENT, ORIGIN, PACK_ID, TILE_FILES, TILE_SIZE } from './tiles.gen.ts';

export const KINGS_CROSS_TILE_FILES = TILE_FILES;

export const cityLondonKingsCross: CityPackPlugin = {
  kind: 'city-pack',
  id: 'city-london-kings-cross',
  version: '0.1.0',
  title: 'city.london.kings-cross.title',
  side: 'both',
  regions: ['GB-ENG'],
  provenance: {
    sources: [
      {
        id: 'osm',
        title: 'OpenStreetMap contributors, ODbL 1.0 (Overpass extract)',
        url: 'https://www.openstreetmap.org/copyright',
        retrieved: '2026-10-11',
      },
    ],
    lastChecked: '2026-10-11',
    grade: 'secondary',
  },
  packId: PACK_ID,
  name: "London: King's Cross (on demand)",
  origin: ORIGIN,
  tileSize: TILE_SIZE,
  extent: EXTENT,
  tiles: TILE_FILES.map(({ tx, ty, url, bytes, sha256 }) => ({ tx, ty, url, bytes, sha256 })),
  sources: [
    {
      id: 'osm',
      title: 'OpenStreetMap contributors, ODbL 1.0',
      url: 'https://www.openstreetmap.org/copyright',
      retrieved: '2026-10-11',
    },
  ],
};

/** Every tile of the area (fetched only when called). */
export async function loadKingsCrossTiles(read: TileReader = fetchReader): Promise<CityTile[]> {
  return Promise.all(TILE_FILES.map(async (f) => decodeTile(await read(f.url))));
}
