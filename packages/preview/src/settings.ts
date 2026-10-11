/**
 * Setting definitions the Preview model reads (SPEC 24, AC-SET1): each has a unit, a source, a
 * scope list and `affects`. WP-08's ledger can list these until the packs ship their own.
 * Values are estimates (grade `estimate`) and are shown with the Preview stamp.
 */
import type { Setting, SettingDef, SettingId } from '@ibasho/core';

const src = (id: string, title: string, url?: string) => ({
  id,
  title,
  ...(url ? { url } : {}),
  retrieved: '2026-10-11' as const,
});
const def = <T>(d: Omit<SettingDef<T>, 'group'> & { group?: SettingDef<T>['group'] }): SettingDef<T> => ({
  group: d.id.split('.')[0] as SettingDef<T>['group'],
  ...d,
});

export const PREVIEW_SETTING_DEFS: readonly SettingDef<unknown>[] = [
  def<number>({
    id: 'money.tariff.elec.rate',
    label: 'settings.money.tariff.elec.rate',
    default: {
      id: 'money.tariff.elec.rate',
      value: 8.8,
      unit: 'INR',
      source: src(
        'tgspdcl-2026',
        'TGSPDCL FY 2026-27 HT-II(A) Others at 11 kV, energy charge per kVAh (BT 7.1)',
      ),
      grade: 'estimate',
      depth: 'pro',
      affects: ['bill.*', 'opt.*'],
    },
    scopes: ['app', 'place', 'building', 'scenario'],
  }),
  def<number>({
    id: 'money.tariff.elec.demand',
    label: 'settings.money.tariff.elec.demand',
    default: {
      id: 'money.tariff.elec.demand',
      value: 500,
      unit: 'INR',
      source: src('tgspdcl-2026', 'TGSPDCL FY 2026-27 HT-II(A) demand charge per kVA a month (BT 7.1)'),
      grade: 'estimate',
      depth: 'pro',
      affects: ['bill.*', 'opt.*'],
    },
    scopes: ['app', 'place', 'building', 'scenario'],
  }),
  def<number>({
    id: 'money.tariff.elec.powerFactor',
    label: 'settings.money.tariff.elec.powerFactor',
    default: {
      id: 'money.tariff.elec.powerFactor',
      value: 0.95,
      unit: '1',
      range: { lo: 0.9, hi: 0.99 },
      source: src('ibasho', 'Assumed power factor for kWh to kVAh'),
      grade: 'estimate',
      depth: 'pro',
      affects: ['bill.*', 'opt.*'],
    },
    scopes: ['app', 'place', 'building', 'scenario'],
  }),
  def<number>({
    id: 'money.scheme.gruhaJyothi',
    label: 'settings.money.scheme.gruhaJyothi',
    default: {
      id: 'money.scheme.gruhaJyothi',
      value: 0,
      unit: 'bool',
      source: src(
        'tg-gruha-jyothi',
        'Telangana Gruha Jyothi: 200 free units for eligible households (off by default; rentals often not eligible)',
      ),
      grade: 'announced',
      depth: 'plain',
      affects: ['bill.*', 'opt.*'],
    },
    scopes: ['app', 'place', 'building', 'scenario'],
  }),
  def<number>({
    id: 'comfort.dhw.solarShare',
    label: 'settings.comfort.dhw.solarShare',
    default: {
      id: 'comfort.dhw.solarShare',
      value: 0,
      unit: '1',
      range: { lo: 0, hi: 1 },
      source: src('ibasho', 'Share of domestic hot water from solar heaters'),
      grade: 'estimate',
      depth: 'pro',
      affects: ['enduse.*', 'eui.*', 'bill.*', 'carbon.*', 'opt.*'],
    },
    scopes: ['app', 'place', 'building', 'scenario'],
  }),
  def<number>({
    id: 'carbon.grid.factor',
    label: 'settings.carbon.grid.factor',
    default: {
      id: 'carbon.grid.factor',
      value: 716,
      unit: 'gCO2e',
      source: src('cea-v20', 'CEA CO2 baseline database, grid emission factor g/kWh', 'https://cea.nic.in'),
      grade: 'secondary',
      depth: 'pro',
      affects: ['carbon.*', 'opt.*'],
    },
    scopes: ['app', 'place', 'scenario'],
  }),
  def<number>({
    id: 'comfort.setpoint.cool',
    label: 'settings.comfort.setpoint.cool',
    default: {
      id: 'comfort.setpoint.cool',
      value: 24,
      unit: 'degC',
      range: { lo: 22, hi: 28 },
      source: src('ecbc-2017', 'ECBC 2017 design set point'),
      grade: 'secondary',
      depth: 'plain',
      affects: ['enduse.*', 'eui.*', 'bill.*', 'carbon.*', 'comfort.*', 'code.*', 'rating.*', 'opt.*'],
    },
    scopes: ['app', 'place', 'building', 'scenario'],
  }),
  def<string>({
    id: 'analysis.resolution',
    label: 'settings.analysis.resolution',
    default: {
      id: 'analysis.resolution',
      value: 'standard',
      source: src('ibasho', 'Ibasho default'),
      grade: 'primary',
      depth: 'plain',
      affects: ['site.*', 'day.*'],
    },
    scopes: ['app', 'building', 'scenario'],
    choices: [
      { value: 'sketch', label: 'settings.analysis.resolution.sketch' },
      { value: 'standard', label: 'settings.analysis.resolution.standard' },
      { value: 'fine', label: 'settings.analysis.resolution.fine' },
    ],
  }),
  def<string>({
    id: 'render.quality',
    label: 'settings.render.quality',
    default: {
      id: 'render.quality',
      value: 'auto',
      source: src('ibasho', 'Ibasho default'),
      grade: 'primary',
      depth: 'plain',
      affects: [],
    },
    scopes: ['app'],
  }),
];

/** Value of a numeric setting from a list, else the Preview default. */
export function settingNumber(settings: readonly Setting[], id: SettingId): number {
  const s = settings.find((x) => x.id === id);
  if (s && typeof s.value === 'number') return s.value;
  const d = PREVIEW_SETTING_DEFS.find((x) => x.id === id);
  return typeof d?.default.value === 'number' ? d.default.value : 0;
}
