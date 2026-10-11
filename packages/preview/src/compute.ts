/**
 * Stage computations for the Preview providers, per tier. Deterministic: the same inputs give
 * byte-identical outputs, which is what the recorded fixtures in
 * `packages/fixtures/src/preview/<building>/<stage>.json` pin (P1, P2).
 */
import type {
  BuildingResult,
  CodesOut,
  CompiledBuilding,
  EndUse,
  IsoDate,
  Place,
  ResultStamp,
  SiteContext,
  StageId,
  StageIn,
  StageOut,
  Tier,
} from '@ibasho/core';
import { canonicalHash, END_USES, isZoneTwin } from '@ibasho/core';
import { compile } from '@ibasho/plan';
import { CLIMATES, type MonthlyClimate } from './model/climate.gen.ts';
import { codesModel } from './model/codes.ts';
import { energyModel, STANDARD_DESIGN } from './model/energy.ts';
import { PREVIEW_VERSION } from './model/evidence.ts';
import { optimiseModel } from './model/optimise.ts';
import { buildEnergyResult, type MoneyCtx } from './model/result.ts';
import { type SiteCore, siteModel, siteResult } from './model/site.ts';
import { settingNumber } from './settings.ts';

export const providerId = (s: StageId) => `preview.${s}`;

/** Stamp for a Preview output, carrying the upstream providers (R26: any Preview input keeps it Preview). */
export function stampFor(
  stage: StageId,
  tier: Tier,
  asOf: IsoDate,
  upstream: readonly (ResultStamp | undefined)[] = [],
): ResultStamp {
  const providers = new Map<StageId, ResultStamp['providers'][number]>();
  for (const u of upstream) for (const p of u?.providers ?? []) providers.set(p.stage, p);
  providers.set(stage, { stage, id: providerId(stage), version: PREVIEW_VERSION, impl: 'preview' });
  return { impl: 'preview', providers: [...providers.values()], tier, computedAt: asOf };
}

export const DEFAULT_PLACE: Place = {
  id: 'pl_default',
  name: 'Hyderabad',
  lat: 17.4453,
  lon: 78.349,
  elevationM: 545,
  trueNorthMdeg: 0,
  climatePackId: 'climate.hyderabad',
  codePackIds: ['codes-in'],
  moneyPackIds: ['money-in'],
  buildingIds: [],
};

export function climateOf(site: SiteContext | undefined): MonthlyClimate {
  return (
    CLIMATES[site?.place.climatePackId ?? 'climate.hyderabad'] ??
    (CLIMATES['climate.hyderabad'] as MonthlyClimate)
  );
}

export function moneyOf(site: SiteContext | undefined, compiled: CompiledBuilding): MoneyCtx {
  const place = site?.place ?? DEFAULT_PLACE;
  const gbp = place.moneyPackIds.some((m) => m.endsWith('-uk'));
  if (gbp) return { currency: 'GBP' };
  const t = compiled.twin;
  if (isZoneTwin(t) && (t.typeId === 'apartments' || t.typeId === 'rental')) {
    const living = t.zones.filter((z) => z.spaceTypeIds.includes('living')).length;
    // Zones carry the storey multiplier in their areas, not their count: estimate flats from area.
    const livingM2 = t.zones
      .filter((z) => z.spaceTypeIds.includes('living'))
      .reduce((s, z) => s + Number(z.floorMm2) / 1e6, 0);
    return { currency: 'INR', flats: Math.max(living, Math.round(livingM2 / 42)) };
  }
  return { currency: 'INR' };
}

const settingsKey = (s: readonly { id: string; value: unknown }[]) =>
  s.map((x) => [x.id, String(x.value)]).sort();

export function inputsHashOf(stage: StageId, parts: Record<string, unknown>): string {
  return canonicalHash({ stage, v: PREVIEW_VERSION, ...parts });
}

// ---------------------------------------------------------------------------------------------

export function computeGeometry(input: StageIn['geometry'], tier: Tier): CompiledBuilding {
  const north = 0;
  return compile(input.doc, { trueNorthMdeg: north, meshes: tier !== 'rough' });
}

const siteCache = new Map<string, SiteCore>();
function siteCoreOf(compiled: CompiledBuilding, site: SiteContext, radiusM: number): SiteCore {
  const key = `${compiled.docHash}|${site.weatherHash}|${site.place.id}|${site.tiles.length}|${radiusM}|${(site.replacedIds ?? []).join(',')}`;
  let c = siteCache.get(key);
  if (!c) {
    c = siteModel(compiled, climateOf(site), site.tiles, radiusM, site.replacedIds);
    if (siteCache.size > 16) siteCache.clear();
    siteCache.set(key, c);
  }
  return c;
}

const coarse = (v: bigint, step: bigint) => ((v + step / 2n) / step) * step;

export function computeSite<S extends 'sun' | 'radiation' | 'daylight'>(
  stage: S,
  input: StageIn[S],
  tier: Tier,
  asOf: IsoDate,
): StageOut[S] {
  const core = siteCoreOf(input.compiled, input.site, input.resolution.contextRadiusM);
  const inputsHash = inputsHashOf(stage, {
    doc: input.compiled.docHash,
    weather: input.site.weatherHash,
    place: input.site.place.id,
    res: input.resolution.level,
    tiles: input.site.tiles.length,
    replaced: input.site.replacedIds ?? null,
    radius: input.resolution.contextRadiusM,
  });
  const r = siteResult(stage, core, {
    inputsHash,
    weatherHash: input.site.weatherHash,
    sceneHash: canonicalHash({ tiles: input.site.tiles.map((t) => `${t.packId}:${t.tx},${t.ty}`) }),
    resolution: input.resolution,
    stamp: stampFor(stage, tier, asOf),
  });
  if (tier === 'final') return r as StageOut[S];
  // Rough and refined: same shape, coarser values and wider ranges (they sharpen in place).
  const step = tier === 'rough' ? 10_000n : 1_000n;
  const widen = tier === 'rough' ? 10 : 4;
  return {
    ...r,
    surfaces: r.surfaces.map((s) => ({
      ...s,
      irrWhm2: s.irrWhm2 === 'unknown' ? 'unknown' : s.irrWhm2.map((v) => coarse(v, step)),
    })),
    rooms: r.rooms.map((x) => ({
      ...x,
      ...(x.sda ? { sda: { lo: Math.max(0, x.sda.lo - widen), hi: Math.min(100, x.sda.hi + widen) } } : {}),
      ...(x.ase ? { ase: { lo: Math.max(0, x.ase.lo - widen), hi: Math.min(100, x.ase.hi + widen) } } : {}),
    })),
    ledger: r.ledger.map((l) => ({ ...l, lostWh: coarse(l.lostWh, step * 100n) })),
  } as StageOut[S];
}

export function computeEnergy(input: StageIn['energy'], tier: Tier): BuildingResult {
  const clim = climateOf(input.site);
  const core = energyModel(
    input.compiled,
    clim,
    { dhwSolarShare: settingNumber(input.settings, 'comfort.dhw.solarShare') },
    input.radiation,
  );
  const inputsHash = inputsHashOf('energy', {
    doc: input.compiled.docHash,
    rad: input.radiation?.inputsHash ?? null,
    settings: settingsKey(input.settings),
    clim: clim.id,
    place: input.site?.place.id ?? null,
  });
  const res = buildEnergyResult(
    input.compiled,
    core,
    moneyOf(input.site, input.compiled),
    input.settings,
    inputsHash,
    stampFor('energy', tier, input.asOf, [input.radiation?.stamp]),
    input.asOf,
  );
  if (tier !== 'rough') return res;
  // Rough: the big three end uses first; the EUI is partial until the rest arrive (R33, AC-BR1).
  const known: EndUse[] = ['cooling', 'heating', 'lighting', 'equipment'];
  const missing = END_USES.filter((u) => !known.includes(u));
  const endUses = Object.fromEntries(
    END_USES.map((u) => [
      u,
      known.includes(u) ? res.endUses[u] : res.endUses[u].map(() => 'unknown' as const),
    ]),
  ) as BuildingResult['endUses'];
  return {
    ...res,
    endUses,
    eui: {
      ...res.eui,
      site: { lo: res.eui.site.lo * 0.85, hi: res.eui.site.hi * 1.05 },
      partial: true,
      missing,
    },
  };
}

/** Reference design EUI (kWh/m²·yr) for the baseline row and savings ladder (R35). */
export function baselineEuiOf(compiled: CompiledBuilding, site: SiteContext | undefined): number {
  const core = energyModel(compiled, climateOf(site), STANDARD_DESIGN);
  const wh = END_USES.reduce((s, u) => s + core.wh[u].reduce((a, b) => a + b, 0), 0);
  const m2 = Number(compiled.quantities.ncaMm2) / 1e6;
  return m2 > 0 ? Math.round((wh / 1000 / m2) * 10) / 10 : 0;
}

export function computeCodes(input: StageIn['codes'], tier: Tier): CodesOut {
  const core = codesModel(
    input.doc,
    input.compiled,
    input.energy,
    input.codePackIds,
    baselineEuiOf(input.compiled, input.site),
  );
  const inputsHash = inputsHashOf('codes', {
    doc: input.compiled.docHash,
    energy: input.energy.inputsHash,
    packs: input.codePackIds,
    permit: input.doc.permitDate ?? null,
  });
  const stamp = stampFor('codes', tier, input.asOf, [input.energy.stamp, input.daylight?.stamp]);
  const codes =
    tier === 'rough'
      ? core.codes.map((c) =>
          c.metric && ['epi', 'epi.ratio', 'eui.site'].includes(c.metric)
            ? { ...c, status: 'unknown' as const }
            : c,
        )
      : core.codes;
  const ratings = tier === 'rough' ? [] : core.ratings;
  return {
    codes,
    ratings,
    baselines: core.baselines,
    result: { ...input.energy, inputsHash, stamp, codes, ratings, baselines: core.baselines },
  };
}

export function computeOptimise(input: StageIn['optimise'], tier: Tier): StageOut['optimise'] {
  const clim = climateOf(input.site);
  const inputsHash = inputsHashOf('optimise', {
    doc: input.compiled.docHash,
    energy: input.energy.inputsHash,
    objectives: input.objectives.map((o) => `${o.id}:${o.dir}`),
    goals: input.goals.length,
    seed: input.seed,
    settings: settingsKey(input.settings ?? []),
  });
  const limit = tier === 'rough' ? 32 : tier === 'refined' ? 128 : undefined;
  return optimiseModel(
    input.doc,
    input.compiled,
    clim,
    moneyOf(input.site, input.compiled),
    input.settings ?? [],
    input.objectives,
    input.goals,
    stampFor('optimise', tier, input.asOf, [input.energy.stamp]),
    inputsHash,
    input.seed,
    limit,
  );
}
