/**
 * Memory scopes, typed goals and objectives (ARCH 15.4, AR 3.1 and 3.2, SPEC R37, R42, 25).
 * Owner: WP-00 (contract); WP-05 resolves scopes, WP-20 optimises, WP-08 edits goals.
 */

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
  | { kind: 'daylight'; sdaMin?: number; aseMax?: number };
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
