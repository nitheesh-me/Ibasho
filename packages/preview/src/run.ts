/**
 * Preview job runner (ARCH 15.5): chains stage providers in bar order, threading each output into
 * the next stage's input, reusing `previous` outputs for stages not in the request (a tariff edit
 * starts at `energy`). `createPreviewStudio()` adds generations and cancel: a newer generation
 * for the same building cancels the older job, and its late events are dropped (H9).
 *
 * Providers default to the Preview set; pass `providers` (for example from the registry and
 * `apps/web/src/manifest.ts`) to mix real and Preview stages.
 */
import type {
  AbortSignalLike,
  AnyStageEvent,
  AnyStageProvider,
  BuildingDoc,
  CityTile,
  EnergyParams,
  JobCtx,
  JobEnd,
  JobRequest,
  Objective,
  Place,
  Resolution,
  ResolutionLevel,
  ScopedGoal,
  Setting,
  SiteContext,
  StageId,
  StageIn,
  StageOut,
} from '@ibasho/core';
import { DEFAULT_OBJECTIVES, STUDIO_STAGES } from '@ibasho/core';
import { DEFAULT_PLACE } from './compute.ts';
import { PREVIEW_PROVIDERS, PreviewCancelled } from './providers.ts';

export const RESOLUTIONS: Readonly<Record<ResolutionLevel, Resolution>> = {
  sketch: { level: 'sketch', grid: 2000, stepMin: 60, skyPatches: 145, contextRadiusM: 150 },
  standard: { level: 'standard', grid: 1000, stepMin: 15, skyPatches: 145, contextRadiusM: 300 },
  fine: { level: 'fine', grid: 500, stepMin: 6, skyPatches: 577, contextRadiusM: 500 },
};

/** What a job needs besides the request: the document, its place and context. */
export interface JobInputs {
  doc: BuildingDoc;
  place?: Place;
  tiles?: CityTile[];
  /** Context ids this building replaces (the pack's `HERO_CONTEXT_IDS[buildingId]`). */
  replacedIds?: string[];
  weatherHash?: string;
  settings?: Setting[];
  /** Design parameters for the energy stage (what-if levers); absent means as drawn. */
  energyParams?: EnergyParams;
  goals?: ScopedGoal[];
  objectives?: Objective[];
  /** Outputs of stages not rerun (from the store, keyed by stage). */
  previous?: Partial<StageOut>;
  packsFingerprint?: string;
}

/** A minimal abort controller and signal (a DOM `AbortSignal` works too). */
export class PreviewAbort implements AbortSignalLike {
  aborted = false;
  private readonly fns = new Set<() => void>();
  abort(): void {
    if (this.aborted) return;
    this.aborted = true;
    for (const f of this.fns) f();
  }
  addEventListener(_type: 'abort', f: () => void): void {
    this.fns.add(f);
  }
  removeEventListener(_type: 'abort', f: () => void): void {
    this.fns.delete(f);
  }
}

/**
 * Default replay speed: one tenth of the recorded timings, so a rough result shows within about
 * 300 ms per stage on a laptop (studio review A-M2). Pass 1 to rehearse real timings, 0 for tests.
 */
export const DEFAULT_DEVICE_FACTOR = 0.1;

export interface RunOptions {
  signal?: AbortSignalLike;
  /** Preview replay speed (1 on the reference laptop; 0 replays instantly, for tests). */
  deviceFactor?: number;
  providers?: readonly AnyStageProvider[];
}

export interface JobOutcome {
  end: JobEnd;
  outputs: Partial<StageOut>;
}

function inputFor<S extends StageId>(
  stage: S,
  req: JobRequest,
  inp: JobInputs,
  out: Partial<StageOut>,
  site: SiteContext,
  resolution: Resolution,
): StageIn[S] {
  const need = <K extends StageId>(k: K): StageOut[K] => {
    const v = out[k];
    if (v === undefined) throw new Error(`stage ${stage} needs ${k}`);
    return v as StageOut[K];
  };
  switch (stage) {
    case 'geometry':
      return { doc: inp.doc, packsFingerprint: inp.packsFingerprint ?? 'preview' } as StageIn[S];
    case 'sun':
      return { compiled: need('geometry'), site, resolution } as StageIn[S];
    case 'radiation':
    case 'daylight':
      return { compiled: need('geometry'), site, resolution, sun: need('sun') } as StageIn[S];
    case 'energy': {
      const radiation = out.radiation;
      return {
        compiled: need('geometry'),
        ...(radiation ? { radiation } : {}),
        site,
        settings: inp.settings ?? [],
        ...(inp.energyParams ? { params: inp.energyParams } : {}),
        asOf: req.asOf,
      } as StageIn[S];
    }
    case 'codes': {
      const daylight = out.daylight;
      return {
        compiled: need('geometry'),
        doc: inp.doc,
        energy: need('energy'),
        ...(daylight ? { daylight } : {}),
        site,
        codePackIds: site.place.codePackIds,
        ...(inp.goals?.length ? { goals: inp.goals } : {}),
        asOf: req.asOf,
      } as StageIn[S];
    }
    default:
      return {
        compiled: need('geometry'),
        doc: inp.doc,
        energy: out.codes?.result ?? need('energy'),
        goals: inp.goals ?? [],
        objectives: inp.objectives ?? [...DEFAULT_OBJECTIVES],
        space: [],
        site,
        settings: inp.settings ?? [],
        ...(out.radiation ? { radiation: out.radiation } : {}),
        ...(inp.energyParams ? { params: inp.energyParams } : {}),
        seed: `${req.buildingId}:${req.generation}`,
        asOf: req.asOf,
      } satisfies StageIn['optimise'] as unknown as StageIn[S];
  }
}

/** Run one job to its end; events stream through `onEvent`. Never throws. */
export async function runPreviewJob(
  req: JobRequest,
  inp: JobInputs,
  onEvent: (e: AnyStageEvent) => void,
  opts: RunOptions = {},
): Promise<JobOutcome> {
  const providers = opts.providers ?? PREVIEW_PROVIDERS;
  const signal = opts.signal ?? new PreviewAbort();
  const resolution = RESOLUTIONS[req.resolution];
  const place = inp.place ?? DEFAULT_PLACE;
  const site: SiteContext = {
    place,
    tiles: inp.tiles ?? [],
    weatherHash: inp.weatherHash ?? place.climatePackId,
    ...(inp.replacedIds ? { replacedIds: inp.replacedIds } : {}),
  };
  const outputs: Partial<StageOut> = { ...inp.previous };
  const ctx: JobCtx = {
    jobId: req.jobId,
    generation: req.generation,
    signal,
    resolution,
    deviceFactor: opts.deviceFactor ?? DEFAULT_DEVICE_FACTOR,
  };
  const wanted = new Set(req.stages);
  try {
    for (const stage of STUDIO_STAGES) {
      if (!wanted.has(stage)) continue;
      const provider = providers.find((p) => p.stage === stage);
      if (!provider) continue;
      const input = inputFor(stage, req, inp, outputs, site, resolution);
      for await (const e of (provider.run as (i: unknown, c: JobCtx) => AsyncIterable<AnyStageEvent>)(
        input,
        ctx,
      )) {
        if (signal.aborted) throw new PreviewCancelled(req.jobId);
        onEvent(e);
        if (e.final !== undefined) (outputs as Record<string, unknown>)[stage] = e.final;
      }
    }
    return { end: { jobId: req.jobId, generation: req.generation, status: 'done' }, outputs };
  } catch (err) {
    if (err instanceof PreviewCancelled || signal.aborted)
      return { end: { jobId: req.jobId, generation: req.generation, status: 'cancelled' }, outputs };
    return {
      end: { jobId: req.jobId, generation: req.generation, status: 'failed', error: 'studio.job.failed' },
      outputs,
    };
  }
}

/**
 * A small in-thread studio: `runJob` starts a job, cancelling any older job for the same
 * building, and drops events from superseded generations. Put it in the engine worker (Comlink)
 * so long stages never block the main thread (AC-PG1).
 */
export function createPreviewStudio(opts: Omit<RunOptions, 'signal'> = {}) {
  const live = new Map<string, { jobId: string; generation: number; signal: PreviewAbort }>();
  const jobs = new Map<string, PreviewAbort>();
  return {
    runJob(
      req: JobRequest,
      inp: JobInputs,
      onEvent: (e: AnyStageEvent) => void,
      onEnd?: (o: JobOutcome) => void,
    ): { jobId: string; done: Promise<JobOutcome> } {
      const prev = live.get(req.buildingId);
      // An older generation arriving late never replaces the live job (H9).
      if (prev && prev.generation > req.generation) {
        const out: JobOutcome = {
          end: { jobId: req.jobId, generation: req.generation, status: 'superseded' },
          outputs: {},
        };
        onEnd?.(out);
        return { jobId: req.jobId, done: Promise.resolve(out) };
      }
      prev?.signal.abort();
      const signal = new PreviewAbort();
      live.set(req.buildingId, { jobId: req.jobId, generation: req.generation, signal });
      jobs.set(req.jobId, signal);
      const done = runPreviewJob(
        req,
        inp,
        (e) => {
          const cur = live.get(req.buildingId);
          if (!cur || cur.generation === req.generation) onEvent(e);
        },
        { ...opts, signal },
      ).then((o) => {
        const cur = live.get(req.buildingId);
        const out =
          cur && cur.generation > req.generation
            ? { ...o, end: { ...o.end, status: 'superseded' as const } }
            : o;
        jobs.delete(req.jobId);
        onEnd?.(out);
        return out;
      });
      return { jobId: req.jobId, done };
    },
    cancel(jobId: string): void {
      const s = jobs.get(jobId);
      s?.abort();
    },
  };
}
