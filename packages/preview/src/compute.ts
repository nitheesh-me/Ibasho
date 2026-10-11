/**
 * Stage computations for the Preview providers, per tier. Deterministic: the same inputs give
 * byte-identical outputs, which is what the recorded fixtures in
 * `packages/fixtures/src/preview/<building>/<stage>.json` pin (P1, P2).
 */
import type {
  BuildingDoc,
  BuildingResult,
  CodesOut,
  CompiledBuilding,
  EndUse,
  EnergyParams,
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
import { isNewBuildUk, UK_DWELLING_TYPES, ukCodes } from './model/codes-uk.ts';
import { energyModel, STANDARD_DESIGN } from './model/energy.ts';
import { PREVIEW_VERSION } from './model/evidence.ts';
import { goalGaps } from './model/gaps.ts';
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

/** Where a place is: India or the UK by its coordinates, else unknown (then its pack ids decide). */
export function regionOf(place: Pick<Place, 'lat' | 'lon'> | undefined): 'in' | 'uk' | undefined {
  if (!place) return undefined;
  if (place.lat >= 6 && place.lat <= 37.5 && place.lon >= 68 && place.lon <= 97.5) return 'in';
  if (place.lat >= 49.8 && place.lat <= 60.9 && place.lon >= -8.7 && place.lon <= 1.8) return 'uk';
  return undefined;
}

/**
 * The plot's climate: its location decides (a London plot gets London weather and sun even when
 * the place record still carries another city's pack id), then its pack id, then latitude.
 */
export function climateOf(site: SiteContext | undefined): MonthlyClimate {
  const p = site?.place;
  const region = regionOf(p);
  const id =
    region === 'uk'
      ? 'climate.london'
      : region === 'in'
        ? 'climate.hyderabad'
        : p && CLIMATES[p.climatePackId]
          ? p.climatePackId
          : p && p.lat > 35
            ? 'climate.london'
            : 'climate.hyderabad';
  return CLIMATES[id] ?? (CLIMATES['climate.hyderabad'] as MonthlyClimate);
}

export function moneyOf(site: SiteContext | undefined, compiled: CompiledBuilding): MoneyCtx {
  const place = site?.place ?? DEFAULT_PLACE;
  // Tariffs and currency follow the plot's location first, then its money packs.
  const region = regionOf(place);
  const gbp =
    region === 'uk' ||
    (region === undefined && (place.moneyPackIds.some((m) => m.endsWith('-uk')) || place.lat > 35));
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

/** Compiled documents by object identity: the three tiers and later stages share one compile. */
const compiled = new WeakMap<object, CompiledBuilding>();

/** Compiles by shape (the document without its origin): a pure move reuses the compile (AC-PD2). */
const byShape = new Map<string, CompiledBuilding>();

export function computeGeometry(input: StageIn['geometry'], _tier: Tier): CompiledBuilding {
  let c = compiled.get(input.doc);
  if (c) return c;
  const shape = canonicalHash({ ...input.doc, origin: null, version: null });
  const same = byShape.get(shape);
  if (same) {
    c = {
      ...same,
      docHash: canonicalHash(input.doc),
      placement: { origin: { ...input.doc.origin }, rotationMdeg: input.doc.rotationMdeg },
    };
  } else {
    c = compile(input.doc, { trueNorthMdeg: 0 });
    if (byShape.size > 16) byShape.clear();
    byShape.set(shape, c);
  }
  compiled.set(input.doc, c);
  return c;
}

/** How a document changed for placement purposes (SPEC 27, AC-PD2). */
export type PlacementChange = 'none' | 'move' | 'rotate' | 'design';

export function placementChange(prev: BuildingDoc, next: BuildingDoc): PlacementChange {
  const strip = (d: BuildingDoc) => canonicalHash({ ...d, origin: null, rotationMdeg: null, version: null });
  if (strip(prev) !== strip(next) || prev.placeId !== next.placeId) return 'design';
  if (prev.rotationMdeg !== next.rotationMdeg) return 'rotate';
  if (prev.origin.x !== next.origin.x || prev.origin.y !== next.origin.y) return 'move';
  return 'none';
}

/**
 * Stages to rerun after a placement change. A move keeps the compiled geometry (only its placement
 * changes, no recompile) and reruns the sun and everything that reads it; a rotation also turns
 * every facade, so geometry reruns too; a design edit reruns all. Pass the result as
 * `JobRequest.stages` with the previous outputs in `JobInputs.previous`.
 */
export function stagesForPlacementChange(kind: PlacementChange): StageId[] {
  if (kind === 'none') return [];
  return ['geometry', 'sun', 'radiation', 'daylight', 'energy', 'codes', 'optimise'];
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

const energyCache = new Map<string, ReturnType<typeof energyModel>>();

export function computeEnergy(input: StageIn['energy'], tier: Tier): BuildingResult {
  const clim = climateOf(input.site);
  const params = {
    ...input.params,
    dhwSolarShare: input.params?.dhwSolarShare ?? settingNumber(input.settings, 'comfort.dhw.solarShare'),
  };
  const inputsHash = inputsHashOf('energy', {
    doc: input.compiled.docHash,
    rad: input.radiation?.inputsHash ?? null,
    settings: settingsKey(input.settings),
    clim: clim.id,
    place: input.site?.place.id ?? null,
    // Only present when levers are set, so hashes of the building as drawn do not change.
    ...(input.params && Object.keys(input.params).length > 0 ? { params: input.params } : {}),
  });
  const key = `${inputsHash}|${input.asOf}`;
  let core = energyCache.get(key);
  if (!core) {
    core = energyModel(input.compiled, clim, params, input.radiation);
    if (energyCache.size > 32) energyCache.clear();
    energyCache.set(key, core);
  }
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
      site: {
        lo: Math.min(res.eui.site.lo * 0.85, res.eui.site.hi * 1.05),
        hi: Math.max(res.eui.site.lo * 0.85, res.eui.site.hi * 1.05),
      },
      partial: true,
      missing,
    },
  };
}

/** Reference design EUI (kWh/m²·yr) for the baseline row and savings ladder (R35). */
export function baselineEuiOf(
  compiled: CompiledBuilding,
  site: SiteContext | undefined,
  spec: EnergyParams = STANDARD_DESIGN,
): number {
  const core = energyModel(compiled, climateOf(site), spec);
  const wh = END_USES.reduce((s, u) => s + core.wh[u].reduce((a, b) => a + b, 0), 0);
  const m2 = Number(compiled.quantities.ncaMm2) / 1e6;
  return m2 > 0 ? Math.round((wh / 1000 / m2) * 10) / 10 : 0;
}

/** Part L 2021 notional specifications (estimates): non-domestic and domestic, gas boiler heating. */
export const UK_NOTIONAL_NONDOM: EnergyParams = {
  uWall: 0.26,
  uRoof: 0.18,
  uWin: 1.6,
  shgc: 0.4,
  lpdScale: 0.8,
};
export const UK_NOTIONAL_DWELLING: EnergyParams = {
  uWall: 0.18,
  uRoof: 0.11,
  uWin: 1.2,
  shgc: 0.5,
  lpdScale: 0.8,
};
/** Future Homes and Buildings Standard notional (estimate): Part L 2021 dwelling fabric with a heat pump. */
export const FHS_NOTIONAL: EnergyParams = {
  uWall: 0.18,
  uRoof: 0.11,
  uWin: 1.2,
  shgc: 0.5,
  lpdScale: 0.7,
  heatPumpScop: 2.8,
};

/**
 * Code packs that apply at a place: the place's own list, else by location (India's bounding box
 * gets `codes-in`; elsewhere no code pack until one exists).
 */
export function codePacksFor(codePackIds: readonly string[], site: SiteContext | undefined): string[] {
  // Codes follow the plot's location: a regional pack from another country never applies.
  const region = regionOf(site?.place);
  if (region === 'in')
    return ['codes-in', ...codePackIds.filter((c) => !c.endsWith('-in') && !c.endsWith('-uk'))];
  if (region === 'uk')
    return ['codes-uk', ...codePackIds.filter((c) => !c.endsWith('-in') && !c.endsWith('-uk'))];
  return [...codePackIds];
}

export function computeCodes(input: StageIn['codes'], tier: Tier): CodesOut {
  const packs = codePacksFor(input.codePackIds, input.site);
  const india = packs.some((p) => p.endsWith('-in'));
  const uk = !india && packs.some((p) => p.endsWith('-uk')) && isNewBuildUk(input.doc);
  const core = uk
    ? ukCodes(
        input.doc,
        input.compiled,
        input.energy,
        input.site?.place,
        baselineEuiOf(
          input.compiled,
          input.site,
          UK_DWELLING_TYPES.has(input.doc.typeId) ? UK_NOTIONAL_DWELLING : UK_NOTIONAL_NONDOM,
        ),
        baselineEuiOf(input.compiled, input.site, FHS_NOTIONAL),
      )
    : codesModel(
        input.doc,
        input.compiled,
        input.energy,
        packs,
        india ? baselineEuiOf(input.compiled, input.site) : undefined,
      );
  const inputsHash = inputsHashOf('codes', {
    doc: input.compiled.docHash,
    energy: input.energy.inputsHash,
    packs,
    permit: input.doc.permitDate ?? null,
    ...(input.goals?.length ? { goals: input.goals.map((g) => g.goal) } : {}),
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
  const gaps = input.goals?.length
    ? goalGaps(input.goals, { codes, ratings, baselines: core.baselines, energy: input.energy })
    : undefined;
  return {
    codes,
    ratings,
    baselines: core.baselines,
    result: { ...input.energy, inputsHash, stamp, codes, ratings, baselines: core.baselines },
    ...(gaps ? { gaps } : {}),
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
    rad: input.radiation?.inputsHash ?? null,
    ...(input.params && Object.keys(input.params).length > 0 ? { params: input.params } : {}),
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
    {
      params: {
        ...input.params,
        dhwSolarShare:
          input.params?.dhwSolarShare ?? settingNumber(input.settings ?? [], 'comfort.dhw.solarShare'),
      },
      ...(input.radiation ? { radiation: input.radiation } : {}),
    },
  );
}
