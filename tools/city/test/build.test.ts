import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { HYDERABAD } from '../src/areas.ts';
import { buildPack, cleanRing, heightOf } from '../src/build.ts';
import type { OverpassJson } from '../src/fetch.ts';

const root = join(import.meta.dirname, '..', '..', '..');
const n = (v: number) => (v < 0 ? `m${-v}` : `${v}`);

describe('tools/city', () => {
  it('rebuilds the committed Hyderabad tiles byte for byte from the cache (Y3)', () => {
    const cache = JSON.parse(readFileSync(join(root, 'tools/city', HYDERABAD.cache), 'utf8')) as OverpassJson;
    const { tiles } = buildPack(cache, HYDERABAD);
    for (const t of tiles) {
      const file = join(root, HYDERABAD.outDir, `t_${n(t.tx)}_${n(t.ty)}.json.gz`);
      expect(gunzipSync(readFileSync(file)).toString()).toBe(JSON.stringify(t));
    }
  });

  it('heights are ranges with sources, never zero (Y1, R29)', () => {
    expect(heightOf({ height: '21' }, HYDERABAD).h).toEqual({
      lo: 19950,
      likely: 21000,
      hi: 22050,
      source: 'osm-height',
    });
    expect(heightOf({ building: 'university', 'building:levels': '3' }, HYDERABAD).h.likely).toBe(11700);
    const u = heightOf({ building: 'yes' }, HYDERABAD, 100).h;
    expect(u.source).toBe('unknown');
    expect(u.lo).toBeGreaterThan(0);
  });

  it('cleans rings to counter-clockwise without the closing point', () => {
    const r = cleanRing([
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
      [0, 0],
    ]);
    expect(r).toEqual([
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);
  });
});
