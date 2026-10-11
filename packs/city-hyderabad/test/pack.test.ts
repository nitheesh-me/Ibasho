import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cityHyderabad, HERO_CONTEXT_IDS, loadCityTiles, TILE_FILES } from '../src/engine/index.ts';

const fsReader = async (url: string) => new Uint8Array(await readFile(fileURLToPath(url)));

describe('city-hyderabad pack (Y1, Y2)', () => {
  it('loads every tile, every building has a height range and a source', async () => {
    const tiles = await loadCityTiles(fsReader);
    expect(tiles.length).toBe(TILE_FILES.length);
    const all = tiles.flatMap((t) => t.buildings);
    expect(all.length).toBeGreaterThan(500);
    for (const b of all) {
      expect(b.height.lo).toBeLessThanOrEqual(b.height.likely);
      expect(b.height.likely).toBeLessThanOrEqual(b.height.hi);
      expect(b.height.source).toBeTruthy();
      expect(b.sources?.length).toBeGreaterThan(0);
    }
    const ids = new Set(all.map((b) => b.id));
    for (const id of [...(HERO_CONTEXT_IDS['gb1'] ?? []), ...(HERO_CONTEXT_IDS['gb2'] ?? [])])
      expect(ids.has(id)).toBe(true);
    const vindhya = all.find((b) => b.id === 'osm_r2829427');
    expect(vindhya?.holes?.length).toBe(4);
  });

  it('is at most 5 MB and the plugin lists every tile', () => {
    const bytes = TILE_FILES.reduce((s, t) => s + t.bytes, 0);
    expect(bytes).toBeLessThanOrEqual(5_000_000);
    expect(cityHyderabad.tiles).toHaveLength(TILE_FILES.length);
  });
});

describe('on-demand area city-hyderabad-raidurg', () => {
  it('loads only when asked, with the GCC host outlines and names', async () => {
    const { loadRaidurgTiles, CITY_AREAS, cityHyderabadRaidurg } = await import('../src/engine/index.ts');
    expect(CITY_AREAS['city-hyderabad-raidurg']?.onDemand).toBe(true);
    expect(CITY_AREAS['city-hyderabad']?.onDemand).toBe(false);
    const tiles = await loadRaidurgTiles(fsReader);
    const ids = new Set(tiles.flatMap((t) => t.buildings).map((b) => b.id));
    expect(ids.has('osm_w1133460476')).toBe(true);
    expect(ids.has('osm_w1133269186')).toBe(true);
    expect(cityHyderabadRaidurg.tiles.reduce((s, t) => s + t.bytes, 0)).toBeLessThan(100_000);
  });
});
