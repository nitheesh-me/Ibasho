/**
 * Display of evidence values for slots (AM 3.2, R10). en-GB. Byte-deterministic (see decimal.ts).
 *
 * `[[e:n]]` uses the item's own rounding; `[[e:n|approx]]` uses the coarser policy for its unit
 * (money to 10 pounds, kWh to 10, years to 0.5); `[[e:n|abs]]` shows the magnitude.
 */
import type { EvidenceItem } from '@ibasho/core';
import {
  absDecimal,
  type Decimal,
  group,
  MINUS,
  parseDecimal,
  plain,
  roundToSig,
  roundToStep,
  toDecimal,
} from './decimal.ts';

export type SlotModifier = 'approx' | 'abs';

type Unit = EvidenceItem['unit'];

/** Coarser rounding for `approx`, by unit. Falls back to the item's own rounding. */
const APPROX: Partial<Record<Unit, EvidenceItem['rounding']>> = {
  GBP: { mode: 'step', value: 10 },
  'GBP/yr': { mode: 'step', value: 10 },
  'kWh/yr': { mode: 'step', value: 10 },
  'kgCO2e/yr': { mode: 'step', value: 10 },
  yr: { mode: 'step', value: 0.5 },
  pts: { mode: 'step', value: 1 },
  '%': { mode: 'step', value: 1 },
};

function coarser(own: EvidenceItem['rounding'], approx: EvidenceItem['rounding'] | undefined) {
  if (!approx) return own;
  if (own.mode === 'step' && approx.mode === 'step' && own.value > approx.value) return own;
  return approx;
}

export function roundFor(d: Decimal, r: EvidenceItem['rounding']): Decimal {
  if (r.mode === 'sig') return roundToSig(d, r.value);
  return roundToStep(d, toDecimal(r.value));
}

const ORDINAL = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];

/** Number body with grouping and a true minus. */
function body(d: Decimal): string {
  const s = group(plain(d));
  return s.startsWith('-') ? MINUS + s.slice(1) : s;
}

function withUnit(d: Decimal, unit: Unit, hiOf?: Decimal): string {
  const one = (x: Decimal) => body(x);
  const money = (x: Decimal) => (x.neg ? `${MINUS}£${body(absDecimal(x))}` : `£${body(x)}`);
  const pair = (f: (x: Decimal) => string) => (hiOf ? `${f(d)} to ${f(hiOf)}` : f(d));
  switch (unit) {
    case 'GBP':
      return pair(money);
    case 'GBP/yr':
      return `${pair(money)} a year`;
    case 'kWh/yr':
      return `${pair(one)} kWh a year`;
    case 'kgCO2e/yr':
      return `${pair(one)} kg CO2e a year`;
    case 'yr': {
      const top = hiOf ?? d;
      const singular = !hiOf && plain(top) === '1';
      return `${pair(one)} ${singular ? 'year' : 'years'}`;
    }
    case 'pts':
      return `${pair(one)} ${!hiOf && plain(d) === '1' ? 'point' : 'points'}`;
    case '%':
      return hiOf ? `${one(d)}% to ${one(hiOf)}%` : `${one(d)}%`;
    case 'rank': {
      const k = plain(d);
      const word = /^\d$/.test(k) ? ORDINAL[Number(k)] : undefined;
      return word ?? `number ${k}`;
    }
    default:
      return pair(one);
  }
}

/** Formatted display of an evidence item for a slot. */
export function formatItem(item: EvidenceItem, mod?: SlotModifier): string {
  const rounding = mod === 'approx' ? coarser(item.rounding, APPROX[item.unit]) : item.rounding;
  const prep = (n: number) => {
    let d = roundFor(toDecimal(n), rounding);
    if (mod === 'abs') d = absDecimal(d);
    return d;
  };
  if (typeof item.value === 'number') return withUnit(prep(item.value), item.unit);
  let lo = prep(item.value.lo);
  let hi = prep(item.value.hi);
  if (mod === 'abs' && compare(lo, hi) > 0) [lo, hi] = [hi, lo];
  if (plain(lo) === plain(hi)) return withUnit(lo, item.unit);
  return withUnit(lo, item.unit, hi);
}

function compare(a: Decimal, b: Decimal): number {
  const x = parseDecimal(plain(a));
  const y = parseDecimal(plain(b));
  const sx = x.neg ? -1n : 1n;
  const sy = y.neg ? -1n : 1n;
  const e = x.exp < y.exp ? x.exp : y.exp;
  const vx = sx * x.coef * 10n ** BigInt(x.exp - e);
  const vy = sy * y.coef * 10n ** BigInt(y.exp - e);
  return vx < vy ? -1 : vx > vy ? 1 : 0;
}
