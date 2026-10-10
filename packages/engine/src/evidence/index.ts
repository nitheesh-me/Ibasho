/**
 * Evidence for search results (ARCH 7, SPEC 7.2). Owner: WP-02.
 *
 * Physics evidence comes from the pipeline runner (WP-01 assigns ids). This module adds the
 * bookkeeping nodes of one package on the your-home run: `acct.saving.<fuel>.<m>`,
 * `acct.carbon_saving`, `money.bill.<fuel>`, `money.bill_saving`, `fin.capex`, `fin.grants`,
 * `fin.n0`, `fin.b.1`, `fin.npv` and `fin.lifetime_tco2e`. Inputs point at the delivered energy
 * nodes of the package and of the baseline, so the drawer can walk from a pound to a kWh.
 * Seals start `unverified`; `verify` decides them (ARCH 7).
 *
 * Eager graphs cover the baseline, the front and the picks; any other package is built on demand
 * through `EngineApi.evidence` (B10).
 */
import {
  type EvidenceDraft,
  type EvidenceGraphBuilder,
  type EvidenceSubject,
  FUELS,
  MONTHS,
  toWire,
  type Unit,
} from '@ibasho/core';
import type { RowMoney } from '../search/bookkeeping.ts';

const MODE = 'your-home' as const;

function keyOf(pkgId: string, quantity: string): string {
  return `${pkgId}@${MODE}/${quantity}`;
}

interface DraftArgs {
  pkgId: string;
  homeId: string;
  quantity: string;
  value: bigint;
  unit: Unit;
  formula: { id: string; doc: string };
  inputs: { key: string; role: string }[];
  month?: number;
}

function draft(a: DraftArgs): EvidenceDraft {
  const subject: EvidenceSubject = { homeId: a.homeId, packageId: a.pkgId, mode: MODE };
  if (a.month !== undefined) subject.month = a.month;
  return {
    key: keyOf(a.pkgId, a.quantity),
    quantity: a.quantity,
    subject,
    value: { fixed: toWire(a.value), unit: a.unit },
    unit: a.unit,
    formula: a.formula,
    inputs: a.inputs.map((i) => ({ key: i.key, role: i.role })),
    provenance: { kind: 'computed' },
    rounding: { mode: 'sig', value: 3 },
  };
}

/**
 * Bookkeeping drafts of one package. `has(key)` says whether a physics draft with that key is in
 * the builder already (delivered energy of an unused fuel has no node, so it is not an input).
 */
export function bookkeepingDrafts(
  homeId: string,
  pkgId: string,
  money: RowMoney,
  has: (key: string) => boolean,
): EvidenceDraft[] {
  const out: EvidenceDraft[] = [];
  const isBase = pkgId === 'baseline';
  const deliveredKey = (p: string, f: string, m: number) => keyOf(p, `energy.delivered.${f}.${m}`);
  const billInputs: { key: string; role: string }[] = [];
  for (const f of FUELS) {
    const used = MONTHS.filter((m) => has(deliveredKey(pkgId, f, m)));
    if (used.length === 0 && money.bills.byFuel[f] === 0n) continue;
    out.push(
      draft({
        pkgId,
        homeId,
        quantity: `money.bill.${f}`,
        value: money.bills.byFuel[f],
        unit: 'micro-pence/yr',
        formula: {
          id: 'SPEC-7.2-money.bill',
          doc: 'sum_m tariff(E_f,m) + days * standing charge, slab exact',
        },
        inputs: used.map((m) => ({ key: deliveredKey(pkgId, f, m), role: `delivered ${f} month ${m + 1}` })),
      }),
    );
    billInputs.push({ key: keyOf(pkgId, `money.bill.${f}`), role: `bill ${f}` });
  }
  if (isBase) return out;

  const savingInputs: { key: string; role: string }[] = [];
  for (const f of FUELS) {
    for (const m of MONTHS) {
      const before = deliveredKey('baseline', f, m);
      const after = deliveredKey(pkgId, f, m);
      if (!has(before) && !has(after)) continue;
      const q = `acct.saving.${f}.${m}`;
      const inputs = [
        ...(has(before) ? [{ key: before, role: 'before' }] : []),
        ...(has(after) ? [{ key: after, role: 'after' }] : []),
      ];
      out.push(
        draft({
          pkgId,
          homeId,
          quantity: q,
          value: money.saving[f][m]!,
          unit: 'Wh',
          formula: { id: 'SPEC-7.2-acct.saving', doc: 'before - after per fuel and month, sign kept' },
          inputs,
          month: m,
        }),
      );
      savingInputs.push({ key: keyOf(pkgId, q), role: `saving ${f} month ${m + 1}` });
    }
  }
  const baseBillInputs = FUELS.filter((f) => has(keyOf('baseline', `money.bill.${f}`))).map((f) => ({
    key: keyOf('baseline', `money.bill.${f}`),
    role: `bill before ${f}`,
  }));
  const add = (
    quantity: string,
    value: bigint,
    unit: Unit,
    doc: string,
    inputs: { key: string; role: string }[],
  ) =>
    out.push(
      draft({ pkgId, homeId, quantity, value, unit, formula: { id: `SPEC-7.2-${quantity}`, doc }, inputs }),
    );

  add('money.bill_saving', money.billSaving, 'micro-pence/yr', 'bill before - bill after', [
    ...baseBillInputs,
    ...billInputs,
  ]);
  add(
    'acct.carbon_saving',
    money.carbonAnnualG,
    'gCO2e/yr',
    'sum_f sum_m saving_f,m * EF_f,m (R6)',
    savingInputs,
  );
  add(
    'fin.lifetime_tco2e',
    money.lifetimeCarbonG,
    'gCO2e',
    'sum_t sum_f annual saving_f * trajectory factor_f,t',
    savingInputs,
  );
  add('fin.capex', money.grossCost, 'micro-pence', 'sum of central option costs incl. VAT', []);
  add('fin.grants', money.grantTotal, 'micro-pence', 'eligible grants, stacked, capped at cost', []);
  add('fin.n0', money.n0, 'micro-pence', 'N0 = max(0, C0 - G)', [
    { key: keyOf(pkgId, 'fin.capex'), role: 'cost' },
    { key: keyOf(pkgId, 'fin.grants'), role: 'grants' },
  ]);
  add('fin.b.1', money.flows.b[0] ?? 0n, 'micro-pence/yr', 'B_1 = sum_f bill saving_f - dOM', [
    { key: keyOf(pkgId, 'money.bill_saving'), role: 'bill saving' },
  ]);
  add('fin.npv', money.flows.npv, 'micro-pence', '-N0 + sum_t B_t D_t - replacements + residual value D_H', [
    { key: keyOf(pkgId, 'fin.n0'), role: 'net upfront' },
    { key: keyOf(pkgId, 'fin.b.1'), role: 'yearly saving' },
  ]);
  return out;
}

/** Add bookkeeping drafts to a builder that already holds the package's physics drafts. */
export function addBookkeeping(
  builder: EvidenceGraphBuilder,
  homeId: string,
  pkgId: string,
  money: RowMoney,
): void {
  builder.addDrafts(bookkeepingDrafts(homeId, pkgId, money, (k) => builder.idOfKey(k) !== undefined));
}
