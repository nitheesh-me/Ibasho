/**
 * Andon colour tokens (DESIGN_SYSTEM 2). Owner: WP-06.
 *
 * This file is the source of truth; `scripts/build-tokens.ts` compiles it into
 * `src/styles/tokens.css`. Values are OKLCH triples `[L%, C, h]`. The hex column in
 * DESIGN_SYSTEM 2.1 is kept here as `ref` so the tests can prove the conversion and the table
 * agree.
 */

/** OKLCH as `[lightness in percent, chroma, hue in degrees]`. */
export type Oklch = readonly [l: number, c: number, h: number];

export interface CoreToken {
  /** Dye name (decorative, never UI copy). */
  dye: string;
  hiru: Oklch;
  yoru: Oklch;
  /** sRGB hex from DESIGN_SYSTEM 2.1 (reference only). */
  ref: { hiru: string; yoru: string };
  /** `text` tokens must reach 4.5:1 on paper (F2). `graphic` tokens never carry text on Hiru. */
  use: 'ground' | 'text' | 'graphic' | 'line';
  /** Components allowed to read this token (F5). Absent means any component. */
  only?: readonly string[];
}

/** Components that may read `--seal` (DESIGN_SYSTEM rule 2: proof seals only). */
export const SEAL_CONSUMERS = ['seal'] as const;
/** Components that may read `--gold` and `--gold-ink` (repairs and the one hero action). */
export const GOLD_CONSUMERS = ['mend', 'hero-action'] as const;

export const CORE = {
  paper: {
    dye: 'Kinari washi',
    hiru: [95, 0.016, 83],
    yoru: [18.5, 0.008, 67],
    ref: { hiru: '#F4EEE3', yoru: '#15120F' },
    use: 'ground',
  },
  'paper-raised': {
    dye: 'Shoji',
    hiru: [97.5, 0.01, 85],
    yoru: [22, 0.009, 59],
    ref: { hiru: '#FAF6EF', yoru: '#1E1A16' },
    use: 'ground',
  },
  'paper-sunk': {
    dye: 'Torinoko',
    hiru: [91.5, 0.022, 83],
    yoru: [15, 0.007, 67],
    ref: { hiru: '#EAE2D3', yoru: '#0D0B08' },
    use: 'ground',
  },
  ink: {
    dye: 'Sumi',
    hiru: [25.5, 0.009, 53],
    yoru: [93, 0.033, 84],
    ref: { hiru: '#26221F', yoru: '#F2E7D0' },
    use: 'text',
  },
  'ink-2': {
    dye: 'Aonibi',
    hiru: [41, 0.012, 62],
    yoru: [75.5, 0.028, 80],
    ref: { hiru: '#4F4944', yoru: '#B9AE9C' },
    use: 'text',
  },
  'ink-3': {
    dye: 'Ginnezumi',
    hiru: [50.5, 0.021, 59],
    yoru: [64, 0.024, 72],
    ref: { hiru: '#6E6259', yoru: '#968A7D' },
    use: 'text',
  },
  line: {
    dye: 'Kamenozoki',
    hiru: [81.5, 0.017, 92],
    yoru: [32.5, 0.014, 63],
    ref: { hiru: '#C6C2B6', yoru: '#39332D' },
    use: 'line',
  },
  cold: {
    dye: 'Ai',
    hiru: [36, 0.036, 210],
    yoru: [62, 0.075, 206],
    ref: { hiru: '#254248', yoru: '#49939C' },
    use: 'text',
  },
  deep: {
    dye: 'Hanada',
    hiru: [40, 0.076, 227],
    yoru: [66, 0.086, 224],
    ref: { hiru: '#034F67', yoru: '#519EB9' },
    use: 'text',
  },
  warm: {
    dye: 'Bengara',
    hiru: [45.5, 0.131, 31],
    yoru: [64, 0.15, 33],
    ref: { hiru: '#913325', yoru: '#D7644D' },
    use: 'text',
  },
  ember: {
    dye: 'Kuchiba',
    hiru: [66.5, 0.141, 53],
    yoru: [71, 0.132, 55],
    ref: { hiru: '#D57835', yoru: '#E0894A' },
    use: 'graphic',
  },
  'ember-ink': {
    dye: 'Kuchiba deep',
    hiru: [51, 0.097, 68],
    yoru: [74, 0.12, 60],
    ref: { hiru: '#8A5A1E', yoru: '#E29858' },
    use: 'text',
  },
  glow: {
    dye: 'Yamabuki',
    hiru: [79, 0.171, 70],
    yoru: [82, 0.145, 73],
    ref: { hiru: '#FFA401', yoru: '#FFB547' },
    use: 'graphic',
  },
  good: {
    dye: 'Rokusho',
    hiru: [48, 0.089, 153],
    yoru: [71, 0.076, 151],
    ref: { hiru: '#306C45', yoru: '#7EAF89' },
    use: 'text',
  },
  'good-soft': {
    dye: 'Byakuroku',
    hiru: [76, 0.059, 131],
    yoru: [38, 0.048, 153],
    ref: { hiru: '#A4B992', yoru: '#2E4A36' },
    use: 'graphic',
  },
  seal: {
    dye: 'Shu',
    hiru: [55, 0.199, 33],
    yoru: [66, 0.2, 34],
    ref: { hiru: '#CC2D07', yoru: '#F35532' },
    use: 'text',
    only: SEAL_CONSUMERS,
  },
  gold: {
    dye: 'Kintsugi kin',
    hiru: [67.5, 0.114, 84],
    yoru: [78.5, 0.117, 87],
    ref: { hiru: '#B89039', yoru: '#D9B45A' },
    use: 'graphic',
    only: GOLD_CONSUMERS,
  },
  'gold-ink': {
    dye: 'Kin deep',
    hiru: [52, 0.095, 80],
    yoru: [78.5, 0.117, 87],
    ref: { hiru: '#85621D', yoru: '#D9B45A' },
    use: 'text',
    only: GOLD_CONSUMERS,
  },
} as const satisfies Record<string, CoreToken>;

export type CoreName = keyof typeof CORE;

/**
 * Fuel palette (DESIGN_SYSTEM 2.3). Always paired with a hatch. LPG and biomass are literal
 * colours; their Yoru values are a WP-06 choice (lifted to L 70% so they read on sumi).
 */
export const FUEL = {
  'fuel-elec': { ref: 'deep', hatch: 'diagonal' },
  'fuel-gas': { ref: 'ember', hatch: 'solid' },
  'fuel-oil': { ref: 'ink-2', hatch: 'dots' },
  'fuel-lpg': { hiru: [55, 0.08, 300], yoru: [70, 0.08, 300], hatch: 'cross' },
  'fuel-bio': { hiru: [55, 0.08, 115], yoru: [70, 0.08, 115], hatch: 'wave' },
  'fuel-district': { ref: 'ink-3', hatch: 'horizontal' },
  'fuel-export': { ref: 'glow', hatch: 'dotted-outline' },
} as const satisfies Record<
  string,
  { ref: CoreName; hatch: string } | { hiru: Oklch; yoru: Oklch; hatch: string }
>;

/** Netsu thermal ramp (DESIGN_SYSTEM 2.4): seven stops, lightness strictly increasing. */
export const NETSU: readonly { oklch: Oklch; ref: string; dye: string }[] = [
  { oklch: [20, 0.012, 290], ref: '#16151B', dye: 'Sumi' },
  { oklch: [34, 0.045, 215], ref: '#183E46', dye: 'Ai' },
  { oklch: [46, 0.13, 31], ref: '#933527', dye: 'Bengara' },
  { oklch: [57, 0.15, 40], ref: '#BE5128', dye: 'Beni-kaba' },
  { oklch: [67, 0.14, 53], ref: '#D77A38', dye: 'Kuchiba' },
  { oklch: [79, 0.17, 70], ref: '#FEA408', dye: 'Yamabuki' },
  { oklch: [96, 0.035, 86], ref: '#FCF1D8', dye: 'Hot paper' },
];

/**
 * Semantic tokens (DESIGN_SYSTEM 2.2). Each maps to a core token by name. Components read
 * semantic tokens wherever one exists.
 */
export const SEMANTIC: Record<string, CoreName> = {
  surface: 'paper',
  'surface-raised': 'paper-raised',
  'surface-sunk': 'paper-sunk',
  text: 'ink',
  'text-2': 'ink-2',
  'text-3': 'ink-3',
  rule: 'line',
  focus: 'deep',
  link: 'deep',
  'delta-saving': 'good',
  'delta-increase': 'warm',
  'state-known': 'ink',
  'state-estimated': 'ink-2',
  'state-unknown': 'ink-2',
  warning: 'ember-ink',
};

/** `oklch(L% C h)` with trailing zeros trimmed. */
export function oklchCss([l, c, h]: Oklch, alpha?: number): string {
  const a = alpha === undefined ? '' : ` / ${trim(alpha)}`;
  return `oklch(${trim(l)}% ${trim(c, 3)} ${trim(h)}${a})`;
}

function trim(x: number, digits = 2): string {
  return Number(x.toFixed(digits)).toString();
}
