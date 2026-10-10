/**
 * Cutaway composition (fukinuki yatai, DESIGN_SYSTEM 10), shared by WebGL and SVG so both draw
 * the same house from the same camera. Owner: WP-07.
 *
 * In the cutaway, party walls and gables that face the camera are cut (drawn as a section
 * outline), the roof floats up by `roofLiftM`, and the top ceiling fades with `ceiling`.
 */
import type { Vec3 } from '@ibasho/core';
import { dot } from '../twin/frame.ts';
import type { HouseModel, Surface } from '../twin/house.ts';
import { eyeDirection } from './model.ts';

export type ViewKind = 'cutaway' | 'exterior';

export interface ViewSpec {
  view: ViewKind;
  azimuthDeg: number;
  elevationDeg: number;
  roofLiftM: number;
  /** 1 solid, 0 dissolved (top ceiling only). */
  ceiling: number;
}

export type SurfaceMode = 'solid' | 'cut' | 'hidden';

export interface ComposedSurface {
  surface: Surface;
  mode: SurfaceMode;
  /** Translation applied to the surface (roof lift). */
  offset: Vec3;
  opacity: number;
}

export function isRoofPart(s: Surface): boolean {
  return s.role === 'roof-slope';
}

export function composeView(house: HouseModel, v: ViewSpec): ComposedSurface[] {
  const eye = eyeDirection(v.azimuthDeg, v.elevationDeg);
  const lift: Vec3 = [0, v.roofLiftM, 0];
  return house.surfaces.map((s) => {
    const facing = dot(s.frame.n, eye) > 0.3;
    if (v.view === 'cutaway') {
      if ((s.role === 'party-wall' || s.role === 'gable') && facing && Math.abs(s.frame.n[1]) < 0.2) {
        return { surface: s, mode: 'cut', offset: s.role === 'gable' ? lift : [0, 0, 0], opacity: 1 };
      }
      if (s.role === 'gable') return { surface: s, mode: 'solid', offset: lift, opacity: 1 };
      if (isRoofPart(s)) return { surface: s, mode: 'solid', offset: lift, opacity: 1 };
      if (s.role === 'loft-floor') {
        return { surface: s, mode: 'solid', offset: [0, 0, 0], opacity: 0.4 + 0.6 * v.ceiling };
      }
    }
    return { surface: s, mode: 'solid', offset: [0, 0, 0], opacity: 1 };
  });
}

/** Elements the cutaway hides behind a section cut (outline only). */
export function cutElementIds(composed: readonly ComposedSurface[]): Set<string> {
  const out = new Set<string>();
  for (const c of composed) if (c.mode === 'cut' && c.surface.elementId) out.add(c.surface.elementId);
  return out;
}
