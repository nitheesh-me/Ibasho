import { describe, expect, it } from 'vitest';
import { type HdrImage, parseHdr, toRgbe, writeHdr } from '../src/hdr.ts';

function gradient(width: number, height: number): HdrImage {
  const data = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const j = (y * width + x) * 3;
      // Flat runs on the left half (exercise RLE runs), varied values on the right (literals).
      const v = x < width / 2 ? 0.5 : 0.01 * (x + 1) * (y + 1);
      data[j] = v;
      data[j + 1] = v * 2;
      data[j + 2] = x === width - 1 ? 5000 : v / 3;
    }
  return { width, height, data };
}

describe('Radiance RGBE', () => {
  it('encodes like Radiance float2rgbe', () => {
    expect(toRgbe(0, 0, 0)).toEqual([0, 0, 0, 0]);
    // 1.0 = 0.5 * 2^1: mantissa 128, exponent 129.
    expect(toRgbe(1, 0.5, 0.25)).toEqual([128, 64, 32, 129]);
  });

  for (const rle of [true, false]) {
    it(`round trips ${rle ? 'RLE' : 'flat'} scanlines within RGBE precision`, () => {
      const src = gradient(40, 6);
      const back = parseHdr(writeHdr(src, rle));
      expect(back.width).toBe(40);
      expect(back.height).toBe(6);
      for (let i = 0; i < src.data.length; i++) {
        const peak = Math.max(src.data[i - (i % 3)]!, src.data[i - (i % 3) + 1]!, src.data[i - (i % 3) + 2]!);
        // One RGBE step is peak / 128 at worst.
        expect(Math.abs(back.data[i]! - src.data[i]!)).toBeLessThanOrEqual(peak / 128 + 1e-9);
      }
    });
  }

  it('RLE output is smaller than flat for runs', () => {
    const src = gradient(64, 4);
    expect(writeHdr(src, true).length).toBeLessThan(writeHdr(src, false).length);
  });

  it('rejects malformed input', () => {
    expect(() => parseHdr(new TextEncoder().encode('P6\n'))).toThrow(/signature/);
    expect(() => parseHdr(new TextEncoder().encode('#?RADIANCE\n\n+Y 2 +X 2\n'))).toThrow(/resolution/);
    const ok = writeHdr(gradient(16, 2));
    expect(() => parseHdr(ok.subarray(0, ok.length - 10))).toThrow(/truncated/);
  });
});
