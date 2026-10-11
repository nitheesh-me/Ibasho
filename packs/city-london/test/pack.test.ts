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
