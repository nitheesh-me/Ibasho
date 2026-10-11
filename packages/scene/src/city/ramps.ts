/**
 * v3 analysis ramps (DESIGN_SYSTEM 13.2): Hinata (radiation), Hidamari (sun hours), Akari
 * (daylight), Sora (sky view). Lightness monotone, interpolated in OKLab. Owner: WP-07 (scene
 * copy of the table; WP-06 owns the CSS tokens).
 */
import { type Oklch, oklabToLinear, oklchToOklab } from '@ibasho/ui/tokens';
import { linearToHex } from '../colour/palette.ts';

/**
 * `kage` (shade, scene local until WP-06 registers it): ink to paper, read reversed so more shadow
 * hours is darker (QA M10). `hinode` (sweep build up): gold to paper, read reversed so ground with
 * no sun yet stays paper and fills toward gold (QA M6). Both lightness monotone.
 */
export type CityRampId = 'hinata' | 'hidamari' | 'akari' | 'sora' | 'kage' | 'hinode';

export const CITY_RAMPS: Record<CityRampId, { name: string; stops: readonly Oklch[] }> = {
  hinata: {
    name: 'Hinata',
    stops: [
      [22, 0.035, 255],
      [38, 0.075, 230],
      [56, 0.045, 95],
      [70, 0.135, 55],
      [84, 0.13, 78],
    ],
  },
  hidamari: {
    name: 'Hidamari',
    stops: [
      [20, 0.01, 60],
      [40, 0.015, 62],
      [66, 0.045, 84],
      [82, 0.155, 75],
    ],
  },
  akari: {
    name: 'Akari',
    stops: [
      [18, 0.01, 60],
      [34, 0.05, 215],
      [55, 0.08, 205],
      [78, 0.045, 85],
      [96, 0.035, 86],
    ],
  },
  kage: {
    name: 'Kage',
    stops: [
      [25.5, 0.009, 53],
      [52, 0.014, 60],
      [76, 0.016, 75],
      [95, 0.016, 83],
    ],
  },
  hinode: {
    name: 'Hinode',
    stops: [
      [79, 0.171, 70],
      [87, 0.09, 78],
      [95, 0.016, 83],
    ],
  },
  sora: {
    name: 'Sora',
    stops: [
      [20, 0.01, 60],
      [42, 0.08, 227],
      [64, 0.08, 206],
      [94, 0.016, 83],
    ],
  },
};

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const labs = new Map<CityRampId, (readonly [number, number, number])[]>();

function labOf(id: CityRampId): (readonly [number, number, number])[] {
  let l = labs.get(id);
  if (!l) {
    l = CITY_RAMPS[id].stops.map((s) => oklchToOklab(s));
    labs.set(id, l);
  }
  return l;
}

/** OKLab at t in [0, 1]. */
export function rampLab(id: CityRampId, t: number): [number, number, number] {
  const L = labOf(id);
  const x = clamp01(t) * (L.length - 1);
  const i = Math.min(L.length - 2, Math.floor(x));
  const f = x - i;
  const a = L[i]!;
  const b = L[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Linear sRGB at t, for vertex colours and data textures. */
export function rampLinear(id: CityRampId, t: number): [number, number, number] {
  const [r, g, b] = oklabToLinear(rampLab(id, t));
  return [clamp01(r), clamp01(g), clamp01(b)];
}

export function rampHex(id: CityRampId, t: number): string {
  return linearToHex(rampLinear(id, t));
}

export function rampGradientCss(id: CityRampId, direction = 'to right', steps = 11): string {
  const stops: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    stops.push(`${rampHex(id, t)} ${(t * 100).toFixed(1)}%`);
  }
  return `linear-gradient(${direction}, ${stops.join(', ')})`;
}

/** 256 x 1 RGBA bytes (sRGB encoded) for a shader lookup texture. */
export function rampBytes(id: CityRampId, n = 256): Uint8Array {
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const hex = rampHex(id, i / (n - 1));
    out[i * 4] = Number.parseInt(hex.slice(1, 3), 16);
    out[i * 4 + 1] = Number.parseInt(hex.slice(3, 5), 16);
    out[i * 4 + 2] = Number.parseInt(hex.slice(5, 7), 16);
    out[i * 4 + 3] = 255;
  }
  return out;
}
