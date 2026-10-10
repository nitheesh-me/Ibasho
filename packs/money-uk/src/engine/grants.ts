/**
 * Grants (SF 6). Owner: WP-02.
 *
 * `grant-bus`: Boiler Upgrade Scheme, England and Wales, 7,500 pounds towards an air source heat
 * pump (SF 6). Eligibility: the package installs a heat pump, the home is in England or Wales, and
 * the applicant owns the property (owner-occupier or landlord; an unknown tenure stays eligible with
 * a condition). Conditions the owner must meet are listed, not checked: a valid EPC and an MCS
 * installer. Stacks with the Halifax Green Living Reward (SF 6), which is not shipped yet.
 * `validTo` is the end of the current BUS regulations as read by SF 6 (graded `secondary`); an
 * expired grant is excluded by the registry query and by the engine (SF 6 stacking rules).
 *
 * PLACEHOLDER until M-B: the 9,000 pound off-gas-grid rate, WH:LG, the Halifax reward, ECO4 and GBIS
 * shown as closed, and the loan stub.
 */
import { type GrantPlugin, microPenceFromPounds, regionContains } from '@ibasho/core';
import { BUS_EST, BUS_GOV, provenance } from './sources.ts';

/** Option ids that install an air source heat pump (`packs/home-uk/src/ids.ts`). */
export const BUS_OPTION_IDS: readonly string[] = ['heat-ashp', 'heat-ashp-radiators-plus'];
export const BUS_AMOUNT = microPenceFromPounds('7500');

export const grantBus: GrantPlugin = {
  kind: 'grant',
  id: 'grant-bus',
  version: '0.1.0',
  title: 'money.grant.bus',
  regions: ['GB-ENG', 'GB-WLS'],
  validFrom: '2022-05-23',
  validTo: '2028-03-31',
  side: 'engine',
  provenance: provenance([BUS_EST, BUS_GOV], 'secondary'),
  eligible(twin, owner, pkg, asOf) {
    if (asOf < '2022-05-23' || asOf > '2028-03-31') return null;
    if (!regionContains('GB-ENG', twin.region) && !regionContains('GB-WLS', twin.region)) return null;
    if (owner.tenure === 'tenant' || owner.tenure === 'leaseholder') return null;
    const chosen = [...Object.values(pkg.options), ...Object.values(pkg.subOptions ?? {})];
    if (!chosen.some((o) => BUS_OPTION_IDS.includes(o))) return null;
    const conditions = ['money.grant.bus.condition.epc', 'money.grant.bus.condition.mcs'];
    if (owner.tenure === 'unknown') conditions.push('money.grant.bus.condition.owner');
    return { amount: BUS_AMOUNT, conditions, stacksWith: ['grant-halifax-green-living'] };
  },
};

export const UK_GRANTS: readonly GrantPlugin[] = [grantBus];
