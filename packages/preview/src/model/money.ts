/**
 * Preview bills (SPEC 22 `bill.*`): exact integer arithmetic in the minor unit, so every bill's
 * total equals the sum of its months (P2). Tariffs follow the BT brief 7.1 (TGSPDCL FY 2026-27,
 * estimates labelled Preview until WP-02's `money-in` lands at V-4). INR in micro-paise
 * (1 rupee = 1e8), GBP in micro-pence (1 pound = 1e8).
 */
import type { Month, TariffBill } from '@ibasho/core';

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const RUPEE = 100_000_000n;

export interface HtTariff {
  /** Energy charge, paise per kVAh (HT-II(A) Others at 11 kV: 880). */
  paisePerKvah: number;
  /** Demand charge, rupees per kVA a month (500). */
  rupeesPerKva: number;
  /** Power factor to convert kWh to kVAh (0.95 assumed). */
  powerFactor: number;
  /** Time of day: surcharge in the 06 to 10 and 18 to 22 peaks, rebate 10 to 18 (paise per kVAh). */
  todSurchargePaise: number;
  todRebatePaise: number;
  /** Minimum billed kVAh per kVA of demand a month. */
  minKvahPerKva: number;
}

export const HT_II_A: HtTariff = {
  paisePerKvah: 880,
  rupeesPerKva: 500,
  powerFactor: 0.95,
  todSurchargePaise: 150,
  todRebatePaise: 50,
  minKvahPerKva: 25,
};

/**
 * HT-II(A): energy per kVAh with time of day, plus demand per kVA. `share` is the fraction of
 * energy in the peak windows and in the 10 to 18 rebate window, per mille.
 */
export function htBill(
  whByMonth: readonly bigint[],
  peakKva: readonly number[],
  tariff: HtTariff,
  share: { peakPm: number; dayPm: number },
): TariffBill {
  const pf = BigInt(Math.round(tariff.powerFactor * 1000));
  const byMonth = whByMonth.map((wh, m) => {
    const kva = BigInt(Math.round(peakKva[m] ?? 0));
    const vah = ((wh > 0n ? wh : 0n) * 1000n) / pf;
    const minVah = kva * BigInt(tariff.minKvahPerKva) * 1000n;
    const billed = vah > minVah ? vah : minVah;
    // micro-paise = VAh * paise per kVAh * 1e6 / 1e3
    const energy = billed * BigInt(tariff.paisePerKvah) * 1000n;
    const tod =
      (vah * BigInt(share.peakPm) * BigInt(tariff.todSurchargePaise) * 1000n) / 1000n -
      (vah * BigInt(share.dayPm) * BigInt(tariff.todRebatePaise) * 1000n) / 1000n;
    const demand = kva * BigInt(tariff.rupeesPerKva) * RUPEE;
    return energy + tod + demand;
  });
  return {
    carrier: 'electricity',
    tariffId: 'tgspdcl.ht-ii-a.preview',
    currency: 'INR',
    byMonth,
    total: byMonth.reduce((s, v) => s + v, 0n),
    cliffMonths: [],
    demandKva: Math.round(Math.max(...peakKva)),
  };
}

/**
 * TG domestic LT-I (BT 7.1): the monthly total picks the category, and the category reprices every
 * unit. LT-I(A) up to 100 units; LT-I(B)(i) 101 to 200; LT-I(B)(ii) above 200. Slabs as
 * [upper bound kWh, paise per kWh]. Crossing 200 units moves 200 units to 5.10 (the cliff).
 */
const LT_I: { upto: number; slabs: [number, number][] }[] = [
  {
    upto: 100,
    slabs: [
      [50, 195],
      [100, 310],
    ],
  },
  {
    upto: 200,
    slabs: [
      [100, 340],
      [200, 480],
    ],
  },
  {
    upto: Number.POSITIVE_INFINITY,
    slabs: [
      [200, 510],
      [300, 770],
      [400, 900],
      [800, 950],
      [Number.POSITIVE_INFINITY, 1000],
    ],
  },
];

/** One flat's monthly bill in micro-paise for `wh` Wh, exact (category by total, telescopic slabs). */
export function slabMicroPaise(wh: bigint): bigint {
  const units = Number(wh) / 1000;
  const cat = LT_I.find((c) => units <= c.upto) ?? (LT_I[2] as (typeof LT_I)[number]);
  let left = wh;
  let lower = 0n;
  let total = 0n;
  for (const [upKwh, paise] of cat.slabs) {
    if (left <= 0n) break;
    const width = upKwh === Number.POSITIVE_INFINITY ? left : BigInt(upKwh) * 1000n - lower;
    const take = left < width ? left : width;
    total += take * BigInt(paise) * 1000n;
    left -= take;
    lower += width;
  }
  return total;
}

/**
 * Block of `flats` equal flats on LT-I. Cliff months: a flat crosses 200 units (AC-BR2). With
 * Gruha Jyothi on (eligible households, a setting), a month of 200 units or less costs nothing.
 */
export function domesticBill(whByMonth: readonly bigint[], flats: number, gruhaJyothi = false): TariffBill {
  const n = BigInt(Math.max(1, flats));
  const cliffMonths: Month[] = [];
  const byMonth = whByMonth.map((wh, m) => {
    const perFlat = (wh > 0n ? wh : 0n) / n;
    if (perFlat > 200_000n) cliffMonths.push(m as Month);
    if (gruhaJyothi && perFlat <= 200_000n) return 0n;
    return slabMicroPaise(perFlat) * n;
  });
  return {
    carrier: 'electricity',
    tariffId: gruhaJyothi ? 'tgspdcl.lt-i.gruha-jyothi.preview' : 'tgspdcl.lt-i.preview',
    currency: 'INR',
    byMonth,
    total: byMonth.reduce((s, v) => s + v, 0n),
    cliffMonths,
  };
}

/** UK unit rate plus standing charge (pence), micro-pence. */
export function ukBill(
  whByMonth: readonly bigint[],
  carrier: 'electricity' | 'gas',
  unitPence: number,
  standingPencePerDay: number,
): TariffBill {
  const unit = BigInt(Math.round(unitPence * 100)); // hundredths of a penny per kWh
  const byMonth = whByMonth.map(
    (wh, m) =>
      ((wh > 0n ? wh : 0n) * unit * 1_000_000n) / 100_000n +
      BigInt(Math.round(standingPencePerDay * 1_000_000)) * BigInt(DAYS[m] as number),
  );
  return {
    carrier,
    tariffId: carrier === 'gas' ? 'ofgem.cap.gas.preview' : 'ofgem.cap.elec.preview',
    currency: 'GBP',
    byMonth,
    total: byMonth.reduce((s, v) => s + v, 0n),
    cliffMonths: [],
  };
}
