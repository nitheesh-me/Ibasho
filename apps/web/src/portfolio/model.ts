/**
 * Green Home Score, poor home flags, improvement potential, retrofits, carbon and value for a home
 * portfolio (Lloyds brief, Megathon X PS2). Owner: WP-08.
 *
 * PLACEHOLDER: a local, documented model so the Homes screens work today. Agent A is building the
 * data side (synthetic UK portfolio P10001 onward and the same calculations); when its interface
 * lands, `analyseHome` and `portfolio()` are replaced by its exports and these types by the core
 * contracts. Every figure is an estimate and is labelled so on screen.
 *
 * Model (all mappings monotone: a better state never gives a lower sub-score):
 * - Score S = sum of w_k s_k with weights 0.25, 0.20, 0.15, 0.15, 0.10, 0.10, 0.05, rounded to an
 *   integer for reporting. Bands: 80 to 100 Highly efficient, 65 to 79 Good, 50 to 64 Moderate,
 *   30 to 49 Poor, 0 to 29 Very poor.
 * - Energy efficiency from the recorded rating only (A 100 to G 10); energy intensity from
 *   annualised metered energy per m2 only (80 kWh/m2 or less scores 100, 300 or more scores 0).
 * - Retrofits run in priority order (fabric, controls, heat pump, solar), each on the state left by
 *   the ones before, so the package total equals the sum of the listed savings (interactions).
 * - Carbon: delta C = sum over fuels of delta E times factor, UK Government GHG conversion factors 2024
 *   (DESNZ): electricity 0.20705, natural gas 0.18290 kg CO2e per kWh.
 * - Value: rating bands gained after the package; indicative uplift 1 to 2.5 percent per band
 *   (an association in the prepared data, not a proven causal effect).
 */

export type Rating = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export const RATINGS: readonly Rating[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
export type Band = 'Highly efficient' | 'Good' | 'Moderate' | 'Poor' | 'Very poor';
export type Heating = 'gas-boiler-old' | 'gas-boiler-condensing' | 'heat-pump' | 'electric-storage';
export type Walls = 'solid-uninsulated' | 'cavity-unfilled' | 'cavity-filled' | 'insulated';
export type Glazing = 'single' | 'partial-double' | 'double' | 'triple';
export type HomeType = 'terraced' | 'semi-detached' | 'detached' | 'flat' | 'bungalow';

export interface HomeRecord {
  id: string;
  type: HomeType;
  built: string;
  region: string;
  floorAreaM2: number;
  bedrooms: number;
  rating: Rating | null;
  heating: Heating;
  walls: Walls;
  loftMm: number;
  glazing: Glazing;
  solarKwp: number;
  smartControls: boolean;
  valueGbp: number;
  /** Annualised from the metered months; null when unavailable (never treated as zero). */
  elecKwh: number | null;
  gasKwh: number | null;
  monthsMetered: number;
}

export interface Component {
  id: 'efficiency' | 'intensity' | 'insulation' | 'heating' | 'glazing' | 'renewables' | 'smart';
  label: string;
  weight: number;
  sub: number;
  contribution: number;
  basis: string;
}

export interface Score {
  score: number;
  band: Band;
  components: Component[];
}

export type Suitability = 'High' | 'Medium' | 'Low';
export interface RetrofitId {
  id: 'loft' | 'walls' | 'glazing' | 'smart' | 'heat-pump' | 'solar';
}
export interface Retrofit {
  id: RetrofitId['id'];
  label: string;
  suitability: Suitability;
  reason: string;
  /** Saving in kWh a year after the retrofits above it; negative means use rises. */
  elecSaving: number;
  gasSaving: number;
  costGbp: [number, number];
}

export interface Analysis {
  home: HomeRecord;
  score: Score;
  poor: boolean;
  issues: string[];
  /** Feasible retrofits in priority order (all of them, chosen or not). */
  feasible: Retrofit[];
  /** The chosen package, rerun in order with interactions. */
  chosen: Retrofit[];
  package: {
    elecSaving: number;
    gasSaving: number;
    total: number;
    /** 100 x (E baseline minus E after) / E baseline; null when baseline is zero or unavailable. */
    potentialPct: number | null;
  } | null;
  carbonKg: number | null;
  scoreAfter: Score | null;
  ratingAfter: Rating | null;
  value: { lo: number; hi: number; pctLo: number; pctHi: number } | null;
}

export const WEIGHTS: Record<Component['id'], number> = {
  efficiency: 0.25,
  intensity: 0.2,
  insulation: 0.15,
  heating: 0.15,
  glazing: 0.1,
  renewables: 0.1,
  smart: 0.05,
};

export const FACTORS = {
  elec: 0.20705,
  gas: 0.1829,
  source: 'UK Government GHG conversion factors 2024 (DESNZ), kg CO2e per kWh',
} as const;

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export function bandOf(score: number): Band {
  return score >= 80
    ? 'Highly efficient'
    : score >= 65
      ? 'Good'
      : score >= 50
        ? 'Moderate'
        : score >= 30
          ? 'Poor'
          : 'Very poor';
}

const RATING_SUB: Record<Rating, number> = { A: 100, B: 85, C: 70, D: 55, E: 40, F: 25, G: 10 };
const HEATING_SUB: Record<Heating, number> = {
  'gas-boiler-old': 45,
  'gas-boiler-condensing': 65,
  'electric-storage': 40,
  'heat-pump': 95,
};
const WALL_SUB: Record<Walls, number> = {
  'solid-uninsulated': 10,
  'cavity-unfilled': 20,
  'cavity-filled': 70,
  insulated: 90,
};
const GLAZING_SUB: Record<Glazing, number> = { single: 20, 'partial-double': 45, double: 75, triple: 95 };
const HEATING_WORDS: Record<Heating, string> = {
  'gas-boiler-old': 'older gas boiler',
  'gas-boiler-condensing': 'condensing gas boiler',
  'electric-storage': 'electric storage heaters',
  'heat-pump': 'heat pump',
};

/** Purchased energy (grid electricity imported plus gas), or null when unavailable. */
export function purchased(h: Pick<HomeRecord, 'elecKwh' | 'gasKwh'>): number | null {
  return h.elecKwh === null || h.gasKwh === null ? null : h.elecKwh + h.gasKwh;
}

export function scoreHome(h: HomeRecord): Score {
  const e = purchased(h);
  const intensity = e === null ? null : e / Math.max(1, h.floorAreaM2);
  const insul = 0.5 * WALL_SUB[h.walls] + 0.5 * clamp((h.loftMm / 270) * 100);
  const parts: Omit<Component, 'weight' | 'contribution'>[] = [
    {
      id: 'efficiency',
      label: 'Energy efficiency',
      sub: h.rating ? RATING_SUB[h.rating] : 40,
      basis: h.rating ? `Recorded rating ${h.rating}` : 'No recorded rating: scored as E until one is known',
    },
    {
      id: 'intensity',
      label: 'Energy use per m²',
      sub: intensity === null ? 50 : clamp((100 * (300 - intensity)) / 220),
      basis:
        intensity === null
          ? 'Meter readings unavailable: scored at the midpoint'
          : `${Math.round(intensity)} kWh per m² a year from ${h.monthsMetered} months of readings`,
    },
    {
      id: 'insulation',
      label: 'Insulation',
      sub: insul,
      basis: `Walls ${h.walls.replace('-', ', ')}; loft ${h.loftMm} mm`,
    },
    { id: 'heating', label: 'Heating system', sub: HEATING_SUB[h.heating], basis: HEATING_WORDS[h.heating] },
    {
      id: 'glazing',
      label: 'Windows and glazing',
      sub: GLAZING_SUB[h.glazing],
      basis: h.glazing.replace('-', ' ') + ' glazing',
    },
    {
      id: 'renewables',
      label: 'Renewable energy',
      sub: clamp((h.solarKwp / 4) * 100),
      basis: h.solarKwp > 0 ? `${h.solarKwp} kWp solar panels` : 'No renewable generation',
    },
    {
      id: 'smart',
      label: 'Smart energy management',
      sub: h.smartControls ? 100 : 0,
      basis: h.smartControls ? 'Smart heating controls' : 'No smart controls',
    },
  ];
  const components = parts.map((p) => {
    const sub = Math.round(p.sub);
    const weight = WEIGHTS[p.id];
    return { ...p, sub, weight, contribution: weight * sub };
  });
  const score = Math.round(components.reduce((s, c) => s + c.contribution, 0));
  return { score, band: bandOf(score), components };
}

export function issuesOf(h: HomeRecord, s: Score): string[] {
  const out: string[] = [];
  const e = purchased(h);
  if (e !== null && e / h.floorAreaM2 > 180) out.push('High energy use per m²');
  if (h.walls === 'solid-uninsulated' || h.walls === 'cavity-unfilled' || h.loftMm < 100)
    out.push('Poor insulation');
  if (h.heating === 'gas-boiler-old' || h.heating === 'electric-storage') out.push('Old heating system');
  if (h.glazing === 'single') out.push('Single glazing');
  if (h.solarKwp === 0) out.push('No renewable generation');
  if (!h.smartControls && s.band !== 'Highly efficient') out.push('No smart controls');
  return out;
}

const SPACE_SHARE = 0.78;

interface State {
  elec: number;
  gas: number;
  /** Space heat delivered by gas (kWh of gas) and by electric storage (kWh of electricity). */
  gasSpace: number;
  elecSpace: number;
  walls: Walls;
  loftMm: number;
  glazing: Glazing;
  heating: Heating;
  solarKwp: number;
  smart: boolean;
}

function feasibleList(h: HomeRecord): Omit<Retrofit, 'elecSaving' | 'gasSaving'>[] {
  const out: Omit<Retrofit, 'elecSaving' | 'gasSaving'>[] = [];
  const flat = h.type === 'flat';
  if (h.loftMm < 200 && !flat)
    out.push({
      id: 'loft',
      label: 'Loft insulation to 270 mm',
      suitability: h.loftMm < 100 ? 'High' : 'Medium',
      reason: `Loft has ${h.loftMm} mm; fabric first cuts the heat every later measure has to supply.`,
      costGbp: [400, 900],
    });
  if (h.walls === 'cavity-unfilled')
    out.push({
      id: 'walls',
      label: 'Cavity wall insulation',
      suitability: 'High',
      reason: 'Unfilled cavity walls lose heat; filling them is quick and low cost.',
      costGbp: [1200, 2500],
    });
  if (h.walls === 'solid-uninsulated')
    out.push({
      id: 'walls',
      label: 'Solid wall insulation',
      suitability: 'Medium',
      reason: 'Solid walls lose the most heat but the work is disruptive and costly.',
      costGbp: [8000, 15000],
    });
  if (h.glazing === 'single' || h.glazing === 'partial-double')
    out.push({
      id: 'glazing',
      label: 'Double glazing',
      suitability: h.glazing === 'single' ? 'High' : 'Low',
      reason:
        h.glazing === 'single'
          ? 'Single glazing loses heat and lets in draughts.'
          : 'Some windows are still single glazed.',
      costGbp: [4000, 9000],
    });
  if (!h.smartControls)
    out.push({
      id: 'smart',
      label: 'Smart thermostat',
      suitability: 'High',
      reason: 'Heats rooms only when needed; cheap and quick.',
      costGbp: [150, 300],
    });
  if (h.heating !== 'heat-pump') {
    const fabricOk =
      (h.walls === 'cavity-filled' || h.walls === 'insulated' || h.walls === 'cavity-unfilled') && !flat;
    out.push({
      id: 'heat-pump',
      label: 'Air source heat pump',
      suitability: flat ? 'Low' : fabricOk ? 'High' : 'Medium',
      reason: flat
        ? 'Possible in a flat but space and noise limits often apply.'
        : 'Replaces the boiler; gas use falls and electricity use rises. Best after insulation.',
      costGbp: [7000, 13000],
    });
  }
  if (h.solarKwp === 0 && !flat)
    out.push({
      id: 'solar',
      label: 'Solar panels (3.5 kWp)',
      suitability: h.type === 'terraced' ? 'Medium' : 'High',
      reason: 'Cuts electricity bought from the grid; it does not change how much energy the home needs.',
      costGbp: [5000, 7500],
    });
  return out;
}

const ORDER: RetrofitId['id'][] = ['loft', 'walls', 'glazing', 'smart', 'heat-pump', 'solar'];

function apply(st: State, id: RetrofitId['id'], h: HomeRecord): State {
  const s = { ...st };
  const space = (k: number) => {
    const dg = s.gasSpace * k;
    const de = s.elecSpace * k;
    s.gasSpace -= dg;
    s.gas -= dg;
    s.elecSpace -= de;
    s.elec -= de;
  };
  switch (id) {
    case 'loft':
      space(h.loftMm < 100 ? 0.16 : 0.1);
      s.loftMm = 270;
      break;
    case 'walls':
      space(s.walls === 'solid-uninsulated' ? 0.25 : 0.2);
      s.walls = 'insulated';
      break;
    case 'glazing':
      space(s.glazing === 'single' ? 0.1 : 0.04);
      s.glazing = 'double';
      break;
    case 'smart':
      space(0.07);
      s.smart = true;
      break;
    case 'heat-pump': {
      // Delivered heat from the boiler (or storage heaters), supplied by a heat pump with SCOP 3.
      const eff = s.heating === 'gas-boiler-old' ? 0.8 : s.heating === 'gas-boiler-condensing' ? 0.9 : 1;
      const gasHeat = s.gas * eff;
      const storageHeat = s.heating === 'electric-storage' ? s.elecSpace : 0;
      s.elec += (gasHeat + storageHeat) / 3 - storageHeat;
      s.gas = 0;
      s.gasSpace = 0;
      s.elecSpace = 0;
      s.heating = 'heat-pump';
      break;
    }
    case 'solar': {
      const gen = 3.5 * 900;
      const cut = Math.min(gen * 0.5, s.elec * 0.35);
      s.elec -= cut;
      s.solarKwp = 3.5;
      break;
    }
  }
  return s;
}

/** Analyse a home with a chosen package (default: every feasible retrofit). The what-if reruns this. */
export function analyseHome(h: HomeRecord, choose?: readonly RetrofitId['id'][]): Analysis {
  const score = scoreHome(h);
  const issues = issuesOf(h, score);
  const list = feasibleList(h).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const base = purchased(h);
  const pick = new Set(choose ?? list.map((r) => r.id));
  if (h.elecKwh === null || h.gasKwh === null) {
    const feasible = list.map((r) => ({ ...r, elecSaving: Number.NaN, gasSaving: Number.NaN }));
    return {
      home: h,
      score,
      poor: score.score < 50,
      issues,
      feasible,
      chosen: feasible.filter((r) => pick.has(r.id)),
      package: null,
      carbonKg: null,
      scoreAfter: null,
      ratingAfter: null,
      value: null,
    };
  }
  const start: State = {
    elec: h.elecKwh,
    gas: h.gasKwh,
    gasSpace: h.heating.startsWith('gas') ? h.gasKwh * SPACE_SHARE : 0,
    elecSpace: h.heating === 'electric-storage' ? h.elecKwh * 0.6 : 0,
    walls: h.walls,
    loftMm: h.loftMm,
    glazing: h.glazing,
    heating: h.heating,
    solarKwp: h.solarKwp,
    smart: h.smartControls,
  };
  // Every feasible item, with the saving it adds after the chosen items above it.
  let st = start;
  const feasible: Retrofit[] = [];
  for (const r of list) {
    const next = apply(st, r.id, h);
    feasible.push({
      ...r,
      elecSaving: Math.round(st.elec - next.elec),
      gasSaving: Math.round(st.gas - next.gas),
    });
    if (pick.has(r.id)) st = next;
  }
  const chosen = feasible.filter((r) => pick.has(r.id));
  // The package is the sum of the listed (rounded) savings, each already net of the ones above it.
  const elecSaving = chosen.reduce((a, r) => a + r.elecSaving, 0);
  const gasSaving = chosen.reduce((a, r) => a + r.gasSaving, 0);
  const total = elecSaving + gasSaving;
  const potentialPct = base && base > 0 ? (100 * total) / base : null;
  const carbonKg = elecSaving * FACTORS.elec + gasSaving * FACTORS.gas;
  const after: HomeRecord = {
    ...h,
    elecKwh: Math.max(0, st.elec),
    gasKwh: Math.max(0, st.gas),
    walls: st.walls,
    loftMm: st.loftMm,
    glazing: st.glazing,
    heating: st.heating,
    solarKwp: st.solarKwp,
    smartControls: st.smart,
  };
  const before = h.rating ?? 'E';
  const gain =
    potentialPct === null ? 0 : potentialPct >= 45 ? 3 : potentialPct >= 30 ? 2 : potentialPct >= 15 ? 1 : 0;
  const ratingAfter = RATINGS[Math.max(0, RATINGS.indexOf(before) - gain)] ?? before;
  const scoreAfter = scoreHome({ ...after, rating: ratingAfter });
  const pctLo = gain * 1;
  const pctHi = gain * 2.5;
  return {
    home: h,
    score,
    poor: score.score < 50,
    issues,
    feasible,
    chosen,
    package: { elecSaving, gasSaving, total, potentialPct },
    carbonKg,
    scoreAfter,
    ratingAfter: chosen.length ? ratingAfter : before,
    value: { lo: h.valueGbp * (1 + pctLo / 100), hi: h.valueGbp * (1 + pctHi / 100), pctLo, pctHi },
  };
}

// ------------------------------------------------------------------------------------------------
// Synthetic portfolio (illustrative; Agent A's dataset replaces it)

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REGIONS = ['London', 'South East', 'North West', 'Yorkshire', 'West Midlands', 'Scotland', 'Wales'];
const TYPES: HomeType[] = ['terraced', 'semi-detached', 'detached', 'flat', 'bungalow'];

let cache: HomeRecord[] | undefined;
export function portfolio(): HomeRecord[] {
  if (cache) return cache;
  const r = prng(10001);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)] as T;
  const homes: HomeRecord[] = [
    {
      id: 'P10001',
      type: 'semi-detached',
      built: '1930 to 1949',
      region: 'North West',
      floorAreaM2: 120,
      bedrooms: 3,
      rating: 'E',
      heating: 'gas-boiler-old',
      walls: 'cavity-unfilled',
      loftMm: 100,
      glazing: 'single',
      solarKwp: 0,
      smartControls: false,
      valueGbp: 350_000,
      elecKwh: 4_800,
      gasKwh: 12_000,
      monthsMetered: 12,
    },
  ];
  for (let i = 2; i <= 40; i++) {
    const type = pick(TYPES);
    const area = Math.round((type === 'flat' ? 55 : type === 'detached' ? 140 : 90) * (0.8 + r() * 0.5));
    const rating = pick(RATINGS.slice(1));
    const heating = pick<Heating>([
      'gas-boiler-old',
      'gas-boiler-condensing',
      'gas-boiler-condensing',
      'electric-storage',
      'heat-pump',
    ]);
    const walls = pick<Walls>(['solid-uninsulated', 'cavity-unfilled', 'cavity-filled', 'insulated']);
    const intensity = 90 + RATINGS.indexOf(rating) * 28 + r() * 40;
    const total = intensity * area;
    const gas = heating.startsWith('gas') ? total * 0.75 : 0;
    const missing = i % 13 === 0;
    homes.push({
      id: `P${10000 + i}`,
      type,
      built: pick([
        'before 1919',
        '1919 to 1944',
        '1945 to 1964',
        '1965 to 1982',
        '1983 to 2002',
        'after 2002',
      ]),
      region: pick(REGIONS),
      floorAreaM2: area,
      bedrooms: Math.max(1, Math.round(area / 35)),
      rating: i % 17 === 0 ? null : rating,
      heating,
      walls,
      loftMm: pick([50, 100, 150, 200, 270]),
      glazing: pick<Glazing>(['single', 'partial-double', 'double', 'double', 'triple']),
      solarKwp: r() < 0.2 ? pick([2.5, 3.5, 4]) : 0,
      smartControls: r() < 0.3,
      valueGbp: Math.round((area * (2_200 + r() * 2_500)) / 1000) * 1000,
      elecKwh: missing ? null : Math.round(total - gas),
      gasKwh: missing ? null : Math.round(gas),
      monthsMetered: missing ? 0 : pick([9, 10, 11, 12, 12, 12]),
    });
  }
  cache = homes;
  return homes;
}
