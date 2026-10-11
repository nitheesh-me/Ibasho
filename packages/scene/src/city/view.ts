/**
 * The zoom ladder (PLAN-V3 5: City, Site, Building, Floor, Room) as camera frames, and the
 * orthographic camera maths shared by the WebGL and SVG renderers. Pure. Owner: WP-07.
 */
import { type Box2, boxOf, type EN } from './frame.ts';
import type { HeroModel } from './hero.ts';
import type { CityFocus, ZoomLevel } from './types.ts';

export interface CityView {
  /** Point looked at: east, height and north, metres (world is [east, height, -north]). */
  target: [number, number, number];
  /** Half height of the orthographic frustum, metres. */
  halfH: number;
  azimuthDeg: number;
  elevationDeg: number;
}

export const LEVEL_ELEVATION: Record<ZoomLevel, number> = {
  city: 42,
  site: 36,
  building: 30,
  floor: 56,
  room: 52,
};

const centre = (b: Box2): EN => [(b.minE + b.maxE) / 2, (b.minN + b.maxN) / 2];
const span = (b: Box2): number => Math.max(b.maxE - b.minE, b.maxN - b.minN);

/**
 * Frame for a level. `cityBox` is the extent of the context; `storeyId` and `roomId` focus the
 * floor and room levels; `aspect` is width over height of the viewport.
 */
export function levelView(opts: {
  level: ZoomLevel;
  hero: HeroModel | null;
  cityBox: Box2;
  azimuthDeg: number;
  aspect: number;
  storeyId?: string;
  roomId?: string;
}): CityView {
  const { level, hero, cityBox, azimuthDeg, aspect } = opts;
  const elevationDeg = LEVEL_ELEVATION[level];
  // Fit a square of side s: the frustum is 2 halfH tall and 2 halfH aspect wide.
  const fit = (s: number): number => (s / 2) * Math.max(1, 1 / Math.max(aspect, 0.3));
  if (!hero || level === 'city') {
    const c = centre(cityBox);
    return { target: [c[0], 0, c[1]], halfH: fit(span(cityBox) * 0.62), azimuthDeg, elevationDeg };
  }
  const hc = centre(hero.box);
  const hs = span(hero.box);
  switch (level) {
    case 'site':
      return { target: [hc[0], 0, hc[1]], halfH: fit(hs + 260), azimuthDeg, elevationDeg };
    case 'building':
      return {
        target: [hc[0], hero.height * 0.35, hc[1]],
        halfH: fit(hs * 0.82 + 14),
        azimuthDeg,
        elevationDeg,
      };
    case 'floor': {
      const st = hero.storeys.find((s) => s.id === opts.storeyId) ?? firstAbove(hero);
      return { target: [hc[0], st?.z0 ?? 0, hc[1]], halfH: fit(hs * 0.74 + 8), azimuthDeg, elevationDeg };
    }
    case 'room': {
      const room =
        hero.rooms.find((r) => r.id === opts.roomId) ?? hero.rooms.find((r) => r.storeyId === opts.storeyId);
      if (!room) return { target: [hc[0], 0, hc[1]], halfH: fit(hs * 0.7), azimuthDeg, elevationDeg };
      const b = boxOf(room.ring);
      const c = centre(b);
      return { target: [c[0], room.z0, c[1]], halfH: fit(span(b) + 10), azimuthDeg, elevationDeg };
    }
  }
}

export function firstAbove(hero: HeroModel): HeroModel['storeys'][number] | undefined {
  return hero.storeys.find((s) => !s.belowGrade) ?? hero.storeys[0];
}

/** Unit vector from the target to the eye, world frame (x east, y up, z south). */
export function eyeVector(azimuthDeg: number, elevationDeg: number): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  // Looking from bearing `azimuthDeg` towards the target.
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

/** Blend two views (shortest way round for the azimuth). */
export function blendView(a: CityView, b: CityView, t: number): CityView {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  let da = b.azimuthDeg - a.azimuthDeg;
  da = ((((da + 180) % 360) + 360) % 360) - 180;
  const lerp = (x: number, y: number): number => x + (y - x) * k;
  return {
    target: [lerp(a.target[0], b.target[0]), lerp(a.target[1], b.target[1]), lerp(a.target[2], b.target[2])],
    // Zoom in log space so the city to room move feels even.
    halfH: Math.exp(lerp(Math.log(a.halfH), Math.log(b.halfH))),
    azimuthDeg: a.azimuthDeg + da * k,
    elevationDeg: lerp(a.elevationDeg, b.elevationDeg),
  };
}

/** `--t-ori` curve, 900 ms. */
export const LEVEL_MOVE_MS = 900;
export const easeOri = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * What a focus resolves to: the ladder level and storey or room to use for the hero, or a frame
 * of its own for a neighbour or a bare bounding box. `null` when nothing matches.
 */
export type FocusResolution =
  | { kind: 'hero'; level: ZoomLevel; storeyId?: string; roomId?: string }
  | { kind: 'frame'; view: CityView; contextId?: string; bboxMm?: CityFocus['bboxMm'] };

export function resolveFocus(opts: {
  focus: CityFocus;
  hero: HeroModel | null;
  masses: readonly { id: string; ring: EN[]; likely: number; user?: number }[];
  azimuthDeg: number;
  aspect: number;
}): FocusResolution | null {
  const { focus, hero, azimuthDeg, aspect } = opts;
  const fit = (s: number): number => (s / 2) * Math.max(1, 1 / Math.max(aspect, 0.3));
  if (hero && focus.buildingId === hero.id) {
    if (focus.kind === 'building') return { kind: 'hero', level: 'building' };
    const room = focus.roomId ? hero.rooms.find((r) => r.id === focus.roomId) : undefined;
    const storeyId = focus.storeyId ?? room?.storeyId;
    if (focus.kind === 'room' && room)
      return { kind: 'hero', level: 'room', roomId: room.id, storeyId: room.storeyId };
    if (storeyId && hero.storeys.some((s) => s.id === storeyId))
      return { kind: 'hero', level: 'floor', storeyId };
    return { kind: 'hero', level: 'building' };
  }
  const m = opts.masses.find((x) => x.id === focus.buildingId);
  if (m) {
    const b = boxOf(m.ring);
    const c = centre(b);
    const h = m.user ?? m.likely;
    return {
      kind: 'frame',
      contextId: m.id,
      view: {
        target: [c[0], h * 0.4, c[1]],
        halfH: fit(span(b) * 1.6 + h + 30),
        azimuthDeg,
        elevationDeg: 34,
      },
    };
  }
  if (focus.bboxMm) {
    const b = {
      minE: focus.bboxMm.minX / 1000,
      minN: focus.bboxMm.minY / 1000,
      maxE: focus.bboxMm.maxX / 1000,
      maxN: focus.bboxMm.maxY / 1000,
    };
    const c = centre(b);
    return {
      kind: 'frame',
      view: { target: [c[0], 0, c[1]], halfH: fit(span(b) * 1.6 + 40), azimuthDeg, elevationDeg: 36 },
    };
  }
  return null;
}

/** A place search hit (`PlaceHit` from `@ibasho/plan` search) as a stage focus. */
export function focusFromHit(hit: {
  kind: 'place' | 'building' | 'storey' | 'room';
  id: string;
  buildingId: string;
  storeyId?: string;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}): CityFocus {
  // A place (campus) or a part of a building (`gb2#shodh`) has no geometry here: frame its box.
  if (hit.kind === 'place') return { kind: 'building', buildingId: `place:${hit.id}`, bboxMm: hit.bbox };
  if (hit.kind === 'building' && hit.id.includes('#'))
    return { kind: 'building', buildingId: hit.id, bboxMm: hit.bbox };
  const base = { buildingId: hit.buildingId, bboxMm: hit.bbox };
  if (hit.kind === 'room')
    return { ...base, kind: 'room', roomId: hit.id, ...(hit.storeyId ? { storeyId: hit.storeyId } : {}) };
  if (hit.kind === 'storey') return { ...base, kind: 'storey', storeyId: hit.id };
  return { ...base, kind: 'building' };
}
