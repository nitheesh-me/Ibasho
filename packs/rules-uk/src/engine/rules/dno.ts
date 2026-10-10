/**
 * DNO rules (SPEC 9 `UK.DNO.*`, DEC SC-3). Owner: WP-03.
 *
 * Graded `secondary`: from reviewer memory of ENA EREC G98 and G99 and the connect-and-notify
 * process, not yet read against the ENA text (DEC SC-3). Export up to 3.68 kW per phase (16 A at
 * 230 V) is G98: install, then notify. Above that is G99: apply and wait for the DNO first.
 */
import type { Rule } from '@ibasho/core';
import { always, cmp, SRC, yes } from './helpers.ts';

/** Heat pump on a looped (shared) service: the DNO must approve, and usually unloop, first. */
export const UK_DNO_HP_LOOPED: Rule = {
  id: 'UK.DNO.HP.LOOPED',
  jurisdiction: 'GB',
  measures: ['ashp', 'gshp'],
  scope: 'measure',
  when: yes('h.supply.looped'),
  effect: { kind: 'check', check: 'dno-approval' },
  effectiveFrom: '2019-04-01',
  source: {
    url: SRC.ena,
    clause: 'ENA heat pump connect and notify; looped service (DEC SC-3, reviewer memory)',
    grade: 'secondary',
  },
  explain: 'rules.uk.dno.hp.looped.explain',
};

export const UK_DNO_HP: Rule = {
  id: 'UK.DNO.HP',
  jurisdiction: 'GB',
  measures: ['ashp', 'gshp'],
  scope: 'measure',
  when: always,
  effect: { kind: 'info', note: 'rules.uk.dno.hp.note' },
  effectiveFrom: '2019-04-01',
  source: {
    url: SRC.ena,
    clause: 'ENA heat pump connect and notify: tell the DNO (DEC SC-3, reviewer memory)',
    grade: 'secondary',
  },
  explain: 'rules.uk.dno.hp.explain',
};

export const UK_DNO_G98: Rule = {
  id: 'UK.DNO.G98',
  jurisdiction: 'GB',
  measures: ['pv', 'battery'],
  scope: 'package',
  when: cmp('p.export.W', '<=', { fact: 'p.export.limitW' }),
  effect: { kind: 'info', note: 'rules.uk.dno.g98.note' },
  effectiveFrom: '2019-04-27',
  source: {
    url: SRC.ena,
    clause:
      'ENA EREC G98: up to 16 A per phase, notify within 28 days of install (DEC SC-3, reviewer memory)',
    grade: 'secondary',
  },
  explain: 'rules.uk.dno.g98.explain',
};

export const UK_DNO_G99: Rule = {
  id: 'UK.DNO.G99',
  jurisdiction: 'GB',
  measures: ['pv', 'battery'],
  scope: 'package',
  when: cmp('p.export.W', '>', { fact: 'p.export.limitW' }),
  effect: { kind: 'consent', authority: 'DNO', typicalWeeks: 9 },
  effectiveFrom: '2019-04-27',
  source: {
    url: SRC.ena,
    clause: 'ENA EREC G99: above 16 A per phase, apply before install (DEC SC-3, reviewer memory)',
    grade: 'secondary',
  },
  explain: 'rules.uk.dno.g99.explain',
};

export const DNO_RULES: readonly Rule[] = [UK_DNO_HP_LOOPED, UK_DNO_HP, UK_DNO_G98, UK_DNO_G99];
