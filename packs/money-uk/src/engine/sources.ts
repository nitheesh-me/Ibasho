/**
 * Sources cited by pack `money-uk`. Owner: WP-02.
 * Grades follow DEC SC-3 and SC-F3: values transcribed by a reviewer and not yet re-read against
 * the primary document are `secondary`; values without a primary source are `estimate` (R17 badge).
 */
import type { Grade, Provenance, SourceRef } from '@ibasho/core';

export const LAST_CHECKED = '2026-10-11' as const;

export const OFGEM_CAP_2026Q4: SourceRef = {
  id: 'ofgem-cap-2026q4',
  title: 'Ofgem, changes to the energy price cap between 1 October and 31 December 2026 (via BP 7.1)',
  url: 'https://ofgem.gov.uk/news/changes-energy-price-cap-between-1-october-and-31-december-2026',
  retrieved: '2026-10-10',
};
export const SAP_10_2_T12: SourceRef = {
  id: 'sap-10-2-t12',
  title:
    'SAP 10.2 Table 12 and Table 12d, fuel emission factors and monthly electricity factors (via BP 7.2)',
  url: 'https://bregroup.com/sap/sap10',
  clause: 'Table 12, Table 12d',
  retrieved: '2026-10-10',
};
export const BP_6_1: SourceRef = {
  id: 'bp-6-1',
  title: 'Building Physics Brief 6.1, UK retrofit measure catalogue and cost models',
  retrieved: '2026-10-10',
};
export const EST_LOFT: SourceRef = {
  id: 'est-loft',
  title: 'Energy Saving Trust loft insulation costs (via Rightmove guide, BP 6.1)',
  url: 'https://www.rightmove.co.uk/guides/?p=3307',
  retrieved: '2026-10-10',
};
export const EST_DRAUGHT: SourceRef = {
  id: 'est-draught',
  title: 'Energy Saving Trust draught-proofing savings summary (BP 6.1)',
  url: 'https://acwhyte.co.uk/energy-saving-measures-expected-savings-by-the-energy-saving-trust',
  retrieved: '2026-10-10',
};
export const WHICH_ASHP: SourceRef = {
  id: 'which-ashp-costs',
  title: 'Which? air source heat pump costs and savings (BP 6.1)',
  url: 'https://www.which.co.uk/reviews/ground-and-air-source-heat-pumps/article/air-source-heat-pump-costs-and-savings-akySY6N5Y6Dd',
  retrieved: '2026-10-10',
};
export const BUS_EST: SourceRef = {
  id: 'est-bus',
  title: 'Energy Saving Trust, Boiler Upgrade Scheme (SF 6)',
  url: 'https://www.energysavingtrust.org.uk/advice/boiler-upgrade-scheme/',
  retrieved: '2026-10-10',
};
export const BUS_GOV: SourceRef = {
  id: 'gov-bus-grant-levels',
  title: 'GOV.UK notice of approved grant categories and values for the Boiler Upgrade Scheme (SF 6)',
  url: 'https://www.gov.uk/government/publications/boiler-upgrade-scheme-regulations-approved-standards-grant-categories-and-grant-levels/notice-of-approved-grant-categories-and-values-for-the-boiler-upgrade-scheme',
  retrieved: '2026-10-10',
};
export const VAT_ESM: SourceRef = {
  id: 'which-warm-homes-plan',
  title: 'Which?, the Warm Homes Plan explained: 0% VAT on energy-saving materials to 31 March 2027 (SF 6)',
  url: 'https://www.which.co.uk/news/article/the-warm-homes-plan-explained-loans-for-green-tech-and-free-insulation-ap3y34T36XPc',
  retrieved: '2026-10-10',
};
export const SF_4_2: SourceRef = {
  id: 'sf-4-2',
  title:
    'Score and Finance Brief 4.2, Ibasho evidence table v1 (Nationwide 2026, Rightmove, Knight Frank, DECC 2013)',
  url: 'https://www.nationwide.co.uk/media/hpi/reports/energy-efficiency-ratings-have-limited-impact-on-owner-occupied-house-prices-despite-increased-interest-in-going-green',
  retrieved: '2026-10-10',
};

export const EST_SOLID_WALL: SourceRef = {
  id: 'est-solid-wall',
  title: 'Energy Saving Trust solid wall insulation costs, EWI and IWI (BP 6.1)',
  url: 'https://energysavingtrust.org.uk/home-insulation/solid-wall',
  retrieved: '2026-10-10',
};
export const WHICH_FLOOR: SourceRef = {
  id: 'which-floor-insulation',
  title: 'Which? floor insulation costs and savings (BP 6.1)',
  url: 'https://www.which.co.uk/reviews/insulation/article/floor-insulation',
  retrieved: '2026-10-10',
};
export const MVHR_COSTS: SourceRef = {
  id: 'trade2base-mvhr',
  title: 'Trade2base, MVHR installation costs UK (BP 6.1)',
  url: 'https://www.trade2base.com/blog/mvhr-installation-costs-uk',
  retrieved: '2026-10-10',
};
export const DESNZ_PV_COSTS: SourceRef = {
  id: 'pv-magazine-desnz-mcs',
  title: 'pv magazine on DESNZ MCS small-scale solar costs FY24/25 (BP 6.1)',
  url: 'https://www.pv-magazine.com/2025/06/12/uk-small-scale-solar-costs-tumble-as-competition-heats-up-for-installers/',
  retrieved: '2026-10-10',
};
export const DESNZ_BATTERY_COSTS: SourceRef = {
  id: 'solar-power-portal-desnz-batteries',
  title: 'Solar Power Portal on DESNZ domestic battery installation costs (BP 6.1)',
  url: 'https://www.solarpowerportal.co.uk/energy-storage/desnz-over-22-000-domestic-batteries-installed-in-past-year',
  retrieved: '2026-10-10',
};
export const SAP_10_2_T4: SourceRef = {
  id: 'sap-10-2-t2-t4',
  title: 'SAP 10.2 Tables 2 and 4e, cylinder insulation and heating controls (BP 6.1)',
  url: 'https://bregroup.com/sap/sap10',
  clause: 'Table 2, Table 4e',
  retrieved: '2026-10-10',
};
export const IBASHO_ESTIMATE: SourceRef = {
  id: 'ibasho-estimate-2026',
  title: 'Ibasho estimate from installer price ranges, not yet backed by a published survey (R17 badge)',
  retrieved: '2026-10-11',
};
export const RDSAP_10_T32: SourceRef = {
  id: 'rdsap-10-t32',
  title: 'RdSAP 10 Table 32 fuel prices and standing charges (via BP 7.1)',
  url: 'https://bregroup.com/sap/sap10',
  clause: 'RdSAP 10 Table 32',
  retrieved: '2026-10-10',
};
export const SAP_10_2_RATING: SourceRef = {
  id: 'sap-10-2-s13',
  title: 'SAP 10.2 section 13, energy cost rating: ECF = deflator * cost / (TFA + 45) (SF 3.1)',
  url: 'https://bregroup.com/sap/sap10',
  clause: 'Section 13',
  retrieved: '2026-10-10',
};
export const WARM_HOMES_LOAN: SourceRef = {
  id: 'which-warm-homes-plan-loans',
  title: 'Which?, the Warm Homes Plan explained: low and zero interest loans for green tech (SF 6)',
  url: 'https://www.which.co.uk/news/article/the-warm-homes-plan-explained-loans-for-green-tech-and-free-insulation-ap3y34T36XPc',
  retrieved: '2026-10-10',
};

export function provenance(sources: SourceRef[], grade: Grade): Provenance {
  return { sources, lastChecked: LAST_CHECKED, grade };
}
