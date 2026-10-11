/**
 * `compile(doc)`: BuildingDoc to CompiledBuilding (ARCH 15.4, BE 2). Owner: WP-14.
 *
 * Wave 1 scope (prototype): exact areas, facades, WWR, PF, symmetric adjacency, plan checks, a
 * multi-zone `ZoneTwin` and a triangulated `SurfaceSet` for the scene and the site worker. Room
 * outlines are the inside faces of walls (wall footprint is 0 unless a segment states a thickness).
 * PLACEHOLDER for V-1: `HomeTwin` output for single-family (B15), Room3D faces, roof shapes other
 * than flat, daylight extent and RETV.
 */
import type {
  BuildingDoc,
  CompiledBuilding,
  FacadeBin,
  Mdeg,
  Mm,
  Mm2,
  PlanCheck,
  PointMm,
  PolygonMm,
  Quantities,
  Room2D,
  Storey,
  SurfaceSet,
  ZoneTwin,
} from '@ibasho/core';
import { canonicalHash, FACADE_BINS } from '@ibasho/core';
import { triangulate, union } from './clip.ts';
import { segmentFacade } from './facade.ts';
import { centroid, polygonAreaMm2, ringAreaMm2 } from './polygon.ts';
import { adjacencyOf } from './weld.ts';
import { autoZone } from './zoning.ts';

type Surface = SurfaceSet['surfaces'][number];

/** Storeys with rooms; a massing-only document gets auto-zoned rooms (core plus perimeter). */
export function effectiveStoreys(doc: BuildingDoc): Storey[] {
  const hasRooms = doc.storeys.some((s) => s.rooms.length > 0);
  if (hasRooms || !doc.massing) return doc.storeys;
  const m = doc.massing;
  const zones = autoZone(m.footprint, m.perimeterDepth);
  const out: Storey[] = [];
  let z = 0;
  for (let i = 0; i < m.storeys; i++) {
    const f2f = i === 0 && m.groundFloorToFloor ? m.groundFloorToFloor : m.floorToFloor;
    out.push({
      id: `st_${i}`,
      name: `Storey ${i}`,
      elevation: z,
      floorToFloor: f2f,
      multiplier: 1,
      belowGrade: false,
      rooms: zones.map((zs) => ({
        id: `rm_${i}_${zs.id.replace(/^z_/, '')}`,
        floor: zs.polygon,
        ceiling: f2f - 300,
        segments: zs.polygon.outer.map((_, k) => ({
          id: `sg_${i}_${zs.id.replace(/^z_/, '')}_${k}`,
          boundary: { kind: 'outdoors' as const },
          window: { kind: 'none' as const },
          shading: [],
        })),
        floorBoundary: i === 0 ? ('ground' as const) : ('adjacent' as const),
        ceilingBoundary: i === m.storeys - 1 ? ('roof' as const) : ('adjacent' as const),
        zoneId: zs.id,
      })),
      rooms3d: [],
      cores: [],
    });
    z += f2f;
  }
  return out;
}

const quad = (
  id: string,
  kind: Surface['kind'],
  ownerId: string,
  p: [number, number, number][],
  az: Mdeg,
  tilt: Mdeg,
): Surface => ({
  id,
  kind,
  ownerId,
  positions: p.flat(),
  indices: [0, 1, 2, 0, 2, 3],
  azimuthMdeg: az,
  tiltMdeg: tilt,
});

function flat(
  id: string,
  kind: Surface['kind'],
  ownerId: string,
  poly: PolygonMm,
  z: Mm,
  up: boolean,
): Surface {
  const tris = triangulate(poly);
  const positions: number[] = [];
  const indices: number[] = [];
  for (const t of tris) {
    const base = positions.length / 3;
    const pts = up ? t : [t[0], t[2], t[1]];
    for (const p of pts) positions.push(p[0], p[1], z);
    indices.push(base, base + 1, base + 2);
  }
  return { id, kind, ownerId, positions, indices, azimuthMdeg: 0, tiltMdeg: up ? 0 : 180_000 };
}

export interface CompileOptions {
  /** Place frame rotation from true north (default 0). */
  trueNorthMdeg?: Mdeg;
  /** Skip meshes (faster for quantity-only callers such as the editor's live meters). */
  meshes?: boolean;
}

export function compile(doc: BuildingDoc, opts: CompileOptions = {}): CompiledBuilding {
  const north = opts.trueNorthMdeg ?? 0;
  const wantMeshes = opts.meshes ?? true;
  const storeys = effectiveStoreys(doc);
  const surfaces: Surface[] = [];
  const zt: ZoneTwin = {
    schema: 'ibasho.zonetwin/1',
    buildingId: doc.id,
    typeId: doc.typeId,
    zones: [],
    surfaces: [],
    systems: doc.systems,
  };
  const facades = new Map<FacadeBin, { grossMm2: Mm2; openingMm2: Mm2 }>();
  const openings: Quantities['openings'] = [];
  const checks: PlanCheck[] = [];
  const storeyQ: Quantities['storeys'] = [];
  let gfa = 0n;
  let nca = 0n;
  let roof = 0n;
  const allRooms: Room2D[] = [];
  const zoneOfRoom = new Map<string, string>();
  for (const z of doc.zones) for (const r of z.roomIds) zoneOfRoom.set(r, z.id);
  const conditionedZone = new Map(doc.zones.map((z) => [z.id, z.conditioned]));

  for (const st of storeys) {
    const mult = BigInt(st.multiplier);
    const roomSum = st.rooms.reduce((s, r) => s + polygonAreaMm2(r.floor), 0n);
    const coreSum = st.cores.reduce((s, c) => s + (c.excludeFromArea ? 0n : ringAreaMm2(c.outline)), 0n);
    const unionArea = union(st.rooms.map((r) => r.floor)).reduce((s, p) => s + polygonAreaMm2(p), 0n);
    // Per polygon areas round the final halving down, so sums can differ by under 1 mm² a room.
    const rawOverlap = roomSum - unionArea;
    const overlap = rawOverlap > BigInt(st.rooms.length) ? rawOverlap : 0n;
    storeyQ.push({
      storeyId: st.id,
      gfaMm2: roomSum + coreSum,
      roomSumMm2: roomSum,
      wallFootprintMm2: 0n,
      overlapMm2: overlap,
    });
    gfa += (roomSum + coreSum) * mult;
    if (overlap > 0n)
      checks.push({
        id: `chk_overlap_${st.id}`,
        kind: 'overlap',
        severity: 'error',
        targets: [st.id],
        message: 'plan.check.overlap',
      });

    for (const room of st.rooms) {
      allRooms.push(room);
      const area = polygonAreaMm2(room.floor);
      const zoneId = room.zoneId ?? zoneOfRoom.get(room.id) ?? `z_${room.id.replace(/^rm_/, '')}`;
      const conditioned =
        conditionedZone.get(zoneId) ??
        (room.spaceTypeId !== undefined &&
          !/^(circulation|core|stair|store|plant|parking|toilet)/.test(room.spaceTypeId));
      if (conditioned) nca += area * mult;
      if (room.ceilingBoundary === 'roof') roof += area * mult;
      if (!room.spaceTypeId)
        checks.push({
          id: `chk_untyped_${room.id}`,
          kind: 'untyped-room',
          severity: 'warn',
          targets: [room.id],
          message: 'plan.check.untyped-room',
        });
      if (area < 2_000_000n)
        checks.push({
          id: `chk_tiny_${room.id}`,
          kind: 'tiny-room',
          severity: 'warn',
          targets: [room.id],
          message: 'plan.check.tiny-room',
        });
      let zone = zt.zones.find((z) => z.id === zoneId);
      if (!zone) {
        zone = {
          id: zoneId,
          roomIds: [],
          spaceTypeIds: [],
          floorMm2: 0n,
          volumeMm3: 0n,
          conditioned,
          storeyId: st.id,
        };
        zt.zones.push(zone);
      }
      zone.roomIds.push(room.id);
      if (room.spaceTypeId && !zone.spaceTypeIds.includes(room.spaceTypeId))
        zone.spaceTypeIds.push(room.spaceTypeId);
      zone.floorMm2 += area * mult;
      zone.volumeMm3 += area * BigInt(room.ceiling) * mult;

      const ring = room.floor.outer;
      room.segments.forEach((seg, i) => {
        const a = ring[i] as PointMm;
        const b = ring[(i + 1) % ring.length] as PointMm;
        if (seg.boundary.kind === 'adjacent' || seg.boundary.kind === 'air') return;
        const f = segmentFacade(seg, a, b, st.floorToFloor, doc.rotationMdeg, north);
        const boundary =
          seg.boundary.kind === 'outdoors'
            ? 'outdoors'
            : seg.boundary.kind === 'ground'
              ? 'ground'
              : 'adiabatic';
        if (boundary === 'outdoors' && !st.belowGrade) {
          const fb = facades.get(f.bin) ?? { grossMm2: 0n, openingMm2: 0n };
          fb.grossMm2 += f.grossMm2 * mult;
          fb.openingMm2 += f.window.area * mult;
          facades.set(f.bin, fb);
        }
        if (f.window.area > (f.grossMm2 * 950n) / 1000n)
          checks.push({
            id: `chk_wow_${seg.id}`,
            kind: 'window-over-wall',
            severity: 'error',
            targets: [seg.id],
            message: 'plan.check.window-over-wall',
          });
        zt.surfaces.push({
          id: `${seg.id}_wall`,
          zoneId,
          kind: 'wall',
          areaMm2: (f.grossMm2 - f.window.area) * mult,
          azimuthMdeg: f.azimuthMdeg,
          tiltMdeg: 90_000,
          boundary,
          ...(seg.constructionId ? { constructionId: seg.constructionId } : {}),
        });
        if (f.window.area > 0n) {
          const wid = `${seg.id}_win`;
          zt.surfaces.push({
            id: wid,
            zoneId,
            kind: 'window',
            areaMm2: f.window.area * mult,
            azimuthMdeg: f.azimuthMdeg,
            tiltMdeg: 90_000,
            boundary,
            hostId: `${seg.id}_wall`,
          });
          openings.push({
            id: wid,
            segId: seg.id,
            areaMm2: f.window.area * mult,
            ...(f.pf ? { pf: f.pf } : {}),
          });
        }
        if (wantMeshes) {
          for (let k = 0; k < st.multiplier; k++) {
            const z0 = st.elevation + k * st.floorToFloor;
            const z1 = z0 + st.floorToFloor;
            const sfx = st.multiplier > 1 ? `@${k}` : '';
            surfaces.push(
              quad(
                `${seg.id}_wall${sfx}`,
                'wall',
                seg.id,
                [
                  [a[0], a[1], z0],
                  [b[0], b[1], z0],
                  [b[0], b[1], z1],
                  [a[0], a[1], z1],
                ],
                f.azimuthMdeg,
                90_000,
              ),
            );
            if (f.window.area > 0n && f.length > 0) {
              // One representative band: the glazed area as a strip centred on the wall, 20 mm proud.
              const h = Math.min(f.window.height, st.floorToFloor - f.window.sill);
              const w = Math.min(f.length, Number(f.window.area / BigInt(Math.max(h, 1))));
              const t0 = (f.length - w) / 2 / f.length;
              const t1 = 1 - t0;
              const nx = (b[1] - a[1]) / f.length;
              const ny = (a[0] - b[0]) / f.length;
              const P = (t: number, z: number): [number, number, number] => [
                Math.round(a[0] + (b[0] - a[0]) * t + nx * 20),
                Math.round(a[1] + (b[1] - a[1]) * t + ny * 20),
                z,
              ];
              const zs = z0 + f.window.sill;
              surfaces.push(
                quad(
                  `${seg.id}_win${sfx}`,
                  'window',
                  seg.id,
                  [P(t0, zs), P(t1, zs), P(t1, zs + h), P(t0, zs + h)],
                  f.azimuthMdeg,
                  90_000,
                ),
              );
            }
          }
        }
      });
      if (room.ceilingBoundary === 'roof')
        zt.surfaces.push({
          id: `${room.id}_roof`,
          zoneId,
          kind: 'roof',
          areaMm2: area * mult,
          azimuthMdeg: 0,
          tiltMdeg: 0,
          boundary: 'outdoors',
        });
      if (room.floorBoundary === 'ground')
        zt.surfaces.push({
          id: `${room.id}_floor`,
          zoneId,
          kind: 'floor',
          areaMm2: area * mult,
          azimuthMdeg: 0,
          tiltMdeg: 180_000,
          boundary: 'ground',
        });
      if (wantMeshes) {
        const top = st.elevation + st.multiplier * st.floorToFloor;
        if (room.ceilingBoundary === 'roof' || room.ceilingBoundary === 'exposed')
          surfaces.push(flat(`${room.id}_roof`, 'roof', room.id, room.floor, top, true));
        if (room.floorBoundary !== 'adjacent')
          surfaces.push(flat(`${room.id}_floor`, 'floor', room.id, room.floor, st.elevation, false));
      }
    }
  }
  const zoneIds = new Set(zt.zones.map((z) => z.id));
  for (const z of doc.zones)
    if (!zoneIds.has(z.id))
      checks.push({
        id: `chk_orphan_${z.id}`,
        kind: 'orphan-zone',
        severity: 'info',
        targets: [z.id],
        message: 'plan.check.orphan-zone',
      });

  const quantities: Quantities = {
    gfaMm2: gfa,
    ncaMm2: nca,
    storeys: storeyQ,
    facades: FACADE_BINS.filter((b) => facades.has(b)).map((b) => ({
      bin: b,
      ...(facades.get(b) as { grossMm2: Mm2; openingMm2: Mm2 }),
    })),
    roofMm2: roof,
    skylightMm2: 0n,
    openings,
  };
  return {
    docHash: canonicalHash(doc),
    twin: zt,
    quantities,
    adjacency: adjacencyOf(allRooms),
    checks,
    meshes: { surfaces },
    placement: { origin: { ...doc.origin }, rotationMdeg: doc.rotationMdeg },
  };
}

/** Room label anchor (area centroid) for plan drawings. */
export const roomAnchor = (r: Room2D): PointMm => centroid(r.floor.outer);
