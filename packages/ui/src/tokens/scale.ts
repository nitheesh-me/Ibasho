/**
 * Andon type, space, depth and motion tokens (DESIGN_SYSTEM 3, 4, 5). Owner: WP-06.
 * Compiled into `src/styles/tokens.css` by `scripts/build-tokens.ts`.
 */

/** The three families (DEC TE-8). Fallbacks keep metrics close while webfonts load. */
export const FAMILIES = {
  mincho: {
    family: 'Shippori Mincho B1',
    weights: [500, 700, 800],
    stack: "'Shippori Mincho B1', 'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', Georgia, serif",
    role: 'Display and narrative',
  },
  gothic: {
    family: 'Zen Kaku Gothic New',
    weights: [400, 500, 700],
    stack:
      "'Zen Kaku Gothic New', 'Hiragino Sans', 'Yu Gothic UI', 'Noto Sans JP', system-ui, -apple-system, 'Segoe UI', sans-serif",
    role: 'UI',
  },
  code: {
    family: 'M PLUS 1 Code Variable',
    weights: [400, 500, 600],
    stack:
      "'M PLUS 1 Code Variable', 'M PLUS 1 Code', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
    role: 'Numbers',
  },
} as const;

/** Perfect fourth from 16 px, with one UI half step (DESIGN_SYSTEM 3). */
export const TYPE_SCALE = {
  cap: { px: 12, lh: 1.5 },
  ui: { px: 14, lh: 1.5 },
  body: { px: 16, lh: 1.5 },
  h3: { px: 21, lh: 1.4 },
  h2: { px: 28, lh: 1.3 },
  h1: { px: 38, lh: 1.2 },
  d1: { px: 50, lh: 1.15 },
  d2: { px: 67, lh: 1.1 },
} as const;
/** Mincho body text breathes more than gothic (DESIGN_SYSTEM 3). */
export const LH_BODY_MINCHO = 1.75;

/** Ma scale, quarter-ken Fibonacci in px (DESIGN_SYSTEM 4.1). */
export const MA = [4, 8, 12, 20, 32, 52, 84, 136] as const;
export const KEN = 8;
/** Jo (one tatami, 1:2) by breakpoint, px. */
export const JO = { desktop: 72, tablet: 64, mobile: 48 } as const;

export const RADII = { 'r-0': '0', 'r-1': '2px', 'r-seal': '3px', 'r-mon': '50%' } as const;

/** Depth is layered paper in Hiru and light in Yoru (DESIGN_SYSTEM 4.4). */
export const DEPTH = {
  'kage-1': '0 1px 0 oklch(25% 0.01 53 / 0.08), 0 6px 18px -8px oklch(25% 0.01 53 / 0.18)',
  'kage-2': '0 2px 0 oklch(25% 0.01 53 / 0.08), 0 12px 36px -16px oklch(25% 0.01 53 / 0.18)',
  tomoshibi: 'inset 0 0 0 1px var(--line), 0 0 28px -8px oklch(82% 0.145 73 / 0.25)',
} as const;

/** Motion (DESIGN_SYSTEM 5). Durations in ms; easings as CSS. */
export const MOTION = {
  'ma-pause': { ms: 160 },
  /** Hanko press (`--t-hanko` in DESIGN_SYSTEM 5), then the spring below. */
  't-press': { ms: 90, ease: 'cubic-bezier(0.5, 0, 0.75, 0)', easeName: 'hanko' },
  't-shoji': { ms: 520, ease: 'cubic-bezier(0.25, 1, 0.3, 1)' },
  't-sumi': { ms: 700, ease: 'cubic-bezier(0.1, 0.7, 0.2, 1)' },
  't-ori': { ms: 900, ease: 'cubic-bezier(0.6, 0, 0.2, 1)' },
  't-season': { ms: 1200 },
  breath: { ms: 5000 },
  'stagger-fold': { ms: 120 },
  /** Reduced motion: every motion becomes a cross-fade of at most this length. */
  't-fade': { ms: 150, ease: 'linear' },
} as const;

/**
 * The hanko spring after the press (stiffness 600, damping 30, mass 1) sampled into a CSS
 * `linear()` easing so the seal can settle without a JS animation loop.
 */
export function hankoSpringEasing(samples = 24): { css: string; ms: number } {
  const k = 600;
  const c = 30;
  const w0 = Math.sqrt(k);
  const zeta = c / (2 * w0);
  // Underdamped (zeta about 0.61): x(t) = 1 - e^(-zeta w0 t) (cos wd t + zeta w0 / wd sin wd t)
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  const x = (t: number) =>
    1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  // Settle when the envelope falls under 0.2% of travel.
  const settle = Math.log(500) / (zeta * w0);
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const v = i === samples ? 1 : x((settle * i) / samples);
    pts.push(Number(v.toFixed(4)).toString());
  }
  return { css: `linear(${pts.join(', ')})`, ms: Math.round(settle * 1000) };
}
