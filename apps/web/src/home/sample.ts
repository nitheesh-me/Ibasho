/**
 * Homes on the stage (SPEC 2, 4). Owner: WP-08.
 *
 * A `HomeEntry` is what the stage needs to run a home: the twin, the owner context and the date.
 * Samples are served read-only at `/app/home/:id`; a person's own home comes from onboarding
 * (`homeFromTwin`). M-0 has one sample: GH1. The twin is the WP-01 golden fixture, parsed through
 * the core schema like any untrusted input. It is imported by relative path because
 * `@ibasho/fixtures` has no index (per-owner folders) and `apps/web` does not depend on it.
 */
import type { HomeTwin, IsoDate, OwnerCtx, SearchRequest } from '@ibasho/core';
import { parseTwin } from '@ibasho/core/schemas';
import gh1Json from '../../../../packages/fixtures/src/homes/gh1.twin.json' with { type: 'json' };

export interface HomeEntry {
  id: string;
  name: string;
  place: string;
  twin: HomeTwin;
  owner: OwnerCtx;
  /**
   * The sample is pinned to one date so its result hash is the same on every device and equals
   * the committed engine fixture (M0-6). A person's own home uses today.
   */
  asOf: IsoDate;
  /** True for a read-only sample home. */
  sample: boolean;
}
/** @deprecated M-0 name; use `HomeEntry`. */
export type SampleHome = HomeEntry;

const SAMPLES: Record<string, () => HomeEntry> = {
  gh1: () => ({
    id: 'gh1',
    name: 'A semi built between the wars',
    place: 'London',
    twin: parseTwin(gh1Json),
    owner: { tenure: 'owner', discountRatePpb: 35_000_000n, horizonYears: 25 },
    asOf: '2026-10-11',
    sample: true,
  }),
};

export const SAMPLE_IDS: readonly string[] = Object.keys(SAMPLES);
export const isSampleId = (id: string): boolean => Object.hasOwn(SAMPLES, id);

export function sampleHome(id: string): HomeEntry | undefined {
  return isSampleId(id) ? SAMPLES[id]?.() : undefined;
}

/** Discount rate for a person's own home: 3.5% (HM Treasury Green Book), in parts per billion. */
export const DEFAULT_DISCOUNT_PPB = 35_000_000n;
export const DEFAULT_HORIZON_YEARS = 25;

/** Local date as `YYYY-MM-DD` (a person's own home is valued as of today). */
export function today(now: Date = new Date()): IsoDate {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}` as IsoDate;
}

/** A person's own home from its twin. Tenure comes from the twin; money settings are defaults. */
export function homeFromTwin(twin: HomeTwin, name: string, asOf: IsoDate = today()): HomeEntry {
  const tenure = twin.legal.tenure.state === 'unknown' ? 'unknown' : twin.legal.tenure.value;
  return {
    id: twin.id,
    name,
    place: twin.location.district ?? 'the UK',
    twin,
    owner: { tenure, discountRatePpb: DEFAULT_DISCOUNT_PPB, horizonYears: DEFAULT_HORIZON_YEARS },
    asOf,
    sample: false,
  };
}

export function searchRequest(home: HomeEntry, rejected: string[] = []): SearchRequest {
  return {
    twin: home.twin,
    owner: home.owner,
    target: { kind: 'default' },
    memory: { rejected, completed: [] },
    asOf: home.asOf,
  };
}
