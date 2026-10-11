/**
 * Stage providers, jobs and the studio worker API (ARCH 15.4, 15.5, SPEC 19, R26).
 * Owner: WP-00 (contract); WP-13 writes the Preview providers, WP-14, WP-16, WP-18, WP-19 and
 * WP-20 the real ones, WP-08 the `StudioClient`, WP-06 the `StageBar`.
 *
 * Preview and real providers of a stage share this contract exactly: swapping is one line in
 * `apps/web/src/manifest.ts` (AC-PG4).
 */

import type { AbortSignalLike } from '../ai/provider.ts';
import type { EngineApi } from '../api.ts';
import type { IsoDate, MessageKey } from '../common.ts';
import type { PluginBase } from '../plugin/types.ts';
import type { BuildingDoc, CompiledBuilding } from './building.ts';
import type { Objective, ScopedGoal } from './goals.ts';
import type { OptimiseResult } from './optimise.ts';
import type { CityTile, Place } from './place.ts';
import type { StageId, Tier } from './provenance.ts';
import type { BaselineRow, BuildingResult, CodeRow, RatingRow } from './result.ts';
import type { Setting } from './settings.ts';
import type { Epw, Resolution, SiteResult } from './site.ts';

export type { StageId, Tier } from './provenance.ts';

/** What every stage after geometry sees about the place and its context. */
export interface SiteContext {
  place: Place;
  tiles: CityTile[];
  /** Absent: the climate pack's monthly tables apply and shading is unknown (R32). */
  epw?: Epw;
  weatherHash: string;
  /**
   * Context building ids the modelled building stands in for (a pack's `HERO_CONTEXT_IDS`):
   * site analysis skips them as blockers and the scene hides them.
   */
  replacedIds?: string[];
}

/** Stage inputs. Every input is plain data (structured-cloneable to a worker). */
export interface StageIn {
  geometry: { doc: BuildingDoc; packsFingerprint: string };
  sun: { compiled: CompiledBuilding; site: SiteContext; resolution: Resolution };
  radiation: { compiled: CompiledBuilding; site: SiteContext; resolution: Resolution; sun: SiteResult };
  daylight: { compiled: CompiledBuilding; site: SiteContext; resolution: Resolution; sun: SiteResult };
  energy: {
    compiled: CompiledBuilding;
    /** Absent: no context shading (R32). */
    radiation?: SiteResult;
    /** Place and weather; absent means the climate named by settings, else the place default. */
    site?: SiteContext;
    settings: Setting[];
    asOf: IsoDate;
  };
  codes: {
    compiled: CompiledBuilding;
    doc: BuildingDoc;
    energy: BuildingResult;
    daylight?: SiteResult;
    site?: SiteContext;
    codePackIds: string[];
    asOf: IsoDate;
  };
  optimise: {
    compiled: CompiledBuilding;
    doc: BuildingDoc;
    energy: BuildingResult;
    goals: ScopedGoal[];
    objectives: Objective[];
    /** Design space: grid ids per design axis. */
    space: { axis: string; grid: string }[];
    site?: SiteContext;
    settings?: Setting[];
    seed: string;
    asOf: IsoDate;
  };
}

/** Codes stage output: rows plus the baselines they read. */
export interface CodesOut {
  codes: CodeRow[];
  ratings: RatingRow[];
  baselines: BaselineRow[];
  /** The energy result with `codes`, `ratings` and `baselines` filled. */
  result: BuildingResult;
}

export interface StageOut {
  geometry: CompiledBuilding;
  sun: SiteResult;
  radiation: SiteResult;
  daylight: SiteResult;
  energy: BuildingResult;
  codes: CodesOut;
  optimise: OptimiseResult;
}

export interface StageEvent<S extends StageId> {
  jobId: string;
  generation: number;
  stage: S;
  /** Position on the bar, 0 to 6. */
  stageIndex: number;
  /** 0 to 1 within the stage. */
  fraction: number;
  tier: Tier;
  etaMs?: number;
  message: MessageKey;
  partial?: StageOut[S];
  final?: StageOut[S];
}
/** A stage event of any stage, discriminated on `stage`. */
export type AnyStageEvent = { [S in StageId]: StageEvent<S> }[StageId];

export interface JobCtx {
  jobId: string;
  generation: number;
  signal: AbortSignalLike;
  resolution: Resolution;
  /** Preview replay speed: recorded timings times this factor (1 on the reference laptop). */
  deviceFactor: number;
}

export interface StageProvider<S extends StageId = StageId> extends PluginBase<'stage-provider'> {
  stage: S;
  impl: 'preview' | 'real';
  run(input: StageIn[S], ctx: JobCtx): AsyncIterable<StageEvent<S>>;
}
/** A provider of any stage, discriminated on `stage` (what the registry stores). */
export type AnyStageProvider = { [S in StageId]: StageProvider<S> }[StageId];

export interface JobRequest {
  jobId: string;
  /** Per building view, increasing; a newer generation always wins (H9). */
  generation: number;
  placeId: string;
  buildingId: string;
  variantId?: string;
  /** In bar order; usually `downstreamStages(changed)`. */
  stages: StageId[];
  resolution: 'sketch' | 'standard' | 'fine';
  asOf: IsoDate;
}

export type JobEndStatus = 'done' | 'cancelled' | 'failed' | 'superseded';
export interface JobEnd {
  jobId: string;
  generation: number;
  status: JobEndStatus;
  error?: MessageKey;
}

/** Per stage state for the bar and for stale marking (WP-06 `StageBar`, WP-08). */
export type StageStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'done'
  | 'skipped'
  | 'stale'
  | 'cancelled'
  | 'failed';
export interface StageBarState {
  jobId?: string;
  generation: number;
  stages: {
    id: StageId;
    status: StageStatus;
    fraction: number;
    tier?: Tier;
    etaMs?: number;
    preview: boolean;
  }[];
  message?: MessageKey;
}

/**
 * Worker API via Comlink; extends the v2 engine API. `EngineApi.cancel(jobId)` also cancels a
 * studio job and returns within one slice (≤ 50 ms).
 */
export interface StudioApi extends EngineApi {
  runJob(
    req: JobRequest,
    onEvent: (e: AnyStageEvent) => void,
    onEnd?: (e: JobEnd) => void,
  ): Promise<{ jobId: string }>;
}
