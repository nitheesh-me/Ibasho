/**
 * Owner-dependent finance inputs (SF 5.1, DEC SC-F5): fuel price escalation `g_f` and the avoided
 * counterfactual replacement A_cf. Owner: WP-02.
 *
 * Escalation: `owner.escalation.ppbPerYear` wins per fuel; otherwise the scenario's value. The
 * scenario values are the SF 5.1 defaults (low -1%, central 0%, high +2% real per year, every
 * fuel). PLACEHOLDER: SPEC says the money pack owns them; there is no plugin kind for them yet, so
 * they live here until one exists (INTERFACES). Absent `owner.escalation` means 0 (M-0 behaviour).
 *
 * A_cf counts only when the owner confirms the replacement is due (`replacementDue === true`) and
 * the package replaces the space heating system (a measure of kind `ashp` or `gshp`). Its value is
 * the owner's stated cost, else the money pack's `measure-cost` keyed by the like-for-like system
 * id (`counterfactual.systemId`, else the twin's space system id), central value.
 */
import {
  FUELS,
  type Fuel,
  type HomeTwin,
  type IsoDate,
  type MeasureKind,
  type MicroPence,
  type OwnerCtx,
  type PackageSpec,
} from '@ibasho/core';
import type { SearchEnv } from '../search/env.ts';
import { FinanceError } from './money.ts';

/** SF 5.1 scenario defaults, ppb per year, applied to every fuel. */
export const ESCALATION_DEFAULT_PPB = { low: -10_000_000n, central: 0n, high: 20_000_000n } as const;

export function escalationPpb(owner: OwnerCtx): Partial<Record<Fuel, bigint>> {
  const e = owner.escalation;
  if (!e) return {};
  const out: Partial<Record<Fuel, bigint>> = {};
  for (const f of FUELS) {
    const v = e.ppbPerYear?.[f] ?? ESCALATION_DEFAULT_PPB[e.scenario];
    if (v !== 0n) out[f] = v;
  }
  return out;
}

/** Measure kinds that replace the space heating system. */
export const HEAT_REPLACING_KINDS: readonly MeasureKind[] = ['ashp', 'gshp'];

export function replacesSpaceHeating(env: Pick<SearchEnv, 'measures'>, pkg: PackageSpec): boolean {
  const ids = Object.values(pkg.options);
  return env.measures.some(
    (m) => HEAT_REPLACING_KINDS.includes(m.measureKind) && m.options.some((o) => ids.includes(o.id)),
  );
}

export function avoidedCost(
  env: Pick<SearchEnv, 'measures' | 'costs'>,
  twin: HomeTwin,
  owner: OwnerCtx,
  pkg: PackageSpec,
  asOf: IsoDate,
): MicroPence {
  const cf = owner.counterfactual;
  if (cf?.replacementDue !== true) return 0n;
  if (!replacesSpaceHeating(env, pkg)) return 0n;
  if (cf.cost !== undefined) {
    if (cf.cost < 0n) throw new FinanceError('counterfactual cost must be non-negative');
    return cf.cost;
  }
  const systemId = cf.systemId ?? twin.systems.space.systemId;
  const c = env.costs.get(systemId);
  if (!c) throw new FinanceError(`no like-for-like cost for system ${systemId} (A_cf)`);
  return c.cost(twin, asOf).mid;
}
