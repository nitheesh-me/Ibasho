/**
 * The real `sun`, `radiation` and `daylight` stage computations (ARCH 15.5, SPEC 19, R26, R30,
 * R31). Owner: WP-16.
 *
 * `computeSite(stage, input, tier, asOf)` has the Preview's signature and returns the same
 * `SiteResult` shape, so swapping `@ibasho/preview`'s `computeSite` for this one is one import.
 * Tiers sharpen in place: rough uses a sensor grid 4 times coarser, refined 2 times, final the
 * resolution's grid; daylight also samples fewer days and sky directions at rough and refined.
 *
 * Every stage is deterministic: the same inputs give the same bytes (no `Math` transcendentals,
 * a deterministic BVH, fixed iteration orders).
 */
import type {
  CompiledBuilding,
  IsoDate,
  Resolution,
  ResultStamp,
  SiteContext,
  SiteResult,
  StageId,
  StageIn,
  StageOut,
  Tier,
} from '@ibasho/core';
import { canonicalHash, Q } from '@ibasho/core';
import { type DaylightAnalysis, daylightJob } from './daylight.ts';
import { buildScene, type SiteScene, surfaceSensors } from './scene.ts';
import { skyYear, solarYear, sunBins, toFrame } from './solar.ts';
import { drain, type SurfaceAnalysis, surfaceJob } from './surfaces.ts';
import { type HourlyWeather, weatherFor } from './weather/index.ts';

export const SITE_VERSION = '0.1.0' as const;
export type SiteStage = Extract<StageId, 'sun' | 'radiation' | 'daylight'>;
export const siteProviderId = (s: SiteStage) => `site.${s}`;

/** Validated error bands used for the ranges (SD 1.6, 7; to be replaced by measured V9 bands). */
export const BANDS = { sda: 12, ase: 3, views: 5, ecbc: 12 } as const;

const TIER_SCALE: Record<Tier, number> = { rough: 4, refined: 2, final: 1 };

export function stampFor(
  stage: SiteStage,
  tier: Tier,
  asOf: IsoDate,
  upstream: readonly (ResultStamp | undefined)[] = [],
): ResultStamp {
  const providers = new Map<StageId, ResultStamp['providers'][number]>();
  for (const u of upstream) for (const p of u?.providers ?? []) providers.set(p.stage, p);
  providers.set(stage, { stage, id: siteProviderId(stage), version: SITE_VERSION, impl: 'real' });
  const list = [...providers.values()];
  // R26: any Preview input keeps the result Preview.
  return {
    impl: list.some((p) => p.impl === 'preview') ? 'preview' : 'real',
    providers: list,
    tier,
    computedAt: asOf,
  };
}

interface Prepared {
  weather: HourlyWeather;
  fallback: boolean;
  scene: SiteScene;
  sceneKey: string;
}

const sceneCache = new Map<string, SiteScene>();

/** Weather, solar year and scene for a site stage input (cached by content). */
export function prepare(compiled: CompiledBuilding, site: SiteContext, res: Resolution): Prepared {
  const { weather, fallback } = weatherFor(site);
  const sceneKey = canonicalHash({
    doc: compiled.docHash,
    placement: compiled.placement ?? null,
    tiles: site.tiles.map((t) => `${t.packId}:${t.tx},${t.ty}:${t.buildings.length}`),
    replaced: site.replacedIds ?? null,
    radius: res.contextRadiusM,
    north: site.place.trueNorthMdeg,
  });
  let scene = sceneCache.get(sceneKey);
  if (!scene) {
    scene = buildScene(compiled, {
      tiles: site.tiles,
      radiusM: res.contextRadiusM,
      ...(site.replacedIds ? { replacedIds: site.replacedIds } : {}),
      trueNorthMdeg: site.place.trueNorthMdeg,
    });
    if (sceneCache.size > 8) sceneCache.clear();
    sceneCache.set(sceneKey, scene);
  }
  return { weather, fallback, scene, sceneKey };
}

const yearOf = (site: SiteContext, w: HourlyWeather) =>
  solarYear(site.place.lat, site.place.lon, site.place.elevationM, w.tzHours);

/** The surface job for a stage input and tier (a generator; see `surfaceJob`). */
export function surfaceJobFor(input: StageIn['sun'], tier: Tier) {
  const pr = prepare(input.compiled, input.site, input.resolution);
  const y = yearOf(input.site, pr.weather);
  const mf = tier !== 'rough' && input.resolution.skyPatches === 577 ? 2 : 1;
  const sky = skyYear(y, pr.weather, mf, `${input.site.place.lat}|${input.site.place.lon}`);
  const frame = toFrame(pr.scene.trueNorthDeg);
  const patchDir = new Float64Array(sky.patches.count * 3);
  for (let p = 0; p < sky.patches.count; p++)
    patchDir.set(
      frame([
        sky.patches.dir[p * 3] as number,
        sky.patches.dir[p * 3 + 1] as number,
        sky.patches.dir[p * 3 + 2] as number,
      ]),
      p * 3,
    );
  const bins = sunBins(y, pr.weather);
  const binDir = new Float64Array(bins.length * 3);
  const binVec = new Float64Array(bins.length * 3);
  bins.forEach((b, i) => {
    binDir.set(frame(b.dir), i * 3);
    binVec.set(frame(b.vec), i * 3);
  });
  const spacing = (input.resolution.grid / 1000) * (TIER_SCALE[tier] as number);
  const sensors = surfaceSensors(pr.scene.surfaces, spacing);
  const key = `${pr.sceneKey}|${pr.weather.hash}|${spacing}|${mf}`;
  return {
    key,
    prepared: pr,
    job: surfaceJob({
      scene: pr.scene,
      sensors,
      sky,
      patchDir,
      bins,
      binDir,
      binVec,
      albedo: pr.weather.albedo,
    }),
  };
}

/** The daylight job for a stage input and tier. */
export function daylightJobFor(input: StageIn['daylight'], tier: Tier) {
  const pr = prepare(input.compiled, input.site, input.resolution);
  const y = yearOf(input.site, pr.weather);
  const mf = tier === 'final' && input.resolution.skyPatches === 577 ? 2 : 1;
  const sky = skyYear(y, pr.weather, mf, `${input.site.place.lat}|${input.site.place.lon}`);
  const spacing = Math.max(0.5, input.resolution.grid / 1000) * (tier === 'rough' ? 2 : 1);
  const key = `${pr.sceneKey}|${pr.weather.hash}|dl|${spacing}|${mf}|${tier}`;
  return {
    key,
    prepared: pr,
    job: daylightJob({
      compiled: input.compiled,
      scene: pr.scene,
      weather: pr.weather,
      year: y,
      patches: sky.patches,
      frame: toFrame(pr.scene.trueNorthDeg),
      opts: {
        spacingM: spacing,
        subSamples: tier === 'rough' ? 1 : tier === 'refined' ? 2 : 3,
        dayStride: tier === 'rough' ? 7 : tier === 'refined' ? 3 : 1,
        slice: 16,
      },
    }),
  };
}

const surfaceCache = new Map<string, SurfaceAnalysis>();
const daylightCache = new Map<string, DaylightAnalysis>();

export function cachedSurface(key: string): SurfaceAnalysis | undefined {
  return surfaceCache.get(key);
}
export function storeSurface(key: string, a: SurfaceAnalysis): void {
  if (surfaceCache.size > 16) surfaceCache.clear();
  surfaceCache.set(key, a);
}
export function cachedDaylight(key: string): DaylightAnalysis | undefined {
  return daylightCache.get(key);
}
export function storeDaylight(key: string, a: DaylightAnalysis): void {
  if (daylightCache.size > 16) daylightCache.clear();
  daylightCache.set(key, a);
}

export function inputsHashOf(stage: SiteStage, input: StageIn['sun'], weatherHash: string): string {
  return canonicalHash({
    stage,
    v: SITE_VERSION,
    doc: input.compiled.docHash,
    placement: input.compiled.placement ?? null,
    weather: weatherHash,
    place: input.site.place.id,
    res: input.resolution.level,
    tiles: input.site.tiles.length,
    replaced: input.site.replacedIds ?? null,
    radius: input.resolution.contextRadiusM,
  });
}

const qOf = (x: number): Q => Q.of(BigInt(Math.round(Math.max(0, Math.min(1, x)) * 1000)), 1000n);
const clampPct = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
const band = (v: readonly number[], b: number) =>
  v.length === 0 ? { lo: 0, hi: 0 } : { lo: clampPct(Math.min(...v) - b), hi: clampPct(Math.max(...v) + b) };

function base(
  stage: SiteStage,
  input: StageIn['sun'],
  tier: Tier,
  asOf: IsoDate,
  pr: Prepared,
  upstream: (ResultStamp | undefined)[],
) {
  return {
    inputsHash: inputsHashOf(stage, input, pr.weather.hash),
    weatherHash: pr.weather.hash,
    sceneHash: canonicalHash({ scene: pr.sceneKey, context: pr.scene.contextIds }),
    resolution: input.resolution,
    stamp: stampFor(stage, tier, asOf, upstream),
    kernel: 'cpu' as const,
    unknownHeightIds: pr.scene.unknownHeightIds,
  };
}

/** SiteResult for the sun or radiation stage from a surface analysis. */
export function surfaceResult(
  stage: 'sun' | 'radiation',
  input: StageIn['sun'],
  tier: Tier,
  asOf: IsoDate,
  pr: Prepared,
  a: SurfaceAnalysis,
): SiteResult {
  const upstream = stage === 'radiation' ? [(input as StageIn['radiation']).sun?.stamp] : [];
  const r: SiteResult = {
    ...base(stage, input, tier, asOf, pr, upstream),
    method: 'T0',
    surfaces: [],
    windows: [],
    rooms: [],
    ledger: [],
  };
  if (stage === 'sun') {
    r.surfaces = a.surfaces.map((s) => {
      const monthly = s.sunHours.map((h) => Math.round(h * 10) / 10);
      const annual = s.sunHours.reduce(
        (t, h, m) => t + h * ([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m] as number),
        0,
      );
      return {
        id: s.id,
        irrWhm2: 'unknown' as const,
        sunHours: {
          dailyMean: { lo: s.sunDaily[0], hi: s.sunDaily[1] },
          annual: Math.round(annual),
          monthly,
        },
        svf: qOf(s.svf),
      };
    });
  } else {
    r.surfaces = a.surfaces.map((s) => ({ id: s.id, irrWhm2: s.irr.map((v) => BigInt(Math.round(v))) }));
    r.windows = a.surfaces
      .filter((s) => s.kind === 'window')
      .map((s) => ({
        id: s.id,
        shadingFactor: s.irr.map((v, m) =>
          qOf((s.unshaded[m] as number) > 0 ? v / (s.unshaded[m] as number) : 1),
        ),
      }));
    r.ledger = a.ledger.map((l) => ({ ...l }));
  }
  return r;
}

export function daylightResult(
  input: StageIn['daylight'],
  tier: Tier,
  asOf: IsoDate,
  pr: Prepared,
  d: DaylightAnalysis,
): SiteResult {
  const r: SiteResult = {
    ...base('daylight', input, tier, asOf, pr, [input.sun?.stamp]),
    method: 'T1',
    surfaces: [],
    windows: [],
    ledger: [],
    rooms: d.rooms.map((x) =>
      x.windowless
        ? {
            id: x.id,
            sda: { lo: 0, hi: 0 },
            ase: { lo: 0, hi: 0 },
            ecbcShare: { lo: 0, hi: 0 },
            views: { lo: 0, hi: 0 },
            tier: 'T1' as const,
          }
        : {
            id: x.id,
            sda: band(x.sda, BANDS.sda + (tier === 'final' ? 0 : 4)),
            ase: band(x.ase, BANDS.ase + (tier === 'final' ? 0 : 4)),
            ecbcShare: band(x.udi, BANDS.ecbc + (tier === 'final' ? 0 : 4)),
            views: band(x.views, BANDS.views),
            tier: 'T1' as const,
          },
    ),
  };
  return r;
}

/**
 * Same signature as `@ibasho/preview`'s `computeSite`: runs the stage synchronously. Use it in a
 * worker; the providers in `providers.ts` add progress and cancel.
 */
export function computeSite<S extends SiteStage>(
  stage: S,
  input: StageIn[S],
  tier: Tier,
  asOf: IsoDate,
): StageOut[S] {
  if (stage === 'daylight') {
    const { key, prepared, job } = daylightJobFor(input as StageIn['daylight'], tier);
    let d = cachedDaylight(key);
    if (!d) {
      d = drain(job);
      storeDaylight(key, d);
    }
    return daylightResult(input as StageIn['daylight'], tier, asOf, prepared, d) as StageOut[S];
  }
  const { key, prepared, job } = surfaceJobFor(input as StageIn['sun'], tier);
  let a = cachedSurface(key);
  if (!a) {
    a = drain(job);
    storeSurface(key, a);
  }
  return surfaceResult(
    stage as 'sun' | 'radiation',
    input as StageIn['sun'],
    tier,
    asOf,
    prepared,
    a,
  ) as StageOut[S];
}
