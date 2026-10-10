/**
 * The `rules-uk` rule pack plugin (SPEC 9, RP 5.1 to 5.4, DEC SC-3, SC-4). Owner: WP-03.
 */
import type { Rule, RulePackPlugin } from '@ibasho/core';
import { APPL_RULES } from './rules/appl.ts';
import { BR_RULES } from './rules/br.ts';
import { DNO_RULES } from './rules/dno.ts';
import { SRC } from './rules/helpers.ts';
import { NATION_RULES } from './rules/nations.ts';
import { PD_RULES } from './rules/pd.ts';
import { SCHEME_RULES } from './rules/schemes.ts';

export const RULES_UK_ID = 'rules-uk';

export const RULES_UK: readonly Rule[] = [
  ...PD_RULES,
  ...BR_RULES,
  ...DNO_RULES,
  ...SCHEME_RULES,
  ...APPL_RULES,
  ...NATION_RULES,
];

export const rulesUk: RulePackPlugin = {
  kind: 'rule-pack',
  id: RULES_UK_ID,
  version: '0.2.0',
  title: 'pack.rules-uk.title',
  regions: ['GB'],
  side: 'engine',
  provenance: {
    sources: [
      {
        id: 'gpdo-2015',
        title: 'Town and Country Planning (General Permitted Development) (England) Order 2015, Schedule 2',
        url: SRC.gpdoPt14,
        retrieved: '2026-10-11',
      },
      {
        id: 'si-2025-560',
        title: 'SI 2025/560 (heat pump permitted development amendments)',
        url: SRC.si2025_560,
        retrieved: '2026-10-11',
      },
      {
        id: 'mcs-020a',
        title: 'MCS 020 a) Issue 1.1, heat pump sound calculation',
        url: SRC.mcs020a,
        retrieved: '2026-10-11',
      },
      {
        id: 'ad-l-2021',
        title: 'Approved Document L 2021 Volume 1 (2023 amendments)',
        url: SRC.adL2021,
        retrieved: '2026-10-11',
      },
      {
        id: 'ad-f-2021',
        title: 'Approved Document F 2021 Volume 1',
        url: SRC.adF2021,
        retrieved: '2026-10-11',
      },
      {
        id: 'ena-g98-g99',
        title: 'ENA EREC G98 and G99, heat pump connect and notify (reviewer memory, DEC SC-3)',
        url: SRC.ena,
        retrieved: '2026-10-11',
      },
      {
        id: 'prs-regs-2015',
        title: 'Energy Efficiency (Private Rented Property) Regulations 2015',
        url: SRC.prsRegs,
        retrieved: '2026-10-11',
      },
    ],
    lastChecked: '2026-10-11',
    grade: 'secondary',
  },
  rules: [...RULES_UK],
};
