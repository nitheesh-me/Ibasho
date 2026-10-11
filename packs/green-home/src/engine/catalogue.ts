/**
 * Retrofit catalogue (brief section 4): applicability, cost and typical impact, with sources.
 * Owner: WP-25. Our catalogue takes precedence over the brief's illustrative impacts; the impact a
 * home actually gets always comes from the physics run on that home, never from this table.
 *
 * Costs: the money-uk cost models (BP 6.1, Energy Saving Trust, Which?, DESNZ PV and heat pump
 * data, 2025/26 prices, 0% VAT on energy-saving materials to March 2027), scaled by the home's own
 * areas; cavity fill from the Energy Saving Trust cavity wall guide. lo and hi are 80% and 130% of
 * the central model where the source gives only a central figure.
 */
import type { GhProperty, GhRetrofit, GhRetrofitId, HomeTwin } from '@ibasho/core';
import { UK_MEASURE_COSTS } from '@ibasho/pack-money-uk/engine';
import { optionFor } from './model.ts';
import { defaultWall, hasLoft } from './twin.ts';

const S = {
  bp61: { id: 'bp-6-1', title: 'Ibasho Building Physics brief 6.1, UK retrofit measure catalogue' },
  est: { id: 'est', title: 'Energy Saving Trust home insulation and heating guides', url: 'https://energysavingtrust.org.uk' },
  rdsap: { id: 'rdsap-10', title: 'RdSAP 10 specification (BRE, 2025), fabric U-values', url: 'https://bregroup.com/documents/d/bre-group/rdsap-10-specification-10-06-2025' },
  desnzHp: { id: 'desnz-bus', title: 'Boiler Upgrade Scheme statistics (DESNZ), heat pump installed costs', url: 'https://www.gov.uk/government/statistics/boiler-upgrade-scheme-statistics' },
  desnzPv: { id: 'desnz-pv', title: 'Solar PV cost data (DESNZ)', url: 'https://www.gov.uk/government/statistics/solar-pv-cost-data' },
} as const;

export const RETROFIT_CATALOGUE: readonly GhRetrofit[] = [
  {
    id: 'loft',
    name: 'Loft insulation top-up to 270 mm',
    measureId: 'loft',
    optionId: 'loft-270',
    applicability: 'House or bungalow with an accessible loft and less than 200 mm of insulation (or depth unknown).',
    costGBP: { lo: 400, hi: 1200 },
    typicalImpact: 'Cuts space-heating demand; the most from an empty loft (illustrative 12 to 18%).',
    sources: [S.bp61, S.est, S.rdsap],
  },
  {
    id: 'cavity-wall',
    name: 'Cavity wall insulation',
    measureId: 'cavity-fill',
    optionId: 'cavity-fill',
    applicability: 'Cavity walls recorded as unfilled (or unknown on a 1930 to 1995 home, after a borescope check).',
    costGBP: { lo: 1100, hi: 2700 },
    typicalImpact: 'Wall U-value from about 1.5 to 0.55 W/m²K; large cut in space heating.',
    sources: [S.est, S.rdsap],
  },
  {
    id: 'solid-wall',
    name: 'Solid wall insulation (external, or internal in a conservation area)',
    measureId: 'wall-ewi',
    optionId: 'wall-ewi-100',
    applicability: 'Uninsulated solid walls; internal insulation where the outside cannot change.',
    costGBP: { lo: 8000, hi: 22000 },
    typicalImpact: 'Wall U-value from about 1.7 to 0.3 W/m²K; disruptive and costly.',
    sources: [S.bp61, S.est],
  },
  {
    id: 'floor',
    name: 'Suspended timber floor insulation',
    measureId: 'floor',
    optionId: 'floor-suspended-insulation',
    applicability: 'Ground floor of suspended timber (homes before 1930), not yet insulated.',
    costGBP: { lo: 1500, hi: 3500 },
    typicalImpact: 'Cuts floor heat loss and draughts.',
    sources: [S.bp61],
  },
  {
    id: 'glazing',
    name: 'Double glazing (secondary glazing where listed or in a conservation area)',
    measureId: 'glazing-double',
    optionId: 'glazing-double-a',
    applicability: 'Single glazing, or old double glazing (low benefit).',
    costGBP: { lo: 4000, hi: 12000 },
    typicalImpact: 'Cuts space-heating demand (illustrative 8 to 12% from single glazing).',
    sources: [S.bp61, S.est],
  },
  {
    id: 'smart-thermostat',
    name: 'Smart heating controls (smart thermostat with TRVs)',
    measureId: 'controls',
    optionId: 'controls-trv-weather-comp',
    applicability: 'Wet heating (boiler or heat pump) without smart controls.',
    costGBP: { lo: 250, hi: 700 },
    typicalImpact: 'Heats only when and where needed (illustrative 5 to 10% of heating energy).',
    sources: [S.bp61],
  },
  {
    id: 'heat-pump',
    name: 'Air source heat pump',
    measureId: 'ashp',
    optionId: 'heat-ashp',
    applicability: 'Any home not already on a heat pump with outdoor space for the unit; best after insulation.',
    costGBP: { lo: 8000, hi: 14000 },
    typicalImpact: 'Gas use falls to the hob; electricity rises (illustrative 15 to 25% less purchased energy).',
    sources: [S.bp61, S.desnzHp],
  },
  {
    id: 'solar',
    name: 'Solar panels (2 to 3 kWp)',
    measureId: 'pv',
    optionId: 'pv-3kwp',
    applicability: 'Own roof facing east, south or west without existing panels; flats only with roof access.',
    costGBP: { lo: 4500, hi: 8000 },
    typicalImpact: 'Cuts grid imports, not the home’s demand (illustrative 20 to 35% of imports).',
    sources: [S.desnzPv],
  },
];

export const catalogueOf = (id: GhRetrofitId): GhRetrofit => RETROFIT_CATALOGUE.find((r) => r.id === id) as GhRetrofit;

/** Cost range for this home from the money-uk models (whole pounds), else the catalogue range. */
export function costFor(r: GhRetrofitId, p: GhProperty, twin: HomeTwin): { lo: number; hi: number } {
  const [, option] = optionFor(r, p);
  const plugin = UK_MEASURE_COSTS.find((c) => c.optionId === option);
  if (!plugin) return catalogueOf(r).costGBP;
  const c = plugin.cost(twin, '2026-10-11');
  const pounds = (mp: bigint) => Math.round(Number(mp / 1_000_000n) / 100);
  return { lo: pounds(c.lo), hi: pounds(c.hi) };
}

export interface Applicability {
  feasible: boolean;
  suitability: 'High' | 'Medium' | 'Low';
  reason: string;
}

/** Feasibility and a first suitability from the home's recorded features (refined by the physics). */
export function applicability(r: GhRetrofitId, p: GhProperty): Applicability {
  const flat = p.propertyType === 'flat';
  const sensitive = p.constraints.conservationArea || p.constraints.listed;
  const wall = p.insulation.wall;
  const no = (reason: string): Applicability => ({ feasible: false, suitability: 'Low', reason });
  switch (r) {
    case 'loft': {
      if (!hasLoft(p)) return no(flat ? 'A flat has no loft of its own.' : 'No accessible loft is recorded.');
      const mm = p.insulation.loftMm;
      if (typeof mm === 'number' && mm >= 200) return no(`The loft already has ${mm} mm of insulation.`);
      if (mm === null) return { feasible: true, suitability: 'Medium', reason: 'Loft depth is not recorded; a quick check will confirm the top-up.' };
      return {
        feasible: true,
        suitability: typeof mm === 'number' && mm <= 100 ? 'High' : 'Medium',
        reason: `The loft has ${mm} mm; topping up to 270 mm is cheap, quick, and cuts the heat every later measure has to supply.`,
      };
    }
    case 'cavity-wall': {
      const age = p.yearBuilt >= 1930 && p.yearBuilt < 1996;
      if (wall === 'cavity-unfilled')
        return { feasible: true, suitability: 'High', reason: 'Unfilled cavity walls lose a lot of heat; filling them is quick and low cost.' };
      if (wall === null && age)
        return { feasible: true, suitability: 'Medium', reason: 'Wall type is not recorded; homes of this age usually have cavities that may be unfilled.' };
      return no(wall === 'cavity-filled' ? 'The cavity is already filled.' : 'The walls are not cavity walls.');
    }
    case 'solid-wall': {
      if ((wall ?? defaultWall(p.yearBuilt)) !== 'solid-uninsulated') return no('The walls are not uninsulated solid walls.');
      if (p.constraints.listed) return { feasible: true, suitability: 'Low', reason: 'Listed building: internal insulation only with consent and a moisture check.' };
      return {
        feasible: true,
        suitability: 'Medium',
        reason: sensitive
          ? 'Solid walls lose the most heat; in a conservation area insulation goes inside. Disruptive and costly.'
          : 'Solid walls lose the most heat; the work is disruptive and costly.',
      };
    }
    case 'floor': {
      const grounded = !flat || p.flatLevel === 'ground';
      if (!grounded) return no('The flat has no ground floor.');
      if (p.insulation.floorInsulated) return no('The floor is already insulated.');
      if (p.yearBuilt >= 1930) return no('A solid floor needs digging out; not a practical retrofit.');
      return { feasible: true, suitability: 'Medium', reason: 'Suspended timber floors leak heat and draughts; insulation goes between the joists.' };
    }
    case 'glazing': {
      const g = p.glazing ?? (p.yearBuilt >= 2003 ? 'double' : 'double-old');
      if (g === 'double' || g === 'triple') return no('Windows are already modern double or triple glazing.');
      if (g === 'single')
        return {
          feasible: true,
          suitability: p.constraints.listed ? 'Medium' : 'High',
          reason: p.constraints.listed
            ? 'Single glazing in a listed home: secondary glazing keeps the original windows.'
            : 'Single glazing loses heat and lets in draughts.',
        };
      return { feasible: true, suitability: 'Low', reason: 'Old double glazing: replacing it saves a little for a high cost.' };
    }
    case 'smart-thermostat': {
      if (p.heating === 'electric-storage') return no('Storage heaters have no wet heating system for smart room controls.');
      if (p.smartControls === 'smart-thermostat') return no('Smart controls are already installed.');
      return {
        feasible: true,
        suitability: p.smartControls === 'programmer-thermostat' ? 'Medium' : 'High',
        reason: 'Heats rooms only when needed; cheap and quick, and it helps a later heat pump run efficiently.',
      };
    }
    case 'heat-pump': {
      if (p.heating === 'heat-pump') return no('A heat pump is already installed.');
      if (flat && p.flatLevel !== 'ground') return { feasible: true, suitability: 'Low', reason: 'Possible in a flat, but space for the outdoor unit, noise and the freeholder’s consent often limit it.' };
      if (p.constraints.listed) return { feasible: true, suitability: 'Low', reason: 'Listed building: the outdoor unit needs consent.' };
      return { feasible: true, suitability: 'Medium', reason: 'Replaces the boiler or heaters; gas use falls and electricity use rises. Best after insulation.' };
    }
    case 'solar': {
      if (p.solarKwp > 0) return no('Solar panels are already installed.');
      if (flat && !(p.flatLevel === 'top' && p.constraints.flatRoofAccess)) return no('A flat without roof access cannot host its own panels.');
      if (p.constraints.listed) return { feasible: true, suitability: 'Low', reason: 'Listed building: panels need consent.' };
      return {
        feasible: true,
        suitability: p.constraints.conservationArea || p.propertyType === 'mid-terrace' ? 'Medium' : 'High',
        reason: 'Cuts electricity bought from the grid; it does not change how much energy the home needs.',
      };
    }
  }
}
