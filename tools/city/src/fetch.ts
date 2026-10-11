/**
 * Overpass fetch with a file cache (WP-17, Y3). The cache is committed, so a rebuild needs no
 * network and is byte-identical. Data: OpenStreetMap contributors, ODbL 1.0.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { CityArea } from './areas.ts';

/** Overpass mirrors tried in order (RB 1 used the maps.mail.ru mirror). */
export const OVERPASS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

export function overpassQuery(a: CityArea): string {
  const [s, w, n, e] = a.bbox;
  const bb = `${s},${w},${n},${e}`;
  return `[out:json][timeout:120];(way["building"](${bb});relation["building"](${bb});node["natural"="tree"](${bb}););out body geom;`;
}

export interface OverpassJson {
  elements: OverpassElement[];
}
export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: { type: string; ref: number; role: string; geometry?: { lat: number; lon: number }[] }[];
}

/** Read the cache, or fetch and write it (only when `refresh` or missing). */
export async function fetchArea(a: CityArea, cachePath: string, refresh = false): Promise<OverpassJson> {
  if (!refresh && existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, 'utf8')) as OverpassJson;
  const body = `data=${encodeURIComponent(overpassQuery(a))}`;
  let lastErr: unknown;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'ibasho-tools-city/0.0',
        },
        body,
      });
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      const json = (await res.json()) as OverpassJson;
      // Stable order so the cache and every rebuild are byte-identical.
      json.elements.sort((x, y) => (x.type === y.type ? x.id - y.id : x.type < y.type ? -1 : 1));
      writeFileSync(`${cachePath}.tmp`, `${JSON.stringify({ elements: json.elements })}\n`);
      renameSync(`${cachePath}.tmp`, cachePath);
      return json;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('overpass fetch failed');
}
