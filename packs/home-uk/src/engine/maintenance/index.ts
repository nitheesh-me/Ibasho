/**
 * Decay models for the "If nothing is done" future (SPEC 14, `maintenance` plugin kind).
 * Owner: WP-01. The engine (WP-02) ages the twin year by year with these rates; nothing here
 * runs physics.
 *
 * Every rate is a documented range, and grades are honest: where no primary decay study has been
 * read the model is graded `estimate` (R17 badge) and cites the Ibasho estimate source alongside
 * the reference that bounds it.
 *
 * - `maint-gas-boiler`: no annual service. Space and hot water seasonal efficiency fall by 0.5% a
 *   year (range 0.2% to 1.0%), relative, from today, never below 0.70 (the SAP Table 4b
 *   non-condensing central value, a floor a neglected condensing boiler does not pass in the
 *   model). End of life at 15 years (10 to 20; BP 3.10 and SF 5 boiler-age prior), replaced like
 *   for like with `gas-combi-condensing` (the counterfactual A_cf, DEC SC-F5).
 * - `maint-heat-pump`: no annual service (filters, coil, refrigerant charge). Seasonal performance
 *   falls 1% a year (0.5% to 2%), relative, from today, never below 2.0. The engine applies it as
 *   a factor on the heat pump chain when the aged efficiency is tagged `derived` (see the engine
 *   README). End of life 18 years (15 to 22; BP 6.1 life 18), like for like `ashp-air-water`.
 * - `maint-draught`: draught strips and seals wear out over their 10 to 20 year life (BP 6.1), so
 *   the draught-proofed fraction falls linearly from install: 1/15 a year (1/10 to 1/20), within
 *   [0, 1].
 * Seals here are the draught seals; sealed glazing unit failure is not modelled (no selector for
 * "every window" in a decay pointer yet).
 */
import { type MaintenancePlugin, Q, type SourceRef } from '@ibasho/core';
import { BP_6_1 } from '../measures/common.ts';

const ESTIMATE: SourceRef = {
  id: 'ibasho-estimate-decay-2026',
  title: 'Ibasho estimate of decay under neglect, pending a primary field study (R17 badge)',
  retrieved: '2026-10-11',
};
const SAP_T4B: SourceRef = {
  id: 'sap-10-2-t4b',
  title: 'SAP 10.2 Table 4b, seasonal efficiency of gas boilers (condensing and non-condensing)',
  url: 'https://files.bregroup.com/SAP/SAP%2010.2%20-%2011-04-2023.pdf',
  clause: 'Table 4b',
  retrieved: '2026-10-11',
};
const PPB = 1_000_000_000n;
const pct = (tenthsOfPercent: number) => (BigInt(tenthsOfPercent) * PPB) / 1000n;

function base(id: string, grade: 'secondary' | 'estimate', sources: SourceRef[]) {
  return {
    kind: 'maintenance' as const,
    id,
    version: '0.1.0' as const,
    title: `maintenance.${id}.title`,
    regions: ['GB' as const],
    side: 'engine' as const,
    provenance: { sources, lastChecked: '2026-10-11' as const, grade },
  };
}

export const gasBoilerDecay: MaintenancePlugin = {
  ...base('maint-gas-boiler', 'estimate', [ESTIMATE, SAP_T4B, BP_6_1]),
  ages: { kind: 'system', category: 'boiler', systemIds: ['gas-combi-condensing', 'gas-regular-condensing'] },
  neglect: 'maintenance.gas-boiler.neglect',
  effects: (['space', 'dhw'] as const).map((s) => ({
    param: `/systems/${s}/efficiency`,
    unit: '1' as const,
    rate: { form: 'relative' as const, ppbPerYear: { lo: -pct(10), mid: -pct(5), hi: -pct(2) } },
    onsetFrom: 'as-of' as const,
    clamp: { min: Q.of(70, 100), max: Q.ONE },
    quantity: `maint.efficiency.${s}`,
    explain: `maintenance.gas-boiler.${s}.explain`,
  })),
  endOfLife: {
    ageYears: { lo: 10, mid: 15, hi: 20 },
    replaceWithSystemId: 'gas-combi-condensing',
    explain: 'maintenance.gas-boiler.end-of-life.explain',
  },
};

export const heatPumpDecay: MaintenancePlugin = {
  ...base('maint-heat-pump', 'estimate', [ESTIMATE, BP_6_1]),
  ages: { kind: 'system', category: 'heat-pump' },
  neglect: 'maintenance.heat-pump.neglect',
  effects: (['space', 'dhw'] as const).map((s) => ({
    param: `/systems/${s}/efficiency`,
    unit: '1' as const,
    rate: { form: 'relative' as const, ppbPerYear: { lo: -pct(20), mid: -pct(10), hi: -pct(5) } },
    onsetFrom: 'as-of' as const,
    clamp: { min: Q.of(2, 1) },
    quantity: `maint.efficiency.${s}`,
    explain: `maintenance.heat-pump.${s}.explain`,
  })),
  endOfLife: {
    ageYears: { lo: 15, mid: 18, hi: 22 },
    replaceWithSystemId: 'ashp-air-water',
    explain: 'maintenance.heat-pump.end-of-life.explain',
  },
};

export const draughtDecay: MaintenancePlugin = {
  ...base('maint-draught', 'secondary', [BP_6_1, ESTIMATE]),
  ages: { kind: 'measure', measureId: 'draught' },
  neglect: 'maintenance.draught.neglect',
  effects: [
    {
      param: '/ventilation/draughtProofedFrac',
      unit: '1',
      rate: { form: 'absolute', perYear: { lo: Q.of(-1, 10), mid: Q.of(-1, 15), hi: Q.of(-1, 20) } },
      onsetFrom: 'install',
      clamp: { min: Q.ZERO, max: Q.ONE },
      quantity: 'maint.draught.fraction',
      explain: 'maintenance.draught.explain',
    },
  ],
};

export const UK_MAINTENANCE: readonly MaintenancePlugin[] = [
  draughtDecay,
  gasBoilerDecay,
  heatPumpDecay,
];
