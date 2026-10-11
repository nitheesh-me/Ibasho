/**
 * Snapping (BE 3.2): typed value, then existing vertex, then edge, then grid, then angle lock.
 * Owner: WP-15. Shift disables snapping. Grid is 100 mm by default, 300 mm on touch.
 */
import type { PlanPointer, PointMm } from '@ibasho/core';
import { distToSegment } from './geom.ts';

export interface SnapContext {
  grid: number;
  /** Snap radius in mm (scale with zoom: about 12 screen pixels). */
  tol: number;
  vertices: readonly PointMm[];
  edges: readonly [PointMm, PointMm][];
  /** Start of the current stroke, for the 15 degree angle lock. */
  anchor?: PointMm;
  off?: boolean;
}

export function snapPoint(
  p: readonly [number, number],
  ctx: SnapContext,
): { pt: PointMm; kind: PlanPointer['snapped'] } {
  if (ctx.off) return { pt: [Math.round(p[0]), Math.round(p[1])], kind: 'none' };
  let best: PointMm | undefined;
  let bestD = ctx.tol;
  for (const v of ctx.vertices) {
    const d = Math.hypot(v[0] - p[0], v[1] - p[1]);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  if (best) return { pt: [best[0], best[1]], kind: 'edge' };
  const g = ctx.grid;
  let pt: PointMm = [Math.round(p[0] / g) * g, Math.round(p[1] / g) * g];
  let kind: PlanPointer['snapped'] = 'grid';
  for (const [a, b] of ctx.edges) {
    const { d, t } = distToSegment(p, a, b);
    if (d < ctx.tol / 2) {
      const x = a[0] + t * (b[0] - a[0]);
      const y = a[1] + t * (b[1] - a[1]);
      // Keep the grid on the free axis of an axis-aligned edge.
      pt = a[0] === b[0] ? [a[0], pt[1]] : a[1] === b[1] ? [pt[0], a[1]] : [Math.round(x), Math.round(y)];
      kind = 'edge';
      break;
    }
  }
  if (ctx.anchor) {
    const dx = pt[0] - ctx.anchor[0];
    const dy = pt[1] - ctx.anchor[1];
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      const step = Math.PI / 12;
      const ang = Math.round(Math.atan2(dy, dx) / step) * step;
      const snapped: PointMm = [
        Math.round((ctx.anchor[0] + Math.cos(ang) * len) / g) * g,
        Math.round((ctx.anchor[1] + Math.sin(ang) * len) / g) * g,
      ];
      if (Math.hypot(snapped[0] - pt[0], snapped[1] - pt[1]) < ctx.tol) return { pt: snapped, kind: 'angle' };
    }
  }
  return { pt, kind };
}

/**
 * Parse a typed dimension: metres ("4.2", "4.2 m"), millimetres ("4200 mm"), feet and inches
 * ("23'6\""), or a size "12 x 8". Returns millimetres.
 */
export function parseLength(text: string): number | undefined {
  const t = text.trim().toLowerCase();
  const ft = /^(\d+(?:\.\d+)?)'\s*(?:(\d+(?:\.\d+)?)(?:"|in)?)?$/.exec(t);
  if (ft) return Math.round(Number(ft[1]) * 304.8 + Number(ft[2] ?? 0) * 25.4);
  const mm = /^(\d+(?:\.\d+)?)\s*mm$/.exec(t);
  if (mm) return Math.round(Number(mm[1]));
  const m = /^(\d+(?:\.\d+)?)\s*m?$/.exec(t);
  if (m) return Math.round(Number(m[1]) * 1000);
  return undefined;
}

export function parseSize(text: string): [number, number] | undefined {
  const parts = text.split(/\s*[x×*,]\s*/);
  if (parts.length !== 2) return undefined;
  const a = parseLength(parts[0] ?? '');
  const b = parseLength(parts[1] ?? '');
  return a && b ? [a, b] : undefined;
}
