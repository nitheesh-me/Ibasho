/**
 * Facade quantities per segment (BE 2.3, SPEC 22 `geom.*`): outward true azimuth, facade bin,
 * gross wall area, opening area from the window rule, WWR and projection factor. Exact bigint mm²
 * where the rule allows; a ratio rule rounds once to whole mm².
 */
import type { FacadeBin, Mdeg, Mm, Mm2, PointMm, Segment, ShadeRule, WindowRule } from '@ibasho/core';
import { facadeBin } from '@ibasho/core';
import { trueAzimuthMdeg } from './frame.ts';
import { edgeLength } from './polygon.ts';

/** Outward normal azimuth of edge a to b of a counter-clockwise ring, true millidegrees. */
export function edgeAzimuthMdeg(a: PointMm, b: PointMm, rotationMdeg: Mdeg, trueNorthMdeg: Mdeg = 0): Mdeg {
  return trueAzimuthMdeg(b[1] - a[1], a[0] - b[0], rotationMdeg, trueNorthMdeg);
}

export interface WindowGeom {
  /** Total glazed opening area, mm². */
  area: Mm2;
  /** Representative opening height and sill, mm (for PF and meshes). */
  height: Mm;
  sill: Mm;
  /** Count of openings (1 for a ratio rule). */
  count: number;
}

/** Window area and representative size on a wall `length` × `height` (gross, floor to floor). */
export function windowGeom(rule: WindowRule, length: Mm, height: Mm): WindowGeom {
  const gross = BigInt(Math.round(length)) * BigInt(height);
  switch (rule.kind) {
    case 'none':
      return { area: 0n, height: 0, sill: 0, count: 0 };
    case 'ratio': {
      const area = (gross * BigInt(rule.wwrPm)) / 1000n;
      const h =
        rule.head !== undefined
          ? rule.head - rule.sill
          : Math.min(height - rule.sill - 300, Math.round((height * rule.wwrPm) / 1000) + 600);
      return { area, height: Math.max(h, 300), sill: rule.sill, count: 1 };
    }
    case 'repeating': {
      const area = (gross * BigInt(rule.wwrPm)) / 1000n;
      const count = Math.max(1, Math.floor(length / Math.max(rule.spacing, 1)));
      return { area, height: rule.head - rule.sill, sill: rule.sill, count };
    }
    case 'single':
      return {
        area: BigInt(rule.width) * BigInt(rule.height),
        height: rule.height,
        sill: rule.sill,
        count: 1,
      };
    case 'detailed': {
      const glazed = rule.openings.filter((o) => o.kind !== 'door' && o.kind !== 'vent');
      const area = glazed.reduce((s, o) => s + BigInt(o.width) * BigInt(o.height), 0n);
      const first = glazed[0];
      return { area, height: first?.height ?? 0, sill: first?.v ?? 0, count: glazed.length };
    }
  }
}

/** Projection factor of the first overhang over a window (ECBC: PF = H / V), exact. */
export function projectionFactor(
  shading: readonly ShadeRule[],
  win: WindowGeom,
): { n: bigint; d: bigint } | undefined {
  const o = shading.find((s): s is Extract<ShadeRule, { kind: 'overhang' }> => s.kind === 'overhang');
  if (!o || win.height <= 0) return undefined;
  return { n: BigInt(o.depth), d: BigInt(win.height + o.aboveHead) };
}

export interface SegmentFacade {
  segId: string;
  azimuthMdeg: Mdeg;
  bin: FacadeBin;
  length: Mm;
  grossMm2: Mm2;
  window: WindowGeom;
  pf?: { n: bigint; d: bigint };
}

/** Facade figures for one exterior segment on edge a to b. */
export function segmentFacade(
  seg: Segment,
  a: PointMm,
  b: PointMm,
  floorToFloor: Mm,
  rotationMdeg: Mdeg,
  trueNorthMdeg: Mdeg = 0,
): SegmentFacade {
  const length = Math.round(edgeLength(a, b));
  const az = edgeAzimuthMdeg(a, b, rotationMdeg, trueNorthMdeg);
  const window = windowGeom(seg.window, length, floorToFloor);
  const pf = projectionFactor(seg.shading, window);
  return {
    segId: seg.id,
    azimuthMdeg: az,
    bin: facadeBin(az),
    length,
    grossMm2: BigInt(length) * BigInt(floorToFloor),
    window,
    ...(pf ? { pf } : {}),
  };
}

/** WWR per mille from facade sums. */
export const wwrPm = (openingMm2: Mm2, grossMm2: Mm2): number =>
  grossMm2 === 0n ? 0 : Number((openingMm2 * 1000n) / grossMm2);
