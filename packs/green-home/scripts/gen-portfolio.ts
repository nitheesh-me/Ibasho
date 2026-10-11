/**
 * Synthetic UK home portfolio for the Lloyds brief (section 9). Owner: WP-25.
 * Run: `pnpm --filter @ibasho/pack-green-home gen:portfolio` (seed 10001, deterministic).
 *
 * Writes `packages/fixtures/src/portfolio/`: properties, monthly energy usage, retrofit catalogue,
 * emissions factors, retrofit history, sales history, reference labels, splits, the schema, the
 * precomputed assessments and the app bundle. The README there documents every rule below.
 *
 * Generation, in short:
 * 1. Stock: type, age, size, region, fabric and heating drawn from English Housing Survey style
 *    shares (documented in the README), on a seeded xoshiro128** stream from `@ibasho/core`.
 * 2. Hidden truth: each home also gets values the records do not show (fabric U factor, set point,
 *    heating hours, occupants, appliance use, sometimes a different true loft depth or wall). The
 *    Ibasho home physics, run on the hidden truth, is the simulator that makes the meter readings,
 *    the certificate ratings and the reference labels.
 * 3. Meters: 24 months (Oct 2024 to Sep 2026) of grid import and gas, with weather and noise, and
 *    explicit gaps (null) for some homes. 4. Records: an energy certificate from a past date (older
 *    than later retrofits), sales history from a price index, a current value estimate.
 * 5. Labels: improvement potential, feasible retrofits, package savings per fuel and value impact,
 *    all from the simulator on the hidden truth (not available at prediction time).
 * 6. Splits: by customer (70/15/15), so no customer's homes cross splits.
 */
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Band,
  GH_RETROFIT_ORDER,
  type GhControls,
  type GhGlazing,
  type GhHeating,
  type GhLabel,
  type GhProperty,
  type GhPropertyType,
  type GhRegion,
  type GhRetrofitHistoryRow,
  type GhRetrofitId,
  type GhSaleRow,
  type GhSplit,
  type GhUsageRow,
  type GhWall,
  type IsoDate,
  xoshiro128ss,
} from '@ibasho/core';
import { VALUE_TABLE_V1 } from '@ibasho/pack-money-uk/engine';
import { assessProperty } from '../src/engine/assess.ts';
import { applicability } from '../src/engine/catalogue.ts';
import { EMISSION_FACTORS } from '../src/engine/factors.ts';
import { runMonthly } from '../src/engine/model.ts';
import { RETROFIT_CATALOGUE } from '../src/engine/catalogue.ts';
import { type HiddenTruth, peopleOf } from '../src/engine/twin.ts';

export const SEED = 10001;
export const AS_OF = '2026-10-11' as const;
export const N = 500;
const OUT = join(import.meta.dirname, '..', '..', '..', 'packages/fixtures/src/portfolio');
const MONTHS: string[] = [];
for (let k = 0; k < 24; k++) {
  const m = (9 + k) % 12; // 2024-10 first
  const y = 2024 + Math.floor((9 + k) / 12);
  MONTHS.push(`${y}-${String(m + 1).padStart(2, '0')}`);
}

const rng = xoshiro128ss(SEED);
const u = () => rng.nextFloat();
const norm = () => {
  // Box-Muller (generator only; the engine half never draws random numbers).
  const a = Math.max(1e-12, u());
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u());
};
const pickW = <T>(xs: readonly [T, number][]): T => {
  const t = xs.reduce((s, [, w]) => s + w, 0);
  let r = u() * t;
  for (const [x, w] of xs) {
    r -= w;
    if (r <= 0) return x;
  }
  return (xs[xs.length - 1] as [T, number])[0];
};
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// ---------------------------------------------------------------------------------------------
// Stock shares (README "Generation rules"; EHS 2022-23 style proportions, rounded)

const REGIONS: [GhRegion, number][] = [
  ['London', 0.18],
  ['South East', 0.2],
  ['North West', 0.25],
  ['Yorkshire', 0.2],
  ['Scotland', 0.17],
];
const TYPES: [GhPropertyType, number][] = [
  ['detached', 0.16],
  ['semi-detached', 0.26],
  ['end-terrace', 0.09],
  ['mid-terrace', 0.19],
  ['bungalow', 0.09],
  ['flat', 0.21],
];
const AGES: [[number, number], number][] = [
  [[1870, 1918], 0.2],
  [[1919, 1944], 0.16],
  [[1945, 1964], 0.19],
  [[1965, 1980], 0.2],
  [[1981, 2002], 0.15],
  [[2003, 2022], 0.1],
];
const AREA: Record<GhPropertyType, number> = { detached: 145, 'semi-detached': 92, 'end-terrace': 84, 'mid-terrace': 80, bungalow: 76, flat: 58 };
/** Price per m², September 2026 (UK HPI regional averages over typical floor areas, rounded). */
const PRICE_M2: Record<GhRegion, number> = { London: 7000, 'South East': 4600, 'North West': 2700, Yorkshire: 2600, Scotland: 2700 };
const TYPE_PRICE: Record<GhPropertyType, number> = { detached: 1.15, 'semi-detached': 1, 'end-terrace': 0.94, 'mid-terrace': 0.92, bungalow: 1.05, flat: 0.95 };
/** UK HPI, average price relative to 2026 (rounded): used to deflate past sales. */
const HPI: Record<number, number> = {
  2000: 0.29, 2002: 0.36, 2004: 0.5, 2006: 0.56, 2008: 0.6, 2010: 0.56, 2012: 0.56, 2014: 0.62, 2016: 0.71, 2018: 0.77, 2020: 0.8, 2022: 0.93, 2024: 0.96, 2026: 1,
};
const hpi = (y: number) => {
  const k = Math.min(2026, Math.max(2000, y - (y % 2)));
  return HPI[k] ?? 1;
};
/** True market premium by band relative to D (central column of the value table), per region. */
const REGION_PREMIUM: Record<GhRegion, number> = { London: 0.6, 'South East': 0.9, 'North West': 1.2, Yorkshire: 1.3, Scotland: 1 };
const rowOf = (b: Band) => (b === 'A' || b === 'B' ? 'AB' : b) as keyof typeof VALUE_TABLE_V1;
const premium = (b: Band, region: GhRegion) => (Number(VALUE_TABLE_V1[rowOf(b)].central) / 100) * REGION_PREMIUM[region];

// ---------------------------------------------------------------------------------------------

interface Row {
  p: GhProperty;
  hidden: HiddenTruth;
  /** Features before past retrofits (for the old certificate). */
  history: GhRetrofitHistoryRow[];
  pre: GhProperty;
}

function makeProperty(i: number, customerId: string, tenure: 'owner' | 'landlord'): Row {
  const id = `P${10000 + i}`;
  const region = pickW(REGIONS);
  let type = pickW(TYPES);
  const [a0, a1] = pickW(AGES);
  const year = a0 + Math.floor(u() * (a1 - a0 + 1));
  if (type === 'bungalow' && year < 1919) type = 'semi-detached';
  const area = Math.round(AREA[type] * Math.exp(0.22 * norm()));
  const storeys = type === 'flat' || type === 'bungalow' ? 1 : type === 'detached' && area > 170 ? 3 : 2;
  const bedrooms = clamp(Math.round(area / 30), 1, 6);
  const flatLevel = type === 'flat' ? pickW<'ground' | 'mid' | 'top'>([['ground', 0.35], ['mid', 0.35], ['top', 0.3]]) : undefined;
  // Walls by age (EHS: about 70% of cavities filled).
  let wall: GhWall;
  if (year < 1930) wall = u() < 0.08 ? 'solid-insulated' : 'solid-uninsulated';
  else if (year < 1996) wall = u() < 0.07 ? 'timber-frame' : u() < 0.68 ? 'cavity-filled' : 'cavity-unfilled';
  else wall = 'cavity-filled';
  const hasLoftHome = type !== 'flat';
  const loft: number | 'no-loft' = !hasLoftHome
    ? 'no-loft'
    : year >= 2003
      ? 270
      : pickW<number>([[0, 0.03], [50, 0.05], [100, 0.24], [150, 0.15], [200, 0.17], [270, 0.36]])
  const floorInsulated = year >= 2000 ? true : u() < 0.05;
  const glazing: GhGlazing = year >= 2003 ? (u() < 0.15 ? 'triple' : 'double') : year < 1919 && u() < 0.25 ? 'single' : pickW<GhGlazing>([['single', 0.05], ['double-old', 0.4], ['double', 0.5], ['triple', 0.05]]);
  const elecHeavy = type === 'flat' ? 0.3 : region === 'Scotland' ? 0.14 : 0.08;
  const heating: GhHeating = pickW<GhHeating>([
    ['gas-boiler-condensing', 0.7],
    ['gas-boiler-old', 0.12],
    ['electric-storage', elecHeavy],
    ['heat-pump', 0.06],
  ]);
  const heatingAgeYears =
    heating === 'gas-boiler-old' ? 15 + Math.floor(u() * 16) : heating === 'gas-boiler-condensing' ? Math.floor(u() * 16) : heating === 'heat-pump' ? Math.floor(u() * 8) : 5 + Math.floor(u() * 30);
  const solarKwp = type !== 'flat' && u() < 0.07 ? pickW<number>([[2, 0.3], [3, 0.4], [4, 0.3]]) : 0;
  const controls: GhControls = pickW<GhControls>([['none', 0.08], ['programmer', 0.32], ['programmer-thermostat', 0.45], ['smart-thermostat', 0.15]]);
  const conservation = year < 1919 ? u() < 0.3 : u() < 0.04;
  const listed = year < 1900 && u() < 0.1;
  const p: GhProperty = {
    propertyId: id,
    customerId,
    propertyType: type,
    yearBuilt: year,
    floorAreaM2: area,
    bedrooms,
    storeys,
    ...(flatLevel ? { flatLevel } : {}),
    energyRating: null,
    sapRating: null,
    epcDate: null,
    heating,
    heatingAgeYears: u() < 0.06 ? null : heatingAgeYears,
    insulation: { loftMm: loft, wall, floorInsulated: u() < 0.05 ? null : floorInsulated },
    glazing: u() < 0.03 ? null : glazing,
    solarKwp,
    smartControls: u() < 0.04 ? null : controls,
    region,
    valueGBP: 0,
    valueAsOf: '2026-09-30',
    constraints: { conservationArea: conservation, listed, flatRoofAccess: type === 'flat' && flatLevel === 'top' && u() < 0.4, tenure },
    split: 'train',
  };
  // Hidden truth (README "Simulator"): behaviour and fabric the records do not show.
  const hidden: HiddenTruth = {
    uFactor: clamp(Math.exp(0.15 * norm()), 0.7, 1.5),
    setpointC: clamp(19 + 1.1 * norm(), 17, 22.5),
    heatingHours: clamp(Math.round(8 + 2.2 * norm()), 4, 14),
    people: clamp(peopleOf(bedrooms) * Math.exp(0.25 * norm()), 1, 6),
    applianceFactor: clamp(Math.exp(0.25 * norm()), 0.5, 2),
  };
  // Records are sometimes wrong or missing (README "Data quality").
  if (typeof loft === 'number' && u() < 0.1) {
    hidden.loftMm = loft;
    p.insulation.loftMm = u() < 0.5 ? null : clamp(loft + (u() < 0.5 ? -100 : 100), 0, 300);
  }
  if (wall === 'cavity-unfilled' && u() < 0.12) {
    hidden.wall = 'cavity-filled';
  } else if (u() < 0.04) {
    hidden.wall = wall;
    p.insulation.wall = null;
  }
  // Past retrofits: the record shows today's state; the old certificate saw the earlier one.
  const pre: GhProperty = { ...p, insulation: { ...p.insulation }, constraints: { ...p.constraints } };
  const history: GhRetrofitHistoryRow[] = [];
  const past = (r: GhRetrofitId, revert: () => void) => {
    const y = 2012 + Math.floor(u() * 14);
    history.push({ propertyId: id, retrofit: r, completionDate: `${y}-${String(1 + Math.floor(u() * 12)).padStart(2, '0')}-15` as IsoDate });
    revert();
  };
  if (loft === 270 && u() < 0.5) past('loft', () => (pre.insulation.loftMm = 100));
  if (wall === 'cavity-filled' && year < 1996 && u() < 0.5) past('cavity-wall', () => (pre.insulation.wall = 'cavity-unfilled'));
  if (glazing === 'double' && year < 2003 && u() < 0.4) past('glazing', () => (pre.glazing = 'double-old'));
  if (heating === 'heat-pump' && u() < 0.8) past('heat-pump', () => (pre.heating = 'gas-boiler-old'));
  if (solarKwp > 0) past('solar', () => (pre.solarKwp = 0));
  if (controls === 'smart-thermostat' && u() < 0.5) past('smart-thermostat', () => (pre.smartControls = 'programmer'));
  return { p, hidden, history, pre };
}

// The brief's worked example (section 2): rating E, high use, no solar, poor insulation, gas boiler,
// single glazing, 38/100 Poor.
function exampleP10001(customerId: string): Row {
  const p: GhProperty = {
    propertyId: 'P10001',
    customerId,
    propertyType: 'semi-detached',
    yearBuilt: 1950,
    floorAreaM2: 120,
    bedrooms: 3,
    storeys: 2,
    energyRating: 'E',
    sapRating: 54,
    epcDate: '2019-03-14',
    heating: 'gas-boiler-condensing',
    heatingAgeYears: 14,
    insulation: { loftMm: 200, wall: 'cavity-unfilled', floorInsulated: false },
    glazing: 'single',
    solarKwp: 0,
    smartControls: 'programmer',
    region: 'North West',
    valueGBP: 350000,
    valueAsOf: '2026-09-30',
    constraints: { conservationArea: false, listed: false, flatRoofAccess: false, tenure: 'owner' },
    split: 'train',
  };
  const hidden: HiddenTruth = { uFactor: 1.05, setpointC: 20.5, heatingHours: 10, people: 3, applianceFactor: 1.5 };
  return { p, hidden, history: [], pre: p };
}

// ---------------------------------------------------------------------------------------------

const rows: Row[] = [];
const customers: string[] = [];
let i = 1;
let c = 1;
while (i <= N) {
  const cid = `C${String(c).padStart(4, '0')}`;
  customers.push(cid);
  const landlord = u() < 0.12;
  const k = landlord ? Math.min(N - i + 1, 2 + Math.floor(u() * 3)) : 1;
  for (let j = 0; j < k; j++) {
    rows.push(i === 1 ? exampleP10001(cid) : makeProperty(i, cid, landlord ? 'landlord' : 'owner'));
    i += 1;
  }
  c += 1;
}

// Splits by customer (70/15/15), shuffled with the same seed.
const order = [...customers];
for (let k = order.length - 1; k > 0; k--) {
  const j = rng.int(k + 1);
  [order[k], order[j]] = [order[j] as string, order[k] as string];
}
const splitOf = new Map<string, GhSplit>();
order.forEach((cid, k) => splitOf.set(cid, k < order.length * 0.7 ? 'train' : k < order.length * 0.85 ? 'validation' : 'test'));
for (const r of rows) {
  r.p.split = splitOf.get(r.p.customerId) as GhSplit;
  r.pre.split = r.p.split;
}

// Weather: heating-season severity by region and year (Oct-Sep), as a factor on gas.
const weather: Record<GhRegion, [number, number]> = {
  London: [1.04, 0.97],
  'South East': [1.03, 0.98],
  'North West': [1.05, 0.98],
  Yorkshire: [1.06, 0.99],
  Scotland: [1.02, 1.01],
};

const usage: GhUsageRow[] = [];
const labels: GhLabel[] = [];
const sales: GhSaleRow[] = [];
const historyRows: GhRetrofitHistoryRow[] = [];

for (const r of rows) {
  const { p, hidden } = r;
  historyRows.push(...r.history);
  const truth = { ...p, insulation: { ...p.insulation, ...(hidden.loftMm !== undefined ? { loftMm: hidden.loftMm } : {}), ...(hidden.wall ? { wall: hidden.wall } : {}) } };
  const sim = runMonthly(truth, [], hidden);
  // Energy certificate: from a past date, on the features at that date, with assessor noise.
  if (p.propertyId !== 'P10001') {
    const has = u() < 0.86;
    if (has) {
      const year = 2010 + Math.floor(u() * 16);
      const before = r.history.filter((h) => Number(h.completionDate.slice(0, 4)) > year);
      const state = before.length ? r.pre : p;
      const preTruth = { ...state, insulation: { ...state.insulation, ...(hidden.loftMm !== undefined && !before.some((h) => h.retrofit === 'loft') ? { loftMm: hidden.loftMm } : {}) } };
      const at = runMonthly(preTruth, [], hidden);
      const sap = clamp(Math.round(at.sap + 3 * norm()), 1, 100);
      p.sapRating = u() < 0.15 ? null : sap;
      p.energyRating = bandOfSapLocal(sap);
      p.epcDate = `${year}-${String(1 + Math.floor(u() * 12)).padStart(2, '0')}-10` as IsoDate;
    }
  }
  // Current value: hedonic (region, size, type, true band premium) with noise.
  const trueBand = sim.band;
  if (p.propertyId !== 'P10001')
    p.valueGBP = Math.round((PRICE_M2[p.region] * p.floorAreaM2 * TYPE_PRICE[p.propertyType] * (1 + premium(trueBand, p.region)) * Math.exp(0.12 * norm())) / 1000) * 1000;
  // Meter readings (Oct 2024 to Sep 2026): simulator months x weather x behaviour x noise.
  const gasHome = p.heating === 'gas-boiler-old' || p.heating === 'gas-boiler-condensing';
  const af = hidden.applianceFactor;
  const gapMode = p.propertyId === 'P10001' ? 'none' : pickW<'none' | 'few' | 'many' | 'no-gas-feed'>([['none', 0.86], ['few', 0.08], ['many', 0.03], ['no-gas-feed', gasHome ? 0.03 : 0]]);
  const missing = new Set<number>();
  if (gapMode === 'few') for (let k = 0; k < 1 + Math.floor(u() * 3); k++) missing.add(Math.floor(u() * 24));
  if (gapMode === 'many') for (let k = 12; k < 24; k++) if (u() < 0.55) missing.add(k);
  MONTHS.forEach((m, k) => {
    const cal = Number(m.slice(5, 7)) - 1;
    const yearIdx = k < 12 ? 0 : 1;
    const w = weather[p.region][yearIdx];
    let e = (sim.electricity[cal] as number) * af * Math.exp(0.05 * norm());
    let g = (sim.gas[cal] as number) * w * Math.exp(0.06 * norm());
    if (p.propertyId === 'P10001') {
      // Exact example meters: 4,800 kWh electricity and 19,200 kWh gas a year.
      const GS = [0.155, 0.13, 0.115, 0.08, 0.05, 0.03, 0.025, 0.025, 0.04, 0.075, 0.12, 0.155];
      e = 400;
      g = 19200 * (GS[cal] as number);
    }
    usage.push({
      propertyId: p.propertyId,
      month: m,
      electricityKwh: missing.has(k) ? null : Math.round(e),
      gasKwh: missing.has(k) || (gapMode === 'no-gas-feed' && k >= 12) ? null : gasHome || g > 1 ? Math.round(g) : 0,
    });
  });
  // Sales history from the price index, with the band at sale where certificates existed.
  const nSales = p.propertyId === 'P10001' ? 1 : pickW<number>([[0, 0.3], [1, 0.45], [2, 0.2], [3, 0.05]]);
  const years = new Set<number>();
  for (let k = 0; k < nSales; k++) years.add(2000 + Math.floor(u() * 26));
  for (const y of [...years].sort()) {
    const atBand = y >= 2008 ? trueBand : null;
    sales.push({
      propertyId: p.propertyId,
      date: `${y}-${String(1 + Math.floor(u() * 12)).padStart(2, '0')}-01` as IsoDate,
      priceGBP: Math.round((p.valueGBP * hpi(y) * Math.exp(0.06 * norm())) / 250) * 250,
      energyRatingAtSale: atBand,
    });
  }
  // Reference labels on the hidden truth (README "Labels").
  const feasible = GH_RETROFIT_ORDER.filter((x) => applicability(x, truth).feasible);
  const after = feasible.length ? runMonthly(truth, feasible, hidden) : sim;
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const baseE = sum(sim.electricity) * af;
  const baseG = sum(sim.gas) * (weather[p.region][1] as number);
  // Behaviour scales today's appliance use; the physics change of the package is added unscaled.
  const afterE = baseE - (sum(sim.electricity) - sum(after.electricity));
  const afterG = sum(sim.gas) > 0 ? baseG * (sum(after.gas) / sum(sim.gas)) : sum(after.gas);
  const pot = baseE + baseG > 0 ? Math.round((1000 * (baseE + baseG - afterE - afterG)) / (baseE + baseG)) / 10 : null;
  const valuePct = Math.round(((1 + premium(after.band, p.region)) / (1 + premium(trueBand, p.region)) - 1) * 1000) / 10;
  labels.push({
    propertyId: p.propertyId,
    split: p.split,
    improvementPotentialPct: pot,
    potentialRank: null,
    feasible,
    packageSavingKwh: { electricity: Math.round(baseE - afterE), gas: Math.round(baseG - afterG) },
    valueImpactPct: valuePct,
  });
}

function bandOfSapLocal(sap: number): Band {
  const t: [Band, number][] = [['A', 92], ['B', 81], ['C', 69], ['D', 55], ['E', 39], ['F', 21]];
  for (const [b, min] of t) if (sap >= min) return b;
  return 'G';
}

// Ranks within each split by reference potential.
for (const s of ['train', 'validation', 'test'] as const) {
  const xs = labels.filter((l) => l.split === s && l.improvementPotentialPct !== null).sort((a, b) => (b.improvementPotentialPct as number) - (a.improvementPotentialPct as number));
  xs.forEach((l, k) => (l.potentialRank = k + 1));
}

// Assessments (the model's outputs, from recorded data only).
const usageBy = new Map<string, GhUsageRow[]>();
for (const r of usage) {
  const l = usageBy.get(r.propertyId) ?? [];
  l.push(r);
  usageBy.set(r.propertyId, l);
}
const assessments = rows.map((r) => assessProperty(r.p, usageBy.get(r.p.propertyId) ?? [], { asOf: AS_OF }));

// ---------------------------------------------------------------------------------------------
// Write

mkdirSync(OUT, { recursive: true });
const write = (name: string, text: string) => {
  const p = join(OUT, name);
  writeFileSync(`${p}.tmp`, text);
  renameSync(`${p}.tmp`, p);
};
const json = (x: unknown) => `${JSON.stringify(x, null, 1)}\n`;
const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = <T extends object>(xs: readonly T[], cols: (keyof T | [string, (x: T) => unknown])[]) =>
  `${[cols.map((c) => (Array.isArray(c) ? c[0] : String(c))).join(','), ...xs.map((x) => cols.map((c) => csvCell(Array.isArray(c) ? c[1](x) : x[c as keyof T])).join(','))].join('\n')}\n`;

const props = rows.map((r) => r.p);
write('properties.json', json(props));
write(
  'properties.csv',
  csv(props, [
    'propertyId', 'customerId', 'propertyType', 'yearBuilt', 'floorAreaM2', 'bedrooms', 'storeys', ['flatLevel', (x) => x.flatLevel],
    'energyRating', 'sapRating', 'epcDate', 'heating', 'heatingAgeYears', ['loftMm', (x) => x.insulation.loftMm], ['wall', (x) => x.insulation.wall],
    ['floorInsulated', (x) => x.insulation.floorInsulated], 'glazing', 'solarKwp', 'smartControls', 'region', 'valueGBP', 'valueAsOf',
    ['conservationArea', (x) => x.constraints.conservationArea], ['listed', (x) => x.constraints.listed], ['flatRoofAccess', (x) => x.constraints.flatRoofAccess], ['tenure', (x) => x.constraints.tenure], 'split',
  ]),
);
write('energy_usage.csv', csv(usage, ['propertyId', 'month', 'electricityKwh', 'gasKwh']));
write('energy_usage.json', json(usage));
write('retrofit_catalogue.json', json(RETROFIT_CATALOGUE));
write('retrofit_catalogue.csv', csv(RETROFIT_CATALOGUE, ['id', 'name', 'applicability', ['costLoGBP', (x) => x.costGBP.lo], ['costHiGBP', (x) => x.costGBP.hi], 'typicalImpact', ['sources', (x) => x.sources.map((s) => s.title).join('; ')]]));
write('emission_factors.json', json(EMISSION_FACTORS));
write('emission_factors.csv', csv(EMISSION_FACTORS, ['fuel', 'kgCo2ePerKwh', 'source', 'url', 'year']));
write('retrofit_history.csv', csv(historyRows, ['propertyId', 'retrofit', 'completionDate']));
write('retrofit_history.json', json(historyRows));
write('sales_history.csv', csv(sales, ['propertyId', 'date', 'priceGBP', 'energyRatingAtSale']));
write('sales_history.json', json(sales));
write('labels.json', json(labels));
write(
  'labels.csv',
  csv(labels, ['propertyId', 'split', 'improvementPotentialPct', 'potentialRank', ['feasible', (x) => x.feasible.join(' ')], ['packageSavingElecKwh', (x) => x.packageSavingKwh?.electricity], ['packageSavingGasKwh', (x) => x.packageSavingKwh?.gas], 'valueImpactPct']),
);
write('splits.json', json({ seed: SEED, method: 'by customer, 70/15/15', train: props.filter((p) => p.split === 'train').map((p) => p.propertyId), validation: props.filter((p) => p.split === 'validation').map((p) => p.propertyId), test: props.filter((p) => p.split === 'test').map((p) => p.propertyId) }));
write('assessments.json', json(assessments));
// Compact bundle for the app: properties, meter rows by home and the precomputed assessments.
const compactUsage: Record<string, { from: string; e: (number | null)[]; g: (number | null)[] }> = {};
for (const [id, rs] of usageBy) compactUsage[id] = { from: MONTHS[0] as string, e: rs.map((x) => x.electricityKwh), g: rs.map((x) => x.gasKwh) };
write('bundle.json', `${JSON.stringify({ asOf: AS_OF, seed: SEED, properties: props, usage: compactUsage, assessments })}\n`);

// Summary for the README.
const intens = assessments.filter((a) => a.annualised.intensityKwhM2 !== null).map((a) => a.annualised.intensityKwhM2 as number).sort((a, b) => a - b);
const med = (xs: number[]) => xs[Math.floor(xs.length / 2)] ?? 0;
const gasMed = med(assessments.filter((a) => (a.annualised.gas.kwh ?? 0) > 1000).map((a) => a.annualised.gas.kwh as number).sort((a, b) => a - b));
const elMed = med(assessments.filter((a) => a.annualised.electricity.kwh !== null).map((a) => a.annualised.electricity.kwh as number).sort((a, b) => a - b));
const bands = assessments.reduce<Record<string, number>>((m, a) => ((m[a.score.band] = (m[a.score.band] ?? 0) + 1), m), {});
const epc = props.reduce<Record<string, number>>((m, p) => ((m[p.energyRating ?? 'none'] = (m[p.energyRating ?? 'none'] ?? 0) + 1), m), {});
console.log(
  JSON.stringify({
    homes: props.length,
    customers: customers.length,
    splits: { train: props.filter((p) => p.split === 'train').length, validation: props.filter((p) => p.split === 'validation').length, test: props.filter((p) => p.split === 'test').length },
    medianGasKwh: gasMed,
    medianElecKwh: elMed,
    medianIntensity: med(intens),
    epc,
    scoreBands: bands,
    potentialUnavailable: assessments.filter((a) => a.potential.status === 'unavailable').length,
    p10001: { score: assessments[0]?.score.score, band: assessments[0]?.score.band },
  }),
);
