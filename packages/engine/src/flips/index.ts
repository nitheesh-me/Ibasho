/**
 * Flip points: every value of one parameter at which a pick changes package (SPEC 5.6, 7.2
 * `flip.<param>`, B9). Owner: WP-02.
 *
 * Parameters and their integer grids:
 * - `price.gas`, `price.electricity`: the fuel's unit price in micro-pence per Wh (1 = 0.001 p/kWh).
 *   Every slab of the tariff moves by the same amount, so a bill changes by `delta * annual Wh`
 *   exactly and standing charges stay; `at` is pence per kWh.
 * - `discount`: the real discount rate in steps of 10^4 ppb (0.001 percentage points); `at` is a
 *   percent.
 *
 * Method: the picks are re-derived from the stored rows with bookkeeping only (no physics): bills,
 * B_t, NPV and the target test are recomputed exactly; N0 and carbon do not depend on these
 * parameters. The range is scanned on a grid that also contains every row's year-1 break-even
 * price (where it enters or leaves the target set), and each grid cell whose ends differ is split
 * by integer bisection until every change sits between two adjacent integers. The crossing is the
 * first integer with the new pick. A pick that empties is reported with package id `none`.
 *
 * Rows considered: those whose rules pass (feasible or target miss); blocked and needs-check rows
 * never become picks.
 */
import { type FlipPoint, FUELS, type Fuel, type MicroPence, PACKAGE_STATUS } from '@ibasho/core';
import { cashFlows, powBig, ppbToPercent } from '../finance/index.ts';
import type { RowMoney } from '../search/bookkeeping.ts';
import { picks as choosePicks, type Outcome, type Picks } from '../search/pareto.ts';
import type { SearchState } from '../search/run.ts';
import { meetsTarget } from '../search/run.ts';

export class FlipError extends Error {
  override name = 'FlipError';
}

export type FlipParam = FlipPoint['param'];
const PICK_NAMES = ['leastUpfront', 'bestReturn', 'lowestRunningCarbon'] as const;
type PickName = (typeof PICK_NAMES)[number];

/** Discount grid step in ppb. */
export const DISCOUNT_STEP_PPB = 10_000n;

export interface FlipOptions {
  /** Inclusive integer range in grid units (see the module doc). Defaults per parameter. */
  range?: { lo: bigint; hi: bigint };
  /** Grid cells before bisection. Default 64. */
  cells?: number;
}

interface Row {
  row: number;
  money: RowMoney;
  /** Annual saving per fuel, Wh (before - after). */
  annualWh: Record<Fuel, bigint>;
}

function annual(m: RowMoney): Record<Fuel, bigint> {
  const out = {} as Record<Fuel, bigint>;
  for (const f of FUELS) {
    let s = 0n;
    for (const x of m.saving[f]) s += x;
    out[f] = s;
  }
  return out;
}

/** Unit price of a fuel's tariff in micro-pence per Wh: the price of its first slab. */
export function basePrice(s: SearchState, fuel: Fuel): bigint {
  const t = s.env.tariffs.get(fuel);
  if (!t) throw new FlipError(`no tariff for ${fuel}`);
  const slabs = t.bill(new Array<bigint>(12).fill(0n), { days: new Array<number>(12).fill(0) }).slabs;
  if (!slabs || slabs.slabs.length === 0)
    throw new FlipError(`tariff ${t.id} does not expose its slab table`);
  return slabs.slabs[0]!.price;
}

function defaultRange(s: SearchState, param: FlipParam): { lo: bigint; hi: bigint } {
  if (param === 'discount') return { lo: 0n, hi: 150_000_000n / DISCOUNT_STEP_PPB };
  const p0 = basePrice(s, param === 'price.gas' ? 'gas' : 'electricity');
  return { lo: 0n, hi: 3n * p0 > 1000n ? 3n * p0 : 1000n };
}

function decimal(n: bigint, scale: number): string {
  const neg = n < 0n;
  const a = neg ? -n : n;
  const d = powBig(10n, BigInt(scale));
  const frac = (a % d).toString().padStart(scale, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${a / d}${frac ? `.${frac}` : ''}`;
}

/** `at` string of a grid value. */
export function flipAt(param: FlipParam, x: bigint): string {
  return param === 'discount' ? ppbToPercent(x * DISCOUNT_STEP_PPB) : decimal(x, 3);
}

/** Every flip of every pick over `param`. */
export function flips(s: SearchState, param: FlipParam, opts: FlipOptions = {}): FlipPoint[] {
  const status = s.result.packages.status;
  const rows: Row[] = [];
  for (let r = 0; r < s.rows.length; r++) {
    const st = status[r];
    if (st === PACKAGE_STATUS.feasible || st === PACKAGE_STATUS['target-miss'])
      rows.push({ row: r, money: s.money[r]!, annualWh: annual(s.money[r]!) });
  }
  const owner = s.req.owner;
  const fuel: Fuel | undefined =
    param === 'price.gas' ? 'gas' : param === 'price.electricity' ? 'electricity' : undefined;
  const p0 = fuel ? basePrice(s, fuel) : 0n;
  const range = opts.range ?? defaultRange(s, param);
  if (range.hi <= range.lo) throw new FlipError('flip range must have hi > lo');

  const evalAt = (x: bigint): Picks => {
    const outcomes: Outcome[] = [];
    for (const r of rows) {
      const m = r.money;
      let flows = m.flows;
      if (fuel) {
        const delta = x - p0;
        if (delta !== 0n && r.annualWh[fuel] !== 0n) {
          const billSavingByFuel = { ...m.billSavingByFuel };
          billSavingByFuel[fuel] = billSavingByFuel[fuel] + delta * r.annualWh[fuel];
          flows = cashFlows({
            billSavingByFuel,
            escalationPpb: m.escalationPpb,
            installed: m.installed,
            n0: m.n0,
            discountRatePpb: owner.discountRatePpb,
            horizonYears: owner.horizonYears,
          });
        }
      } else {
        flows = cashFlows({
          billSavingByFuel: m.billSavingByFuel,
          escalationPpb: m.escalationPpb,
          installed: m.installed,
          n0: m.n0,
          discountRatePpb: x * DISCOUNT_STEP_PPB,
          horizonYears: owner.horizonYears,
        });
      }
      if (!meetsTarget(s.req.target, { flows, carbonAnnualG: m.carbonAnnualG }, s.epc[r.row])) continue;
      outcomes.push({ row: r.row, n0: m.n0, carbon: m.lifetimeCarbonG, npv: flows.npv });
    }
    return choosePicks(outcomes, 0);
  };
  const memo = new Map<bigint, Picks>();
  const at = (x: bigint) => {
    let p = memo.get(x);
    if (!p) {
      p = evalAt(x);
      memo.set(x, p);
    }
    return p;
  };

  // Grid: equal cells plus each row's year-1 break-even price (target entry or exit).
  const grid = new Set<bigint>([range.lo, range.hi]);
  const cells = BigInt(opts.cells ?? 64);
  for (let i = 1n; i < cells; i++) grid.add(range.lo + ((range.hi - range.lo) * i) / cells);
  if (fuel) {
    for (const r of rows) {
      const a = r.annualWh[fuel];
      if (a === 0n) continue;
      const b1: MicroPence = r.money.flows.b[0] ?? 0n;
      // b1 + (x - p0) * a * g1 = 0 at about x = p0 - b1 / a (growth ignored for the hint).
      const hint = p0 - b1 / a;
      for (const h of [hint - 1n, hint, hint + 1n]) if (h > range.lo && h < range.hi) grid.add(h);
    }
  }
  const pts = [...grid].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const out: FlipPoint[] = [];
  const idOf = (row: number | undefined) => (row === undefined ? 'none' : s.rows[row]!.id);
  for (const name of PICK_NAMES) {
    const crossings: { x: bigint; from: number | undefined; to: number | undefined }[] = [];
    const split = (a: bigint, b: bigint) => {
      const pa = at(a)[name];
      const pb = at(b)[name];
      if (pa === pb) return;
      if (b - a === 1n) {
        crossings.push({ x: b, from: pa, to: pb });
        return;
      }
      const m = a + (b - a) / 2n;
      split(a, m);
      split(m, b);
    };
    for (let i = 0; i + 1 < pts.length; i++) split(pts[i]!, pts[i + 1]!);
    for (const c of crossings)
      out.push({
        param,
        at: flipAt(param, c.x),
        pick: name as PickName,
        fromPackageId: idOf(c.from),
        toPackageId: idOf(c.to),
      });
  }
  return out;
}
