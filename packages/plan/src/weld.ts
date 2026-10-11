/**
 * Rooms to a welded storey (BE 2.2, B14): T-junction vertices are inserted so that every shared
 * wall is one edge in each room, then each edge becomes a `Segment` whose boundary names the room
 * on the other side, or the exterior. Adjacency is symmetric by construction.
 */
import type {
  Adjacency,
  Mm,
  PointMm,
  Room2D,
  Segment,
  SegmentBoundary,
  ShadeRule,
  WindowRule,
} from '@ibasho/core';
import { edgeLength, normaliseRing, onSegment } from './polygon.ts';

export interface RoomSpec {
  id: string;
  name?: string;
  aliases?: string[];
  outer: PointMm[];
  holes?: PointMm[][];
  spaceTypeId?: string;
  zoneId?: string;
  ceiling?: Mm;
  floorBoundary?: Room2D['floorBoundary'];
  ceilingBoundary?: Room2D['ceilingBoundary'];
}

export interface WeldOptions {
  ceiling: Mm;
  floorBoundary: Room2D['floorBoundary'];
  ceilingBoundary: Room2D['ceilingBoundary'];
  /** Boundary of edges with no room on the other side. */
  exterior: SegmentBoundary;
  /** Window and shading rules for an exterior edge (by room, edge index and building-frame normal). */
  exteriorRules?: (
    room: RoomSpec,
    edge: { a: PointMm; b: PointMm; normal: PointMm },
  ) => {
    window: WindowRule;
    shading: ShadeRule[];
  };
  /** Segment id from room id and edge index (default `sg_<room>_<i>`). */
  segId?: (roomId: string, i: number) => string;
}

const key = (a: PointMm, b: PointMm) => `${a[0]},${a[1]}>${b[0]},${b[1]}`;
const strip = (id: string) => id.replace(/^rm_/, '');

/** Insert into `ring` every point of `others` lying strictly inside one of its edges. */
export function insertTJunctions(ring: readonly PointMm[], others: readonly PointMm[]): PointMm[] {
  const out: PointMm[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as PointMm;
    const b = ring[(i + 1) % ring.length] as PointMm;
    out.push(a);
    const mids = others.filter(
      (p) => onSegment(p, a, b) && !(p[0] === a[0] && p[1] === a[1]) && !(p[0] === b[0] && p[1] === b[1]),
    );
    const d2 = (p: PointMm) => (p[0] - a[0]) * (p[0] - a[0]) + (p[1] - a[1]) * (p[1] - a[1]);
    const seen = new Set<string>();
    for (const p of [...mids].sort((x, y) => d2(x) - d2(y))) {
      const k = `${p[0]},${p[1]}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push([p[0], p[1]]);
      }
    }
  }
  return out;
}

/** Weld room outlines into `Room2D`s with segments and boundaries. */
export function weldRooms(specs: readonly RoomSpec[], opts: WeldOptions): Room2D[] {
  const rings = specs.map((s) => normaliseRing(s.outer, true));
  const allPts = rings.flat();
  const welded = rings.map((r) => insertTJunctions(r, allPts));
  const segIdOf = opts.segId ?? ((room: string, i: number) => `sg_${strip(room)}_${i}`);
  const owner = new Map<string, { roomId: string; segId: string }>();
  welded.forEach((r, ri) => {
    const roomId = (specs[ri] as RoomSpec).id;
    r.forEach((a, i) => {
      owner.set(key(a, r[(i + 1) % r.length] as PointMm), { roomId, segId: segIdOf(roomId, i) });
    });
  });
  return welded.map((r, ri) => {
    const spec = specs[ri] as RoomSpec;
    const segments: Segment[] = r.map((a, i) => {
      const b = r[(i + 1) % r.length] as PointMm;
      const other = owner.get(key(b, a));
      const id = segIdOf(spec.id, i);
      if (other && other.roomId !== spec.id) {
        return {
          id,
          boundary: { kind: 'adjacent', roomId: other.roomId, segId: other.segId },
          window: { kind: 'none' },
          shading: [],
        };
      }
      const normal: PointMm = [b[1] - a[1], a[0] - b[0]];
      const rules = opts.exteriorRules?.(spec, { a, b, normal }) ?? {
        window: { kind: 'none' } as WindowRule,
        shading: [],
      };
      return { id, boundary: opts.exterior, window: rules.window, shading: rules.shading };
    });
    const room: Room2D = {
      id: spec.id,
      floor: { outer: r, holes: (spec.holes ?? []).map((h) => normaliseRing(h, false)) },
      ceiling: spec.ceiling ?? opts.ceiling,
      segments,
      floorBoundary: spec.floorBoundary ?? opts.floorBoundary,
      ceilingBoundary: spec.ceilingBoundary ?? opts.ceilingBoundary,
    };
    if (spec.name !== undefined) room.name = spec.name;
    if (spec.aliases?.length) room.aliases = [...spec.aliases];
    if (spec.spaceTypeId !== undefined) room.spaceTypeId = spec.spaceTypeId;
    if (spec.zoneId !== undefined) room.zoneId = spec.zoneId;
    return room;
  });
}

/** Adjacency pairs from welded rooms, each shared wall once (a before b by room id). */
export function adjacencyOf(rooms: readonly Room2D[]): Adjacency[] {
  const out: Adjacency[] = [];
  for (const r of rooms) {
    const ring = r.floor.outer;
    r.segments.forEach((s, i) => {
      if (s.boundary.kind !== 'adjacent' || r.id > s.boundary.roomId) return;
      out.push({
        a: { roomId: r.id, segId: s.id },
        b: { roomId: s.boundary.roomId, segId: s.boundary.segId },
        overlap: Math.round(edgeLength(ring[i] as PointMm, ring[(i + 1) % ring.length] as PointMm)),
      });
    });
  }
  return out;
}

/** True when every adjacent segment points back at its partner (B14). */
export function adjacencySymmetric(rooms: readonly Room2D[]): boolean {
  const seg = new Map<string, { roomId: string; s: Segment }>();
  for (const r of rooms) for (const s of r.segments) seg.set(s.id, { roomId: r.id, s });
  for (const r of rooms) {
    for (const s of r.segments) {
      if (s.boundary.kind !== 'adjacent') continue;
      const o = seg.get(s.boundary.segId);
      if (!o || o.roomId !== s.boundary.roomId) return false;
      if (o.s.boundary.kind !== 'adjacent' || o.s.boundary.segId !== s.id || o.s.boundary.roomId !== r.id)
        return false;
    }
  }
  return true;
}
