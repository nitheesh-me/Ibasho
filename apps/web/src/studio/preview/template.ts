/**
 * Start-from templates for the New flow (SPEC 18.1 Building step, UV 5.1). Owner: WP-08.
 *
 * A rectangular plate stacked N storeys and auto-zoned by type: perimeter rooms at 4.57 m depth
 * around a core, ASHRAE 90.1 Appendix G style, with the type's main function painted on the
 * perimeter. Massing in, rooms out; the person refines in Make.
 */
import type { BuildingDoc, BuildingTypeId, Room2D, Storey } from '@ibasho/core';
import { classifyStorey, rect, segmentsFor, TYPE_FUNCTIONS } from '@ibasho/editor/core';

export interface TemplateSpec {
  typeId: BuildingTypeId;
  name: string;
  placeId: string;
  widthM: number;
  depthM: number;
  storeys: number;
  floorToFloorM: number;
  wwrPct: number;
  rotationDeg: number;
  autoZone: boolean;
}

export const TYPE_DEFAULTS: Record<BuildingTypeId, { w: number; d: number; n: number; ftf: number }> = {
  office: { w: 59, d: 37, n: 15, ftf: 3.6 },
  hotel: { w: 60, d: 18, n: 8, ftf: 3.2 },
  education: { w: 72, d: 16, n: 3, ftf: 4.2 },
  hospital: { w: 70, d: 22, n: 6, ftf: 4.2 },
  lab: { w: 48, d: 20, n: 4, ftf: 4.5 },
  apartments: { w: 40, d: 18, n: 10, ftf: 3.0 },
  rental: { w: 14, d: 10, n: 1, ftf: 3.0 },
  'single-family': { w: 12, d: 9, n: 2, ftf: 3.0 },
};

const PERIM = 4_570;

function plate(
  w: number,
  d: number,
  fn: string | undefined,
  core: string,
  zone: boolean,
  prefix: string,
  ceiling: number,
): Room2D[] {
  const room = (id: string, a: [number, number], b: [number, number], f?: string): Room2D => {
    const ring = rect(a, b);
    return {
      id,
      floor: { outer: ring, holes: [] },
      ceiling,
      segments: segmentsFor(ring).map((s) => ({
        ...s,
        window: { kind: 'ratio' as const, wwrPm: 300, sill: 900, head: 2400 },
      })),
      floorBoundary: 'adjacent',
      ceilingBoundary: 'adjacent',
      ...(f ? { spaceTypeId: f } : {}),
    };
  };
  if (!zone || w < 3 * PERIM || d < 3 * PERIM) return [room(`${prefix}a`, [0, 0], [w, d], fn)];
  const p = PERIM;
  return [
    room(`${prefix}s`, [0, 0], [w, p], fn),
    room(`${prefix}n`, [0, d - p], [w, d], fn),
    room(`${prefix}w`, [0, p], [p, d - p], fn),
    room(`${prefix}e`, [w - p, p], [w, d - p], fn),
    room(`${prefix}c`, [p, p], [w - p, d - p], core),
  ];
}

export function templateDoc(t: TemplateSpec, id: string): BuildingDoc {
  const w = Math.round(t.widthM * 1000);
  const d = Math.round(t.depthM * 1000);
  const ftf = Math.round(t.floorToFloorM * 1000);
  const fns = TYPE_FUNCTIONS[t.typeId];
  const main = fns[0];
  const core =
    t.typeId === 'single-family' || t.typeId === 'rental' ? (fns[1] ?? main ?? 'living') : 'circulation';
  const storeys: Storey[] = [];
  // Typical floors share one storey with a multiplier (the Dragonfly convention, BE 3.3).
  const typical = t.storeys > 3;
  const levels = typical ? 2 : t.storeys;
  for (let i = 0; i < levels; i++) {
    const s: Storey = {
      id: `st_${i}`,
      name: i === 0 ? 'Ground floor' : typical ? `Floors ${2} to ${t.storeys}` : `Floor ${i}`,
      elevation: i * ftf,
      floorToFloor: ftf,
      multiplier: typical && i === 1 ? t.storeys - 1 : 1,
      belowGrade: false,
      rooms: plate(
        w,
        d,
        i === 0 && t.typeId === 'office' ? 'lobby' : main,
        core,
        t.autoZone,
        `rm_${i}`,
        ftf - 600,
      ),
      rooms3d: [],
      cores: [],
    };
    for (const r of s.rooms)
      for (const seg of r.segments)
        if (seg.window.kind === 'ratio') seg.window = { ...seg.window, wwrPm: t.wwrPct * 10 };
    classifyStorey(s);
    if (i === 0) for (const r of s.rooms) r.floorBoundary = 'ground';
    storeys.push(s);
  }
  const top = storeys[storeys.length - 1];
  if (top) for (const r of top.rooms) r.ceilingBoundary = 'roof';
  return {
    schema: 'ibasho.building/1',
    id,
    version: 1,
    placeId: t.placeId,
    name: t.name,
    typeId: t.typeId,
    origin: { x: 0, y: 0 },
    rotationMdeg: Math.round(t.rotationDeg * 1000),
    storeys,
    roofs: [{ id: 'rf_0', storeyId: top?.id ?? 'st_0', shape: 'flat', pvZones: [], skylights: [] }],
    shades: [],
    zones: [],
    systems: [],
  };
}
