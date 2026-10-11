/**
 * Settings ledger (ARCH 15.4, UV 7, SPEC R41, 24). Owner: WP-00 (contract); WP-08 implements the
 * ledger, store and stale marking, WP-09 writes the copy.
 *
 * Resolution: scenario over building over place over app over pack default. Changing a setting
 * marks every quantity in `affects` stale before recompute (AC-U1, AC-SET2).
 */
import type { Grade, SourceRef } from '../common.ts';
import type { QuantityId } from '../evidence/types.ts';
import type { Ival } from '../ival.ts';
import type { Unit } from '../units.ts';

export type SettingGroup =
  | 'money'
  | 'carbon'
  | 'comfort'
  | 'codes'
  | 'weather'
  | 'analysis'
  | 'render'
  | 'display'
  | 'privacy';
export const SETTING_GROUPS: readonly SettingGroup[] = [
  'money',
  'carbon',
  'comfort',
  'codes',
  'weather',
  'analysis',
  'render',
  'display',
  'privacy',
];

/** `<group>.<name>`, e.g. `money.tariff.elec`, `carbon.grid.factor`, `analysis.resolution`. */
export type SettingId = `${SettingGroup}.${string}`;

export type SettingScope = 'app' | 'place' | 'building' | 'scenario';
/** Most specific first: the order `resolveSetting` tries. */
export const SETTING_SCOPES_NEAREST_FIRST: readonly SettingScope[] = ['scenario', 'building', 'place', 'app'];

/** Where a value came from, for the origin chip ("Your value", "TGSPDCL FY 2026-27", "Pack default"). */
export type SettingOrigin = 'user' | 'pack' | 'preset' | 'default';

export interface Setting<T = unknown> {
  id: SettingId;
  value: T;
  unit?: Unit;
  /** Unknown is a range, not zero. */
  range?: Ival;
  source: SourceRef;
  grade: Grade;
  scope: SettingScope;
  /** Id of the place, building or scenario; absent for `app`. */
  scopeId?: string;
  depth: 'plain' | 'pro';
  /**
   * Quantities this setting feeds. A trailing `*` matches a prefix (`bill.*`). Render settings
   * have none (render quality never changes a number, R41).
   */
  affects: QuantityId[];
  origin: SettingOrigin;
}

/** Registry entry for a setting: the pack default and its metadata (AC-SET1). */
export interface SettingDef<T = unknown> {
  id: SettingId;
  group: SettingGroup;
  label: string;
  default: Omit<Setting<T>, 'scope' | 'scopeId' | 'origin'>;
  /** Allowed scopes; render and display settings are `app` only. */
  scopes: SettingScope[];
  /** Plain control choices, when the setting is a pick from a list. */
  choices?: { value: T; label: string }[];
}

/** Where a setting is being read: the ids of each enclosing scope. */
export interface SettingContext {
  placeId?: string;
  buildingId?: string;
  scenarioId?: string;
}

/**
 * Effective value of a setting: the nearest scope with a stored value, else the pack default.
 * `stored` holds every stored `Setting` for this id (any scope).
 */
export function resolveSetting<T>(
  def: SettingDef<T>,
  stored: readonly Setting<T>[],
  ctx: SettingContext,
): Setting<T> {
  const idFor: Record<SettingScope, string | undefined> = {
    scenario: ctx.scenarioId,
    building: ctx.buildingId,
    place: ctx.placeId,
    app: undefined,
  };
  for (const scope of SETTING_SCOPES_NEAREST_FIRST) {
    if (scope !== 'app' && idFor[scope] === undefined) continue;
    const hit = stored.find((s) => s.id === def.id && s.scope === scope && s.scopeId === idFor[scope]);
    if (hit) return hit;
  }
  return { ...def.default, scope: 'app', origin: 'default' };
}

/** True when an `affects` pattern covers a quantity id (`bill.*` covers `bill.electricity.3`). */
export function affectsMatch(pattern: QuantityId, quantity: QuantityId): boolean {
  if (pattern.endsWith('*')) return quantity.startsWith(pattern.slice(0, -1));
  return pattern === quantity;
}

/** Quantities in `present` that a setting change marks stale, sorted and unique (AC-SET2 count). */
export function staleSet(affects: readonly QuantityId[], present: readonly QuantityId[]): QuantityId[] {
  const out = new Set<QuantityId>();
  for (const q of present) if (affects.some((p) => affectsMatch(p, q))) out.add(q);
  return [...out].sort();
}
