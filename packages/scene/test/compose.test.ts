/** Cutaway composition: one surface list for WebGL and SVG, cut only what faces the camera. */
import { describe, expect, it } from 'vitest';
import { composeView, cutElementIds, isRoofPart, type ViewSpec } from '../src/camera/compose.ts';
import { eyeDirection } from '../src/camera/model.ts';
import { dot } from '../src/twin/frame.ts';
import { house } from './helpers.ts';

const spec = (over: Partial<ViewSpec> = {}): ViewSpec => ({
  view: 'cutaway',
  azimuthDeg: 45,
  elevationDeg: 30,
  roofLiftM: 2,
  ceiling: 0.35,
  ...over,
});

describe('composeView', () => {
  it('keeps one entry per surface, in model order', () => {
    for (const view of ['cutaway', 'exterior'] as const) {
      const c = composeView(house, spec({ view }));
      expect(c.map((x) => x.surface.key)).toEqual(house.surfaces.map((s) => s.key));
    }
  });

  it('exterior draws everything solid, unlifted and opaque', () => {
    for (const c of composeView(house, spec({ view: 'exterior' }))) {
      expect(c.mode).toBe('solid');
      expect(c.offset).toEqual([0, 0, 0]);
      expect(c.opacity).toBe(1);
    }
  });

  it('cutaway lifts every roof slope and gable by the lift height and nothing else', () => {
    for (const c of composeView(house, spec({ roofLiftM: 1.5 }))) {
      const lifted = isRoofPart(c.surface) || c.surface.role === 'gable';
      expect(c.offset, c.surface.key).toEqual(lifted ? [0, 1.5, 0] : [0, 0, 0]);
    }
  });

  it('cuts only party walls and gables that face the camera', () => {
    for (const az of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const eye = eyeDirection(az, 30);
      for (const c of composeView(house, spec({ azimuthDeg: az }))) {
        if (c.mode !== 'cut') continue;
        expect(['party-wall', 'gable']).toContain(c.surface.role);
        expect(dot(c.surface.frame.n, eye)).toBeGreaterThan(0.3);
      }
    }
  });

  it('cuts something from some azimuth, and the cut ids are twin elements', () => {
    const cuts = [0, 90, 180, 270].map((az) => cutElementIds(composeView(house, spec({ azimuthDeg: az }))));
    expect(cuts.some((s) => s.size > 0)).toBe(true);
    for (const s of cuts) for (const id of s) expect(id.length).toBeGreaterThan(0);
  });

  it('fades the loft ceiling with `ceiling`, from 0.4 to 1, and never hides it', () => {
    const op = (ceiling: number) =>
      composeView(house, spec({ ceiling }))
        .filter((c) => c.surface.role === 'loft-floor')
        .map((c) => c.opacity);
    const lo = op(0);
    const hi = op(1);
    expect(lo.length).toBeGreaterThan(0);
    for (const o of lo) expect(o).toBeCloseTo(0.4, 9);
    for (const o of hi) expect(o).toBe(1);
  });

  it('is pure: the same spec gives the same composition', () => {
    expect(JSON.stringify(composeView(house, spec()))).toBe(JSON.stringify(composeView(house, spec())));
  });
});
