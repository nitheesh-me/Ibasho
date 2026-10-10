/**
 * Pareto front, dominance witnesses and picks (SPEC R7, R8; LV 6.4). Owner: WP-02.
 *
 * Axes (R8): N0 lower is better, lifetime operational carbon saved higher is better, NPV higher is
 * better, central values, over the target set (feasible packages that meet the target).
 * `dominates` is Lean `Dominates` exactly; ties on all three axes dominate neither way.
 * Picks use the R7 tie-breaks, then the lower row index so the choice is total and deterministic:
 * - least upfront: lexicographic min of (N0, -carbon, -NPV) (Lean `LexLe`, `lexMin_nondominated`);
 * - best return: max NPV, then lower N0, then more carbon;
 * - lowest running carbon: max carbon, then higher NPV, then lower N0.
 * The empty package is never a pick (R7).
 */

export interface Outcome {
  row: number;
  n0: bigint;
  carbon: bigint;
  npv: bigint;
}

export const NO_WITNESS = 0xffffffff;

export function dominates(a: Outcome, b: Outcome): boolean {
  return (
    a.n0 <= b.n0 &&
    a.carbon >= b.carbon &&
    a.npv >= b.npv &&
    (a.n0 < b.n0 || a.carbon > b.carbon || a.npv > b.npv)
  );
}

/** Lexicographic order on (N0 asc, carbon desc, NPV desc, row asc). */
function lexCmp(a: Outcome, b: Outcome): number {
  if (a.n0 !== b.n0) return a.n0 < b.n0 ? -1 : 1;
  if (a.carbon !== b.carbon) return a.carbon > b.carbon ? -1 : 1;
  if (a.npv !== b.npv) return a.npv > b.npv ? -1 : 1;
  return a.row - b.row;
}

/**
 * Non-dominated candidates, sorted by row. Sweep in lexicographic order: a candidate can only be
 * dominated by one earlier in that order, and if anything dominates it, some front member does
 * (dominance is transitive and the set is finite).
 */
export function paretoFront(cands: readonly Outcome[]): Outcome[] {
  const sorted = [...cands].sort(lexCmp);
  const front: Outcome[] = [];
  for (const c of sorted) if (!front.some((f) => dominates(f, c))) front.push(c);
  return front.sort((a, b) => a.row - b.row);
}

/** For every candidate off the front, the lowest-row front member that dominates it. */
export function witnesses(cands: readonly Outcome[], front: readonly Outcome[]): Map<number, number> {
  const onFront = new Set(front.map((f) => f.row));
  const out = new Map<number, number>();
  for (const c of cands) {
    if (onFront.has(c.row)) continue;
    const w = front.find((f) => dominates(f, c));
    if (!w) throw new Error(`package row ${c.row} is off the front but has no dominating front member`);
    out.set(c.row, w.row);
  }
  return out;
}

export interface Picks {
  leastUpfront?: number;
  bestReturn?: number;
  lowestRunningCarbon?: number;
}

function best(cands: readonly Outcome[], better: (a: Outcome, b: Outcome) => number): number | undefined {
  let top: Outcome | undefined;
  for (const c of cands) if (top === undefined || better(c, top) < 0) top = c;
  return top?.row;
}

const asc = (a: bigint, b: bigint) => (a === b ? 0 : a < b ? -1 : 1);
const desc = (a: bigint, b: bigint) => -asc(a, b);

/** R7 picks over the target set. `emptyRow` (the baseline package) is excluded. */
export function picks(targetSet: readonly Outcome[], emptyRow: number): Picks {
  const c = targetSet.filter((o) => o.row !== emptyRow);
  const out: Picks = {};
  const lu = best(c, lexCmp);
  const br = best(
    c,
    (a, b) => desc(a.npv, b.npv) || asc(a.n0, b.n0) || desc(a.carbon, b.carbon) || a.row - b.row,
  );
  const lc = best(
    c,
    (a, b) => desc(a.carbon, b.carbon) || desc(a.npv, b.npv) || asc(a.n0, b.n0) || a.row - b.row,
  );
  if (lu !== undefined) out.leastUpfront = lu;
  if (br !== undefined) out.bestReturn = br;
  if (lc !== undefined) out.lowestRunningCarbon = lc;
  return out;
}
