/**
 * City stage model: props to masses, hero, casters and the analysis the lenses paint, with the
 * stand ins applied only where a prop is `undefined` (never where it is `null`, which means "not
 * computed yet"). Pure. Owner: WP-07.
 */
import type { BuildingDoc, CityTile, CompiledBuilding, Mm, SiteResult } from '@ibasho/core';
import { type Box2, boxOf, type EN, growBox } from './frame.ts';
import { type ContextMass, drawnHeight, massesOf } from './geometry.ts';
import { type HeroModel, heroFromCompiled, heroFromDoc } from './hero.ts';
import { previewDaylight, previewSite } from './preview.ts';
import type { Caster } from './shadow.ts';
import { standInCity } from './standin.ts';
import type { DaylightGrid, LanternDatum } from './types.ts';
import { IIIT_ORIGIN, vindhyaStandIn } from './vindhya.ts';

export interface CityPlace {
  lat: number;
  lon: number;
  /** Hours from UTC of local standard time (IST 5.5). */
  tzHours?: number;
  name?: string;
}

export interface CityModelInput {
  place?: CityPlace;
  tiles?: readonly CityTile[];
  roads?: readonly { points: EN[]; width: number }[];
  hero?: BuildingDoc | null;
  compiled?: CompiledBuilding | null;
  heightOverrides?: Readonly<Record<string, Mm>>;
  /** Context ids the modelled hero stands in for (pack `HERO_CONTEXT_IDS`); not drawn. */
  hideContextIds?: readonly string[];
}

export interface CityModel {
  place: CityPlace;
  masses: ContextMass[];
  trees: { at: EN; r: number; h: number }[];
  roads: { points: EN[]; width: number }[];
  hero: HeroModel | null;
  heroDoc: BuildingDoc | null;
  casters: Caster[];
  cityBox: Box2;
  /** True when any part is a stand in (the legend says so). */
  standIn: { context: boolean; hero: boolean };
}

export const DEFAULT_PLACE: CityPlace = { ...IIIT_ORIGIN, tzHours: 5.5, name: 'IIIT Hyderabad, Gachibowli' };

let standInDoc: BuildingDoc | null = null;
const vindhya = (): BuildingDoc => {
  standInDoc ??= vindhyaStandIn();
  return standInDoc;
};

export function cityModel(input: CityModelInput): CityModel {
  const city = input.tiles === undefined ? standInCity() : null;
  const tiles = input.tiles ?? city!.tiles;
  const hide = new Set(input.hideContextIds ?? []);
  const buildings = tiles.flatMap((t) => t.buildings).filter((b) => !hide.has(b.id));
  const masses = massesOf(buildings, input.heightOverrides);
  const trees = tiles.flatMap((t) =>
    t.trees.map((tr) => ({
      at: [tr.at[0] / 1000, tr.at[1] / 1000] as EN,
      r: tr.crownRadius / 1000,
      h: tr.height.likely / 1000,
    })),
  );
  const heroDoc = input.hero === undefined ? vindhya() : input.hero;
  const hero = heroDoc
    ? input.compiled?.meshes
      ? heroFromCompiled(heroDoc, input.compiled.meshes)
      : heroFromDoc(heroDoc)
    : null;
  // Unknown heights never shade (Agent A, QA round 1): only known or entered heights cast.
  const casters: Caster[] = masses
    .filter((m) => !(m.source === 'unknown' && m.user === undefined))
    .map((m) => ({ id: m.id, ring: m.ring, z1: drawnHeight(m) }));
  if (hero) for (const p of hero.prisms) casters.push({ id: p.id, ring: p.ring, z1: p.z1 });
  const pts: EN[] = masses.flatMap((m) => m.ring);
  if (hero) pts.push([hero.box.minE, hero.box.minN], [hero.box.maxE, hero.box.maxN]);
  const cityBox = pts.length ? growBox(boxOf(pts), 40) : { minE: -500, minN: -500, maxE: 500, maxN: 500 };
  return {
    place: input.place ?? DEFAULT_PLACE,
    masses,
    trees,
    roads: [...(input.roads ?? city?.roads ?? [])],
    hero,
    heroDoc,
    casters,
    cityBox,
    standIn: { context: input.tiles === undefined, hero: input.hero === undefined },
  };
}

/** Lens data: given values, or the scene's labelled estimate when the prop is `undefined`. */
export function lensData(
  model: CityModel,
  site: SiteResult | null | undefined,
  daylight: readonly DaylightGrid[] | null | undefined,
): {
  site: SiteResult | null;
  daylight: readonly DaylightGrid[] | null;
  estimated: { site: boolean; daylight: boolean };
} {
  const estSite = site === undefined && !!model.hero;
  const estDay = daylight === undefined && !!model.heroDoc;
  return {
    site: estSite ? previewSite(model.hero!, model.casters, model.place) : (site ?? null),
    daylight: estDay ? previewDaylight(model.heroDoc!) : (daylight ?? null),
    estimated: { site: estSite, daylight: estDay },
  };
}

const DAY_PROFILE = [
  0.35, 0.33, 0.32, 0.32, 0.33, 0.36, 0.45, 0.6, 0.78, 0.9, 0.96, 1, 1, 1, 0.98, 0.95, 0.9, 0.82, 0.72, 0.62,
  0.55, 0.48, 0.42, 0.38,
];
const HOME_PROFILE = [
  0.3, 0.25, 0.22, 0.2, 0.2, 0.3, 0.55, 0.6, 0.45, 0.35, 0.3, 0.3, 0.32, 0.32, 0.35, 0.4, 0.5, 0.7, 0.92, 1,
  1, 0.9, 0.7, 0.45,
];

/**
 * Preview lanterns (moment 8): the hero plus up to six named neighbours near it, so brightness and
 * hue can be compared. Figures are illustrative Preview values by use (cooling led academic blocks,
 * lighting led residences, equipment led labs and offices), never results.
 */
export function defaultLanterns(model: CityModel): LanternDatum[] {
  if (!model.hero) return [];
  const out: LanternDatum[] = [
    { buildingId: model.hero.id, euiKwhM2: 168, dominant: 'cooling', hourly: DAY_PROFILE },
  ];
  const hc: EN = [
    (model.hero.box.minE + model.hero.box.maxE) / 2,
    (model.hero.box.minN + model.hero.box.maxN) / 2,
  ];
  const near = model.masses
    .filter((m) => m.name)
    .map((m) => {
      const b = boxOf(m.ring);
      const d = Math.hypot((b.minE + b.maxE) / 2 - hc[0], (b.minN + b.maxN) / 2 - hc[1]);
      return { m, d, area: (b.maxE - b.minE) * (b.maxN - b.minN) };
    })
    .filter((x) => x.d < 700 && x.area > 400)
    .sort((a, b) => a.d - b.d)
    .slice(0, 6);
  for (const { m } of near) {
    const n = (m.name ?? '').toLowerCase();
    const home = /nivas|hostel|residen|quarters|apartment|housing/.test(n);
    const lab = /lab|research|incubat|d block|centre|center|data|server|tower|tech/.test(n);
    out.push({
      buildingId: m.id,
      euiKwhM2: home ? 95 : lab ? 240 : 150,
      dominant: home ? 'lighting' : lab ? 'equipment' : 'cooling',
      hourly: home ? HOME_PROFILE : DAY_PROFILE,
    });
  }
  return out;
}

/** Emissive strength of a lantern at a local hour, 0 to about 1.6, on the stated scale. */
export const LANTERN_SCALE_KWH = 300;
export function lanternStrength(d: LanternDatum, hour: number): number {
  const h = d.hourly?.[((Math.floor(hour) % 24) + 24) % 24] ?? 1;
  return Math.min(1.6, (d.euiKwhM2 / LANTERN_SCALE_KWH) * 1.6) * (0.35 + 0.65 * h);
}
