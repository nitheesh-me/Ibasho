/**
 * Daylight for regularly occupied rooms (SD 1.6, R31): ASE1000,250 from direct sun ray casting,
 * a fast sDA300/50% approximation (tier T1), the ECBC useful daylight share and a views share.
 * Owner: WP-16.
 *
 * Method (T1, "sDA (simplified)" until measured against the SD 7 reference rooms, R31):
 * - Work plane sensors at 0.8 m (ECBC) on the room's grid. Light reaches a sensor only through
 *   the room's window apertures: a ray from the sensor must cross a window rectangle, and from
 *   there leave the scene unobstructed (the hero's own wings and the city context block it).
 * - Sky component: daylight coefficients per Tregenza or Reinhart patch, each patch sampled on an
 *   S by S grid of equal solid angle, times the hourly Perez sky luminance (two-phase method).
 * - Direct sun: exact hourly sun rays (occupied hours 08:00 to 18:00 local standard time).
 * - Glazing: visible transmittance times the Fresnel angular dependence of one clear pane
 *   (n = 1.526, KL = 0.0125; Duffie and Beckman, Solar Engineering of Thermal Processes, 5.3).
 * - Inter-reflection: the BRE split-flux method in flux form (Hopkinson, Longmore and
 *   Petherbridge 1954; BRE Digest 309/310): E = tau (Phi_down R_fw + Phi_up R_cw) / (A (1 - R)),
 *   spread uniformly over the room. Reflectances floor 0.2, walls 0.5, ceiling 0.7 (ECBC
 *   4.2.3.1 defaults).
 * - Blinds (IES LM-83): in an hour where more than 2% of a room's sensors get over 1,000 lux of
 *   direct sun, the blinds close: direct sun is removed and the rest is cut to 20% (the generic
 *   diffusing shade Honeybee uses).
 * - ASE uses direct sun only, blinds open, as LM-83 defines it, so it is exact up to geometry.
 *
 * Room shapes: the compiled building carries no room outlines for middle storeys yet, so each
 * windowed room is approximated by strips behind its windowed walls, deep enough to hold the
 * room's floor area (PLACEHOLDER until `SurfaceSet.rooms` lands; WP-16 INTERFACES entry). Rooms
 * repeated on several storeys are sampled on up to three of them (lowest, middle, highest).
 */
import type { CompiledBuilding, DaylightTier } from '@ibasho/core';
import { isZoneTwin } from '@ibasho/core';
import { cos, D2R, exp, sin } from './dmath/index.ts';
import type { SceneSurface, SiteScene } from './scene.ts';
import { efficacy, type Patches, skyVector } from './sky.ts';
import { hourCondition, type SolarYear } from './solar.ts';
import type { HourlyWeather } from './weather/index.ts';

/** Spaces people use for long periods: daylight metrics apply only to these (SD 6, LEED). */
export const REGULARLY_OCCUPIED: ReadonlySet<string> = new Set([
  'office',
  'office-open',
  'lab',
  'lab-heavy',
  'library',
  'classroom',
  'assembly',
  'bank',
  'living',
  'bedroom',
  'kitchen',
]);

export interface DaylightOptions {
  /** Sensor spacing, metres. */
  spacingM: number;
  /** Sub-samples per patch side (1 to 3). */
  subSamples: number;
  /** Use every n-th day (1 is every day). */
  dayStride: number;
  /** Visible transmittance at normal incidence (default 0.6). */
  vlt?: number;
  workPlaneM?: number;
  slice?: number;
}

export interface RoomDaylight {
  id: string;
  /** Percentages per sampled storey copy. */
  sda: number[];
  ase: number[];
  udi: number[];
  views: number[];
  sensors: number;
  /** True when no sampled copy of the room has a window (all metrics are exactly 0). */
  windowless: boolean;
}

export interface DaylightAnalysis {
  rooms: RoomDaylight[];
  tier: DaylightTier;
  sensorCount: number;
  rays: number;
}

interface Aperture {
  /** Corner, width axis (unit) with length, height axis (unit) with length, outward normal. */
  o: [number, number, number];
  u: [number, number, number];
  ul: number;
  v: [number, number, number];
  vl: number;
  n: [number, number, number];
  area: number;
}

interface RoomCopy {
  roomId: string;
  sensors: Float64Array;
  apertures: Aperture[];
  areaM2: number;
  heightM: number;
  perimeterM: number;
}

const sub = (a: readonly number[], b: readonly number[]): [number, number, number] => [
  (a[0] as number) - (b[0] as number),
  (a[1] as number) - (b[1] as number),
  (a[2] as number) - (b[2] as number),
];

/** A window quad (two triangles) as an aperture rectangle. */
function apertureOf(s: SceneSurface): Aperture | null {
  const t = s.tris;
  if (t.length < 9) return null;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 2; i < t.length; i += 3) {
    z0 = Math.min(z0, t[i] as number);
    z1 = Math.max(z1, t[i] as number);
  }
  // Horizontal extent along the wall direction.
  const [nx, ny] = s.n;
  const l = Math.sqrt(nx * nx + ny * ny);
  if (l < 0.5) return null;
  const ux = -ny / l;
  const uy = nx / l;
  let a0 = Infinity;
  let a1 = -Infinity;
  for (let i = 0; i < t.length; i += 3) {
    const a = (t[i] as number) * ux + (t[i + 1] as number) * uy;
    a0 = Math.min(a0, a);
    a1 = Math.max(a1, a);
  }
  // A point on the plane.
  const px = t[0] as number;
  const py = t[1] as number;
  const off = px * (nx / l) + py * (ny / l);
  const o: [number, number, number] = [ux * a0 + (nx / l) * off, uy * a0 + (ny / l) * off, z0];
  const ul = a1 - a0;
  const vl = z1 - z0;
  if (ul <= 0 || vl <= 0) return null;
  return { o, u: [ux, uy, 0], ul, v: [0, 0, 1], vl, n: [nx / l, ny / l, 0], area: ul * vl };
}

/** Where a ray from p along d crosses an aperture of the room (nearest), or null. */
function throughAperture(
  aps: readonly Aperture[],
  p: readonly number[],
  d: readonly number[],
): { x: number; y: number; z: number; cosW: number } | null {
  let best: { x: number; y: number; z: number; cosW: number } | null = null;
  let bt = Infinity;
  for (const a of aps) {
    const dn = (d[0] as number) * a.n[0] + (d[1] as number) * a.n[1] + (d[2] as number) * a.n[2];
    if (dn <= 1e-6) continue;
    const w = sub(a.o, p);
    const t = (w[0] * a.n[0] + w[1] * a.n[1] + w[2] * a.n[2]) / dn;
    if (t <= 0 || t >= bt) continue;
    const x = (p[0] as number) + t * (d[0] as number);
    const y = (p[1] as number) + t * (d[1] as number);
    const z = (p[2] as number) + t * (d[2] as number);
    const r = [x - a.o[0], y - a.o[1], z - a.o[2]];
    const uu = (r[0] as number) * a.u[0] + (r[1] as number) * a.u[1] + (r[2] as number) * a.u[2];
    const vv = (r[0] as number) * a.v[0] + (r[1] as number) * a.v[1] + (r[2] as number) * a.v[2];
    if (uu < 0 || uu > a.ul || vv < 0 || vv > a.vl) continue;
    bt = t;
    best = { x, y, z, cosW: dn };
  }
  return best;
}

/** Normalised angular transmittance of one clear pane (1 at normal incidence). */
export function angularTransmittance(cosT: number): number {
  const f = (c: number) => {
    if (c <= 0) return 0;
    const n = 1.526;
    const s2 = 1 - c * c;
    const ct = Math.sqrt(Math.max(0, 1 - s2 / (n * n)));
    const rs = ((c - n * ct) / (c + n * ct)) * ((c - n * ct) / (c + n * ct));
    const rp = ((ct - n * c) / (ct + n * c)) * ((ct - n * c) / (ct + n * c));
    const ta = exp(-0.0125 / ct);
    const tr = 0.5 * ((1 - rs) / (1 + rs) + (1 - rp) / (1 + rp));
    return ta * tr;
  };
  return f(cosT) / f(1);
}

/** Room copies (sensors and apertures) from the compiled building and the scene. */
export function daylightRooms(
  c: CompiledBuilding,
  scene: SiteScene,
  spacingM: number,
  workPlaneM: number,
): Map<string, RoomCopy[]> {
  const out = new Map<string, RoomCopy[]>();
  if (!isZoneTwin(c.twin)) return out;
  const bySeg = new Map<string, SceneSurface[]>();
  for (const s of scene.all) {
    if (s.kind !== 'window' && s.kind !== 'wall') continue;
    const list = bySeg.get(s.ownerId) ?? [];
    list.push(s);
    bySeg.set(s.ownerId, list);
  }
  const segIds = [...bySeg.keys()].sort();
  for (const z of c.twin.zones) {
    if (!REGULARLY_OCCUPIED.has(z.spaceTypeIds[0] ?? '')) continue;
    for (const roomId of z.roomIds) {
      const stem = `sg_${roomId.replace(/^rm_/, '')}_`;
      // Walls and windows of this room, grouped by storey copy (`@k`).
      const copies = new Map<number, { walls: SceneSurface[]; wins: SceneSurface[] }>();
      for (const seg of segIds) {
        if (!seg.startsWith(stem) || /_/.test(seg.slice(stem.length))) continue;
        for (const s of bySeg.get(seg) as SceneSurface[]) {
          const m = /@(\d+)$/.exec(s.id);
          const k = m ? Number(m[1]) : 0;
          const e = copies.get(k) ?? { walls: [], wins: [] };
          (s.kind === 'window' ? e.wins : e.walls).push(s);
          copies.set(k, e);
        }
      }
      const ks = [...copies.keys()].sort((a, b) => a - b);
      const mult = Math.max(1, ks.length);
      const areaM2 = Number(z.floorMm2) / 1e6 / mult / Math.max(1, z.roomIds.length);
      const pick =
        ks.length <= 3
          ? ks
          : [ks[0] as number, ks[Math.floor(ks.length / 2)] as number, ks[ks.length - 1] as number];
      const list: RoomCopy[] = [];
      for (const k of pick) {
        const e = copies.get(k) as { walls: SceneSurface[]; wins: SceneSurface[] };
        const apertures = e.wins.map(apertureOf).filter((a): a is Aperture => a !== null);
        if (e.walls.length === 0) continue;
        const z0 = Math.min(...e.walls.map((w) => w.z0));
        const z1 = Math.max(...e.walls.map((w) => w.z1));
        // Windowed walls: strips behind them.
        const hosts = e.walls.filter((w) => e.wins.some((x) => x.ownerId === w.ownerId));
        const strips = hosts.map((w) => {
          const t = w.tris;
          const [nx, ny] = w.n;
          const l = Math.sqrt(nx * nx + ny * ny) || 1;
          const ux = -ny / l;
          const uy = nx / l;
          let a0 = Infinity;
          let a1 = -Infinity;
          for (let i = 0; i < t.length; i += 3) {
            const a = (t[i] as number) * ux + (t[i + 1] as number) * uy;
            a0 = Math.min(a0, a);
            a1 = Math.max(a1, a);
          }
          const off = (t[0] as number) * (nx / l) + (t[1] as number) * (ny / l);
          return { ux, uy, nx: nx / l, ny: ny / l, a0, a1, off };
        });
        const len = strips.reduce((s, x) => s + (x.a1 - x.a0), 0);
        const depth = len > 0 ? Math.min(15, Math.max(2, areaM2 / len)) : 0;
        const pts: number[] = [];
        for (const st of strips) {
          const nu = Math.max(1, Math.round((st.a1 - st.a0) / spacingM));
          const nd = Math.max(1, Math.round(depth / spacingM));
          for (let i = 0; i < nu; i++) {
            for (let j = 0; j < nd; j++) {
              const a = st.a0 + ((i + 0.5) * (st.a1 - st.a0)) / nu;
              const dd = ((j + 0.5) * depth) / nd;
              const x = st.ux * a + st.nx * (st.off - dd);
              const y = st.uy * a + st.ny * (st.off - dd);
              let dup = false;
              for (let q = 0; q < pts.length; q += 3) {
                const ex = (pts[q] as number) - x;
                const ey = (pts[q + 1] as number) - y;
                if (ex * ex + ey * ey < (spacingM * spacingM) / 4) {
                  dup = true;
                  break;
                }
              }
              if (!dup) pts.push(x, y, z0 + workPlaneM);
            }
          }
        }
        list.push({
          roomId,
          sensors: Float64Array.from(pts),
          apertures,
          areaM2,
          heightM: z1 - z0,
          perimeterM: 2 * (len + depth),
        });
      }
      out.set(roomId, list);
    }
  }
  return out;
}

/** Hours used: occupied 08:00 to 18:00 (LM-83) and the ECBC window 09:00 to 17:00 (8 h). */
function occupiedHours(y: SolarYear, dayStride: number): { h: number[]; ecbc: boolean[] } {
  const h: number[] = [];
  const ecbc: boolean[] = [];
  for (let i = 0; i < 8760; i++) {
    const day = Math.floor(i / 24);
    if (day % dayStride !== 0) continue;
    const hr = y.hour[i] as number;
    if (hr < 8 || hr > 17) continue;
    h.push(i);
    ecbc.push(hr >= 9 && hr <= 16);
  }
  return { h, ecbc };
}

export interface DaylightJobInput {
  compiled: CompiledBuilding;
  scene: SiteScene;
  weather: HourlyWeather;
  year: SolarYear;
  patches: Patches;
  /** Turns true-frame directions into the place frame. */
  frame: (v: readonly [number, number, number]) => [number, number, number];
  opts: DaylightOptions;
}

export function* daylightJob(inp: DaylightJobInput): Generator<number, DaylightAnalysis, void> {
  const { scene, weather: w, year: y, patches: P, frame, opts } = inp;
  const vlt = opts.vlt ?? 0.6;
  const S = Math.max(1, Math.min(4, Math.round(opts.subSamples)));
  const rooms = daylightRooms(inp.compiled, scene, opts.spacingM, opts.workPlaneM ?? 0.8);
  const { h: hours, ecbc } = occupiedHours(y, opts.dayStride);
  const nh = hours.length;
  const np = P.count;
  const bvh = scene.bvh;
  const rays0 = bvh.rays;
  // Hourly sky luminance vectors (lux per patch), sun direct normal illuminance and diffuse horizontal.
  const skyL = new Float64Array(nh * np);
  const evdn = new Float64Array(nh);
  const evh = new Float64Array(nh);
  const sunDir = new Float64Array(nh * 3);
  const tmp = new Float64Array(np);
  for (let i = 0; i < nh; i++) {
    const h = hours[i] as number;
    const cond = hourCondition(y, w, h);
    const eff = efficacy(cond, w.dewPointC[h] as number);
    const dhiLux =
      w.evdh && (w.evdh[h] as number) >= 0 ? (w.evdh[h] as number) : (w.dhi[h] as number) * eff.diffuse;
    const dnLux =
      (y.zenith[h] as number) >= 90
        ? 0
        : w.evdn && (w.evdn[h] as number) >= 0
          ? (w.evdn[h] as number)
          : (w.dni[h] as number) * eff.direct;
    const s: [number, number, number] = [
      y.sun[h * 3] as number,
      y.sun[h * 3 + 1] as number,
      y.sun[h * 3 + 2] as number,
    ];
    if (dhiLux > 0) {
      skyVector(P, s, cond, dhiLux, tmp);
      skyL.set(tmp, i * np);
    }
    evdn[i] = dnLux;
    evh[i] = dhiLux + dnLux * Math.max(0, s[2]);
    const f = frame(s);
    sunDir.set(f, i * 3);
  }
  // Sub-sampled patch directions in the place frame.
  const subDir: number[] = [];
  const subPatch: number[] = [];
  const subW: number[] = [];
  for (let p = 0; p < np; p++) {
    const s0 = sin((P.alt0[p] as number) * D2R);
    const s1 = sin((P.alt1[p] as number) * D2R);
    for (let i = 0; i < S; i++) {
      for (let j = 0; j < S; j++) {
        const sa = s0 + ((i + 0.5) / S) * (s1 - s0);
        const ca = Math.sqrt(Math.max(0, 1 - sa * sa));
        const az =
          ((P.azC[p] as number) - (P.azW[p] as number) / 2 + ((j + 0.5) / S) * (P.azW[p] as number)) * D2R;
        const d = frame([ca * sin(az), ca * cos(az), sa]);
        subDir.push(d[0], d[1], d[2]);
        subPatch.push(p);
        subW.push(1 / (S * S));
      }
    }
  }
  const nsub = subPatch.length;
  const ground = w.albedo;
  const result: RoomDaylight[] = [];
  let sensorCount = 0;
  const roomIds = [...rooms.keys()];
  let done = 0;
  for (const roomId of roomIds) {
    const copies = rooms.get(roomId) as RoomCopy[];
    const r: RoomDaylight = {
      id: roomId,
      sda: [],
      ase: [],
      udi: [],
      views: [],
      sensors: 0,
      windowless: copies.every((c) => c.apertures.length === 0),
    };
    for (const cp of copies) {
      yield done / Math.max(1, roomIds.length);
      const n = cp.sensors.length / 3;
      r.sensors += n;
      sensorCount += n;
      if (n === 0 || cp.apertures.length === 0) {
        r.sda.push(0);
        r.ase.push(0);
        r.udi.push(0);
        r.views.push(0);
        continue;
      }
      // Window centre view of the sky (for the split-flux input), per patch.
      const winSky = cp.apertures.map((a) => {
        const cx = a.o[0] + a.u[0] * a.ul * 0.5 + a.n[0] * 0.05;
        const cy = a.o[1] + a.u[1] * a.ul * 0.5 + a.n[1] * 0.05;
        const cz = a.o[2] + a.vl * 0.5;
        const v = new Float64Array(np);
        for (let p = 0; p < np; p++) {
          const d = frame([P.dir[p * 3] as number, P.dir[p * 3 + 1] as number, P.dir[p * 3 + 2] as number]);
          const c = d[0] * a.n[0] + d[1] * a.n[1] + d[2] * a.n[2];
          if (c <= 0) continue;
          if (bvh.cast(cx, cy, cz, d[0], d[1], d[2], Infinity, true) < 0) v[p] = c;
        }
        const sunVis = new Uint8Array(nh);
        for (let i = 0; i < nh; i++) {
          if ((evdn[i] as number) <= 0) continue;
          const dx = sunDir[i * 3] as number;
          const dy = sunDir[i * 3 + 1] as number;
          const dz = sunDir[i * 3 + 2] as number;
          if (dx * a.n[0] + dy * a.n[1] + dz * a.n[2] <= 0) continue;
          if (bvh.cast(cx, cy, cz, dx, dy, dz, Infinity, true) < 0) sunVis[i] = 1;
        }
        return { a, v, sunVis, cx, cy, cz };
      });
      // Split-flux room constants.
      const A = cp.areaM2;
      const H = cp.heightM;
      const wallA = cp.perimeterM * H;
      const totalA = 2 * A + wallA;
      const R = (A * 0.2 + A * 0.7 + wallA * 0.5) / totalA;
      const Rfw = (A * 0.2 + (wallA / 2) * 0.5) / (A + wallA / 2);
      const Rcw = (A * 0.7 + (wallA / 2) * 0.5) / (A + wallA / 2);
      const tauD = vlt * 0.85; // hemispherical average of the angular curve
      const ircOpen = new Float64Array(nh);
      for (let i = 0; i < nh; i++) {
        let down = 0;
        let up = 0;
        for (const ws of winSky) {
          let ev = 0;
          for (let p = 0; p < np; p++) ev += (ws.v[p] as number) * (skyL[i * np + p] as number);
          let sun = 0;
          if (ws.sunVis[i]) {
            const c =
              (sunDir[i * 3] as number) * ws.a.n[0] +
              (sunDir[i * 3 + 1] as number) * ws.a.n[1] +
              (sunDir[i * 3 + 2] as number) * ws.a.n[2];
            sun = (evdn[i] as number) * c * vlt * angularTransmittance(c);
          }
          down += ws.a.area * (ev * tauD + sun);
          up += ws.a.area * tauD * ground * (evh[i] as number) * 0.5;
        }
        ircOpen[i] = (down * Rfw + up * Rcw) / (totalA * (1 - R));
      }
      // Per sensor: sky daylight coefficients, direct sun per hour, views.
      const eSky = new Float64Array(n * nh);
      const eSun = new Float64Array(n * nh);
      let viewOk = 0;
      const dc = new Float64Array(np);
      for (let s = 0; s < n; s++) {
        const p = [
          cp.sensors[s * 3] as number,
          cp.sensors[s * 3 + 1] as number,
          cp.sensors[s * 3 + 2] as number,
        ];
        dc.fill(0);
        for (let k = 0; k < nsub; k++) {
          const d = [subDir[k * 3] as number, subDir[k * 3 + 1] as number, subDir[k * 3 + 2] as number];
          const x = throughAperture(cp.apertures, p, d);
          if (!x) continue;
          if (
            bvh.cast(
              x.x + (d[0] as number) * 0.05,
              x.y + (d[1] as number) * 0.05,
              x.z + (d[2] as number) * 0.05,
              d[0] as number,
              d[1] as number,
              d[2] as number,
              Infinity,
              true,
            ) >= 0
          )
            continue;
          const pi = subPatch[k] as number;
          // Patch luminance times solid angle, share of the patch seen, cosine on the work plane, glazing.
          dc[pi] =
            (dc[pi] as number) + (subW[k] as number) * (d[2] as number) * vlt * angularTransmittance(x.cosW);
        }
        const nz: number[] = [];
        for (let q = 0; q < np; q++) if ((dc[q] as number) > 0) nz.push(q);
        for (let i = 0; i < nh; i++) {
          let e = 0;
          for (const q of nz) e += (dc[q] as number) * (skyL[i * np + q] as number);
          eSky[s * nh + i] = e;
          const dn = evdn[i] as number;
          if (dn <= 0) continue;
          const d = [sunDir[i * 3] as number, sunDir[i * 3 + 1] as number, sunDir[i * 3 + 2] as number];
          if ((d[2] as number) <= 0) continue;
          const x = throughAperture(cp.apertures, p, d);
          if (!x) continue;
          if (
            bvh.cast(
              x.x + (d[0] as number) * 0.05,
              x.y + (d[1] as number) * 0.05,
              x.z + (d[2] as number) * 0.05,
              d[0] as number,
              d[1] as number,
              d[2] as number,
              Infinity,
              true,
            ) >= 0
          )
            continue;
          eSun[s * nh + i] = dn * (d[2] as number) * vlt * angularTransmittance(x.cosW);
        }
        // Views: a horizontal fan at 1.2 m above the floor (0.4 m above the work plane), 36 directions;
        // a view counts when a ray leaves through glazing and runs 7.5 m or more past it.
        let seen = false;
        const eye = [p[0] as number, p[1] as number, (p[2] as number) + 0.4];
        for (let k = 0; k < 36 && !seen; k++) {
          const a = k * 10 * D2R;
          const d = [sin(a), cos(a), 0];
          const x = throughAperture(cp.apertures, eye, d);
          if (!x) continue;
          if (
            bvh.cast(
              x.x + (d[0] as number) * 0.05,
              x.y + (d[1] as number) * 0.05,
              x.z,
              d[0] as number,
              d[1] as number,
              0,
              7.5,
              true,
            ) < 0
          )
            seen = true;
        }
        if (seen) viewOk++;
        if (opts.slice && s % opts.slice === opts.slice - 1) yield done / Math.max(1, roomIds.length);
      }
      // Hourly blinds state, then metrics.
      const limit = Math.max(1, Math.floor(0.02 * n) + 1);
      const sdaHit = new Int32Array(n);
      const aseHit = new Int32Array(n);
      const udiHit = new Int32Array(n);
      let ecbcHours = 0;
      for (let i = 0; i < nh; i++) {
        let bright = 0;
        for (let s = 0; s < n; s++) if ((eSun[s * nh + i] as number) > 1000) bright++;
        const closed = bright >= limit;
        if (ecbc[i]) ecbcHours++;
        for (let s = 0; s < n; s++) {
          const sun = eSun[s * nh + i] as number;
          if (sun > 1000) aseHit[s] = (aseHit[s] as number) + 1;
          const e = closed
            ? 0.2 * ((eSky[s * nh + i] as number) + (ircOpen[i] as number))
            : (eSky[s * nh + i] as number) + sun + (ircOpen[i] as number);
          if (e >= 300) sdaHit[s] = (sdaHit[s] as number) + 1;
          if (ecbc[i] && e >= 100 && e <= 2000) udiHit[s] = (udiHit[s] as number) + 1;
        }
      }
      const aseLimit = 250 / opts.dayStride;
      let sda = 0;
      let ase = 0;
      let udi = 0;
      for (let s = 0; s < n; s++) {
        if ((sdaHit[s] as number) >= nh / 2) sda++;
        if ((aseHit[s] as number) > aseLimit) ase++;
        if ((udiHit[s] as number) >= 0.9 * ecbcHours) udi++;
      }
      r.sda.push((100 * sda) / n);
      r.ase.push((100 * ase) / n);
      r.udi.push((100 * udi) / n);
      r.views.push((100 * viewOk) / n);
    }
    done++;
    result.push(r);
  }
  return { rooms: result, tier: 'T1', sensorCount, rays: bvh.rays - rays0 };
}
