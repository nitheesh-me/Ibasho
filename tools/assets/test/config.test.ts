import { describe, expect, it } from 'vitest';
import { ALL_SPECS, assetId, HDRIS, kebab, TEXTURES } from '../src/config.ts';

describe('asset config', () => {
  it('names the BUILD_PLAN WP-11 hero HDRIs and textures', () => {
    expect(HDRIS.map((h) => h.phId).sort()).toEqual(
      ['kloofendal_overcast_puresky', 'qwantani_dusk_2', 'qwantani_late_afternoon', 'qwantani_noon'].sort(),
    );
    expect(TEXTURES.map((t) => t.phId).sort()).toEqual([
      'pavement_02',
      'red_brick_03',
      'roof_slates_02',
      'white_stucco',
    ]);
  });

  it('gives every spec a unique kebab-case id', () => {
    const ids = ALL_SPECS.map(assetId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('kebab-cases camel and snake case', () => {
    expect(kebab('kitchenCabinetUpper')).toBe('kitchen-cabinet-upper');
    expect(kebab('qwantani_dusk_2')).toBe('qwantani-dusk-2');
  });

  it('gives every model a positive real-world fit', () => {
    for (const s of ALL_SPECS) if (s.kind === 'model') expect(s.fit.metres).toBeGreaterThan(0);
  });
});
