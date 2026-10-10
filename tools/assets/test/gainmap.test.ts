import { describe, expect, it } from 'vitest';
import {
  decodeGain,
  encodeGain,
  linearToSrgb,
  reconstructionError,
  srgbToLinear,
  toneMapToSdr,
} from '../src/gainmap.ts';
import type { HdrImage } from '../src/hdr.ts';

/** A small synthetic sky: soft gradient plus a very bright sun disc. */
function sky(width = 64, height = 32): HdrImage {
  const data = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const j = (y * width + x) * 3;
      const sun = (x - 40) ** 2 + (y - 8) ** 2 < 4 ? 50_000 : 0;
      const base = 0.2 + (1.5 * (height - y)) / height;
      data[j] = base * 0.8 + sun;
      data[j + 1] = base * 0.9 + sun;
      data[j + 2] = base * 1.2 + sun;
    }
  return { width, height, data };
}

describe('gain map', () => {
  it('sRGB transfer functions are inverse', () => {
    for (const c of [0, 0.001, 0.04, 0.2, 0.5, 1]) expect(linearToSrgb(srgbToLinear(c))).toBeCloseTo(c, 10);
  });

  it('tone maps to bytes and keeps order', () => {
    const img = sky();
    const sdr = toneMapToSdr(img);
    expect(sdr.length).toBe(img.width * img.height * 3);
    // Top rows are brighter than bottom rows away from the sun.
    expect(sdr[(1 * img.width + 2) * 3]!).toBeGreaterThan(sdr[(30 * img.width + 2) * 3]!);
  });

  it('reconstructs the HDR (sun included) from an 8-bit SDR and gain map', () => {
    const img = sky();
    const sdr = toneMapToSdr(img);
    const { gain, metadata } = encodeGain(img, sdr);
    expect(metadata.hdrCapacityMax).toBeGreaterThan(10);
    const rec = decodeGain(sdr, gain, metadata, img.width, img.height);
    const err = reconstructionError(img, rec);
    expect(err.medianRel).toBeLessThan(0.02);
    expect(err.p99Rel).toBeLessThan(0.05);
    expect(err.meanLumRel).toBeLessThan(0.01);
  });

  it('handles a flat image (degenerate gain range)', () => {
    const img: HdrImage = { width: 4, height: 4, data: new Float32Array(48).fill(0.25) };
    const sdr = toneMapToSdr(img);
    const { gain, metadata } = encodeGain(img, sdr);
    for (let c = 0; c < 3; c++) expect(metadata.gainMapMax[c]! - metadata.gainMapMin[c]!).toBeGreaterThan(0);
    const err = reconstructionError(img, decodeGain(sdr, gain, metadata, 4, 4));
    expect(err.p99Rel).toBeLessThan(0.01);
  });
});
