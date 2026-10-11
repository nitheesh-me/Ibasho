/**
 * One property, end to end (brief sections 2 to 7): score, poor-home flag, improvement potential,
 * feasible prioritised retrofits with per-fuel savings, the package recomputed whole, carbon and an
 * indicative value range. A what-if is the same call with a chosen retrofit list: every figure is
 * rerun through the physics, never edited. Owner: WP-25.
 *
 * Calibration: the physics gives each fuel's purchased energy before and after; savings are applied
 * to the home's own metered baseline as ratios (after_f = metered_f x modelled_after_f /
 * modelled_base_f), so a home that uses more than its features suggest saves proportionally more.
 * Without enough meter readings the savings stay in modelled terms and the improvement potential
 * is reported as unavailable.
 *
 * Interaction order: retrofits run in `GH_RETROFIT_ORDER` (fabric, then controls, then heat pump,
 * then solar). Each listed saving is what that retrofit adds after the chosen ones above it, so the
 * list sums exactly to the package, and the package itself is one whole-house run.
 */
import {
  type Band,
  GH_RETROFIT_ORDER,
  type GhAssessment,
  type GhFuelEnergy,
  type GhProperty,
  type GhRecommendation,
  type GhRetrofitId,
  type GhUsageRow,
  type GhValueImpact,
  type GreenHomeScore,
  type ImprovementPotential,
  type IsoDate,
  type PoorHomeFlag,
  Q,
} from '@ibasho/core';
import { bandOfSap, valueUkOwnerOccupierV1 } from '@ibasho/pack-money-uk/engine';
import { annualise } from './annualise.ts';
import { applicability, catalogueOf, costFor } from './catalogue.ts';
import { carbonKg, EMISSION_FACTORS } from './factors.ts';
import { runProperty } from './model.ts';
import { scoreProperty } from './score.ts';
import { buildTwin } from './twin.ts';

export interface AssessOptions {
  asOf?: IsoDate;
  /** The what-if package (default: every feasible retrofit). Infeasible choices are reported, not run. */
  retrofits?: readonly GhRetrofitId[];
}

const fuel = (e: number, g: number): GhFuelEnergy => ({ electricityKwh: Math.round(e), gasKwh: Math.round(g), totalKwh: Math.round(e) + Math.round(g) });

export function issuesOf(p: GhProperty, s: GreenHomeScore, intensity: number | null): PoorHomeFlag['issues'] {
  const out: PoorHomeFlag['issues'] = [];
  const sub = (id: string) => s.components.find((c) => c.id === id)?.subScore ?? 100;
  if (intensity !== null && intensity > 180)
    out.push({ id: 'high-intensity', text: `High energy use per m² (${Math.round(intensity)} kWh a year)`, component: 'consumption-intensity' });
  if (p.energyRating && 'EFG'.includes(p.energyRating))
    out.push({ id: 'low-rating', text: `Low energy rating (${p.energyRating})`, component: 'energy-efficiency' });
  if (sub('insulation') < 40) out.push({ id: 'poor-insulation', text: 'Poor insulation', component: 'insulation' });
  if (sub('heating') < 40) out.push({ id: 'old-heating', text: 'Old or inefficient heating system', component: 'heating' });
  if (p.glazing === 'single') out.push({ id: 'single-glazing', text: 'Single glazing', component: 'glazing' });
  if (p.solarKwp === 0) out.push({ id: 'no-renewables', text: 'No renewable generation', component: 'renewables' });
  if (sub('smart-controls') < 30) out.push({ id: 'basic-controls', text: 'Basic or no heating controls', component: 'smart-controls' });
  return out;
}

function valueImpact(p: GhProperty, from: Band | null, to: Band | null, chosen: number): GhValueImpact {
  const method =
    'Indicative range from documented market studies of price differences between EPC bands (Ibasho value table v1: ' +
    'Nationwide 2024, Knight Frank 2023, DESNZ hedonic studies), applied to the current value estimate for this home, ' +
    'which already reflects its location, size and type; other characteristics held constant.';
  const caveat =
    'An estimated potential impact from historical associations, not a guaranteed or proven causal increase. Market conditions vary.';
  if (!from || !to || chosen === 0)
    return { status: 'unavailable', currentValueGBP: p.valueGBP, ratingFrom: from, ratingTo: to, upliftPct: null, valueGBP: null, method, caveat: `${caveat} No rating change to value.` };
  const u = valueUkOwnerOccupierV1.uplift(from, to);
  if (!u)
    return { status: 'available', currentValueGBP: p.valueGBP, ratingFrom: from, ratingTo: to, upliftPct: { lo: 0, hi: 0 }, valueGBP: { lo: p.valueGBP, hi: p.valueGBP }, method, caveat: `${caveat} Rating stays in the same value band: no measurable value effect expected.` };
  const pct = (q: Q) => Math.round(Q.toNumber(q) * 1000) / 10;
  const vals = [pct(u.low), pct(u.central), pct(u.high)];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const round500 = (x: number) => Math.round(x / 500) * 500;
  return {
    status: 'available',
    currentValueGBP: p.valueGBP,
    ratingFrom: from,
    ratingTo: to,
    upliftPct: { lo, hi },
    valueGBP: { lo: round500(p.valueGBP * (1 + lo / 100)), hi: round500(p.valueGBP * (1 + hi / 100)) },
    method,
    caveat,
  };
}

/** Apply a retrofit list to the recorded features (for the score after the package). */
export function propertyAfter(p: GhProperty, rs: readonly GhRetrofitId[]): GhProperty {
  const q: GhProperty = { ...p, insulation: { ...p.insulation }, constraints: { ...p.constraints } };
  for (const r of rs) {
    if (r === 'loft') q.insulation.loftMm = 270;
    if (r === 'cavity-wall') q.insulation.wall = 'cavity-filled';
    if (r === 'solid-wall') q.insulation.wall = 'solid-insulated';
    if (r === 'floor') q.insulation.floorInsulated = true;
    if (r === 'glazing') q.glazing = 'double';
    if (r === 'smart-thermostat') q.smartControls = 'smart-thermostat';
    if (r === 'heat-pump') {
      q.heating = 'heat-pump';
      q.heatingAgeYears = 0;
    }
    if (r === 'solar') q.solarKwp = p.floorAreaM2 < 70 ? 2 : 3;
  }
  return q;
}

export function assessProperty(p: GhProperty, usage: readonly GhUsageRow[], opts: AssessOptions = {}): GhAssessment {
  const asOf = opts.asOf ?? '2026-10-11';
  const warnings: string[] = [];
  const annualised = annualise(usage, p.floorAreaM2, asOf);
  const base = runProperty(p, []);
  const bf = base.fuels;
  const modelledIntensity = (bf.electricityKwh + bf.gasKwh) / p.floorAreaM2;
  const score = scoreProperty(p, annualised, { modelledSap: base.sap, modelledIntensity });

  // Data quality and conflicts.
  for (const [name, f] of [
    ['electricity', annualised.electricity],
    ['gas', annualised.gas],
  ] as const) {
    if (f.method === 'insufficient')
      warnings.push(`Only ${f.monthsUsed} of 12 months of ${name} readings: annual ${name} use is unavailable, not zero.`);
    else if (f.method === 'seasonal-scaling')
      warnings.push(`${f.monthsMissing} month(s) of ${name} readings missing: the annual figure is scaled by typical seasonal shares.`);
  }
  const gasHeat = p.heating === 'gas-boiler-old' || p.heating === 'gas-boiler-condensing';
  if (gasHeat && annualised.gas.kwh !== null && annualised.gas.kwh < 500)
    warnings.push('Records say gas heating but almost no gas is metered: the heating record or the meter data may be wrong.');
  if (!gasHeat && annualised.gas.kwh !== null && annualised.gas.kwh > 3000)
    warnings.push('Records say non-gas heating but substantial gas is metered: the heating record may be out of date.');
  const metered = annualised.electricity.kwh !== null && annualised.gas.kwh !== null;
  if (metered) {
    const ratio = ((annualised.electricity.kwh as number) + (annualised.gas.kwh as number)) / Math.max(1, bf.electricityKwh + bf.gasKwh);
    if (ratio > 2 || ratio < 0.5)
      warnings.push(`Metered use is ${ratio.toFixed(1)} times what the home's recorded features suggest: occupancy or the records may differ.`);
  }
  if (p.sapRating === null && p.energyRating === null) warnings.push('No energy certificate recorded: the energy efficiency component uses the modelled rating.');
  if (p.epcDate && Number(asOf.slice(0, 4)) - Number(p.epcDate.slice(0, 4)) > 10)
    warnings.push('The energy certificate is over ten years old and may not reflect later improvements.');
  for (const c of score.components)
    if (c.basis === 'assumed') warnings.push(`${c.label}: some inputs are unknown and an age-based default was assumed (${c.input}).`);

  // Feasibility.
  const feasibleIds: GhRetrofitId[] = [];
  const infeasible: GhAssessment['infeasible'] = [];
  const firstReason = new Map<GhRetrofitId, ReturnType<typeof applicability>>();
  for (const r of GH_RETROFIT_ORDER) {
    const a = applicability(r, p);
    firstReason.set(r, a);
    if (a.feasible) feasibleIds.push(r);
    else infeasible.push({ retrofitId: r, reason: a.reason });
  }
  const requested = opts.retrofits ?? feasibleIds;
  for (const r of requested)
    if (!feasibleIds.includes(r)) warnings.push(`${catalogueOf(r).name} was asked for but is not feasible here: ${firstReason.get(r)?.reason ?? ''}`);
  const chosen = GH_RETROFIT_ORDER.filter((r) => requested.includes(r) && feasibleIds.includes(r));

  // Calibrated per-fuel totals for a retrofit list.
  const meterE = annualised.electricity.kwh;
  const meterG = annualised.gas.kwh;
  const calib = (rs: readonly GhRetrofitId[]) => {
    const run = rs.length ? runProperty(p, rs) : base;
    const e = meterE !== null && bf.electricityKwh > 0 ? (meterE * run.fuels.electricityKwh) / bf.electricityKwh : run.fuels.electricityKwh;
    const g =
      meterG !== null && bf.gasKwh > 0 ? (meterG * run.fuels.gasKwh) / bf.gasKwh : meterG !== null && bf.gasKwh === 0 ? meterG + run.fuels.gasKwh : run.fuels.gasKwh;
    return { e: Math.round(e), g: Math.round(g), run };
  };

  const twin = buildTwin(p);
  const recs: GhRecommendation[] = [];
  let above: GhRetrofitId[] = [];
  let prev = calib([]);
  let order = 0;
  for (const r of feasibleIds) {
    const isChosen = chosen.includes(r);
    const next = calib([...above, r]);
    const de = prev.e - next.e;
    const dg = prev.g - next.g;
    const a = firstReason.get(r) as ReturnType<typeof applicability>;
    let suitability = a.suitability;
    let reason = a.reason;
    if (r === 'heat-pump') {
      const demand = next.run.fuels.heatDemandKwh / p.floorAreaM2;
      if (suitability !== 'Low') suitability = demand <= 80 ? 'High' : demand <= 140 ? 'Medium' : 'Low';
      if (demand > 140) reason += ` Heat demand is still high (${Math.round(demand)} kWh per m² a year): insulate first.`;
    }
    const carbon = carbonKg(de, dg);
    if (de + dg <= 0 && carbon <= 0) {
      suitability = 'Low';
      reason += ' Little or no saving is modelled for this home.';
    }
    order += 1;
    recs.push({
      retrofitId: r,
      name: catalogueOf(r).name,
      order,
      suitability,
      saving: { electricityKwh: de, gasKwh: dg, totalKwh: de + dg, carbonKg: carbon },
      costGBP: costFor(r, p, twin),
      reason,
      estimate: true,
    });
    if (isChosen) {
      above = [...above, r];
      prev = next;
    }
  }

  const b0 = calib([]);
  const after = chosen.length ? calib(chosen) : b0;
  const ratingBefore: Band | null = p.energyRating ?? base.band;
  const sapBefore = p.sapRating ?? base.sap;
  const ratingAfter = bandOfSap(sapBefore + (after.run.sap - base.sap));
  const costs = recs.filter((x) => chosen.includes(x.retrofitId)).map((x) => x.costGBP);
  const pkg = chosen.length
    ? {
        retrofitIds: chosen,
        saving: { electricityKwh: b0.e - after.e, gasKwh: b0.g - after.g, totalKwh: b0.e + b0.g - after.e - after.g, carbonKg: carbonKg(b0.e - after.e, b0.g - after.g) },
        baseline: fuel(b0.e, b0.g),
        after: fuel(after.e, after.g),
        costGBP: { lo: costs.reduce((s, c) => s + c.lo, 0), hi: costs.reduce((s, c) => s + c.hi, 0) },
        ratingBefore,
        ratingAfter,
        estimate: true as const,
      }
    : null;

  // Improvement potential uses every feasible retrofit (the brief's definition), on metered data.
  let potential: ImprovementPotential;
  if (!metered) {
    potential = {
      status: 'unavailable',
      pct: null,
      baseline: null,
      after: null,
      note: 'Unavailable: fewer than nine of the last twelve months of electricity or gas readings. Missing months are never treated as zero.',
    };
  } else if ((meterE as number) + (meterG as number) <= 0) {
    potential = { status: 'unavailable', pct: null, baseline: fuel(0, 0), after: null, note: 'Unavailable: metered purchased energy is zero.' };
  } else {
    const full = feasibleIds.length ? calib(feasibleIds) : b0;
    const bt = b0.e + b0.g;
    potential = {
      status: 'available',
      pct: Math.round((1000 * (bt - full.e - full.g)) / bt) / 10,
      baseline: fuel(b0.e, b0.g),
      after: fuel(full.e, full.g),
      note: 'Purchased energy = grid electricity imported + gas, kWh a year, annualised meter data; after = every feasible retrofit modelled together.',
    };
  }

  const poor: PoorHomeFlag = {
    flagged: score.band === 'Poor' || score.band === 'Very poor',
    band: score.band,
    issues: issuesOf(p, score, annualised.intensityKwhM2),
  };
  return {
    propertyId: p.propertyId,
    asOf,
    annualised,
    score,
    poor,
    potential,
    recommendations: recs,
    infeasible,
    package: pkg,
    value: valueImpact(p, ratingBefore, pkg ? ratingAfter : null, chosen.length),
    warnings,
    factors: [...EMISSION_FACTORS],
  };
}

