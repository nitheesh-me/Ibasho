/**
 * Scene colours from the Andon tokens (DESIGN_SYSTEM 2). Owner: WP-07.
 * The scene never invents hues: everything is a token, the Netsu ramp, or a material texture.
 */
import {
  CORE,
  type CoreName,
  NETSU,
  type Oklch,
  oklabToLinear,
  oklchToHex,
  oklchToOklab,
} from '@ibasho/ui/tokens';

export type Theme = 'hiru' | 'yoru';

export function token(name: CoreName, theme: Theme): string {
  return oklchToHex(CORE[name][theme] as Oklch);
}

/** Linear sRGB (0 to 1) of a token, for shader uniforms. */
export function tokenLinear(name: CoreName, theme: Theme): [number, number, number] {
  const [r, g, b] = oklabToLinear(oklchToOklab(CORE[name][theme] as Oklch));
  return [clamp01(r), clamp01(g), clamp01(b)];
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Temperatures the ramp spans in the scene (degrees C). The legend prints these. */
export const NETSU_RANGE = { lo: 6, hi: 22 } as const;

const NETSU_LAB = NETSU.map((s) => oklchToOklab(s.oklch));

/** Netsu colour at t in [0, 1], interpolated in OKLab (DESIGN_SYSTEM 2.4), as linear sRGB. */
export function netsuLinear(t: number): [number, number, number] {
  const x = clamp01(t) * (NETSU_LAB.length - 1);
  const i = Math.min(NETSU_LAB.length - 2, Math.floor(x));
  const f = x - i;
  const a = NETSU_LAB[i]!;
  const b = NETSU_LAB[i + 1]!;
  const lab = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f] as const;
  const [r, g, bl] = oklabToLinear(lab);
  return [clamp01(r), clamp01(g), clamp01(bl)];
}

/** OKLab lightness of the ramp at t (strictly increasing, greyscale safe). */
export function netsuLightness(t: number): number {
  const x = clamp01(t) * (NETSU_LAB.length - 1);
  const i = Math.min(NETSU_LAB.length - 2, Math.floor(x));
  const f = x - i;
  return NETSU_LAB[i]![0] + (NETSU_LAB[i + 1]![0] - NETSU_LAB[i]![0]) * f;
}

export function tempToT(c: number, range: { lo: number; hi: number } = NETSU_RANGE): number {
  return clamp01((c - range.lo) / (range.hi - range.lo));
}

export function linearToHex([r, g, b]: readonly [number, number, number]): string {
  const enc = (c: number): number => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(clamp01(v) * 255);
  };
  return `#${[r, g, b].map((c) => enc(c).toString(16).padStart(2, '0')).join('')}`;
}

export function netsuHex(t: number): string {
  return linearToHex(netsuLinear(t));
}

/** CSS gradient for legends, sampled from the same ramp the shaders use. */
export function netsuGradientCss(direction = 'to right', steps = 13): string {
  const stops: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    stops.push(`${netsuHex(t)} ${(t * 100).toFixed(1)}%`);
  }
  return `linear-gradient(${direction}, ${stops.join(', ')})`;
}

/** Material palette for the house per theme. Hex strings (sRGB). */
export interface ScenePalette {
  background: string;
  ground: string;
  plinth: string;
  plinthEdge: string;
  ink: string;
  line: string;
  interiorWall: string;
  floorBoards: string;
  ceiling: string;
  sectionCut: string;
  timber: string;
  frame: string;
  glass: string;
  slate: string;
  brick: string;
  quilt: string;
  windowGlow: string;
  warm: string;
  cold: string;
  gold: string;
}

export function palette(theme: Theme): ScenePalette {
  const t = (n: CoreName): string => token(n, theme);
  if (theme === 'hiru') {
    return {
      background: t('paper'),
      ground: t('paper-sunk'),
      plinth: t('paper-raised'),
      plinthEdge: t('line'),
      ink: t('ink'),
      line: t('line'),
      interiorWall: '#efe7da',
      floorBoards: '#c9ab84',
      ceiling: '#f6f0e6',
      sectionCut: t('ink'),
      timber: '#8a6a4a',
      frame: '#f3efe6',
      glass: '#9fb4b8',
      slate: '#5f6468',
      brick: '#a2634a',
      quilt: t('good-soft'),
      windowGlow: t('glow'),
      warm: t('warm'),
      cold: t('cold'),
      gold: t('gold'),
    };
  }
  return {
    background: t('paper'),
    ground: t('paper-sunk'),
    plinth: t('paper-raised'),
    plinthEdge: t('line'),
    ink: t('ink'),
    line: t('line'),
    interiorWall: '#5a4c3e',
    floorBoards: '#4a3a2b',
    ceiling: '#625446',
    sectionCut: '#0b0907',
    timber: '#3a2c20',
    frame: '#8f877a',
    glass: '#2a3436',
    slate: '#2c2f33',
    brick: '#5b3a2e',
    quilt: t('good-soft'),
    windowGlow: t('glow'),
    warm: t('warm'),
    cold: t('cold'),
    gold: t('gold'),
  };
}
