/**
 * Hero building to scene surfaces (no three.js renderer, pure geometry). Owner: WP-07.
 *
 * From a `BuildingDoc` (rooms extruded per storey) or, when the geometry stage has run, from
 * `CompiledBuilding.meshes` (the `SurfaceSet` the site worker also reads), so lens values keyed by
 * surface id land on the same faces. World frame: metres, x east, y up, z south (frame.ts).
 */
import type { BuildingDoc, PointMm, Room2D, SurfaceSet, WindowRule } from '@ibasho/core';
import { ShapeUtils, Vector2 } from 'three';
import { type Box2, boxOf, type EN, planToEN } from './frame.ts';

export type SurfaceKind = 'wall' | 'roof' | 'floor' | 'window' | 'shade';

export interface HeroSurface {
  /** Stable id: segment id for walls, `<room>:roof`, `<room>:floor`, `<segment>:w<k>` for glass. */
  id: string;
  /** Room, segment or opening the surface belongs to (fallback lens key). */
  ownerId: string;
  kind: SurfaceKind;
  storeyId: string;
  roomId: string;
  /** Triangles, world metres, xyz per vertex (non indexed). */
  tris: number[];
  /** World outward normal. */
  normal: [number, number, number];
  /** Facade bearing (degrees from north) for walls and glass. */
  bearingDeg: number;
  area: number;
  centre: [number, number, number];
}

export interface HeroRoom {
  id: string;
  storeyId: string;
  ring: EN[];
  z0: number;
  z1: number;
  use?: string;
  name?: string;
}

export interface HeroStorey {
  id: string;
  name: string;
  index: number;
  z0: number;
  z1: number;
  belowGrade: boolean;
}

export interface HeroModel {
  id: string;
  name: string;
  storeys: HeroStorey[];
  rooms: HeroRoom[];
  surfaces: HeroSurface[];
  /** Footprint box (m, pack frame) and roof height (m). */
  box: Box2;
  height: number;
  /** Outer rings of the top storey rooms, for shadow casting (m, pack frame). */
  prisms: { id: string; ring: EN[]; z0: number; z1: number }[];
}

const quad = (a: number[], b: number[], c: number[], d: number[]): number[] => [
  ...a,
  ...b,
  ...c,
  ...a,
  ...c,
  ...d,
];

function triArea(t: number[]): number {
  let s = 0;
  for (let i = 0; i < t.length; i += 9) {
    const ux = t[i + 3]! - t[i]!;
    const uy = t[i + 4]! - t[i + 1]!;
    const uz = t[i + 5]! - t[i + 2]!;
    const vx = t[i + 6]! - t[i]!;
    const vy = t[i + 7]! - t[i + 1]!;
    const vz = t[i + 8]! - t[i + 2]!;
    s += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return s;
}

function centreOf(t: number[]): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  const n = t.length / 3;
  for (let i = 0; i < t.length; i += 3) {
    x += t[i]!;
    y += t[i + 1]!;
    z += t[i + 2]!;
  }
  return [x / n, y / n, z / n];
}

/** Horizontal polygon at height y, facing up (or down), triangulated. */
function flat(ring: EN[], y: number, up: boolean): number[] {
  const pts = ring.map(([e, n]) => new Vector2(e, n));
  const tris = ShapeUtils.triangulateShape(pts, []);
  const out: number[] = [];
  for (const [a, b, c] of tris) {
    const A = ring[a!]!;
    const B = ring[b!]!;
    const C = ring[c!]!;
    // Counter-clockwise in EN faces world up (z = -n); flip triangles to the side asked for.
    const ccwEN = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) > 0;
    const order = ccwEN === up ? [A, B, C] : [A, C, B];
    for (const p of order) out.push(p[0], y, -p[1]);
  }
  return out;
}

const bearingOf = (ne: number, nn: number): number => ((Math.atan2(ne, nn) * 180) / Math.PI + 360) % 360;

/** Glass rectangles along a wall: [u0, u1, v0, v1] in metres (u along the wall, v up). */
export function windowRects(rule: WindowRule, len: number, f2f: number): [number, number, number, number][] {
  switch (rule.kind) {
    case 'none':
      return [];
    case 'ratio': {
      const sill = rule.sill / 1000;
      const head = Math.min(f2f - 0.3, (rule.head ?? 2400) / 1000);
      const band = head - sill;
      if (band <= 0.1) return [];
      const total = Math.min(len * 0.92, ((rule.wwrPm / 1000) * len * f2f) / band);
      const n = Math.max(1, Math.round(total / 1.5));
      const w = total / n;
      return Array.from({ length: n }, (_, k) => {
        const c = ((k + 0.5) * len) / n;
        return [c - w / 2, c + w / 2, sill, head] as [number, number, number, number];
      });
    }
    case 'repeating': {
      const out: [number, number, number, number][] = [];
      const w = rule.width / 1000;
      const s = Math.max(w + 0.1, rule.spacing / 1000);
      const n = Math.max(1, Math.floor((len - 0.2) / s));
      const start = (len - n * s) / 2;
      for (let k = 0; k < n; k++) {
        const c = start + (k + 0.5) * s;
        out.push([c - w / 2, c + w / 2, rule.sill / 1000, rule.head / 1000]);
      }
      return out;
    }
    case 'single': {
      const u0 = rule.offset / 1000;
      return [
        [u0, Math.min(len, u0 + rule.width / 1000), rule.sill / 1000, (rule.sill + rule.height) / 1000],
      ];
    }
    case 'detailed':
      return rule.openings
        .filter((o) => o.kind !== 'vent')
        .map((o) => [o.u / 1000, (o.u + o.width) / 1000, o.v / 1000, (o.v + o.height) / 1000]);
  }
}

function roomRing(doc: BuildingDoc, r: Room2D): EN[] {
  return r.floor.outer.map((p: PointMm) => planToEN(doc, p));
}

/** Build the hero from a document (rooms extruded per storey). */
export function heroFromDoc(doc: BuildingDoc): HeroModel {
  const surfaces: HeroSurface[] = [];
  const rooms: HeroRoom[] = [];
  const storeys: HeroStorey[] = [];
  const sorted = [...doc.storeys].sort((a, b) => a.elevation - b.elevation);
  const prisms: HeroModel['prisms'] = [];
  let index = 0;
  for (const st of sorted) {
    for (let m = 0; m < Math.max(1, st.multiplier); m++) {
      const z0 = (st.elevation + m * st.floorToFloor) / 1000;
      const z1 = z0 + st.floorToFloor / 1000;
      const sid = m === 0 ? st.id : `${st.id}#${m}`;
      storeys.push({ id: sid, name: st.name, index: index++, z0, z1, belowGrade: st.belowGrade });
      for (const r of st.rooms) {
        const ring = roomRing(doc, r);
        rooms.push({
          id: r.id,
          storeyId: sid,
          ring,
          z0,
          z1,
          ...(r.spaceTypeId ? { use: r.spaceTypeId } : {}),
          ...(r.name ? { name: r.name } : {}),
        });
        if (!st.belowGrade) prisms.push({ id: r.id, ring, z0, z1 });
        const floor = flat(ring, z0 + 0.02, true);
        surfaces.push({
          id: `${r.id}:floor`,
          ownerId: r.id,
          kind: 'floor',
          storeyId: sid,
          roomId: r.id,
          tris: floor,
          normal: [0, 1, 0],
          bearingDeg: 0,
          area: triArea(floor),
          centre: centreOf(floor),
        });
        if (r.ceilingBoundary !== 'adjacent' && !st.belowGrade) {
          const roof = flat(ring, z1, true);
          surfaces.push({
            id: `${r.id}:roof`,
            ownerId: r.id,
            kind: 'roof',
            storeyId: sid,
            roomId: r.id,
            tris: roof,
            normal: [0, 1, 0],
            bearingDeg: 0,
            area: triArea(roof),
            centre: centreOf(roof),
          });
        }
        if (st.belowGrade) continue;
        r.segments.forEach((seg, i) => {
          const b = seg.boundary.kind;
          if (b === 'adjacent' || b === 'adiabatic' || b === 'air') return;
          const p = ring[i]!;
          const q = ring[(i + 1) % ring.length]!;
          const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (len < 0.05) return;
          const ne = (q[1] - p[1]) / len;
          const nn = -(q[0] - p[0]) / len;
          const normal: [number, number, number] = [ne, 0, -nn];
          const wall = quad([p[0], z0, -p[1]], [q[0], z0, -q[1]], [q[0], z1, -q[1]], [p[0], z1, -p[1]]);
          const bearing = bearingOf(ne, nn);
          surfaces.push({
            id: seg.id,
            ownerId: r.id,
            kind: 'wall',
            storeyId: sid,
            roomId: r.id,
            tris: wall,
            normal,
            bearingDeg: bearing,
            area: len * (z1 - z0),
            centre: centreOf(wall),
          });
          const ux = (q[0] - p[0]) / len;
          const uy = (q[1] - p[1]) / len;
          const off = 0.04;
          windowRects(seg.window, len, z1 - z0).forEach(([u0, u1, v0, v1], k) => {
            const at = (u: number, v: number): number[] => [
              p[0] + ux * u + ne * off,
              z0 + v,
              -(p[1] + uy * u + nn * off),
            ];
            const g = quad(at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1));
            surfaces.push({
              id: `${seg.id}:w${k}`,
              ownerId: seg.id,
              kind: 'window',
              storeyId: sid,
              roomId: r.id,
              tris: g,
              normal,
              bearingDeg: bearing,
              area: (u1 - u0) * (v1 - v0),
              centre: centreOf(g),
            });
          });
        });
      }
    }
  }
  const above = storeys.filter((s) => !s.belowGrade);
  return {
    id: doc.id,
    name: doc.name,
    storeys,
    rooms,
    surfaces,
    box: boxOf(rooms.flatMap((r) => r.ring)),
    height: above.length ? Math.max(...above.map((s) => s.z1)) : 0,
    prisms,
  };
}

/**
 * Build the hero from compiled meshes (geometry stage output). Storeys come from the document,
 * surfaces from the `SurfaceSet`, so lens ids match the site worker exactly.
 */
export function heroFromCompiled(doc: BuildingDoc, meshes: SurfaceSet): HeroModel {
  const base = heroFromDoc(doc);
  const storeyAt = (y: number): HeroStorey =>
    base.storeys.find((s) => y >= s.z0 - 0.01 && y < s.z1 - 0.01) ?? base.storeys[base.storeys.length - 1]!;
  const surfaces: HeroSurface[] = [];
  for (const s of meshes.surfaces) {
    if (s.kind === 'ground' || s.kind === 'skylight' || s.kind === 'door') continue;
    const tris: number[] = [];
    for (const i of s.indices) {
      const x = s.positions[i * 3]!;
      const y = s.positions[i * 3 + 1]!;
      const z = s.positions[i * 3 + 2]!;
      const [e, n] = planToEN(doc, [x, y]);
      tris.push(e, z / 1000, -n);
    }
    // Glass sits 4 cm proud of its wall so it never z-fights (the doc path does the same).
    if (s.kind === 'window') {
      const az0 = (s.azimuthMdeg / 1000) * (Math.PI / 180);
      for (let i = 0; i < tris.length; i += 3) {
        tris[i] = tris[i]! + Math.sin(az0) * 0.04;
        tris[i + 2] = tris[i + 2]! - Math.cos(az0) * 0.04;
      }
    }
    if (!tris.length) continue;
    const c = centreOf(tris);
    const az = (s.azimuthMdeg / 1000) * (Math.PI / 180);
    const tilt = (s.tiltMdeg / 1000) * (Math.PI / 180);
    const normal: [number, number, number] = [
      Math.sin(az) * Math.sin(tilt),
      Math.cos(tilt),
      -Math.cos(az) * Math.sin(tilt),
    ];
    const st = storeyAt(c[1]);
    const room = base.rooms.find((r) => r.id === s.ownerId);
    surfaces.push({
      id: s.id,
      ownerId: s.ownerId,
      kind: s.kind,
      storeyId: room?.storeyId ?? st.id,
      roomId: room?.id ?? s.ownerId,
      tris,
      normal,
      bearingDeg: s.azimuthMdeg / 1000,
      area: triArea(tris),
      centre: c,
    });
  }
  return { ...base, surfaces };
}

/** Value of a lens for a surface: exact id, then its owner (segment for glass, room for floors). */
export function lookupSurface<T>(
  map: ReadonlyMap<string, T>,
  s: Pick<HeroSurface, 'id' | 'ownerId'>,
): T | undefined {
  return map.get(s.id) ?? map.get(s.ownerId);
}
