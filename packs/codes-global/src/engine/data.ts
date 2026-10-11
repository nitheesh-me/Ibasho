/**
 * Global and UK code data (WP-19): Approved Document L 2021 (notional buildings, limiting fabric
 * values), the Future Homes and Buildings Standard 2025 notional, Approved Document O simplified
 * method, the London Plan 2021 energy hierarchy, and ASHRAE 90.1-2022 Appendix G baseline rules
 * (envelope from Tables G3.4 to G3.9, lighting from the 90.1-2004 building area method, WWR cap,
 * building performance factors). Values are `estimate` unless marked; see the README table.
 */
import type { EnergyParams, Grade, SourceRef } from '@ibasho/core';

const ref = (id: string, title: string, url: string): SourceRef => ({
  id,
  title,
  url,
  retrieved: '2026-10-11',
});

export const SOURCES_GLOBAL = {
  adl2021: ref(
    'ad-l-2021',
    'HM Government, Approved Document L 2021 (volumes 1 and 2)',
    'https://www.gov.uk/government/publications/conservation-of-fuel-and-power-approved-document-l',
  ),
  fhs2025: ref(
    'fhs-2025',
    'DESNZ and MHCLG, Future Homes and Buildings Standards (2025 consultation outcome)',
    'https://www.gov.uk/government/consultations/the-future-homes-and-buildings-standards-2023-consultation',
  ),
  ado2021: ref(
    'ad-o-2021',
    'HM Government, Approved Document O 2021 (overheating), simplified method',
    'https://www.gov.uk/government/publications/overheating-approved-document-o',
  ),
  londonPlan: ref(
    'london-plan-2021',
    'Greater London Authority, The London Plan 2021, Policy SI 2',
    'https://www.london.gov.uk/programmes-strategies/planning/london-plan/the-london-plan-2021-table-contents',
  ),
  ashrae901: ref(
    'ashrae-90-1-2022',
    'ASHRAE 90.1-2022, Appendix G Performance Rating Method',
    'https://www.ashrae.org/technical-resources/bookstore/standard-90-1',
  ),
} as const;

export interface Limit<T = number> {
  value: T;
  clause: string;
  source: SourceRef;
  grade: Grade;
}
const L = <T>(value: T, clause: string, source: SourceRef, grade: Grade = 'estimate'): Limit<T> => ({
  value,
  clause,
  source,
  grade,
});

export const CODES_UK = {
  /** Part L 2021 notional buildings (gas boiler heating as in the 2021 notional). */
  notionalDwelling: L<EnergyParams>(
    { uWall: 0.18, uRoof: 0.11, uWin: 1.2, shgc: 0.5, lpdScale: 0.8 },
    'AD L 2021 vol 1, notional dwelling',
    SOURCES_GLOBAL.adl2021,
  ),
  notionalNonDom: L<EnergyParams>(
    { uWall: 0.26, uRoof: 0.18, uWin: 1.6, shgc: 0.4, lpdScale: 0.8 },
    'AD L 2021 vol 2, notional building',
    SOURCES_GLOBAL.adl2021,
  ),
  /** Limiting (backstop) U-values, W/m²K. */
  limitingDwelling: L(
    { wall: 0.26, roof: 0.16, window: 1.6 },
    'AD L 2021 vol 1 Table 4.1: limiting U-values, new dwellings',
    SOURCES_GLOBAL.adl2021,
  ),
  limitingNonDom: L(
    { wall: 0.35, roof: 0.18, window: 1.6 },
    'AD L 2021 vol 2 Table 4.1: limiting U-values, new buildings other than dwellings',
    SOURCES_GLOBAL.adl2021,
  ),
  /** Future Homes and Buildings Standard notional: 2021 fabric or better and a heat pump. */
  fhsNotional: L<EnergyParams>(
    { uWall: 0.18, uRoof: 0.11, uWin: 1.2, shgc: 0.5, lpdScale: 0.7, heatPumpScop: 2.8 },
    'Future Homes Standard notional: heat pump, no fossil fuel heating',
    SOURCES_GLOBAL.fhs2025,
    'announced',
  ),
  /** AD O simplified method, Table 1.1: max glazing share of floor area for the most glazed facade (%). */
  partO: L(
    { high: { lo: 15, hi: 18 }, moderate: { lo: 18, hi: 25 } },
    'AD O 2021 simplified method Table 1.1 (without, with cross ventilation)',
    SOURCES_GLOBAL.ado2021,
  ),
  londonPlan: {
    onSiteSaving: L(
      35,
      'London Plan SI 2: at least 35% on-site carbon reduction beyond Part L 2021 for major developments',
      SOURCES_GLOBAL.londonPlan,
      'primary',
    ),
    beLeanDwelling: L(
      10,
      'London Plan SI 2 Be Lean: at least 10% from energy efficiency, homes',
      SOURCES_GLOBAL.londonPlan,
      'primary',
    ),
    beLeanNonDom: L(
      15,
      'London Plan SI 2 Be Lean: at least 15% from energy efficiency, non-residential',
      SOURCES_GLOBAL.londonPlan,
      'primary',
    ),
    majorGiaM2: 1000,
    majorHomes: 10,
  },
  /** Carbon factors for the comparison, g CO2e per kWh (SAP 10.2). */
  carbon: L(
    { electricity: 136, gas: 210 },
    'SAP 10.2 Table 12 carbon factors (electricity 0.136, gas 0.210 kg/kWh)',
    SOURCES_GLOBAL.adl2021,
    'secondary',
  ),
} as const;

/** ASHRAE 90.1 Appendix G baseline by ASHRAE climate zone group (Hyderabad 0B/1, London 4A). */
export const ASHRAE_APPG = {
  envelope: {
    hot: L<EnergyParams>(
      { uWall: 0.7, uRoof: 0.36, uWin: 6.93, shgc: 0.25, roofAbsorptance: 0.7 },
      '90.1 App G Tables G3.4: zones 0 to 1 (steel framed wall U-0.124, roof U-0.063, glazing U-1.22, SHGC 0.25 in IP)',
      SOURCES_GLOBAL.ashrae901,
    ),
    mixed: L<EnergyParams>(
      { uWall: 0.7, uRoof: 0.36, uWin: 3.24, shgc: 0.39, roofAbsorptance: 0.7 },
      '90.1 App G Table G3.7: zone 4A (glazing U-0.57, SHGC 0.39 in IP)',
      SOURCES_GLOBAL.ashrae901,
    ),
  },
  /** 90.1-2004 building area method LPD, W/m², by Ibasho type. */
  lpd: L<Record<string, number>>(
    {
      office: 10.8,
      education: 12.9,
      hotel: 10.8,
      hospital: 12.9,
      lab: 15.1,
      apartments: 7.5,
      rental: 7.5,
      'single-family': 7.5,
    },
    '90.1 App G Table G3.1 item 6: 90.1-2004 lighting power',
    SOURCES_GLOBAL.ashrae901,
  ),
  wwrCap: L(
    0.4,
    '90.1 App G Table G3.1 item 5: baseline WWR equal to the proposed, at most 40%',
    SOURCES_GLOBAL.ashrae901,
  ),
  /** Building performance factor, Table 4.2.1.1, zones 0B to 1B (and 4A in brackets in the clause). */
  bpf: L<Record<string, number>>(
    {
      office: 0.5,
      education: 0.4,
      hotel: 0.55,
      hospital: 0.6,
      lab: 0.5,
      apartments: 0.7,
      rental: 0.7,
      'single-family': 0.7,
    },
    '90.1-2022 Table 4.2.1.1: building performance factor by type',
    SOURCES_GLOBAL.ashrae901,
  ),
} as const;
