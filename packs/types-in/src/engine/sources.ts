/** Sources cited by the Indian type pack (WP-18). Grades say how firm each value is. */
import type { SourceRef } from '@ibasho/core';

const r = (id: string, title: string, url?: string, clause?: string): SourceRef => ({
  id,
  title,
  ...(url ? { url } : {}),
  ...(clause ? { clause } : {}),
  retrieved: '2026-10-11',
});

export const SRC = {
  ecbc: r('ecbc-2017', 'BEE, Energy Conservation Building Code 2017 (Rev 2)', 'https://beeindia.gov.in', 'Appendix: default schedules, Table 6-2 LPD'),
  ecsbc: r('ecsbc-2024', 'BEE, Energy Conservation and Sustainable Building Code 2024', 'https://beeindia.gov.in', 'Appendix: standard design inputs'),
  ashrae621: r('ashrae-62.1-2022', 'ASHRAE 62.1-2022 Ventilation for Acceptable Indoor Air Quality', 'https://www.ashrae.org', 'Table 6-1 Rp and Ra'),
  nbc: r('nbc-2016', 'BIS, National Building Code of India 2016', 'https://bis.gov.in', 'Part 4 Table 3 occupant load; Part 8 ventilation'),
  ens: r('ens-2018', 'BEE, Eco Niwas Samhita 2018 (residential)', 'https://beeindia.gov.in'),
  imac: r('imac-2016', 'Manu et al., India Model for Adaptive Comfort (IMAC), Building and Environment 2016', 'https://doi.org/10.1016/j.buildenv.2015.12.021'),
  bee: r('bee-star', 'BEE star rating benchmarks for commercial buildings (offices, hospitals, BPOs)', 'https://beeindia.gov.in'),
  brief: r('ibasho-bt', 'Ibasho brief BT (building types and EUI), docs/research/v3/building-types-eui.md'),
} as const;

export const PROV = {
  sources: [SRC.ecbc, SRC.ashrae621, SRC.nbc, SRC.brief],
  lastChecked: '2026-10-11' as const,
  grade: 'estimate' as const,
};
