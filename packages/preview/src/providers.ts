/**
 * The seven Preview stage providers (ARCH 15.5, SPEC 19, R26). Each emits progress events with
 * fraction and time left, a rough partial at 25% of its recorded time, a refined partial at 60%
 * and the final output at 100%. Waits are sliced at 50 ms or less and every slice checks the
 * abort signal, so cancel returns within one slice. Swapping to a real provider is one line in
 * `apps/web/src/manifest.ts` (AC-PG4): the contract is `StageProvider<S>` from `@ibasho/core`.
 */
import type {
  AnyStageProvider,
  JobCtx,
  StageEvent,
  StageId,
  StageIn,
  StageOut,
  StageProvider,
  Tier,
} from '@ibasho/core';
import { STAGE_META, stageIndex } from '@ibasho/core';
import {
  computeCodes,
  computeEnergy,
  computeGeometry,
  computeOptimise,
  computeSite,
  providerId,
} from './compute.ts';
import { PREVIEW_VERSION } from './model/evidence.ts';
import { stageMs, TIER_AT } from './timings.ts';

/** Thrown (as the iterator's error) when the job's signal aborts. */
export class PreviewCancelled extends Error {
  override name = 'PreviewCancelled';
}

type Timer = (ms: number) => Promise<void>;
const g = globalThis as unknown as { setTimeout: (f: () => void, ms: number) => unknown };
let sleep: Timer = (ms) => new Promise((r) => g.setTimeout(r, ms));
/** Tests replace the clock (no real waiting). */
export function setPreviewTimer(t: Timer): void {
  sleep = t;
}

const SLICE = 40;

function gfaOf<S extends StageId>(stage: S, input: StageIn[S]): number {
  if (stage === 'geometry') {
    const doc = (input as StageIn['geometry']).doc;
    return doc.storeys.reduce((s, st) => s + st.rooms.length * 60 * st.multiplier, 0) || 1000;
  }
  return Number((input as StageIn['sun']).compiled.quantities.gfaMm2) / 1e6;
}

function compute<S extends StageId>(stage: S, input: StageIn[S], tier: Tier, asOf: string): StageOut[S] {
  switch (stage) {
    case 'geometry':
      return computeGeometry(input as StageIn['geometry'], tier) as StageOut[S];
    case 'sun':
    case 'radiation':
    case 'daylight':
      return computeSite(
        stage as 'sun',
        input as StageIn['sun'],
        tier,
        asOf as `${number}-${number}-${number}`,
      ) as StageOut[S];
    case 'energy':
      return computeEnergy(input as StageIn['energy'], tier) as StageOut[S];
    case 'codes':
      return computeCodes(input as StageIn['codes'], tier) as StageOut[S];
    default:
      return computeOptimise(input as StageIn['optimise'], tier) as StageOut[S];
  }
}

const asOfOf = (input: unknown): string => (input as { asOf?: string }).asOf ?? '2026-10-11';

function makeProvider<S extends StageId>(stage: S): StageProvider<S> {
  const meta = STAGE_META.find((m) => m.id === stage);
  return {
    kind: 'stage-provider',
    id: providerId(stage),
    version: PREVIEW_VERSION,
    title: `preview.stage.${stage}`,
    side: 'engine',
    stage,
    impl: 'preview',
    async *run(input: StageIn[S], ctx: JobCtx): AsyncIterable<StageEvent<S>> {
      const total = stageMs(stage, gfaOf(stage, input), ctx.resolution.level, ctx.deviceFactor);
      const base = {
        jobId: ctx.jobId,
        generation: ctx.generation,
        stage,
        stageIndex: stageIndex(stage),
        message: meta?.doing ?? `studio.stage.${stage}.doing`,
      };
      let elapsed = 0;
      let lastEmit = 0;
      // Progress events carry the tier of the result already on screen, never a later one.
      let shown: Tier = 'rough';
      const tiers: Tier[] = ['rough', 'refined', 'final'];
      yield { ...base, fraction: 0, tier: 'rough', etaMs: total };
      for (const tier of tiers) {
        const until = Math.round(total * TIER_AT[tier]);
        while (elapsed < until) {
          if (ctx.signal.aborted) throw new PreviewCancelled(ctx.jobId);
          const step = Math.min(SLICE, until - elapsed);
          await sleep(step);
          elapsed += step;
          if (elapsed - lastEmit >= 250 && elapsed < until) {
            lastEmit = elapsed;
            yield { ...base, fraction: elapsed / Math.max(1, total), tier: shown, etaMs: total - elapsed };
          }
        }
        if (ctx.signal.aborted) throw new PreviewCancelled(ctx.jobId);
        const out = compute(stage, input, tier, asOfOf(input));
        if (tier === 'final') yield { ...base, fraction: 1, tier, etaMs: 0, final: out };
        else {
          yield {
            ...base,
            fraction: elapsed / Math.max(1, total),
            tier,
            etaMs: total - elapsed,
            partial: out,
          };
          shown = tier;
        }
      }
    },
  };
}

export const previewGeometry = makeProvider('geometry');
export const previewSun = makeProvider('sun');
export const previewRadiation = makeProvider('radiation');
export const previewDaylight = makeProvider('daylight');
export const previewEnergy = makeProvider('energy');
export const previewCodes = makeProvider('codes');
export const previewOptimise = makeProvider('optimise');

/** All seven, in bar order (what the registry stores). */
export const PREVIEW_PROVIDERS: readonly AnyStageProvider[] = [
  previewGeometry,
  previewSun,
  previewRadiation,
  previewDaylight,
  previewEnergy,
  previewCodes,
  previewOptimise,
] as AnyStageProvider[];
