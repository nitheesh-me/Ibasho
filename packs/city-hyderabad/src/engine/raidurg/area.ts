/**
 * On-demand area `city-hyderabad-raidurg` (WP-17, owner request): Raidurg and Knowledge City in
 * HITEC City, a 1 km box around 17.4300 N, 78.3795 E, with KRC Commerzone Raidurg (Qualcomm's
 * Hyderabad campus) and Sattva Knowledge Park (Vanguard's Global Value Center). Not part of the
 * default view: load these tiles only when someone searches for or picks a place in this area.
 * Own frame: x east, y north, integer mm from this area's origin (the place `pl_knowledge_city`
 * uses the same origin). Data: OpenStreetMap contributors, ODbL 1.0.
 */
import type { CityPackPlugin, CityTile } from '@ibasho/core';
import { decodeTile, fetchReader, type TileReader } from '../load.ts';
import { EXTENT, ORIGIN, PACK_ID, TILE_FILES, TILE_SIZE } from './tiles.gen.ts';

export const RAIDURG_TILE_FILES = TILE_FILES;

export const cityHyderabadRaidurg: CityPackPlugin = {
  kind: 'city-pack',
  id: 'city-hyderabad-raidurg',
  version: '0.1.0',
  title: 'city.hyderabad.raidurg.title',
  side: 'both',
  regions: ['IN-TG'],
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
  name: 'Hyderabad: Raidurg and Knowledge City (on demand)',
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
export async function loadRaidurgTiles(read: TileReader = fetchReader): Promise<CityTile[]> {
  return Promise.all(TILE_FILES.map(async (f) => decodeTile(await read(f.url))));
}
