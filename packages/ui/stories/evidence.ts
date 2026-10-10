/**
 * Illustrative evidence for stories only. These values are hand written to exercise formatting
 * and seals; they are not engine output and must never be shown as a result.
 */
import type { EvidenceNode, EvidenceValue, SealLevel, Unit } from '@ibasho/core';

function n(
  id: string,
  value: EvidenceValue,
  unit: Unit,
  rounding: EvidenceNode['rounding'],
  seal: SealLevel,
  check?: EvidenceNode['check'],
): EvidenceNode {
  return {
    id: `ev_${id}`,
    quantity: id,
    subject: { homeId: 'gh1', mode: 'standard' },
    value,
    unit,
    formula: { id: 'STORY', doc: 'Illustrative value for Storybook' },
    inputs: [],
    provenance: { kind: 'computed' },
    seal,
    rounding,
    ...(check ? { check } : {}),
  };
}

const mirror = { id: 'acct.saving', rung: 'mirror', coverage: 'all' } as const;
const lean = { id: 'acct.saving', rung: 'lean-native', coverage: 'all' } as const;

export const STORY_EVIDENCE: EvidenceNode[] = [
  n('climate.jan_night', { float: 4 }, 'degC', { mode: 'step', value: 1 }, 'modelled'),
  n('fabric.loss_now', { float: 2140 }, 'W', { mode: 'sig', value: 2 }, 'modelled'),
  n(
    'money.bill_saving',
    { fixed: '34012000000', unit: 'micro-pence/yr' },
    'micro-pence/yr',
    { mode: 'step', value: 1e9 },
    'checked',
    lean,
  ),
  n('acct.saving.gas', { fixed: '-3104512', unit: 'Wh' }, 'Wh', { mode: 'sig', value: 2 }, 'checked', mirror),
  n(
    'acct.saving.electricity',
    { fixed: '1412000', unit: 'Wh' },
    'Wh',
    { mode: 'sig', value: 2 },
    'checked',
    mirror,
  ),
  n(
    'acct.carbon_saving',
    { fixed: '1874000', unit: 'gCO2e' },
    'gCO2e/yr',
    { mode: 'sig', value: 2 },
    'checked',
    lean,
  ),
  n(
    'fin.n0',
    { fixed: '1475000000000', unit: 'micro-pence' },
    'micro-pence',
    { mode: 'step', value: 1e10 },
    'checked',
    mirror,
  ),
  n('fin.payback', { float: 9.43 }, 'yr', { mode: 'step', value: 0.5 }, 'checked', mirror),
  n('score.total', { exact: { n: 1367n, d: 20n } }, 'pts', { mode: 'step', value: 1 }, 'checked', lean),
  n('uncert.heat', { interval: { lo: 8210, hi: 11640 } }, 'kWh/yr', { mode: 'sig', value: 2 }, 'modelled'),
  n('fabric.u.wall', { float: 2.104 }, 'W/m2K', { mode: 'sig', value: 2 }, 'modelled'),
  n('rule.noise.lp', { float: 36.42 }, 'dB(A)', { mode: 'step', value: 0.1 }, 'cracked'),
  n('rule.adf.flow', { float: 29.6 }, 'm3/h.m2', { mode: 'sig', value: 2 }, 'unverified'),
];
