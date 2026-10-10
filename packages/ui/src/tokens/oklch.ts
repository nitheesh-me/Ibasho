/**
 * Colour maths for token checks (F1, F2): OKLCH to sRGB, WCAG contrast, gamut, OKLab distance
 * and colour vision deficiency simulation. Owner: WP-06.
 *
 * Matrices are Ottosson's OKLab (2020) and Machado, Oliveira and Fernandes (2009) at severity 1.0,
 * applied in linear sRGB.
 */
import type { Oklch } from './color.ts';

export type Rgb = readonly [number, number, number];
export type Lab = readonly [number, number, number];

/** OKLCH to OKLab. */
export function oklchToOklab([l, c, h]: Oklch): Lab {
  const rad = (h * Math.PI) / 180;
  return [l / 100, c * Math.cos(rad), c * Math.sin(rad)];
}

/** OKLab to linear sRGB (may fall outside 0..1 when out of gamut). */
export function oklabToLinear([L, a, b]: Lab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Linear sRGB to OKLab. */
export function linearToOklab([r, g, b]: Rgb): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export const oklchToLinear = (c: Oklch): Rgb => oklabToLinear(oklchToOklab(c));

const encode = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const decode = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

/** True when every linear channel is within [0, 1] (with a small tolerance for rounding). */
export function inGamut(c: Oklch, eps = 0.002): boolean {
  return oklchToLinear(c).every((v) => v >= -eps && v <= 1 + eps);
}

/** OKLCH to `#RRGGBB` (clipped to gamut). */
export function oklchToHex(c: Oklch): string {
  return `#${oklchToLinear(c)
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, encode(v))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}

export function hexToLinear(hex: string): Rgb {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`bad hex ${hex}`);
  return [m[1]!, m[2]!, m[3]!].map((x) => decode(Number.parseInt(x, 16) / 255)) as unknown as Rgb;
}

/** WCAG 2 relative luminance of a colour (clipped to gamut). */
export function luminance(c: Oklch): number {
  const [r, g, b] = oklchToLinear(c).map((v) => Math.min(1, Math.max(0, v))) as unknown as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio. */
export function contrast(fg: Oklch, bg: Oklch): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export type Cvd = 'none' | 'protanopia' | 'deuteranopia';

const MACHADO: Record<Exclude<Cvd, 'none'>, readonly Rgb[]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

/** Simulate a colour vision deficiency and return the perceived colour in OKLab. */
export function simulate(c: Oklch, cvd: Cvd): Lab {
  const lin = oklchToLinear(c).map((v) => Math.min(1, Math.max(0, v))) as unknown as Rgb;
  if (cvd === 'none') return linearToOklab(lin);
  const m = MACHADO[cvd];
  const out = m.map((row) => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]);
  return linearToOklab(out.map((v) => Math.min(1, Math.max(0, v))) as unknown as Rgb);
}

/** Euclidean distance in OKLab (Delta E OK). */
export function deltaEOk(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
