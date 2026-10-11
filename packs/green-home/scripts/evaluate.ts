/**
 * Held-out evaluation (brief sections 11 and 13 G, I). Owner: WP-25.
 * Run after `gen:portfolio`: `pnpm --filter @ibasho/pack-green-home evaluate`.
 *
 * Compares the model's outputs (computed from recorded data and meters only) with the reference
 * labels (computed by the simulator from each home's hidden truth) on the validation and test
 * splits, and with simple baselines fitted on the train split. Writes `evaluation.json`,
 * `evaluation.md` and `test_predictions.csv` beside the portfolio.
 *
 * Agreement with synthetic labels shows the model is consistent with the documented simulator; it
 * does not establish accuracy on real homes.
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GhAssessment, GhLabel, GhProperty, GhRetrofitId, GhSplit } from '@ibasho/core';
import { GH_RETROFIT_ORDER } from '@ibasho/core';

const DIR = join(import.meta.dirname, '..', '..', '..', 'packages/fixtures/src/portfolio');
const read = <T>(f: string): T => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as T;
const props = read<GhProperty[]>('properties.json');
const labels = new Map(read<GhLabel[]>('labels.json').map((l) => [l.propertyId, l]));
const assess = new Map(read<GhAssessment[]>('assessments.json').map((a) => [a.propertyId, a]));

const r1 = (x: number) => Math.round(x * 10) / 10;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

function ranks(xs: number[]): number[] {
  const idx = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let k = 0; k < idx.length; ) {
    let j = k;
    while (j + 1 < idx.length && (idx[j + 1] as readonly [number, number])[0] === (idx[k] as readonly [number, number])[0]) j++;
    for (let t = k; t <= j; t++) r[(idx[t] as readonly [number, number])[1]] = (k + j) / 2 + 1;
    k = j + 1;
  }
  return r;
}
function spearman(a: number[], b: number[]): number {
  if (a.length < 3) return Number.NaN;
  const ra = ranks(a);
  const rb = ranks(b);
  const m = (ra.length + 1) / 2;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += ((ra[i] as number) - m) * ((rb[i] as number) - m);
    da += ((ra[i] as number) - m) ** 2;
    db += ((rb[i] as number) - m) ** 2;
  }
  return num / Math.sqrt(da * db);
}
const mae = (a: number[], b: number[]) => a.reduce((s, x, i) => s + Math.abs(x - (b[i] as number)), 0) / Math.max(1, a.length);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.floor(s.length / 2)] as number) : 0;
};
/** Top-k precision: share of the label's top 20% that the predictions also put in their top 20%. */
function topOverlap(pred: number[], truth: number[]): number {
  const k = Math.max(1, Math.round(pred.length * 0.2));
  const top = (xs: number[]) => new Set(xs.map((x, i) => [x, i] as const).sort((a, b) => b[0] - a[0]).slice(0, k).map(([, i]) => i));
  const a = top(pred);
  const b = top(truth);
  return [...a].filter((i) => b.has(i)).length / k;
}

// Baselines fitted on the train split only.
const train = props.filter((p) => p.split === 'train');
const bandMean = new Map<string, number>();
{
  const acc = new Map<string, number[]>();
  for (const p of train) {
    const l = labels.get(p.propertyId);
    if (!l || l.improvementPotentialPct === null) continue;
    const k = p.energyRating ?? 'none';
    acc.set(k, [...(acc.get(k) ?? []), l.improvementPotentialPct]);
  }
  for (const [k, v] of acc) bandMean.set(k, v.reduce((s, x) => s + x, 0) / v.length);
}
const saveFrac = { e: [] as number[], g: [] as number[] };
for (const p of train) {
  const l = labels.get(p.propertyId);
  const a = assess.get(p.propertyId);
  if (!l?.packageSavingKwh || !a) continue;
  const e = a.annualised.electricity.kwh;
  const g = a.annualised.gas.kwh;
  if (e && e > 0) saveFrac.e.push(l.packageSavingKwh.electricity / e);
  if (g && g > 0) saveFrac.g.push(l.packageSavingKwh.gas / g);
}
const medE = median(saveFrac.e);
const medG = median(saveFrac.g);

function evaluate(split: GhSplit) {
  const ps = props.filter((p) => p.split === split);
  // 1. Improvement potential ranking.
  const both = ps.filter((p) => assess.get(p.propertyId)?.potential.pct !== null && labels.get(p.propertyId)?.improvementPotentialPct !== null);
  const pred = both.map((p) => assess.get(p.propertyId)?.potential.pct as number);
  const truth = both.map((p) => labels.get(p.propertyId)?.improvementPotentialPct as number);
  const base = both.map((p) => bandMean.get(p.energyRating ?? 'none') ?? 0);
  // 2. Per-fuel package savings.
  const sv = ps.filter((p) => assess.get(p.propertyId)?.package && labels.get(p.propertyId)?.packageSavingKwh && assess.get(p.propertyId)?.potential.status === 'available');
  const pe = sv.map((p) => assess.get(p.propertyId)?.package?.saving.electricityKwh as number);
  const pg = sv.map((p) => assess.get(p.propertyId)?.package?.saving.gasKwh as number);
  const te = sv.map((p) => labels.get(p.propertyId)?.packageSavingKwh?.electricity as number);
  const tg = sv.map((p) => labels.get(p.propertyId)?.packageSavingKwh?.gas as number);
  const be = sv.map((p) => (assess.get(p.propertyId)?.annualised.electricity.kwh ?? 0) * medE);
  const bg = sv.map((p) => (assess.get(p.propertyId)?.annualised.gas.kwh ?? 0) * medG);
  const signAgree = sv.filter((_, i) => Math.sign(pe[i] as number) === Math.sign(te[i] as number) || Math.abs(te[i] as number) < 50).length / Math.max(1, sv.length);
  // 3. Feasibility (micro precision and recall over retrofit items).
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let btp = 0;
  let bfp = 0;
  let bfn = 0;
  for (const p of ps) {
    const pr = new Set(assess.get(p.propertyId)?.recommendations.map((r) => r.retrofitId) ?? []);
    const tr = new Set<GhRetrofitId>(labels.get(p.propertyId)?.feasible ?? []);
    for (const r of GH_RETROFIT_ORDER) {
      if (pr.has(r) && tr.has(r)) tp++;
      else if (pr.has(r)) fp++;
      else if (tr.has(r)) fn++;
      // Baseline: recommend the brief's five headline retrofits to every home.
      const bset = new Set<GhRetrofitId>(['loft', 'heat-pump', 'solar', 'glazing', 'smart-thermostat']);
      if (bset.has(r) && tr.has(r)) btp++;
      else if (bset.has(r)) bfp++;
      else if (tr.has(r)) bfn++;
    }
  }
  const prf = (a: number, b: number, c: number) => ({ precision: r3(a / Math.max(1, a + b)), recall: r3(a / Math.max(1, a + c)), f1: r3((2 * a) / Math.max(1, 2 * a + b + c)) });
  // 4. Value range coverage of the reference value impact.
  const vv = ps.filter((p) => assess.get(p.propertyId)?.value.upliftPct && labels.get(p.propertyId)?.valueImpactPct !== null);
  const covered = vv.filter((p) => {
    const r = assess.get(p.propertyId)?.value.upliftPct as { lo: number; hi: number };
    const t = labels.get(p.propertyId)?.valueImpactPct as number;
    return t >= r.lo - 0.05 && t <= r.hi + 0.05;
  }).length;
  const width = vv.reduce((s, p) => {
    const r = assess.get(p.propertyId)?.value.upliftPct as { lo: number; hi: number };
    return s + (r.hi - r.lo);
  }, 0);
  const coveredBase = vv.filter((p) => {
    const t = labels.get(p.propertyId)?.valueImpactPct as number;
    return t >= 2 && t <= 5;
  }).length;
  return {
    split,
    homes: ps.length,
    potential: {
      evaluated: both.length,
      unavailable: ps.filter((p) => assess.get(p.propertyId)?.potential.status === 'unavailable').length,
      spearman: r3(spearman(pred, truth)),
      top20Overlap: r3(topOverlap(pred, truth)),
      maePctPoints: r1(mae(pred, truth)),
      baseline: { name: 'mean train label by recorded EPC band', spearman: r3(spearman(base, truth)), top20Overlap: r3(topOverlap(base, truth)), maePctPoints: r1(mae(base, truth)) },
    },
    savings: {
      evaluated: sv.length,
      electricityMaeKwh: Math.round(mae(pe, te)),
      gasMaeKwh: Math.round(mae(pg, tg)),
      medianLabelElectricityKwh: Math.round(median(te)),
      medianLabelGasKwh: Math.round(median(tg)),
      electricitySignAgreement: r3(signAgree),
      baseline: { name: 'median train saving fraction per fuel x metered use', electricityMaeKwh: Math.round(mae(be, te)), gasMaeKwh: Math.round(mae(bg, tg)) },
    },
    feasibility: { ...prf(tp, fp, fn), baseline: { name: 'the five headline retrofits for every home', ...prf(btp, bfp, bfn) } },
    value: {
      evaluated: vv.length,
      coverage: r3(covered / Math.max(1, vv.length)),
      meanWidthPctPoints: r1(width / Math.max(1, vv.length)),
      baseline: { name: 'fixed 2 to 5% range (brief example)', coverage: r3(coveredBase / Math.max(1, vv.length)), meanWidthPctPoints: 3 },
    },
  };
}

const results = { generatedFrom: 'packages/fixtures/src/portfolio (seed 10001)', validation: evaluate('validation'), test: evaluate('test') };

const write = (name: string, text: string) => {
  const p = join(DIR, name);
  writeFileSync(`${p}.tmp`, text);
  renameSync(`${p}.tmp`, p);
};
write('evaluation.json', `${JSON.stringify(results, null, 2)}\n`);

const row = (name: string, v: ReturnType<typeof evaluate>) =>
  [
    `| ${name} | ${v.homes} | ${v.potential.spearman} (base ${v.potential.baseline.spearman}) | ${v.potential.top20Overlap} (base ${v.potential.baseline.top20Overlap}) | ${v.potential.maePctPoints} (base ${v.potential.baseline.maePctPoints}) |`,
    `| | | electricity MAE ${v.savings.electricityMaeKwh} kWh (base ${v.savings.baseline.electricityMaeKwh}) | gas MAE ${v.savings.gasMaeKwh} kWh (base ${v.savings.baseline.gasMaeKwh}) | sign agreement ${v.savings.electricitySignAgreement} |`,
    `| | | feasibility P ${v.feasibility.precision} R ${v.feasibility.recall} F1 ${v.feasibility.f1} (base F1 ${v.feasibility.baseline.f1}) | value coverage ${v.value.coverage}, width ${v.value.meanWidthPctPoints} pts (base ${v.value.baseline.coverage}) | potential unavailable ${v.potential.unavailable} |`,
  ].join('\n');
write(
  'evaluation.md',
  `${['| Split | Homes | Potential: Spearman | Top 20% overlap | MAE (points) |', '|---|---|---|---|---|', row('validation', results.validation), row('test', results.test)].join('\n')}\n`,
);

// Held-out test predictions (brief 13 I).
const cell = (v: unknown) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const lines = [
  'propertyId,score,band,poorFlag,keyIssues,potentialPct,potentialStatus,recommended,packageElecSavingKwh,packageGasSavingKwh,packageCarbonKg,ratingBefore,ratingAfter,valueLoGBP,valueHiGBP,valueUpliftLoPct,valueUpliftHiPct',
  ...props
    .filter((p) => p.split === 'test')
    .map((p) => {
      const a = assess.get(p.propertyId) as GhAssessment;
      return [
        p.propertyId,
        a.score.score,
        a.score.band,
        a.poor.flagged,
        a.poor.issues.map((x) => x.id).join(' '),
        a.potential.pct,
        a.potential.status,
        a.recommendations.map((r) => `${r.retrofitId}:${r.suitability}`).join(' '),
        a.package?.saving.electricityKwh,
        a.package?.saving.gasKwh,
        a.package?.saving.carbonKg,
        a.package?.ratingBefore,
        a.package?.ratingAfter,
        a.value.valueGBP?.lo,
        a.value.valueGBP?.hi,
        a.value.upliftPct?.lo,
        a.value.upliftPct?.hi,
      ]
        .map(cell)
        .join(',');
    }),
];
write('test_predictions.csv', `${lines.join('\n')}\n`);
console.log(JSON.stringify(results, null, 1));
