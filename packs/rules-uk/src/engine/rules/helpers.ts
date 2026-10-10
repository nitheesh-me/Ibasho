/**
 * Small builders for rule data. Owner: WP-03. Rules stay plain `Rule` objects (JSON data that Lean
 * reads too); these only shorten the source.
 */
import type { CmpOp, Expr, FactId } from '@ibasho/core';

/** `fact op value` (a number, a string or another fact). */
export const cmp = (fact: FactId, op: CmpOp, right: number | string | { fact: FactId }): Expr => ({
  cmp: op,
  left: { fact },
  right,
});
/** A boolean (Tri) fact is true. */
export const yes = (fact: FactId): Expr => cmp(fact, '=', 1);
/** A boolean (Tri) fact is false. */
export const no = (fact: FactId): Expr => cmp(fact, '=', 0);
export const isIn = (fact: FactId, set: (string | number)[]): Expr => ({ in: { fact }, set });
export const all = (...and: Expr[]): Expr => ({ and });
export const any = (...or: Expr[]): Expr => ({ or });
export const not = (e: Expr): Expr => ({ not: e });
export const always: Expr = { const: true };

/** Sources cited by the pack (RP 5). */
export const SRC = {
  gpdoPt14: 'https://www.legislation.gov.uk/uksi/2015/596/schedule/2/part/14',
  gpdoPt1: 'https://www.legislation.gov.uk/uksi/2015/596/schedule/2/part/1',
  gpdoArt4: 'https://www.legislation.gov.uk/uksi/2015/596/article/4',
  si2025_560: 'https://www.legislation.gov.uk/uksi/2025/560',
  mcs020a: 'https://mcscertified.com/wp-content/uploads/2025/04/MCS-020-a-Issue-1.1-Final.pdf',
  oxfordHp: 'https://www.oxford.gov.uk/planning-advice/planning-advice-heat-pumps',
  wyrePv:
    'https://www.wyreforestdc.gov.uk/planning-and-buildings/planning-for-householders/installation-of-solar-panels-on-domestic-properties',
  cornwallPv:
    'https://www.cornwall.gov.uk/planning-and-building-control/planning-advice-and-guidance/solar-panels-and-planning-permission/',
  walesWalls: 'https://www.gov.wales/planning-permission-external-walls',
  croydonWalls:
    'https://www.croydon.gov.uk/household-retrofit-guidance-private-properties/Insulating%20your%20property/external-walls',
  lbca1990: 'https://www.legislation.gov.uk/ukpga/1990/9/section/7',
  adL2021:
    'https://assets.publishing.service.gov.uk/media/662a2e3e55e1582b6ca7e592/Approved_Document_L__Conservation_of_fuel_and_power__Volume_1_Dwellings__2021_edition_incorporating_2023_amendments.pdf',
  adL2026: 'https://assets.publishing.service.gov.uk/media/69c122a6cfa346b9d4704a55/ADL1_2026.pdf',
  adF2021: 'https://assets.publishing.service.gov.uk/media/61deba42d3bf7f054fcc243d/ADF1.pdf',
  partOFaq: 'https://www.gov.uk/guidance/approved-document-o-overheating-frequently-asked-questions',
  ena: 'https://www.energynetworks.org/',
  pas2035: 'https://www.bsigroup.com/en-GB/standards/pas-2035/',
  bus: 'https://www.ofgem.gov.uk/environmental-and-social-schemes/boiler-upgrade-scheme-bus/installers',
  prsRegs: 'https://www.legislation.gov.uk/uksi/2015/962',
  mees2026:
    'https://www.gov.uk/government/consultations/improving-the-energy-performance-of-privately-rented-homes-2025-update/outcome/improving-the-energy-performance-of-privately-rented-homes-government-response-html',
} as const;
