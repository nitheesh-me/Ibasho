/**
 * Finance and accounting (SPEC 7.2, SF 5). Owner: WP-02.
 * M-B: paybacks, IRR (single sign change), the loan annuity and cash-positive flag
 * (`returns.ts`), fuel escalation and the avoided counterfactual replacement (`owner.ts`).
 * M-0: signed savings and monthly carbon per (fuel, month), lifetime carbon, slab-exact bills
 * through tariff plugins, grants with stacking and expiry, N0, B_t, NPV with replacements and
 * residual value. PLACEHOLDER: export income (SEG), the value range and the landlord ledger (T4).
 */
export {
  annualByFuel,
  carbonSavingG,
  carbonUg,
  type FuelMonthVec,
  lifetimeCarbonG,
  ROUND_CARBON_G,
  saving,
  UG_PER_G,
  usedFuels,
  zeroVec,
} from './accounting.ts';
export {
  type AppliedGrant,
  applyGrants,
  type Bills,
  bills,
  type CashFlowInput,
  type CashFlows,
  cashFlows,
  FinanceError,
  type Installed,
  lifecycle,
  netUpfront,
} from './money.ts';
export {
  avoidedCost,
  ESCALATION_DEFAULT_PPB,
  escalationPpb,
  HEAT_REPLACING_KINDS,
  replacesSpaceHeating,
} from './owner.ts';
export {
  annuityMonthly,
  type DiscountedPayback,
  discountedPayback,
  type FlowTerms,
  flowTerms,
  IRR_HI_PPB,
  IRR_LO_PPB,
  IRR_TOL_PPB,
  type Irr,
  irr,
  type LoanView,
  loanView,
  netFlows,
  npvAt,
  powBig,
  ppbToPercent,
  type SimplePayback,
  signChanges,
  simplePayback,
} from './returns.ts';
