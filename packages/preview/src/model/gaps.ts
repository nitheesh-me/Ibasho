/**
 * Goal gaps (SPEC 27 step 1 and AC-PD3): where a design stands against each typed target, as met,
 * not met or unknown, with the value, the bar and the source. Ranges decide: met only when the
 * whole range clears the bar, not met only when none of it does.
 */
import type {
  BaselineRow,
  BuildingResult,
  CodeRow,
  Goal,
  GoalGap,
  OptimiseResult,
  RatingRow,
  ScopedGoal,
  SourceRef,
} from '@ibasho/core';
import { GOAL_PRESETS } from '@ibasho/core';

const ref = (id: string, title: string, url: string): SourceRef => ({
  id,
  title,
  url,
  retrieved: '2026-10-11',
});
const NZ: Record<string, { euiMax: number; title: string; source: SourceRef }> = {
  'uk-nzcbs': {
    euiMax: 70,
    title:
      'UK NZCBS pilot: no fossil fuel on site; office EUI about 70 kWh/m2.yr (55 to 85 by type), homes about 35',
    source: ref(
      'uk-nzcbs',
      'UK Net Zero Carbon Buildings Standard (pilot version, 2024)',
      'https://www.nzcbuildings.co.uk',
    ),
  },
  'in-nzeb': {
    euiMax: 90,
    title:
      'Net zero energy ready (India): no diesel or gas for regular use and EUI at most about 90 kWh/m2.yr (estimate)',
    source: ref('bee-nzeb', 'BEE ECSBC 2024 and NZEB guidance (estimate)', 'https://beeindia.gov.in'),
  },
};

function band(lo: number, hi: number, max: number): GoalGap['status'] {
  return hi <= max ? 'met' : lo > max ? 'not-met' : 'unknown';
}
function fromRows(rows: readonly CodeRow[]): GoalGap['status'] {
  if (rows.length === 0) return 'unknown';
  if (rows.some((r) => r.status === false)) return 'not-met';
  return rows.every((r) => r.status === true) ? 'met' : 'unknown';
}

export interface GapInputs {
  codes: readonly CodeRow[];
  ratings: readonly RatingRow[];
  baselines: readonly BaselineRow[];
  energy: BuildingResult;
  optimise?: OptimiseResult;
}

/** ECSBC tiers on the EPI ratio (estimates until WP-19): Compliant 1, Plus 0.85, Super 0.7. */
const ECSBC_TIER: Record<number, number> = { 1: 1, 2: 0.85, 3: 0.7 };
/** LEED v4.1 levels by total points; the Preview reads only Optimize Energy Performance points. */
const LEED_LEVELS: Record<string, number> = { Certified: 40, Silver: 50, Gold: 60, Platinum: 80 };

export function goalGap(goal: Goal, x: GapInputs, presetId?: string): GoalGap {
  const preset =
    GOAL_PRESETS.find((p) => p.id === presetId) ??
    GOAL_PRESETS.find((p) => JSON.stringify(p.goal) === JSON.stringify(goal));
  const sources = preset?.sources ?? [];
  const base = { ...(preset ? { presetId: preset.id } : {}), goal, sources, grade: 'estimate' as const };
  const eui = x.energy.eui.site;
  switch (goal.kind) {
    case 'eui':
      return {
        ...base,
        status: band(eui.lo, eui.hi, goal.max),
        value: eui,
        target: goal.max,
        unit: 'kWh/m2.yr',
        reason: 'goals.gap.eui',
      };
    case 'carbon': {
      const kg = Number(x.energy.carbon.op) / 1000;
      return {
        ...base,
        status: band(kg * 0.85, kg * 1.15, Number(goal.max) / 1000),
        value: { lo: kg * 0.85, hi: kg * 1.15 },
        target: Number(goal.max) / 1000,
        unit: 'kgCO2e',
        reason: 'goals.gap.carbon',
      };
    }
    case 'code': {
      if (goal.ruleStem === 'ECSBC' && goal.tier) {
        const r = x.baselines.find((b) => b.code.startsWith('ECSBC'))?.ratio;
        const bar = ECSBC_TIER[goal.tier] ?? 1;
        if (!r) return { ...base, status: 'unknown', reason: 'goals.gap.no-baseline' };
        return {
          ...base,
          status: band(r.lo, r.hi, bar),
          value: r,
          target: bar,
          unit: '1',
          ruleIds: ['ECSBC.EPI-RATIO'],
          reason: 'goals.gap.ecsbc-tier',
        };
      }
      const rows = x.codes.filter((c) => c.ruleId.startsWith(goal.ruleStem));
      return {
        ...base,
        status: fromRows(rows),
        ruleIds: rows.map((r) => r.ruleId),
        reason: rows.length ? 'goals.gap.code' : 'goals.gap.code-not-here',
      };
    }
    case 'rating': {
      const row = x.ratings.find((r) => r.scheme === goal.scheme);
      if (goal.scheme === 'LEED') {
        // Only the energy credit is estimated, so a whole-scheme level stays unknown unless energy alone
        // already rules it out (Gold needs 60 points; energy gives at most 18 of them).
        const need = LEED_LEVELS[goal.level] ?? 60;
        const ea =
          row && row.points.likely !== 'unknown' ? (row.points.possible ?? row.points.likely) : undefined;
        return {
          ...base,
          status: 'unknown',
          ...(ea !== undefined ? { value: { lo: ea, hi: ea } } : {}),
          target: need,
          unit: 'pts',
          ruleIds: row ? [`rating.${row.scheme}`] : [],
          reason: 'goals.gap.leed-partial',
        };
      }
      if (!row) return { ...base, status: 'unknown', reason: 'goals.gap.rating-not-here' };
      const likely = row.level.likely;
      const possible = row.level.possible;
      const status: GoalGap['status'] =
        likely === goal.level ? 'met' : possible === goal.level ? 'unknown' : 'unknown';
      return { ...base, status, ruleIds: [`rating.${row.scheme}`], reason: 'goals.gap.rating' };
    }
    case 'net-zero-ready': {
      const fossil = x.energy.bills.some(
        (b) => b.carrier === 'gas' || b.carrier === 'diesel' || b.carrier === 'lpg',
      );
      if (goal.basis === 'fhs-2025' || goal.basis === 'london-plan') {
        const id = goal.basis === 'fhs-2025' ? 'UK.FHS.2025' : 'LONDON.PLAN.SI2';
        const rows = x.codes.filter((c) => c.ruleId === id);
        return {
          ...base,
          status: fossil ? 'not-met' : fromRows(rows),
          ruleIds: [id],
          reason: fossil ? 'goals.gap.fossil-fuel' : 'goals.gap.code',
        };
      }
      const nz = NZ[goal.basis];
      if (!nz) return { ...base, status: 'unknown', reason: 'goals.gap.unknown-basis' };
      const st = fossil ? 'not-met' : band(eui.lo, eui.hi, nz.euiMax);
      return {
        ...base,
        sources: sources.length ? sources : [nz.source],
        status: st,
        value: eui,
        target: nz.euiMax,
        unit: 'kWh/m2.yr',
        reason: fossil ? 'goals.gap.fossil-fuel' : 'goals.gap.nz-eui',
      };
    }
    case 'lowest-opex': {
      const opt = x.optimise;
      const at = opt?.objectives.findIndex((o) => o.id === 'opex') ?? -1;
      const baseC = opt?.candidates.find((c) => /^c0+$/.test(c.id));
      if (!opt || at < 0 || !baseC) return { ...base, status: 'unknown', reason: 'goals.gap.needs-optimise' };
      const best = opt.candidates
        .filter((c) => c.feasible)
        .reduce((m, c) => ((c.axes[at] ?? 0n) < m ? (c.axes[at] ?? 0n) : m), baseC.axes[at] ?? 0n);
      const now = baseC.axes[at] ?? 0n;
      return {
        ...base,
        status: now <= best ? 'met' : 'not-met',
        value: { lo: Number(now), hi: Number(now) },
        target: Number(best),
        unit: x.energy.bills[0]?.currency ?? 'INR',
        reason: 'goals.gap.lowest-opex',
      };
    }
    case 'budget':
    case 'payback':
    case 'comfort':
    case 'daylight':
      return { ...base, status: 'unknown', reason: `goals.gap.${goal.kind}` };
  }
}

export function goalGaps(goals: readonly ScopedGoal[], x: GapInputs): GoalGap[] {
  return goals.map((g) => goalGap(g.goal, x));
}
