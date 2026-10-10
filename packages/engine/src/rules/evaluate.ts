/**
 * Rule evaluation and package status (ARCH 5.4 evaluation order, RP 3, SPEC R22). Owner: WP-03.
 *
 * Steps 1 to 3 and 6 of ARCH 5.4 live here: filter by jurisdiction and `asOf`, evaluate measure
 * rules per option, evaluate package rules, decide status. Applying obligations and re-running
 * physics (steps 4 and 5) belong to the search (WP-02); obligations come back de-duplicated so
 * applying them twice equals applying them once.
 *
 * Effects by condition value (`v`):
 * - `block`: true blocks; unknown makes the package `needs-check` and names the unknown facts.
 *   An unknown block is never `feasible` (C3, Lean `unknown_never_feasible`).
 * - `check`: true or unknown needs the check unless `twin.checks` records it. A recorded `pass`
 *   or `conditional` satisfies it; a recorded `fail` blocks.
 * - `consent`, `oblige`, `warn`: true or unknown adds the entry (worst case: the owner may need it).
 * - `info`: no effect on feasibility.
 */
import type {
  CheckKind,
  FactId,
  Feasibility,
  HomeTwin,
  IsoDate,
  MeasureKind,
  MicroPence,
  RegionCode,
  Rule,
  Tri,
} from '@ibasho/core';
import { regionContains } from '@ibasho/core';
import { BUILTIN_RULES } from './builtins.ts';
import type { FactEnv, FactValue, FnTable } from './expr.ts';
import { evalExpr, unknownFacts } from './expr.ts';
import { moneyFact } from './facts.ts';

export interface RuleOption {
  optionId: string;
  kind: MeasureKind;
  /** `m.*` facts from `MeasureModel.facts`. */
  facts: FactEnv;
}

export interface RuleCtx {
  region: RegionCode;
  asOf: IsoDate;
  /** `h.*` facts (`homeFacts`). */
  home: FactEnv;
  /** `o.*` facts (`ownerFacts`). */
  owner: FactEnv;
  /** The chosen options of the package (`none` excluded). */
  options: readonly RuleOption[];
  /** `p.*` facts (`packageFacts`). */
  pkg: FactEnv;
  /** Recorded checks (`twin.checks`). */
  checks: HomeTwin['checks'];
  fns?: FnTable;
  /** Include `CITY` rules (M-H). */
  city?: boolean;
  /** Built-ins to prepend; default `BUILTIN_RULES`. */
  builtins?: readonly Rule[];
}

/** One rule evaluated on one subject. Feeds the certificate (`feas.recompute`) and the ledger. */
export interface RuleOutcome {
  ruleId: string;
  /** Option id for measure rules, `package` for package rules. */
  subject: string;
  value: Tri;
  unknown: FactId[];
}

export interface RulesEvaluation {
  feasibility: Feasibility;
  outcomes: RuleOutcome[];
}

/** True when `rule` is in force on `asOf` (both ends inclusive; ISO dates compare as strings). */
export function isInForce(rule: Rule, asOf: IsoDate): boolean {
  return rule.effectiveFrom <= asOf && (rule.effectiveTo === undefined || asOf <= rule.effectiveTo);
}

/** Step 1: pack rules for this region and date. */
export function activeRules(rules: readonly Rule[], region: RegionCode, asOf: IsoDate, city = false): Rule[] {
  return rules.filter(
    (r) => isInForce(r, asOf) && (r.jurisdiction === 'CITY' ? city : regionContains(r.jurisdiction, region)),
  );
}

/** `p.*` facts. M-0: option count and central capital cost (omitted when unknown). */
export function packageFacts(input: { optionIds: readonly string[]; capex?: MicroPence }): FactEnv {
  const out: Record<string, FactValue> = { 'p.count': input.optionIds.length };
  if (input.capex !== undefined) out['p.capex'] = moneyFact(input.capex);
  return out;
}

function latestCheck(checks: HomeTwin['checks'], kind: CheckKind): HomeTwin['checks'][number] | undefined {
  let best: HomeTwin['checks'][number] | undefined;
  for (const c of checks) if (c.kind === kind && (best === undefined || c.at >= best.at)) best = c;
  return best;
}

export function evaluateRules(rules: readonly Rule[], ctx: RuleCtx): RulesEvaluation {
  const fns = ctx.fns ?? {};
  const all = [
    ...(ctx.builtins ?? BUILTIN_RULES).filter((r) => isInForce(r, ctx.asOf)),
    ...activeRules(rules, ctx.region, ctx.asOf, ctx.city ?? false),
  ];
  const outcomes: RuleOutcome[] = [];
  const f: Feasibility = { status: 'feasible', consents: [], obligations: [], checks: [], warnings: [] };
  const blockedBy: string[] = [];
  const unknownBy: { ruleId: string; facts: FactId[] }[] = [];
  const seen = new Set<string>();
  let undecided = false;
  const once = (key: string): boolean => {
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };

  const apply = (rule: Rule, subject: string, env: FactEnv): void => {
    const value = evalExpr(rule.when, env, fns);
    const unknown = value === 'unknown' ? unknownFacts(rule.when, env) : [];
    outcomes.push({ ruleId: rule.id, subject, value, unknown });
    if (value === false) return;
    const e = rule.effect;
    switch (e.kind) {
      case 'block':
        if (value === true) {
          if (once(`b|${rule.id}`)) blockedBy.push(rule.id);
        } else {
          undecided = true;
          if (once(`u|${rule.id}|${subject}`)) unknownBy.push({ ruleId: rule.id, facts: unknown });
        }
        return;
      case 'check': {
        const rec = latestCheck(ctx.checks, e.check);
        if (rec === undefined) {
          undecided = true;
          if (once(`c|${rule.id}|${e.check}`)) f.checks.push({ ruleId: rule.id, check: e.check });
          if (value === 'unknown' && once(`u|${rule.id}|${subject}`))
            unknownBy.push({ ruleId: rule.id, facts: unknown });
        } else if (rec.result === 'fail' && once(`b|${rule.id}`)) blockedBy.push(rule.id);
        return;
      }
      case 'consent':
        if (once(`k|${rule.id}|${e.authority}`)) f.consents.push({ ruleId: rule.id, authority: e.authority });
        return;
      case 'oblige':
        if (once(`o|${rule.id}|${JSON.stringify(e.spec)}`))
          f.obligations.push({ ruleId: rule.id, spec: e.spec });
        return;
      case 'warn':
        if (once(`w|${rule.id}|${e.risk}`)) f.warnings.push({ ruleId: rule.id, risk: e.risk });
        return;
      case 'info':
        return;
    }
  };

  for (const rule of all) {
    if (rule.scope === 'measure') {
      for (const o of ctx.options) {
        if (rule.measures !== '*' && !rule.measures.includes(o.kind)) continue;
        apply(rule, o.optionId, { ...ctx.home, ...ctx.owner, ...o.facts });
      }
    } else {
      const kinds = new Set(ctx.options.map((o) => o.kind));
      if (rule.measures !== '*' && !rule.measures.some((k) => kinds.has(k))) continue;
      apply(rule, 'package', { ...ctx.home, ...ctx.owner, ...ctx.pkg });
    }
  }

  if (blockedBy.length > 0) {
    f.status = 'blocked';
    f.blockedBy = blockedBy;
  } else if (undecided) f.status = 'needs-check';
  if (unknownBy.length > 0) f.unknownBy = unknownBy;
  return { feasibility: f, outcomes };
}
