/**
 * Schemes and rentals (RP 5.3, SPEC 9 `UK.PAS2035`, `UK.BUS`; MEES). Owner: WP-03.
 */
import type { Rule } from '@ibasho/core';
import { all, cmp, isIn, not, SRC, yes } from './helpers.ts';

const ENG_WLS = isIn('h.region', ['GB-ENG', 'GB-WLS']);

export const UK_PAS2035: Rule = {
  id: 'UK.PAS2035',
  jurisdiction: 'GB',
  measures: '*',
  scope: 'package',
  when: yes('p.funded.pas2035'),
  effect: { kind: 'oblige', spec: { kind: 'assessment', check: 'pas2035-assessment' } },
  effectiveFrom: '2021-06-30',
  source: {
    url: SRC.pas2035,
    clause:
      'PAS 2035:2023: funded retrofit needs a retrofit assessor and coordinator (costed; DEC SC-3, reviewer memory)',
    grade: 'secondary',
  },
  explain: 'rules.uk.pas2035.explain',
};

export const UK_BUS: Rule = {
  id: 'UK.BUS',
  jurisdiction: 'GB',
  measures: ['ashp', 'gshp'],
  scope: 'measure',
  when: ENG_WLS,
  effect: { kind: 'info', note: 'rules.uk.bus.note' },
  effectiveFrom: '2022-05-23',
  source: {
    url: SRC.bus,
    clause: 'Boiler Upgrade Scheme: 7,500 pounds via an MCS installer, valid EPC',
    grade: 'secondary',
  },
  explain: 'rules.uk.bus.explain',
};

export const EW_MEES_NOW: Rule = {
  id: 'EW.MEES.NOW',
  jurisdiction: 'GB',
  measures: '*',
  scope: 'package',
  when: all(ENG_WLS, cmp('o.tenure', '=', 'landlord'), isIn('h.epc.band', ['F', 'G'])),
  effect: { kind: 'warn', risk: 'rules.ew.mees.now.risk' },
  effectiveFrom: '2018-04-01',
  source: {
    url: SRC.prsRegs,
    clause: 'Energy Efficiency (Private Rented Property) Regulations 2015: no new let below E',
    grade: 'primary',
  },
  explain: 'rules.ew.mees.now.explain',
};

export const EW_MEES_CAP: Rule = {
  id: 'EW.MEES.CAP',
  jurisdiction: 'GB',
  measures: '*',
  scope: 'package',
  when: all(
    ENG_WLS,
    cmp('o.tenure', '=', 'landlord'),
    not({ fn: 'mees_cap', args: [{ fact: 'p.capex' }, { fact: 'h.value.gbp' }] }),
  ),
  effect: { kind: 'info', note: 'rules.ew.mees.cap.note' },
  effectiveFrom: '2026-01-21',
  source: {
    url: SRC.mees2026,
    clause: 'Government response 21 January 2026: cap 10,000 pounds, or 10% of a value under 100,000 pounds',
    grade: 'announced',
  },
  explain: 'rules.ew.mees.cap.explain',
};

export const SCHEME_RULES: readonly Rule[] = [UK_PAS2035, UK_BUS, EW_MEES_NOW, EW_MEES_CAP];
