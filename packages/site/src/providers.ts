/**
 * The real `sun`, `radiation` and `daylight` stage providers (ARCH 15.5, SPEC 19, AC-PG4).
 * Owner: WP-16. Same `StageProvider<S>` contract as the Preview providers, `impl: 'real'`.
 *
 * Each stage runs three tiers (rough, refined, final; see `compute.ts`) and emits: fraction 0,
 * progress at most every 250 ms, the rough and refined results as `partial`, the final as
 * `final`. Work is sliced (a few dozen sensors at a time) and the provider yields to the event
 * loop every `SLICE_MS`, checking the abort signal, so a worker answers cancel within one slice.
 * Progress fractions weight the tiers by their cost (about 1/16, 1/4 and 1 of the final).
 */
import type {
  AnyStageProvider,
  JobCtx,
  StageEvent,
  StageIn,
  StageOut,
  StageProvider,
  Tier,
} from '@ibasho/core';
import { STAGE_META, stageIndex } from '@ibasho/core';
import {
  cachedDaylight,
  cachedSurface,
  daylightJobFor,
  daylightResult,
  SITE_VERSION,
  type SiteStage,
  siteProviderId,
  storeDaylight,
  storeSurface,
  surfaceJobFor,
  surfaceResult,
} from './compute.ts';

/** Thrown (as the iterator's error) when the job's signal aborts. */
export class SiteCancelled extends Error {
  override name = 'SiteCancelled';
}

type Yielder = () => Promise<void>;
const g = globalThis as unknown as { setTimeout: (f: () => void, ms: number) => unknown };
let pause: Yielder = () => new Promise((r) => g.setTimeout(r, 0));
/** Tests replace the event loop hop. */
export function setSiteYielder(y: Yielder): void {
  pause = y;
}

/** Longest stretch of computing between two event loop hops, ms. */
export const SLICE_MS = 40;

const TIERS: Tier[] = ['rough', 'refined', 'final'];
const WEIGHT: Record<Tier, number> = { rough: 1, refined: 4, final: 16 };
const TOTAL_W = 21;

const now = (): number => (globalThis as unknown as { performance: { now(): number } }).performance.now();

function makeProvider<S extends SiteStage>(stage: S): StageProvider<S> {
  const meta = STAGE_META.find((m) => m.id === stage);
  return {
    kind: 'stage-provider',
    id: siteProviderId(stage),
    version: SITE_VERSION,
    title: `site.stage.${stage}`,
    side: 'engine',
    stage,
    impl: 'real',
    async *run(input: StageIn[S], ctx: JobCtx): AsyncIterable<StageEvent<S>> {
      const asOf = ((input as { asOf?: string }).asOf ?? '2026-10-11') as `${number}-${number}-${number}`;
      const base = {
        jobId: ctx.jobId,
        generation: ctx.generation,
        stage,
        stageIndex: stageIndex(stage),
        message: meta?.doing ?? `studio.stage.${stage}.doing`,
      };
      const t0 = now();
      let shown: Tier = 'rough';
      let doneW = 0;
      let lastEmit = t0;
      let sliceStart = t0;
      yield { ...base, fraction: 0, tier: 'rough' };
      for (const tier of TIERS) {
        if (ctx.signal.aborted) throw new SiteCancelled(ctx.jobId);
        const sj =
          stage === 'daylight'
            ? daylightJobFor(input as StageIn['daylight'], tier)
            : surfaceJobFor(input as StageIn['sun'], tier);
        const cached = stage === 'daylight' ? cachedDaylight(sj.key) : cachedSurface(sj.key);
        let value = cached;
        if (!value) {
          const job = sj.job as Generator<number, NonNullable<typeof cached>, void>;
          for (;;) {
            const r = job.next();
            if (r.done) {
              value = r.value;
              break;
            }
            const t = now();
            if (t - sliceStart >= SLICE_MS) {
              await pause();
              if (ctx.signal.aborted) throw new SiteCancelled(ctx.jobId);
              sliceStart = now();
              const fraction = (doneW + (WEIGHT[tier] as number) * r.value) / TOTAL_W;
              if (sliceStart - lastEmit >= 250) {
                lastEmit = sliceStart;
                const elapsed = sliceStart - t0;
                yield {
                  ...base,
                  fraction: Math.min(0.99, fraction),
                  tier: shown,
                  ...(fraction > 0.02 ? { etaMs: Math.round((elapsed * (1 - fraction)) / fraction) } : {}),
                };
              }
            }
          }
          if (stage === 'daylight') storeDaylight(sj.key, value as never);
          else storeSurface(sj.key, value as never);
        }
        doneW += WEIGHT[tier] as number;
        const out = (
          stage === 'daylight'
            ? daylightResult(input as StageIn['daylight'], tier, asOf, sj.prepared, value as never)
            : surfaceResult(
                stage as 'sun' | 'radiation',
                input as StageIn['sun'],
                tier,
                asOf,
                sj.prepared,
                value as never,
              )
        ) as StageOut[S];
        if (ctx.signal.aborted) throw new SiteCancelled(ctx.jobId);
        if (tier === 'final') yield { ...base, fraction: 1, tier, etaMs: 0, final: out };
        else {
          yield { ...base, fraction: doneW / TOTAL_W, tier, partial: out };
          shown = tier;
        }
        await pause();
        sliceStart = now();
      }
    },
  };
}

export const siteSun = makeProvider('sun');
export const siteRadiation = makeProvider('radiation');
export const siteDaylight = makeProvider('daylight');

/** The three real site providers, in bar order (register them in place of the Preview ones). */
export const SITE_PROVIDERS: readonly AnyStageProvider[] = [
  siteSun,
  siteRadiation,
  siteDaylight,
] as AnyStageProvider[];
