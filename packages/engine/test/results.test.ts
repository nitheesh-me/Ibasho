/**
 * The committed GH1 M-0 results fixture matches the engine (WP-02). On a deliberate engine or pack
 * change, regenerate it: `pnpm --filter @ibasho/engine gen:results`.
 */
import { describe, expect, it } from 'vitest';
import committed from '../../../packages/fixtures/src/results/gh1-m0.search.json' with { type: 'json' };
import { buildGh1M0Results } from './results-fixture.ts';

describe('gh1-m0.search.json', () => {
  it('equals a fresh search (no drift)', async () => {
    const { json } = await buildGh1M0Results();
    expect(JSON.parse(json)).toEqual(committed);
  });
});
