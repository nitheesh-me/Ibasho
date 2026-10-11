import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadCityTiles, TILE_FILES } from '../src/engine/index.ts';

const fsReader = async (url: string) => new Uint8Array(await readFile(fileURLToPath(url)));

describe('city-london pack (stub)', () => {
  it('loads every tile with height ranges and sources', async () => {
    const tiles = await loadCityTiles(fsReader);
    expect(tiles.length).toBe(TILE_FILES.length);
    for (const b of tiles.flatMap((t) => t.buildings)) {
      expect(b.height.lo).toBeLessThanOrEqual(b.height.hi);
      expect(b.sources?.length).toBeGreaterThan(0);
    }
  });
});

describe('on-demand area city-london-kings-cross', () => {
  it('loads when asked, light, with tagged heights', async () => {
    const { loadKingsCrossTiles, CITY_AREAS, cityLondonKingsCross } = await import('../src/engine/index.ts');
    expect(CITY_AREAS['city-london-kings-cross']?.onDemand).toBe(true);
    const tiles = await loadKingsCrossTiles(fsReader);
    const all = tiles.flatMap((t) => t.buildings);
    expect(all.length).toBeGreaterThan(300);
    expect(all.filter((b) => b.height.source !== 'unknown').length).toBeGreaterThan(100);
    expect(cityLondonKingsCross.tiles.reduce((s, t) => s + t.bytes, 0)).toBeLessThan(200_000);
  });
});
