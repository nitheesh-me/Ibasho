/**
 * The brief's Green Home Score (section 2). Owner: WP-25.
 *
 * S = sum of w_k s_k with the fixed weights 1/4, 1/5, 3/20, 3/20, 1/10, 1/10, 1/20 (`GH_COMPONENTS`),
 * each sub-score s_k an integer from 0 to 100 from the documented monotone mapping below (a better
 * state never gives a lower sub-score). The weighted sum is exact (twentieths) and rounded to the
 * nearest integer, halves up, for reporting and the band.
 *
 * Mappings (README "Score mappings" restates them):
 * 1. Energy efficiency: the recorded SAP rating (1 to 100), else the recorded band's midpoint
 *    (A 96, B 86, C 75, D 62, E 47, F 30, G 10); with no certificate, the modelled rating.
 * 2. Consumption intensity: annualised metered purchased energy (grid import plus gas) per m²,
 *    piecewise linear: 50 or less 100, 100 gives 80, 150 gives 60, 250 gives 30, 400 or more 0.
 *    Unavailable meters fall back to the modelled intensity and say so.
 * 3. Insulation: loft 40%, walls 45%, floor 15% (renormalised over the elements the home has).
 *    Loft by depth (0 mm 0, 50 20, 100 45, 150 65, 200 80, 270 or more 100); walls solid
 *    uninsulated 0, cavity unfilled 20, timber frame 70, cavity filled 80, solid insulated 100;
 *    floor uninsulated 0, insulated 100.
 * 4. Heating: electric storage 30, old gas boiler 25, condensing gas boiler 60, heat pump 100;
 *    boilers lose 1 point a year past ten years old, at most 15.
 * 5. Glazing: single 0, old double 55, double 80, triple 100.
 * 6. Renewables: installed solar PV, 25 points per kWp, capped at 100 (4 kWp).
 * 7. Smart energy management: none 0, programmer 25, programmer and thermostat 55, smart 100.
 *
 * Shared inputs, justified: rating (1) and intensity (2) both move when a home is better insulated,
 * but (1) reads the certificate and (2) the meters, as the brief asks; solar raises (6) and lowers
 * metered imports in (2), because it both generates and reduces purchased energy.
 */
import {
  type Band,
  GH_COMPONENTS,
  type GhAnnualised,
  type GhComponent,
  type GhComponentId,
  type GhProperty,
  type GreenHomeScore,
  ghBand,
} from '@ibasho/core';
import { defaultWall, hasLoft } from './twin.ts';

const BAND_MID: Record<Band, number> = { A: 96, B: 86, C: 75, D: 62, E: 47, F: 30, G: 10 };

/** Piecewise linear through (x, y) points, flat outside. */
function pl(x: number, pts: readonly [number, number][]): number {
  const first = pts[0] as [number, number];
  const last = pts[pts.length - 1] as [number, number];
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i] as [number, number];
    const [x0, y0] = pts[i - 1] as [number, number];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

export const INTENSITY_POINTS: readonly [number, number][] = [
  [50, 100],
  [100, 80],
  [150, 60],
  [250, 30],
  [400, 0],
];
export const LOFT_POINTS: readonly [number, number][] = [
  [0, 0],
  [50, 20],
  [100, 45],
  [150, 65],
  [200, 80],
  [270, 100],
];
export const WALL_SUB = {
  'solid-uninsulated': 0,
  'cavity-unfilled': 20,
  'timber-frame': 70,
  'cavity-filled': 80,
  'solid-insulated': 100,
} as const;
export const HEATING_SUB = { 'gas-boiler-old': 25, 'electric-storage': 30, 'gas-boiler-condensing': 60, 'heat-pump': 100 } as const;
export const GLAZING_SUB = { single: 0, 'double-old': 55, double: 80, triple: 100 } as const;
export const CONTROLS_SUB = { none: 0, programmer: 25, 'programmer-thermostat': 55, 'smart-thermostat': 100 } as const;

const LABELS: Record<GhComponentId, string> = {
  'energy-efficiency': 'Energy efficiency',
  'consumption-intensity': 'Energy use per m²',
  insulation: 'Insulation',
  heating: 'Heating system',
  glazing: 'Windows and glazing',
  renewables: 'Renewable energy',
  'smart-controls': 'Smart energy management',
};

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export interface ScoreInputs {
  /** Modelled SAP and intensity, used only when the record or the meters are missing. */
  modelledSap?: number;
  modelledIntensity?: number;
}

export function scoreProperty(p: GhProperty, a: GhAnnualised, m: ScoreInputs = {}): GreenHomeScore {
  const parts: Omit<GhComponent, 'weight' | 'contribution'>[] = [];
  // 1. Energy efficiency
  if (p.sapRating !== null) {
    parts.push({ id: 'energy-efficiency', label: '', subScore: clamp(p.sapRating), input: `SAP ${p.sapRating}${p.energyRating ? ` (${p.energyRating})` : ''} on the certificate`, basis: 'recorded' });
  } else if (p.energyRating) {
    parts.push({ id: 'energy-efficiency', label: '', subScore: BAND_MID[p.energyRating], input: `Rating ${p.energyRating} on the certificate (band midpoint)`, basis: 'recorded' });
  } else {
    const s = m.modelledSap ?? 47;
    parts.push({ id: 'energy-efficiency', label: '', subScore: clamp(s), input: `No certificate: modelled SAP ${Math.round(s)}`, basis: m.modelledSap === undefined ? 'assumed' : 'modelled' });
  }
  // 2. Consumption intensity
  if (a.intensityKwhM2 !== null) {
    parts.push({ id: 'consumption-intensity', label: '', subScore: clamp(pl(a.intensityKwhM2, INTENSITY_POINTS)), input: `${Math.round(a.intensityKwhM2)} kWh per m² a year from meter readings`, basis: 'metered' });
  } else {
    const i = m.modelledIntensity ?? 200;
    parts.push({ id: 'consumption-intensity', label: '', subScore: clamp(pl(i, INTENSITY_POINTS)), input: `Meter readings unavailable: modelled ${Math.round(i)} kWh per m² a year`, basis: m.modelledIntensity === undefined ? 'assumed' : 'modelled' });
  }
  // 3. Insulation
  const pieces: { w: number; s: number; text: string; assumed: boolean }[] = [];
  if (hasLoft(p)) {
    const mm = typeof p.insulation.loftMm === 'number' ? p.insulation.loftMm : null;
    pieces.push({ w: 40, s: pl(mm ?? 100, LOFT_POINTS), text: mm === null ? 'loft depth unknown (100 mm assumed)' : `loft ${mm} mm`, assumed: mm === null });
  }
  const wall = p.insulation.wall ?? defaultWall(p.yearBuilt);
  pieces.push({ w: 45, s: WALL_SUB[wall], text: `walls ${wall.replace('-', ' ')}${p.insulation.wall === null ? ' (assumed from age)' : ''}`, assumed: p.insulation.wall === null });
  if (p.propertyType !== 'flat' || p.flatLevel === 'ground') {
    const ins = p.insulation.floorInsulated;
    pieces.push({ w: 15, s: ins ? 100 : 0, text: ins === null ? 'floor insulation unknown (none assumed)' : ins ? 'floor insulated' : 'floor uninsulated', assumed: ins === null });
  }
  const wsum = pieces.reduce((s, x) => s + x.w, 0);
  parts.push({
    id: 'insulation',
    label: '',
    subScore: clamp(pieces.reduce((s, x) => s + x.w * x.s, 0) / wsum),
    input: pieces.map((x) => x.text).join('; '),
    basis: pieces.some((x) => x.assumed) ? 'assumed' : 'recorded',
  });
  // 4. Heating
  const boiler = p.heating === 'gas-boiler-old' || p.heating === 'gas-boiler-condensing';
  const age = p.heatingAgeYears;
  const penalty = boiler && age !== null ? Math.min(15, Math.max(0, age - 10)) : 0;
  parts.push({
    id: 'heating',
    label: '',
    subScore: clamp(HEATING_SUB[p.heating] - penalty),
    input: `${p.heating.replace(/-/g, ' ')}${age !== null ? `, ${age} years old` : ''}`,
    basis: 'recorded',
  });
  // 5. Glazing
  const g = p.glazing ?? (p.yearBuilt >= 2003 ? 'double' : 'double-old');
  parts.push({ id: 'glazing', label: '', subScore: GLAZING_SUB[g], input: `${g.replace('-', ' ')} glazing${p.glazing === null ? ' (assumed from age)' : ''}`, basis: p.glazing === null ? 'assumed' : 'recorded' });
  // 6. Renewables
  parts.push({ id: 'renewables', label: '', subScore: clamp(p.solarKwp * 25), input: p.solarKwp > 0 ? `${p.solarKwp} kWp solar panels` : 'No renewable generation', basis: 'recorded' });
  // 7. Smart controls
  const c = p.smartControls ?? 'programmer';
  parts.push({ id: 'smart-controls', label: '', subScore: CONTROLS_SUB[c], input: `${c.replace(/-/g, ' ')}${p.smartControls === null ? ' (assumed)' : ''}`, basis: p.smartControls === null ? 'assumed' : 'recorded' });

  let twentieths = 0;
  const components: GhComponent[] = GH_COMPONENTS.map(({ id, weight }) => {
    const part = parts.find((x) => x.id === id) as Omit<GhComponent, 'weight' | 'contribution'>;
    twentieths += (part.subScore * weight.n * 20) / weight.d;
    return { ...part, label: LABELS[id], weight, contribution: Math.round(((part.subScore * weight.n) / weight.d) * 100) / 100 };
  });
  // Exact: twentieths is an integer (every weight is a whole number of twentieths).
  const exact = twentieths / 20;
  const score = Math.floor((twentieths + 10) / 20);
  return { score, exact, band: ghBand(score), components };
}
