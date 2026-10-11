/**
 * Units, fuels and months (ARCH 4.3). Owner: WP-00.
 * SI internally. After quantisation, energy is integer Wh, carbon integer gCO2e and money integer
 * micro-pence (1 GBP = 100 pence = 10^8 micro-pence) or micro-paise (1 INR = 10^8 micro-paise).
 */
import { FixedPointError, formatScaled, parseScaled, roundHalfEven } from './fixed/index.ts';

/** Mirrors Lean `Fuel`. Order is normative (certificate vectors are fuel-major in this order). */
export type Fuel = 'electricity' | 'gas' | 'oil' | 'lpg' | 'biomass' | 'district';
export const FUELS: readonly Fuel[] = ['electricity', 'gas', 'oil', 'lpg', 'biomass', 'district'];

export type Month = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export const MONTHS: readonly Month[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
/** Days per month in a non-leap year (SAP Table 1a convention). */
export const DAYS_IN_MONTH: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export type FuelMonthly<T> = Record<Fuel, readonly [T, T, T, T, T, T, T, T, T, T, T, T]>;

/** Every unit an evidence node may carry. */
export type Unit =
  | '1'
  | '%'
  | 'W'
  | 'kW'
  | 'kWp'
  | 'W/K'
  | 'W/m2K'
  | 'W/mK'
  | 'Wh'
  | 'kWh'
  | 'kWh/yr'
  | 'kWh/m2'
  | 'm'
  | 'm2'
  | 'm3'
  | 'm/s'
  | 'deg'
  | 'degC'
  | 'K'
  | 'h'
  | 'yr'
  | 'month'
  | 'ach'
  | 'm3/h.m2'
  | 'kJ/m2K'
  | 'gCO2e'
  | 'gCO2e/yr'
  | 'kgCO2e'
  | 'tCO2e'
  | 'ug/Wh'
  | 'GBP'
  | 'GBP/yr'
  | 'GBP/month'
  | 'GBP/tCO2e'
  | 'INR'
  | 'micro-pence'
  | 'micro-pence/yr'
  | 'micro-pence/Wh'
  | 'micro-paise'
  | 'dB(A)'
  | 'persons'
  | 'pts'
  | 'band'
  | 'bool'
  | 'rank'
  | 'ids'
  // v3 (ARCH 15.4): EUI, daylight, hours, water, power density, plan geometry, India money
  | 'kWh/m2.yr'
  | 'W/m2'
  | 'Wh/m2'
  | 'lux'
  | 'h/day'
  | 'h/yr'
  | 'L'
  | 'kL'
  | 'L/s'
  | 'mm'
  | 'mm2'
  | 'mdeg'
  | 'kVA'
  | 'INR/yr'
  | 'micro-paise/yr'
  | 'micro-paise/Wh';

/** Float conversion factors to a base unit, by dimension. Only same-dimension pairs convert. */
const LINEAR: Record<string, { base: string; k: number }> = {
  W: { base: 'W', k: 1 },
  kW: { base: 'W', k: 1000 },
  Wh: { base: 'Wh', k: 1 },
  kWh: { base: 'Wh', k: 1000 },
  gCO2e: { base: 'g', k: 1 },
  kgCO2e: { base: 'g', k: 1000 },
  tCO2e: { base: 'g', k: 1_000_000 },
  '1': { base: '1', k: 1 },
  '%': { base: '1', k: 0.01 },
  h: { base: 'h', k: 1 },
  L: { base: 'L', k: 1 },
  kL: { base: 'L', k: 1000 },
  mm: { base: 'm', k: 0.001 },
  m: { base: 'm', k: 1 },
  'W/m2': { base: 'W/m2', k: 1 },
  'Wh/m2': { base: 'Wh/m2', k: 1 },
  'kWh/m2': { base: 'Wh/m2', k: 1000 },
};

export class UnitError extends Error {
  override name = 'UnitError';
}

/** Convert a float between linear units of the same dimension (display and physics only). */
export function convert(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  if (from === 'degC' && to === 'K') return value + 273.15;
  if (from === 'K' && to === 'degC') return value - 273.15;
  const a = LINEAR[from];
  const b = LINEAR[to];
  if (!a || !b || a.base !== b.base) throw new UnitError(`cannot convert ${from} to ${to}`);
  return (value * a.k) / b.k;
}

/**
 * Quantise a float to an integer, ties to even, exactly. This is the single float to integer
 * boundary (Wh, gCO2e, micro-pence). Throws on NaN or infinity.
 * Exact because x - floor(x) is exactly representable for every finite double.
 */
export function quantise(x: number): bigint {
  if (!Number.isFinite(x)) throw new FixedPointError(`cannot quantise ${x}`);
  const f = Math.floor(x);
  const frac = x - f;
  const base = BigInt(f);
  if (frac > 0.5) return base + 1n;
  if (frac < 0.5) return base;
  return base % 2n === 0n ? base : base + 1n;
}

/** kWh (float) to integer Wh, half even. */
export const whFromKwh = (kwh: number): bigint => quantise(kwh * 1000);
/** Integer Wh to kWh float, for display only. */
export const kwhFromWh = (wh: bigint): number => Number(wh) / 1000;

const MICRO_PER_POUND = 100_000_000n;
/** Exact: decimal pounds string to micro-pence (`'12.34'` gives 1_234_000_000n). */
export const microPenceFromPounds = (pounds: string): bigint => parseScaled(pounds, 8);
/** Exact: decimal pence string to micro-pence (`'26.32'` gives 26_320_000n). */
export const microPenceFromPence = (pence: string): bigint => parseScaled(pence, 6);
/** Exact decimal pounds string from micro-pence (8 decimal places). */
export const poundsFromMicroPence = (mp: bigint): string => formatScaled(mp, 8);
/** Micro-pence rounded half even to whole pence (display rounding happens only in the renderer). */
export const pencesFromMicroPence = (mp: bigint): bigint => roundHalfEven(mp, 1_000_000n);
export { MICRO_PER_POUND };

/** Integer grams to kilograms, for display only. */
export const kgFromG = (g: bigint): number => Number(g) / 1000;
