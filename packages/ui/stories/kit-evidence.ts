/**
 * Illustrative evidence for the kit stories only. Hand written to exercise layout, ranges and
 * signs; not engine output, never shown as a result.
 */
import type { EvidenceId, EvidenceNode, EvidenceValue, Monthly, SealLevel, Unit } from '@ibasho/core';
import { staticEvidence } from '../src/evidence/context.tsx';
import { STORY_EVIDENCE } from './evidence.ts';

function n(
  id: string,
  value: EvidenceValue,
  unit: Unit,
  rounding: EvidenceNode['rounding'],
  seal: SealLevel = 'modelled',
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
    ...(seal === 'checked' ? { check: { id: 'acct.saving', rung: 'mirror', coverage: 'all' } as const } : {}),
  };
}

const gbp = (id: string, lo: number, hi: number) =>
  n(id, lo === hi ? { float: lo } : { interval: { lo, hi } }, 'GBP', { mode: 'step', value: 10 });
const pts = (id: string, v: number | [number, number]) =>
  n(id, typeof v === 'number' ? { float: v } : { interval: { lo: v[0], hi: v[1] } }, 'pts', {
    mode: 'step',
    value: 1,
  });
const kwh = (id: string, v: number) => n(id, { float: v }, 'kWh', { mode: 'sig', value: 2 });

/** Monthly delivered energy, January first: gas heating plus electricity (story shape only). */
const GAS: Monthly<number> = [2310, 1980, 1620, 1010, 560, 240, 190, 200, 380, 900, 1540, 2140];
const ELEC: Monthly<number> = [310, 280, 270, 240, 220, 200, 205, 210, 225, 250, 285, 320];
const HP: Monthly<number> = [880, 760, 610, 390, 220, 120, 110, 115, 170, 350, 590, 820];

const monthly = (prefix: string, vals: Monthly<number>) => vals.map((v, i) => kwh(`${prefix}.m${i}`, v));
export const monthIds = (prefix: string): Monthly<EvidenceId> =>
  GAS.map((_, i) => `ev_${prefix}.m${i}` as EvidenceId) as unknown as Monthly<EvidenceId>;

export const KIT_EVIDENCE: EvidenceNode[] = [
  ...STORY_EVIDENCE,
  // Score
  pts('score.now', 58),
  pts('score.band', [54, 66]),
  pts('score.g.fabric', 46),
  pts('score.g.cost', 61),
  pts('score.g.carbon', 52),
  pts('score.g.comfort', 72),
  pts('score.g.fabric.band', [38, 58]),
  pts('score.i.F', 41),
  pts('score.i.H', 52),
  pts('score.i.A', 64),
  pts('score.i.E', 58),
  pts('score.i.C', 49),
  pts('score.i.R', 55),
  pts('score.i.T', 72),
  // Futures
  gbp('f.lu.upfront', 380, 620),
  gbp('f.lu.saving', 90, 150),
  n('f.lu.carbon', { float: 310000 }, 'gCO2e/yr', { mode: 'sig', value: 2 }),
  pts('f.lu.comfort', 3),
  gbp('f.br.upfront', 4200, 6100),
  gbp('f.br.saving', 410, 590),
  n('f.br.carbon', { float: 1874000 }, 'gCO2e/yr', { mode: 'sig', value: 2 }, 'checked'),
  pts('f.br.comfort', 8),
  n('f.br.payback', { float: 9.43 }, 'yr', { mode: 'step', value: 0.5 }, 'checked'),
  gbp('f.lc.upfront', 11800, 15400),
  gbp('f.lc.saving', 520, 780),
  n('f.lc.carbon', { float: 2950000 }, 'gCO2e/yr', { mode: 'sig', value: 2 }),
  pts('f.lc.comfort', 11),
  kwh('neg.elec.rise', 2900),
  kwh('neg.elec.rise.small', 140),
  gbp('neg.bill.summer', 30, 30),
  // Do nothing
  gbp('dn.cost', 2600, 3900),
  n('dn.carbon', { float: 41000000 }, 'gCO2e', { mode: 'sig', value: 2 }),
  gbp('dn.bill', 1720, 1980),
  n('dn.boiler.eff', { float: 81 }, '%', { mode: 'step', value: 1 }),
  n('dn.boiler.lo', { float: 78 }, '%', { mode: 'step', value: 1 }),
  n('dn.boiler.hi', { float: 84 }, '%', { mode: 'step', value: 1 }),
  n('dn.seal.ach', { float: 0.9 }, 'ach', { mode: 'step', value: 0.1 }),
  n('dn.boiler.due', { float: 6 }, 'yr', { mode: 'step', value: 1 }),
  gbp('dn.boiler.cost', 2800, 3600),
  kwh('dn.gas.rise', 1100),
  // Measures and checks
  gbp('m.loft', 380, 620),
  gbp('m.iwi', 7400, 10800),
  gbp('m.ashp', 9800, 13200),
  gbp('chk.moisture', 450, 900),
  gbp('chk.pas', 600, 1100),
  gbp('chk.gain', 210, 340),
  n('chk.carbon', { float: 690000 }, 'gCO2e/yr', { mode: 'sig', value: 2 }),
  gbp('whynot.ewi', 14200, 18900),
  // Fuel bars
  n('fb.gas', { interval: { lo: -3900000, hi: -2600000 } }, 'Wh', { mode: 'sig', value: 2 }),
  n('fb.elec', { fixed: '1412000', unit: 'Wh' }, 'Wh', { mode: 'sig', value: 2 }, 'checked'),
  n('fb.export', { fixed: '-180000', unit: 'Wh' }, 'Wh', { mode: 'sig', value: 2 }),
  n('fb.oil', { fixed: '0', unit: 'Wh' }, 'Wh', { mode: 'sig', value: 2 }),
  // Slider stops
  n('loft.0', { float: 0.1 }, 'm', { mode: 'step', value: 0.01 }),
  n('loft.1', { float: 0.2 }, 'm', { mode: 'step', value: 0.01 }),
  n('loft.2', { float: 0.27 }, 'm', { mode: 'step', value: 0.01 }),
  n('loft.3', { float: 0.3 }, 'm', { mode: 'step', value: 0.01 }),
  n('flow.0', { float: 45 }, 'degC', { mode: 'step', value: 1 }),
  n('flow.1', { float: 50 }, 'degC', { mode: 'step', value: 1 }),
  n('flow.2', { float: 55 }, 'degC', { mode: 'step', value: 1 }),
  n('flow.3', { float: 60 }, 'degC', { mode: 'step', value: 1 }),
  n('flow.4', { float: 65 }, 'degC', { mode: 'step', value: 1 }),
  n('flow.5', { float: 70 }, 'degC', { mode: 'step', value: 1 }),
  // Month ring
  ...monthly('mo.gas', GAS),
  ...monthly('mo.elec', ELEC),
  ...monthly('mo.hp', HP),
];

export const kitSource = staticEvidence(KIT_EVIDENCE);
