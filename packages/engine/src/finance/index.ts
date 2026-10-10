/**
 * Finance and accounting (SPEC 7.2, SF 5). Owner: WP-02.
 * M-0: signed savings and monthly carbon per (fuel, month), lifetime carbon, slab-exact bills
 * through tariff plugins, grants with stacking and expiry, N0, B_t, NPV with replacements and
 * residual value. PLACEHOLDER until M-B: export income, the counterfactual boiler (A_cf), paybacks,
 * IRR, the loan and cash-positive flag, the value range and the landlord ledger.
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
