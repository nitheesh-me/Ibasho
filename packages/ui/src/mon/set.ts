/**
 * Mon 紋: kamon style crests for measures and fuels (DESIGN_SYSTEM 7). Owner: WP-06.
 *
 * Construction (DS 7, checked by `test/mon.test.ts`):
 * - 24 unit grid; the outer circle r = 11 at (12, 12) is drawn by `Mon`, not stored here;
 * - path data uses only `M`, `L`, `H`, `V`, `A` and `Z` (no Beziers); circles are `circle`s;
 * - every motif stays inside the outer circle.
 * Rotational motifs (tomoe, fan blades, rays) are computed once here from angles.
 */

export interface MonCircle {
  cx: number;
  cy: number;
  r: number;
  fill?: boolean;
}
export interface MonPath {
  d: string;
  fill?: boolean;
}
export interface MonDef {
  /** English name, used as the accessible title when the mon stands alone. */
  title: string;
  paths: MonPath[];
  circles?: MonCircle[];
}

const f = (x: number): string => (Math.round(x * 100) / 100).toString();
const polar = (r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [12 + r * Math.cos(a), 12 + r * Math.sin(a)];
};

/** Straight rays between two radii at evenly spaced angles. */
function rays(n: number, r0: number, r1: number, offset = 0): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const deg = offset + (360 * i) / n;
    const [x0, y0] = polar(r0, deg);
    const [x1, y1] = polar(r1, deg);
    d += `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`;
  }
  return d;
}

/**
 * Comma shapes in rotation: each one an arc from near the centre sweeping out to the rim and a
 * tighter arc back, so the set reads as tomoe or fan blades.
 */
function whirl(n: number, rOut: number, bulge: number, offset = 0): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const deg = offset + (360 * i) / n;
    const [sx, sy] = polar(1.4, deg);
    const [ex, ey] = polar(rOut, deg + 70);
    const [bx, by] = polar(rOut - 2.2, deg + 18);
    d += `M${f(sx)} ${f(sy)}A${f(bulge)} ${f(bulge)} 0 0 1 ${f(ex)} ${f(ey)}A${f(rOut - 1)} ${f(rOut - 1)} 0 0 0 ${f(bx)} ${f(by)}A${f(bulge * 0.7)} ${f(bulge * 0.7)} 0 0 0 ${f(sx)} ${f(sy)}Z`;
  }
  return d;
}

const flame = 'M12 5.2A7.4 7.4 0 0 1 16.6 14.6A4.7 4.7 0 0 1 7.4 14.6A7.4 7.4 0 0 1 12 5.2Z';

export const MONS = {
  // Measures (DS 7)
  loft: {
    title: 'Loft insulation',
    paths: [
      { d: 'M5.5 10.5L12 5.2L18.5 10.5' },
      {
        d: 'M7.6 13.6A5.2 5.2 0 0 1 16.4 13.6M8.7 16.1A4 4 0 0 1 15.3 16.1M9.8 18.6A2.9 2.9 0 0 1 14.2 18.6',
      },
    ],
  },
  wall: {
    title: 'Solid wall insulation',
    paths: [{ d: 'M6.8 6.8H17.2V17.2H6.8ZM9.6 9.6H14.4V14.4H9.6Z' }],
  },
  cavity: {
    title: 'Cavity wall fill',
    paths: [{ d: 'M6.8 6.8H17.2V17.2H6.8Z' }, { d: 'M10.9 6.8H13.1V17.2H10.9Z', fill: true }],
  },
  floor: {
    title: 'Floor insulation',
    paths: [{ d: 'M5.2 9.5H18.8M8 12.4V17.4M12 12.4V18.4M16 12.4V17.4' }],
  },
  glazing: {
    title: 'Glazing',
    paths: [{ d: 'M7 7H17V17H7ZM12 7V17M7 12H17' }],
  },
  draught: {
    title: 'Draught-proofing',
    paths: [
      { d: 'M12 6.2A5.8 5.8 0 1 1 6.2 12A2.9 2.9 0 0 1 12 12A2.9 2.9 0 0 0 17.8 12' },
      { d: 'M4.6 16.4L19.4 7.6' },
    ],
  },
  controls: {
    title: 'Heating controls',
    paths: [{ d: 'M12 12L16.4 7.6' }],
    circles: [
      { cx: 12, cy: 12, r: 6.2 },
      { cx: 12, cy: 12, r: 1.1, fill: true },
    ],
  },
  'heat-pump': {
    title: 'Heat pump',
    paths: [{ d: whirl(3, 8.6, 6.4), fill: true }],
  },
  cylinder: {
    title: 'Hot water cylinder',
    paths: [{ d: 'M9 5.4H15V18.6H9ZM9 9.4H15M9 12.4H15M9 15.4H15' }],
  },
  induction: {
    title: 'Induction hob',
    paths: [],
    circles: [
      { cx: 12, cy: 12, r: 2.2 },
      { cx: 12, cy: 12, r: 4.6 },
      { cx: 12, cy: 12, r: 7.1 },
    ],
  },
  'gas-disconnect': {
    title: 'Induction hob and gas disconnect',
    paths: [{ d: flame }, { d: 'M5.4 17.4L18.6 6.6' }],
  },
  junction: {
    title: 'Thermal bridge junction',
    paths: [{ d: 'M8.4 5.8V15.6H18.2' }],
  },
  radiators: {
    title: 'Bigger radiators',
    paths: [{ d: 'M7.2 8V16M9.6 7.2V16.8M12 6.8V17.2M14.4 7.2V16.8M16.8 8V16' }],
  },
  pv: {
    title: 'Solar panels',
    paths: [{ d: rays(8, 5.4, 8.4) }],
    circles: [{ cx: 12, cy: 12, r: 3.4 }],
  },
  'solar-thermal': {
    title: 'Solar water heating',
    paths: [{ d: 'M7.4 10.6A4.6 4.6 0 0 1 16.6 10.6Z' }, { d: 'M6.4 13.6H17.6M7.4 16H16.6M8.8 18.4H15.2' }],
  },
  battery: {
    title: 'Home battery',
    paths: [{ d: 'M5.8 8.2H16.8V15.8H5.8ZM11.3 8.2V15.8M16.8 10.4H18.4V13.6H16.8' }],
  },
  mvhr: {
    title: 'Ventilation with heat recovery',
    paths: [{ d: 'M5.8 9.6H17.4M14.8 7L17.4 9.6L14.8 12.2M18.2 14.4H6.6M9.2 11.8L6.6 14.4L9.2 17' }],
  },
  'cool-roof': {
    title: 'Cool roof',
    paths: [{ d: 'M5.4 16.4L12 11.2L18.6 16.4M12 9V4.8M8.6 9.6L7 6.4M15.4 9.6L17 6.4' }],
  },
  shading: {
    title: 'Shading',
    paths: [{ d: 'M6.8 11A5.2 5.2 0 0 1 17.2 11Z' }, { d: 'M6.6 13.6H17.4M7.6 15.8H16.4M9 18H15' }],
  },
  fan: {
    title: 'Ceiling fan',
    paths: [{ d: whirl(3, 8.4, 9.6, 30) }],
    circles: [{ cx: 12, cy: 12, r: 1.2, fill: true }],
  },
  // Fuels (DS 2.3)
  'fuel-electricity': {
    title: 'Electricity',
    paths: [{ d: 'M13.4 4.8L8.2 13.2H11.8L10.6 19.2L15.8 10.8H12.2Z' }],
  },
  'fuel-gas': { title: 'Gas', paths: [{ d: flame }] },
  'fuel-oil': { title: 'Oil', paths: [{ d: 'M12 5L16.4 12.8A5 5 0 1 1 7.6 12.8Z' }] },
  'fuel-lpg': {
    title: 'LPG',
    paths: [{ d: 'M12 7.6L14.6 12.4A3 3 0 1 1 9.4 12.4Z' }],
    circles: [{ cx: 12, cy: 12.4, r: 7.4 }],
  },
  'fuel-biomass': {
    title: 'Biomass',
    paths: [{ d: 'M6.8 17.2A10 10 0 0 1 17.2 6.8A10 10 0 0 1 6.8 17.2ZM6.8 17.2L13.2 10.8' }],
  },
  'fuel-district': {
    title: 'Heat network',
    paths: [],
    circles: [
      { cx: 12, cy: 8.6, r: 3.2 },
      { cx: 9, cy: 13.8, r: 3.2 },
      { cx: 15, cy: 13.8, r: 3.2 },
    ],
  },
  'fuel-export': {
    title: 'Solar export',
    paths: [{ d: rays(8, 5.6, 8.4, 22.5) }],
    circles: [{ cx: 12, cy: 12, r: 3.6, fill: true }],
  },
} as const satisfies Record<string, MonDef>;

export type MonId = keyof typeof MONS;

/** Measure ids from the home packs (SPEC 9) to their crest. `ui` cannot import packs (L2). */
export const MEASURE_MON: Record<string, MonId> = {
  loft: 'loft',
  'wall-ewi': 'wall',
  'wall-iwi': 'wall',
  'wall-cavity': 'cavity',
  floor: 'floor',
  draught: 'draught',
  'glazing-secondary': 'glazing',
  'glazing-double': 'glazing',
  controls: 'controls',
  mvhr: 'mvhr',
  ashp: 'heat-pump',
  pv: 'pv',
  battery: 'battery',
  'cylinder-jacket': 'cylinder',
  cylinder: 'cylinder',
  'solar-thermal': 'solar-thermal',
  'hob-induction': 'gas-disconnect',
  radiators: 'radiators',
  'cool-roof': 'cool-roof',
  shading: 'shading',
  fan: 'fan',
};

export const isMonId = (id: string): id is MonId => Object.hasOwn(MONS, id);

/** The crest for a measure id or a mon id, if any. */
export function monFor(id: string): MonId | undefined {
  if (isMonId(id)) return id;
  return MEASURE_MON[id];
}
