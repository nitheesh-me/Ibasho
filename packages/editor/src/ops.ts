/**
 * Editing a building document as commands of Immer patches (SPEC 20, BE 3.4). Owner: WP-15.
 *
 * Every tool turns into one `EditCommand` with forward and inverse patches, an origin (person,
 * agent, partner, import) and a plain label. Undo and redo apply patches; nothing is mutated.
 * Recipes are pure functions over a draft, exported so the app, the agent link and tests can run
 * the same edits a pointer makes.
 */
import type {
  BuildingDoc,
  FacadeBin,
  Mm,
  PointMm,
  Room2D,
  Segment,
  ShadeRule,
  Storey,
  Underlay,
  WindowRule,
} from '@ibasho/core';
import {
  applyPatches,
  current,
  type Draft,
  enablePatches,
  isDraft,
  type Patch,
  produceWithPatches,
} from 'immer';
import { bbox, ccw, edge, edgeBin, isAxisRect, sharedLength, splitRing } from './geom.ts';

enablePatches();

/** Deep copy that also works on Immer drafts (structuredClone cannot clone a Proxy). */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(isDraft(v) ? current(v as Draft<T>) : v)) as T;
}

export type EditOrigin = 'person' | 'agent' | 'partner' | 'import';

export interface EditCommand {
  id: string;
  label: string;
  origin: EditOrigin;
  at: number;
  patches: Patch[];
  inverse: Patch[];
}

export type Recipe = (draft: Draft<BuildingDoc>) => void;

let counter = 0;
/** Stable, readable ids (`rm_`, `sg_`, `st_` by convention). */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  const r = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${r}${counter.toString(36)}`;
}

/** Apply a recipe and record it. Returns the same doc and no command when nothing changed. */
export function edit(
  doc: BuildingDoc,
  label: string,
  recipe: Recipe,
  origin: EditOrigin = 'person',
): { doc: BuildingDoc; cmd: EditCommand | null } {
  const [next, patches, inverse] = produceWithPatches(doc, recipe);
  if (patches.length === 0) return { doc, cmd: null };
  return { doc: next, cmd: { id: newId('cmd'), label, origin, at: Date.now(), patches, inverse } };
}

// ------------------------------------------------------------------------------------------------
// History

export interface History {
  past: EditCommand[];
  future: EditCommand[];
}
export const emptyHistory = (): History => ({ past: [], future: [] });

export function record(h: History, cmd: EditCommand, limit = 200): History {
  const past = [...h.past, cmd];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, future: [] };
}

export function undo(
  h: History,
  doc: BuildingDoc,
): { history: History; doc: BuildingDoc; cmd: EditCommand } | null {
  const cmd = h.past[h.past.length - 1];
  if (!cmd) return null;
  return {
    history: { past: h.past.slice(0, -1), future: [cmd, ...h.future] },
    doc: applyPatches(doc, cmd.inverse),
    cmd,
  };
}

export function redo(
  h: History,
  doc: BuildingDoc,
): { history: History; doc: BuildingDoc; cmd: EditCommand } | null {
  const cmd = h.future[0];
  if (!cmd) return null;
  return {
    history: { past: [...h.past, cmd], future: h.future.slice(1) },
    doc: applyPatches(doc, cmd.patches),
    cmd,
  };
}

// ------------------------------------------------------------------------------------------------
// Helpers on drafts

function storeyOf(d: Draft<BuildingDoc>, storeyId: string): Draft<Storey> {
  const s = d.storeys.find((x) => x.id === storeyId);
  if (!s) throw new Error(`no storey ${storeyId}`);
  return s;
}
function roomOf(s: Draft<Storey>, roomId: string): Draft<Room2D> {
  const r = s.rooms.find((x) => x.id === roomId);
  if (!r) throw new Error(`no room ${roomId}`);
  return r;
}

const DEFAULT_WINDOW: WindowRule = { kind: 'ratio', wwrPm: 300, sill: 900, head: 2400 };

/**
 * Segments for a ring. An edge lying on an edge of `from` keeps that edge's window, shading and
 * boundary kind; a new interior edge (from a split) gets no window.
 */
export function segmentsFor(ring: PointMm[], from?: { ring: PointMm[]; segments: Segment[] }): Segment[] {
  return ring.map((_, i) => {
    const e = edge(ring, i);
    if (from) {
      for (let j = 0; j < from.ring.length; j++) {
        if (sharedLength(e, edge(from.ring, j)) > 0) {
          const old = from.segments[j];
          if (old) return { ...clone(old), id: newId('sg') };
        }
      }
      return { id: newId('sg'), boundary: { kind: 'air' }, window: { kind: 'none' }, shading: [] };
    }
    return { id: newId('sg'), boundary: { kind: 'outdoors' }, window: { ...DEFAULT_WINDOW }, shading: [] };
  });
}

/**
 * Re-derive every segment boundary on a storey: a stretch shared with another room is `adjacent`
 * (symmetric, B14), anything else faces outdoors (or ground below grade). An edge that becomes
 * interior loses its window.
 */
export function classifyStorey(s: Draft<Storey> | Storey): void {
  const rooms = s.rooms as Room2D[];
  for (const r of rooms) {
    r.segments.forEach((seg, i) => {
      const e = edge(r.floor.outer, i);
      let hit: { roomId: string; segId: string } | undefined;
      for (const o of rooms) {
        if (o.id === r.id) continue;
        for (let j = 0; j < o.floor.outer.length; j++) {
          if (sharedLength(e, edge(o.floor.outer, j)) > 100) {
            const os = o.segments[j];
            if (os) hit = { roomId: o.id, segId: os.id };
            break;
          }
        }
        if (hit) break;
      }
      if (hit) {
        seg.boundary = { kind: 'adjacent', roomId: hit.roomId, segId: hit.segId };
        seg.window = { kind: 'none' };
      } else if (seg.boundary.kind === 'adjacent' || seg.boundary.kind === 'air') {
        seg.boundary = { kind: s.belowGrade ? 'ground' : 'outdoors' };
      }
    });
  }
}

/** Recompute storey elevations from floor-to-floor heights, keeping below-grade storeys below zero. */
export function restack(d: Draft<BuildingDoc> | BuildingDoc): void {
  const below = d.storeys.filter((s) => s.belowGrade);
  const above = d.storeys.filter((s) => !s.belowGrade);
  let z = 0;
  for (const s of above) {
    s.elevation = z;
    z += s.floorToFloor * Math.max(1, s.multiplier);
  }
  z = 0;
  for (const s of [...below].reverse()) {
    z -= s.floorToFloor;
    s.elevation = z;
  }
  d.storeys.sort((a, b) => a.elevation - b.elevation);
}

// ------------------------------------------------------------------------------------------------
// Recipes

export function addRoom(
  storeyId: string,
  outer: PointMm[],
  opts: { spaceTypeId?: string; name?: string; id?: string } = {},
): Recipe {
  return (d) => {
    const s = storeyOf(d, storeyId);
    const ring = ccw(outer);
    const room: Room2D = {
      id: opts.id ?? newId('rm'),
      floor: { outer: ring, holes: [] },
      ceiling: Math.max(2400, s.floorToFloor - 600),
      segments: segmentsFor(ring),
      floorBoundary: s.belowGrade ? 'ground' : 'adjacent',
      ceilingBoundary: 'adjacent',
      ...(opts.spaceTypeId ? { spaceTypeId: opts.spaceTypeId } : {}),
      ...(opts.name ? { name: opts.name } : {}),
    };
    s.rooms.push(room);
    classifyStorey(s);
  };
}

export function deleteRooms(storeyId: string, roomIds: readonly string[]): Recipe {
  return (d) => {
    const s = storeyOf(d, storeyId);
    s.rooms = s.rooms.filter((r) => !roomIds.includes(r.id));
    classifyStorey(s);
  };
}

export function setRoomFunction(
  storeyId: string,
  roomIds: readonly string[],
  spaceTypeId: string | undefined,
): Recipe {
  return (d) => {
    const s = storeyOf(d, storeyId);
    for (const id of roomIds) {
      const r = roomOf(s, id);
      if (spaceTypeId) r.spaceTypeId = spaceTypeId;
      else delete r.spaceTypeId;
    }
  };
}

export function renameRoom(storeyId: string, roomId: string, name: string): Recipe {
  return (d) => {
    const r = roomOf(storeyOf(d, storeyId), roomId);
    if (name.trim()) r.name = name.trim();
    else delete r.name;
  };
}

export function moveRooms(storeyId: string, roomIds: readonly string[], dx: Mm, dy: Mm): Recipe {
  return (d) => {
    const s = storeyOf(d, storeyId);
    for (const id of roomIds) {
      const r = roomOf(s, id);
      r.floor.outer = r.floor.outer.map(([x, y]) => [x + dx, y + dy] as PointMm);
    }
    classifyStorey(s);
  };
}

/** Split a room by a vertical (`x`) or horizontal (`y`) line; the new room keeps the function. */
export function splitRoom(storeyId: string, roomId: string, axis: 'x' | 'y', at: Mm): Recipe {
  return (d) => {
    const s = storeyOf(d, storeyId);
    const r = roomOf(s, roomId);
    const old = { ring: clone(r.floor.outer) as PointMm[], segments: clone(r.segments) as Segment[] };
    const parts = splitRing(old.ring, axis, at);
    if (!parts) return;
    const [a, b] = parts;
    r.floor.outer = a;
    r.segments = segmentsFor(a, old);
    const twin: Room2D = {
      id: newId('rm'),
      floor: { outer: b, holes: [] },
      ceiling: r.ceiling,
      segments: segmentsFor(b, old),
      floorBoundary: r.floorBoundary,
      ceilingBoundary: r.ceilingBoundary,
      ...(r.spaceTypeId ? { spaceTypeId: r.spaceTypeId } : {}),
    };
    s.rooms.splice(s.rooms.indexOf(r) + 1, 0, twin);
    classifyStorey(s);
  };
}

/** Merge two axis-aligned rectangles that share a full edge into one. No-op otherwise. */
export function mergeRooms(storeyId: string, aId: string, bId: string): Recipe {
  return (d) => {
    const s = storeyOf(d, storeyId);
    const a = roomOf(s, aId);
    const b = roomOf(s, bId);
    if (!isAxisRect(a.floor.outer) || !isAxisRect(b.floor.outer)) return;
    const A = bbox(a.floor.outer);
    const B = bbox(b.floor.outer);
    const sameRows = A.y0 === B.y0 && A.y1 === B.y1 && (A.x1 === B.x0 || B.x1 === A.x0);
    const sameCols = A.x0 === B.x0 && A.x1 === B.x1 && (A.y1 === B.y0 || B.y1 === A.y0);
    if (!sameRows && !sameCols) return;
    const ring = ccw([
      [Math.min(A.x0, B.x0), Math.min(A.y0, B.y0)],
      [Math.max(A.x1, B.x1), Math.min(A.y0, B.y0)],
      [Math.max(A.x1, B.x1), Math.max(A.y1, B.y1)],
      [Math.min(A.x0, B.x0), Math.max(A.y1, B.y1)],
    ]);
    const old = { ring: clone(a.floor.outer) as PointMm[], segments: clone(a.segments) as Segment[] };
    a.floor.outer = ring;
    a.segments = segmentsFor(ring, old);
    s.rooms = s.rooms.filter((r) => r.id !== bId);
    classifyStorey(s);
  };
}

export function setWindow(storeyId: string, roomId: string, segId: string, rule: WindowRule): Recipe {
  return (d) => {
    const seg = roomOf(storeyOf(d, storeyId), roomId).segments.find((x) => x.id === segId);
    if (seg && seg.boundary.kind !== 'adjacent') seg.window = rule;
  };
}

export function setShading(storeyId: string, roomId: string, segId: string, rules: ShadeRule[]): Recipe {
  return (d) => {
    const seg = roomOf(storeyOf(d, storeyId), roomId).segments.find((x) => x.id === segId);
    if (seg) seg.shading = rules;
  };
}

/** Facade-wide edits: every outdoor segment facing `bin` on the chosen storeys ("same on every floor"). */
export function setFacade(
  storeyIds: readonly string[] | 'all',
  bin: FacadeBin | 'all',
  change: { wwrPm?: number; shading?: ShadeRule[] },
): Recipe {
  return (d) => {
    for (const s of d.storeys) {
      if (storeyIds !== 'all' && !storeyIds.includes(s.id)) continue;
      if (s.belowGrade) continue;
      for (const r of s.rooms) {
        r.segments.forEach((seg, i) => {
          if (seg.boundary.kind !== 'outdoors') return;
          if (bin !== 'all' && edgeBin(r.floor.outer as PointMm[], i, d.rotationMdeg) !== bin) return;
          if (change.wwrPm !== undefined) {
            seg.window =
              change.wwrPm <= 0
                ? { kind: 'none' }
                : {
                    kind: 'ratio',
                    wwrPm: change.wwrPm,
                    sill: seg.window.kind === 'ratio' ? seg.window.sill : 900,
                    head: seg.window.kind === 'ratio' && seg.window.head ? seg.window.head : 2400,
                  };
          }
          if (change.shading) seg.shading = clone(change.shading);
        });
      }
    }
  };
}

export function setStorey(
  storeyId: string,
  patch: Partial<Pick<Storey, 'name' | 'floorToFloor' | 'multiplier' | 'belowGrade'>>,
): Recipe {
  return (d) => {
    const s = storeyOf(d, storeyId);
    if (patch.name !== undefined) s.name = patch.name;
    if (patch.floorToFloor !== undefined) s.floorToFloor = Math.max(2400, Math.round(patch.floorToFloor));
    if (patch.multiplier !== undefined) s.multiplier = Math.max(1, Math.round(patch.multiplier));
    if (patch.belowGrade !== undefined) s.belowGrade = patch.belowGrade;
    restack(d);
  };
}

/** Add a storey above `storeyId`, copying its rooms, walls only (footprint) or nothing. */
export function addStoreyAbove(
  storeyId: string,
  copy: 'rooms' | 'footprint' | 'empty',
  id = newId('st'),
): Recipe {
  return (d) => {
    const s = storeyOf(d, storeyId);
    const above = d.storeys.filter((x) => !x.belowGrade).length;
    const next: Storey = {
      id,
      name: above === 0 ? 'Ground floor' : `Floor ${above}`,
      elevation: s.elevation + s.floorToFloor,
      floorToFloor: s.floorToFloor,
      multiplier: 1,
      belowGrade: false,
      rooms: [],
      rooms3d: [],
      cores: [],
    };
    if (copy !== 'empty') {
      for (const r of s.rooms as Room2D[]) {
        const ring = clone(r.floor.outer);
        const room: Room2D = {
          ...clone(r),
          id: newId('rm'),
          floor: { outer: ring, holes: [] },
          segments: r.segments.map((g) => ({ ...clone(g), id: newId('sg') })),
          floorBoundary: 'adjacent',
        };
        if (copy === 'footprint') delete room.spaceTypeId;
        next.rooms.push(room);
      }
      classifyStorey(next);
    }
    d.storeys.splice(d.storeys.indexOf(s) + 1, 0, next);
    for (const st of d.storeys) for (const r of st.rooms) r.ceilingBoundary = 'adjacent';
    const top = d.storeys[d.storeys.length - 1];
    if (top) for (const r of top.rooms) r.ceilingBoundary = 'roof';
    restack(d);
  };
}

export function removeStorey(storeyId: string): Recipe {
  return (d) => {
    if (d.storeys.length <= 1) return;
    d.storeys = d.storeys.filter((s) => s.id !== storeyId);
    const top = d.storeys[d.storeys.length - 1];
    if (top) for (const r of top.rooms) r.ceilingBoundary = 'roof';
    restack(d);
  };
}

export function setUnderlay(storeyId: string, underlay: Underlay | undefined): Recipe {
  return (d) => {
    const s = storeyOf(d, storeyId);
    if (underlay) s.underlay = underlay;
    else delete s.underlay;
  };
}

export function setRotation(rotationMdeg: number): Recipe {
  return (d) => {
    d.rotationMdeg = ((Math.round(rotationMdeg) % 360_000) + 360_000) % 360_000;
  };
}
