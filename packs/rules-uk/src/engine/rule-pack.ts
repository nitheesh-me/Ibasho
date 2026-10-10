/**
 * The `rules-uk` rule pack plugin. Owner: WP-03.
 * M-0: one rule (`UK.DNO.HP.LOOPED`). The SPEC 9 list, `APPL.*` and the noise rule arrive at M-B.
 */
import type { RulePackPlugin } from '@ibasho/core';
import { DNO_RULES } from './rules/dno.ts';

export const RULES_UK_ID = 'rules-uk';

export const rulesUk: RulePackPlugin = {
  kind: 'rule-pack',
  id: RULES_UK_ID,
  version: '0.1.0',
  title: 'pack.rules-uk.title',
  regions: ['GB'],
  side: 'engine',
  provenance: {
    sources: [
      {
        id: 'ena-connect-and-notify',
        title: 'ENA heat pump connect and notify (reviewer memory, DEC SC-3)',
        url: 'https://www.energynetworks.org/',
        retrieved: '2026-10-11',
      },
    ],
    lastChecked: '2026-10-11',
    grade: 'secondary',
  },
  rules: [...DNO_RULES],
};
