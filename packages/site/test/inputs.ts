/**
 * Test inputs: golden buildings as compiled by the Preview geometry stage (wire JSON in
 * `packages/fixtures/src/preview/<id>/geometry.json`), their sample places and the city tiles
 * around them (read from the packs with node:zlib). Tests only; the site source never reads
 * fixtures (ARCH 15.5).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { CityTile, CompiledBuilding, Place, Resolution, SiteContext } from '@ibasho/core';

export const root = join(import.meta.dirname, '..', '..', '..');

export const RESOLUTIONS: Record<'sketch' | 'standard' | 'fine', Resolution> = {
  sketch: { level: 'sketch', grid: 2000, stepMin: 60, skyPatches: 145, contextRadiusM: 150 },
  standard: { level: 'standard', grid: 1000, stepMin: 15, skyPatches: 145, contextRadiusM: 300 },
  fine: { level: 'fine', grid: 500, stepMin: 6, skyPatches: 577, contextRadiusM: 500 },
};

const REPLACED: Readonly<Record<string, string[]>> = {
  gb1: ['osm_r2829427'],
  gb2: ['osm_w187896823', 'osm_w211078709'],
  gb5: ['osm_w1133460476'],
  gb6: ['osm_w1133269186'],
  gb7: ['osm_w852979202'],
};

const tileCache = new Map<string, CityTile[]>();
export function tilesOf(pack: string | undefined): CityTile[] {
  if (!pack) return [];
  const hit = tileCache.get(pack);
  if (hit) return hit;
  const dir =
    pack === 'city-hyderabad-raidurg'
      ? join(root, 'packs/city-hyderabad/src/engine/raidurg/tiles')
      : join(root, 'packs', pack, 'src/engine/tiles');
  const t = readdirSync(dir)
    .filter((f) => f.endsWith('.json.gz'))
    .sort()
    .map((f) => JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString()) as CityTile);
  tileCache.set(pack, t);
  return t;
}

export function places(): Place[] {
  return JSON.parse(
    readFileSync(join(root, 'packages/fixtures/src/buildings/places.json'), 'utf8'),
  ) as Place[];
}

/** A golden building's compiled form and site, as the Preview pipeline sees it. */
export function golden(id: string): { compiled: CompiledBuilding; site: SiteContext } {
  const compiled = JSON.parse(
    readFileSync(join(root, `packages/fixtures/src/preview/${id}/geometry.json`), 'utf8'),
  ) as CompiledBuilding;
  const doc = JSON.parse(
    readFileSync(join(root, `packages/fixtures/src/buildings/${id}.building.json`), 'utf8'),
  ) as {
    placeId: string;
  };
  const place = places().find((p) => p.id === doc.placeId) as Place;
  return {
    compiled,
    site: {
      place,
      tiles: tilesOf(place.cityPackId),
      weatherHash: place.climatePackId,
      ...(REPLACED[id] ? { replacedIds: REPLACED[id] } : {}),
    },
  };
}

/** The Preview's recorded output for a stage (wire JSON, bigints as strings). */
export function previewOf(
  id: string,
  stage: 'sun' | 'radiation' | 'daylight',
): {
  surfaces: {
    id: string;
    irrWhm2: string[] | 'unknown';
    sunHours?: { annual: number };
    svf?: { n: string; d: string };
  }[];
  rooms: { id: string; sda?: { lo: number; hi: number }; ase?: { lo: number; hi: number } }[];
  ledger: { receiver: string; blocker: string; lostWh: string }[];
} {
  return JSON.parse(readFileSync(join(root, `packages/fixtures/src/preview/${id}/${stage}.json`), 'utf8'));
}
