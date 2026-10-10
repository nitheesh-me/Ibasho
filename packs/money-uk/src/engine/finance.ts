/**
 * Finance products (`finance`, SF 5.2 monthly cash view). Owner: WP-02.
 *
 * `finance-loan-stub`: PLACEHOLDER loan until the Warm Homes Plan loan terms are published in a
 * primary source (T1 ships a stub, BUILD_PLAN WP-02). 0% APR over 10 years, up to 15,000 pounds.
 * Graded `estimate` (R17 badge). The engine compares its monthly repayment with B_1 / 12 for the
 * "cash positive from month 1" flag.
 */
import { type FinancePlugin, microPenceFromPounds } from '@ibasho/core';
import { IBASHO_ESTIMATE, provenance, WARM_HOMES_LOAN } from './sources.ts';

export const financeLoanStub: FinancePlugin = {
  kind: 'finance',
  id: 'finance-loan-stub',
  version: '0.1.0',
  title: 'money.finance.loan-stub',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([WARM_HOMES_LOAN, IBASHO_ESTIMATE], 'estimate'),
  product: 'loan',
  aprPpb: 0n,
  termMonths: 120,
  maxAmount: microPenceFromPounds('15000'),
};

export const UK_FINANCE: readonly FinancePlugin[] = [financeLoanStub];
