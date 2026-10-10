/**
 * Per-package outputs computed for shown packages only (baseline, front, picks, and lazily any
 * other): paybacks, IRR, loan, score, estimated EPC band and rule-raised risks. Owner: WP-02.
 *
 * IRR and the score need extra runs or bisection, so they are kept off the hot path of the search
 * (B2); the search itself only needs N0, NPV and lifetime carbon for every row.
 */
import type { HomeTwin, NegativeRisk, RunMode } from '@ibasho/core';
import {
  type DiscountedPayback,
  discountedPayback,
  flowTerms,
  type Irr,
  irr,
  type LoanView,
  loanView,
  type SimplePayback,
  simplePayback,
} from '../finance/index.ts';
import type { SimRun } from '../pipeline/index.ts';
import { indicatorsOf, type ScoreResult, scoreOf, scoreRaw } from '../score/index.ts';
import { type EpcEstimate, type EpcProxyLike, epcEstimate } from '../score/inputs.ts';
import type { RowMoney } from './bookkeeping.ts';
import type { SearchEnv } from './env.ts';

export interface RowReturns {
  simple: SimplePayback;
  discounted: DiscountedPayback;
  irr: Irr;
  loan?: LoanView;
}

export interface RuleRisk {
  ruleId: string;
  risk: NegativeRisk;
}

export interface RowExtras {
  returns: RowReturns;
  score?: ScoreResult;
  epc?: EpcEstimate;
  risks: RuleRisk[];
}

export function rowReturns(env: SearchEnv, money: RowMoney, discountRatePpb: bigint): RowReturns {
  const b1 = money.flows.b[0] ?? 0n;
  const out: RowReturns = {
    simple: simplePayback(money.n0, b1),
    discounted: discountedPayback(money.n0, money.flows.b, discountRatePpb),
    irr: irr(flowTerms(money.n0, money.flows, money.installed)),
  };
  const loan = loanView(env.finance, money.n0, b1);
  if (loan) out.loan = loan;
  return out;
}

/** Risk kind a rule raises, read from its id (`ENG.MOIST.IWI` is moisture). Built-ins raise none. */
export function riskOfRule(ruleId: string): NegativeRisk | undefined {
  if (ruleId.startsWith('BUILTIN.')) return undefined;
  const id = ruleId.toUpperCase();
  if (id.includes('MOIST') || id.includes('DAMP') || id.includes('CONDENS')) return 'moisture';
  if (id.includes('NOISE') || id.includes('MCS020')) return 'noise';
  if (id.includes('OVERHEAT') || id.includes('TM59')) return 'overheating';
  if (id.includes('FIRE')) return 'fire';
  if (id.includes('STRUCT')) return 'structural';
  return undefined;
}

export function ruleRisks(ruleIds: readonly string[]): RuleRisk[] {
  const out: RuleRisk[] = [];
  for (const ruleId of ruleIds) {
    const risk = riskOfRule(ruleId);
    if (risk) out.push({ ruleId, risk });
  }
  return out;
}

export interface ExtrasInput {
  env: SearchEnv;
  money: RowMoney;
  discountRatePpb: bigint;
  runs: Partial<Record<RunMode, SimRun>>;
  /** Twin after the whole package. */
  twin: HomeTwin;
  ruleIds: readonly string[];
}

export function rowExtras(i: ExtrasInput): RowExtras {
  const out: RowExtras = {
    returns: rowReturns(i.env, i.money, i.discountRatePpb),
    risks: ruleRisks(i.ruleIds),
  };
  const std = i.runs.standard;
  if (std) {
    const raw = scoreRaw({
      run: std,
      twin: i.twin,
      carbon: i.env.carbon,
      systems: i.env.pipeline.systems ?? [],
    });
    out.score = scoreOf(indicatorsOf(raw, zoneOf(i.twin)));
  }
  const rating = i.runs.rating;
  if (rating && i.env.epcProxy) {
    out.epc = epcEstimate(i.env.epcProxy as EpcProxyLike, rating.result, rating.heavy.geometry.tfaM2);
  }
  return out;
}

/** Score anchor zone of a twin's region (UK pack anchors for GB, India pack for IN). */
export function zoneOf(twin: HomeTwin): 'uk' | 'in' {
  return twin.region.startsWith('IN') ? 'in' : 'uk';
}
