/**
 * Built-in rules (SPEC 9 "Built-ins"; LV 6.3 `budgetRule`). Owner: WP-03.
 *
 * Built-ins are ordinary `Rule` data, so Lean evaluates them like any pack rule. They apply in every
 * jurisdiction: `evaluateRules` filters them by date only. M-0 ships `budget`; tenure, memory,
 * conflicts, prereq and target follow at M-B.
 */
import type { Rule } from '@ibasho/core';

/**
 * Budget: block a package whose central capital cost is above the owner's budget.
 * `o.budget.set` is always known, so with no budget the condition is false (SPEC R24). With a
 * budget but an unknown cost (`p.capex` missing) the condition is unknown, and the package is
 * `needs-check` (a quote is needed), never feasible.
 */
export const BUDGET_RULE: Rule = {
  id: 'BUILTIN.BUDGET',
  jurisdiction: 'GB',
  measures: '*',
  scope: 'package',
  when: {
    and: [
      { cmp: '=', left: { fact: 'o.budget.set' }, right: 1 },
      { cmp: '>', left: { fact: 'p.capex' }, right: { fact: 'o.budget' } },
    ],
  },
  effect: { kind: 'block', reason: 'rules.builtin.budget.reason' },
  effectiveFrom: '2000-01-01',
  source: {
    url: 'urn:ibasho:spec:9:built-ins',
    clause: 'SPEC 9 built-ins; LV 6.3 budgetRule',
    grade: 'primary',
  },
  explain: 'rules.builtin.budget.explain',
};

export const BUILTIN_RULES: readonly Rule[] = [BUDGET_RULE];
