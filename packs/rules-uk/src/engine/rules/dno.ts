/**
 * DNO rules (SPEC 9 `UK.DNO.HP`, DEC SC-3). Owner: WP-03.
 *
 * Graded `secondary`: from reviewer memory of the ENA connect-and-notify process, not yet read
 * against the ENA text (DEC SC-3). M-0 ships the looped-supply part, the Kleene rule of the walking
 * skeleton: GH1 does not know whether its supply is looped, so its heat pump options are
 * `needs-check` until a DNO approval is recorded in `twin.checks`.
 */
import type { Rule } from '@ibasho/core';

/** Heat pump on a looped (shared) service: the DNO must approve, and usually unloop, first. */
export const UK_DNO_HP_LOOPED: Rule = {
  id: 'UK.DNO.HP.LOOPED',
  jurisdiction: 'GB',
  measures: ['ashp', 'gshp'],
  scope: 'measure',
  when: { cmp: '=', left: { fact: 'h.supply.looped' }, right: 1 },
  effect: { kind: 'check', check: 'dno-approval' },
  effectiveFrom: '2019-04-01',
  source: {
    url: 'https://www.energynetworks.org/',
    clause: 'ENA heat pump connect and notify; looped service (DEC SC-3, reviewer memory)',
    grade: 'secondary',
  },
  explain: 'rules.uk.dno.hp.looped.explain',
};

export const DNO_RULES: readonly Rule[] = [UK_DNO_HP_LOOPED];
