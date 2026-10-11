/**
 * Indian code thresholds (WP-19): ECSBC 2024 (commercial, with the ECBC 2017 values it keeps until
 * the final tables are read), Eco Niwas Samhita 2018 (residential envelope), NBC 2016 openings,
 * TSECBC 2014 scope (Telangana) and the 2026 Ministry of Power draft rating rule. Composite climate
 * (Hyderabad). Every value carries its clause, source and grade; `estimate` values must be checked
 * against the code text before they are relied on (docs/research/v3/energy-codes.md, section 3).
 */
import type { CodeEdition, Grade, SourceRef } from '@ibasho/core';

const ref = (id: string, title: string, url: string): SourceRef => ({
  id,
  title,
  url,
  retrieved: '2026-10-11',
});

export const SOURCES_IN = {
  ecbc2017: ref(
    'bee-ecbc-2017',
    'BEE, Energy Conservation Building Code 2017',
    'https://beeindia.gov.in/en/programmes/energy-conservation-building-code-ecbc',
  ),
  ecsbc2024: ref(
    'bee-ecsbc-2024',
    'BEE, Draft ECSBC 2024, commercial buildings',
    'https://beeindia.gov.in/sites/default/files/2024-01/Draft%20ECSBC%20-%20Commercial%20office%20buildings_0.pdf',
  ),
  ens2018: ref(
    'bee-ens-2018',
    'BEE, Eco Niwas Samhita 2018 Part I (building envelope)',
    'https://beeindia.gov.in/sites/default/files/ENS%202024_Buildign%20Code%20for%20Residential%20Buildings.pdf',
  ),
  nbc2016: ref(
    'bis-nbc-2016',
    'BIS, National Building Code of India 2016, Parts 3 and 8',
    'https://www.bis.gov.in/standards/technical-department/national-building-code/',
  ),
  tsecbc: ref(
    'ghmc-tsecbc-faq',
    'GHMC and NRDC, FAQs: online compliance system for ECBC, Hyderabad (2017)',
    'https://www.ghmc.gov.in/Townplanning_Reports/TSECBCFAQs.pdf',
  ),
  mop2026: ref(
    'mop-2026-draft',
    'Ministry of Power, draft notification on mandatory building rating (June 2026)',
    'https://powermin.gov.in/static/uploads/2026/07/f981ac1fc7a15c1136606ec2cd1979ca.pdf',
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

/** Three tier values: ECSBC, ECSBC Plus, Super ECSBC. */
export type Tiers = [number, number, number];

export const ECSBC_EDITIONS: CodeEdition[] = [
  { code: 'ECBC', edition: '2007', effectiveFrom: '2007-05-27', effectiveTo: '2017-06-18', adopted: 'yes' },
  {
    code: 'ECBC',
    edition: '2017',
    effectiveFrom: '2017-06-19',
    effectiveTo: '2024-09-26',
    adopted: 'unconfirmed',
  },
  { code: 'ECSBC', edition: '2024', effectiveFrom: '2024-09-27', adopted: 'unconfirmed' },
];

export const CODES_IN = {
  scope: {
    connectedLoadKw: L(
      100,
      'ECSBC 2024 / ECBC 2017 scope: connected load 100 kW or more',
      SOURCES_IN.ecsbc2024,
      'secondary',
    ),
    contractDemandKva: L(
      120,
      'ECSBC 2024 / ECBC 2017 scope: contract demand 120 kVA or more',
      SOURCES_IN.ecsbc2024,
      'secondary',
    ),
    tsecbcBuaM2: L(
      2000,
      'TSECBC 2014 (G.O. Ms. 30): non-residential, built-up area over 2,000 m² or plot over 1,000 m²',
      SOURCES_IN.tsecbc,
      'primary',
    ),
    mopBuaM2: L(
      20_000,
      'MoP draft rule 2026: rating required at 20,000 m² built-up area or more (draft)',
      SOURCES_IN.mop2026,
      'primary',
    ),
  },
  envelope: {
    wwrMax: L(
      0.4,
      'ECBC 2017 4.3.3: window to wall ratio at most 40% (prescriptive path)',
      SOURCES_IN.ecbc2017,
    ),
    roofU: L<Tiers>(
      [0.33, 0.26, 0.2],
      'ECBC 2017 4.3.1: roof U, daytime use, composite (W/m²K)',
      SOURCES_IN.ecbc2017,
    ),
    roofU24h: L<Tiers>([0.2, 0.2, 0.2], 'ECBC 2017 4.3.1: roof U, 24 hour use (W/m²K)', SOURCES_IN.ecbc2017),
    wallU: L<Tiers>(
      [0.4, 0.34, 0.22],
      'ECBC 2017 4.3.2: opaque wall U, composite (W/m²K)',
      SOURCES_IN.ecbc2017,
    ),
    windowU: L<Tiers>(
      [3.0, 2.2, 2.2],
      'ECBC 2017 4.3.3: vertical fenestration U (W/m²K)',
      SOURCES_IN.ecbc2017,
    ),
    shgcMax: L<Tiers>([0.27, 0.25, 0.25], 'ECBC 2017 4.3.3: SHGC, non-north facades', SOURCES_IN.ecbc2017),
    shgcNorthMax: L(
      0.5,
      'ECBC 2017 4.3.3: SHGC on north facades, latitude 15 N or more',
      SOURCES_IN.ecbc2017,
    ),
    coolRoofReflectance: L(
      0.6,
      'ECBC 2017 4.3.1.1: cool roof initial solar reflectance at least 0.60',
      SOURCES_IN.ecbc2017,
    ),
  },
  /** Building area method LPD, W/m², by Ibasho building type (ECSBC, Plus, Super). */
  lpd: {
    office: L<Tiers>([9.5, 7.6, 5.0], 'ECBC 2017 6.3.2, office', SOURCES_IN.ecbc2017),
    education: L<Tiers>([11.2, 9.0, 6.0], 'ECBC 2017 6.3.2, school or university', SOURCES_IN.ecbc2017),
    hotel: L<Tiers>([9.5, 7.6, 5.0], 'ECBC 2017 6.3.2, hotel', SOURCES_IN.ecbc2017),
    hospital: L<Tiers>([9.7, 7.8, 4.9], 'ECBC 2017 6.3.2, hospital', SOURCES_IN.ecbc2017),
    lab: L<Tiers>(
      [9.5, 7.6, 5.0],
      'ECBC 2017 6.3.2, office class used for laboratories',
      SOURCES_IN.ecbc2017,
    ),
  } as Record<string, Limit<Tiers>>,
  daylightShare: L<Tiers>(
    [40, 50, 60],
    'ECBC 2017 4.2.3: share of floor area with UDI 100 to 2,000 lux for 90% of daylit hours (%)',
    SOURCES_IN.ecbc2017,
  ),
  renewableShare: L<Tiers>(
    [0, 0.075, 0.15],
    'ECSBC 2024: on-site renewables as a share of contract demand (Plus 7.5%, Super 15%)',
    SOURCES_IN.ecsbc2024,
    'secondary',
  ),
  /** Whole building performance: EPI ratio to the standard design (ECSBC 1, Plus, Super). */
  epiRatio: L<Tiers>(
    [1, 0.85, 0.7],
    'ECBC 2017 chapter 9 / ECSBC 2024: EPI ratio to the standard design',
    SOURCES_IN.ecbc2017,
  ),
  /** The standard design the ratio is taken against (prescriptive values of the ECSBC tier). */
  standardDesign: {
    uWall: 0.4,
    uRoof: 0.33,
    uWin: 3.0,
    shgc: 0.27,
    roofAbsorptance: 0.4,
  },
  ens: {
    retvMax: L(15, 'ENS 2018 3.1: RETV at most 15 W/m², all climates but cold', SOURCES_IN.ens2018),
    coeff: L(
      { a: 6.06, b: 1.85, c: 68.99 },
      'ENS 2018 3.1: RETV coefficients, composite',
      SOURCES_IN.ens2018,
    ),
    /** Orientation factor omega, latitude below 23.5 N, by facade bin. */
    omega: L<Record<string, number>>(
      { N: 0.659, NE: 0.906, E: 1.155, SE: 1.125, S: 0.966, SW: 1.124, W: 1.156, NW: 0.908 },
      'ENS 2018 Table 3: orientation factors, latitude below 23.5 N',
      SOURCES_IN.ens2018,
    ),
    roofU: L(1.2, 'ENS 2018 3.3: roof U at most 1.2 W/m²K', SOURCES_IN.ens2018),
    wfrOp: L(
      0.125,
      'ENS 2018 4.1: openable window to floor area at least 12.5% (composite)',
      SOURCES_IN.ens2018,
    ),
    /** Assumed openable share of a window when not drawn (casements and sliders). */
    openableShare: { lo: 0.5, hi: 0.8 },
  },
  nbc: {
    openingRatio: L(
      0.1,
      'NBC 2016 Parts 3 and 8: openings at least one tenth of a habitable room floor area',
      SOURCES_IN.nbc2016,
    ),
  },
  /** GHMC star bands (primary): savings against the standard design, 1 to 6 stars. */
  ghmcStars: L(
    [5, 10, 15, 20, 25, 30],
    'GHMC TSECBC FAQ Q7: 1 star at prescriptive or up to 5%, then 10 to 30% for 2 to 6 stars',
    SOURCES_IN.tsecbc,
    'primary',
  ),
} as const;
