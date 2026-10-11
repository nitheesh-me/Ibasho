/**
 * Annualising monthly meter readings (brief section 9). Owner: WP-25.
 *
 * Window: the twelve whole months before the assessment date. Missing readings are never zero:
 * - all twelve months present: the plain sum;
 * - nine to eleven months present: seasonal scaling, annual = sum(available) / sum(share of the
 *   year each available month normally carries), using typical UK monthly shares per fuel (gas
 *   follows heating degree days, electricity is flatter);
 * - fewer than nine: `insufficient`, and the annual figure is null (unavailable).
 * A zero reading is a real zero (for example no gas supply), not a gap.
 */
import type { GhAnnualFuel, GhAnnualised, GhUsageRow, IsoDate } from '@ibasho/core';

/** Typical share of annual use by calendar month (January first). Gas: UK degree-day profile. */
export const GAS_SHARE = [0.155, 0.13, 0.115, 0.08, 0.05, 0.03, 0.025, 0.025, 0.04, 0.075, 0.12, 0.155];
export const ELEC_SHARE = [0.095, 0.085, 0.087, 0.08, 0.078, 0.073, 0.074, 0.074, 0.075, 0.084, 0.091, 0.104];

export const MIN_MONTHS = 9;

/** The twelve `YYYY-MM` months before `asOf` (oldest first). */
export function windowMonths(asOf: IsoDate): string[] {
  const y = Number(asOf.slice(0, 4));
  const m = Number(asOf.slice(5, 7)); // current month, excluded
  const out: string[] = [];
  for (let k = 12; k >= 1; k--) {
    let mm = m - k;
    let yy = y;
    while (mm <= 0) {
      mm += 12;
      yy -= 1;
    }
    out.push(`${yy}-${String(mm).padStart(2, '0')}`);
  }
  return out;
}

function fuel(values: (number | null)[], months: string[], share: number[]): GhAnnualFuel {
  let sum = 0;
  let w = 0;
  let used = 0;
  values.forEach((v, i) => {
    if (v === null) return;
    used += 1;
    sum += v;
    w += share[Number((months[i] as string).slice(5, 7)) - 1] as number;
  });
  const missing = months.length - used;
  if (used < MIN_MONTHS) return { kwh: null, monthsUsed: used, monthsMissing: missing, method: 'insufficient' };
  if (missing === 0) return { kwh: Math.round(sum), monthsUsed: used, monthsMissing: 0, method: 'twelve-months' };
  return { kwh: Math.round(sum / w), monthsUsed: used, monthsMissing: missing, method: 'seasonal-scaling' };
}

export function annualise(rows: readonly GhUsageRow[], floorAreaM2: number, asOf: IsoDate): GhAnnualised {
  const months = windowMonths(asOf);
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const elec = fuel(months.map((m) => byMonth.get(m)?.electricityKwh ?? null), months, ELEC_SHARE);
  const gas = fuel(months.map((m) => byMonth.get(m)?.gasKwh ?? null), months, GAS_SHARE);
  const intensity =
    elec.kwh === null || gas.kwh === null || floorAreaM2 <= 0
      ? null
      : Math.round(((elec.kwh + gas.kwh) / floorAreaM2) * 10) / 10;
  return { window: { from: months[0] as string, to: months[11] as string }, electricity: elec, gas, intensityKwhM2: intensity };
}
