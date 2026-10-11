/**
 * The real `codes` stage provider (WP-19, V-5). Same contract as `preview.codes`
 * (`StageProvider<'codes'>`): swapping is one line in `apps/web/src/manifest.ts` (AC-PG4).
 * Rough: scope, prescriptive and geometric rows (no baseline runs). Final: baselines on the real
 * energy engine, performance rows and rating ladders.
 */
import type {
  CodesOut,
  JobCtx,
  ResultStamp,
  StageEvent,
  StageIn,
  StageProvider,
  Tier,
  TypeLibrary,
} from '@ibasho/core';
import { canonicalHash, STAGE_META, stageIndex } from '@ibasho/core';
import type { CodesCatalogue } from './catalogue.ts';
import { evaluateCodes } from './evaluate.ts';
import { goalGaps } from './gaps.ts';

export const REAL_CODES_VERSION = '0.1.0' as const;

function stamp(input: StageIn['codes'], tier: Tier): ResultStamp {
  const providers = new Map<string, ResultStamp['providers'][number]>();
  for (const s of [input.energy.stamp, input.daylight?.stamp])
    for (const p of s?.providers ?? []) providers.set(p.stage, p);
  providers.set('codes', { stage: 'codes', id: 'real.codes', version: REAL_CODES_VERSION, impl: 'real' });
  const list = [...providers.values()];
  return {
    impl: list.some((p) => p.impl === 'preview') ? 'preview' : 'real',
    providers: list,
    tier,
    computedAt: input.asOf,
  };
}

/** Compute the codes result synchronously (tests, workers). */
export function computeRealCodes(
  input: StageIn['codes'],
  cat: CodesCatalogue,
  lib: TypeLibrary,
  tier: Tier = 'final',
): CodesOut {
  const run = evaluateCodes(input, cat, lib, tier === 'rough');
  const inputsHash = canonicalHash({
    stage: 'codes',
    impl: 'real',
    v: REAL_CODES_VERSION,
    tier,
    doc: input.compiled.docHash,
    energy: input.energy.inputsHash,
    packs: input.codePackIds,
    permit: input.doc.permitDate ?? null,
    place: input.site?.place.id ?? null,
    ...(input.params && Object.keys(input.params).length ? { params: input.params } : {}),
    ...(input.goals?.length ? { goals: input.goals.map((g) => g.goal) } : {}),
  });
  const gaps = input.goals?.length
    ? goalGaps(input.goals, {
        codes: run.codes,
        ratings: run.ratings,
        baselines: run.baselines,
        energy: input.energy,
      })
    : undefined;
  return {
    codes: run.codes,
    ratings: run.ratings,
    baselines: run.baselines,
    result: {
      ...input.energy,
      inputsHash,
      stamp: stamp(input, tier),
      codes: run.codes,
      ratings: run.ratings,
      baselines: run.baselines,
    },
    ...(gaps ? { gaps } : {}),
  };
}

export function createRealCodesProvider(cat: CodesCatalogue, lib: TypeLibrary): StageProvider<'codes'> {
  const meta = STAGE_META.find((m) => m.id === 'codes');
  return {
    kind: 'stage-provider',
    id: 'real.codes',
    version: REAL_CODES_VERSION,
    title: 'studio.stage.codes',
    side: 'engine',
    stage: 'codes',
    impl: 'real',
    async *run(input: StageIn['codes'], ctx: JobCtx): AsyncIterable<StageEvent<'codes'>> {
      const base = {
        jobId: ctx.jobId,
        generation: ctx.generation,
        stage: 'codes' as const,
        stageIndex: stageIndex('codes'),
        message: meta?.doing ?? 'studio.stage.codes.doing',
      };
      yield { ...base, fraction: 0, tier: 'rough' };
      if (ctx.signal.aborted) return;
      const rough = computeRealCodes(input, cat, lib, 'rough');
      yield { ...base, fraction: 0.2, tier: 'rough', partial: rough };
      if (ctx.signal.aborted) return;
      const final = computeRealCodes(input, cat, lib, 'final');
      if (ctx.signal.aborted) return;
      yield { ...base, fraction: 1, tier: 'final', etaMs: 0, final };
    },
  };
}
