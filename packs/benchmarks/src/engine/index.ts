/**
 * EUI benchmarks (WP-18): BEE star bands for India, CBECS 2018 site EUI medians (US, as a cross
 * check) and CIBSE TM46 typical values for the UK. kWh/m²·yr on site energy. Bands and medians
 * are as published to the nearest whole number; grades say how firm each is.
 */
import type { BenchmarkPlugin, Grade, IbashoModule, Sourced, SourceRef } from '@ibasho/core';

const src = (id: string, title: string, url: string, clause?: string): SourceRef => ({
  id,
  title,
  url,
  ...(clause ? { clause } : {}),
  retrieved: '2026-10-11',
});
const BEE = src(
  'bee-star-commercial',
  'BEE star labelling for commercial buildings (composite climate bands)',
  'https://beeindia.gov.in',
);
const CBECS = src(
  'cbecs-2018',
  'US EIA, Commercial Buildings Energy Consumption Survey 2018, Table C1 site EUI',
  'https://www.eia.gov/consumption/commercial/',
);
const TM46 = src('cibse-tm46', 'CIBSE TM46 Energy benchmarks (2008)', 'https://www.cibse.org');
const ENS = src(
  'ens-2018',
  'BEE Eco Niwas Samhita 2018 and BT brief, Indian apartments',
  'https://beeindia.gov.in',
);

const S = (low: number, typical: number, high: number, source: SourceRef, grade: Grade): Sourced => ({
  low,
  typical,
  high,
  source,
  grade,
});
const prov = (source: SourceRef, grade: Grade) => ({
  sources: [source],
  lastChecked: '2026-10-11' as const,
  grade,
});
/** kBtu/ft2 to kWh/m2. */
const k = (kbtu: number) => Math.round(kbtu * 3.1546);

const B = (
  benchmarkId: string,
  scheme: BenchmarkPlugin['scheme'],
  typeIds: BenchmarkPlugin['typeIds'],
  source: SourceRef,
  grade: Grade,
  x: Pick<BenchmarkPlugin, 'median' | 'bands'>,
): BenchmarkPlugin => ({
  kind: 'benchmark',
  id: `benchmark-${benchmarkId}`,
  version: '0.1.0',
  title: `benchmarks.${benchmarkId}`,
  side: 'both',
  provenance: prov(source, grade),
  benchmarkId,
  scheme,
  typeIds,
  basis: 'site',
  ...x,
});

export const BENCHMARKS: BenchmarkPlugin[] = [
  B('bee-office-composite', 'bee-star', ['office'], BEE, 'estimate', {
    bands: [
      { label: '5 star', maxKwhM2Yr: 90 },
      { label: '4 star', maxKwhM2Yr: 115 },
      { label: '3 star', maxKwhM2Yr: 140 },
      { label: '2 star', maxKwhM2Yr: 165 },
      { label: '1 star', maxKwhM2Yr: 190 },
    ],
    median: S(110, 160, 230, BEE, 'estimate'),
  }),
  B('bee-hospital-composite', 'bee-star', ['hospital'], BEE, 'estimate', {
    median: S(250, 350, 500, BEE, 'estimate'),
  }),
  B('cbecs-office', 'energy-star', ['office'], CBECS, 'secondary', {
    median: S(k(35), k(52.9), k(80), CBECS, 'secondary'),
  }),
  B('cbecs-education', 'energy-star', ['education'], CBECS, 'secondary', {
    median: S(k(30), k(48.5), k(75), CBECS, 'secondary'),
  }),
  B('cbecs-hotel', 'energy-star', ['hotel'], CBECS, 'secondary', {
    median: S(k(45), k(63), k(100), CBECS, 'secondary'),
  }),
  B('cbecs-hospital', 'energy-star', ['hospital'], CBECS, 'secondary', {
    median: S(k(150), k(234), k(320), CBECS, 'secondary'),
  }),
  B('cbecs-lab', 'energy-star', ['lab'], CBECS, 'estimate', {
    median: S(k(150), k(250), k(400), CBECS, 'estimate'),
  }),
  B('ens-apartments', 'ecbc', ['apartments', 'rental', 'single-family'], ENS, 'estimate', {
    median: S(25, 45, 80, ENS, 'estimate'),
  }),
  B('tm46-office', 'cibse-tm46', ['office'], TM46, 'secondary', {
    median: S(150, 215, 300, TM46, 'secondary'),
  }),
  B('tm46-dwelling', 'cibse-tm46', ['single-family'], TM46, 'estimate', {
    median: S(100, 150, 230, TM46, 'estimate'),
  }),
];

export const benchmarksEngineModule: IbashoModule = {
  id: 'pack-benchmarks/engine',
  load: () => [...BENCHMARKS],
};
