/**
 * Bills, grants, net upfront cost and NPV in integer fixed point (SPEC 7.2 and 7.4, SF 5.2).
 * Owner: WP-02.
 *
 * Units: money in micro-pence, energy in Wh, rates in ppb, factors scaled by 10^12.
 *
 * Named rounding points (mirrored by Lean `Finance.lean`, WP-04):
 * - `applyFactor` (half even) once per year term: `B_t * G_t`, `B_t * D_t`, replacement `* D_t`,
 *   residual value `* D_H`;
 * - the residual value `cost * remaining / lifetime` (half even).
 * Bills themselves are exact (integer price per Wh times integer Wh, no rounding).
 */
import {
  applyFactor,
  DAYS_IN_MONTH,
  discountFactors,
  FUELS,
  type Fuel,
  type FuelMonthly,
  type GrantPlugin,
  growthFactors,
  type HomeTwin,
  type IsoDate,
  type MicroPence,
  type OwnerCtx,
  type PackageSpec,
  roundHalfEven,
  type TariffPlugin,
  type Wh,
} from '@ibasho/core';

export class FinanceError extends Error {
  override name = 'FinanceError';
}

// ---------------------------------------------------------------------------------------------
// Bills

export interface Bills {
  byFuel: Record<Fuel, MicroPence>;
  total: MicroPence;
}

/**
 * Annual bill per fuel with each fuel's tariff (money.bill.<fuel>). A fuel with no use and no
 * tariff costs nothing; a fuel with use and no tariff is an error (never billed at zero).
 */
export function bills(delivered: FuelMonthly<Wh>, tariffs: ReadonlyMap<Fuel, TariffPlugin>): Bills {
  const byFuel = {} as Record<Fuel, MicroPence>;
  let total = 0n;
  for (const f of FUELS) {
    const t = tariffs.get(f);
    const used = delivered[f].some((w) => w !== 0n);
    if (!t) {
      if (used) throw new FinanceError(`no tariff for ${f}, which the home uses`);
      byFuel[f] = 0n;
      continue;
    }
    const b = t.bill([...delivered[f]], { days: [...DAYS_IN_MONTH] });
    byFuel[f] = b.total;
    total += b.total;
  }
  return { byFuel, total };
}

// ---------------------------------------------------------------------------------------------
// Grants

export interface AppliedGrant {
  grantId: string;
  version: string;
  amount: MicroPence;
  conditions: string[];
  validTo?: IsoDate;
}

/**
 * Eligible grants for a package, stacked (SF 6): grants are taken largest first (then by id); a
 * grant is kept only if it stacks with every grant already kept (either side lists the other in
 * `stacksWith`), so of two that do not stack the larger wins. A grant whose `validTo` is before
 * `asOf` is excluded. The total is capped at the gross cost, the last kept grant absorbing the cap
 * (Lean `grants_le_cost`).
 */
export function applyGrants(
  grants: readonly GrantPlugin[],
  ctx: { twin: HomeTwin; owner: OwnerCtx; pkg: PackageSpec; asOf: IsoDate; grossCost: MicroPence },
): AppliedGrant[] {
  const offers: (AppliedGrant & { stacksWith: string[] })[] = [];
  for (const g of grants) {
    if (g.validFrom !== undefined && ctx.asOf < g.validFrom) continue;
    if (g.validTo !== undefined && ctx.asOf > g.validTo) continue;
    const e = g.eligible(ctx.twin, ctx.owner, ctx.pkg, ctx.asOf);
    if (!e || e.amount <= 0n) continue;
    const offer: AppliedGrant & { stacksWith: string[] } = {
      grantId: g.id,
      version: g.version,
      amount: e.amount,
      conditions: [...e.conditions],
      stacksWith: e.stacksWith,
    };
    if (g.validTo !== undefined) offer.validTo = g.validTo;
    offers.push(offer);
  }
  offers.sort((a, b) =>
    a.amount === b.amount ? (a.grantId < b.grantId ? -1 : 1) : a.amount > b.amount ? -1 : 1,
  );
  const kept: typeof offers = [];
  for (const o of offers) {
    const stacks = kept.every((k) => k.stacksWith.includes(o.grantId) || o.stacksWith.includes(k.grantId));
    if (stacks) kept.push(o);
  }
  let room = ctx.grossCost < 0n ? 0n : ctx.grossCost;
  const out: AppliedGrant[] = [];
  for (const { stacksWith: _s, ...k } of kept) {
    const amount = k.amount < room ? k.amount : room;
    room -= amount;
    if (amount > 0n) out.push({ ...k, amount });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Net upfront cost, yearly saving, NPV

/** N0 = max(0, C0 - G - A_cf) (SF 5.2). A_cf only when the owner confirms a replacement is due. */
export function netUpfront(grossCost: MicroPence, grants: MicroPence, avoided: MicroPence = 0n): MicroPence {
  const n = grossCost - grants - avoided;
  return n < 0n ? 0n : n;
}

export interface Installed {
  optionId: string;
  /** Central gross cost of one installation (replacements use the same real cost). */
  cost: MicroPence;
  lifetimeYears: number;
  omDeltaPerYear?: MicroPence;
  /** Explicit replacements from the cost plugin; when absent, derived from the lifetime. */
  replacements?: { atYear: number; cost: MicroPence }[];
}

/**
 * Replacements inside the horizon and the residual value at year H for one installed option.
 * Derived rule (SF 5.2): reinstall at every multiple of the lifetime before H; the last install's
 * unused life at H is valued linearly, `cost * (end - H) / lifetime` (half even).
 */
export function lifecycle(
  x: Installed,
  horizon: number,
): { replacements: { atYear: number; cost: MicroPence }[]; residual: MicroPence } {
  const T = x.lifetimeYears;
  if (!Number.isInteger(T) || T <= 0)
    throw new FinanceError(`${x.optionId}: lifetime must be a positive integer`);
  const replacements = x.replacements ? x.replacements.filter((r) => r.atYear > 0 && r.atYear < horizon) : [];
  let lastInstall = 0;
  let lastCost = x.cost;
  if (x.replacements) {
    for (const r of replacements) {
      lastInstall = r.atYear;
      lastCost = r.cost;
    }
  } else {
    for (let y = T; y < horizon; y += T) {
      replacements.push({ atYear: y, cost: x.cost });
      lastInstall = y;
    }
  }
  const end = lastInstall + T;
  const residual = end > horizon ? roundHalfEven(lastCost * BigInt(end - horizon), BigInt(T)) : 0n;
  return { replacements, residual };
}

export interface CashFlowInput {
  /** Bill saving per fuel in year 1 prices (before - after), signed. */
  billSavingByFuel: Record<Fuel, MicroPence>;
  /** Real escalation per fuel in ppb (central 0, SF 5.1). */
  escalationPpb?: Partial<Record<Fuel, bigint>>;
  installed: readonly Installed[];
  n0: MicroPence;
  discountRatePpb: bigint;
  horizonYears: number;
}

export interface CashFlows {
  /** B_1..B_H (index 0 is year 1). */
  b: MicroPence[];
  /** Discounted replacement costs, summed. */
  replacementsPv: MicroPence;
  /** Discounted residual value at H. */
  residualPv: MicroPence;
  npv: MicroPence;
}

/**
 * NPV = -N0 + sum_t B_t D_t - sum replacements_t D_t + RV D_H (SF 5.2), with
 * B_t = sum_f billSaving_f G_f,t - dOM. Value uplift is never part of it (SF D6).
 */
export function cashFlows(i: CashFlowInput): CashFlows {
  const H = i.horizonYears;
  if (!Number.isInteger(H) || H < 1) throw new FinanceError('horizon must be a positive integer');
  const D = discountFactors(i.discountRatePpb, H);
  const growth = new Map<Fuel, bigint[]>();
  for (const f of FUELS) growth.set(f, growthFactors(i.escalationPpb?.[f] ?? 0n, H));
  let om = 0n;
  for (const x of i.installed) om += x.omDeltaPerYear ?? 0n;
  const b: MicroPence[] = [];
  let npv = -i.n0;
  for (let t = 1; t <= H; t++) {
    let bt = -om;
    for (const f of FUELS) {
      const s = i.billSavingByFuel[f];
      if (s !== 0n) bt += applyFactor(s, growth.get(f)![t]!);
    }
    b.push(bt);
    npv += applyFactor(bt, D[t]!);
  }
  let replacementsPv = 0n;
  let residual = 0n;
  for (const x of i.installed) {
    const lc = lifecycle(x, H);
    for (const r of lc.replacements) replacementsPv += applyFactor(r.cost, D[r.atYear]!);
    residual += lc.residual;
  }
  const residualPv = applyFactor(residual, D[H]!);
  npv += residualPv - replacementsPv;
  return { b, replacementsPv, residualPv, npv };
}
