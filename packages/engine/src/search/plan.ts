/**
 * Search plan: choice groups and the exhaustive package enumeration (SPEC R9, ARCH 6). Owner: WP-02.
 *
 * Groups come from the registered measure models: one group per `MeasureModel.group`, options
 * `none` first, then each model's options in model order (models sorted by id). Groups are sorted
 * by id. Packages are the full product, enumerated in mixed radix with the last group fastest, so
 * row 0 is the empty package (`baseline`). Lean `Enum.lean` rebuilds the same product from the
 * certificate's groups (`enum.complete`).
 */
import {
  type ChoiceGroup,
  compareStrings,
  type MeasureModel,
  type PackageSpec,
  type SearchPlan,
} from '@ibasho/core';
import { SEARCH_LIMITS } from '@ibasho/spec-gen';

export class SearchPlanError extends Error {
  override name = 'SearchPlanError';
}

export const NONE = 'none';
export const BASELINE_ID = 'baseline';

/** Option ids of the M-0 walking skeleton: 2 x 2 x 2 = 8 packages (BUILD_PLAN M-0). */
export const M0_OPTION_IDS: readonly string[] = ['draught-proofing-chimney-balloon', 'heat-ashp', 'loft-300'];

/** Canonical package id: sorted option ids joined by `+`, or `baseline` (core `PackageSpec.id`). */
export function packageId(optionIds: readonly string[]): string {
  const ids = optionIds.filter((o) => o !== NONE).sort(compareStrings);
  return ids.length ? ids.join('+') : BASELINE_ID;
}

export interface GroupPlan extends SearchPlan {
  /** Measure model per option id. */
  modelOf: ReadonlyMap<string, MeasureModel>;
}

/** Choice groups from measure models, keeping only `allow`ed options when given. */
export function planGroups(measures: readonly MeasureModel[], allow?: readonly string[]): GroupPlan {
  const byGroup = new Map<string, { weight: 'heavy' | 'light'; options: string[] }>();
  const modelOf = new Map<string, MeasureModel>();
  for (const m of [...measures].sort((a, b) => compareStrings(a.id, b.id))) {
    const opts = m.options.map((o) => o.id).filter((o) => !allow || allow.includes(o));
    if (opts.length === 0) continue;
    const g = byGroup.get(m.group) ?? { weight: m.weight, options: [NONE] };
    if (g.weight !== m.weight) throw new SearchPlanError(`group ${m.group} mixes heavy and light measures`);
    for (const o of opts) {
      if (modelOf.has(o)) throw new SearchPlanError(`option ${o} is offered by two measures`);
      modelOf.set(o, m);
      g.options.push(o);
    }
    byGroup.set(m.group, g);
  }
  const groups: ChoiceGroup[] = [...byGroup.entries()]
    .sort(([a], [b]) => compareStrings(a, b))
    .map(([id, g]) => ({ id, weight: g.weight, options: g.options }));
  let packageCount = 1;
  let heavyCount = 1;
  for (const g of groups) {
    packageCount *= g.options.length;
    if (g.weight === 'heavy') heavyCount *= g.options.length;
  }
  // heavyCount is the fabric product; the DHW class can double it (SPEC R9), known after patching.
  const complete = packageCount <= SEARCH_LIMITS.packages && heavyCount <= SEARCH_LIMITS.heavy;
  if (!complete) {
    // PLACEHOLDER until M-B: branch and bound above the limits. Refuse rather than mislabel.
    throw new SearchPlanError(
      `search space ${packageCount} packages exceeds the exhaustive limits (SPEC R9); branch and bound lands at M-B`,
    );
  }
  return { groups, heavyCount, packageCount, complete, modelOf };
}

/** Option index per group for row `r` (mixed radix, last group fastest). */
export function rowChoice(groups: readonly ChoiceGroup[], r: number): number[] {
  const out = new Array<number>(groups.length);
  let rest = r;
  for (let i = groups.length - 1; i >= 0; i--) {
    const n = groups[i]!.options.length;
    out[i] = rest % n;
    rest = (rest - out[i]!) / n;
  }
  return out;
}

/** The package of row `r`. `options` lists only chosen groups (absent means `none`). */
export function rowPackage(groups: readonly ChoiceGroup[], r: number): PackageSpec {
  const choice = rowChoice(groups, r);
  const options: Record<string, string> = {};
  groups.forEach((g, i) => {
    const o = g.options[choice[i]!]!;
    if (o !== NONE) options[g.id] = o;
  });
  return { id: packageId(Object.values(options)), options };
}
