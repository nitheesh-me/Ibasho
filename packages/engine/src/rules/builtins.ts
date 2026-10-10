/**
 * Built-in rules (SPEC 9 "Built-ins"; LV 6.3 `budgetRule`). Owner: WP-03.
 *
 * Built-ins are ordinary `Rule` data, so Lean evaluates them like any pack rule. They apply in every
 * jurisdiction: `evaluateRules` filters them by date only. Here: budget, tenure, prerequisites and
 * conflicts. Memory (`BUILTIN.MEMORY`) and target (`BUILTIN.TARGET`) are decided by the search
 * (WP-02), which owns the rejected options and the target.
 */
import type { MeasureKind, Rule } from '@ibasho/core';

const SPEC_SOURCE = (clause: string): Rule['source'] => ({
  url: 'urn:ibasho:spec:9:built-ins',
  clause,
  grade: 'primary',
});

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
  source: SPEC_SOURCE('SPEC 9 built-ins; LV 6.3 budgetRule'),
  explain: 'rules.builtin.budget.explain',
};

/** Fixed measures a tenant needs the landlord's consent for (general law of tenancy, RP 5.3 UK.TEN.TENANT). */
const FIXED: MeasureKind[] = [
  'loft',
  'roof-insulation',
  'cavity',
  'ewi',
  'iwi',
  'floor',
  'glazing-double',
  'glazing-secondary',
  'controls',
  'mvhr',
  'ashp',
  'gshp',
  'radiators',
  'cylinder',
  'hob',
  'gas-disconnect',
  'pv',
  'battery',
  'solar-thermal',
];

/** Tenant: fixed measures need the landlord's consent. */
export const TENURE_TENANT_RULE: Rule = {
  id: 'BUILTIN.TENURE.TENANT',
  jurisdiction: 'GB',
  measures: FIXED,
  scope: 'measure',
  when: { cmp: '=', left: { fact: 'o.tenure' }, right: 'tenant' },
  effect: { kind: 'consent', authority: 'landlord' },
  effectiveFrom: '2000-01-01',
  source: { ...SPEC_SOURCE('SPEC 9 built-ins (tenure); RP 5.3 UK.TEN.TENANT'), grade: 'secondary' },
  explain: 'rules.builtin.tenure.tenant.explain',
};

/** Leaseholder: works on the roof, external walls or windows need the freeholder's consent (LTA 1927 s19). */
export const TENURE_LEASE_RULE: Rule = {
  id: 'BUILTIN.TENURE.LEASE',
  jurisdiction: 'GB',
  measures: ['ewi', 'roof-insulation', 'glazing-double', 'ashp', 'gshp', 'pv', 'solar-thermal'],
  scope: 'measure',
  when: { cmp: '=', left: { fact: 'o.tenure' }, right: 'leaseholder' },
  effect: { kind: 'consent', authority: 'freeholder' },
  effectiveFrom: '2000-01-01',
  source: {
    url: 'https://www.legislation.gov.uk/ukpga/Geo5/17-18/36/section/19',
    clause: 'Landlord and Tenant Act 1927 s19; RP 5.3 UK.TEN.LEASE',
    grade: 'primary',
  },
  explain: 'rules.builtin.tenure.lease.explain',
};

/** A battery needs PV, in the package or already on the home. */
export const PREREQ_BATTERY_RULE: Rule = {
  id: 'BUILTIN.PREREQ.BATTERY-PV',
  jurisdiction: 'GB',
  measures: ['battery'],
  scope: 'package',
  when: {
    and: [
      { cmp: '=', left: { fact: 'p.kind.pv' }, right: 0 },
      { cmp: '=', left: { fact: 'h.pv.count' }, right: 0 },
    ],
  },
  effect: { kind: 'block', reason: 'rules.builtin.prereq.battery-pv.reason' },
  effectiveFrom: '2000-01-01',
  source: SPEC_SOURCE('SPEC 9 groups: battery requires PV'),
  explain: 'rules.builtin.prereq.battery-pv.explain',
};

/** External and internal wall insulation on the same walls conflict (one wall group). */
export const CONFLICT_WALL_RULE: Rule = {
  id: 'BUILTIN.CONFLICT.EWI-IWI',
  jurisdiction: 'GB',
  measures: ['ewi', 'iwi'],
  scope: 'package',
  when: {
    and: [
      { cmp: '>', left: { fact: 'p.kind.ewi' }, right: 0 },
      { cmp: '>', left: { fact: 'p.kind.iwi' }, right: 0 },
    ],
  },
  effect: { kind: 'block', reason: 'rules.builtin.conflict.ewi-iwi.reason' },
  effectiveFrom: '2000-01-01',
  source: SPEC_SOURCE('SPEC 9 wall group: EWI or IWI'),
  explain: 'rules.builtin.conflict.ewi-iwi.explain',
};

/** Secondary glazing over new double glazing is one or the other (one glazing group). */
export const CONFLICT_GLAZING_RULE: Rule = {
  id: 'BUILTIN.CONFLICT.GLAZING',
  jurisdiction: 'GB',
  measures: ['glazing-double', 'glazing-secondary'],
  scope: 'package',
  when: {
    and: [
      { cmp: '>', left: { fact: 'p.kind.glazing-double' }, right: 0 },
      { cmp: '>', left: { fact: 'p.kind.glazing-secondary' }, right: 0 },
    ],
  },
  effect: { kind: 'block', reason: 'rules.builtin.conflict.glazing.reason' },
  effectiveFrom: '2000-01-01',
  source: SPEC_SOURCE('SPEC 9 glazing group: secondary or double'),
  explain: 'rules.builtin.conflict.glazing.explain',
};

export const BUILTIN_RULES: readonly Rule[] = [
  BUDGET_RULE,
  TENURE_TENANT_RULE,
  TENURE_LEASE_RULE,
  PREREQ_BATTERY_RULE,
  CONFLICT_WALL_RULE,
  CONFLICT_GLAZING_RULE,
];
