/**
 * Settings ledger definitions and what-if levers (SPEC 24, 18.4, UV 7). Owner: WP-08.
 *
 * "Hyderabad 2026 defaults" preset. Every rate and level has a unit, a source, a grade, its scopes
 * and the quantities it `affects` (AC-SET1); `stagesFor` says which analysis stages a change
 * re-runs (SPEC 18.5: a tariff change skips geometry, site and energy). Values marked `estimate`
 * are read from memory and must be checked against the source before V-5 (EC 7.8).
 */
import type { Grade, QuantityId, SettingGroup, SettingScope, StageId } from '@ibasho/core';

export interface SettingSpec {
  id: string;
  group: SettingGroup;
  label: string;
  hint?: string;
  unit?: string;
  kind: 'number' | 'choice';
  value: number | string;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  choices?: { value: string; label: string }[];
  source: string;
  grade: Grade;
  scopes: SettingScope[];
  depth: 'plain' | 'pro';
  affects: QuantityId[];
  /** First stage a change re-runs; undefined = never changes a number (render, display). */
  stage?: StageId;
}

export const SETTING_GROUP_LABEL: Record<SettingGroup, string> = {
  money: 'Money',
  carbon: 'Carbon',
  comfort: 'Comfort',
  codes: 'Codes and targets',
  weather: 'Weather',
  analysis: 'Analysis resolution',
  render: 'Render quality',
  display: 'Display',
  privacy: 'Privacy and data',
};

export const SETTINGS: SettingSpec[] = [
  {
    id: 'money.tariff.elec.rate',
    group: 'money',
    label: 'Electricity energy charge',
    hint: 'HT commercial, per unit',
    unit: '₹ per kWh',
    kind: 'number',
    value: 7.65,
    step: 0.05,
    min: 2,
    max: 20,
    decimals: 2,
    source: 'TGSPDCL FY 2026-27',
    grade: 'estimate',
    scopes: ['app', 'place', 'building'],
    depth: 'plain',
    affects: ['bill.*', 'opt.*', 'split.*'],
    stage: 'codes',
  },
  {
    id: 'money.diesel',
    group: 'money',
    label: 'Diesel backup cost',
    hint: 'True cost of a unit from the generator',
    unit: '₹ per kWh',
    kind: 'number',
    value: 30,
    step: 1,
    min: 15,
    max: 60,
    source: 'Pack default (BI 5)',
    grade: 'estimate',
    scopes: ['app', 'place', 'building'],
    depth: 'pro',
    affects: ['bill.diesel', 'opt.*'],
    stage: 'codes',
  },
  {
    id: 'money.discount',
    group: 'money',
    label: 'Discount rate',
    hint: 'For paybacks and present value',
    unit: '% a year',
    kind: 'number',
    value: 8,
    step: 0.5,
    min: 0,
    max: 20,
    decimals: 1,
    source: 'Pack default',
    grade: 'secondary',
    scopes: ['app', 'place', 'building', 'scenario'],
    depth: 'pro',
    affects: ['fin.*', 'opt.*'],
    stage: 'optimise',
  },
  {
    id: 'money.tariff.elec.demand',
    group: 'money',
    label: 'Demand charge',
    hint: 'HT-II(A), per kVA a month',
    unit: '₹ per kVA',
    kind: 'number',
    value: 500,
    step: 10,
    min: 0,
    max: 2000,
    source: 'TGSPDCL FY 2026-27',
    grade: 'estimate',
    scopes: ['app', 'place', 'building', 'scenario'],
    depth: 'pro',
    affects: ['bill.*', 'opt.*'],
    stage: 'codes',
  },
  {
    id: 'money.tariff.elec.powerFactor',
    group: 'money',
    label: 'Power factor',
    hint: 'Turns kWh into the kVAh the HT tariff bills',
    unit: '',
    kind: 'number',
    value: 0.95,
    step: 0.01,
    min: 0.8,
    max: 1,
    decimals: 2,
    source: 'Assumed',
    grade: 'estimate',
    scopes: ['app', 'place', 'building', 'scenario'],
    depth: 'pro',
    affects: ['bill.*', 'opt.*'],
    stage: 'energy',
  },
  {
    id: 'money.scheme.gruhaJyothi',
    group: 'money',
    label: 'Gruha Jyothi free units',
    hint: '200 free units for eligible households; rentals are often not eligible',
    kind: 'choice',
    value: '0',
    choices: [
      { value: '0', label: 'Not eligible' },
      { value: '1', label: 'Eligible' },
    ],
    source: 'Telangana Gruha Jyothi',
    grade: 'announced',
    scopes: ['app', 'place', 'building', 'scenario'],
    depth: 'plain',
    affects: ['bill.*', 'opt.*'],
    stage: 'energy',
  },
  {
    id: 'comfort.dhw.solarShare',
    group: 'comfort',
    label: 'Hot water from solar heaters',
    unit: 'share',
    kind: 'number',
    value: 0,
    step: 0.1,
    min: 0,
    max: 1,
    decimals: 1,
    source: 'Assumed',
    grade: 'estimate',
    scopes: ['app', 'place', 'building', 'scenario'],
    depth: 'pro',
    affects: ['enduse.*', 'eui.*', 'bill.*', 'carbon.*', 'opt.*'],
    stage: 'energy',
  },
  {
    id: 'carbon.grid.factor',
    group: 'carbon',
    label: 'Grid carbon factor',
    hint: "India's official grid figure",
    unit: 'g CO₂ per kWh',
    kind: 'number',
    value: 716,
    step: 5,
    min: 100,
    max: 1200,
    source: 'CEA CO₂ Baseline Database v19',
    grade: 'estimate',
    scopes: ['app', 'place'],
    depth: 'plain',
    affects: ['carbon.*', 'opt.*'],
    stage: 'codes',
  },
  {
    id: 'comfort.band',
    group: 'comfort',
    label: 'Comfort band',
    kind: 'choice',
    value: 'typical',
    choices: [
      { value: 'cooler', label: 'Cooler' },
      { value: 'typical', label: 'Typical' },
      { value: 'warmer', label: 'Warmer tolerance' },
    ],
    source: 'IMAC adaptive (India)',
    grade: 'secondary',
    scopes: ['app', 'place', 'building'],
    depth: 'plain',
    affects: ['comfort.*', 'enduse.cooling', 'eui.*', 'bill.*', 'carbon.*', 'code.*', 'rating.*', 'opt.*'],
    stage: 'energy',
  },
  {
    id: 'comfort.fan',
    group: 'comfort',
    label: 'Ceiling fan air speed credit',
    unit: 'm/s',
    kind: 'number',
    value: 0.8,
    step: 0.1,
    min: 0,
    max: 1.5,
    decimals: 1,
    source: 'IMAC fan-first (BI 5)',
    grade: 'secondary',
    scopes: ['app', 'building'],
    depth: 'pro',
    affects: ['comfort.*'],
    stage: 'energy',
  },
  {
    id: 'codes.target',
    group: 'codes',
    label: 'Energy code',
    kind: 'choice',
    value: 'ecsbc2024',
    choices: [
      { value: 'ecbc2017', label: 'ECBC 2017' },
      { value: 'ecsbc2024', label: 'ECSBC 2024' },
      { value: 'a901', label: 'ASHRAE 90.1 App G' },
    ],
    source: 'BEE',
    grade: 'secondary',
    scopes: ['place', 'building'],
    depth: 'plain',
    affects: ['code.*', 'rating.*', 'base.*', 'eui.target.*', 'opt.*'],
    stage: 'codes',
  },
  {
    id: 'weather.year',
    group: 'weather',
    label: 'Weather year',
    kind: 'choice',
    value: 'typical',
    choices: [
      { value: 'typical', label: 'Typical year' },
      { value: 'hot', label: 'A hot year' },
      { value: 'future', label: '2050 morphed' },
    ],
    source: 'ISHRAE Hyderabad',
    grade: 'secondary',
    scopes: ['place'],
    depth: 'plain',
    affects: [
      'site.*',
      'day.*',
      'enduse.*',
      'eui.*',
      'bill.*',
      'carbon.*',
      'code.*',
      'rating.*',
      'comfort.*',
      'opt.*',
    ],
    stage: 'sun',
  },
  {
    id: 'analysis.resolution',
    group: 'analysis',
    label: 'Analysis resolution',
    hint: 'Stamped on every result; compare refuses mixed resolutions',
    kind: 'choice',
    value: 'standard',
    choices: [
      { value: 'sketch', label: 'Sketch' },
      { value: 'standard', label: 'Standard' },
      { value: 'fine', label: 'Fine' },
    ],
    source: 'Pack default',
    grade: 'primary',
    scopes: ['app', 'building'],
    depth: 'plain',
    affects: ['site.*', 'day.*', 'enduse.*', 'eui.*', 'bill.*', 'carbon.*', 'code.*', 'rating.*', 'opt.*'],
    stage: 'sun',
  },
  {
    id: 'analysis.context',
    group: 'analysis',
    label: 'Context radius',
    unit: 'm',
    kind: 'choice',
    value: '300',
    choices: [
      { value: '100', label: 'Near' },
      { value: '300', label: 'Standard' },
      { value: '1000', label: 'Wide' },
    ],
    source: 'Pack default',
    grade: 'primary',
    scopes: ['app', 'building'],
    depth: 'pro',
    affects: ['site.*', 'day.*', 'enduse.cooling', 'eui.*', 'bill.*', 'carbon.*', 'opt.*'],
    stage: 'sun',
  },
  {
    id: 'render.quality',
    group: 'render',
    label: 'Render quality',
    hint: 'Never changes a number',
    kind: 'choice',
    value: 'auto',
    choices: [
      { value: 'auto', label: 'Auto' },
      { value: 'battery', label: 'Battery saver' },
      { value: 'beautiful', label: 'Beautiful' },
    ],
    source: 'This device',
    grade: 'primary',
    scopes: ['app'],
    depth: 'plain',
    affects: [],
  },
  {
    id: 'display.depth',
    group: 'display',
    label: 'Depth',
    hint: 'Plain or Pro; never changes a number',
    kind: 'choice',
    value: 'pro',
    choices: [
      { value: 'plain', label: 'Plain' },
      { value: 'pro', label: 'Pro' },
    ],
    source: 'This device',
    grade: 'primary',
    scopes: ['app'],
    depth: 'plain',
    affects: [],
  },
  {
    id: 'privacy.photo',
    group: 'privacy',
    label: 'Photo context tiles',
    hint: 'Off keeps everything on this device',
    kind: 'choice',
    value: 'off',
    choices: [
      { value: 'off', label: 'Off' },
      { value: 'on', label: 'On (cloud)' },
    ],
    source: 'This device',
    grade: 'primary',
    scopes: ['app'],
    depth: 'plain',
    affects: [],
  },
];

export const SETTING_BY_ID = new Map(SETTINGS.map((s) => [s.id, s]));
export type SettingValues = Record<string, number | string>;
export const defaultSettings = (): SettingValues => Object.fromEntries(SETTINGS.map((s) => [s.id, s.value]));

// ------------------------------------------------------------------------------------------------
// What-if levers (SPEC 18.4): every lever recomputes the whole variant.

export interface LeverSpec {
  id: string;
  label: string;
  kind: 'range' | 'choice';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  choices?: { value: string; label: string }[];
  /** First stage a change re-runs. */
  stage: StageId;
}

export const LEVERS: LeverSpec[] = [
  {
    id: 'wwr',
    label: 'Window share of wall',
    kind: 'range',
    min: 10,
    max: 60,
    step: 5,
    unit: '%',
    stage: 'geometry',
  },
  {
    id: 'shading',
    label: 'Shading on sunny facades',
    kind: 'choice',
    choices: [
      { value: 'none', label: 'As drawn' },
      { value: 'chajja', label: 'Chajja' },
      { value: 'deep', label: 'Deep + fins' },
      { value: 'jaali', label: 'Jaali' },
    ],
    stage: 'geometry',
  },
  {
    id: 'glazing',
    label: 'Glazing',
    kind: 'choice',
    choices: [
      { value: 'as-drawn', label: 'As drawn' },
      { value: 'low-e', label: 'Low-e double' },
    ],
    stage: 'energy',
  },
  {
    id: 'roof',
    label: 'Roof finish',
    kind: 'choice',
    choices: [
      { value: 'plain', label: 'As drawn' },
      { value: 'cool', label: 'Cool roof' },
    ],
    stage: 'energy',
  },
  {
    id: 'wall',
    label: 'Walls',
    kind: 'choice',
    choices: [
      { value: 'as-drawn', label: 'As drawn' },
      { value: 'insulated', label: 'Insulated block' },
    ],
    stage: 'energy',
  },
  {
    id: 'setpoint',
    label: 'Cooling set point',
    kind: 'range',
    min: 23,
    max: 29,
    step: 1,
    unit: '°C',
    stage: 'energy',
  },
  {
    id: 'lighting',
    label: 'Lighting',
    kind: 'choice',
    choices: [
      { value: 'as-drawn', label: 'As drawn' },
      { value: 'led', label: 'LED' },
    ],
    stage: 'energy',
  },
  {
    id: 'daylight',
    label: 'Daylight controls',
    kind: 'choice',
    choices: [
      { value: 'off', label: 'None' },
      { value: 'on', label: 'Dimming' },
    ],
    stage: 'energy',
  },
  {
    id: 'hvac',
    label: 'Cooling system',
    kind: 'choice',
    choices: [
      { value: 'as-drawn', label: 'As drawn' },
      { value: 'split', label: 'Split units' },
      { value: 'vrf', label: 'VRF' },
      { value: 'chiller', label: 'Chiller + DOAS' },
    ],
    stage: 'geometry',
  },
  { id: 'pv', label: 'Roof PV cover', kind: 'range', min: 0, max: 80, step: 10, unit: '%', stage: 'energy' },
];

export type Levers = Record<string, number | string>;
export const BASE_LEVERS: Levers = {
  shading: 'none',
  glazing: 'as-drawn',
  roof: 'plain',
  wall: 'as-drawn',
  setpoint: 24,
  lighting: 'as-drawn',
  daylight: 'off',
  hvac: 'as-drawn',
  pv: 0,
};

export const leverLabel = (id: string, v: number | string): string => {
  const l = LEVERS.find((x) => x.id === id);
  if (!l) return String(v);
  if (l.kind === 'choice') return l.choices?.find((c) => c.value === v)?.label ?? String(v);
  return `${v}${l.unit === '%' ? '%' : ` ${l.unit ?? ''}`}`;
};
