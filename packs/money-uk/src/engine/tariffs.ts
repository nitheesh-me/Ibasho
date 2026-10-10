/**
 * UK tariffs (BP 7.1, SF 5.1). Owner: WP-02.
 *
 * Bills are slab exact (SPEC 7.2 `money.bill.<fuel>`): every price is an integer number of
 * micro-pence per Wh, so `Wh * price` is exact and no rounding happens inside a bill. A flat
 * tariff is one unbounded slab. The standing charge is `days * standingPerDay`; a fuel with no use
 * in the whole year is disconnected and pays no standing charge when the tariff says so
 * (`chargeStandingWhenUnused: false`, the gas disconnect of SPEC 9). Electricity always pays it.
 *
 * Prices: Ofgem price cap 1 October to 31 December 2026, Direct Debit, GB average, VAT included
 * (BP 7.1). Graded `secondary` until the Ofgem letter's VAT basis is re-read (DEC SC-F3).
 */
import type { Fuel, MicroPence, SlabTable, TariffPlugin, Wh } from '@ibasho/core';
import { OFGEM_CAP_2026Q4, provenance } from './sources.ts';

export class TariffError extends Error {
  override name = 'TariffError';
}

/**
 * Telescopic slab charge for `wh` in one period: each slab's price applies only to the energy that
 * falls inside it. Exact (integer products). Slabs must be strictly increasing in `uptoWh` with the
 * last one unbounded.
 */
export function slabCharge(wh: Wh, slabs: SlabTable['slabs']): MicroPence {
  if (wh < 0n) throw new TariffError(`negative energy ${wh} Wh`);
  let charge = 0n;
  let lower = 0n;
  for (const s of slabs) {
    const upper = s.uptoWh;
    const top = upper === null || wh < upper ? wh : upper;
    if (top > lower) charge += (top - lower) * s.price;
    if (upper === null || wh <= upper) return charge;
    lower = upper;
  }
  throw new TariffError('slab table has no unbounded last slab');
}

/** Check a slab table: increasing bounds, last slab unbounded, prices and standing charge non-negative. */
export function checkSlabTable(t: SlabTable): void {
  if (t.slabs.length === 0) throw new TariffError('empty slab table');
  let prev = 0n;
  t.slabs.forEach((s, i) => {
    if (s.price < 0n) throw new TariffError(`slab ${i} has a negative price`);
    const last = i === t.slabs.length - 1;
    if (last !== (s.uptoWh === null)) throw new TariffError('only the last slab may be unbounded');
    if (s.uptoWh !== null) {
      if (s.uptoWh <= prev) throw new TariffError('slab bounds must increase');
      prev = s.uptoWh;
    }
  });
  if (t.standingPerDay < 0n) throw new TariffError('negative standing charge');
}

/**
 * Bill for twelve months of energy under a slab table. For `period: 'year'` the annual slabs apply
 * to cumulative use, and month m is charged `charge(cum_m) - charge(cum_{m-1})`, so the months sum
 * to the annual charge exactly. For `period: 'month'` the slabs apply to each month on its own.
 */
export function slabBill(
  whByMonth: readonly Wh[],
  days: readonly number[],
  table: SlabTable,
  chargeStandingWhenUnused: boolean,
): { total: MicroPence; byMonth: MicroPence[] } {
  if (whByMonth.length !== 12 || days.length !== 12) throw new TariffError('a bill needs 12 months');
  const used = whByMonth.some((w) => w !== 0n);
  const standing = used || chargeStandingWhenUnused;
  const byMonth: MicroPence[] = [];
  let cum = 0n;
  let prevCharge = 0n;
  for (let m = 0; m < 12; m++) {
    const wh = whByMonth[m]!;
    let energy: MicroPence;
    if (table.period === 'month') energy = slabCharge(wh, table.slabs);
    else {
      cum += wh;
      const c = slabCharge(cum, table.slabs);
      energy = c - prevCharge;
      prevCharge = c;
    }
    const d = days[m]!;
    if (!Number.isSafeInteger(d) || d < 0) throw new TariffError(`bad day count ${d}`);
    byMonth.push(energy + (standing ? BigInt(d) * table.standingPerDay : 0n));
  }
  let total = 0n;
  for (const b of byMonth) total += b;
  return { total, byMonth };
}

/** Pence per kWh, as an exact decimal string, to micro-pence per Wh (26.32 p/kWh is 26_320). */
export function pencePerKwhToMicroPencePerWh(pence: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,3}))?$/.exec(pence);
  if (!m) throw new TariffError(`price ${pence} must be pence per kWh with at most 3 decimals`);
  const frac = (m[2] ?? '').padEnd(3, '0');
  return BigInt(m[1]!) * 1000n + BigInt(frac);
}
/** Pence per day, as an exact decimal string, to micro-pence per day (54.83 p is 54_830_000). */
export function pencePerDayToMicroPence(pence: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(pence);
  if (!m) throw new TariffError(`standing charge ${pence} must be pence with at most 6 decimals`);
  return BigInt(m[1]!) * 1_000_000n + BigInt((m[2] ?? '').padEnd(6, '0'));
}

export interface FlatTariffSpec {
  id: string;
  fuel: Fuel;
  title: string;
  unitPence: string;
  standingPencePerDay: string;
  chargeStandingWhenUnused: boolean;
  validFrom: `${number}-${number}-${number}`;
  validTo: `${number}-${number}-${number}`;
}

/** A tariff that also exposes its slab table as plain data (the certificate carries it). */
export interface SlabTariff extends TariffPlugin {
  table: SlabTable;
  chargeStandingWhenUnused: boolean;
}

export function flatTariff(spec: FlatTariffSpec): SlabTariff {
  const table: SlabTable = {
    period: 'year',
    slabs: [{ uptoWh: null, price: pencePerKwhToMicroPencePerWh(spec.unitPence) }],
    standingPerDay: pencePerDayToMicroPence(spec.standingPencePerDay),
  };
  checkSlabTable(table);
  return {
    kind: 'tariff',
    id: spec.id,
    version: '0.1.0',
    title: spec.title,
    regions: ['GB'],
    validFrom: spec.validFrom,
    validTo: spec.validTo,
    side: 'engine',
    provenance: provenance([OFGEM_CAP_2026Q4], 'secondary'),
    fuel: spec.fuel,
    currency: 'GBP',
    table,
    chargeStandingWhenUnused: spec.chargeStandingWhenUnused,
    bill(whByMonth, ctx) {
      return { ...slabBill(whByMonth, ctx.days, table, spec.chargeStandingWhenUnused), slabs: table };
    },
  };
}

/** Ofgem cap Q4 2026 electricity: 26.32 p/kWh, 54.83 p/day (BP 7.1). */
export const ukCapElectricity2026q4 = flatTariff({
  id: 'uk-cap-2026q4-electricity',
  fuel: 'electricity',
  title: 'money.tariff.uk-cap-2026q4-electricity',
  unitPence: '26.32',
  standingPencePerDay: '54.83',
  chargeStandingWhenUnused: true,
  validFrom: '2026-10-01',
  validTo: '2026-12-31',
});

/** Ofgem cap Q4 2026 gas: 7.97 p/kWh, 29.68 p/day; no standing charge once gas is capped off. */
export const ukCapGas2026q4 = flatTariff({
  id: 'uk-cap-2026q4-gas',
  fuel: 'gas',
  title: 'money.tariff.uk-cap-2026q4-gas',
  unitPence: '7.97',
  standingPencePerDay: '29.68',
  chargeStandingWhenUnused: false,
  validFrom: '2026-10-01',
  validTo: '2026-12-31',
});

export const UK_TARIFFS: readonly SlabTariff[] = [ukCapElectricity2026q4, ukCapGas2026q4];
