/**
 * Preview site analysis (sun, radiation, daylight; SD 4): per surface monthly irradiation and sun
 * hours from the monthly climate, cut by an obstruction estimate from the city context, a
 * shading ledger per blocker, monthly window shading factors, and a T0 daylight estimate per room.
 * The real stages (WP-16) replace this with the SPA, Perez sky and the visibility kernel.
 */
import type {
  CityTile,
  CompiledBuilding,
  ContextBuilding,
  PointMm,
  Resolution,
  ResultStamp,
  SiteResult,
  StageId,
} from '@ibasho/core';
import { facadeBin, isZoneTwin, Q } from '@ibasho/core';
import type { MonthlyClimate } from './climate.gen.ts';
import { surfaceSun } from './solar.ts';
import { REGULARLY_OCCUPIED } from './space-types.ts';

type Surface = CompiledBuilding['meshes']['surfaces'][number];

interface Blocker {
  b: ContextBuilding;
  c: PointMm;
  size: number;
}

const centre = (pts: readonly PointMm[]): PointMm => [
  pts.reduce((s, p) => s + p[0], 0) / pts.length,
  pts.reduce((s, p) => s + p[1], 0) / pts.length,
];

function placeOf(c: CompiledBuilding) {
  const o = c.placement?.origin ?? { x: 0, y: 0 };
  const r = ((c.placement?.rotationMdeg ?? 0) / 1000) * (Math.PI / 180);
  const s = Math.sin(r);
  const k = Math.cos(r);
  return (x: number, y: number): PointMm => [o.x + x * k + y * s, o.y - x * s + y * k];
}

function surfaceCentre(s: Surface): [number, number, number] {
  const p = s.positions;
  const n = p.length / 3;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < n; i++) {
    x += p[i * 3] as number;
    y += p[i * 3 + 1] as number;
    z += p[i * 3 + 2] as number;
  }
  return [x / n, y / n, z / n];
}

function surfaceAreaM2(s: Surface): number {
  const p = s.positions;
  let a = 0;
  for (let t = 0; t < s.indices.length; t += 3) {
    const i = (s.indices[t] as number) * 3;
    const j = (s.indices[t + 1] as number) * 3;
    const k = (s.indices[t + 2] as number) * 3;
    const ux = (p[j] as number) - (p[i] as number);
    const uy = (p[j + 1] as number) - (p[i + 1] as number);
    const uz = (p[j + 2] as number) - (p[i + 2] as number);
    const vx = (p[k] as number) - (p[i] as number);
    const vy = (p[k + 1] as number) - (p[i + 1] as number);
    const vz = (p[k + 2] as number) - (p[i + 2] as number);
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    a += Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
  }
  return a / 1e6;
}

export interface SiteCore {
  surfaces: {
    id: string;
    kind: Surface['kind'];
    areaM2: number;
    irr: number[];
    unshaded: number[];
    sunHours: number[];
    svf: number;
  }[];
  windows: { id: string; factor: number[] }[];
  ledger: { receiver: string; blocker: string; lostWh: number }[];
  rooms: { id: string; sda: [number, number]; ase: [number, number]; views: [number, number] }[];
}

export function siteModel(
  c: CompiledBuilding,
  clim: MonthlyClimate,
  tiles: readonly CityTile[],
  radiusM = 300,
  /** Context ids the building replaces (the pack's HERO_CONTEXT_IDS); else footprint containment. */
  replacedIds?: readonly string[],
): SiteCore {
  const toPlace = placeOf(c);
  const pts = c.meshes.surfaces.flatMap((s) => {
    const out: PointMm[] = [];
    for (let i = 0; i < s.positions.length; i += 3)
      out.push(toPlace(s.positions[i] as number, s.positions[i + 1] as number));
    return out;
  });
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const tris: [PointMm, PointMm, PointMm][] = [];
  for (const s of c.meshes.surfaces) {
    if (s.kind !== 'floor' && s.kind !== 'roof') continue;
    for (let i = 0; i < s.indices.length; i += 3) {
      const v = (k: number): PointMm => {
        const j = (s.indices[i + k] as number) * 3;
        return toPlace(s.positions[j] as number, s.positions[j + 1] as number);
      };
      tris.push([v(0), v(1), v(2)]);
    }
  }
  const side = (p: PointMm, a: PointMm, b: PointMm) =>
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const onFootprint = (p: PointMm) =>
    tris.some(([a, b, cc]) => {
      const d1 = side(p, a, b);
      const d2 = side(p, b, cc);
      const d3 = side(p, cc, a);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    });
  const blockers: Blocker[] = tiles
    .flatMap((t) => t.buildings)
    .map((b) => {
      const c0 = centre(b.footprint);
      const xs2 = b.footprint.map((p) => p[0]);
      const ys2 = b.footprint.map((p) => p[1]);
      return {
        b,
        c: c0,
        size: Math.max(Math.max(...xs2) - Math.min(...xs2), Math.max(...ys2) - Math.min(...ys2)),
      };
    })
    // The modelled building replaces only its own OSM outlines: the listed ids, or, when none are
    // given, buildings whose centroid lies on one of its floor triangles.
    .filter((x) => (replacedIds ? !replacedIds.includes(x.b.id) : !onFootprint(x.c)))
    // Unknown heights are ghosts: never used as shade (RB 5, R29). Ranged heights use `likely`.
    .filter((x) => x.b.height.source !== 'unknown')
    .filter((x) => {
      const dx = x.c[0] - (box.x0 + box.x1) / 2;
      const dy = x.c[1] - (box.y0 + box.y1) / 2;
      return Math.sqrt(dx * dx + dy * dy) < radiusM * 1000 + (box.x1 - box.x0) / 2;
    });
  const sunCache = new Map<string, ReturnType<typeof surfaceSun>>();
  const out: SiteCore = { surfaces: [], windows: [], ledger: [], rooms: [] };
  const ledger = new Map<string, number>();
  for (const s of c.meshes.surfaces) {
    if (s.kind !== 'wall' && s.kind !== 'roof' && s.kind !== 'window') continue;
    const az = s.azimuthMdeg / 1000;
    const tilt = s.kind === 'roof' ? 0 : 90;
    const key = `${Math.round(az / 5)}:${tilt}`;
    let sun = sunCache.get(key);
    if (!sun) {
      sun = surfaceSun(clim, Math.round(az / 5) * 5, tilt);
      sunCache.set(key, sun);
    }
    const [cx, cy, cz] = surfaceCentre(s);
    if (cz < 0) continue; // below grade
    const p = toPlace(cx, cy);
    const azr = (az * Math.PI) / 180;
    const nx = Math.sin(azr);
    const ny = Math.cos(azr);
    let keep = 1;
    const fracs: { id: string; f: number }[] = [];
    for (const bl of blockers) {
      const dx = bl.c[0] - p[0];
      const dy = bl.c[1] - p[1];
      const d = Math.max(3000, Math.sqrt(dx * dx + dy * dy));
      if (d > radiusM * 1000) continue;
      if (tilt === 90 && (dx * nx + dy * ny) / d < 0.2) continue;
      const rise = bl.b.height.likely - cz;
      if (rise <= 0) continue;
      const elev = Math.atan(rise / d) / (Math.PI / 2);
      const width = Math.min(1, bl.size / d);
      const f = Math.min(0.45, elev * width * (tilt === 0 ? 0.25 : 0.6));
      if (f < 0.005) continue;
      keep *= 1 - f;
      fracs.push({ id: bl.b.id, f });
    }
    const area = surfaceAreaM2(s);
    const svf = Math.max(0.2, (tilt === 0 ? 1 : 0.5) * keep);
    const irr = sun.irr.map((v, m) => v - (sun.beam[m] as number) * (1 - keep));
    const sumF = fracs.reduce((t, x) => t + x.f, 0);
    if (sumF > 0) {
      const lostTotal = sun.beam.reduce((t, b) => t + b, 0) * (1 - keep) * area;
      for (const x of fracs) {
        const k = `${s.id}|${x.id}`;
        ledger.set(k, (ledger.get(k) ?? 0) + (lostTotal * x.f) / sumF);
      }
    }
    out.surfaces.push({
      id: s.id,
      kind: s.kind,
      areaM2: area,
      irr,
      unshaded: sun.irr,
      sunHours: sun.sunHours.map((h) => h * keep),
      svf,
    });
    if (s.kind === 'window')
      out.windows.push({
        id: s.id,
        factor: irr.map((v, m) => (sun.irr[m] ? v / (sun.irr[m] as number) : 1)),
      });
  }
  out.ledger = [...ledger.entries()].map(([k, lostWh]) => {
    const [receiver, blocker] = k.split('|') as [string, string];
    return { receiver, blocker, lostWh };
  });
  // T0 daylight per room: glazing to floor ratio, orientation and obstruction.
  if (isZoneTwin(c.twin)) {
    const winKeep = new Map(
      out.windows.map((w) => [w.id.replace(/@\d+$/, ''), w.factor.reduce((a, b) => a + b, 0) / 12]),
    );
    for (const z of c.twin.zones) {
      // Daylight metrics only for regularly occupied spaces (no stairs, corridors, plant, data centre).
      if (!REGULARLY_OCCUPIED.has(z.spaceTypeIds[0] ?? '')) continue;
      const floor = Number(z.floorMm2) / 1e6;
      const wins = c.twin.surfaces.filter((s) => s.zoneId === z.id && s.kind === 'window');
      const glaz = wins.reduce((t, w) => t + (Number(w.areaMm2) / 1e6) * (winKeep.get(w.id) ?? 1), 0);
      const sunny = wins
        .filter((w) => ['S', 'SW', 'W', 'SE', 'E'].includes(facadeBin(w.azimuthMdeg)))
        .reduce((t, w) => t + Number(w.areaMm2) / 1e6, 0);
      const gfr = floor > 0 ? glaz / floor : 0;
      const sda = Math.min(96, gfr * 0.45 * 650);
      const ase = Math.min(60, floor > 0 ? (sunny / floor) * 90 : 0);
      const views = Math.min(100, gfr * 400);
      for (const roomId of z.roomIds) {
        out.rooms.push({
          id: roomId,
          sda: [Math.max(0, Math.round(sda - 8)), Math.round(Math.min(100, sda + 8))],
          ase: [Math.max(0, Math.round(ase - 4)), Math.round(Math.min(100, ase + 4))],
          views: [Math.max(0, Math.round(views - 10)), Math.round(Math.min(100, views + 10))],
        });
      }
    }
  }
  return out;
}

const qOf = (x: number): Q => Q.of(BigInt(Math.round(Math.max(0, Math.min(1, x)) * 1000)), 1000n);

/** SiteResult for one of the three site stages (each fills its own part; the rest stays empty). */
export function siteResult(
  stage: Extract<StageId, 'sun' | 'radiation' | 'daylight'>,
  core: SiteCore,
  base: {
    inputsHash: string;
    weatherHash: string;
    sceneHash: string;
    resolution: Resolution;
    stamp: ResultStamp;
  },
): SiteResult {
  const r: SiteResult = {
    ...base,
    method: 'T0',
    kernel: 'cpu',
    surfaces: [],
    windows: [],
    rooms: [],
    ledger: [],
  };
  if (stage === 'sun') {
    r.surfaces = core.surfaces.map((s) => {
      const annual = s.sunHours.reduce(
        (t, h, m) => t + h * ([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m] as number),
        0,
      );
      const mean = annual / 365;
      return {
        id: s.id,
        irrWhm2: 'unknown',
        sunHours: {
          dailyMean: { lo: Math.round(mean * 0.85 * 10) / 10, hi: Math.round(mean * 1.15 * 10) / 10 },
          annual: Math.round(annual),
          monthly: s.sunHours.map((h) => Math.round(h * 10) / 10),
        },
        svf: qOf(s.svf),
      };
    });
  } else if (stage === 'radiation') {
    r.surfaces = core.surfaces.map((s) => ({ id: s.id, irrWhm2: s.irr.map((v) => BigInt(Math.round(v))) }));
    r.windows = core.windows.map((w) => ({ id: w.id, shadingFactor: w.factor.map(qOf) }));
    r.ledger = core.ledger.map((l) => ({
      receiver: l.receiver,
      blocker: l.blocker,
      lostWh: BigInt(Math.round(l.lostWh)),
    }));
  } else {
    r.rooms = core.rooms.map((x) => ({
      id: x.id,
      sda: { lo: x.sda[0], hi: x.sda[1] },
      ase: { lo: x.ase[0], hi: x.ase[1] },
      views: { lo: x.views[0], hi: x.views[1] },
      tier: 'T0',
    }));
  }
  return r;
}
