/**
 * Lens kernels off the main thread (QA round): the preview site result and the sun hours grid.
 * The same `handle` runs inline when workers are unavailable (tests, old browsers). Owner: WP-07.
 */
import type { SiteResult } from '@ibasho/core';
import { type CastLoss, type CastReceiver, castLosses } from './cast.ts';
import type { EN } from './frame.ts';
import type { HeroModel } from './hero.ts';
import { previewRoofRadiation, previewSite } from './preview.ts';
import { type Caster, type Grid, gridAround, rasterise, type SunHoursGrid, sunHoursGrid } from './shadow.ts';

export type KernelRequest =
  | {
      kind: 'site';
      hero: HeroModel;
      casters: Caster[];
      place: { lat: number; lon: number; tzHours?: number };
    }
  | {
      kind: 'sun-hours';
      hero: HeroModel;
      casters: Caster[];
      place: { lat: number; lon: number; tzHours?: number };
      date: string;
    }
  | {
      kind: 'roof-rad';
      hero: HeroModel;
      casters: Caster[];
      place: { lat: number; lon: number; tzHours?: number };
    }
  | {
      kind: 'cast';
      hero: HeroModel;
      context: Caster[];
      receivers: CastReceiver[];
      addedM: number;
      place: { lat: number; lon: number; tzHours?: number };
    };
export type KernelResult =
  | { kind: 'site'; site: SiteResult }
  | { kind: 'sun-hours'; grid: SunHoursGrid }
  | { kind: 'roof-rad'; grid: Grid; kwh: Float32Array }
  | { kind: 'cast'; losses: CastLoss[]; addedM: number };

/** A 1.5 m grid over the hero's footprint for roof radiation. */
export function roofGrid(hero: HeroModel): Grid {
  const c: EN = [(hero.box.minE + hero.box.maxE) / 2, (hero.box.minN + hero.box.maxN) / 2];
  const half = Math.max(hero.box.maxE - hero.box.minE, hero.box.maxN - hero.box.minN) / 2 + 4;
  return gridAround(c, half, 1.5);
}

/** The site grid around the hero: ground at 0 m and the hero's top roof at its height. */
export function heroGrid(hero: HeroModel): Grid {
  const c: EN = [(hero.box.minE + hero.box.maxE) / 2, (hero.box.minN + hero.box.maxN) / 2];
  return gridAround(c, 230, 3);
}

export function handle(req: KernelRequest): KernelResult {
  if (req.kind === 'site') return { kind: 'site', site: previewSite(req.hero, req.casters, req.place) };
  if (req.kind === 'roof-rad') {
    const grid = roofGrid(req.hero);
    return { kind: 'roof-rad', grid, kwh: previewRoofRadiation(req.hero, req.casters, req.place, grid) };
  }
  if (req.kind === 'cast')
    return {
      kind: 'cast',
      addedM: req.addedM,
      losses: castLosses({
        hero: req.hero,
        context: req.context,
        receivers: req.receivers,
        addedM: req.addedM,
        place: req.place,
      }),
    };
  const grid = heroGrid(req.hero);
  const heights = new Float32Array(grid.cols * grid.rows);
  const mask = new Uint8Array(heights.length);
  const top = req.hero.storeys.filter((s) => !s.belowGrade).at(-1);
  for (const r of req.hero.rooms) if (r.storeyId === top?.id) rasterise(r.ring, grid, mask);
  for (let i = 0; i < heights.length; i++) if (mask[i]) heights[i] = req.hero.height;
  return {
    kind: 'sun-hours',
    grid: sunHoursGrid({
      grid,
      casters: req.casters,
      date: req.date,
      lat: req.place.lat,
      lon: req.place.lon,
      ...(req.place.tzHours !== undefined ? { tzHours: req.place.tzHours } : {}),
      stepMin: 10,
      receiverHeight: heights,
    }),
  };
}

interface WorkerScope {
  onmessage: ((e: { data: { id: number; req: KernelRequest } }) => void) | null;
  postMessage(m: unknown): void;
}
const scope = globalThis as unknown as WorkerScope & { WorkerGlobalScope?: unknown };
if (typeof scope.WorkerGlobalScope !== 'undefined') {
  scope.onmessage = (e) => {
    scope.postMessage({ id: e.data.id, result: handle(e.data.req) });
  };
}
