import type { CityPackPlugin } from '@ibasho/core';
import { EXTENT, ORIGIN, PACK_ID, TILE_FILES, TILE_SIZE } from './tiles.gen.ts';

/** GH1 is modelled on a typical terrace; no OSM building stands in for it yet. */
export const HERO_CONTEXT_IDS: Readonly<Record<string, readonly string[]>> = { gh1: [] };

export const cityLondon: CityPackPlugin = {
  kind: 'city-pack',
  id: 'city-london',
  version: '0.1.0',
  title: 'city.london.title',
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
  name: 'London: GH1 terrace street (stub)',
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
