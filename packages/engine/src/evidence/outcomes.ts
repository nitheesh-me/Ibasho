/**
 * Evidence for paybacks, IRR, loan, score, EPC band and risks, and the per-package negatives list
 * (SPEC 7.2, SPEC 14, AC-B3). Owner: WP-02.
 *
 * Keys follow the bookkeeping convention `<packageId>@<mode>/<quantity>`: finance on `your-home`,
 * the score on `standard`, the band on `rating`. Negatives hold evidence ids only, never numbers.
 *
 * Indicators checked against the baseline for every shown package:
 * - fuel-rise: annual delivered energy of a fuel rises (`acct.saving.<fuel>` < 0);
 * - money: a fuel's bill rises (`money.bill_saving.<fuel>` < 0), year-1 saving below zero
 *   (`fin.b.1`), NPV below zero (`fin.npv`), payback never or outside the horizon;
 * - carbon: running or lifetime carbon rises (`acct.carbon_saving`, `fin.lifetime_tco2e` < 0);
 * - performance: the score falls (`score.delta` < 0), or the estimated EPC band falls;
 * - risk: a rule that raised a moisture, noise, overheating, fire or structural condition.
 * Disruption needs measure fields the contract does not carry yet (PLACEHOLDER, INTERFACES).
 */
import {
  type EvidenceDraft,
  type EvidenceGraphBuilder,
  type EvidenceSubject,
  type EvidenceValue,
  FUELS,
  type Negative,
  Q,
  type RunMode,
  type SemVer,
  toWire,
  type Unit,
} from '@ibasho/core';
import { SCORE_DIMS, SCORE_GROUPS, type ScoreGroup } from '@ibasho/spec-gen';
import { annualByFuel, ppbToPercent } from '../finance/index.ts';
import { bandRank } from '../score/index.ts';
import type { RowMoney } from '../search/bookkeeping.ts';
import type { RowExtras } from '../search/extras.ts';

const key = (pkgId: string, mode: RunMode, quantity: string) => `${pkgId}@${mode}/${quantity}`;

interface D {
  quantity: string;
  mode: RunMode;
  value: EvidenceValue;
  unit: Unit;
  doc: string;
  inputs?: { key: string; role: string }[];
  plugin?: { id: string; version: SemVer };
}

function mk(homeId: string, pkgId: string, d: D): EvidenceDraft {
  const subject: EvidenceSubject = { homeId, packageId: pkgId, mode: d.mode };
  return {
    key: key(pkgId, d.mode, d.quantity),
    quantity: d.quantity,
    subject,
    value: d.value,
    unit: d.unit,
    formula: { id: `SPEC-7.2-${d.quantity}`, doc: d.doc },
    inputs: d.inputs ?? [],
    provenance: d.plugin ? { kind: 'computed', plugin: d.plugin } : { kind: 'computed' },
    rounding: { mode: 'sig', value: 3 },
  };
}

const fixed = (v: bigint, unit: Unit): EvidenceValue => ({ fixed: toWire(v), unit });

/** Drafts for one package's outcomes. `has(key)` says whether a key is in the builder already. */
export function outcomeDrafts(
  homeId: string,
  pkgId: string,
  money: RowMoney,
  x: RowExtras,
  has: (k: string) => boolean,
): EvidenceDraft[] {
  const out: EvidenceDraft[] = [];
  const push = (d: D) =>
    out.push(
      mk(homeId, pkgId, {
        ...d,
        inputs: (d.inputs ?? []).filter((i) => has(i.key) || out.some((o) => o.key === i.key)),
      }),
    );
  const yh = 'your-home' as const;
  const isBase = pkgId === 'baseline';

  if (!isBase) {
    const annual = annualByFuel(money.saving);
    for (const f of FUELS) {
      const months = Array.from({ length: 12 }, (_, m) => ({
        key: key(pkgId, yh, `acct.saving.${f}.${m}`),
        role: `month ${m + 1}`,
      }));
      if (annual[f] !== 0n || months.some((i) => has(i.key)))
        push({
          quantity: `acct.saving.${f}`,
          mode: yh,
          value: fixed(annual[f], 'Wh'),
          unit: 'Wh',
          doc: 'sum_m saving_f,m, sign kept',
          inputs: months,
        });
      const bs = money.billSavingByFuel[f];
      if (bs !== 0n || has(key(pkgId, yh, `money.bill.${f}`)))
        push({
          quantity: `money.bill_saving.${f}`,
          mode: yh,
          value: fixed(bs, 'micro-pence/yr'),
          unit: 'micro-pence/yr',
          doc: 'bill before - bill after for one fuel',
          inputs: [
            { key: key('baseline', yh, `money.bill.${f}`), role: 'before' },
            { key: key(pkgId, yh, `money.bill.${f}`), role: 'after' },
          ],
        });
    }
    const r = x.returns;
    const n0b1 = [
      { key: key(pkgId, yh, 'fin.n0'), role: 'net upfront' },
      { key: key(pkgId, yh, 'fin.b.1'), role: 'yearly saving' },
    ];
    push({
      quantity: 'fin.payback_simple',
      mode: yh,
      value: r.simple.kind === 'years' ? { exact: r.simple.years } : { cat: r.simple.kind },
      unit: 'yr',
      doc: 'N0 / B_1; immediate if N0 = 0, never if B_1 <= 0',
      inputs: n0b1,
    });
    push({
      quantity: 'fin.payback_discounted',
      mode: yh,
      value:
        r.discounted.kind === 'year' ? fixed(BigInt(r.discounted.year), 'yr') : { cat: r.discounted.kind },
      unit: 'yr',
      doc: 'least t with sum_k<=t B_k D_k >= N0',
      inputs: n0b1,
    });
    push({
      quantity: 'fin.irr',
      mode: yh,
      value: r.irr.kind === 'rate' ? { exact: Q.of(r.irr.ppb, 10_000_000n) } : { cat: `n/a:${r.irr.reason}` },
      unit: '%',
      doc: 'NPV(r*) = 0 by bisection, only when cash flows change sign once',
      inputs: [{ key: key(pkgId, yh, 'fin.npv'), role: 'npv' }, ...n0b1],
    });
    if (r.loan) {
      push({
        quantity: 'fin.loan_monthly',
        mode: yh,
        value: fixed(r.loan.monthly, 'micro-pence'),
        unit: 'micro-pence',
        doc: `L i / (1 - (1 + i)^-n), APR ${ppbToPercent(r.loan.aprPpb)}%, ${r.loan.termMonths} months`,
        inputs: [{ key: key(pkgId, yh, 'fin.n0'), role: 'principal' }],
        plugin: { id: r.loan.financeId, version: r.loan.financeVersion },
      });
      push({
        quantity: 'fin.cash_positive_m1',
        mode: yh,
        value: { cat: String(r.loan.cashPositiveM1) },
        unit: 'bool',
        doc: '12 x monthly repayment <= B_1',
        inputs: [
          { key: key(pkgId, yh, 'fin.loan_monthly'), role: 'repayment' },
          { key: key(pkgId, yh, 'fin.b.1'), role: 'yearly saving' },
        ],
      });
    }
  }

  for (const rk of x.risks) {
    push({
      quantity: `risk.${rk.risk}.${rk.ruleId}`,
      mode: yh,
      value: { cat: rk.risk },
      unit: '1',
      doc: `raised by rule ${rk.ruleId}`,
    });
  }

  if (x.score) {
    const s = x.score;
    const st = 'standard' as const;
    const val = (r: { lo: Q; hi: Q }): EvidenceValue =>
      Q.eq(r.lo, r.hi) ? { exact: r.lo } : { interval: { lo: Q.toNumber(r.lo), hi: Q.toNumber(r.hi) } };
    const subInputs: Record<string, { key: string; role: string }[]> = {
      F: [{ key: key(pkgId, st, 'fabric.hlp'), role: 'heat loss parameter' }],
    };
    for (const d of SCORE_DIMS) {
      push({
        quantity: `score.sub.${d}`,
        mode: st,
        value: val(s.sub[d]),
        unit: 'pts',
        doc: `100 clamp(gain / span, 0, 1), indicator ${Q.toWire(s.indicators[d] ?? Q.ZERO)}${s.indicators[d] === null ? ' (unknown)' : ''}`,
        inputs: subInputs[d] ?? [],
      });
    }
    for (const g of Object.keys(SCORE_GROUPS) as ScoreGroup[]) {
      push({
        quantity: `score.group.${g}`,
        mode: st,
        value: val(s.group[g]),
        unit: 'pts',
        doc: '100 sum_d w_d unit_d / sum_d w_d over the group',
        inputs: SCORE_GROUPS[g].map((d) => ({ key: key(pkgId, st, `score.sub.${d}`), role: d })),
      });
    }
    push({
      quantity: 'score.total',
      mode: st,
      value: val(s.total),
      unit: 'pts',
      doc: '100 sum_d w_d unit_d (SPEC R2 weights)',
      inputs: SCORE_DIMS.map((d) => ({ key: key(pkgId, st, `score.sub.${d}`), role: d })),
    });
  }
  if (x.epc) {
    const e = x.epc;
    const plugin = { id: e.proxyId, version: e.proxyVersion };
    push({
      quantity: 'epc.sap_est',
      mode: 'rating',
      value: { exact: Q.of(BigInt(e.sap)) },
      unit: 'pts',
      doc: 'SAP 10.2 cost rating at RdSAP 10 prices',
      plugin,
    });
    push({
      quantity: 'epc.band_est',
      mode: 'rating',
      value: { cat: `${e.band} (${e.lo} to ${e.hi})` },
      unit: 'band',
      doc: 'SAP bands A >= 92 .. F >= 21, one band either side until AC-R1',
      inputs: [{ key: key(pkgId, 'rating', 'epc.sap_est'), role: 'sap' }],
      plugin,
    });
  }
  return out;
}

/** Score change against the baseline, lower ends (T counts zero in both while unknown). */
export function scoreDeltaDraft(
  homeId: string,
  pkgId: string,
  x: RowExtras,
  base: RowExtras,
): EvidenceDraft | undefined {
  if (!x.score || !base.score) return undefined;
  const delta = Q.sub(x.score.total.lo, base.score.total.lo);
  return mk(homeId, pkgId, {
    quantity: 'score.delta',
    mode: 'standard',
    value: { exact: delta },
    unit: 'pts',
    doc: 'score after - score before (known dimensions)',
    inputs: [
      { key: key('baseline', 'standard', 'score.total'), role: 'before' },
      { key: key(pkgId, 'standard', 'score.total'), role: 'after' },
    ],
  });
}

export function addOutcomes(
  builder: EvidenceGraphBuilder,
  homeId: string,
  pkgId: string,
  money: RowMoney,
  x: RowExtras,
  base?: RowExtras,
): void {
  const has = (k: string) => builder.idOfKey(k) !== undefined;
  const drafts = outcomeDrafts(homeId, pkgId, money, x, has);
  if (base && pkgId !== 'baseline') {
    const d = scoreDeltaDraft(homeId, pkgId, x, base);
    if (d) drafts.push(d);
  }
  builder.addDrafts(drafts);
}

/**
 * What gets worse for one package against the baseline (SPEC 14, AC-B3). Reads the builder for
 * evidence ids, so call it after `addBookkeeping` and `addOutcomes` for the package and baseline.
 */
export function negativesOf(
  builder: EvidenceGraphBuilder,
  pkgId: string,
  money: RowMoney,
  x: RowExtras,
  base?: RowExtras,
): Negative[] {
  if (pkgId === 'baseline') return [];
  const out: Negative[] = [];
  const id = (mode: RunMode, q: string, p = pkgId) => builder.idOfKey(key(p, mode, q));
  const add = (n: Omit<Negative, 'evidence'> & { evidence: string | undefined }) => {
    if (n.evidence === undefined) throw new Error(`negative ${n.indicator} of ${pkgId} has no evidence node`);
    out.push(n as Negative);
  };
  const yh = 'your-home' as const;
  const annual = annualByFuel(money.saving);
  for (const f of FUELS) {
    if (annual[f] < 0n)
      add({
        indicator: `acct.saving.${f}`,
        kind: 'fuel-rise',
        evidence: id(yh, `acct.saving.${f}`),
        message: `negative.fuel-rise.${f}`,
      });
    if (money.billSavingByFuel[f] < 0n) {
      const n: Omit<Negative, 'evidence'> & { evidence: string | undefined } = {
        indicator: `money.bill.${f}`,
        kind: 'money',
        evidence: id(yh, `money.bill_saving.${f}`),
        message: `negative.bill-rise.${f}`,
      };
      const before = id(yh, `money.bill.${f}`, 'baseline');
      const after = id(yh, `money.bill.${f}`);
      if (before) n.before = before;
      if (after) n.after = after;
      add(n);
    }
  }
  if ((money.flows.b[0] ?? 0n) < 0n)
    add({ indicator: 'fin.b.1', kind: 'money', evidence: id(yh, 'fin.b.1'), message: 'negative.year1-cost' });
  if (money.flows.npv < 0n)
    add({ indicator: 'fin.npv', kind: 'money', evidence: id(yh, 'fin.npv'), message: 'negative.npv' });
  if (x.returns.discounted.kind === 'not-within-horizon')
    add({
      indicator: 'fin.payback_discounted',
      kind: 'money',
      evidence: id(yh, 'fin.payback_discounted'),
      message: 'negative.no-payback',
    });
  if (money.carbonAnnualG < 0n)
    add({
      indicator: 'acct.carbon_saving',
      kind: 'carbon',
      evidence: id(yh, 'acct.carbon_saving'),
      message: 'negative.carbon-rise',
    });
  if (money.lifetimeCarbonG < 0n)
    add({
      indicator: 'fin.lifetime_tco2e',
      kind: 'carbon',
      evidence: id(yh, 'fin.lifetime_tco2e'),
      message: 'negative.lifetime-carbon-rise',
    });
  if (x.score && base?.score && Q.lt(x.score.total.lo, base.score.total.lo)) {
    const n: Omit<Negative, 'evidence'> & { evidence: string | undefined } = {
      indicator: 'score.total',
      kind: 'performance',
      evidence: id('standard', 'score.delta'),
      message: 'negative.score-fall',
    };
    const before = id('standard', 'score.total', 'baseline');
    const after = id('standard', 'score.total');
    if (before) n.before = before;
    if (after) n.after = after;
    add(n);
  }
  if (x.epc && base?.epc && bandRank(x.epc.band) < bandRank(base.epc.band)) {
    const n: Omit<Negative, 'evidence'> & { evidence: string | undefined } = {
      indicator: 'epc.band_est',
      kind: 'performance',
      evidence: id('rating', 'epc.band_est'),
      message: 'negative.band-fall',
    };
    const before = id('rating', 'epc.band_est', 'baseline');
    if (before) n.before = before;
    add(n);
  }
  for (const rk of x.risks) {
    add({
      indicator: `risk.${rk.risk}`,
      kind: 'risk',
      evidence: id(yh, `risk.${rk.risk}.${rk.ruleId}`),
      risk: rk.risk,
      ruleId: rk.ruleId,
      message: `negative.risk.${rk.risk}`,
    });
  }
  return out;
}
