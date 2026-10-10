/**
 * Per-package bookkeeping (ARCH 6 step 5): savings, carbon, bills, costs, grants, N0 and NPV, all
 * in integer fixed point on the your-home run (SPEC R3: your-home drives bills, savings and
 * finance). Owner: WP-02.
 */
import {
  FUELS,
  type Fuel,
  type FuelMonthly,
  type HomeTwin,
  type IsoDate,
  type MicroPence,
  type OwnerCtx,
  type PackageSpec,
  type Q,
  type Wh,
} from '@ibasho/core';
import {
  type AppliedGrant,
  applyGrants,
  type Bills,
  bills,
  type CashFlows,
  carbonSavingG,
  cashFlows,
  type FuelMonthVec,
  type Installed,
  lifetimeCarbonG,
  netUpfront,
  saving,
} from '../finance/index.ts';
import type { SearchEnv } from './env.ts';

export class BookkeepingError extends Error {
  override name = 'BookkeepingError';
}

export interface OptionCost {
  optionId: string;
  lo: MicroPence;
  mid: MicroPence;
  hi: MicroPence;
  vatRate: Q;
  lifetimeYears: number;
  omDeltaPerYear?: MicroPence;
  replacements?: { atYear: number; cost: MicroPence }[];
}

export interface RowMoney {
  saving: FuelMonthVec;
  /** acct.carbon_saving: annual, monthly factors, grams. */
  carbonAnnualG: bigint;
  /** fin.lifetime_tco2e in grams: the Pareto carbon axis. */
  lifetimeCarbonG: bigint;
  bills: Bills;
  billSavingByFuel: Record<Fuel, MicroPence>;
  billSaving: MicroPence;
  options: OptionCost[];
  grossCost: MicroPence;
  grants: AppliedGrant[];
  grantTotal: MicroPence;
  n0: MicroPence;
  flows: CashFlows;
}

/** Costs of every chosen option on the base twin (one `measure-cost` per option id). */
export function optionCosts(env: SearchEnv, twin: HomeTwin, pkg: PackageSpec, asOf: IsoDate): OptionCost[] {
  const out: OptionCost[] = [];
  for (const optionId of [...Object.values(pkg.options), ...Object.values(pkg.subOptions ?? {})].sort()) {
    const c = env.costs.get(optionId);
    if (!c) throw new BookkeepingError(`no measure-cost for option ${optionId}`);
    const m = env.measures.find((x) => x.options.some((o) => o.id === optionId));
    if (!m) throw new BookkeepingError(`no measure model for option ${optionId}`);
    const k = c.cost(twin, asOf);
    if (!(k.lo <= k.mid && k.mid <= k.hi) || k.lo < 0n)
      throw new BookkeepingError(`cost of ${optionId} is not ordered lo <= mid <= hi`);
    const oc: OptionCost = {
      optionId,
      lo: k.lo,
      mid: k.mid,
      hi: k.hi,
      vatRate: k.vatRate,
      lifetimeYears: m.lifetimeYears,
    };
    if (c.omDeltaPerYear !== undefined) oc.omDeltaPerYear = c.omDeltaPerYear;
    if (c.replacements !== undefined) oc.replacements = c.replacements;
    out.push(oc);
  }
  return out;
}

export interface BookkeepCtx {
  env: SearchEnv;
  twin: HomeTwin;
  owner: OwnerCtx;
  asOf: IsoDate;
  baseDelivered: FuelMonthly<Wh>;
  baseBills: Bills;
}

export function bookkeep(ctx: BookkeepCtx, pkg: PackageSpec, delivered: FuelMonthly<Wh>): RowMoney {
  const { env, owner, asOf } = ctx;
  const sav = saving(ctx.baseDelivered, delivered);
  const b = bills(delivered, env.tariffs);
  const billSavingByFuel = {} as Record<Fuel, MicroPence>;
  for (const f of FUELS) billSavingByFuel[f] = ctx.baseBills.byFuel[f] - b.byFuel[f];
  const options = optionCosts(env, ctx.twin, pkg, asOf);
  let grossCost = 0n;
  for (const o of options) grossCost += o.mid;
  const grants = applyGrants(env.grants, { twin: ctx.twin, owner, pkg, asOf, grossCost });
  let grantTotal = 0n;
  for (const g of grants) grantTotal += g.amount;
  const n0 = netUpfront(grossCost, grantTotal);
  const installed: Installed[] = options.map((o) => {
    const x: Installed = { optionId: o.optionId, cost: o.mid, lifetimeYears: o.lifetimeYears };
    if (o.omDeltaPerYear !== undefined) x.omDeltaPerYear = o.omDeltaPerYear;
    if (o.replacements !== undefined) x.replacements = o.replacements;
    return x;
  });
  const flows = cashFlows({
    billSavingByFuel,
    installed,
    n0,
    discountRatePpb: owner.discountRatePpb,
    horizonYears: owner.horizonYears,
  });
  const firstYear = Number(asOf.slice(0, 4));
  return {
    saving: sav,
    carbonAnnualG: carbonSavingG(sav, env.carbon),
    lifetimeCarbonG: lifetimeCarbonG(sav, env.trajectory, firstYear, owner.horizonYears),
    bills: b,
    billSavingByFuel,
    billSaving: ctx.baseBills.total - b.total,
    options,
    grossCost,
    grants,
    grantTotal,
    n0,
    flows,
  };
}
