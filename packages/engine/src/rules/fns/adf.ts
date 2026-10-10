/**
 * `adf_category`: Approved Document F ventilation category (RP 6.2, AD F 2021 Diagram 3.1).
 * Owner: WP-03. A mirror of Lean `Ibasho.Spec.V2.adfCategory` (`proofs/Ibasho/Spec/V2/Rules/Adf.lean`):
 * rows are major measures (saturating at 4), columns minor measures (saturating at 6). Category A
 * asks least. The table is monotone in both arguments (Lean `adf_category_monotone`, test C4).
 */
import type { Tri } from '@ibasho/core';

export type AdfCategory = 'A' | 'B' | 'C';

const ADF_TABLE: readonly (readonly AdfCategory[])[] = [
  ['A', 'A', 'A', 'B', 'B', 'B', 'B'],
  ['B', 'B', 'B', 'B', 'B', 'B', 'C'],
  ['B', 'B', 'B', 'B', 'C', 'C', 'C'],
  ['B', 'C', 'C', 'C', 'C', 'C', 'C'],
  ['C', 'C', 'C', 'C', 'C', 'C', 'C'],
];

/** Rank of a category: A 0, B 1, C 2 (Lean `AdfCategory.rank`). */
export function adfRank(c: AdfCategory): number {
  return c === 'A' ? 0 : c === 'B' ? 1 : 2;
}

/** `adf_category(major, minor)` for counts of energy efficiency measures, past ones included. */
export function adfCategory(major: number, minor: number): AdfCategory {
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || major < 0 || minor < 0)
    throw new RangeError(`adf_category needs counts, got ${major}, ${minor}`);
  return ADF_TABLE[major < 4 ? major : 4]![minor < 6 ? minor : 6]!;
}

/**
 * Named-function form: `adf_category(major, minor, rank)` is true when the category is at least
 * `rank` (0 A, 1 B, 2 C). Rules pass the rank as a `k.adf.*` constant fact. Bad arguments are unknown.
 */
export function adfCategoryFn(args: readonly (number | string)[]): Tri {
  const [major, minor, rank] = args;
  if (args.length !== 3 || typeof major !== 'number' || typeof minor !== 'number' || typeof rank !== 'number')
    return 'unknown';
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || major < 0 || minor < 0)
    return 'unknown';
  return adfRank(adfCategory(major, minor)) >= rank;
}
