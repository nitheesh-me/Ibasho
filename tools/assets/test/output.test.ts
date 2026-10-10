/**
 * Acceptance K1 to K4 on the committed `apps/web/public/assets/` tree. Needs no download cache,
 * so it runs in CI. Regenerate the tree with `pnpm assets` after changing the pipeline.
 */
import { describe, expect, it } from 'vitest';
import { checkAssetsDir } from '../src/check.ts';
import { ALL_SPECS, assetId, HERO_BUDGET_BYTES } from '../src/config.ts';
import { loadLock } from '../src/lock.ts';

describe('served assets (WP-11 K1 to K4)', () => {
  const r = checkAssetsDir();

  it('K1 to K4 hold', () => {
    expect(r.problems).toEqual([]);
  });

  it('K2: hero tier is at most 8 MB', () => {
    expect(r.heroBytes).toBeLessThanOrEqual(HERO_BUDGET_BYTES);
  });

  it('every configured hero spec is in the manifest, ok, with CC0 licence', () => {
    const byId = new Map(r.manifest.assets.map((a) => [a.id, a]));
    for (const s of ALL_SPECS.filter((x) => x.tier === 'hero')) {
      const a = byId.get(assetId(s));
      expect(a, assetId(s)).toBeDefined();
      expect(a!.status).toBe('ok');
      expect(a!.licence).toBe('CC0-1.0');
      expect(a!.files.length).toBeGreaterThan(0);
    }
  });

  it('manifest source hashes match the pinned sources lock', () => {
    const lock = loadLock();
    expect(lock).toBeDefined();
    for (const a of r.manifest.assets) {
      if (a.source.provider === 'ibasho') continue;
      const pinned = lock!.assets[a.id];
      expect(pinned, a.id).toBeDefined();
      for (const f of a.source.files) expect(f.sha256).toBe(pinned!.files[f.role]!.sha256);
    }
  });
});
