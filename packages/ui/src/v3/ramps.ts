/**
 * Analysis ramps (DESIGN_SYSTEM 13.2). Owner: WP-06.
 *
 * One continuous ramp on screen at a time. Every ramp is lightness monotone (greyscale safe) and is
 * interpolated in OKLab. Stops are the DS 13.2 hex values; `Shiro` is the greyscale alternative.
 * Display only: these colours never feed a number.
 */
import { hexToLinear, linearToOklab, oklabToLinear, type Rgb } from '../tokens/oklch.ts';

export type RampName = 'hinata' | 'hidamari' | 'akari' | 'sora' | 'netsu' | 'kotai' | 'shiro';

export interface RampDef {
  name: RampName;
  /** Plain name shown in legends. */
  label: string;
  /** What it measures, for the legend's first line. */
  quantity: string;
  stops: readonly string[];
  /** Diverging ramps are centred on zero. */
  diverging?: true;
}

export const RAMPS: Record<RampName, RampDef> = {
  hinata: {
    name: 'hinata',
    label: 'Hinata',
    quantity: 'Incident radiation',
    stops: ['#0F1B2B', '#024962', '#7D7556', '#DE8543', '#F9BF60'],
  },
  hidamari: {
    name: 'hidamari',
    label: 'Hidamari',
    quantity: 'Sun hours',
    stops: ['#1A1512', '#4E4640', '#9F9073', '#FEB43A'],
  },
  akari: {
    name: 'akari',
    label: 'Akari',
    quantity: 'Daylight',
    stops: ['#15110D', '#123E48', '#2A7F88', '#C5B697', '#FCF1D8'],
  },
  sora: {
    name: 'sora',
    label: 'Sora',
    quantity: 'Sky view',
    stops: ['#1A1512', '#03556F', '#499AA4', '#F0EADF'],
  },
  netsu: {
    name: 'netsu',
    label: 'Netsu',
    quantity: 'Temperature',
    stops: ['#16151B', '#183E46', '#933527', '#BE5128', '#D77A38', '#FEA408', '#FCF1D8'],
  },
  kotai: {
    name: 'kotai',
    label: 'Kotai',
    quantity: 'Difference',
    stops: ['#306C45', '#A4B992', '#F4EEE3', '#D7644D', '#913325'],
    diverging: true,
  },
  shiro: { name: 'shiro', label: 'Shiro', quantity: 'Greyscale', stops: ['#141414', '#F7F7F7'] },
};

/** Lens id to ramp (core `RampId` names map onto these). */
export const LENS_RAMP: Record<string, RampName> = {
  shadows: 'hidamari',
  'sun-hours': 'hidamari',
  radiation: 'hinata',
  daylight: 'akari',
  glare: 'akari',
  views: 'sora',
  thermal: 'netsu',
  neighbours: 'kotai',
};

const toHex = (c: Rgb): string => {
  const enc = (x: number) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${enc(c[0])}${enc(c[1])}${enc(c[2])}`.toUpperCase();
};

const labCache = new Map<string, readonly [number, number, number]>();
function lab(hex: string) {
  let v = labCache.get(hex);
  if (!v) {
    v = linearToOklab(hexToLinear(hex));
    labCache.set(hex, v);
  }
  return v;
}

/** Colour at `t` in [0, 1] along a ramp, interpolated in OKLab. */
export function rampColor(name: RampName, t: number): string {
  const stops = RAMPS[name].stops;
  const x = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const pos = x * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = lab(stops[i] as string);
  const b = lab(stops[i + 1] as string);
  return toHex(oklabToLinear([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]));
}

/** A CSS linear gradient for legend bars. */
export function rampGradient(name: RampName, dir = 'to right'): string {
  const n = 12;
  const parts: string[] = [];
  for (let i = 0; i <= n; i++) parts.push(`${rampColor(name, i / n)} ${((100 * i) / n).toFixed(1)}%`);
  return `linear-gradient(${dir}, ${parts.join(', ')})`;
}
