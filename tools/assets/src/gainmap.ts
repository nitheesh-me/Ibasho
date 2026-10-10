/**
 * Gain map encoding for HDRIs. Owner: WP-11.
 *
 * A 1k Radiance file is about 1.4 MB, so four of them would spend most of the 8 MB hero budget.
 * We ship each HDRI as an 8-bit SDR image plus an 8-bit gain map plus a JSON metadata file, the
 * "separate files" format of `@monogrid/gainmap-js` (Adobe gain map maths, as in Ultra HDR).
 * drei `<Environment files={[sdr, gain, meta]} />` and gainmap-js `GainMapLoader` decode it on
 * the GPU back to linear half float.
 *
 * Decoder (gainmap-js `GainMapDecoderMaterial`, with weightFactor 1 because the loader sets
 * maxDisplayBoost = 2^hdrCapacityMax):
 *
 *   sdrLin  = srgbToLinear(sdr / 255)
 *   r       = (gain / 255) ^ gamma
 *   logBoost = gainMapMin * (1 - r) + gainMapMax * r
 *   hdr     = (sdrLin + offsetSdr) * 2^logBoost - offsetHdr
 *
 * The encoder computes the gain from the SDR image as it decodes after lossy compression, so
 * SDR coding error is folded into the gain map instead of adding to it.
 */
import type { HdrImage } from './hdr.ts';

export type Vec3 = [number, number, number];

/** Metadata JSON read by gainmap-js `GainMapLoader` (field names are its contract). */
export interface GainMapMetadata {
  gainMapMin: Vec3;
  gainMapMax: Vec3;
  gamma: Vec3;
  offsetSdr: Vec3;
  offsetHdr: Vec3;
  hdrCapacityMin: number;
  hdrCapacityMax: number;
}

/** Offset used by Adobe and gainmap-js defaults (1/64). */
export const GAIN_OFFSET = 1 / 64;

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

const toByte = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));

/**
 * Tone maps linear HDR to an 8-bit sRGB SDR image (3 bytes per pixel). Extended Reinhard on
 * luminance with the white point at the 99.5th percentile, hue preserved, channels clipped.
 * The SDR image doubles as the preview and as the fallback when a loader ignores the gain map.
 */
export function toneMapToSdr(img: HdrImage, exposure = 1): Uint8Array {
  const n = img.width * img.height;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = img.data[i * 3]! * exposure;
    const g = img.data[i * 3 + 1]! * exposure;
    const b = img.data[i * 3 + 2]! * exposure;
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const sorted = Float32Array.from(lum).sort();
  const white = Math.max(1, sorted[Math.min(n - 1, Math.floor(n * 0.995))]!);
  const w2 = white * white;
  const out = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const l = lum[i]!;
    const k = l > 0 ? (1 + l / w2) / (1 + l) : 1;
    for (let c = 0; c < 3; c++) {
      const v = img.data[i * 3 + c]! * exposure * k;
      out[i * 3 + c] = toByte(linearToSrgb(Math.min(1, Math.max(0, v))));
    }
  }
  return out;
}

export interface GainEncoding {
  /** Gain map, 3 bytes per pixel, same size as the SDR image. */
  readonly gain: Uint8Array;
  readonly metadata: GainMapMetadata;
}

/**
 * Computes the gain map for `img` against an already decoded SDR image (3 bytes per pixel).
 * Gamma is 1: the gain range of these skies is narrow enough that linear log steps suffice.
 */
export function encodeGain(img: HdrImage, sdr: Uint8Array): GainEncoding {
  const n = img.width * img.height;
  const lut = new Float64Array(256);
  for (let i = 0; i < 256; i++) lut[i] = srgbToLinear(i / 255);
  const logs = new Float32Array(n * 3);
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n * 3; i++) {
    const h = Math.max(0, img.data[i]!);
    const s = lut[sdr[i]!]!;
    const l = Math.log2((h + GAIN_OFFSET) / (s + GAIN_OFFSET));
    logs[i] = l;
    const c = i % 3;
    if (l < min[c]!) min[c] = l;
    if (l > max[c]!) max[c] = l;
  }
  for (let c = 0; c < 3; c++) {
    // A flat channel still needs a non-empty range for the decoder's interpolation.
    if (max[c]! - min[c]! < 1e-6) max[c] = min[c]! + 1e-3;
  }
  const gain = new Uint8Array(n * 3);
  for (let i = 0; i < n * 3; i++) {
    const c = i % 3;
    gain[i] = toByte((logs[i]! - min[c]!) / (max[c]! - min[c]!));
  }
  const capMax = Math.max(1, max[0], max[1], max[2]);
  return {
    gain,
    metadata: {
      gainMapMin: min,
      gainMapMax: max,
      gamma: [1, 1, 1],
      offsetSdr: [GAIN_OFFSET, GAIN_OFFSET, GAIN_OFFSET],
      offsetHdr: [GAIN_OFFSET, GAIN_OFFSET, GAIN_OFFSET],
      hdrCapacityMin: 0,
      hdrCapacityMax: capMax,
    },
  };
}

/** CPU mirror of the gainmap-js decoder (see the header comment). */
export function decodeGain(
  sdr: Uint8Array,
  gain: Uint8Array,
  meta: GainMapMetadata,
  width: number,
  height: number,
): HdrImage {
  const n = width * height;
  const data = new Float32Array(n * 3);
  // GainMapLoader sets maxDisplayBoost = 2^hdrCapacityMax, so the weight is 1 (full HDR).
  const maxDisplayBoost = 2 ** meta.hdrCapacityMax;
  const weight = Math.max(
    0,
    Math.min(
      1,
      (Math.log2(maxDisplayBoost) - meta.hdrCapacityMin) / (meta.hdrCapacityMax - meta.hdrCapacityMin),
    ),
  );
  for (let i = 0; i < n * 3; i++) {
    const c = i % 3;
    const s = srgbToLinear(sdr[i]! / 255);
    const r = (gain[i]! / 255) ** meta.gamma[c]!;
    const lb = meta.gainMapMin[c]! * (1 - r) + meta.gainMapMax[c]! * r;
    data[i] = (s + meta.offsetSdr[c]!) * 2 ** (lb * weight) - meta.offsetHdr[c]!;
  }
  return { width, height, data };
}

export interface ReconstructionError {
  /** Median relative luminance error over all pixels. */
  readonly medianRel: number;
  /** 99th percentile relative luminance error. */
  readonly p99Rel: number;
  /** Relative error of the mean luminance (what drives diffuse IBL). */
  readonly meanLumRel: number;
}

/** Relative luminance error of a reconstruction against its source. */
export function reconstructionError(src: HdrImage, rec: HdrImage): ReconstructionError {
  const n = src.width * src.height;
  const errs = new Float32Array(n);
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    const a = 0.2126 * src.data[i * 3]! + 0.7152 * src.data[i * 3 + 1]! + 0.0722 * src.data[i * 3 + 2]!;
    const b = 0.2126 * rec.data[i * 3]! + 0.7152 * rec.data[i * 3 + 1]! + 0.0722 * rec.data[i * 3 + 2]!;
    sumA += a;
    sumB += b;
    errs[i] = Math.abs(b - a) / Math.max(a, GAIN_OFFSET);
  }
  errs.sort();
  return {
    medianRel: errs[Math.floor(n / 2)]!,
    p99Rel: errs[Math.min(n - 1, Math.floor(n * 0.99))]!,
    meanLumRel: Math.abs(sumB - sumA) / Math.max(sumA, 1e-12),
  };
}
