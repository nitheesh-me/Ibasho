/**
 * UK heating systems (BP 3.10 table). Owner: WP-01.
 * `efficiency` is the seasonal efficiency (boilers) or the M-0 fixed space SPF (heat pumps), used
 * when a twin's system ref does not state its own.
 */
import type { SystemPlugin } from '@ibasho/core';
import { BP_6_1 } from './measures/common.ts';

const SAP_T4 = {
  id: 'sap-10-2-t4',
  title: 'SAP 10.2 Tables 4a and 4b, seasonal efficiencies (via BP 3.10)',
  url: 'https://files.bregroup.com/SAP/SAP%2010.2%20-%2011-04-2023.pdf',
  clause: 'Tables 4a, 4b',
  retrieved: '2026-10-10',
} as const;

export const gasCombiCondensing: SystemPlugin = {
  kind: 'system',
  id: 'gas-combi-condensing',
  version: '0.1.0',
  title: 'system.gas-combi-condensing.title',
  regions: ['GB'],
  side: 'engine',
  provenance: { sources: [SAP_T4], lastChecked: '2026-10-11', grade: 'secondary' },
  category: 'boiler',
  fuel: 'gas',
  efficiency: 0.84,
  efficiencyRange: { lo: 0.8, hi: 0.89 },
};

export const ashpSystem: SystemPlugin = {
  kind: 'system',
  id: 'ashp-air-water',
  version: '0.1.0',
  title: 'system.ashp-air-water.title',
  regions: ['GB'],
  side: 'engine',
  provenance: { sources: [BP_6_1], lastChecked: '2026-10-11', grade: 'estimate' },
  category: 'heat-pump',
  fuel: 'electricity',
  efficiency: 2.65,
  efficiencyRange: { lo: 2.5, hi: 3.8 },
};

export const UK_SYSTEMS: readonly SystemPlugin[] = [gasCombiCondensing, ashpSystem];
