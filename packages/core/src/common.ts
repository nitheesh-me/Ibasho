/**
 * Shared primitive types (ARCH 4.1). Owner: WP-00.
 */

/** Calendar date `YYYY-MM-DD`. */
export type IsoDate = `${number}-${number}-${number}`;
/** Semantic version `MAJOR.MINOR.PATCH`. */
export type SemVer = `${number}.${number}.${number}`;
/** `US` and `EU` (v3) carry ASHRAE 90.1, IECC and EPBD context rules. */
export type RegionCode =
  | 'GB'
  | 'GB-ENG'
  | 'GB-WLS'
  | 'GB-SCT'
  | 'IN'
  | 'IN-TG'
  | 'IN-DL'
  | 'IN-MH'
  | 'US'
  | 'EU';
export const REGION_CODES: readonly RegionCode[] = [
  'GB',
  'GB-ENG',
  'GB-WLS',
  'GB-SCT',
  'IN',
  'IN-TG',
  'IN-DL',
  'IN-MH',
  'US',
  'EU',
];
/** Evidence grade of a source (R17: `estimate` and `announced` show a badge). */
export type Grade = 'primary' | 'secondary' | 'announced' | 'estimate';
export const GRADES: readonly Grade[] = ['primary', 'secondary', 'announced', 'estimate'];

export interface SourceRef {
  id: string;
  title: string;
  url?: string;
  clause?: string;
  retrieved: IsoDate;
}
export interface Provenance {
  sources: SourceRef[];
  lastChecked: IsoDate;
  grade: Grade;
}

/** ICU message key, namespaced per package (`ui.futures.title`). */
export type MessageKey = string;

/** The three run modes (SPEC R3). */
export type RunMode = 'rating' | 'standard' | 'your-home';
export const RUN_MODES: readonly RunMode[] = ['rating', 'standard', 'your-home'];

/** Twelve monthly values, January first. */
export type Monthly<T> = readonly [T, T, T, T, T, T, T, T, T, T, T, T];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** True when `s` is a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(s: string): s is IsoDate {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1] ?? 0;
  return d <= days;
}

export function isSemVer(s: string): s is SemVer {
  return SEMVER.test(s);
}

/** Region containment: `GB` contains `GB-ENG`; a region contains itself. */
export function regionContains(outer: RegionCode, inner: RegionCode): boolean {
  return outer === inner || inner.startsWith(`${outer}-`);
}

/** Plain code-unit string comparison, identical in every JS engine (never `localeCompare`). */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
