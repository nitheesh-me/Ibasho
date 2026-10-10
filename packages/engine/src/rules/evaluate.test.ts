/**
 * Rule evaluation and status tests (WP-03 M-0; BUILD_PLAN C3, C5 shape, budget built-in).
 */
import { type Expr, type OwnerCtx, type Rule, xoshiro128ss } from '@ibasho/core';
import { RuleSchema } from '@ibasho/core/schemas';
import { describe, expect, it } from 'vitest';
import { BUDGET_RULE } from './builtins.ts';
import { activeRules, evaluateRules, isInForce, packageFacts, type RuleCtx } from './evaluate.ts';
import type { FactEnv } from './expr.ts';
import { evalExpr } from './expr.ts';
import { ownerFacts } from './facts.ts';

const rule = (over: Partial<Rule> & Pick<Rule, 'id' | 'when' | 'effect'>): Rule => ({
  jurisdiction: 'GB-ENG',
  measures: '*',
  scope: 'measure',
  effectiveFrom: '2020-01-01',
  source: { url: 'https://example.org/rule', clause: 'test', grade: 'primary' },
  explain: 'test.explain',
  ...over,
});

const owner: OwnerCtx = { tenure: 'owner', discountRatePpb: 35_000_000n, horizonYears: 25 };
const ctx = (over: Partial<RuleCtx> = {}): RuleCtx => ({
  region: 'GB-ENG',
  asOf: '2026-10-11',
  home: {},
  owner: ownerFacts(owner),
  options: [{ optionId: 'heat-ashp', kind: 'ashp', facts: {} }],
  pkg: packageFacts({ optionIds: ['heat-ashp'] }),
  checks: [],
  ...over,
});
const blockIf = (id: string, when: Expr): Rule => rule({ id, when, effect: { kind: 'block', reason: 'r' } });
const looped: Expr = { cmp: '=', left: { fact: 'h.x' }, right: 1 };

describe('status', () => {
  it('true block blocks, false block is feasible, unknown block is needs-check', () => {
    const r = [blockIf('T.B', looped)];
    expect(evaluateRules(r, ctx({ home: { 'h.x': 1 } })).feasibility).toMatchObject({
      status: 'blocked',
      blockedBy: ['T.B'],
    });
    expect(evaluateRules(r, ctx({ home: { 'h.x': 0 } })).feasibility.status).toBe('feasible');
    const u = evaluateRules(r, ctx({ home: { 'h.x': 'unknown' } }));
    expect(u.feasibility.status).toBe('needs-check');
    expect(u.feasibility.unknownBy).toEqual([{ ruleId: 'T.B', facts: ['h.x'] }]);
    expect(u.outcomes.filter((o) => o.ruleId === 'T.B')).toEqual([
      { ruleId: 'T.B', subject: 'heat-ashp', value: 'unknown', unknown: ['h.x'] },
    ]);
  });

  it('a true block wins over an unknown one', () => {
    const r = [blockIf('T.A', looped), blockIf('T.B', { cmp: '>', left: { fact: 'h.y' }, right: 0 })];
    expect(evaluateRules(r, ctx({ home: { 'h.x': 'unknown', 'h.y': 1 } })).feasibility.status).toBe(
      'blocked',
    );
  });

  it('check effects: needed until recorded; pass satisfies, fail blocks, latest record wins', () => {
    const r = [rule({ id: 'T.C', when: looped, effect: { kind: 'check', check: 'dno-approval' } })];
    const need = evaluateRules(r, ctx({ home: { 'h.x': 'unknown' } })).feasibility;
    expect(need.status).toBe('needs-check');
    expect(need.checks).toEqual([{ ruleId: 'T.C', check: 'dno-approval' }]);
    const pass = evaluateRules(
      r,
      ctx({ home: { 'h.x': 1 }, checks: [{ kind: 'dno-approval', at: '2026-01-01', result: 'pass' }] }),
    ).feasibility;
    expect(pass.status).toBe('feasible');
    expect(pass.checks).toEqual([]);
    const fail = evaluateRules(
      r,
      ctx({
        home: { 'h.x': 1 },
        checks: [
          { kind: 'dno-approval', at: '2026-01-01', result: 'pass' },
          { kind: 'dno-approval', at: '2026-02-01', result: 'fail' },
        ],
      }),
    ).feasibility;
    expect(fail.status).toBe('blocked');
  });

  it('consent, oblige and warn land in the ledger once, also when unknown', () => {
    const r = [
      rule({ id: 'T.K', when: looped, effect: { kind: 'consent', authority: 'LPA' } }),
      rule({
        id: 'T.O',
        when: looped,
        effect: { kind: 'oblige', spec: { kind: 'emitter-flow', maxFlowC: 55 } },
      }),
      rule({ id: 'T.W', when: looped, effect: { kind: 'warn', risk: 'risk.x' } }),
      rule({ id: 'T.I', when: looped, effect: { kind: 'info', note: 'note.x' } }),
    ];
    const opts = [
      { optionId: 'a', kind: 'ashp' as const, facts: {} },
      { optionId: 'b', kind: 'ashp' as const, facts: {} },
    ];
    const f = evaluateRules(r, ctx({ options: opts, home: { 'h.x': 'unknown' } })).feasibility;
    expect(f.status).toBe('feasible');
    expect(f.consents).toEqual([{ ruleId: 'T.K', authority: 'LPA' }]);
    expect(f.obligations).toHaveLength(1);
    expect(f.warnings).toHaveLength(1);
  });

  it('measure rules see only matching kinds; package rules need a matching kind in the package', () => {
    const m = rule({
      id: 'T.M',
      measures: ['loft'],
      when: { const: true },
      effect: { kind: 'block', reason: 'r' },
    });
    const p = rule({
      id: 'T.P',
      scope: 'package',
      measures: ['loft'],
      when: { const: true },
      effect: { kind: 'block', reason: 'r' },
    });
    expect(evaluateRules([m, p], ctx()).feasibility.status).toBe('feasible');
    const withLoft = ctx({ options: [{ optionId: 'loft-300', kind: 'loft', facts: {} }] });
    expect(evaluateRules([m, p], withLoft).feasibility.blockedBy).toEqual(['T.M', 'T.P']);
  });
});

describe('filters', () => {
  it('effective dates are inclusive at both ends (C5 shape)', () => {
    const r = rule({
      id: 'T.D',
      when: { const: true },
      effect: { kind: 'block', reason: 'r' },
      effectiveTo: '2025-05-28',
    });
    expect(isInForce(r, '2025-05-28')).toBe(true);
    expect(isInForce(r, '2025-05-29')).toBe(false);
    expect(isInForce(r, '2019-12-31')).toBe(false);
  });
  it('jurisdiction uses region containment; CITY rules need the city flag', () => {
    const gb = rule({ id: 'T.GB', jurisdiction: 'GB', when: T, effect: E });
    const wls = rule({ id: 'T.W', jurisdiction: 'GB-WLS', when: T, effect: E });
    const inr = rule({ id: 'T.IN', jurisdiction: 'IN', when: T, effect: E });
    const city = rule({ id: 'T.CITY', jurisdiction: 'CITY', when: T, effect: E });
    const ids = (city_: boolean) =>
      activeRules([gb, wls, inr, city], 'GB-ENG', '2026-01-01', city_).map((r) => r.id);
    expect(ids(false)).toEqual(['T.GB']);
    expect(ids(true)).toEqual(['T.GB', 'T.CITY']);
  });
});
const T: Expr = { const: true };
const E = { kind: 'info', note: 'n' } as const;

describe('budget built-in', () => {
  const pkg = (capex?: bigint) =>
    packageFacts(capex === undefined ? { optionIds: ['heat-ashp'] } : { optionIds: ['heat-ashp'], capex });
  const pounds = (n: bigint) => n * 100_000_000n;
  const withBudget = ownerFacts({ ...owner, budget: pounds(15_000n) });
  it('is valid rule data', () => {
    expect(RuleSchema.safeParse(BUDGET_RULE).success).toBe(true);
  });
  it('no budget set: never blocks, even with unknown cost (SPEC R24)', () => {
    expect(evaluateRules([], ctx({ pkg: pkg(pounds(99_000n)) })).feasibility.status).toBe('feasible');
    expect(evaluateRules([], ctx({ pkg: pkg() })).feasibility.status).toBe('feasible');
  });
  it('blocks above the budget, allows at or below it', () => {
    const over = evaluateRules([], ctx({ owner: withBudget, pkg: pkg(pounds(15_000n) + 1n) })).feasibility;
    expect(over).toMatchObject({ status: 'blocked', blockedBy: ['BUILTIN.BUDGET'] });
    expect(evaluateRules([], ctx({ owner: withBudget, pkg: pkg(pounds(15_000n)) })).feasibility.status).toBe(
      'feasible',
    );
  });
  it('budget set and cost unknown is needs-check, never feasible', () => {
    const f = evaluateRules([], ctx({ owner: withBudget, pkg: pkg() })).feasibility;
    expect(f.status).toBe('needs-check');
    expect(f.unknownBy).toEqual([{ ruleId: 'BUILTIN.BUDGET', facts: ['p.capex'] }]);
  });
});

// C3: an unknown block is never feasible, and a feasible status survives every completion.
describe('C3 unknown block never feasible', () => {
  const FACTS = ['h.f0', 'h.f1', 'h.f2', 'm.f3', 'm.f4', 'p.f5'];
  it('holds over random block rules and fact environments', () => {
    const rng = xoshiro128ss('wp03-unknown-block');
    const leaf = (): Expr => {
      const fact = { fact: FACTS[rng.int(FACTS.length)] as string };
      return rng.int(2) === 0 ? { cmp: '>', left: fact, right: 0 } : { cmp: '=', left: fact, right: 1 };
    };
    const expr = (d: number): Expr =>
      d === 0 || rng.int(3) === 0
        ? leaf()
        : rng.int(3) === 0
          ? { not: expr(d - 1) }
          : rng.int(2) === 0
            ? { and: [expr(d - 1), expr(d - 1)] }
            : { or: [expr(d - 1), expr(d - 1)] };
    let unknownSeen = 0;
    for (let i = 0; i < 300; i++) {
      const rules = Array.from({ length: 1 + rng.int(3) }, (_, j) =>
        rule({
          id: `T.R${j}`,
          scope: rng.int(2) === 0 ? 'measure' : 'package',
          when: expr(3),
          effect: { kind: 'block', reason: 'r' },
        }),
      );
      const env: Record<string, number | 'unknown'> = {};
      for (const f of FACTS) {
        const r = rng.int(3);
        if (r > 0) env[f] = r === 1 ? 'unknown' : rng.int(2);
      }
      const split = (prefix: string): FactEnv =>
        Object.fromEntries(Object.entries(env).filter(([k]) => k.startsWith(prefix)));
      const c = ctx({
        home: split('h.'),
        options: [{ optionId: 'o', kind: 'ashp', facts: split('m.') }],
        pkg: split('p.'),
      });
      const { feasibility, outcomes } = evaluateRules(rules, c);
      const anyUnknown = outcomes.some((o) => o.value === 'unknown');
      const anyTrue = outcomes.some((o) => o.value === true);
      if (anyUnknown) {
        unknownSeen++;
        expect(feasibility.status).not.toBe('feasible');
      }
      if (feasibility.status === 'feasible') {
        // Every completion of the unknown facts leaves every block false.
        const unknowns = FACTS.filter((f) => env[f] === undefined || env[f] === 'unknown');
        for (let mask = 0; mask < 1 << unknowns.length; mask++) {
          const full: Record<string, number> = {};
          for (const f of FACTS)
            full[f] = env[f] === undefined || env[f] === 'unknown' ? 0 : (env[f] as number);
          unknowns.forEach((f, b) => {
            full[f] = (mask >> b) & 1;
          });
          for (const r of rules) expect(evalExpr(r.when, full)).toBe(false);
        }
      }
      expect(feasibility.status === 'blocked').toBe(anyTrue);
    }
    expect(unknownSeen).toBeGreaterThan(30);
  });
});
