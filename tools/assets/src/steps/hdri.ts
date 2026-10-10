/**
 * HDRI step: 1k Radiance to gain map triple plus a preview. Owner: WP-11.
 * See `../gainmap.ts` for the format and why.
 */
import sharp from 'sharp';
import { decodeGain, encodeGain, reconstructionError, toneMapToSdr } from '../gainmap.ts';
import { parseHdr } from '../hdr.ts';
import { formatJson } from '../util.ts';
import { type OutFile, round, type StepResult } from './types.ts';

/** SDR base quality. The gain map is lossless WebP (lossy gain maps cost up to 20% p99 error near the sun). */
export const SDR_QUALITY = 85;
export const PREVIEW_SIZE = { width: 256, height: 128 } as const;

async function rawRgb(webp: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await sharp(webp).removeAlpha().raw().toBuffer());
}

export async function processHdri(dir: string, hdr: Uint8Array): Promise<StepResult> {
  const img = parseHdr(hdr);
  const raw = { raw: { width: img.width, height: img.height, channels: 3 as const } };

  const sdrWebp = new Uint8Array(
    await sharp(toneMapToSdr(img), raw).webp({ quality: SDR_QUALITY, smartSubsample: true, effort: 6 }).toBuffer(),
  );
  const sdr = await rawRgb(sdrWebp);
  const { gain, metadata } = encodeGain(img, sdr);
  const gainWebp = new Uint8Array(await sharp(gain, raw).webp({ lossless: true, effort: 6 }).toBuffer());
  const gainBack = await rawRgb(gainWebp);
  if (gainBack.length !== gain.length || gainBack.some((v, i) => v !== gain[i]))
    throw new Error(`${dir}: lossless gain map did not round trip`);
  const err = reconstructionError(img, decodeGain(sdr, gainBack, metadata, img.width, img.height));

  const preview = new Uint8Array(
    await sharp(sdrWebp).resize(PREVIEW_SIZE.width, PREVIEW_SIZE.height).webp({ quality: 80 }).toBuffer(),
  );
  const metaJson = new TextEncoder().encode(formatJson(metadata, `${dir}/meta.json`));

  let max = 0;
  let sum = 0;
  for (const v of img.data) {
    if (v > max) max = v;
    sum += v;
  }
  const files: OutFile[] = [
    { rel: `${dir}/sdr.webp`, role: 'sdr', mime: 'image/webp', data: sdrWebp, width: img.width, height: img.height },
    { rel: `${dir}/gain.webp`, role: 'gain', mime: 'image/webp', data: gainWebp, width: img.width, height: img.height },
    { rel: `${dir}/meta.json`, role: 'gain-metadata', mime: 'application/json', data: metaJson },
    {
      rel: `${dir}/preview.webp`,
      role: 'preview',
      mime: 'image/webp',
      data: preview,
      width: PREVIEW_SIZE.width,
      height: PREVIEW_SIZE.height,
    },
  ];
  return {
    files,
    processing: [
      'Decoded the 1k Radiance file (three.js RGBELoader convention).',
      `Tone mapped to an sRGB SDR base (extended Reinhard on luminance, white at the 99.5th percentile), WebP quality ${SDR_QUALITY}.`,
      'Gain map computed against the decoded SDR base (Adobe gain map maths, offsets 1/64, gamma 1), lossless WebP.',
      `Preview: SDR base at ${PREVIEW_SIZE.width} by ${PREVIEW_SIZE.height}, WebP quality 80.`,
    ],
    details: {
      width: img.width,
      height: img.height,
      maxRadiance: round(max, 2),
      meanRadiance: round(sum / img.data.length, 4),
      loader: 'gainmap-js GainMapLoader, or drei <Environment files={[sdr, gain, meta]} />',
      reconstruction: {
        medianRelError: round(err.medianRel),
        p99RelError: round(err.p99Rel),
        meanLuminanceRelError: round(err.meanLumRel, 6),
      },
    },
  };
}
