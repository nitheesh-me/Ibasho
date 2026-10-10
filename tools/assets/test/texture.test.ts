import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { PAPER_SRGB, processTexture, towardsPaper } from '../src/steps/texture.ts';

describe('texture step', () => {
  it('moves a saturated colour 15% towards paper', () => {
    const px = towardsPaper(new Uint8Array([200, 40, 40]));
    expect(px[0]).toBeLessThan(200);
    expect(px[1]).toBeGreaterThan(40);
    // Paper itself is a fixed point.
    expect([...towardsPaper(new Uint8Array(PAPER_SRGB))]).toEqual([...PAPER_SRGB]);
  });

  it('writes three WebP maps at the requested size', async () => {
    const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#a0502f' } })
      .png()
      .toBuffer();
    const src = new Uint8Array(png);
    const r = await processTexture('textures/t', { diff: src, nor: src, arm: src }, 32);
    expect(r.files.map((f) => f.rel)).toEqual([
      'textures/t/diff.webp',
      'textures/t/nor.webp',
      'textures/t/arm.webp',
    ]);
    for (const f of r.files) {
      const meta = await sharp(f.data).metadata();
      expect(meta.format).toBe('webp');
      expect([meta.width, meta.height]).toEqual([32, 32]);
    }
  });
});
