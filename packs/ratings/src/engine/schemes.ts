/**
 * Rating ladders (WP-19, SPEC 23, R36): step tables from a percentage to points or levels. Pure data
 * `rating-scheme` plugins, checked at registration (ascending, points non-decreasing). The real
 * codes stage reads savings against the right baseline for each (ECSBC standard design, ASHRAE 90.1
 * Appendix G). Estimates of points, never a certification.
 */
import type { Grade, RatingSchemePlugin, RatingStep, SourceRef } from '@ibasho/core';

const ref = (id: string, title: string, url: string): SourceRef => ({
  id,
  title,
  url,
  retrieved: '2026-10-11',
});
const S = {
  ghmc: ref(
    'ghmc-tsecbc-faq',
    'GHMC and NRDC, TSECBC FAQs (2017), Q7 star bands',
    'https://www.ghmc.gov.in/Townplanning_Reports/TSECBCFAQs.pdf',
  ),
  leed41: ref(
    'leeduser-v41-eac',
    'LEEDuser, LEED v4.1 BD+C Optimize Energy Performance tables',
    'https://leeduser.buildinggreen.com/taxonomy/term/4929',
  ),
  leed5: ref(
    'leed-v5-bdc',
    'USGBC LEED v5 BD+C, Enhanced Energy Efficiency (summary)',
    'https://www.usgbc.org/leed-v5',
  ),
  leedWe: ref(
    'leed-v41-we',
    'USGBC LEED v4.1 BD+C, Indoor Water Use Reduction',
    'https://www.usgbc.org/leed/v41',
  ),
  igbc: ref('igbc-gnb-v3', 'IGBC Green New Buildings rating system v3, energy credit', 'https://igbc.in/'),
  griha: ref('griha-v2019', 'GRIHA v2019, energy optimisation criterion', 'https://www.grihaindia.org/'),
  edge: ref('ifc-edge-v3', 'IFC EDGE v3, certification levels', 'https://edgebuildings.com/certify/'),
  bee: ref(
    'bee-star-office',
    'BEE star labelling for existing office buildings (composite, fully air conditioned)',
    'https://beeindia.gov.in/en/programmes/energy-efficiency-in-buildings',
  ),
};

const steps = (
  thresholds: number[],
  points: (i: number) => number,
  level: (i: number) => string,
): RatingStep[] => thresholds.map((t, i) => ({ atLeast: t, points: points(i), level: level(i) }));

function scheme(
  id: string,
  scheme: RatingSchemePlugin['scheme'],
  edition: string,
  metric: RatingSchemePlugin['metric'],
  st: RatingStep[],
  source: SourceRef,
  grade: Grade,
  prerequisites?: string[],
): RatingSchemePlugin {
  return {
    kind: 'rating-scheme',
    id,
    version: '0.1.0',
    title: `ratings.${id}`,
    side: 'both',
    provenance: { sources: [source], lastChecked: '2026-10-11', grade },
    scheme,
    edition,
    metric,
    steps: st,
    ...(prerequisites ? { prerequisites } : {}),
    disclaimer: 'ratings.disclaimer.estimate',
  };
}

/** GHMC stars: savings against the ECSBC standard design, %. */
export const GHMC_STARS = scheme(
  'ratings.ghmc-stars',
  'GHMC-stars',
  'TSECBC 2014',
  'savings.pct',
  steps(
    [5, 10, 15, 20, 25, 30],
    (i) => i + 1,
    (i) => `${i + 1} star`,
  ),
  S.ghmc,
  'primary',
);
/** LEED v4.1 EA Optimize Energy Performance, cost table: improvement below PCIt, %. */
export const LEED41_COST = scheme(
  'ratings.leed41-ea-cost',
  'LEED',
  'v4.1 EAc cost',
  'savings.pct',
  steps(
    [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
    (i) => i + 1,
    (i) => `${i + 1} points (cost)`,
  ),
  S.leed41,
  'secondary',
  ['GL.A90.PRM'],
);
/** LEED v4.1 EA Optimize Energy Performance, GHG table, %. */
export const LEED41_GHG = scheme(
  'ratings.leed41-ea-ghg',
  'LEED',
  'v4.1 EAc GHG',
  'savings.pct',
  steps(
    [5, 10, 15, 20, 30, 40, 50, 60, 70, 80],
    (i) => i + 1,
    (i) => `${i + 1} points (GHG)`,
  ),
  S.leed41,
  'estimate',
);
/** LEED v5 Enhanced Energy Efficiency: improvement on the 90.1 baseline, %. */
export const LEED5_EEE = scheme(
  'ratings.leed5-eee',
  'LEED',
  'v5 Enhanced Energy Efficiency',
  'savings.pct',
  steps(
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    (i) => i + 1,
    (i) => `${i + 1} points`,
  ),
  S.leed5,
  'secondary',
);
/** LEED v4.1 WE Indoor Water Use Reduction (credit beyond the 20% prerequisite), %. */
export const LEED41_WE = scheme(
  'ratings.leed41-we-indoor',
  'LEED',
  'v4.1 WEc indoor',
  'water.in.pct',
  steps(
    [25, 30, 35, 40, 45, 50],
    (i) => i + 1,
    (i) => `${i + 1} points`,
  ),
  S.leedWe,
  'estimate',
);
/** IGBC energy credit: savings on the baseline, %. */
export const IGBC_ENERGY = scheme(
  'ratings.igbc-energy',
  'IGBC',
  'Green New Buildings v3 energy',
  'savings.pct',
  steps(
    [10, 15, 20, 25, 30, 35, 40],
    (i) => i + 2,
    (i) => `${i + 2} points`,
  ),
  S.igbc,
  'estimate',
);
/** GRIHA energy optimisation: EPI reduction on the benchmark, %. */
export const GRIHA_ENERGY = scheme(
  'ratings.griha-energy',
  'GRIHA',
  'v2019 energy optimisation',
  'savings.pct',
  steps(
    [10, 15, 20, 25, 30, 40, 50],
    (i) => i + 1,
    (i) => `${i + 1} points`,
  ),
  S.griha,
  'estimate',
);
/** EDGE energy: savings on the local baseline, % (water and materials need their own 20%). */
export const EDGE_ENERGY = scheme(
  'ratings.edge-energy',
  'EDGE',
  'v3 energy',
  'savings.pct',
  [
    { atLeast: 20, points: 1, level: 'EDGE Certified (energy part)' },
    { atLeast: 40, points: 2, level: 'EDGE Advanced (energy part)' },
  ],
  S.edge,
  'secondary',
);
/** BEE star label, offices: headroom below 190 kWh/m²·yr built-up EPI (1 star at 190, a star per 25). */
export const BEE_STAR_OFFICE = scheme(
  'ratings.bee-star-office',
  'BEE-star',
  'existing offices, composite, fully air conditioned',
  'epi',
  steps(
    [0, 25, 50, 75, 100],
    (i) => i + 1,
    (i) => `${i + 1} star`,
  ),
  S.bee,
  'estimate',
);

export const RATING_SCHEMES: readonly RatingSchemePlugin[] = [
  GHMC_STARS,
  LEED41_COST,
  LEED41_GHG,
  LEED5_EEE,
  LEED41_WE,
  IGBC_ENERGY,
  GRIHA_ENERGY,
  EDGE_ENERGY,
  BEE_STAR_OFFICE,
];
