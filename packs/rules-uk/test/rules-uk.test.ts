/**
 * rules-uk golden tests (WP-03, gate M-B C2, C5, C7). Tests may wire packs, engine and fixtures
 * (dependency-cruiser exempts tests).
 *
 * Every rule of the pack (and every built-in) has one golden: a context where it fires (value
 * true) and one where it stays quiet (false, or not evaluated). The SPEC 9 acceptance cases of
 * BUILD_PLAN C2 follow as named tests, then the asOf retirement (C5) and the lint (C7).
 */
import {
  createRegistry,
  type HomeTwin,
  type IsoDate,
  type MeasureKind,
  type OwnerCtx,
  type PackageSpec,
  type RegionCode,
} from '@ibasho/core';
import { parseTwin, RuleSchema } from '@ibasho/core/schemas';
import { describe, expect, it } from 'vitest';
import {
  BUILTIN_RULES,
  encodeNoiseSites,
  evaluateRules,
  type FactEnv,
  homeFacts,
  lintRules,
  normaliseObligations,
  ownerFacts,
  packageFacts,
  type RuleCtx,
  type RulesEvaluation,
  renderRule,
} from '../../../packages/engine/src/rules/index.ts';
import gh1Json from '../../../packages/fixtures/src/homes/gh1.twin.json' with { type: 'json' };
import { M0_MEASURES } from '../../home-uk/src/engine/index.ts';
import { RULES_UK, rulesUk, rulesUkEngineModule, UK_DNO_HP_LOOPED } from '../src/engine/index.ts';

/** En and em dash characters, built from code points so this file stays free of them. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
const gh1 = parseTwin(gh1Json);
const owner: OwnerCtx = { tenure: 'owner', discountRatePpb: 35_000_000n, horizonYears: 25 };
const GBP = 100_000_000n;

// ---------------------------------------------------------------------------------------------
// Synthetic contexts on GH1's home facts.

interface Case {
  region?: RegionCode;
  asOf?: IsoDate;
  home?: FactEnv;
  options?: { kind: MeasureKind; facts?: FactEnv }[];
  pkg?: FactEnv;
  owner?: OwnerCtx;
  capex?: bigint;
  checks?: HomeTwin['checks'];
}

function run(c: Case): RulesEvaluation {
  const region = c.region ?? 'GB-ENG';
  const options = (c.options ?? []).map((o, i) => ({
    optionId: `opt-${i}-${o.kind}`,
    kind: o.kind,
    facts: o.facts ?? {},
  }));
  const ids = options.map((o) => o.optionId);
  const ctx: RuleCtx = {
    region,
    asOf: c.asOf ?? '2026-10-11',
    home: { ...homeFacts(gh1), 'h.region': region, ...c.home },
    owner: ownerFacts(c.owner ?? owner),
    options,
    pkg: {
      ...packageFacts(c.capex === undefined ? { optionIds: ids } : { optionIds: ids, capex: c.capex }),
      ...c.pkg,
    },
    checks: c.checks ?? [],
  };
  return evaluateRules(RULES_UK, ctx);
}
const valueFor = (ev: RulesEvaluation, ruleId: string) => ev.outcomes.find((o) => o.ruleId === ruleId)?.value;

const loudUnit = { lwaDdB: 700, surfaces: 2, rDm: 80, barrier: { type: 'none' } } as const;
const quietUnit = { lwaDdB: 600, surfaces: 2, rDm: 80, barrier: { type: 1, view: 'partly' } } as const;
const ashp = (facts: FactEnv = {}) => ({ kind: 'ashp' as const, facts });
const listedII = { 'h.designations.listedGrade': 'II' };
const notListed = {
  'h.designations.listedGrade': 'none',
  'h.designations.inCurtilageOfListed': false,
  'h.designations.scheduledMonument': false,
};

/** One golden per rule: `fires` gives value true, `quiet` gives false or no evaluation. */
const GOLDENS: Record<string, { fires: Case; quiet: Case }> = {
  'ENG.PD.ASHP.NOISE': {
    fires: { options: [ashp({ 'm.ashp.noise': encodeNoiseSites([[loudUnit]]) })] },
    quiet: { options: [ashp({ 'm.ashp.noise': encodeNoiseSites([[quietUnit]]) })] },
  },
  'ENG.PD.ASHP.VOLUME': {
    fires: { options: [ashp({ 'm.ashp.volumeM3': 1.6 })] },
    quiet: { options: [ashp({ 'm.ashp.volumeM3': 1.2 })] },
  },
  'ENG.PD.ASHP.COUNT': {
    fires: { options: [ashp({ 'm.ashp.units': 2 })] },
    quiet: { options: [ashp({ 'm.ashp.units': 1 })] },
  },
  'ENG.PD.ASHP.HWY23': {
    fires: { options: [ashp({ 'm.ashp.frontsHighway': true })] },
    quiet: { options: [ashp({ 'm.ashp.frontsHighway': false, 'm.ashp.nearerHighway': false })] },
  },
  'ENG.PD.ASHP.LISTED': {
    fires: { home: listedII, options: [ashp()] },
    quiet: { home: notListed, options: [ashp()] },
  },
  'ENG.PD.ASHP.SCHEDMON': {
    fires: { home: { 'h.designations.scheduledMonument': true }, options: [ashp()] },
    quiet: { home: notListed, options: [ashp()] },
  },
  'ENG.PD.ASHP.FLATROOF': {
    fires: { options: [ashp({ 'm.ashp.mount': 'flat-roof', 'm.ashp.edgeDistM': 0.5 })] },
    quiet: { options: [ashp({ 'm.ashp.mount': 'ground' })] },
  },
  'ENG.PD.ASHP.PITCHED': {
    fires: { options: [ashp({ 'm.ashp.mount': 'pitched-roof' })] },
    quiet: { options: [ashp({ 'm.ashp.mount': 'ground' })] },
  },
  'ENG.PD.ASHP.COOLONLY': {
    fires: { options: [ashp({ 'm.ashp.coolingOnly': true })] },
    quiet: { options: [ashp({ 'm.ashp.coolingOnly': false })] },
  },
  'ENG.PD.ASHP.BOUNDARY1M': {
    fires: { asOf: '2025-05-28', options: [ashp({ 'm.ashp.boundaryDistM': 0.5 })] },
    quiet: { asOf: '2025-05-28', options: [ashp({ 'm.ashp.boundaryDistM': 2 })] },
  },
  'ENG.PD.ASHP.SITING': { fires: { options: [ashp()] }, quiet: { options: [{ kind: 'loft' }] } },
  'ENG.PD.ART4.PV': {
    fires: { home: { 'h.art4.P14.A': true }, options: [{ kind: 'pv' }] },
    quiet: { options: [{ kind: 'pv' }] },
  },
  'ENG.PD.ART4.ASHP': {
    fires: { home: { 'h.art4.P14.G': true }, options: [ashp()] },
    quiet: { options: [ashp()] },
  },
  'ENG.PD.ART4.EWI': {
    fires: { home: { 'h.art4.P1.A': true }, options: [{ kind: 'ewi' }] },
    quiet: { options: [{ kind: 'ewi' }] },
  },
  'ENG.PD.PV.WALL23': {
    fires: { options: [{ kind: 'pv', facts: { 'm.pv.mount': 'wall', 'm.pv.frontsHighway': true } }] },
    quiet: { options: [{ kind: 'pv', facts: { 'm.pv.mount': 'roof' } }] },
  },
  'ENG.PD.PV.FLAT23': {
    fires: { options: [{ kind: 'pv', facts: { 'm.pv.mount': 'flat' } }] },
    quiet: { options: [{ kind: 'pv', facts: { 'm.pv.mount': 'roof' } }] },
  },
  'ENG.PD.PV.PROJ': {
    fires: { options: [{ kind: 'pv', facts: { 'm.pv.mount': 'roof', 'm.pv.projectionM': 0.3 } }] },
    quiet: { options: [{ kind: 'pv', facts: { 'm.pv.mount': 'roof', 'm.pv.projectionM': 0.1 } }] },
  },
  'ENG.PD.PV.LISTED': {
    fires: { home: listedII, options: [{ kind: 'pv' }] },
    quiet: { home: notListed, options: [{ kind: 'pv' }] },
  },
  'ENG.PD.EWI.ART23': {
    fires: { options: [{ kind: 'ewi', facts: { 'm.ewi.finish': 'render' } }] },
    quiet: { options: [{ kind: 'ewi', facts: { 'm.ewi.finish': 'brick-slip' } }] },
  },
  'ENG.PD.EWI.LOOK': {
    fires: { options: [{ kind: 'ewi', facts: { 'm.ewi.matches': false } }] },
    quiet: { options: [{ kind: 'ewi', facts: { 'm.ewi.matches': true } }] },
  },
  'ENG.PD.EWI.FLAT': {
    fires: { home: { 'h.flat': true }, options: [{ kind: 'ewi' }] },
    quiet: { options: [{ kind: 'ewi' }] },
  },
  'ENG.LB.ANY': {
    fires: { home: listedII, options: [{ kind: 'iwi' }] },
    quiet: { home: notListed, options: [{ kind: 'iwi' }] },
  },
  'ENG.BR.L.RENOV.EWI': {
    fires: { options: [{ kind: 'ewi', facts: { 'm.wall.share': 1 } }] },
    quiet: { home: { 'h.wall.u': 0.6 }, options: [{ kind: 'ewi', facts: { 'm.wall.share': 1 } }] },
  },
  'ENG.BR.L.RENOV.IWI': {
    fires: {
      home: { 'h.wall.traditional': false },
      options: [{ kind: 'iwi', facts: { 'm.wall.share': 1 } }],
    },
    quiet: { options: [{ kind: 'iwi', facts: { 'm.wall.share': 1 } }] },
  },
  'ENG.BR.L.RENOV.ENV': {
    fires: { options: [{ kind: 'ewi', facts: { 'm.ewi.renovatedM2': 39.62 } }] },
    quiet: { options: [{ kind: 'ewi', facts: { 'm.ewi.renovatedM2': 20 } }] },
  },
  'ENG.BR.L.TRAD': {
    fires: { options: [{ kind: 'iwi' }] },
    quiet: { home: { 'h.wall.traditional': false }, options: [{ kind: 'iwi' }] },
  },
  'ENG.BR.L.FLOW55': { fires: { options: [ashp()] }, quiet: { options: [{ kind: 'loft' }] } },
  'ENG.BR.L.HPSIZE': { fires: { options: [ashp()] }, quiet: { options: [{ kind: 'loft' }] } },
  'ENG.BR.F.CAT.B': {
    fires: { options: [{ kind: 'loft' }, { kind: 'draught', facts: { 'm.draught.openChimneys': 1 } }] },
    quiet: { options: [{ kind: 'controls' }] },
  },
  'ENG.BR.F.CAT.C': {
    fires: { options: [{ kind: 'ewi' }, { kind: 'floor' }, { kind: 'glazing-double' }, { kind: 'draught' }] },
    quiet: { options: [{ kind: 'loft' }] },
  },
  'ENG.BR.O.ADVISORY': {
    fires: { home: { 'h.glazing.swToFloor': 0.3 }, options: [{ kind: 'draught' }] },
    quiet: { options: [{ kind: 'draught' }] },
  },
  'ENG.BR.L.HIST': {
    fires: { options: [{ kind: 'iwi' }] },
    quiet: { home: { 'h.wall.traditional': false }, options: [{ kind: 'iwi' }] },
  },
  'ENG.MOIST.IWI': {
    fires: { options: [{ kind: 'iwi' }] },
    quiet: { home: { 'h.wall.solidMasonry': false }, options: [{ kind: 'iwi' }] },
  },
  'ENG.MOIST.IWI.COST': {
    fires: { options: [{ kind: 'iwi' }] },
    quiet: { home: { 'h.wall.solidMasonry': false }, options: [{ kind: 'iwi' }] },
  },
  'ENG.BR.NOTIFY': { fires: { options: [{ kind: 'ewi' }] }, quiet: { options: [{ kind: 'loft' }] } },
  'UK.DNO.HP.LOOPED': {
    fires: { home: { 'h.supply.looped': true }, options: [ashp()] },
    quiet: { home: { 'h.supply.looped': false }, options: [ashp()] },
  },
  'UK.DNO.HP': { fires: { options: [ashp()] }, quiet: { options: [{ kind: 'loft' }] } },
  'UK.DNO.G98': {
    fires: { options: [{ kind: 'pv', facts: { 'm.pv.exportW': 3000 } }] },
    quiet: { options: [{ kind: 'pv', facts: { 'm.pv.exportW': 4000 } }] },
  },
  'UK.DNO.G99': {
    fires: { options: [{ kind: 'pv', facts: { 'm.pv.exportW': 4000 } }] },
    quiet: { options: [{ kind: 'pv', facts: { 'm.pv.exportW': 3000 } }] },
  },
  'UK.PAS2035': {
    fires: { options: [{ kind: 'loft' }], pkg: { 'p.funded.pas2035': true } },
    quiet: { options: [{ kind: 'loft' }] },
  },
  'UK.BUS': { fires: { options: [ashp()] }, quiet: { region: 'GB-SCT', options: [ashp()] } },
  'EW.MEES.NOW': {
    fires: {
      owner: { ...owner, tenure: 'landlord' },
      home: { 'h.epc.band': 'F' },
      options: [{ kind: 'loft' }],
    },
    quiet: { home: { 'h.epc.band': 'F' }, options: [{ kind: 'loft' }] },
  },
  'EW.MEES.CAP': {
    fires: {
      owner: { ...owner, tenure: 'landlord' },
      home: { 'h.value.gbp': 200_000 },
      capex: 12_000n * GBP,
      options: [{ kind: 'ewi' }],
    },
    quiet: {
      owner: { ...owner, tenure: 'landlord' },
      home: { 'h.value.gbp': 200_000 },
      capex: 5_000n * GBP,
      options: [{ kind: 'ewi' }],
    },
  },
  'APPL.CYLINDER-JACKET.COMBI': {
    fires: { options: [{ kind: 'cylinder-jacket' }] },
    quiet: { home: { 'h.dhw.class': 'cylinder' }, options: [{ kind: 'cylinder-jacket' }] },
  },
  'APPL.SOLAR-THERMAL.COMBI': {
    fires: { options: [{ kind: 'solar-thermal' }] },
    quiet: { options: [{ kind: 'solar-thermal' }, ashp()] },
  },
  'APPL.MVHR.AP50': {
    fires: { home: { 'h.vent.ap50': 10 }, options: [{ kind: 'mvhr' }] },
    quiet: { home: { 'h.vent.ap50': 3 }, options: [{ kind: 'mvhr' }] },
  },
  'APPL.LOFT.ACCESS': {
    fires: { options: [{ kind: 'loft', facts: { 'm.loft.accessible': false } }] },
    quiet: { options: [{ kind: 'loft', facts: { 'm.loft.accessible': true } }] },
  },
  'APPL.FLOOR.SUSPENDED': {
    fires: { home: { 'h.floor.type': 'solid' }, options: [{ kind: 'floor' }] },
    quiet: { home: { 'h.floor.type': 'suspended-unsealed' }, options: [{ kind: 'floor' }] },
  },
  'SCT.STUB': {
    fires: { region: 'GB-SCT', options: [{ kind: 'loft' }] },
    quiet: { options: [{ kind: 'loft' }] },
  },
  'WLS.STUB': {
    fires: { region: 'GB-WLS', options: [{ kind: 'loft' }] },
    quiet: { options: [{ kind: 'loft' }] },
  },
  // Built-ins (SPEC 9): budget, tenure, prerequisites, conflicts.
  'BUILTIN.BUDGET': {
    fires: { owner: { ...owner, budget: 1_000n * GBP }, capex: 1_200n * GBP, options: [{ kind: 'loft' }] },
    quiet: { capex: 1_200n * GBP, options: [{ kind: 'loft' }] },
  },
  'BUILTIN.TENURE.TENANT': {
    fires: { owner: { ...owner, tenure: 'tenant' }, options: [{ kind: 'loft' }] },
    quiet: { options: [{ kind: 'loft' }] },
  },
  'BUILTIN.TENURE.LEASE': {
    fires: { owner: { ...owner, tenure: 'leaseholder' }, options: [{ kind: 'pv' }] },
    quiet: { options: [{ kind: 'pv' }] },
  },
  'BUILTIN.PREREQ.BATTERY-PV': {
    fires: { options: [{ kind: 'battery' }] },
    quiet: { options: [{ kind: 'battery' }, { kind: 'pv' }] },
  },
  'BUILTIN.CONFLICT.EWI-IWI': {
    fires: { options: [{ kind: 'ewi' }, { kind: 'iwi' }] },
    quiet: { options: [{ kind: 'ewi' }] },
  },
  'BUILTIN.CONFLICT.GLAZING': {
    fires: { options: [{ kind: 'glazing-double' }, { kind: 'glazing-secondary' }] },
    quiet: { options: [{ kind: 'glazing-double' }] },
  },
};

describe('C2 one golden per rule', () => {
  const ids = [...RULES_UK, ...BUILTIN_RULES].map((r) => r.id);
  it('every rule of the pack and every built-in has a golden', () => {
    expect(ids.filter((id) => GOLDENS[id] === undefined)).toEqual([]);
  });
  for (const [id, g] of Object.entries(GOLDENS)) {
    it(`${id} fires in its golden and stays quiet otherwise`, () => {
      expect(valueFor(run(g.fires), id)).toBe(true);
      expect(valueFor(run(g.quiet), id) ?? false).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------------------------
// SPEC 9 acceptance cases (BUILD_PLAN C2).

const lpaConsents = (ev: RulesEvaluation) => ev.feasibility.consents.filter((c) => c.authority === 'LPA');

describe('C2 SPEC 9 acceptance cases', () => {
  it('rear rendered EWI on Article 2(3) land gives LPA consent', () => {
    const ev = run({
      options: [{ kind: 'ewi', facts: { 'm.ewi.finish': 'render', 'm.ewi.matches': true } }],
    });
    expect(lpaConsents(ev).map((c) => c.ruleId)).toEqual(['ENG.PD.EWI.ART23']);
  });
  it('front EWI with a non-matching finish gives consent, not block', () => {
    const ev = run({
      options: [{ kind: 'ewi', facts: { 'm.ewi.finish': 'brick-slip', 'm.ewi.matches': false } }],
    });
    expect(lpaConsents(ev).map((c) => c.ruleId)).toEqual(['ENG.PD.EWI.LOOK']);
    expect(ev.feasibility.status).not.toBe('blocked');
    expect(ev.feasibility.blockedBy).toBeUndefined();
  });
  it('roof PV without an Article 4 direction gives no LPA consent; with one it does', () => {
    const roof = {
      kind: 'pv' as const,
      facts: { 'm.pv.mount': 'roof', 'm.pv.projectionM': 0.1, 'm.pv.exportW': 3000 },
    };
    const home = { ...notListed };
    expect(lpaConsents(run({ home, options: [roof] }))).toEqual([]);
    expect(
      lpaConsents(run({ home: { ...home, 'h.art4.P14.A': true }, options: [roof] })).map((c) => c.ruleId),
    ).toEqual(['ENG.PD.ART4.PV']);
  });
  it('Part L 0.70 is a trigger, not a floor: renovating a 1.5 wall obliges 0.30; a 0.6 wall obliges nothing', () => {
    const ewi = { kind: 'ewi' as const, facts: { 'm.wall.share': 1 } };
    const hit = run({ options: [ewi] }).feasibility.obligations.filter((o) => o.spec.kind === 'max-u');
    expect(hit.map((o) => o.ruleId)).toContain('ENG.BR.L.RENOV.EWI');
    expect(normaliseObligations(hit.map((o) => o.spec))).toEqual([
      { kind: 'max-u', element: 'wall', maxU: 0.3 },
    ]);
    const miss = run({ home: { 'h.wall.u': 0.6 }, options: [ewi] }).feasibility.obligations;
    expect(miss.filter((o) => o.spec.kind === 'max-u')).toEqual([]);
  });
  it('Part L 25% of the envelope: IWI on non-traditional walls is obliged to 0.30, on traditional walls it is not', () => {
    const iwi = { kind: 'iwi' as const, facts: { 'm.wall.share': 0.4, 'm.iwi.renovatedM2': 39.62 } };
    const env = (ev: RulesEvaluation) =>
      ev.feasibility.obligations.filter((o) => o.ruleId === 'ENG.BR.L.RENOV.ENV');
    expect(env(run({ home: { 'h.wall.traditional': false }, options: [iwi] }))).toHaveLength(1);
    expect(env(run({ home: { 'h.wall.traditional': true }, options: [iwi] }))).toEqual([]);
  });
  it('solar thermal on a combi is applicable when a ground source heat pump brings a cylinder', () => {
    const ev = run({ options: [{ kind: 'solar-thermal' }, { kind: 'gshp' }] });
    expect(valueFor(ev, 'APPL.SOLAR-THERMAL.COMBI')).toBe(false);
  });
  it('PV export of 3.68 kW per phase gives G98 notify; above that G99 consent from the DNO', () => {
    const at = run({ options: [{ kind: 'pv', facts: { 'm.pv.exportW': 3680 } }] });
    expect(valueFor(at, 'UK.DNO.G98')).toBe(true);
    expect(at.feasibility.consents.filter((c) => c.authority === 'DNO')).toEqual([]);
    const over = run({
      options: [
        { kind: 'pv', facts: { 'm.pv.exportW': 3000 } },
        { kind: 'battery', facts: { 'm.battery.exportW': 2500 } },
      ],
    });
    expect(valueFor(over, 'UK.DNO.G98')).toBe(false);
    expect(over.feasibility.consents.filter((c) => c.authority === 'DNO')).toEqual([
      { ruleId: 'UK.DNO.G99', authority: 'DNO' },
    ]);
    const threePhase = run({
      home: { 'h.supply.phases': 3 },
      options: [{ kind: 'pv', facts: { 'm.pv.exportW': 11_000 } }],
    });
    expect(valueFor(threePhase, 'UK.DNO.G98')).toBe(true);
  });
  it('IWI on solid masonry is needs-check; once the moisture assessment is recorded it is feasible', () => {
    const iwi = { kind: 'iwi' as const, facts: { 'm.wall.share': 1 } };
    const home = notListed;
    const before = run({ home, options: [iwi] }).feasibility;
    expect(before.status).toBe('needs-check');
    expect(before.checks).toEqual([{ ruleId: 'ENG.MOIST.IWI', check: 'moisture-assessment' }]);
    expect(before.obligations.map((o) => o.spec)).toContainEqual({
      kind: 'assessment',
      check: 'moisture-assessment',
    });
    const after = run({
      home,
      options: [iwi],
      checks: [{ kind: 'moisture-assessment', at: '2026-09-01', result: 'pass' }],
    });
    expect(after.feasibility.status).toBe('feasible');
  });
  it('heat pump noise: a loud unit needs planning permission, a quiet one does not', () => {
    const sited = {
      'm.ashp.noise': encodeNoiseSites([[quietUnit]]),
      'm.ashp.volumeM3': 1.0,
      'm.ashp.units': 1,
      'm.ashp.mount': 'ground',
      'm.ashp.coolingOnly': false,
      'm.ashp.frontsHighway': false,
      'm.ashp.nearerHighway': false,
    };
    const quiet = run({ home: notListed, options: [ashp(sited)] });
    expect(lpaConsents(quiet).map((c) => c.ruleId)).toEqual([]);
    const loud = run({
      home: notListed,
      options: [ashp({ 'm.ashp.noise': encodeNoiseSites([[loudUnit]]) })],
    });
    expect(lpaConsents(loud).map((c) => c.ruleId)).toContain('ENG.PD.ASHP.NOISE');
  });
  it('AD F: loft plus chimney sealing is category B; three major and one minor measure is category C', () => {
    const b = run({
      options: [{ kind: 'loft' }, { kind: 'draught', facts: { 'm.draught.openChimneys': 1 } }],
    });
    expect(b.feasibility.obligations.map((o) => o.ruleId)).toContain('ENG.BR.F.CAT.B');
    const c = run({
      options: [{ kind: 'ewi' }, { kind: 'floor' }, { kind: 'glazing-double' }, { kind: 'draught' }],
    });
    expect(c.feasibility.obligations.map((o) => o.ruleId)).toContain('ENG.BR.F.CAT.C');
    expect(c.feasibility.obligations.map((o) => o.ruleId)).not.toContain('ENG.BR.F.CAT.B');
  });
});

describe('C5 asOf: the ASHP boundary rule retires', () => {
  const near = { options: [ashp({ 'm.ashp.boundaryDistM': 0.5 })] };
  it('is active on 2025-05-28 and retired on 2025-05-29', () => {
    expect(valueFor(run({ ...near, asOf: '2025-05-28' }), 'ENG.PD.ASHP.BOUNDARY1M')).toBe(true);
    expect(valueFor(run({ ...near, asOf: '2025-05-29' }), 'ENG.PD.ASHP.BOUNDARY1M')).toBeUndefined();
  });
});

describe('C7 rule data and lint', () => {
  it('every rule parses, has a grade and an https source URL, and the lint is clean', () => {
    for (const r of RULES_UK) {
      expect(RuleSchema.safeParse(r).success, r.id).toBe(true);
      expect(r.source.grade).toBeTruthy();
      expect(r.source.url).toMatch(/^https:\/\//);
    }
    expect(lintRules([...RULES_UK, ...BUILTIN_RULES])).toEqual([]);
  });
  it('every rule renders as one sentence without dash punctuation', () => {
    for (const r of [...RULES_UK, ...BUILTIN_RULES]) {
      const s = renderRule(r);
      expect(s, r.id).toMatch(/^[A-Z].*\.$/);
      expect(s).not.toMatch(DASHES);
    }
  });
  it('the module registers cleanly with every rule', async () => {
    const reg = createRegistry();
    reg.registerAll(await rulesUkEngineModule.load());
    expect(reg.get('rule-pack', rulesUk.id).rules.map((r) => r.id)).toEqual(RULES_UK.map((r) => r.id));
  });
});

// ---------------------------------------------------------------------------------------------
// GH1 through the real M-0 measure models (unchanged statuses since M-0).

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

describe('GH1 (M-0 measure models)', () => {
  it('heat pump is needs-check on the looped supply only; noise and listing are consents, not blocks', () => {
    const f = evaluateRules(rulesUk.rules, ctxFor(gh1, ashpPkg)).feasibility;
    expect(f.status).toBe('needs-check');
    expect(f.checks).toEqual([{ ruleId: UK_DNO_HP_LOOPED.id, check: 'dno-approval' }]);
    expect(f.unknownBy).toEqual([{ ruleId: UK_DNO_HP_LOOPED.id, facts: ['h.supply.looped'] }]);
    expect(f.consents.map((c) => c.ruleId)).toContain('ENG.PD.ASHP.NOISE');
  });
  it('loft alone is feasible; unlooped supply makes the heat pump feasible', () => {
    expect(evaluateRules(rulesUk.rules, ctxFor(gh1, loftPkg)).feasibility.status).toBe('feasible');
    expect(evaluateRules(rulesUk.rules, ctxFor(withSupply(false), ashpPkg)).feasibility.status).toBe(
      'feasible',
    );
    const refused = withSupply(true, [{ kind: 'dno-approval', at: '2026-09-01', result: 'fail' }]);
    expect(evaluateRules(rulesUk.rules, ctxFor(refused, ashpPkg)).feasibility).toMatchObject({
      status: 'blocked',
      blockedBy: [UK_DNO_HP_LOOPED.id],
    });
  });
  it('budget: 15,000 pound demo budget blocks a 16,000 pound package; no budget does not', () => {
    const demo: OwnerCtx = { ...owner, budget: 15_000n * GBP };
    expect(
      evaluateRules(rulesUk.rules, ctxFor(withSupply(false), ashpPkg, demo, 16_000n * GBP)).feasibility,
    ).toMatchObject({
      status: 'blocked',
      blockedBy: ['BUILTIN.BUDGET'],
    });
    expect(
      evaluateRules(rulesUk.rules, ctxFor(withSupply(false), ashpPkg, owner, 16_000n * GBP)).feasibility
        .status,
    ).toBe('feasible');
  });
});
