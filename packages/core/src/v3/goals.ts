/**
 * Memory scopes, typed goals and objectives (ARCH 15.4, AR 3.1 and 3.2, SPEC R37, R42, 25).
 * Owner: WP-00 (contract); WP-05 resolves scopes, WP-20 optimises, WP-08 edits goals.
 */

import type { Grade, MessageKey, RegionCode, SourceRef } from '../common.ts';

/** Scope levels, outermost first. Resolution is "nearest scope wins" (AR 3.1). */
export type ScopeLevel = 'owner' | 'portfolio' | 'project' | 'building' | 'variant';
export const SCOPE_LEVELS: readonly ScopeLevel[] = ['owner', 'portfolio', 'project', 'building', 'variant'];

export interface MemoryScope {
  level: ScopeLevel;
  id: string;
}
/** Outermost first; the last entry is the nearest scope. */
export type ScopeChain = readonly MemoryScope[];

/**
 * Nearest scope wins: walk the chain from the nearest scope outwards and return the first value
 * defined at that scope, with the scope it came from (for the origin chip).
 */
export function resolveScoped<T>(
  chain: ScopeChain,
  valueAt: (scope: MemoryScope) => T | undefined,
): { value: T; from: MemoryScope } | undefined {
  for (let i = chain.length - 1; i >= 0; i--) {
    const s = chain[i] as MemoryScope;
    const v = valueAt(s);
    if (v !== undefined) return { value: v, from: s };
  }
  return undefined;
}

/** Typed goals (R42). Money in the place's minor unit (micro-paise or micro-pence). */
export type Goal =
  | { kind: 'eui'; max: number }
  | { kind: 'code'; ruleStem: string; tier?: 1 | 2 | 3 }
  | { kind: 'rating'; scheme: string; level: string }
  | { kind: 'budget'; max: bigint; currency?: 'INR' | 'GBP' }
  | { kind: 'payback'; maxYears: number }
  | { kind: 'carbon'; max: bigint }
  | { kind: 'comfort'; minHours: number }
  | { kind: 'daylight'; sdaMin?: number; aseMax?: number }
  /** Net zero ready against a named basis (SPEC 27): no fossil fuel on site plus an EUI or fabric bar. */
  | { kind: 'net-zero-ready'; basis: NetZeroBasis }
  /** The lowest running cost the design space allows (an objective read as a target). */
  | { kind: 'lowest-opex' };
export type GoalKind = Goal['kind'];
export const GOAL_KINDS: readonly GoalKind[] = [
  'eui',
  'code',
  'rating',
  'budget',
  'payback',
  'carbon',
  'comfort',
  'daylight',
  'net-zero-ready',
  'lowest-opex',
];

/** Bases for `net-zero-ready`: UK Net Zero Carbon Buildings Standard (pilot), Future Homes and
 * Buildings Standard 2025, London Plan net zero carbon target, India NZEB (EUI with no fossil fuel). */
export type NetZeroBasis = 'uk-nzcbs' | 'fhs-2025' | 'london-plan' | 'in-nzeb';

/** Where a design stands against one goal (SPEC 27, AC-PD3). Never "compliant" or "certified". */
export type GapStatus = 'met' | 'not-met' | 'unknown';
export interface GoalGap {
  /** Preset id when the goal came from `GOAL_PRESETS`. */
  presetId?: string;
  goal: Goal;
  status: GapStatus;
  /** The design's value as a range, in `unit`. */
  value?: { lo: number; hi: number };
  /** The bar it is judged against, in `unit`. */
  target?: number;
  unit?: string;
  /** Code, rating or baseline rows the status reads. */
  ruleIds?: string[];
  reason: MessageKey;
  sources: SourceRef[];
  grade: Grade;
}

/** Ready-made targets offered in the brief (SPEC 27 step 1), each with the source of its bar. */
export interface GoalPreset {
  id: string;
  label: MessageKey;
  goal: Goal;
  /** Where the target applies; absent means anywhere. */
  regions?: RegionCode[];
  sources: SourceRef[];
}

const ref = (id: string, title: string, url: string): SourceRef => ({
  id,
  title,
  url,
  retrieved: '2026-10-11',
});

export const GOAL_PRESETS: readonly GoalPreset[] = [
  {
    id: 'net-zero-ready-uk',
    label: 'goals.preset.net-zero-ready-uk',
    goal: { kind: 'net-zero-ready', basis: 'uk-nzcbs' },
    regions: ['GB'],
    sources: [
      ref(
        'uk-nzcbs',
        'UK Net Zero Carbon Buildings Standard (pilot version, 2024)',
        'https://www.nzcbuildings.co.uk',
      ),
    ],
  },
  {
    id: 'fhs-2025',
    label: 'goals.preset.fhs-2025',
    goal: { kind: 'net-zero-ready', basis: 'fhs-2025' },
    regions: ['GB-ENG'],
    sources: [
      ref(
        'fhs-2025',
        'Future Homes and Buildings Standards: 2023 consultation and 2025 response (MHCLG)',
        'https://www.gov.uk/government/consultations/the-future-homes-and-buildings-standards-2023-consultation',
      ),
    ],
  },
  {
    id: 'part-l',
    label: 'goals.preset.part-l',
    goal: { kind: 'code', ruleStem: 'UK.PARTL' },
    regions: ['GB-ENG'],
    sources: [
      ref(
        'ad-l-2021',
        'Approved Document L, 2021 edition (incorporating 2023 amendments)',
        'https://www.gov.uk/government/publications/conservation-of-fuel-and-power-approved-document-l',
      ),
    ],
  },
  {
    id: 'london-plan',
    label: 'goals.preset.london-plan',
    goal: { kind: 'net-zero-ready', basis: 'london-plan' },
    regions: ['GB-ENG'],
    sources: [
      ref(
        'london-plan-si2',
        'London Plan 2021 Policy SI 2 and GLA Energy Assessment Guidance (2022)',
        'https://www.london.gov.uk/programmes-strategies/planning/london-plan/the-london-plan-2021-table-contents/chapter-9-sustainable-infrastructure/policy-si-2-minimising-greenhouse-gas-emissions',
      ),
    ],
  },
  {
    id: 'ecsbc-super',
    label: 'goals.preset.ecsbc-super',
    goal: { kind: 'code', ruleStem: 'ECSBC', tier: 3 },
    regions: ['IN'],
    sources: [
      ref(
        'ecsbc-2024',
        'Energy Conservation and Sustainable Building Code 2024 (BEE)',
        'https://beeindia.gov.in',
      ),
    ],
  },
  {
    id: 'leed-gold',
    label: 'goals.preset.leed-gold',
    goal: { kind: 'rating', scheme: 'LEED', level: 'Gold' },
    sources: [
      ref(
        'leed-v41-bdc',
        'LEED v4.1 BD+C rating system (USGBC): Gold is 60 to 79 points',
        'https://www.usgbc.org/leed/v41',
      ),
    ],
  },
  {
    id: 'lowest-opex',
    label: 'goals.preset.lowest-opex',
    goal: { kind: 'lowest-opex' },
    sources: [ref('ibasho', 'Ibasho optimiser: the lowest running cost option on the front', 'docs/SPEC.md')],
  },
];

export type GoalStrength = 'must' | 'prefer' | 'nice';

export interface ScopedGoal {
  goal: Goal;
  scope: MemoryScope;
  strength: GoalStrength;
}

/** Pareto axes (R37): 2 to 4 integer axes, each with a direction. */
export type ObjectiveId = 'capex' | 'opex' | 'eui' | 'carbon' | 'comfort' | 'sda' | 'ase' | 'npv';
export const OBJECTIVE_IDS: readonly ObjectiveId[] = [
  'capex',
  'opex',
  'eui',
  'carbon',
  'comfort',
  'sda',
  'ase',
  'npv',
];
export interface Objective {
  id: ObjectiveId;
  dir: 'min' | 'max';
}
/** Default axes for non-home types (R37). Homes keep R7 and R8. */
export const DEFAULT_OBJECTIVES: readonly Objective[] = [
  { id: 'capex', dir: 'min' },
  { id: 'opex', dir: 'min' },
  { id: 'eui', dir: 'min' },
];
