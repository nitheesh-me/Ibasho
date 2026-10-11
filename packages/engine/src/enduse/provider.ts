/**
 * The real `energy` stage provider (WP-18, V-4). Same contract as `preview.energy`
 * (`StageProvider<'energy'>`): swapping is one line in `apps/web/src/manifest.ts` (AC-PG4).
 * The type library comes from the type packs: `createRealEnergyProvider(mergeTypeLibraries(
 * typesInLibrary, typesGlobalLibrary))`.
 */
import type {
  BuildingResult,
  CompiledBuilding,
  JobCtx,
  ResultStamp,
  SiteContext,
  StageEvent,
  StageIn,
  StageProvider,
  TypeLibrary,
} from '@ibasho/core';
import { canonicalHash, isZoneTwin, STAGE_META, stageIndex } from '@ibasho/core';
import { hourlyWeather, sunPath } from '../zones/weather.ts';
import { runEnergyModel } from './model.ts';
import { buildRealResult, type MoneyCtx, REAL_ENERGY_VERSION, settingNumber } from './result.ts';

export function moneyFor(site: SiteContext | undefined, compiled: CompiledBuilding): MoneyCtx {
  if (site?.place.moneyPackIds.some((m) => m.endsWith('-uk'))) return { currency: 'GBP' };
  const t = compiled.twin;
  if (isZoneTwin(t) && (t.typeId === 'apartments' || t.typeId === 'rental')) {
    const living = t.zones.filter((z) => z.spaceTypeIds.includes('living'));
    const m2 = living.reduce((s, z) => s + Number(z.floorMm2) / 1e6, 0);
    return { currency: 'INR', flats: Math.max(living.length, Math.round(m2 / 42)) };
  }
  return { currency: 'INR' };
}

function stamp(input: StageIn['energy'], tier: ResultStamp['tier'] = 'final'): ResultStamp {
  const providers = new Map<string, ResultStamp['providers'][number]>();
  for (const p of input.radiation?.stamp.providers ?? []) providers.set(p.stage, p);
  providers.set('energy', { stage: 'energy', id: 'real.energy', version: REAL_ENERGY_VERSION, impl: 'real' });
  const list = [...providers.values()];
  return {
    impl: list.some((p) => p.impl === 'preview') ? 'preview' : 'real',
    providers: list,
    tier,
    computedAt: input.asOf,
  };
}

/**
 * A coarse copy of the compiled building for the rough tier: zones with the same space type,
 * conditioning and system merge into one (areas, volumes and surfaces summed), so the hourly
 * network runs on a handful of zones instead of every room. End-use totals land close to the
 * final run; per-room comfort is dropped to the merged zones.
 */
export function coarseBuilding(compiled: CompiledBuilding): CompiledBuilding {
  const t = compiled.twin;
  if (!isZoneTwin(t)) return compiled;
  const keyOf = (z: (typeof t.zones)[number]) =>
    `${z.spaceTypeIds[0] ?? '?'}|${z.conditioned}|${z.systemId ?? ''}`;
  const merged = new Map<string, (typeof t.zones)[number]>();
  const remap = new Map<string, string>();
  for (const z of t.zones) {
    const k = keyOf(z);
    const m = merged.get(k);
    if (m) {
      m.roomIds.push(...z.roomIds);
      m.floorMm2 += z.floorMm2;
      m.volumeMm3 += z.volumeMm3;
    } else merged.set(k, { ...z, roomIds: [...z.roomIds], spaceTypeIds: [...z.spaceTypeIds] });
    remap.set(z.id, (merged.get(k) as (typeof t.zones)[number]).id);
  }
  return {
    ...compiled,
    twin: {
      ...t,
      zones: [...merged.values()],
      surfaces: t.surfaces.map((s) => ({ ...s, zoneId: remap.get(s.zoneId) ?? s.zoneId })),
    },
  };
}

/** Compute the real energy result synchronously (tests, workers, the optimiser later). */
export function computeRealEnergy(
  input: StageIn['energy'],
  lib: TypeLibrary,
  tier: ResultStamp['tier'] = 'final',
): BuildingResult {
  const w = hourlyWeather(input.site);
  const sun = sunPath(w);
  const params = {
    ...input.params,
    dhwSolarShare: input.params?.dhwSolarShare ?? settingNumber(input.settings, 'comfort.dhw.solarShare'),
  };
  const compiled = tier === 'rough' ? coarseBuilding(input.compiled) : input.compiled;
  const run = runEnergyModel(compiled, lib, w, sun, params, input.radiation);
  const inputsHash = canonicalHash({
    stage: 'energy',
    impl: 'real',
    v: REAL_ENERGY_VERSION,
    doc: input.compiled.docHash,
    rad: input.radiation?.inputsHash ?? null,
    weather: w.id,
    settings: input.settings.map((s) => [s.id, String(s.value)]).sort(),
    ...(input.params && Object.keys(input.params).length > 0 ? { params: input.params } : {}),
  });
  return buildRealResult(
    input.compiled,
    run,
    moneyFor(input.site, input.compiled),
    input.settings,
    inputsHash,
    stamp(input, tier),
    input.asOf,
  );
}

export function createRealEnergyProvider(lib: TypeLibrary): StageProvider<'energy'> {
  const meta = STAGE_META.find((m) => m.id === 'energy');
  return {
    kind: 'stage-provider',
    id: 'real.energy',
    version: REAL_ENERGY_VERSION,
    title: 'studio.stage.energy',
    side: 'engine',
    stage: 'energy',
    impl: 'real',
    async *run(input: StageIn['energy'], ctx: JobCtx): AsyncIterable<StageEvent<'energy'>> {
      const base = {
        jobId: ctx.jobId,
        generation: ctx.generation,
        stage: 'energy' as const,
        stageIndex: stageIndex('energy'),
        message: meta?.doing ?? 'studio.stage.energy.doing',
      };
      yield { ...base, fraction: 0, tier: 'rough' };
      if (ctx.signal.aborted) return;
      // Rough: merged zones, same weather and plant (a fraction of the final run's time).
      const rough = computeRealEnergy(input, lib, 'rough');
      if (ctx.signal.aborted) return;
      yield { ...base, fraction: 0.3, tier: 'rough', partial: rough };
      const final = computeRealEnergy(input, lib);
      if (ctx.signal.aborted) return;
      yield { ...base, fraction: 1, tier: 'final', etaMs: 0, final };
    },
  };
}
