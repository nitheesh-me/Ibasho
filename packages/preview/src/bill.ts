/**
 * The canonical yearly bill (studio review A-M3): every screen that shows a building's bill should
 * read it from the energy (or codes) result through this one function. For the same inputs the
 * Preview pipeline always gives the same bill. It changes only with:
 * - the building document (any edit; its hash),
 * - settings `money.tariff.elec.rate`, `money.tariff.elec.demand`, `money.tariff.elec.powerFactor`,
 *   `money.scheme.gruhaJyothi`, `comfort.setpoint.cool`, `comfort.dhw.solarShare`,
 * - design levers (`JobInputs.energyParams`),
 * - whether the job ran the radiation stage (context shading lowers cooling; without it, no
 *   context shading is assumed, R32), and the place (climate and tariff).
 * The optimiser's baseline option (no levers) reproduces this bill exactly in whole currency.
 */
import type { BuildingResult } from '@ibasho/core';

export interface HeadlineBill {
  /** Sum of every carrier's yearly total, in the minor unit (micro-paise or micro-pence). */
  total: bigint;
  currency: 'INR' | 'GBP';
  /** Whole rupees or pounds, rounded down (what the optimiser's `opex` axis uses). */
  whole: bigint;
  byCarrier: { carrier: string; total: bigint }[];
  /** The energy result it came from (equal hashes mean equal bills). */
  inputsHash: string;
}

export function headlineBill(result: BuildingResult): HeadlineBill {
  const total = result.bills.reduce((s, b) => s + b.total, 0n);
  return {
    total,
    currency: result.bills[0]?.currency ?? 'INR',
    whole: total / 100_000_000n,
    byCarrier: result.bills.map((b) => ({ carrier: b.carrier, total: b.total })),
    inputsHash: result.inputsHash,
  };
}
