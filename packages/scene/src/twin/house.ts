/**
 * Twin to house model (ARCH 10: "twin to geometry is procedural from `Element.geometry` and
 * `Junction.path`, so geometry and physics share one source"). Pure data, no three.js: the
 * WebGL builder, the SVG renderer, picking and the `a11y-scene` outline all read this model.
 * Owner: WP-07.
 *
 * Twin elements map one to one to surfaces. Structure the twin does not carry as elements
 * (pitched roof slopes over a cold loft, gables, intermediate floors, partitions, stairs and
 * the chimney stack) is derived from `form` and tagged with the element it belongs to, if any,
 * so picking a roof slope still opens the roof element.
 */
import type { Element, HomeTwin, Junction, JunctionKind, Vec2, Vec3 } from '@ibasho/core';
import { choiceValue, numCentral } from '@ibasho/core';
import {
  type Bounds3,
  bounds3,
  centroid,
  dot,
  newellNormal,
  normalize,
  type PlaneFrame,
  planeFrame,
  polylineLength,
} from './frame.ts';

export type SurfaceRole =
  | 'wall'
  | 'party-wall'
  | 'gable'
  | 'roof-slope'
  | 'loft-floor'
  | 'ground-floor'
  | 'intermediate-floor'
  | 'partition'
  | 'chimney';

/** How a surface gets its thickness: from the polygon inwards, outwards, or centred on it. */
export type Extrude = 'in' | 'out' | 'centre';

export interface Surface {
  /** Stable mesh key, unique in the model. */
  key: string;
  role: SurfaceRole;
  /** Twin element this surface draws (picking, outline, evidence). */
  elementId?: string;
  polygon: Vec3[];
  holes: Vec3[][];
  frame: PlaneFrame;
  thickness: number;
  extrude: Extrude;
  storey?: number;
}

export type GlazingKind = 'single' | 'double' | 'triple';
export interface Opening {
  elementId: string;
  kind: 'window' | 'door' | 'rooflight';
  hostId?: string;
  /** Rectangle on the outer face of the host wall, outer ring order. */
  polygon: Vec3[];
  frame: PlaneFrame;
  /** Width and height in the host plane, metres. */
  width: number;
  height: number;
  /** Bottom-left corner in house coordinates (outer face). */
  corner: Vec3;
  glazing: GlazingKind;
  /** Host wall thickness, for reveals. */
  reveal: number;
  storey: number;
  zone: Element['zone'];
}

export type RoomUse = 'living' | 'kitchen' | 'bedroom' | 'bathroom' | 'hall';
export interface Room {
  id: string;
  use: RoomUse;
  /** SAP zone the room belongs to (zone tints never claim a single room, SPEC 5.3). */
  zone: 'living' | 'rest';
  storey: number;
  min: Vec3;
  max: Vec3;
}

export interface JunctionLine {
  junctionId: string;
  kind: JunctionKind;
  path: Vec3[];
  lengthM: number;
  psi: number;
  elementIds: string[];
}

export interface Stairs {
  /** Bottom of the first riser, at the face of the wall the flight runs along. */
  start: Vec3;
  /** Unit horizontal direction of travel. */
  dir: Vec3;
  /** Unit horizontal direction from that wall into the room. */
  across: Vec3;
  width: number;
  risers: number;
  rise: number;
  going: number;
  storey: number;
}

export interface Chimney {
  /** Centre of the stack base at the ridge. */
  base: Vec3;
  size: Vec3;
  open: boolean;
  /** Element the stack rises from (the party wall). */
  elementId?: string;
}

export interface HouseModel {
  twinId: string;
  storeys: number;
  storeyHeight: number;
  /** Outer footprint (house coordinates, y ignored). */
  footprint: { x0: number; x1: number; z0: number; z1: number };
  /** Inner faces of the outer walls. */
  inner: { x0: number; x1: number; z0: number; z1: number };
  eavesY: number;
  ridgeY: number;
  ridgeAxis: 'x' | 'z';
  /** Outward horizontal normal of the front wall. */
  frontNormal: Vec3;
  surfaces: Surface[];
  openings: Opening[];
  rooms: Room[];
  stairs: Stairs[];
  chimneys: Chimney[];
  junctions: JunctionLine[];
  bounds: Bounds3;
}

/** Reverse a ring if its Newell normal disagrees with `expected`. */
export function orient(poly: Vec3[], expected: Vec3): Vec3[] {
  return dot(newellNormal(poly), expected) < 0 ? [...poly].reverse() : poly;
}

const MM = /(\d{2,3})(?!.*\d)/;
/** Wall thickness from the construction id (`...-230` is 230 mm), else a default by kind. */
export function thicknessOf(e: Element): number {
  const m = MM.exec(e.constructionId ?? '');
  if (m && (e.kind === 'wall' || e.kind === 'party-wall')) {
    const mm = Number(m[1]);
    if (mm >= 90 && mm <= 600) return mm / 1000;
  }
  switch (e.kind) {
    case 'wall':
      return 0.23;
    case 'party-wall':
      return 0.23;
    case 'roof':
      return 0.08;
    case 'floor':
      return 0.15;
    default:
      return 0.05;
  }
}

/** Visual quilt depth for a ceiling-level roof element: about lambda / U with lambda 0.04. */
export function loftQuiltDepth(u: number): number {
  if (!(u > 0)) return 0.02;
  return Math.min(0.36, Math.max(0.02, 0.04 / u - 0.02));
}

export function glazingOf(u: number): GlazingKind {
  if (u >= 4) return 'single';
  if (u >= 1.2) return 'double';
  return 'triple';
}

const UP: Vec3 = [0, 1, 0];

function isVertical(n: Vec3): boolean {
  return Math.abs(n[1]) < 0.2;
}

/** Azimuth (degrees clockwise from north) of a horizontal outward normal. North is -z. */
export function azimuthOfNormal(n: Vec3): number {
  const deg = (Math.atan2(n[0], -n[2]) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function normalOfAzimuth(deg: number): Vec3 {
  const r = (deg * Math.PI) / 180;
  return normalize([Math.sin(r), 0, -Math.cos(r)]);
}

export function buildHouse(twin: HomeTwin): HouseModel {
  const storeys = Math.max(1, Math.round(numCentral(twin.form.storeys)));
  const storeyHeight = numCentral(twin.form.storeyHeightM);
  const all: Vec3[] = twin.elements.flatMap((e) => e.geometry.polygon);
  const b = bounds3(all.length ? all : [[0, 0, 0]]);
  const footprint = { x0: b.min[0], x1: b.max[0], z0: b.min[2], z1: b.max[2] };
  const eavesY = Math.max(b.max[1], storeys * storeyHeight);

  const frontAz = numCentral(twin.form.frontAzimuthDeg);
  const frontNormal = normalOfAzimuth(frontAz);
  const surfaces: Surface[] = [];
  const openings: Opening[] = [];

  const byId = new Map(twin.elements.map((e) => [e.id, e]));
  const wallT = new Map<string, number>();
  for (const e of twin.elements) wallT.set(e.id, thicknessOf(e));

  // Inner faces of the outer walls: external walls are drawn inwards, party walls centred.
  let ix0 = footprint.x0;
  let ix1 = footprint.x1;
  let iz0 = footprint.z0;
  let iz1 = footprint.z1;
  for (const e of twin.elements) {
    if (e.kind !== 'wall' && e.kind !== 'party-wall') continue;
    const n = newellNormal(e.geometry.polygon);
    const t = e.kind === 'party-wall' ? (wallT.get(e.id) ?? 0.23) / 2 : (wallT.get(e.id) ?? 0.23);
    const c = centroid(e.geometry.polygon);
    if (n[0] < -0.9 && Math.abs(c[0] - footprint.x0) < 0.05) ix0 = Math.max(ix0, footprint.x0 + t);
    if (n[0] > 0.9 && Math.abs(c[0] - footprint.x1) < 0.05) ix1 = Math.min(ix1, footprint.x1 - t);
    if (n[2] < -0.9 && Math.abs(c[2] - footprint.z0) < 0.05) iz0 = Math.max(iz0, footprint.z0 + t);
    if (n[2] > 0.9 && Math.abs(c[2] - footprint.z1) < 0.05) iz1 = Math.min(iz1, footprint.z1 - t);
  }
  const inner = { x0: ix0, x1: ix1, z0: iz0, z1: iz1 };

  for (const e of twin.elements) {
    const poly = e.geometry.polygon;
    const frame = planeFrame(poly);
    if (e.kind === 'window' || e.kind === 'door' || e.kind === 'rooflight') {
      const host = e.parentId ? byId.get(e.parentId) : undefined;
      const hostFrame = host ? planeFrame(host.geometry.polygon) : frame;
      // Measure the rectangle in the host frame so width runs along the wall.
      const us = poly.map((p) => dot(p, hostFrame.u));
      const vs = poly.map((p) => dot(p, hostFrame.v));
      const umin = Math.min(...us);
      const vmin = Math.min(...vs);
      const width = Math.max(...us) - umin;
      const height = Math.max(...vs) - vmin;
      const iCorner = us.findIndex((u, i) => Math.abs(u - umin) < 1e-6 && Math.abs(vs[i]! - vmin) < 1e-6);
      const corner = poly[iCorner >= 0 ? iCorner : 0]!;
      openings.push({
        elementId: e.id,
        kind: e.kind,
        ...(e.parentId ? { hostId: e.parentId } : {}),
        polygon: poly,
        frame: { ...hostFrame, origin: corner },
        width,
        height,
        corner,
        glazing: glazingOf(numCentral(e.u)),
        reveal: host ? (wallT.get(host.id) ?? 0.23) : 0.1,
        storey: Math.min(storeys - 1, Math.max(0, Math.floor((centroid(poly)[1] + 0.01) / storeyHeight))),
        zone: e.zone,
      });
      continue;
    }
    if (e.kind === 'roof') {
      const horizontal = Math.abs(frame.n[1]) > 0.95;
      surfaces.push({
        key: `el:${e.id}`,
        role: horizontal ? 'loft-floor' : 'roof-slope',
        elementId: e.id,
        polygon: poly,
        holes: e.geometry.holes ?? [],
        frame,
        thickness: horizontal ? loftQuiltDepth(numCentral(e.u)) : thicknessOf(e),
        extrude: horizontal ? 'out' : 'in',
      });
      continue;
    }
    if (e.kind === 'floor') {
      surfaces.push({
        key: `el:${e.id}`,
        role: 'ground-floor',
        elementId: e.id,
        polygon: poly,
        holes: e.geometry.holes ?? [],
        frame,
        thickness: thicknessOf(e),
        extrude: 'out',
        storey: 0,
      });
      continue;
    }
    surfaces.push({
      key: `el:${e.id}`,
      role: e.kind === 'party-wall' ? 'party-wall' : 'wall',
      elementId: e.id,
      polygon: poly,
      holes: e.geometry.holes ?? [],
      frame,
      thickness: wallT.get(e.id) ?? 0.23,
      extrude: e.kind === 'party-wall' ? 'centre' : 'in',
    });
  }

  // Pitched roof over a ceiling-level roof element: slopes and gables are derived from form.
  const roofKind = choiceValue(twin.form.roof);
  const pitch = twin.form.pitchDeg ? numCentral(twin.form.pitchDeg) : 35;
  const ridgeAxis: 'x' | 'z' = Math.abs(frontNormal[2]) >= Math.abs(frontNormal[0]) ? 'x' : 'z';
  let ridgeY = eavesY;
  const roofEl = twin.elements.find((e) => e.kind === 'roof');
  if (roofKind === 'pitched' || roofKind === 'rafters') {
    const t = Math.tan((pitch * Math.PI) / 180);
    const over = 0.3;
    const roofT = 0.09;
    if (ridgeAxis === 'x') {
      const zm = (footprint.z0 + footprint.z1) / 2;
      const half = (footprint.z1 - footprint.z0) / 2;
      ridgeY = eavesY + half * t;
      const ey = eavesY - over * t;
      const { x0, x1, z0, z1 } = footprint;
      const front: Vec3[] = [
        [x0, ey, z0 - over],
        [x1, ey, z0 - over],
        [x1, ridgeY, zm],
        [x0, ridgeY, zm],
      ];
      const rear: Vec3[] = [
        [x1, ey, z1 + over],
        [x0, ey, z1 + over],
        [x0, ridgeY, zm],
        [x1, ridgeY, zm],
      ];
      pushSlope(surfaces, 'roof:front', orient(front, [0, 1, -1]), roofT, roofEl?.id);
      pushSlope(surfaces, 'roof:rear', orient(rear, [0, 1, 1]), roofT, roofEl?.id);
      for (const [side, x, nx] of [
        ['left', x0, -1],
        ['right', x1, 1],
      ] as const) {
        const tri: Vec3[] = orient(
          [
            [x, eavesY, z0],
            [x, eavesY, z1],
            [x, ridgeY, zm],
          ],
          [nx, 0, 0],
        );
        const host = wallAt(twin, [nx, 0, 0], 'x', x);
        pushGable(surfaces, `gable:${side}`, tri, host, wallT);
      }
    } else {
      const xm = (footprint.x0 + footprint.x1) / 2;
      const half = (footprint.x1 - footprint.x0) / 2;
      ridgeY = eavesY + half * t;
      const ey = eavesY - over * t;
      const { x0, x1, z0, z1 } = footprint;
      const west: Vec3[] = [
        [x0 - over, ey, z1],
        [x0 - over, ey, z0],
        [xm, ridgeY, z0],
        [xm, ridgeY, z1],
      ];
      const east: Vec3[] = [
        [x1 + over, ey, z0],
        [x1 + over, ey, z1],
        [xm, ridgeY, z1],
        [xm, ridgeY, z0],
      ];
      pushSlope(surfaces, 'roof:west', orient(west, [-1, 1, 0]), roofT, roofEl?.id);
      pushSlope(surfaces, 'roof:east', orient(east, [1, 1, 0]), roofT, roofEl?.id);
      for (const [side, z, nz] of [
        ['north', z0, -1],
        ['south', z1, 1],
      ] as const) {
        const tri: Vec3[] = orient(
          [
            [x0, eavesY, z],
            [x1, eavesY, z],
            [xm, ridgeY, z],
          ],
          [0, 0, nz],
        );
        const host = wallAt(twin, [0, 0, nz], 'z', z);
        pushGable(surfaces, `gable:${side}`, tri, host, wallT);
      }
    }
  }

  const rooms = layoutRooms(twin, inner, storeys, storeyHeight, frontNormal);
  const stairs = storeys > 1 ? [stairsFor(inner, storeyHeight, frontNormal, rooms)] : [];

  // Intermediate floors, with the stair void cut out.
  for (let s = 1; s < storeys; s++) {
    const y = s * storeyHeight;
    const poly = orient(
      [
        [inner.x0, y, inner.z0],
        [inner.x1, y, inner.z0],
        [inner.x1, y, inner.z1],
        [inner.x0, y, inner.z1],
      ],
      UP,
    );
    const st = stairs.find((x) => x.storey === s - 1);
    const holes: Vec3[][] = [];
    if (st) {
      const run = st.going * st.risers;
      const a = st.start;
      const side = st.across;
      const far: Vec3 = [a[0] + st.dir[0] * run, y, a[2] + st.dir[2] * run];
      const w: Vec3 = [side[0] * st.width, 0, side[2] * st.width];
      // Void over the top two thirds of the flight.
      const from: Vec3 = [a[0] + st.dir[0] * run * 0.3, y, a[2] + st.dir[2] * run * 0.3];
      holes.push(
        orient(
          [from, far, [far[0] + w[0], y, far[2] + w[2]], [from[0] + w[0], y, from[2] + w[2]]],
          [0, -1, 0],
        ),
      );
    }
    surfaces.push({
      key: `floor:${s}`,
      role: 'intermediate-floor',
      polygon: poly,
      holes,
      frame: planeFrame(poly),
      thickness: 0.22,
      extrude: 'in',
      storey: s,
    });
  }

  // Partitions between rooms of a storey, with a doorway.
  for (const s of new Set(rooms.map((r) => r.storey))) {
    const rs = rooms.filter((r) => r.storey === s);
    for (let i = 1; i < rs.length; i++) {
      const a = rs[i - 1]!;
      const y0 = s * storeyHeight + (s > 0 ? 0 : 0);
      const y1 = (s + 1) * storeyHeight - (s + 1 < storeys ? 0.22 : 0);
      const along = ridgeAxis === 'x';
      const cut = along ? a.max[2] : a.max[0];
      const lo = along ? inner.x0 : inner.z0;
      const hi = along ? inner.x1 : inner.z1;
      const pt = (u: number, y: number): Vec3 => (along ? [u, y, cut] : [cut, y, u]);
      const poly = [pt(lo, y0), pt(hi, y0), pt(hi, y1), pt(lo, y1)];
      const doorAt = lo + (hi - lo) * 0.62;
      const hole = [pt(doorAt, y0), pt(doorAt + 0.85, y0), pt(doorAt + 0.85, y0 + 2.0), pt(doorAt, y0 + 2.0)];
      const normal: Vec3 = along ? [0, 0, -1] : [-1, 0, 0];
      surfaces.push({
        key: `partition:${s}:${i}`,
        role: 'partition',
        polygon: orient(poly, normal),
        holes: [orient(hole, [-normal[0], 0, -normal[2]])],
        frame: planeFrame(orient(poly, normal)),
        thickness: 0.1,
        extrude: 'centre',
        storey: s,
      });
    }
  }

  const chimneys: Chimney[] = [];
  const nChim = numCentral(twin.ventilation.chimneysOpen) + numCentral(twin.ventilation.chimneysBlocked);
  if (nChim > 0 && ridgeY > eavesY) {
    const open = numCentral(twin.ventilation.chimneysOpen) > 0;
    const party = twin.elements.filter((e) => e.kind === 'party-wall');
    const host = party[party.length - 1];
    if (ridgeAxis === 'x') {
      const x = host ? centroid(host.geometry.polygon)[0] : footprint.x1;
      const zm = (footprint.z0 + footprint.z1) / 2;
      chimneys.push({
        base: [Math.min(Math.max(x, footprint.x0 + 0.35), footprint.x1 - 0.35), ridgeY - 0.6, zm],
        size: [0.7, 1.55, 1.1],
        open,
        ...(host ? { elementId: host.id } : {}),
      });
    } else {
      const z = host ? centroid(host.geometry.polygon)[2] : footprint.z1;
      const xm = (footprint.x0 + footprint.x1) / 2;
      chimneys.push({
        base: [xm, ridgeY - 0.6, Math.min(Math.max(z, footprint.z0 + 0.35), footprint.z1 - 0.35)],
        size: [1.1, 1.55, 0.7],
        open,
        ...(host ? { elementId: host.id } : {}),
      });
    }
  }

  const junctions: JunctionLine[] = twin.junctions.map((j: Junction) => ({
    junctionId: j.id,
    kind: j.kind,
    path: j.path,
    lengthM: j.path.length > 1 ? polylineLength(j.path) : numCentral(j.lengthM),
    psi: numCentral(j.psi),
    elementIds: j.elementIds,
  }));

  const pts: Vec3[] = [...all, [footprint.x0, ridgeY, footprint.z0]];
  for (const c of chimneys) pts.push([c.base[0], c.base[1] + c.size[1], c.base[2]]);
  return {
    twinId: twin.id,
    storeys,
    storeyHeight,
    footprint,
    inner,
    eavesY,
    ridgeY,
    ridgeAxis,
    frontNormal,
    surfaces,
    openings,
    rooms,
    stairs,
    chimneys,
    junctions,
    bounds: bounds3(pts),
  };
}

function pushSlope(out: Surface[], key: string, poly: Vec3[], t: number, elementId?: string): void {
  out.push({
    key,
    role: 'roof-slope',
    ...(elementId ? { elementId } : {}),
    polygon: poly,
    holes: [],
    frame: planeFrame(poly),
    thickness: t,
    extrude: 'in',
  });
}

function pushGable(
  out: Surface[],
  key: string,
  tri: Vec3[],
  host: Element | undefined,
  wallT: Map<string, number>,
): void {
  out.push({
    key,
    role: 'gable',
    ...(host ? { elementId: host.id } : {}),
    polygon: tri,
    holes: [],
    frame: planeFrame(tri),
    thickness: host ? (wallT.get(host.id) ?? 0.23) : 0.23,
    extrude: host?.kind === 'party-wall' ? 'centre' : 'in',
  });
}

function wallAt(twin: HomeTwin, n: Vec3, axis: 'x' | 'z', at: number): Element | undefined {
  return twin.elements.find((e) => {
    if (e.kind !== 'wall' && e.kind !== 'party-wall') return false;
    const en = newellNormal(e.geometry.polygon);
    if (!isVertical(en) || dot(en, n) < 0.9) return false;
    const c = centroid(e.geometry.polygon);
    return Math.abs((axis === 'x' ? c[0] : c[2]) - at) < 0.05;
  });
}

/**
 * Rooms per storey along the house depth (front to rear). Ground floor: the SAP living area
 * (`zones.livingAreaFrac` of the floor area) at the front, the kitchen behind. Upper floors:
 * bedrooms at the front, a bathroom at the rear. Rooms only place props and tint zones; the
 * zone, not the room, is what carries a temperature.
 */
export function layoutRooms(
  twin: HomeTwin,
  inner: HouseModel['inner'],
  storeys: number,
  storeyHeight: number,
  frontNormal: Vec3,
): Room[] {
  const alongZ = Math.abs(frontNormal[2]) >= Math.abs(frontNormal[0]);
  const frontAtMin = alongZ ? frontNormal[2] < 0 : frontNormal[0] < 0;
  const d0 = alongZ ? inner.z0 : inner.x0;
  const d1 = alongZ ? inner.z1 : inner.x1;
  const w0 = alongZ ? inner.x0 : inner.z0;
  const w1 = alongZ ? inner.x1 : inner.z1;
  const depth = d1 - d0;
  const width = w1 - w0;
  const tfa = width * depth * storeys;
  const frac = numCentral(twin.zones.livingAreaFrac);
  const livingDepth = Math.min(depth * 0.8, Math.max(depth * 0.35, (frac * tfa) / width));

  const out: Room[] = [];
  const box = (id: string, use: RoomUse, zone: Room['zone'], s: number, a: number, b: number): Room => {
    // a and b are distances from the front face.
    const da = frontAtMin ? d0 + a : d1 - b;
    const db = frontAtMin ? d0 + b : d1 - a;
    const y0 = s * storeyHeight;
    const y1 = (s + 1) * storeyHeight - (s + 1 < storeys ? 0.22 : 0);
    const min: Vec3 = alongZ ? [w0, y0, da] : [da, y0, w0];
    const max: Vec3 = alongZ ? [w1, y1, db] : [db, y1, w1];
    return { id, use, zone, storey: s, min, max };
  };
  out.push(box('room-living', 'living', 'living', 0, 0, livingDepth));
  out.push(box('room-kitchen', 'kitchen', 'rest', 0, livingDepth, depth));
  for (let s = 1; s < storeys; s++) {
    const bath = Math.min(2.2, depth * 0.3);
    if (depth - bath > 5.5) {
      const mid = (depth - bath) * 0.55;
      out.push(box(`room-bed-${s}a`, 'bedroom', 'rest', s, 0, mid));
      out.push(box(`room-bed-${s}b`, 'bedroom', 'rest', s, mid, depth - bath));
    } else {
      out.push(box(`room-bed-${s}a`, 'bedroom', 'rest', s, 0, depth - bath));
    }
    out.push(box(`room-bath-${s}`, 'bathroom', 'rest', s, depth - bath, depth));
  }
  return out;
}

function stairsFor(
  inner: HouseModel['inner'],
  storeyHeight: number,
  frontNormal: Vec3,
  rooms: Room[],
): Stairs {
  const risers = Math.max(10, Math.round(storeyHeight / 0.205));
  const rise = storeyHeight / risers;
  const going = 0.24;
  const run = going * (risers - 1);
  const alongZ = Math.abs(frontNormal[2]) >= Math.abs(frontNormal[0]);
  const living = rooms.find((r) => r.id === 'room-living');
  // Against the first party wall (x0 side for a terrace), rising towards the rear and ending at
  // the living room partition.
  if (alongZ) {
    const front = frontNormal[2] < 0;
    const endZ = living ? (front ? living.max[2] : living.min[2]) : (inner.z0 + inner.z1) / 2;
    const dir: Vec3 = [0, 0, front ? 1 : -1];
    const startZ = endZ - dir[2] * (run + 0.05);
    const width = 0.9;
    return {
      start: [front ? inner.x0 : inner.x1, 0, startZ],
      dir,
      across: [front ? 1 : -1, 0, 0],
      width,
      risers,
      rise,
      going,
      storey: 0,
    };
  }
  const front = frontNormal[0] < 0;
  const endX = living ? (front ? living.max[0] : living.min[0]) : (inner.x0 + inner.x1) / 2;
  const dir: Vec3 = [front ? 1 : -1, 0, 0];
  return {
    start: [endX - dir[0] * (run + 0.05), 0, front ? inner.z1 : inner.z0],
    dir,
    across: [0, 0, front ? -1 : 1],
    width: 0.9,
    risers,
    rise,
    going,
    storey: 0,
  };
}

/** All element and junction ids the scene draws (AC-H1 parity with the outline). */
export function drawnIds(model: HouseModel): { elements: Set<string>; junctions: Set<string> } {
  const elements = new Set<string>();
  for (const s of model.surfaces) if (s.elementId) elements.add(s.elementId);
  for (const o of model.openings) elements.add(o.elementId);
  const junctions = new Set(model.junctions.map((j) => j.junctionId));
  return { elements, junctions };
}

/** Planar 2D ring of a surface in its own frame (for shapes and point sampling). */
export function surfaceRing2(s: Surface): { outer: Vec2[]; holes: Vec2[][] } {
  const f = s.frame;
  const to = (p: Vec3): Vec2 => [
    dot([p[0] - f.origin[0], p[1] - f.origin[1], p[2] - f.origin[2]], f.u),
    dot([p[0] - f.origin[0], p[1] - f.origin[1], p[2] - f.origin[2]], f.v),
  ];
  return { outer: s.polygon.map(to), holes: s.holes.map((h) => h.map(to)) };
}
