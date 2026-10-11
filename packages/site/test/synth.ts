/**
 * Small synthetic buildings for golden tests, shaped like `@ibasho/plan` compile output: one
 * office zone per room, outward wall quads `sg_<room>_<k>_wall`, window bands 20 mm proud
 * `sg_<room>_<k>_win`, flat roofs. Millimetres, building frame = place frame (no rotation).
 */
import type { CityTile, CompiledBuilding, ContextBuilding, Place, PointMm, SiteContext } from '@ibasho/core';

type Surface = CompiledBuilding['meshes']['surfaces'][number];

export interface SynthRoom {
  id: string;
  /** Counter-clockwise outline, mm. */
  ring: PointMm[];
  /** Window share of each edge (0 none), by edge index. */
  wwr?: Record<number, number>;
  /** Edges that are interior (no wall drawn). */
  inner?: number[];
  z0?: number;
  height?: number;
  spaceType?: string;
}

const azOf = (a: PointMm, b: PointMm) => {
  // Outward normal of a CCW edge is (dy, -dx); azimuth clockwise from north (+y).
  const nx = b[1] - a[1];
  const ny = a[0] - b[0];
  let d = (Math.atan2(nx, ny) * 180) / Math.PI;
  if (d < 0) d += 360;
  return Math.round(d * 1000);
};

export function synthBuilding(id: string, rooms: SynthRoom[]): CompiledBuilding {
  const surfaces: Surface[] = [];
  const zones: {
    id: string;
    roomIds: string[];
    spaceTypeIds: string[];
    floorMm2: bigint;
    volumeMm3: bigint;
    conditioned: boolean;
    storeyId: string;
  }[] = [];
  for (const r of rooms) {
    const z0 = r.z0 ?? 0;
    const h = r.height ?? 3500;
    const rid = r.id.replace(/^rm_/, '');
    r.ring.forEach((a, i) => {
      if (r.inner?.includes(i)) return;
      const b = r.ring[(i + 1) % r.ring.length] as PointMm;
      const az = azOf(a, b);
      surfaces.push({
        id: `sg_${rid}_${i}_wall`,
        kind: 'wall',
        ownerId: `sg_${rid}_${i}`,
        positions: [a[0], a[1], z0, b[0], b[1], z0, b[0], b[1], z0 + h, a[0], a[1], z0 + h],
        indices: [0, 1, 2, 0, 2, 3],
        azimuthMdeg: az,
        tiltMdeg: 90_000,
      });
      const share = r.wwr?.[i] ?? 0;
      if (share > 0) {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const nx = (b[1] - a[1]) / len;
        const ny = (a[0] - b[0]) / len;
        const wh = 1500;
        const ww = Math.min(len, (share * len * h) / wh);
        const t0 = (len - ww) / 2 / len;
        const t1 = 1 - t0;
        const P = (t: number, z: number) => [
          Math.round(a[0] + (b[0] - a[0]) * t + nx * 20),
          Math.round(a[1] + (b[1] - a[1]) * t + ny * 20),
          z,
        ];
        const zs = z0 + 900;
        surfaces.push({
          id: `sg_${rid}_${i}_win`,
          kind: 'window',
          ownerId: `sg_${rid}_${i}`,
          positions: [...P(t0, zs), ...P(t1, zs), ...P(t1, zs + wh), ...P(t0, zs + wh)],
          indices: [0, 1, 2, 0, 2, 3],
          azimuthMdeg: az,
          tiltMdeg: 90_000,
        });
      }
    });
    // Roof: fan triangulation (rings here are convex).
    const pos: number[] = [];
    const idx: number[] = [];
    for (const p of r.ring) pos.push(p[0], p[1], z0 + h);
    for (let i = 1; i + 1 < r.ring.length; i++) idx.push(0, i, i + 1);
    surfaces.push({
      id: `${r.id}_roof`,
      kind: 'roof',
      ownerId: r.id,
      positions: pos,
      indices: idx,
      azimuthMdeg: 0,
      tiltMdeg: 0,
    });
    let area = 0;
    r.ring.forEach((a, i) => {
      const b = r.ring[(i + 1) % r.ring.length] as PointMm;
      area += a[0] * b[1] - b[0] * a[1];
    });
    zones.push({
      id: `z_${rid}`,
      roomIds: [r.id],
      spaceTypeIds: [r.spaceType ?? 'office'],
      floorMm2: BigInt(Math.round(Math.abs(area) / 2)),
      volumeMm3: 0n,
      conditioned: true,
      storeyId: 'st_g',
    });
  }
  return {
    docHash: `synth-${id}`,
    twin: { schema: 'ibasho.zonetwin/1', buildingId: id, typeId: 'office', zones, surfaces: [], systems: [] },
    quantities: {
      gfaMm2: 0n,
      ncaMm2: 0n,
      storeys: [],
      facades: [],
      roofMm2: 0n,
      skylightMm2: 0n,
      openings: [],
    },
    adjacency: [],
    checks: [],
    meshes: { surfaces },
    placement: { origin: { x: 0, y: 0 }, rotationMdeg: 0 },
  } as unknown as CompiledBuilding;
}

export const rect = (x0: number, y0: number, x1: number, y1: number): PointMm[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

export function neighbour(id: string, ring: PointMm[], heightMm: number | 'unknown'): ContextBuilding {
  return heightMm === 'unknown'
    ? { id, footprint: ring, height: { lo: 3000, likely: 9000, hi: 30000, source: 'unknown' } }
    : { id, footprint: ring, height: { lo: heightMm, likely: heightMm, hi: heightMm, source: 'user' } };
}

export function tile(buildings: ContextBuilding[]): CityTile {
  return { schema: 'ibasho.city/1', packId: 'test', tx: 0, ty: 0, buildings, trees: [] };
}

export const HYDERABAD: Place = {
  id: 'pl_test_hyd',
  name: 'Hyderabad test',
  lat: 17.4453,
  lon: 78.349,
  elevationM: 545,
  trueNorthMdeg: 0,
  climatePackId: 'climate.hyderabad',
  codePackIds: [],
  moneyPackIds: [],
  buildingIds: [],
};

export const LONDON: Place = {
  ...HYDERABAD,
  id: 'pl_test_ldn',
  name: 'London test',
  lat: 51.548,
  lon: -0.105,
  elevationM: 30,
  climatePackId: 'climate.london',
};

export function siteOf(place: Place, buildings: ContextBuilding[] = []): SiteContext {
  return { place, tiles: buildings.length ? [tile(buildings)] : [], weatherHash: place.climatePackId };
}
