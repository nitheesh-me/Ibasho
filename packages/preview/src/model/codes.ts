/**
 * Preview code pre-checks and rating ladder (SPEC 23, R34 to R36). Thresholds are estimates
 * (grade `estimate`) from the EC brief until WP-19 reads them from the code PDFs; the word
 * "compliant" never appears. Statuses follow the facts: unknown glazing or build-ups give
 * `unknown`, an unknown permit date gives `adoption-unconfirmed` (AC-CD4).
 */
import type {
  BaselineRow,
  BuildingDoc,
  BuildingResult,
  CodeRow,
  CompiledBuilding,
  RatingRow,
  RatingStep,
} from '@ibasho/core';
import { isZoneTwin, ratingStepFor } from '@ibasho/core';
import { loadsFor } from './space-types.ts';

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Benchmark EUI by type for the savings axis (BEE and ECSBC standard design, estimates). */
const BASELINE_EUI: Record<string, number> = {
  office: 180,
  education: 150,
  hotel: 260,
  hospital: 330,
  lab: 300,
  apartments: 75,
  rental: 75,
  'single-family': 140,
};

/** LPD limits (W/m²) by type, ECBC 2017 building area method (estimates until WP-19 checks the table). */
const LPD_LIMIT: Record<string, number> = {
  office: 9.5,
  education: 10,
  hotel: 9.5,
  hospital: 9.7,
  lab: 11.5,
};

/** ENS 2018 RETV coefficients for the composite climate and orientation factors below 23.5 N. */
const RETV = { a: 6.06, b: 1.85, c: 68.99 };
const OMEGA: Record<string, number> = {
  N: 0.659,
  NE: 0.906,
  E: 1.155,
  SE: 1.125,
  S: 0.966,
  SW: 1.124,
  W: 1.156,
  NW: 0.904,
};

/** Pass, fail or unknown from a range against an upper limit (lower is better). */
const vsMax = (lo: number, hi: number, limit: number): CodeRow['status'] =>
  hi <= limit ? true : lo > limit ? false : 'unknown';
/** Pass, fail or unknown from a range against a lower limit (higher is better). */
const vsMin = (lo: number, hi: number, limit: number): CodeRow['status'] =>
  lo >= limit ? true : hi < limit ? false : 'unknown';

const GHMC: RatingStep[] = [5, 10, 15, 20, 25, 30].map((s, i) => ({
  atLeast: s,
  points: i + 1,
  level: `${i + 1} star`,
}));
const LEED: RatingStep[] = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 29, 32, 35, 38, 42, 46, 50].map(
  (s, i) => ({
    atLeast: s,
    points: i + 1,
    level: `${i + 1} of 18`,
  }),
);
const EDGE: RatingStep[] = [
  { atLeast: 20, points: 1, level: 'EDGE Certified' },
  { atLeast: 40, points: 2, level: 'EDGE Advanced' },
];
const IGBC: RatingStep[] = [10, 15, 20, 25, 30, 35, 40].map((s, i) => ({
  atLeast: s,
  points: i + 2,
  level: `${i + 2} points`,
}));

function ladderRow(
  scheme: string,
  edition: string,
  steps: RatingStep[],
  savings: { lo: number; hi: number },
  applicability: RatingRow['applicability'],
): RatingRow {
  const likelyStep = ratingStepFor(steps, (savings.lo + savings.hi) / 2);
  const possibleStep = ratingStepFor(steps, savings.hi);
  return {
    scheme,
    edition,
    metric: 'savings.pct',
    value: savings,
    points: { likely: likelyStep?.points ?? 0, ...(possibleStep ? { possible: possibleStep.points } : {}) },
    level: { likely: likelyStep?.level ?? 'none', ...(possibleStep ? { possible: possibleStep.level } : {}) },
    applicability,
    grade: 'estimate',
  };
}

export interface CodesCore {
  codes: CodeRow[];
  ratings: RatingRow[];
  baselines: BaselineRow[];
}

/**
 * `baselineEui` is the reference design's EUI (same geometry, code envelope and lighting) from
 * the Preview energy model; absent, the type benchmark stands in.
 */
export function codesModel(
  doc: BuildingDoc | undefined,
  compiled: CompiledBuilding,
  energy: BuildingResult,
  codePackIds: readonly string[],
  baselineEui?: number,
): CodesCore {
  const typeId = doc?.typeId ?? (isZoneTwin(compiled.twin) ? compiled.twin.typeId : 'single-family');
  const india = codePackIds.some((p) => p.endsWith('-in'));
  const bua = Number(compiled.quantities.gfaMm2) / 1e6;
  const permit = doc?.permitDate;
  const edApp = (from: string): CodeRow['applicability'] =>
    permit === undefined ? 'adoption-unconfirmed' : permit >= from ? 'reference' : 'not-a-certificate';
  const base = baselineEui ?? BASELINE_EUI[typeId] ?? 150;
  const ratio = {
    lo: Math.round((energy.eui.site.lo / base) * 1000) / 1000,
    hi: Math.round((energy.eui.site.hi / base) * 1000) / 1000,
  };
  const baselines: BaselineRow[] = [
    {
      code: 'ECSBC 2024',
      builderId: 'preview.baseline.ecsbc',
      eui: { lo: r1(base * 0.95), hi: r1(base * 1.05) },
      ratio,
    },
  ];
  const savings = {
    lo: r1((1 - energy.eui.site.hi / base) * 100),
    hi: r1((1 - energy.eui.site.lo / base) * 100),
  };
  const codes: CodeRow[] = [];
  const ratings: RatingRow[] = [];
  if (!india) {
    codes.push({
      ruleId: 'UK.EPC.ESTIMATE',
      edition: 'SAP 10.2',
      status: 'unknown',
      applicability: 'not-a-certificate',
      grade: 'estimate',
      clause: 'RdSAP',
      unknownFacts: ['h.wall.u', 'h.roof.u'],
    });
    return { codes, ratings, baselines };
  }
  // Area thresholds: inside the geometry uncertainty (plans measured within 10%) the answer is unknown.
  const nearArea = (limit: number): CodeRow['status'] =>
    Math.abs(bua - limit) < bua * 0.1 ? 'unknown' : bua > limit;
  const facades = compiled.quantities.facades;
  const gross = facades.reduce((s, f) => s + f.grossMm2, 0n);
  const open = facades.reduce((s, f) => s + f.openingMm2, 0n);
  const wwr = gross > 0n ? Number((open * 10_000n) / gross) / 100 : 0;
  const nonRes = !['apartments', 'rental', 'single-family'].includes(typeId);
  const late = ['studio.code.near-threshold'];
  if (nonRes) {
    const scope = nearArea(2000);
    codes.push({
      ruleId: 'TSECBC.SCOPE',
      edition: '2014',
      status: scope,
      applicability: 'reference',
      grade: 'estimate',
      clause: 'G.O. Ms. 30 (2014): built-up area over 2,000 m²',
      margin: { value: Math.round(bua - 2000), unit: 'm2' },
      ...(scope === 'unknown' ? { unknownFacts: late } : {}),
    });
    codes.push({
      ruleId: 'ECBC.ENV.WWR',
      edition: '2017',
      status: wwr <= 40,
      metric: 'wwr',
      margin: { value: r1(40 - wwr), unit: '%' },
      applicability: edApp('2017-06-19'),
      grade: 'estimate',
      clause: '4.3.3',
    });
    for (const [ruleId, metric, clause, fact] of [
      ['ECBC.ENV.SHGC', 'shgc.eff', '4.3.3', 'z.glazing.shgc'],
      ['ECBC.ENV.UWALL', 'u.wall', '4.3.2', 'b.wall.u'],
      ['ECBC.ENV.UROOF', 'u.roof', '4.3.1', 'b.roof.u'],
    ] as const) {
      codes.push({
        ruleId,
        edition: '2017',
        status: 'unknown',
        metric,
        applicability: edApp('2017-06-19'),
        grade: 'estimate',
        clause,
        unknownFacts: [fact],
      });
    }
    const lpd = (() => {
      if (!isZoneTwin(compiled.twin)) return 0;
      let w = 0;
      let a = 0;
      for (const z of compiled.twin.zones) {
        const m2 = Number(z.floorMm2) / 1e6;
        w += loadsFor(z.spaceTypeIds[0]).loads.lpd * m2;
        a += m2;
      }
      return a ? r1(w / a) : 0;
    })();
    const lpdLimit = LPD_LIMIT[typeId] ?? 10;
    codes.push({
      ruleId: 'ECBC.LTG.LPD',
      edition: '2017',
      status: lpd <= lpdLimit,
      metric: 'lpd',
      margin: { value: r1(lpdLimit - lpd), unit: 'W/m2' },
      applicability: edApp('2017-06-19'),
      grade: 'estimate',
      clause: `6.3.2 building area method, ${typeId} ${lpdLimit} W/m²`,
    });
    // ECSBC performance method: proposed EPI over the reference design's (ratio at most 1).
    const epi = vsMax(ratio.lo, ratio.hi, 1);
    codes.push({
      ruleId: 'ECSBC.EPI-RATIO',
      edition: '2024',
      status: epi,
      metric: 'epi.ratio',
      margin: { value: Math.round((1 - (ratio.lo + ratio.hi) / 2) * 1000) / 1000, unit: '1' },
      applicability: edApp('2024-09-27'),
      grade: 'estimate',
      clause: 'performance method: EPI ratio against the standard design',
      ...(epi === 'unknown' ? { unknownFacts: ['studio.code.range-straddles-limit'] } : {}),
    });
    const mop = nearArea(20_000);
    codes.push({
      ruleId: 'MOP.2026.RATING',
      edition: '2026 draft',
      status: mop,
      applicability: 'adoption-unconfirmed',
      grade: 'announced',
      clause: 'mandatory rating at 20,000 m² connected area (draft)',
      margin: { value: Math.round(bua - 20_000), unit: 'm2' },
      ...(mop === 'unknown' ? { unknownFacts: late } : {}),
    });
    const vs = ' (savings against the ECSBC reference design)';
    ratings.push(ladderRow('GHMC-stars', `2024${vs}`, GHMC, savings, 'partial'));
    ratings.push(ladderRow('LEED', `v4.1 EAc${vs}`, LEED, savings, 'not-a-certificate'));
    ratings.push(ladderRow('IGBC', `Green New Buildings v3${vs}`, IGBC, savings, 'not-a-certificate'));
    ratings.push(ladderRow('EDGE', `v3${vs}`, EDGE, savings, 'not-a-certificate'));
    ratings.push({
      scheme: 'BEE-star',
      edition: '2023',
      metric: 'epi',
      value: energy.eui.site,
      points: { likely: 'unknown' },
      level: { likely: 'unknown' },
      applicability: 'professional',
      grade: 'estimate',
    });
  } else {
    // ENS 2018 RETV over walls and windows (roof excluded), with unknown U and SHGC as ranges.
    let lo = 0;
    let hi = 0;
    let env = 0;
    for (const f of facades) {
      const w = OMEGA[f.bin] ?? 1;
      const aw = Number(f.openingMm2) / 1e6;
      const ao = Number(f.grossMm2 - f.openingMm2) / 1e6;
      env += aw + ao;
      lo += RETV.a * 1.5 * ao * w + RETV.b * 4.5 * aw * w + RETV.c * 0.45 * aw * w;
      hi += RETV.a * 2.5 * ao * w + RETV.b * 5.8 * aw * w + RETV.c * 0.75 * aw * w;
    }
    const retv = { lo: env ? lo / env : 0, hi: env ? hi / env : 0 };
    const rs = vsMax(retv.lo, retv.hi, 15);
    codes.push({
      ruleId: 'ENS.RETV',
      edition: '2018',
      status: rs,
      metric: 'retv',
      margin: { value: r1(15 - (retv.lo + retv.hi) / 2), unit: 'W/m2' },
      applicability: edApp('2018-12-14'),
      grade: 'estimate',
      clause: 'Part 1, RETV at most 15 W/m² (composite), wall U 1.5 to 2.5 and SHGC 0.45 to 0.75 assumed',
      ...(rs === 'unknown' ? { unknownFacts: ['b.wall.u', 'z.glazing.shgc'] } : {}),
    });
    codes.push({
      ruleId: 'ENS.UROOF',
      edition: '2018',
      status: 'unknown',
      metric: 'u.roof',
      applicability: edApp('2018-12-14'),
      grade: 'estimate',
      clause: 'Part 1, U roof at most 1.2',
      unknownFacts: ['b.roof.u'],
    });
    // Openable window to floor area (WFR_op), openable share of each window 50% to 80% (unknown).
    const floor = Number(compiled.quantities.ncaMm2) / 1e6;
    const winA = Number(open) / 1e6;
    const wfr = { lo: floor ? (winA * 0.5 * 100) / floor : 0, hi: floor ? (winA * 0.8 * 100) / floor : 0 };
    const ws = vsMin(wfr.lo, wfr.hi, 12.5);
    codes.push({
      ruleId: 'ENS.OPENABLE',
      edition: '2018',
      status: ws,
      metric: 'wfr.op',
      margin: { value: r1((wfr.lo + wfr.hi) / 2 - 12.5), unit: '%' },
      applicability: edApp('2018-12-14'),
      grade: 'estimate',
      clause: 'openable window to floor area at least 12.5% (composite)',
      ...(ws === 'unknown' ? { unknownFacts: ['z.openableM2'] } : {}),
    });
    codes.push({
      ruleId: 'RULES.IN.ROOF-RIGHTS',
      edition: '2026',
      status: 'unknown',
      applicability: 'professional',
      grade: 'estimate',
      clause: 'association consent for rooftop PV',
      unknownFacts: ['b.rooftopRights'],
    });
    const vs = ' (savings against the ECSBC reference design)';
    ratings.push(ladderRow('GHMC-stars', `2024${vs}`, GHMC, savings, 'partial'));
    ratings.push(ladderRow('EDGE', `v3${vs}`, EDGE, savings, 'not-a-certificate'));
  }
  return { codes, ratings, baselines };
}
