/**
 * "If nothing is done" (SPEC 14, AC-B1): the fourth line beside the three futures. Owner: WP-02.
 *
 * The twin is aged year by year with the `maintenance` plugins in force (decay models from packs,
 * WP-01). Each model applies when its target is in the twin: a measure listed in `twin.done`, or
 * a heating, hot water or cooling system of the named category (and ids, when given). Models
 * that match nothing are listed in `notApplicable`.
 *
 * Ageing uses the recurrence form of SPEC 7.4 on a milli-unit fixed representation, never a float
 * power: relative `v_t = roundHalfEven(v_{t-1} (10^9 + ppb), 10^9)`, absolute
 * `v_t = v_{t-1} + roundHalfEven(1000 perYear)`, then the effect's clamp. Decay starts once the
 * target's age reaches `onsetYears` (age from `installedYear`, the `done` date, or
 * `systems.boilerAgeYears` for a boiler; 0 when none is known, with `onsetFrom: 'as-of'` meaning
 * age 0 today).
 *
 * Each reported year runs the full pipeline on the aged twin (`mode`, default your-home), then
 * prices it with the tariffs in force escalated by `owner.escalation`, and carbon with the
 * trajectory factor of that calendar year. Replacements falling due (end of life, the
 * `rate` end of `ageYears`) add the like-for-like cost from the money pack. PLACEHOLDER: a
 * replacement does not yet reset the decayed efficiency (the line stays conservative for the
 * owner: it shows the cost and the drift together).
 *
 * Totals: `costNpv = sum_t applyFactor(bill_t, D_t) + sum applyFactor(replacement, D_due)` over
 * years 1..H, and the summed carbon of those years. Every number is an evidence node whose inputs
 * reach the aged parameters, and every aged parameter carries its decay model's sources and grade.
 */
import {
  applyFactor,
  canonicalHash,
  createEvidenceGraphBuilder,
  DAYS_IN_MONTH,
  type DoNothingEffect,
  type DoNothingReplacement,
  type DoNothingRequest,
  type DoNothingResult,
  type DoNothingYear,
  discountFactors,
  type EvidenceDraft,
  type EvidenceId,
  type EvidenceSubject,
  type EvidenceValue,
  FUELS,
  type Fuel,
  growthFactors,
  type HomeTwin,
  type MaintenancePlugin,
  type Negative,
  numCentral,
  PPB,
  Q,
  quantise,
  type RunMode,
  roundHalfEven,
  type SystemPlugin,
  type SystemRef,
  type TwinPatch,
  toWire,
  type Unit,
} from '@ibasho/core';
import { SPEC_HASH } from '@ibasho/spec-gen';
import { escalationPpb } from '../finance/owner.ts';
import { applyPatch, simulate } from '../pipeline/index.ts';
import type { SearchEnv } from './env.ts';

export class DoNothingError extends Error {
  override name = 'DoNothingError';
}

const PKG = 'do-nothing';
const MILLI = 1000n;

interface Target {
  model: MaintenancePlugin;
  /** Age of the target today, whole years. */
  age: number;
  /** System ref when the target is a system. */
  ref?: SystemRef;
}

function categoryOf(systems: readonly SystemPlugin[], id: string) {
  return systems.find((s) => s.id === id)?.category;
}

function systemRefs(twin: HomeTwin): SystemRef[] {
  return [twin.systems.space, twin.systems.dhw, ...(twin.systems.cooling ?? [])];
}

function asOfYear(asOf: string): number {
  return Number(asOf.slice(0, 4));
}

/** Which models apply, and the age of what they age. */
export function matchModels(
  twin: HomeTwin,
  models: readonly MaintenancePlugin[],
  systems: readonly SystemPlugin[],
  asOf: string,
): { targets: Target[]; notApplicable: string[] } {
  const year = asOfYear(asOf);
  const targets: Target[] = [];
  const notApplicable: string[] = [];
  for (const model of models) {
    const a = model.ages;
    if (a.kind === 'measure') {
      const done = twin.done
        .filter((d) => d.measureId === a.measureId)
        .sort((x, y) => (x.at < y.at ? 1 : -1))[0];
      if (!done) notApplicable.push(model.id);
      else targets.push({ model, age: Math.max(0, year - asOfYear(done.at)) });
      continue;
    }
    const ref = systemRefs(twin).find(
      (r) =>
        categoryOf(systems, r.systemId) === a.category && (!a.systemIds || a.systemIds.includes(r.systemId)),
    );
    if (!ref) {
      notApplicable.push(model.id);
      continue;
    }
    let age = 0;
    if (ref.installedYear !== undefined) age = Math.max(0, year - ref.installedYear);
    else if (a.category === 'boiler' && twin.systems.boilerAgeYears)
      age = Math.max(0, Math.round(numCentral(twin.systems.boilerAgeYears)));
    targets.push({ model, age, ref });
  }
  return { targets, notApplicable };
}

function readAt(twin: HomeTwin, path: string): unknown {
  let cur: unknown = twin;
  for (const tok of path.slice(1).split('/')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = Array.isArray(cur) ? cur[Number(tok)] : (cur as Record<string, unknown>)[tok];
  }
  return cur;
}

/** Today's value of a decayed parameter, milli-units. A missing system efficiency reads the plugin. */
function baseMilli(twin: HomeTwin, path: string, systems: readonly SystemPlugin[], t: Target): bigint {
  const v = readAt(twin, path);
  let x: number | undefined;
  if (typeof v === 'number') x = v;
  else if (v && typeof v === 'object' && 'state' in v) x = numCentral(v as Parameters<typeof numCentral>[0]);
  else if (v === undefined && t.ref && path.endsWith('/efficiency'))
    x = systems.find((s) => s.id === t.ref!.systemId)?.efficiency;
  if (x === undefined || !Number.isFinite(x))
    throw new DoNothingError(`${t.model.id}: no value at ${path} to age`);
  return quantise(x * 1000);
}

function clampMilli(v: bigint, c: { min?: Q; max?: Q } | undefined): bigint {
  if (!c) return v;
  if (c.min !== undefined) {
    const lo = Q.roundHalfEven(Q.mul(c.min, Q.of(MILLI)));
    if (v < lo) v = lo;
  }
  if (c.max !== undefined) {
    const hi = Q.roundHalfEven(Q.mul(c.max, Q.of(MILLI)));
    if (v > hi) v = hi;
  }
  return v;
}

/** Aged values 0..H of one effect, milli-units (index = year). */
export function ageSeries(
  base: bigint,
  e: MaintenancePlugin['effects'][number],
  rate: 'lo' | 'mid' | 'hi',
  ageToday: number,
  horizon: number,
): bigint[] {
  const out = [base];
  let v = base;
  const onset = e.onsetYears ?? 0;
  const start = e.onsetFrom === 'as-of' ? onset : Math.max(0, onset - ageToday);
  for (let t = 1; t <= horizon; t++) {
    if (t > start) {
      if (e.rate.form === 'relative') v = roundHalfEven(v * (PPB + e.rate.ppbPerYear[rate]), PPB);
      else v += Q.roundHalfEven(Q.mul(e.rate.perYear[rate], Q.of(MILLI)));
      v = clampMilli(v, e.clamp);
    }
    out.push(v);
  }
  return out;
}

function numField(milli: bigint, pluginId: string) {
  return {
    state: 'known' as const,
    value: Number(milli) / 1000,
    source: { kind: 'default' as const, pluginId },
  };
}

export function runDoNothing(req: DoNothingRequest, env: SearchEnv): DoNothingResult {
  const { twin, owner, asOf } = req;
  const mode: RunMode = req.mode ?? 'your-home';
  const H = req.horizonYears ?? owner.horizonYears;
  if (!Number.isInteger(H) || H < 1) throw new DoNothingError('horizon must be a positive integer');
  const rate = req.rate ?? 'mid';
  const report = [...new Set(req.reportYears ?? Array.from({ length: H + 1 }, (_, t) => t))].sort(
    (a, b) => a - b,
  );
  if (report.some((t) => !Number.isInteger(t) || t < 0 || t > H))
    throw new DoNothingError('report years must be integers in 0..horizon');
  if (report[0] !== 0) report.unshift(0);
  const systems = env.pipeline.systems ?? [];
  const { targets, notApplicable } = matchModels(twin, env.maintenance, systems, asOf);

  const builder = createEvidenceGraphBuilder();
  const subject = (): EvidenceSubject => ({ homeId: twin.id, packageId: PKG, mode });
  const keyOf = (q: string) => `${PKG}@${mode}/${q}`;
  const draft = (
    quantity: string,
    value: EvidenceValue,
    unit: Unit,
    doc: string,
    inputs: { key: string; role: string }[],
    prov?: EvidenceDraft['provenance'],
  ): EvidenceDraft => ({
    key: keyOf(quantity),
    quantity,
    subject: subject(),
    value,
    unit,
    formula: { id: `SPEC-14-${quantity.replace(/\.y\d+$/, '')}`, doc },
    inputs,
    provenance: prov ?? { kind: 'computed' },
    rounding: { mode: 'sig', value: 3 },
  });

  // 1. Aged parameters per effect (all years, so the cost line can use any year).
  type Series = {
    t: Target;
    e: MaintenancePlugin['effects'][number];
    mid: bigint[];
    lo: bigint[];
    hi: bigint[];
  };
  const series: Series[] = [];
  for (const t of targets) {
    for (const e of t.model.effects) {
      const base = baseMilli(twin, e.param, systems, t);
      series.push({
        t,
        e,
        mid: ageSeries(base, e, rate, t.age, H),
        lo: ageSeries(base, e, 'lo', t.age, H),
        hi: ageSeries(base, e, 'hi', t.age, H),
      });
    }
  }
  const effects: DoNothingEffect[] = [];
  const effectDrafts: EvidenceDraft[] = [];
  const effectKeys = new Map<number, { key: string; role: string }[]>();
  for (const year of report) {
    const keys: { key: string; role: string }[] = [];
    for (const s of series) {
      const m = s.t.model;
      const prov: EvidenceDraft['provenance'] = {
        kind: 'computed',
        plugin: { id: m.id, version: m.version },
        sources: m.provenance.sources,
        grade: m.provenance.grade,
      };
      const q = `${s.e.quantity}.${m.id}.y${year}`;
      const doc = `${s.e.rate.form} decay, ${rate} rate, year ${year} (${m.neglect})`;
      const mk = (end: 'lo' | 'hi' | 'mid', arr: bigint[]) =>
        draft(end === 'mid' ? q : `${q}.${end}`, { exact: Q.of(arr[year]!, MILLI) }, s.e.unit, doc, [], prov);
      effectDrafts.push(mk('mid', s.mid), mk('lo', s.lo), mk('hi', s.hi));
      keys.push({ key: keyOf(q), role: `${m.id} ${s.e.param}` });
    }
    effectKeys.set(year, keys);
  }
  builder.addDrafts(effectDrafts);
  for (const year of report) {
    for (const s of series) {
      const q = `${s.e.quantity}.${s.t.model.id}.y${year}`;
      effects.push({
        maintenanceId: s.t.model.id,
        param: s.e.param,
        year,
        evidence: builder.idOfKey(keyOf(q))!,
        band: { lo: builder.idOfKey(keyOf(`${q}.lo`))!, hi: builder.idOfKey(keyOf(`${q}.hi`))! },
      });
    }
  }

  // 2. Replacements due.
  const replacements: DoNothingReplacement[] = [];
  const dueCosts: { year: number; cost: bigint }[] = [];
  for (const t of targets) {
    const eol = t.model.endOfLife;
    if (!eol) continue;
    const due = (n: number) => Math.max(0, n - t.age);
    const dueYear = { lo: due(eol.ageYears.lo), mid: due(eol.ageYears.mid), hi: due(eol.ageYears.hi) };
    const at = dueYear[rate];
    const prov: EvidenceDraft['provenance'] = {
      kind: 'computed',
      plugin: { id: t.model.id, version: t.model.version },
      sources: t.model.provenance.sources,
      grade: t.model.provenance.grade,
    };
    const q = `donothing.replacement_due.${t.model.id}`;
    const drafts = [
      draft(
        q,
        { exact: Q.of(BigInt(at)) },
        'yr',
        `end of life at age ${eol.ageYears[rate]}, age today ${t.age}`,
        [],
        prov,
      ),
    ];
    let costKey: string | undefined;
    if (eol.replaceWithSystemId) {
      const c = env.costs.get(eol.replaceWithSystemId);
      if (!c) throw new DoNothingError(`no like-for-like cost for ${eol.replaceWithSystemId}`);
      const k = c.cost(twin, asOf);
      costKey = keyOf(`donothing.replacement_cost.${t.model.id}`);
      drafts.push(
        draft(
          `donothing.replacement_cost.${t.model.id}`,
          { fixed: toWire(k.mid), unit: 'micro-pence' },
          'micro-pence',
          `like-for-like ${eol.replaceWithSystemId}, central cost`,
          [],
          {
            kind: 'computed',
            plugin: { id: c.id, version: c.version },
            sources: c.provenance?.sources ?? [],
            grade: k.grade,
          },
        ),
      );
      if (at >= 1 && at <= H) dueCosts.push({ year: at, cost: k.mid });
      else if (at === 0) dueCosts.push({ year: 1, cost: k.mid });
    }
    builder.addDrafts(drafts);
    const r: DoNothingReplacement = {
      maintenanceId: t.model.id,
      dueYear,
      evidence: builder.idOfKey(keyOf(q))!,
    };
    if (costKey) r.cost = builder.idOfKey(costKey)!;
    replacements.push(r);
  }

  // 3. Every year 0..H: aged twin, delivered energy, bill, carbon.
  const G = new Map<Fuel, bigint[]>();
  const esc = escalationPpb(owner);
  for (const f of FUELS) G.set(f, growthFactors(esc[f] ?? 0n, H));
  const D = discountFactors(owner.discountRatePpb, H);
  const firstYear = asOfYear(asOf);
  const years: DoNothingYear[] = [];
  const perYear: { delivered: Record<Fuel, bigint>; bill: bigint; carbonG: bigint }[] = [];
  const reportSet = new Set(report);
  for (let year = 0; year <= H; year++) {
    const patch: TwinPatch = {
      set: series.map((s) => ({ path: s.e.param, value: numField(s.mid[year]!, s.t.model.id) })),
    };
    const aged = series.length ? applyPatch(twin, patch) : twin;
    const run = simulate({ twin: aged, mode, asOf }, env.pipeline);
    const delivered = {} as Record<Fuel, bigint>;
    let bill = 0n;
    let ug = 0n;
    for (const f of FUELS) {
      let s = 0n;
      for (const x of run.result.deliveredWh[f]) s += x;
      delivered[f] = s;
      const tariff = env.tariffs.get(f);
      const used = s !== 0n;
      if (tariff) {
        const b = tariff.bill([...run.result.deliveredWh[f]], { days: [...DAYS_IN_MONTH] }).total;
        bill += year === 0 ? b : applyFactor(b, G.get(f)![year]!);
      } else if (used) throw new DoNothingError(`no tariff for ${f}, which the home uses`);
      if (used) ug += s * env.trajectory.factor(f, firstYear + year);
    }
    const carbonG = roundHalfEven(ug, 1_000_000n);
    perYear.push({ delivered, bill, carbonG });
    if (!reportSet.has(year)) continue;
    const inputs = effectKeys.get(year) ?? [];
    const drafts: EvidenceDraft[] = [];
    for (const f of FUELS) {
      if (delivered[f] === 0n) continue;
      drafts.push(
        draft(
          `donothing.delivered.${f}.y${year}`,
          { fixed: toWire(delivered[f]), unit: 'Wh' },
          'Wh',
          `annual delivered ${f}, aged twin, year ${year}`,
          inputs,
        ),
      );
    }
    const fuelKeys = FUELS.filter((f) => delivered[f] !== 0n).map((f) => ({
      key: keyOf(`donothing.delivered.${f}.y${year}`),
      role: f,
    }));
    drafts.push(
      draft(
        `donothing.bill.y${year}`,
        { fixed: toWire(bill), unit: 'micro-pence/yr' },
        'micro-pence/yr',
        `tariffs in force, escalated to year ${year}`,
        fuelKeys,
      ),
      draft(
        `donothing.carbon.y${year}`,
        { fixed: toWire(carbonG), unit: 'gCO2e/yr' },
        'gCO2e/yr',
        `annual delivered x trajectory factor of ${firstYear + year}`,
        fuelKeys,
      ),
    );
    builder.addDrafts(drafts);
    const dy: DoNothingYear = {
      year,
      deliveredWh: {},
      bill: builder.idOfKey(keyOf(`donothing.bill.y${year}`))!,
      carbon: builder.idOfKey(keyOf(`donothing.carbon.y${year}`))!,
    };
    for (const f of FUELS)
      if (delivered[f] !== 0n)
        dy.deliveredWh[f] = builder.idOfKey(keyOf(`donothing.delivered.${f}.y${year}`))!;
    years.push(dy);
  }

  // 4. Totals.
  let costNpv = 0n;
  let carbonTotal = 0n;
  for (let t = 1; t <= H; t++) {
    costNpv += applyFactor(perYear[t]!.bill, D[t]!);
    carbonTotal += perYear[t]!.carbonG;
  }
  for (const c of dueCosts) costNpv += applyFactor(c.cost, D[c.year]!);
  const yearKeys = report
    .filter((y) => y >= 1)
    .map((y) => ({ key: keyOf(`donothing.bill.y${y}`), role: `year ${y}` }));
  const replKeys = replacements.flatMap((r) => {
    const k = keyOf(`donothing.replacement_cost.${r.maintenanceId}`);
    return builder.idOfKey(k) ? [{ key: k, role: `replacement ${r.maintenanceId}` }] : [];
  });
  builder.addDrafts([
    draft(
      'donothing.cost_npv',
      { fixed: toWire(costNpv), unit: 'micro-pence' },
      'micro-pence',
      'sum_t bill_t D_t + replacements D_due, years 1..H',
      [...yearKeys, ...replKeys],
    ),
    draft(
      'donothing.carbon_total',
      { fixed: toWire(carbonTotal), unit: 'gCO2e' },
      'gCO2e',
      'sum of annual carbon, years 1..H',
      report.filter((y) => y >= 1).map((y) => ({ key: keyOf(`donothing.carbon.y${y}`), role: `year ${y}` })),
    ),
  ]);

  // 5. Negatives: the last reported year against today, plus decay and replacements.
  const last = report[report.length - 1]!;
  const negatives: Negative[] = [];
  const idK = (q: string) => builder.idOfKey(keyOf(q));
  if (last > 0) {
    const a = perYear[0]!;
    const b = perYear[last]!;
    for (const f of FUELS) {
      if (b.delivered[f] > a.delivered[f]) {
        const n: Negative = {
          indicator: `donothing.delivered.${f}`,
          kind: 'fuel-rise',
          evidence: idK(`donothing.delivered.${f}.y${last}`)!,
          after: idK(`donothing.delivered.${f}.y${last}`)!,
          message: `negative.donothing.fuel-rise.${f}`,
        };
        const before = idK(`donothing.delivered.${f}.y0`);
        if (before) n.before = before;
        negatives.push(n);
      }
    }
    if (b.bill > a.bill)
      negatives.push({
        indicator: 'donothing.bill',
        kind: 'money',
        evidence: idK(`donothing.bill.y${last}`)!,
        before: idK('donothing.bill.y0')!,
        after: idK(`donothing.bill.y${last}`)!,
        message: 'negative.donothing.bill-rise',
      });
    if (b.carbonG > a.carbonG)
      negatives.push({
        indicator: 'donothing.carbon',
        kind: 'carbon',
        evidence: idK(`donothing.carbon.y${last}`)!,
        before: idK('donothing.carbon.y0')!,
        after: idK(`donothing.carbon.y${last}`)!,
        message: 'negative.donothing.carbon-rise',
      });
    for (const s of series) {
      // A decay model describes degradation in either direction (efficiency falls, air leakage
      // rises), so any change of the aged value from today is a negative.
      if (s.mid[last] === s.mid[0]) continue;
      const q = `${s.e.quantity}.${s.t.model.id}`;
      negatives.push({
        indicator: s.e.quantity,
        kind: 'performance',
        evidence: idK(`${q}.y${last}`)!,
        before: idK(`${q}.y0`)!,
        after: idK(`${q}.y${last}`)!,
        maintenanceId: s.t.model.id,
        message: s.e.explain,
      });
    }
  }
  for (const r of replacements) {
    if (r.dueYear[rate] > H) continue;
    const n: Negative = {
      indicator: 'donothing.replacement',
      kind: 'money',
      evidence: r.cost ?? r.evidence,
      maintenanceId: r.maintenanceId,
      message: 'negative.donothing.replacement-due',
    };
    negatives.push(n);
  }

  const graph = builder.build();
  const maintenanceFingerprint = canonicalHash(
    targets.map((t) => [t.model.id, t.model.version]).concat(notApplicable.map((id) => [id, 'n/a'])),
  );
  const totals = {
    costNpv: idK('donothing.cost_npv')! as EvidenceId,
    carbon: idK('donothing.carbon_total')! as EvidenceId,
  };
  const hash = canonicalHash({
    twin: canonicalHash(twin),
    owner,
    asOf,
    mode,
    H,
    rate,
    report,
    fp: env.fingerprint,
    graph: graph.nodes.map((n) => n.id),
  });
  return {
    hash,
    specHash: SPEC_HASH,
    maintenanceFingerprint,
    mode,
    horizonYears: H,
    years,
    effects,
    replacements,
    totals,
    negatives,
    notApplicable,
    graph,
  };
}
