/**
 * UK heating systems (BP 3.10 table, SAP 10.2 Tables 4a and 4b). Owner: WP-01.
 * `efficiency` is the seasonal efficiency, used when a twin's system ref does not state its own.
 * Heat pumps (`category: 'heat-pump'`) get their seasonal performance from the engine's chain
 * (EN 14825 bins); their `efficiency` is the BP 3.10 typical retrofit SPF, for display only.
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

function system(
  id: string,
  category: SystemPlugin['category'],
  fuel: SystemPlugin['fuel'],
  efficiency: number,
  lo: number,
  hi: number,
  grade: 'secondary' | 'estimate' = 'secondary',
): SystemPlugin {
  return {
    kind: 'system',
    id,
    version: '0.2.0',
    title: `system.${id}.title`,
    regions: ['GB'],
    side: 'engine',
    provenance: { sources: grade === 'secondary' ? [SAP_T4] : [BP_6_1], lastChecked: '2026-10-11', grade },
    category,
    fuel,
    efficiency,
    efficiencyRange: { lo, hi },
  };
}

export const gasCombiCondensing = system('gas-combi-condensing', 'boiler', 'gas', 0.84, 0.8, 0.89);
export const gasRegularCondensing = system('gas-regular-condensing', 'boiler', 'gas', 0.84, 0.8, 0.89);
export const gasNonCondensing = system('gas-non-condensing', 'boiler', 'gas', 0.7, 0.6, 0.78);
export const oilBoiler = system('oil-boiler-condensing', 'boiler', 'oil', 0.84, 0.8, 0.89);
export const directElectric = system('direct-electric', 'direct-electric', 'electricity', 1, 1, 1);
export const electricImmersion = system('electric-immersion', 'direct-electric', 'electricity', 1, 0.95, 1);
export const ashpSystem = system('ashp-air-water', 'heat-pump', 'electricity', 2.9, 2.5, 3.8, 'estimate');

export const UK_SYSTEMS: readonly SystemPlugin[] = [
  ashpSystem,
  directElectric,
  electricImmersion,
  gasCombiCondensing,
  gasNonCondensing,
  gasRegularCondensing,
  oilBoiler,
];
