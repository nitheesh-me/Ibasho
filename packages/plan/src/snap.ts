/** Editor snapping helpers (BE 3.3): grid, points and orthogonal, all whole millimetres. */
import type { Mm, PointMm } from '@ibasho/core';

export const snapToGrid = (p: PointMm, grid: Mm): PointMm => [
  Math.round(p[0] / grid) * grid,
  Math.round(p[1] / grid) * grid,
];

/** Nearest of `targets` within `tolerance` mm, else undefined. */
export function snapToPoints(p: PointMm, targets: readonly PointMm[], tolerance: Mm): PointMm | undefined {
  let best: PointMm | undefined;
  let bestD = tolerance * tolerance;
  for (const t of targets) {
    const d = (t[0] - p[0]) * (t[0] - p[0]) + (t[1] - p[1]) * (t[1] - p[1]);
    if (d <= bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/** Keep the move from `from` horizontal or vertical, whichever is closer. */
export const snapOrthogonal = (from: PointMm, p: PointMm): PointMm =>
  Math.abs(p[0] - from[0]) >= Math.abs(p[1] - from[1]) ? [p[0], from[1]] : [from[0], p[1]];
