/**
 * Code editions, rating schemes and baseline builders (ARCH 15.3, SPEC R34 to R36, EC 5 to 7).
 * Owner: WP-00 (contract); WP-19 fills `codes-in`, `codes-global` and `ratings`.
 */
import { compareStrings, type IsoDate, type MessageKey } from '../common.ts';
import type { PluginBase } from '../plugin/types.ts';
import type { CompiledBuilding } from './building.ts';
import type { MetricId } from './metrics.ts';
import type { Applicability } from './result.ts';

/** A dated code edition (ECBC 2007, ECBC 2017, ECSBC 2024, ...). */
export interface CodeEdition {
  code: string;
  edition: string;
  effectiveFrom: IsoDate;
  effectiveTo?: IsoDate;
  /** Local adoption status where the place is. */
  adopted: 'yes' | 'unconfirmed' | 'draft';
}

/**
 * The edition in force for a permit date (R34). An unknown date, or a date no edition covers,
 * gives `adoption-unconfirmed` with the latest edition as the reference.
 */
export function editionFor(
  editions: readonly CodeEdition[],
  permitDate: IsoDate | undefined,
): { edition: CodeEdition | undefined; applicability: Applicability } {
  const sorted = [...editions].sort((a, b) => compareStrings(a.effectiveFrom, b.effectiveFrom));
  const latest = sorted[sorted.length - 1];
  if (permitDate === undefined) return { edition: latest, applicability: 'adoption-unconfirmed' };
  const hit = sorted.filter(
    (e) => e.effectiveFrom <= permitDate && (e.effectiveTo === undefined || permitDate <= e.effectiveTo),
  );
  const e = hit[hit.length - 1];
  if (!e) return { edition: latest, applicability: 'adoption-unconfirmed' };
  return { edition: e, applicability: e.adopted === 'yes' ? 'reference' : 'adoption-unconfirmed' };
}

/** One step of a rating table: reaching `atLeast` on the metric gives `points` and `level`. */
export interface RatingStep {
  atLeast: number;
  points: number;
  level: string;
}

/** Step tables from a ratio or metric to points or levels (R36). Pure data. */
export interface RatingSchemePlugin extends PluginBase<'rating-scheme'> {
  scheme: 'LEED' | 'IGBC' | 'GRIHA' | 'EDGE' | 'BEE-star' | 'GHMC-stars' | 'ECSBC-tiers' | (string & {});
  edition: string;
  metric: MetricId;
  /** Ascending by `atLeast`; points non-decreasing (checked at registration, Lean monotone). */
  steps: RatingStep[];
  /** Prerequisites as rule ids that must pass first. */
  prerequisites?: string[];
  disclaimer: MessageKey;
}

/** Highest step reached by a metric value, or undefined below the first step. */
export function ratingStepFor(steps: readonly RatingStep[], value: number): RatingStep | undefined {
  let best: RatingStep | undefined;
  for (const s of steps) if (value >= s.atLeast) best = s;
  return best;
}

/** Clones a building into a code's reference design (R35). Engine side. */
export interface BaselineBuilderPlugin extends PluginBase<'baseline-builder'> {
  code: string;
  edition: string;
  build(proposed: CompiledBuilding): CompiledBuilding;
}
