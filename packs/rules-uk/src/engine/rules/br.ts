/**
 * England Building Regulations rules (RP 5.2, SPEC 9, DEC SC-3, SC-4). Owner: WP-03.
 *
 * Part L renovation: renovating more than 50% of a wall (or more than 25% of the envelope) when its
 * U-value is worse than 0.70 obliges the whole wall to 0.30 where technically, functionally and
 * economically feasible (15-year payback), else the best feasible. 0.70 is the trigger, never the
 * target (SPEC 9). For IWI on traditional solid walls the relaxation of AD L 0.11 applies instead:
 * the moisture check (`ENG.MOIST.IWI`) and the warning (`ENG.BR.L.HIST`) take over, and no 0.30
 * is forced. Named functions appear only in `oblige`/`warn`/`info` rules (`lintRules`).
 */
import type { MeasureKind, Rule } from '@ibasho/core';
import { all, always, any, cmp, no, not, SRC, yes } from './helpers.ts';

const ENG = 'GB-ENG' as const;
const ADL_2021 = '2022-06-15';
const ADF_2021 = '2022-06-15';
const HP: MeasureKind[] = ['ashp', 'gshp'];
const WALL_TO = { kind: 'oblige', spec: { kind: 'max-u', element: 'wall', maxU: 0.3 } } as const;
const triggered = cmp('h.wall.u', '>', 0.7);

export const ENG_BR_L_RENOV_EWI: Rule = {
  id: 'ENG.BR.L.RENOV.EWI',
  jurisdiction: ENG,
  measures: ['ewi'],
  scope: 'measure',
  when: all(cmp('m.wall.share', '>', 0.5), triggered),
  effect: WALL_TO,
  effectiveFrom: ADL_2021,
  source: {
    url: SRC.adL2021,
    clause: 'AD L 2021 Vol 1 paras 4.11 to 4.13, Table 4.3: renovated wall to 0.30; 0.70 is the trigger',
    grade: 'primary',
  },
  explain: 'rules.eng.br.l.renov.explain',
};

export const ENG_BR_L_RENOV_IWI: Rule = {
  id: 'ENG.BR.L.RENOV.IWI',
  jurisdiction: ENG,
  measures: ['iwi'],
  scope: 'measure',
  when: all(cmp('m.wall.share', '>', 0.5), triggered, no('h.wall.traditional')),
  effect: WALL_TO,
  effectiveFrom: ADL_2021,
  source: {
    url: SRC.adL2021,
    clause: 'AD L 2021 Vol 1 paras 4.11 to 4.13, Table 4.3 (non-traditional walls)',
    grade: 'primary',
  },
  explain: 'rules.eng.br.l.renov.explain',
};

export const ENG_BR_L_RENOV_ENV: Rule = {
  id: 'ENG.BR.L.RENOV.ENV',
  jurisdiction: ENG,
  measures: ['ewi', 'iwi'],
  scope: 'package',
  // IWI on traditional walls takes the AD L 0.11 route instead (as in ENG.BR.L.RENOV.IWI).
  when: all(
    cmp('p.envelope.share', '>', 0.25),
    triggered,
    any(cmp('p.kind.ewi', '>', 0), no('h.wall.traditional')),
  ),
  effect: WALL_TO,
  effectiveFrom: ADL_2021,
  source: {
    url: SRC.adL2021,
    clause:
      'AD L 2021 Vol 1 para 4.12: more than 25% of the envelope renovated (EWI, or IWI on non-traditional walls)',
    grade: 'primary',
  },
  explain: 'rules.eng.br.l.renov.explain',
};

export const ENG_BR_L_TRAD: Rule = {
  id: 'ENG.BR.L.TRAD',
  jurisdiction: ENG,
  measures: ['ewi', 'iwi'],
  scope: 'measure',
  when: yes('h.wall.traditional'),
  effect: { kind: 'info', note: 'rules.eng.br.l.trad.note' },
  effectiveFrom: ADL_2021,
  source: {
    url: SRC.adL2026,
    clause: 'AD L 0.11 and 4.13: traditional buildings improve as far as reasonable without fabric risk',
    grade: 'primary',
  },
  explain: 'rules.eng.br.l.trad.explain',
};

export const ENG_BR_L_FLOW55: Rule = {
  id: 'ENG.BR.L.FLOW55',
  jurisdiction: ENG,
  measures: HP,
  scope: 'measure',
  when: always,
  effect: { kind: 'oblige', spec: { kind: 'emitter-flow', maxFlowC: 55 } },
  effectiveFrom: ADL_2021,
  source: {
    url: SRC.adL2021,
    clause: 'AD L 2021 Vol 1 para 5.10: new or replaced wet systems sized for flow at most 55 C',
    grade: 'primary',
  },
  explain: 'rules.eng.br.l.flow55.explain',
};

export const ENG_BR_L_HPSIZE: Rule = {
  id: 'ENG.BR.L.HPSIZE',
  jurisdiction: ENG,
  measures: HP,
  scope: 'measure',
  when: always,
  effect: { kind: 'oblige', spec: { kind: 'hp-meets-design-load' } },
  effectiveFrom: ADL_2021,
  source: {
    url: SRC.adL2026,
    clause: 'AD L 2026 paras 4.12 to 4.14: meet the full design heat loss',
    grade: 'primary',
  },
  explain: 'rules.eng.br.l.hpsize.explain',
};

const adf = (cat: 'B' | 'C') => ({
  fn: 'adf_category' as const,
  args: [{ fact: 'p.adf.major' }, { fact: 'p.adf.minor' }, { fact: `k.adf.${cat}` }],
});

export const ENG_BR_F_CAT_B: Rule = {
  id: 'ENG.BR.F.CAT.B',
  jurisdiction: ENG,
  measures: '*',
  scope: 'package',
  when: all(cmp('p.adf.now', '>', 0), adf('B'), not(adf('C')), no('p.vent.provided')),
  effect: { kind: 'oblige', spec: { kind: 'ventilation', system: 'intermittent-extract', category: 'B' } },
  effectiveFrom: ADF_2021,
  source: {
    url: SRC.adF2021,
    clause: 'AD F 2021 Vol 1 paras 3.6 to 3.13, Table 3.1, Diagram 3.1: category B',
    grade: 'primary',
  },
  explain: 'rules.eng.br.f.cat.explain',
};

export const ENG_BR_F_CAT_C: Rule = {
  id: 'ENG.BR.F.CAT.C',
  jurisdiction: ENG,
  measures: '*',
  scope: 'package',
  when: all(cmp('p.adf.now', '>', 0), adf('C'), no('p.vent.provided')),
  effect: { kind: 'oblige', spec: { kind: 'ventilation', system: 'mev', category: 'C' } },
  effectiveFrom: ADF_2021,
  source: {
    url: SRC.adF2021,
    clause: 'AD F 2021 Vol 1 paras 3.6 to 3.13, Table 3.1, Diagram 3.1: category C',
    grade: 'primary',
  },
  explain: 'rules.eng.br.f.cat.explain',
};

export const ENG_BR_O_ADVISORY: Rule = {
  id: 'ENG.BR.O.ADVISORY',
  jurisdiction: ENG,
  measures: '*',
  scope: 'package',
  when: all(yes('p.airtighter'), any(yes('h.topFloorFlat'), cmp('h.glazing.swToFloor', '>', 0.25))),
  effect: { kind: 'warn', risk: 'rules.eng.br.o.advisory.risk' },
  effectiveFrom: ADL_2021,
  source: {
    url: SRC.partOFaq,
    clause: 'Part O FAQ: Part O does not apply to existing homes; Ibasho overheating advisory',
    grade: 'primary',
  },
  explain: 'rules.eng.br.o.advisory.explain',
};

export const ENG_BR_L_HIST: Rule = {
  id: 'ENG.BR.L.HIST',
  jurisdiction: ENG,
  measures: ['iwi', 'ewi'],
  scope: 'measure',
  when: yes('h.wall.traditional'),
  effect: { kind: 'warn', risk: 'rules.eng.br.l.hist.risk' },
  effectiveFrom: ADL_2021,
  source: {
    url: SRC.adL2026,
    clause: 'AD L 0.11: no long-term fabric deterioration; breathable systems (DEC SC-4)',
    grade: 'secondary',
  },
  explain: 'rules.eng.br.l.hist.explain',
};

export const ENG_MOIST_IWI: Rule = {
  id: 'ENG.MOIST.IWI',
  jurisdiction: ENG,
  measures: ['iwi'],
  scope: 'measure',
  when: yes('h.wall.solidMasonry'),
  effect: { kind: 'check', check: 'moisture-assessment' },
  effectiveFrom: ADL_2021,
  source: {
    url: SRC.adL2026,
    clause:
      'BS 5250 and BS EN 15026 moisture assessment before IWI on solid masonry (DEC SC-4, reviewer memory)',
    grade: 'secondary',
  },
  explain: 'rules.eng.moist.iwi.explain',
};

export const ENG_MOIST_IWI_COST: Rule = {
  id: 'ENG.MOIST.IWI.COST',
  jurisdiction: ENG,
  measures: ['iwi'],
  scope: 'measure',
  when: yes('h.wall.solidMasonry'),
  effect: { kind: 'oblige', spec: { kind: 'assessment', check: 'moisture-assessment' } },
  effectiveFrom: ADL_2021,
  source: {
    url: SRC.adL2026,
    clause: 'The moisture assessment is costed (DEC SC-4, reviewer memory)',
    grade: 'secondary',
  },
  explain: 'rules.eng.moist.iwi.cost.explain',
};

export const ENG_BR_NOTIFY: Rule = {
  id: 'ENG.BR.NOTIFY',
  jurisdiction: ENG,
  measures: ['ewi', 'iwi', 'cavity', 'glazing-double', 'ashp', 'gshp', 'pv', 'mvhr', 'solar-thermal'],
  scope: 'measure',
  when: always,
  effect: { kind: 'consent', authority: 'building-control', typicalWeeks: 0 },
  effectiveFrom: ADL_2021,
  source: {
    url: SRC.croydonWalls,
    clause: 'Building Regulations 2010: notifiable work, building control or a competent person scheme',
    grade: 'secondary',
  },
  explain: 'rules.eng.br.notify.explain',
};

export const BR_RULES: readonly Rule[] = [
  ENG_BR_L_RENOV_EWI,
  ENG_BR_L_RENOV_IWI,
  ENG_BR_L_RENOV_ENV,
  ENG_BR_L_TRAD,
  ENG_BR_L_FLOW55,
  ENG_BR_L_HPSIZE,
  ENG_BR_F_CAT_B,
  ENG_BR_F_CAT_C,
  ENG_BR_O_ADVISORY,
  ENG_BR_L_HIST,
  ENG_MOIST_IWI,
  ENG_MOIST_IWI_COST,
  ENG_BR_NOTIFY,
];
