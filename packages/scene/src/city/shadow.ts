/**
 * Ground shadows, the penumbra of uncertain heights and a preview sun hours grid (PLAN-V3
 * moments 1 and 2). Owner: WP-07.
 *
 * This is the scene's preview kernel (ARCH 15.5: it never feeds a certificate). It projects each
 * extruded footprint onto a horizontal receiver: for a convex footprint the shadow is the convex
 * hull of the footprint and its copy displaced away from the sun by h / tan(altitude); otherwise
 * the footprint plus one quad per edge. Shadows are then rasterised on a regular grid.
 */
import type { EN } from './frame.ts';
import { type CitySun, dayWindow, sunOf } from './sun.ts';

/** An extruded footprint casting shadows. Heights in metres above the ground. */
export interface Caster {
  id: string;
  ring: EN[];
  z1: number;
}

/** Horizontal displacement (m, east and north) of a point `h` metres above its receiver. */
export function shadowOffset(h: number, sun: Pick<CitySun, 'azimuthDeg' | 'altitudeDeg'>): EN {
  const alt = (Math.max(sun.altitudeDeg, 0.5) * Math.PI) / 180;
  const az = (sun.azimuthDeg * Math.PI) / 180;
  const len = h / Math.tan(alt);
  return [-Math.sin(az) * len, -Math.cos(az) * len];
}

function cross(o: EN, a: EN, b: EN): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

export function convexHull(points: readonly EN[]): EN[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lower: EN[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0)
      lower.pop();
    lower.push(q);
  }
  const upper: EN[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0)
      upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export function isConvex(ring: readonly EN[]): boolean {
  let sign = 0;
  for (let i = 0; i < ring.length; i++) {
    const c = cross(ring[i]!, ring[(i + 1) % ring.length]!, ring[(i + 2) % ring.length]!);
    if (Math.abs(c) < 1e-9) continue;
    const s = c > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Polygons whose union is the shadow of `ring` extruded `h` metres above the receiver. */
export function shadowPolygons(
  ring: readonly EN[],
  h: number,
  sun: Pick<CitySun, 'azimuthDeg' | 'altitudeDeg'>,
): EN[][] {
  if (h <= 0) return [];
  const [dx, dy] = shadowOffset(h, sun);
  const moved = ring.map(([e, n]) => [e + dx, n + dy] as EN);
  if (isConvex(ring)) return [convexHull([...ring, ...moved])];
  const out: EN[][] = [[...ring]];
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    out.push(convexHull([ring[i]!, ring[j]!, moved[j]!, moved[i]!]));
  }
  return out;
}

export interface Grid {
  minE: number;
  minN: number;
  cell: number;
  cols: number;
  rows: number;
}

export function gridAround(c: EN, halfM: number, cell: number): Grid {
  const n = Math.ceil((2 * halfM) / cell);
  return { minE: c[0] - halfM, minN: c[1] - halfM, cell, cols: n, rows: n };
}

/** Set `value` in every cell whose centre lies inside the convex or simple polygon. */
export function rasterise(poly: readonly EN[], g: Grid, out: Uint8Array, value = 1): void {
  let minE = Infinity;
  let maxE = -Infinity;
  let minN = Infinity;
  let maxN = -Infinity;
  for (const [e, n] of poly) {
    if (e < minE) minE = e;
    if (e > maxE) maxE = e;
    if (n < minN) minN = n;
    if (n > maxN) maxN = n;
  }
  const c0 = Math.max(0, Math.floor((minE - g.minE) / g.cell));
  const c1 = Math.min(g.cols - 1, Math.ceil((maxE - g.minE) / g.cell));
  const r0 = Math.max(0, Math.floor((minN - g.minN) / g.cell));
  const r1 = Math.min(g.rows - 1, Math.ceil((maxN - g.minN) / g.cell));
  if (c0 > c1 || r0 > r1) return;
  const len = poly.length;
  for (let r = r0; r <= r1; r++) {
    const y = g.minN + (r + 0.5) * g.cell;
    // Scanline: crossings of this row with the polygon edges.
    const xs: number[] = [];
    for (let i = 0, j = len - 1; i < len; j = i++) {
      const [xi, yi] = poly[i]!;
      const [xj, yj] = poly[j]!;
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(c0, Math.ceil((xs[k]! - g.minE) / g.cell - 0.5));
      const b = Math.min(c1, Math.floor((xs[k + 1]! - g.minE) / g.cell - 0.5));
      for (let c = a; c <= b; c++) out[r * g.cols + c] = value;
    }
  }
}

export interface SunHoursGrid {
  grid: Grid;
  date: string;
  stepMin: number;
  /** Local minutes of step 0. */
  startMin: number;
  steps: number;
  /** `cum[k * cells + i]`: sunlit steps of cell `i` before step `k` (k = 0 to steps). */
  cum: Uint16Array;
  /** Cells covered by a caster at the receiver height (roofs and walls), never lit. */
  covered: Uint8Array;
}

/**
 * Sunlit steps per cell over one day. `receiverHeight` gives each cell its receiver height in
 * metres (0 for the ground, the roof height over the hero), so roofs and ground share one grid.
 */
export function sunHoursGrid(opts: {
  grid: Grid;
  casters: readonly Caster[];
  date: string;
  lat: number;
  lon: number;
  tzHours?: number;
  stepMin?: number;
  receiverHeight?: Float32Array;
}): SunHoursGrid {
  const { grid, casters, date, lat, lon } = opts;
  const stepMin = opts.stepMin ?? 10;
  const cells = grid.cols * grid.rows;
  const w = dayWindow(date, lat, lon, opts.tzHours);
  const startMin = Math.floor(w.rise / stepMin) * stepMin;
  const steps = Math.ceil((w.set - startMin) / stepMin);
  const heights = opts.receiverHeight ?? new Float32Array(cells);
  const levels = [...new Set(heights)].sort((a, b) => a - b);
  const levelCells = levels.map((h) => {
    const idx: number[] = [];
    for (let i = 0; i < cells; i++) if (heights[i] === h) idx.push(i);
    return idx;
  });
  const cum = new Uint16Array((steps + 1) * cells);
  const mask = new Uint8Array(cells);
  const covered = new Uint8Array(cells);
  // Footprints at each receiver level (cells under a taller caster are never lit).
  levels.forEach((h, li) => {
    mask.fill(0);
    for (const c of casters) if (c.z1 > h + 0.05) rasterise(c.ring, grid, mask);
    for (const i of levelCells[li]!) covered[i] = mask[i]!;
  });
  const span = Math.max(grid.cols, grid.rows) * grid.cell;
  for (let k = 0; k < steps; k++) {
    const minutes = startMin + (k + 0.5) * stepMin;
    const sun = sunOf({ date, minutes }, lat, lon, opts.tzHours);
    const base = k * cells;
    const next = (k + 1) * cells;
    if (sun.altitudeDeg < 1) {
      for (let i = 0; i < cells; i++) cum[next + i] = cum[base + i]!;
      continue;
    }
    levels.forEach((h, li) => {
      mask.fill(0);
      for (const c of casters) {
        const rel = c.z1 - h;
        if (rel <= 0.05) continue;
        // Skip casters whose shadow cannot reach the grid.
        const [dx, dy] = shadowOffset(rel, sun);
        const reach = Math.hypot(dx, dy) + 200;
        const p = c.ring[0]!;
        if (
          p[0] < grid.minE - reach ||
          p[0] > grid.minE + span + reach ||
          p[1] < grid.minN - reach ||
          p[1] > grid.minN + span + reach
        )
          continue;
        for (const poly of shadowPolygons(c.ring, rel, sun)) rasterise(poly, grid, mask);
      }
      for (const i of levelCells[li]!) cum[next + i] = cum[base + i]! + (mask[i] || covered[i] ? 0 : 1);
    });
  }
  return { grid, date, stepMin, startMin, steps, cum, covered };
}

/** Sun hours per cell accumulated up to local `minutes` (the sweep builds this up). */
export function sunHoursUpTo(s: SunHoursGrid, minutes: number, out?: Float32Array): Float32Array {
  const cells = s.grid.cols * s.grid.rows;
  const res = out ?? new Float32Array(cells);
  const k = Math.max(0, Math.min(s.steps, Math.floor((minutes - s.startMin) / s.stepMin)));
  const h = s.stepMin / 60;
  for (let i = 0; i < cells; i++) res[i] = s.cum[k * cells + i]! * h;
  return res;
}

/** Shadow (not sun) hours over the daylit part of the day, per cell. */
export function shadowHours(s: SunHoursGrid): Float32Array {
  const cells = s.grid.cols * s.grid.rows;
  const res = new Float32Array(cells);
  const day = (s.steps * s.stepMin) / 60;
  for (let i = 0; i < cells; i++) res[i] = day - s.cum[s.steps * cells + i]! * (s.stepMin / 60);
  return res;
}

/**
 * Penumbra (moment 2): for each uncertain neighbour, the shadow at its plausible (high) height.
 * The solid shadow at the likely height comes from the shadow map; this band is hatched.
 */
export function penumbraPolygons(
  ranges: readonly { ring: EN[]; likely: number; hi: number }[],
  sun: Pick<CitySun, 'azimuthDeg' | 'altitudeDeg' | 'up'>,
): EN[][] {
  if (!sun.up || sun.altitudeDeg < 2) return [];
  const out: EN[][] = [];
  for (const r of ranges) if (r.hi - r.likely > 0.25) out.push(...shadowPolygons(r.ring, r.hi, sun));
  return out;
}
