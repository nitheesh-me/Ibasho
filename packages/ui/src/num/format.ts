/**
 * Number formatting for `Num` (DESIGN_SYSTEM 3, SPEC 7.4). Owner: WP-06.
 *
 * Rules:
 * - Display rounding happens here and only here, from the node's `rounding` policy, half even.
 *   A `step` is in the node's own unit (1000 for a node in Wh means whole kWh).
 * - Fixed-point values stay exact decimals all the way to `Intl.NumberFormat`.
 * - Negative numbers use a true minus (U+2212). Signed deltas also show a plus.
 * - The unit is a separate part so it can sit in `--text-2`, one step smaller.
 * - Ranges read "1,200 to 1,600 kWh" (no dashes in copy).
 */
import type { EvidenceNode, Unit } from '@ibasho/core';
import {
  abs,
  type Dec,
  decFromNumber,
  decFromRatio,
  decFromString,
  decToString,
  fractionDigits,
  roundSig,
  roundStep,
  shift,
  sign,
} from './decimal.ts';

export const MINUS = '−';

export interface DisplayUnit {
  /** Multiply the node value by 10^shift to get the display value. */
  shift: number;
  prefix?: string;
  suffix?: string;
  /** Suffix attaches without a space (`%`, `°`). */
  tight?: boolean;
  /** Spoken form of the unit for screen readers, when it differs from the suffix. */
  spoken?: string;
}

const CO2 = 'CO₂e';

/** Default display for each evidence unit. */
export const DISPLAY: Record<Unit, DisplayUnit> = {
  '1': { shift: 0 },
  '%': { shift: 0, suffix: '%', tight: true, spoken: 'percent' },
  W: { shift: 0, suffix: 'W', spoken: 'watts' },
  kW: { shift: 0, suffix: 'kW', spoken: 'kilowatts' },
  kWp: { shift: 0, suffix: 'kWp', spoken: 'kilowatts peak' },
  'W/K': { shift: 0, suffix: 'W/K', spoken: 'watts per kelvin' },
  'W/m2K': { shift: 0, suffix: 'W/m²K', spoken: 'watts per square metre kelvin' },
  'W/mK': { shift: 0, suffix: 'W/mK', spoken: 'watts per metre kelvin' },
  Wh: { shift: -3, suffix: 'kWh', spoken: 'kilowatt hours' },
  kWh: { shift: 0, suffix: 'kWh', spoken: 'kilowatt hours' },
  'kWh/yr': { shift: 0, suffix: 'kWh a year', spoken: 'kilowatt hours a year' },
  'kWh/m2': { shift: 0, suffix: 'kWh/m²', spoken: 'kilowatt hours per square metre' },
  m: { shift: 0, suffix: 'm', spoken: 'metres' },
  m2: { shift: 0, suffix: 'm²', spoken: 'square metres' },
  m3: { shift: 0, suffix: 'm³', spoken: 'cubic metres' },
  'm/s': { shift: 0, suffix: 'm/s', spoken: 'metres per second' },
  deg: { shift: 0, suffix: '°', tight: true, spoken: 'degrees' },
  degC: { shift: 0, suffix: '°C', spoken: 'degrees Celsius' },
  K: { shift: 0, suffix: 'K', spoken: 'kelvin' },
  h: { shift: 0, suffix: 'hours' },
  yr: { shift: 0, suffix: 'years' },
  month: { shift: 0, suffix: 'months' },
  ach: { shift: 0, suffix: 'ach', spoken: 'air changes an hour' },
  'm3/h.m2': { shift: 0, suffix: 'm³/h·m²', spoken: 'cubic metres per hour per square metre' },
  'kJ/m2K': { shift: 0, suffix: 'kJ/m²K', spoken: 'kilojoules per square metre kelvin' },
  gCO2e: { shift: -3, suffix: `kg ${CO2}`, spoken: 'kilograms of carbon dioxide equivalent' },
  'gCO2e/yr': {
    shift: -3,
    suffix: `kg ${CO2} a year`,
    spoken: 'kilograms of carbon dioxide equivalent a year',
  },
  kgCO2e: { shift: 0, suffix: `kg ${CO2}`, spoken: 'kilograms of carbon dioxide equivalent' },
  tCO2e: { shift: 0, suffix: `t ${CO2}`, spoken: 'tonnes of carbon dioxide equivalent' },
  'ug/Wh': { shift: 0, suffix: 'µg/Wh', spoken: 'micrograms per watt hour' },
  GBP: { shift: 0, prefix: '£' },
  'GBP/yr': { shift: 0, prefix: '£', suffix: 'a year' },
  'GBP/month': { shift: 0, prefix: '£', suffix: 'a month' },
  'GBP/tCO2e': { shift: 0, prefix: '£', suffix: `per tonne ${CO2}`, spoken: 'per tonne of carbon' },
  INR: { shift: 0, prefix: '₹' },
  'micro-pence': { shift: -8, prefix: '£' },
  'micro-pence/yr': { shift: -8, prefix: '£', suffix: 'a year' },
  'micro-pence/Wh': { shift: -3, suffix: 'p/kWh', spoken: 'pence per kilowatt hour' },
  'micro-paise': { shift: -8, prefix: '₹' },
  'dB(A)': { shift: 0, suffix: 'dB(A)', spoken: 'decibels A' },
  persons: { shift: 0, suffix: 'people' },
  pts: { shift: 0 },
  band: { shift: 0 },
  bool: { shift: 0 },
  rank: { shift: 0 },
  ids: { shift: 0 },
  // v3 units (ARCH 15.4).
  'kWh/m2.yr': { shift: 0, suffix: 'kWh/m²·yr', spoken: 'kilowatt hours per square metre a year' },
  'W/m2': { shift: 0, suffix: 'W/m²', spoken: 'watts per square metre' },
  'Wh/m2': { shift: -3, suffix: 'kWh/m²', spoken: 'kilowatt hours per square metre' },
  lux: { shift: 0, suffix: 'lux' },
  'h/day': { shift: 0, suffix: 'hours a day' },
  'h/yr': { shift: 0, suffix: 'hours a year' },
  L: { shift: 0, suffix: 'L', spoken: 'litres' },
  kL: { shift: 0, suffix: 'kL', spoken: 'kilolitres' },
  'L/s': { shift: 0, suffix: 'L/s', spoken: 'litres per second' },
  mm: { shift: 0, suffix: 'mm', spoken: 'millimetres' },
  mm2: { shift: -6, suffix: 'm²', spoken: 'square metres' },
  mdeg: { shift: -3, suffix: '°', tight: true, spoken: 'degrees' },
  kVA: { shift: 0, suffix: 'kVA', spoken: 'kilovolt amperes' },
  'INR/yr': { shift: 0, prefix: '₹', suffix: 'a year' },
  'micro-paise/yr': { shift: -8, prefix: '₹', suffix: 'a year' },
  'micro-paise/Wh': { shift: -5, prefix: '₹', suffix: 'per kWh', spoken: 'rupees per kilowatt hour' },
};

/** Alternative displays a caller may ask for with `as`. */
export const DISPLAY_AS = {
  kWh: { from: ['Wh'], unit: { shift: -3, suffix: 'kWh', spoken: 'kilowatt hours' } },
  MWh: { from: ['Wh', 'kWh'], unit: { shift: -6, suffix: 'MWh', spoken: 'megawatt hours' } },
  kgCO2e: { from: ['gCO2e'], unit: { shift: -3, suffix: `kg ${CO2}`, spoken: 'kilograms of carbon' } },
  tCO2e: { from: ['gCO2e', 'kgCO2e'], unit: { shift: -6, suffix: `t ${CO2}`, spoken: 'tonnes of carbon' } },
} as const satisfies Record<string, { from: readonly Unit[]; unit: DisplayUnit }>;
export type DisplayAs = keyof typeof DISPLAY_AS;

export type NumPartKind = 'sign' | 'prefix' | 'digits' | 'unit' | 'join' | 'text';
export interface NumPart {
  kind: NumPartKind;
  text: string;
}

export interface Formatted {
  parts: NumPart[];
  /** Plain text, exactly what is drawn. */
  text: string;
  /** Text for screen readers (units spelled out). */
  spoken: string;
  /** Sign of the value (of the upper end for a range). */
  sign: -1 | 0 | 1;
}

export interface FormatOptions {
  locale?: string;
  /** Show `+` on positive values (deltas). Negative values always show a true minus. */
  signed?: boolean;
  as?: DisplayAs;
}

const formatters = new Map<string, Intl.NumberFormat>();
function nf(locale: string, frac: number): Intl.NumberFormat {
  const key = `${locale}|${frac}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      minimumFractionDigits: frac,
      maximumFractionDigits: frac,
      useGrouping: true,
    });
    formatters.set(key, f);
  }
  return f;
}

function exponentShift(unit: Unit, as: DisplayAs | undefined): DisplayUnit {
  if (as) {
    const alt = DISPLAY_AS[as];
    if (!(alt.from as readonly Unit[]).includes(unit)) throw new Error(`cannot show ${unit} as ${as}`);
    // An `as` is defined from the smallest source unit; correct for larger sources.
    const base = alt.from[0] as Unit;
    return { ...alt.unit, shift: alt.unit.shift + (DISPLAY[unit].shift - DISPLAY[base].shift) };
  }
  return DISPLAY[unit];
}

function rounded(d: Dec, node: Pick<EvidenceNode, 'rounding'>): Dec {
  const r = node.rounding;
  if (r.mode === 'sig') return roundSig(d, r.value);
  return roundStep(d, decFromNumber(r.value));
}

function digitsParts(d: Dec, locale: string, signed: boolean): NumPart[] {
  const s = sign(d);
  const out: NumPart[] = [];
  if (s < 0) out.push({ kind: 'sign', text: MINUS });
  else if (s > 0 && signed) out.push({ kind: 'sign', text: '+' });
  out.push({
    kind: 'digits',
    text: nf(locale, fractionDigits(d)).format(decToString(abs(d)) as `${number}`),
  });
  return out;
}

/** Values in display units, before rounding. */
function values(node: EvidenceNode): Dec[] | string {
  const v = node.value;
  if ('fixed' in v) return [decFromString(v.fixed)];
  if ('exact' in v) return [decFromRatio(v.exact.n, v.exact.d)];
  if ('float' in v) return [decFromNumber(v.float)];
  if ('interval' in v) return [decFromNumber(v.interval.lo), decFromNumber(v.interval.hi)];
  return v.cat;
}

function catText(node: EvidenceNode, cat: string): string {
  if (node.unit === 'bool') return cat === 'true' || cat === '1' ? 'Yes' : 'No';
  return cat;
}

/** Format an evidence node's value for display. */
export function formatEvidence(node: EvidenceNode, opts: FormatOptions = {}): Formatted {
  // Round 4 M6: digit grouping follows the currency, not the page (lakh grouping only for rupees).
  const u0 = 'fixed' in node.value ? node.value.unit : node.unit;
  const locale =
    u0.startsWith('GBP') || u0.startsWith('micro-pence')
      ? 'en-GB'
      : u0 === 'INR' || u0.startsWith('INR') || u0.startsWith('micro-paise')
        ? 'en-IN'
        : (opts.locale ?? 'en-GB');
  const vals = values(node);
  if (typeof vals === 'string') {
    const text = catText(node, vals);
    return { parts: [{ kind: 'text', text }], text, spoken: text, sign: 0 };
  }
  const unitOf = 'fixed' in node.value ? node.value.unit : node.unit;
  const du = exponentShift(unitOf, opts.as);
  // Round in the node's own unit (the policy is written in it), then move to display units.
  let shown = vals.map((d) => shift(rounded(d, node), du.shift));
  // A range that rounds to one value reads as that value ("1,100", not "1,100 to 1,100").
  if (shown.length === 2 && decToString(shown[0] as Dec) === decToString(shown[1] as Dec))
    shown = [shown[0] as Dec];
  const parts: NumPart[] = [];
  shown.forEach((d, i) => {
    if (i > 0) parts.push({ kind: 'join', text: ' to ' });
    const dp = digitsParts(d, locale, opts.signed === true);
    // The sign leads the currency symbol: "−£340".
    const signPart = dp[0]?.kind === 'sign' ? dp.shift() : undefined;
    if (signPart) parts.push(signPart);
    if (du.prefix) parts.push({ kind: 'prefix', text: du.prefix });
    parts.push(...dp);
  });
  if (du.suffix) parts.push({ kind: 'unit', text: du.tight ? du.suffix : `\u00a0${du.suffix}` });
  return {
    parts,
    text: parts.map((p) => p.text).join(''),
    spoken: spokenOf(shown, du, locale, opts.signed === true),
    sign: sign(shown[shown.length - 1]!),
  };
}

const CURRENCY_WORD: Record<string, string> = { '\u00a3': 'pounds', '\u20b9': 'rupees' };

/** "−£340 a year" reads as "minus 340 pounds a year". */
function spokenOf(shown: Dec[], du: DisplayUnit, locale: string, signed: boolean): string {
  const nums = shown.map((d) =>
    digitsParts(d, locale, signed)
      .map((p) => (p.kind === 'sign' ? (p.text === MINUS ? 'minus ' : 'plus ') : p.text))
      .join(''),
  );
  const words = [nums.join(' to ')];
  if (du.prefix) words.push(CURRENCY_WORD[du.prefix] ?? du.prefix);
  const unit = du.spoken ?? du.suffix;
  if (unit) words.push(unit);
  return words.join(' ');
}
