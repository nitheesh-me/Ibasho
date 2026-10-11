/**
 * The analysis scene (SD 1.3, R29, R30): the compiled hero building placed in the place frame plus
 * the city context inside the analysis radius, as one triangle BVH, and sensor grids on the
 * hero's walls, windows and roofs. Owner: WP-16.
 *
 * Units: metres, x east, y north (place frame), z up, relative to the hero's plan centre.
 * Context buildings are extruded footprints (outer ring and courtyard rings) from the ground to
 * `height.likely`. Roofs are not needed: every analysis ray leaves a sensor upwards (sky patches
 * and the sun are above the horizon, the ground term is analytic), and an upward ray that misses a
 * building's walls below its roof line can never reach its roof. Context buildings whose height
 * is unknown are left out and listed (RB 5, R29). Trees and terrain are not modelled yet
 * (PLACEHOLDER, listed in the README).
 */
import type { CityTile, CompiledBuilding, ContextBuilding, PointMm } from '@ibasho/core';
import { isZoneTwin } from '@ibasho/core';
import { Bvh } from './bvh.ts';
import { cos, D2R, sin } from './dmath/index.ts';

type MeshSurface = CompiledBuilding['meshes']['surfaces'][number];

export interface SceneSurface {
  id: string;
  kind: MeshSurface['kind'];
  ownerId: string;
  /** Outward unit normal. */
  n: [number, number, number];
  areaM2: number;
  /** Triangles in scene metres, 9 numbers each. */
  tris: Float64Array;
  /** Lowest and highest z, metres. */
  z0: number;
  z1: number;
}

export interface SiteScene {
  bvh: Bvh;
  /** Owner id per owner index; index 0 is the hero building. */
  owners: string[];
  /** Place frame mm of the scene origin. */
  centreMm: [number, number];
  /** Analysed hero surfaces (walls, windows, roofs, skylights above grade). */
  surfaces: SceneSurface[];
  /** Every hero surface, for daylight apertures and shades. */
  all: SceneSurface[];
  /** Context buildings in the radius left out because their height is unknown (sorted ids). */
  unknownHeightIds: string[];
  /** Context buildings used as shade. */
  contextIds: string[];
  /** Context buildings the hero overlaps (treated as replaced, not as shade). */
  overlappedIds: string[];
  /** Rotation of the place frame from true north, degrees (to turn sun and sky vectors). */
  trueNorthDeg: number;
  /** Hero half extent in plan, metres. */
  heroRadiusM: number;
}

const ANALYSED = new Set<MeshSurface['kind']>(['wall', 'window', 'roof', 'skylight']);

function placeFn(c: CompiledBuilding) {
  const o = c.placement?.origin ?? { x: 0, y: 0 };
  const r = ((c.placement?.rotationMdeg ?? 0) / 1000) * D2R;
  const s = sin(r);
  const k = cos(r);
  return (x: number, y: number): [number, number] => [o.x + x * k + y * s, o.y - x * s + y * k];
}

const centroid = (pts: readonly PointMm[]): PointMm => {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
};

/** Even-odd point in polygon. */
function insidePolygon(p: PointMm, ring: readonly PointMm[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i] as PointMm;
    const b = ring[j] as PointMm;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}

function normalOf(t: Float64Array): [number, number, number, number] {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < t.length; i += 9) {
    const ux = (t[i + 3] as number) - (t[i] as number);
    const uy = (t[i + 4] as number) - (t[i + 1] as number);
    const uz = (t[i + 5] as number) - (t[i + 2] as number);
    const vx = (t[i + 6] as number) - (t[i] as number);
    const vy = (t[i + 7] as number) - (t[i + 1] as number);
    const vz = (t[i + 8] as number) - (t[i + 2] as number);
    nx += uy * vz - uz * vy;
    ny += uz * vx - ux * vz;
    nz += ux * vy - uy * vx;
  }
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len === 0) return [0, 0, 1, 0];
  return [nx / len, ny / len, nz / len, len / 2];
}

export interface SceneOptions {
  tiles: readonly CityTile[];
  radiusM: number;
  replacedIds?: readonly string[];
  trueNorthMdeg?: number;
}

export function buildScene(c: CompiledBuilding, opts: SceneOptions): SiteScene {
  const toPlace = placeFn(c);
  // Hero bounds in the place frame (mm).
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of c.meshes.surfaces) {
    for (let i = 0; i < s.positions.length; i += 3) {
      const [x, y] = toPlace(s.positions[i] as number, s.positions[i + 1] as number);
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x0 === Infinity) {
    x0 = 0;
    y0 = 0;
    x1 = 0;
    y1 = 0;
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const heroRadiusM = Math.max(x1 - x0, y1 - y0) / 2000;

  // Hero surfaces.
  const all: SceneSurface[] = [];
  const footTris: [PointMm, PointMm, PointMm][] = [];
  const tn = ((opts.trueNorthMdeg ?? 0) / 1000) * D2R;
  for (const s of c.meshes.surfaces) {
    const t = new Float64Array(s.indices.length * 3);
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < s.indices.length; i++) {
      const j = (s.indices[i] as number) * 3;
      const [x, y] = toPlace(s.positions[j] as number, s.positions[j + 1] as number);
      const z = (s.positions[j + 2] as number) / 1000;
      t[i * 3] = (x - cx) / 1000;
      t[i * 3 + 1] = (y - cy) / 1000;
      t[i * 3 + 2] = z;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
    }
    const [nx, ny, nz, area] = normalOf(t);
    // Nominal outward normal from the compiled azimuth and tilt (true frame turned to the place frame).
    const tilt = (s.tiltMdeg / 1000) * D2R;
    const az = (s.azimuthMdeg / 1000) * D2R - tn;
    const ex = sin(tilt) * sin(az);
    const ey = sin(tilt) * cos(az);
    const ez = cos(tilt);
    const flip = nx * ex + ny * ey + nz * ez < 0 ? -1 : 1;
    all.push({
      id: s.id,
      kind: s.kind,
      ownerId: s.ownerId,
      n: [nx * flip, ny * flip, nz * flip],
      areaM2: area,
      tris: t,
      z0,
      z1,
    });
    if (s.kind === 'floor' || s.kind === 'roof') {
      for (let i = 0; i < s.indices.length; i += 3) {
        const v = (k: number): PointMm => {
          const j = (s.indices[i + k] as number) * 3;
          return toPlace(s.positions[j] as number, s.positions[j + 1] as number);
        };
        footTris.push([v(0), v(1), v(2)]);
      }
    }
  }
  const surfaces = all.filter((s) => ANALYSED.has(s.kind) && (s.z0 + s.z1) / 2 >= 0 && s.areaM2 > 0);

  // Context.
  const side = (p: PointMm, a: PointMm, b: PointMm) =>
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const onFootprint = (p: PointMm) =>
    footTris.some(([a, b, cc]) => {
      const d1 = side(p, a, b);
      const d2 = side(p, b, cc);
      const d3 = side(p, cc, a);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    });
  const replaced = opts.replacedIds ? new Set(opts.replacedIds) : null;
  // Points well inside the hero's footprint: triangle centroids.
  const footInner: PointMm[] = footTris.map(([a, b, cc]) => [
    (a[0] + b[0] + cc[0]) / 3,
    (a[1] + b[1] + cc[1]) / 3,
  ]);
  const overlapped: string[] = [];
  const near: ContextBuilding[] = [];
  const seen = new Set<string>();
  for (const tile of opts.tiles) {
    for (const b of tile.buildings) {
      if (seen.has(b.id) || b.footprint.length < 3) continue;
      seen.add(b.id);
      const cen = centroid(b.footprint);
      if (replaced ? replaced.has(b.id) : onFootprint(cen)) continue;
      // A neighbour the hero overlaps is the building it stands in for: the hero cannot share
      // space with it, so it is not a blocker either (touching party walls do not count).
      if (footInner.some((p) => insidePolygon(p, b.footprint))) {
        overlapped.push(b.id);
        continue;
      }
      const dx = cen[0] - cx;
      const dy = cen[1] - cy;
      if (Math.sqrt(dx * dx + dy * dy) >= opts.radiusM * 1000 + (x1 - x0) / 2) continue;
      near.push(b);
    }
  }
  near.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const unknownHeightIds = near.filter((b) => b.height.source === 'unknown').map((b) => b.id);
  const blockers = near.filter((b) => b.height.source !== 'unknown' && b.height.likely > 0);

  // Triangles: hero first (owner 0), then context walls.
  const heroId = isZoneTwin(c.twin) ? c.twin.buildingId : c.twin.id;
  const owners = [heroId, ...blockers.map((b) => b.id)];
  let nTri = 0;
  for (const s of all) nTri += s.tris.length / 9;
  for (const b of blockers) {
    nTri += 2 * b.footprint.length;
    for (const h of b.holes ?? []) nTri += 2 * h.length;
  }
  const tri = new Float64Array(nTri * 9);
  const owner = new Int32Array(nTri);
  let k = 0;
  for (const s of all) {
    tri.set(s.tris, k * 9);
    owner.fill(0, k, k + s.tris.length / 9);
    k += s.tris.length / 9;
  }
  blockers.forEach((b, bi) => {
    const h = b.height.likely / 1000;
    for (const ring of [b.footprint, ...(b.holes ?? [])]) {
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i] as PointMm;
        const q = ring[(i + 1) % ring.length] as PointMm;
        const ax = (p[0] - cx) / 1000;
        const ay = (p[1] - cy) / 1000;
        const bx = (q[0] - cx) / 1000;
        const by = (q[1] - cy) / 1000;
        tri.set([ax, ay, 0, bx, by, 0, bx, by, h], k * 9);
        owner[k++] = bi + 1;
        tri.set([ax, ay, 0, bx, by, h, ax, ay, h], k * 9);
        owner[k++] = bi + 1;
      }
    }
  });
  return {
    bvh: new Bvh(tri.subarray(0, k * 9), owner.subarray(0, k)),
    owners,
    centreMm: [cx, cy],
    surfaces,
    all,
    unknownHeightIds,
    contextIds: blockers.map((b) => b.id),
    overlappedIds: overlapped.sort(),
    trueNorthDeg: (opts.trueNorthMdeg ?? 0) / 1000,
    heroRadiusM,
  };
}

/** Sensor points on surfaces: flat arrays, one entry per sensor. */
export interface Sensors {
  count: number;
  /** Position and outward normal, 3 each. */
  p: Float64Array;
  n: Float64Array;
  /** Area each sensor stands for, m2. */
  w: Float64Array;
  /** Surface index per sensor (into `scene.surfaces`). */
  surf: Int32Array;
}

/** Offset of a sensor from its surface along the normal, metres (SD 1.5: 1 to 2 cm or more). */
export const SENSOR_OFFSET_M = 0.05;

/**
 * Grid sensors on each surface at `spacingM`, cell centres inside the surface's triangles. A
 * surface too small for one cell gets one sensor at its area centroid.
 */
export function surfaceSensors(surfaces: readonly SceneSurface[], spacingM: number): Sensors {
  const P: number[] = [];
  const N: number[] = [];
  const W: number[] = [];
  const S: number[] = [];
  surfaces.forEach((s, si) => {
    const [nx, ny, nz] = s.n;
    // Plane basis: u horizontal (or east on flat roofs), v = n x u.
    let ux: number;
    let uy: number;
    let uz: number;
    if (Math.abs(nz) > 0.9) {
      ux = 1;
      uy = 0;
      uz = 0;
    } else {
      const l = Math.sqrt(nx * nx + ny * ny);
      ux = -ny / l;
      uy = nx / l;
      uz = 0;
    }
    const vx = ny * uz - nz * uy;
    const vy = nz * ux - nx * uz;
    const vz = nx * uy - ny * ux;
    const t = s.tris;
    const o0 = t[0] as number;
    const o1 = t[1] as number;
    const o2 = t[2] as number;
    const nt = t.length / 9;
    const uv = new Float64Array(nt * 6);
    let u0 = Infinity;
    let v0 = Infinity;
    let u1 = -Infinity;
    let v1 = -Infinity;
    for (let i = 0; i < nt * 3; i++) {
      const dx = (t[i * 3] as number) - o0;
      const dy = (t[i * 3 + 1] as number) - o1;
      const dz = (t[i * 3 + 2] as number) - o2;
      const u = dx * ux + dy * uy + dz * uz;
      const v = dx * vx + dy * vy + dz * vz;
      uv[i * 2] = u;
      uv[i * 2 + 1] = v;
      if (u < u0) u0 = u;
      if (v < v0) v0 = v;
      if (u > u1) u1 = u;
      if (v > v1) v1 = v;
    }
    const pts: [number, number][] = [];
    const nu = Math.max(1, Math.round((u1 - u0) / spacingM));
    const nv = Math.max(1, Math.round((v1 - v0) / spacingM));
    const du = (u1 - u0) / nu;
    const dv = (v1 - v0) / nv;
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const u = u0 + (i + 0.5) * du;
        const v = v0 + (j + 0.5) * dv;
        if (inTris(uv, nt, u, v)) pts.push([u, v]);
      }
    }
    if (pts.length === 0) {
      // Area centroid.
      let su = 0;
      let sv = 0;
      let sa = 0;
      for (let i = 0; i < nt; i++) {
        const a = Math.abs(cross2(uv, i));
        su += (a * ((uv[i * 6] as number) + (uv[i * 6 + 2] as number) + (uv[i * 6 + 4] as number))) / 3;
        sv += (a * ((uv[i * 6 + 1] as number) + (uv[i * 6 + 3] as number) + (uv[i * 6 + 5] as number))) / 3;
        sa += a;
      }
      pts.push(sa > 0 ? [su / sa, sv / sa] : [uv[0] as number, uv[1] as number]);
    }
    const w = s.areaM2 / pts.length;
    for (const [u, v] of pts) {
      P.push(
        o0 + u * ux + v * vx + nx * SENSOR_OFFSET_M,
        o1 + u * uy + v * vy + ny * SENSOR_OFFSET_M,
        o2 + u * uz + v * vz + nz * SENSOR_OFFSET_M,
      );
      N.push(nx, ny, nz);
      W.push(w);
      S.push(si);
    }
  });
  return {
    count: W.length,
    p: Float64Array.from(P),
    n: Float64Array.from(N),
    w: Float64Array.from(W),
    surf: Int32Array.from(S),
  };
}

function cross2(uv: Float64Array, i: number): number {
  const ax = uv[i * 6] as number;
  const ay = uv[i * 6 + 1] as number;
  return (
    ((uv[i * 6 + 2] as number) - ax) * ((uv[i * 6 + 5] as number) - ay) -
    ((uv[i * 6 + 3] as number) - ay) * ((uv[i * 6 + 4] as number) - ax)
  );
}

function inTris(uv: Float64Array, nt: number, u: number, v: number): boolean {
  for (let i = 0; i < nt; i++) {
    if (Math.abs(cross2(uv, i)) < 1e-9) continue; // degenerate
    const ax = uv[i * 6] as number;
    const ay = uv[i * 6 + 1] as number;
    const bx = uv[i * 6 + 2] as number;
    const by = uv[i * 6 + 3] as number;
    const cx = uv[i * 6 + 4] as number;
    const cy = uv[i * 6 + 5] as number;
    const d1 = (bx - ax) * (v - ay) - (by - ay) * (u - ax);
    const d2 = (cx - bx) * (v - by) - (cy - by) * (u - bx);
    const d3 = (ax - cx) * (v - cy) - (ay - cy) * (u - cx);
    const neg = d1 < 0 || d2 < 0 || d3 < 0;
    const pos = d1 > 0 || d2 > 0 || d3 > 0;
    if (!(neg && pos)) return true;
  }
  return false;
}
