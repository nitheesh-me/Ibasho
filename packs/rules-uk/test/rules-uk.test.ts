/**
 * rules-uk golden tests (WP-03 M-0). Tests may wire packs, engine and fixtures (dependency-cruiser
 * exempts tests). GH1 does not know whether its supply is looped, so its heat pump is needs-check.
 */
import { createRegistry, type HomeTwin, type OwnerCtx, type PackageSpec } from '@ibasho/core';
import { parseTwin, RuleSchema } from '@ibasho/core/schemas';
import { describe, expect, it } from 'vitest';
import {
  evaluateRules,
  homeFacts,
  ownerFacts,
  packageFacts,
  type RuleCtx,
} from '../../../packages/engine/src/rules/index.ts';
import gh1Json from '../../../packages/fixtures/src/homes/gh1.twin.json' with { type: 'json' };
import { M0_MEASURES } from '../../home-uk/src/engine/index.ts';
import { DNO_RULES, rulesUk, rulesUkEngineModule, UK_DNO_HP_LOOPED } from '../src/engine/index.ts';

const gh1 = parseTwin(gh1Json);
const owner: OwnerCtx = { tenure: 'owner', discountRatePpb: 35_000_000n, horizonYears: 25 };

function ctxFor(twin: HomeTwin, pkg: PackageSpec, o: OwnerCtx = owner, capex?: bigint): RuleCtx {
  const options = Object.entries(pkg.options)
    .filter(([, optionId]) => optionId !== 'none')
    .map(([group, optionId]) => {
      const m = M0_MEASURES.find((x) => x.group === group);
      if (m === undefined) throw new Error(`no measure for group ${group}`);
      return { optionId, kind: m.measureKind, facts: m.facts(twin, optionId) };
    });
  const ids = options.map((x) => x.optionId);
  return {
    region: twin.region,
    asOf: '2026-10-11',
    home: homeFacts(twin),
    owner: ownerFacts(o),
    options,
    pkg: packageFacts(capex === undefined ? { optionIds: ids } : { optionIds: ids, capex }),
    checks: twin.checks,
  };
}
const withSupply = (looped: boolean | 'unknown', checks: HomeTwin['checks'] = []): HomeTwin => ({
  ...gh1,
  legal: { ...gh1.legal, supply: { ...gh1.legal.supply, looped } },
  checks,
});

const ashpPkg: PackageSpec = { id: 'heat-ashp+loft-300', options: { loft: 'loft-300', heat: 'heat-ashp' } };
const loftPkg: PackageSpec = { id: 'loft-300', options: { loft: 'loft-300' } };

describe('rule data', () => {
  it('every rule parses, has a grade and a source URL', () => {
    for (const r of DNO_RULES) {
      expect(RuleSchema.safeParse(r).success).toBe(true);
      expect(r.source.grade).toBeTruthy();
      expect(r.source.url).toMatch(/^https:\/\//);
    }
  });
  it('the module registers cleanly', async () => {
    const reg = createRegistry();
    reg.registerAll(await rulesUkEngineModule.load());
    expect(reg.get('rule-pack', rulesUk.id).rules.map((r) => r.id)).toEqual(['UK.DNO.HP.LOOPED']);
  });
});

describe('UK.DNO.HP.LOOPED golden (GH1)', () => {
  it('GH1 as recorded (looped unknown): heat pump is needs-check, names the fact and the check', () => {
    expect(gh1.legal.supply.looped).toBe('unknown');
    const f = evaluateRules(rulesUk.rules, ctxFor(gh1, ashpPkg)).feasibility;
    expect(f.status).toBe('needs-check');
    expect(f.checks).toEqual([{ ruleId: UK_DNO_HP_LOOPED.id, check: 'dno-approval' }]);
    expect(f.unknownBy).toEqual([{ ruleId: UK_DNO_HP_LOOPED.id, facts: ['h.supply.looped'] }]);
  });
  it('does not touch a package without a heat pump', () => {
    expect(evaluateRules(rulesUk.rules, ctxFor(gh1, loftPkg)).feasibility.status).toBe('feasible');
  });
  it('unlooped supply: feasible; looped: needs-check until approval is recorded', () => {
    expect(evaluateRules(rulesUk.rules, ctxFor(withSupply(false), ashpPkg)).feasibility.status).toBe(
      'feasible',
    );
    expect(evaluateRules(rulesUk.rules, ctxFor(withSupply(true), ashpPkg)).feasibility.status).toBe(
      'needs-check',
    );
    const approved = withSupply('unknown', [{ kind: 'dno-approval', at: '2026-09-01', result: 'pass' }]);
    expect(evaluateRules(rulesUk.rules, ctxFor(approved, ashpPkg)).feasibility.status).toBe('feasible');
    const refused = withSupply(true, [{ kind: 'dno-approval', at: '2026-09-01', result: 'fail' }]);
    expect(evaluateRules(rulesUk.rules, ctxFor(refused, ashpPkg)).feasibility).toMatchObject({
      status: 'blocked',
      blockedBy: [UK_DNO_HP_LOOPED.id],
    });
  });
});

describe('budget built-in golden (GH1, the demo budget of 15,000 pounds, SPEC R1)', () => {
  const budget = 15_000n * 100_000_000n;
  const demo: OwnerCtx = { ...owner, budget };
  it('loft at 1,200 pounds is within budget; a 16,000 pound package is blocked', () => {
    const unlooped = withSupply(false);
    expect(
      evaluateRules(rulesUk.rules, ctxFor(unlooped, loftPkg, demo, 1_200n * 100_000_000n)).feasibility.status,
    ).toBe('feasible');
    expect(
      evaluateRules(rulesUk.rules, ctxFor(unlooped, ashpPkg, demo, 16_000n * 100_000_000n)).feasibility,
    ).toMatchObject({ status: 'blocked', blockedBy: ['BUILTIN.BUDGET'] });
  });
  it('no budget at Reveal: the same 16,000 pound package is not blocked by budget', () => {
    expect(
      evaluateRules(rulesUk.rules, ctxFor(withSupply(false), ashpPkg, owner, 16_000n * 100_000_000n))
        .feasibility.status,
    ).toBe('feasible');
  });
});
