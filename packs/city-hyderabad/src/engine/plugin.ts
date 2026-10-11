import type { CityPackPlugin } from '@ibasho/core';
import { EXTENT, ORIGIN, PACK_ID, TILE_FILES, TILE_SIZE } from './tiles.gen.ts';

/**
 * OSM ids of the golden buildings in this pack: hide them from the context layer when the
 * modelled building stands in their place (WP-07), and skip them as blockers of themselves (WP-16).
 */
export const HERO_CONTEXT_IDS: Readonly<Record<string, readonly string[]>> = {
  gb1: ['osm_r2829427'], // Vindhya Bhavan
  gb2: ['osm_w187896823', 'osm_w211078709'], // Himalaya Academic Block, D Block
};

export const cityHyderabad: CityPackPlugin = {
  kind: 'city-pack',
  id: 'city-hyderabad',
  version: '0.1.0',
  title: 'city.hyderabad.title',
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
  name: 'Hyderabad: IIIT campus and Gachibowli',
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
