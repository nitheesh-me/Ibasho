/**
 * Draught-proofing plus chimney balloon (BP 6.1). Owner: WP-01.
 * Physics: every opening draught-proofed (f_dp = 1, window term 0.25 to 0.05 ach) and every open
 * chimney blocked with a balloon (80 to 20 m3/h each in n_flue). The ventilation stage turns these
 * into n_inf. Lifetime 15 years (BP gives 10 to 20).
 * Facts (`m.draught.*`): open chimneys before, openings already proofed.
 */
import { type MeasureModel, numCentral, type TwinPatch } from '@ibasho/core';
import { identity, measureValue, optionOf, param, provenance } from './common.ts';

const SAP_S2 = {
  id: 'sap-10-2-s2',
  title: 'SAP 10.2 section 2, infiltration (chimneys and draught-proofing terms)',
  url: 'https://files.bregroup.com/SAP/SAP%2010.2%20-%2011-04-2023.pdf',
  clause: 'Section 2',
  retrieved: '2026-10-10',
} as const;

export const draughtMeasure: MeasureModel = {
  kind: 'measure',
  ...identity('draught'),
  version: '0.1.0',
  title: 'measure.draught.title',
  regions: ['GB'],
  side: 'engine',
  provenance: provenance([SAP_S2], 'secondary'),
  options: [
    {
      id: 'draught-proofing-chimney-balloon',
      title: 'measure.draught-proofing-chimney-balloon.title',
      params: { draughtProofedFrac: { value: 1, min: 0, max: 1, unit: '1' } },
    },
  ],
  touches: ['window', 'door'],
  lifetimeYears: 15,
  apply(twin, optionId): TwinPatch {
    const fdp = param(optionOf(draughtMeasure, optionId), 'draughtProofedFrac');
    const v = twin.ventilation;
    const open = numCentral(v.chimneysOpen);
    const set: TwinPatch['set'] = [{ path: '/ventilation/draughtProofedFrac', value: measureValue(fdp, 'draught') }];
    if (open > 0) {
      set.push({ path: '/ventilation/chimneysOpen', value: measureValue(0, 'draught') });
      set.push({
        path: '/ventilation/chimneysBlocked',
        value: measureValue(numCentral(v.chimneysBlocked) + open, 'draught'),
      });
    }
    return { set };
  },
  facts(twin) {
    return {
      'm.draught.openChimneys': numCentral(twin.ventilation.chimneysOpen),
      'm.draught.proofedBefore': numCentral(twin.ventilation.draughtProofedFrac),
    };
  },
};
