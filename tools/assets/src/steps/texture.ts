/**
 * Texture step: Poly Haven PNG maps to WebP. Owner: WP-11.
 *
 * KTX2 is preferred by SV 3.11, but `toktx` is not installed (ARCH 13), so textures ship as
 * WebP; three.js uploads them as plain RGBA8. Switch here once toktx exists.
 */
import sharp from 'sharp';
import type { OutFile, StepResult } from './types.ts';

/** `--paper` (Hiru), DS 2.1: #F4EEE3. */
export const PAPER_SRGB = [0xf4, 0xee, 0xe3] as const;
/** DS 10: diffuse is desaturated 15% towards paper. */
export const PAPER_MIX = 0.15;
export const QUALITY = { diff: 80, nor: 80, arm: 75 } as const;

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Mixes each pixel `amount` of the way towards a paper-tinted grey of the same luma. Works on
 * 8-bit sRGB values in place.
 */
export function towardsPaper(rgb: Uint8Array, amount = PAPER_MIX): Uint8Array {
  const [pr, pg, pb] = PAPER_SRGB;
  const pl = luma(pr, pg, pb);
  for (let i = 0; i < rgb.length; i += 3) {
    const y = luma(rgb[i]!, rgb[i + 1]!, rgb[i + 2]!) / pl;
    const t = [pr * y, pg * y, pb * y];
    for (let c = 0; c < 3; c++) {
      const v = rgb[i + c]! * (1 - amount) + Math.min(255, t[c]!) * amount;
      rgb[i + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }
  return rgb;
}

export interface TextureSources {
  readonly diff: Uint8Array;
  readonly nor: Uint8Array;
  readonly arm: Uint8Array;
}

export async function processTexture(dir: string, src: TextureSources, size: number): Promise<StepResult> {
  const files: OutFile[] = [];
  for (const role of ['diff', 'nor', 'arm'] as const) {
    const base = sharp(src[role]).removeAlpha().resize(size, size, { fit: 'fill' });
    const { data, info } = await base.toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
    const px = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (info.channels !== 3) throw new Error(`${dir}/${role}: expected 3 channels, got ${info.channels}`);
    if (role === 'diff') towardsPaper(px);
    const webp = await sharp(px, { raw: { width: info.width, height: info.height, channels: 3 } })
      .webp({ quality: QUALITY[role], smartSubsample: true, effort: 6 })
      .toBuffer();
    files.push({
      rel: `${dir}/${role}.webp`,
      role,
      mime: 'image/webp',
      data: new Uint8Array(webp),
      width: info.width,
      height: info.height,
    });
  }
  return {
    files,
    processing: [
      `Resized to ${size} by ${size} and converted to 8-bit sRGB.`,
      `Diffuse mixed ${PAPER_MIX * 100}% towards a paper-tinted grey (#F4EEE3) of equal luma (DS 10).`,
      `WebP quality ${QUALITY.diff} (diffuse), ${QUALITY.nor} (normal), ${QUALITY.arm} (ARM).`,
    ],
    details: {
      size,
      colorSpace: { diff: 'srgb', nor: 'linear', arm: 'linear' },
      normalConvention: 'OpenGL (+Y), as three.js expects',
      armChannels:
        'R ambient occlusion, G roughness, B metalness (three.js aoMap, roughnessMap, metalnessMap)',
    },
  };
}
