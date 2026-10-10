/**
 * Wales and Scotland (RP 5.4). Owner: WP-03. T1 encodes England; these say so plainly.
 */
import type { Rule } from '@ibasho/core';
import { always } from './helpers.ts';

export const SCT_STUB: Rule = {
  id: 'SCT.STUB',
  jurisdiction: 'GB-SCT',
  measures: '*',
  scope: 'package',
  when: always,
  effect: { kind: 'warn', risk: 'rules.sct.stub.risk' },
  effectiveFrom: '2000-01-01',
  source: {
    url: 'https://www.gov.scot/policies/building-standards/',
    clause: 'Scottish permitted development and building standards differ; not encoded in T1',
    grade: 'secondary',
  },
  explain: 'rules.sct.stub.explain',
};

export const WLS_STUB: Rule = {
  id: 'WLS.STUB',
  jurisdiction: 'GB-WLS',
  measures: '*',
  scope: 'package',
  when: always,
  effect: { kind: 'warn', risk: 'rules.wls.stub.risk' },
  effectiveFrom: '2000-01-01',
  source: {
    url: 'https://www.gov.wales/planning-permission-heat-pumps',
    clause: 'Welsh permitted development (heat pumps from 2026-06-01, walls) not encoded in T1',
    grade: 'secondary',
  },
  explain: 'rules.wls.stub.explain',
};

export const NATION_RULES: readonly Rule[] = [SCT_STUB, WLS_STUB];
