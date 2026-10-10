/**
 * Paybacks, IRR, the loan and the cash-positive flag in integer fixed point (SPEC 7.2, SF 5.2).
 * Owner: WP-02.
 *
 * - Simple payback `N0 / B_1` is an exact rational (years): `immediate` when N0 = 0, `never` when
 *   B_1 <= 0.
 * - Discounted payback is the least year t with `sum_{k<=t} applyFactor(B_k, D_k) >= N0`, else
 *   `not-within-horizon`.
 * - IRR is reported only when the yearly cash flows change sign exactly once (then the root is
 *   unique, Descartes' rule of signs). It is found by integer bisection on the rate in ppb over
 *   (-99%, 100%), with the NPV at each rate computed by the same recurrence and rounding points as
 *   `cashFlows`. Otherwise `n/a`. IRR is shown, never used to rank (SF 5.3).
 * - Loan annuity `M = L i (1+i)^n / ((1+i)^n - 1)` with `i = APR / 12`, computed exactly in bigint
 *   and rounded half even once; `M = L / n` at 0% APR. Cash positive from month 1 when
 *   `12 M <= B_1` (the Golden Rule revived, SF 5.2).
 */
import {
  applyFactor,
  discountFactors,
  type FinancePlugin,
  type MicroPence,
  PPB,
  Q,
  roundHalfEven,
  type SemVer,
} from '@ibasho/core';
import { type CashFlows, FinanceError, type Installed, lifecycle } from './money.ts';

export type SimplePayback = { kind: 'immediate' } | { kind: 'never' } | { kind: 'years'; years: Q };
export type DiscountedPayback =
  | { kind: 'immediate' }
  | { kind: 'not-within-horizon' }
  | { kind: 'year'; year: number };

/** `fin.payback_simple` (SF 5.2). */
export function simplePayback(n0: MicroPence, b1: MicroPence): SimplePayback {
  if (n0 <= 0n) return { kind: 'immediate' };
  if (b1 <= 0n) return { kind: 'never' };
  return { kind: 'years', years: Q.of(n0, b1) };
}

/** `fin.payback_discounted` (SF 5.2): least t with discounted cumulative saving >= N0. */
export function discountedPayback(
  n0: MicroPence,
  b: readonly MicroPence[],
  discountRatePpb: bigint,
): DiscountedPayback {
  if (n0 <= 0n) return { kind: 'immediate' };
  const D = discountFactors(discountRatePpb, b.length);
  let cum = 0n;
  for (let t = 1; t <= b.length; t++) {
    cum += applyFactor(b[t - 1]!, D[t]!);
    if (cum >= n0) return { kind: 'year', year: t };
  }
  return { kind: 'not-within-horizon' };
}

/** Yearly flows of a package as the NPV sees them, kept as separate rounding terms. */
export interface FlowTerms {
  n0: MicroPence;
  /** B_1..B_H. */
  b: readonly MicroPence[];
  /** Replacement cost per year 1..H (index t - 1), undiscounted. */
  replacements: readonly MicroPence[];
  /**
   * Each replacement on its own, as `cashFlows` discounts them (one rounding per replacement).
   * When absent, `npvAt` discounts the per-year sums.
   */
  replacementItems?: readonly { atYear: number; cost: MicroPence }[];
  /** Residual value at H, undiscounted. */
  residual: MicroPence;
}

export function flowTerms(n0: MicroPence, flows: CashFlows, installed: readonly Installed[]): FlowTerms {
  const H = flows.b.length;
  const replacements: MicroPence[] = new Array<MicroPence>(H).fill(0n);
  const replacementItems: { atYear: number; cost: MicroPence }[] = [];
  let residual = 0n;
  for (const x of installed) {
    const lc = lifecycle(x, H);
    for (const r of lc.replacements) {
      replacements[r.atYear - 1] = replacements[r.atYear - 1]! + r.cost;
      replacementItems.push(r);
    }
    residual += lc.residual;
  }
  return { n0, b: flows.b, replacements, replacementItems, residual };
}

/**
 * NPV at a rate, with exactly the rounding points of `cashFlows`: each B_t and each replacement
 * is discounted separately, the residual value at H once. Equal to `cashFlows(...).npv` at the
 * owner's rate (tested).
 */
export function npvAt(f: FlowTerms, ratePpb: bigint): MicroPence {
  const H = f.b.length;
  const D = discountFactors(ratePpb, H);
  let npv = -f.n0;
  for (let t = 1; t <= H; t++) npv += applyFactor(f.b[t - 1]!, D[t]!);
  if (f.replacementItems) {
    for (const r of f.replacementItems) npv -= applyFactor(r.cost, D[r.atYear]!);
  } else {
    for (let t = 1; t <= H; t++) {
      const r = f.replacements[t - 1]!;
      if (r !== 0n) npv -= applyFactor(r, D[t]!);
    }
  }
  npv += applyFactor(f.residual, D[H]!);
  return npv;
}

/** Net cash flow per year 0..H: -N0, then B_t - replacements_t, plus the residual value at H. */
export function netFlows(f: FlowTerms): MicroPence[] {
  const H = f.b.length;
  const out: MicroPence[] = [-f.n0];
  for (let t = 1; t <= H; t++) out.push(f.b[t - 1]! - f.replacements[t - 1]! + (t === H ? f.residual : 0n));
  return out;
}

/** Number of sign changes in a sequence, zeros skipped. */
export function signChanges(xs: readonly bigint[]): number {
  let n = 0;
  let prev = 0n;
  for (const x of xs) {
    if (x === 0n) continue;
    if (prev !== 0n && x > 0n !== prev > 0n) n++;
    prev = x;
  }
  return n;
}

/** Lower and upper IRR search bounds in ppb (SF 5.2: bisection on (-0.99, 1.0)). */
export const IRR_LO_PPB = -990_000_000n;
export const IRR_HI_PPB = 1_000_000_000n;
/** Bisection stops when the bracket is this narrow (0.0001 percentage points). */
export const IRR_TOL_PPB = 1_000n;

export type Irr =
  | { kind: 'n/a'; reason: 'sign-changes' | 'no-root-in-range' }
  | { kind: 'rate'; ppb: bigint };

/**
 * `fin.irr` (SF 5.2): only when the net cash flows change sign exactly once. The result is the
 * midpoint of the final bracket, rounded half even to a whole ppb.
 */
export function irr(f: FlowTerms): Irr {
  if (signChanges(netFlows(f)) !== 1) return { kind: 'n/a', reason: 'sign-changes' };
  let lo = IRR_LO_PPB;
  let hi = IRR_HI_PPB;
  const sLo = npvAt(f, lo);
  const sHi = npvAt(f, hi);
  if (sLo === 0n) return { kind: 'rate', ppb: lo };
  if (sHi === 0n) return { kind: 'rate', ppb: hi };
  if (sLo > 0n === sHi > 0n) return { kind: 'n/a', reason: 'no-root-in-range' };
  const loPositive = sLo > 0n;
  while (hi - lo > IRR_TOL_PPB) {
    const mid = (lo + hi) / 2n;
    const s = npvAt(f, mid);
    if (s === 0n) return { kind: 'rate', ppb: mid };
    if (s > 0n === loPositive) lo = mid;
    else hi = mid;
  }
  return { kind: 'rate', ppb: roundHalfEven(lo + hi, 2n) };
}

export interface LoanView {
  financeId: string;
  financeVersion: SemVer;
  principal: MicroPence;
  termMonths: number;
  aprPpb: bigint;
  monthly: MicroPence;
  /** `12 * monthly <= B_1`. */
  cashPositiveM1: boolean;
}

/** Integer power by squaring (bigint only; the `**` operator is banned in the engine). */
export function powBig(base: bigint, exp: bigint): bigint {
  if (exp < 0n) throw new FinanceError('negative exponent');
  let r = 1n;
  let b = base;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) r *= b;
    b *= b;
    e >>= 1n;
  }
  return r;
}

/** Monthly annuity payment, exact then rounded half even once. */
export function annuityMonthly(principal: MicroPence, aprPpb: bigint, termMonths: number): MicroPence {
  if (!Number.isInteger(termMonths) || termMonths < 1)
    throw new FinanceError('loan term must be at least one month');
  if (principal < 0n) throw new FinanceError('loan principal must be non-negative');
  if (aprPpb < 0n) throw new FinanceError('loan APR must be non-negative');
  const n = BigInt(termMonths);
  if (aprPpb === 0n) return roundHalfEven(principal, n);
  const D = 12n * PPB;
  const N = D + aprPpb;
  const Nn = powBig(N, n);
  const Dn = powBig(D, n);
  // M = L * (apr / D) * Nn / (Nn - Dn) = L * apr * Nn / (D * (Nn - Dn)).
  return roundHalfEven(principal * aprPpb * Nn, D * (Nn - Dn));
}

/**
 * `fin.loan_monthly` and `fin.cash_positive_m1` with the first loan product in force (by id): the
 * principal is N0 capped at the product's maximum. Undefined when no loan applies or N0 is zero.
 */
export function loanView(
  products: readonly FinancePlugin[],
  n0: MicroPence,
  b1: MicroPence,
): LoanView | undefined {
  const loan = [...products].filter((p) => p.product === 'loan').sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  if (!loan || n0 <= 0n) return undefined;
  const principal = loan.maxAmount !== undefined && loan.maxAmount < n0 ? loan.maxAmount : n0;
  const monthly = annuityMonthly(principal, loan.aprPpb, loan.termMonths);
  return {
    financeId: loan.id,
    financeVersion: loan.version,
    principal,
    termMonths: loan.termMonths,
    aprPpb: loan.aprPpb,
    monthly,
    cashPositiveM1: 12n * monthly <= b1,
  };
}

/** Exact decimal percent from ppb (35_000_000 ppb is "3.5"). */
export function ppbToPercent(ppb: bigint): string {
  const neg = ppb < 0n;
  const a = neg ? -ppb : ppb;
  const int = a / 10_000_000n;
  const frac = (a % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${int}${frac ? `.${frac}` : ''}`;
}
