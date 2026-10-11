/**
 * PLACEHOLDER analysis for the city stage until the Preview fixtures (WP-13) and the real site
 * stage (WP-16) land: a clear sky radiation and sun hours estimate per hero surface, and a
 * daylight point grid from distance to glazing. Every result is stamped `preview` and the legend
 * says "scene estimate". Shapes match `SiteResult` and `DaylightGrid` exactly, so swapping in real
 * data changes no scene code. Owner: WP-07.
 */
import type { BuildingDoc, ResultStamp, SiteResult } from '@ibasho/core';
import type { EN } from './frame.ts';
import { type HeroModel, windowRects } from './hero.ts';
import type { Caster } from './shadow.ts';
import { sunOf } from './sun.ts';
import type { DaylightGrid } from './types.ts';

export const PREVIEW_STAMP: ResultStamp = {
  impl: 'preview',
  providers: [{ stage: 'radiation', id: 'scene.preview', version: '0', impl: 'preview' }],
  tier: 'rough',
  computedAt: '2026-10-11',
};

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Clear fraction by month for Hyderabad (monsoon June to September), a rough prior. */
const CLEAR = [0.95, 0.95, 0.92, 0.9, 0.85, 0.55, 0.42, 0.48, 0.58, 0.8, 0.9, 0.95];

interface Blocker {
  ring: EN[];
  z1: number;
  minE: number;
  maxE: number;
  minN: number;
  maxN: number;
}

function blockers(casters: readonly Caster[]): Blocker[] {
  return casters.map((c) => {
    let minE = Infinity;
    let maxE = -Infinity;
    let minN = Infinity;
    let maxN = -Infinity;
    for (const [e, n] of c.ring) {
      minE = Math.min(minE, e);
      maxE = Math.max(maxE, e);
      minN = Math.min(minN, n);
      maxN = Math.max(maxN, n);
    }
    return { ring: c.ring, z1: c.z1, minE, maxE, minN, maxN };
  });
}

/** True when the ray from `o` (E, N, height) towards the sun meets a blocker below its roof. */
function blocked(
  o: [number, number, number],
  dir: [number, number, number],
  bs: readonly Blocker[],
): boolean {
  const de = dir[0];
  const dn = -dir[2];
  const horiz = Math.hypot(de, dn);
  if (horiz < 1e-6) return false;
  const ue = de / horiz;
  const un = dn / horiz;
  const slope = dir[1] / horiz;
  for (const b of bs) {
    if (b.z1 <= o[2]) continue;
    const reach = (b.z1 - o[2]) / slope;
    // Bounding box of the ray segment that is still below this roof.
    const e1 = o[0] + ue * reach;
    const n1 = o[1] + un * reach;
    if (Math.max(o[0], e1) < b.minE || Math.min(o[0], e1) > b.maxE) continue;
    if (Math.max(o[1], n1) < b.minN || Math.min(o[1], n1) > b.maxN) continue;
    const r = b.ring;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [ax, ay] = r[j]!;
      const [bx, by] = r[i]!;
      const sx = bx - ax;
      const sy = by - ay;
      const den = ue * sy - un * sx;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((ax - o[0]) * sy - (ay - o[1]) * sx) / den;
      const s = ((ax - o[0]) * un - (ay - o[1]) * ue) / den;
      if (t > 0.05 && s >= 0 && s <= 1 && o[2] + t * slope < b.z1) return true;
    }
  }
  return false;
}

/**
 * Preview radiation and sun hours on every hero wall and roof (glass reads its wall through
 * `ownerId`). Monthly sums of hourly clear sky beam (Meinel) times the clear fraction, plus
 * isotropic diffuse, on the 21st of each month at the half hours.
 */
export function previewSite(
  hero: HeroModel,
  casters: readonly Caster[],
  place: { lat: number; lon: number; tzHours?: number },
  year = 2026,
): SiteResult {
  const bs = blockers(casters);
  const surfaces: SiteResult['surfaces'] = [];
  const targets = hero.surfaces.filter((s) => s.kind === 'wall' || s.kind === 'roof');
  const suns: { m: number; dir: [number, number, number]; alt: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const date = `${year}-${String(m + 1).padStart(2, '0')}-21`;
    for (let h = 5; h < 20; h++) {
      const s = sunOf({ date, minutes: h * 60 + 30 }, place.lat, place.lon, place.tzHours);
      if (s.altitudeDeg > 1) suns.push({ m, dir: s.dir, alt: (s.altitudeDeg * Math.PI) / 180 });
    }
  }
  for (const s of targets) {
    const month = new Array<number>(12).fill(0);
    const lit = new Array<number>(12).fill(0);
    const o: [number, number, number] = [
      s.centre[0] + s.normal[0] * 0.3,
      -(s.centre[2] + s.normal[2] * 0.3),
      s.centre[1] + s.normal[1] * 0.3,
    ];
    const tiltCos = s.normal[1];
    for (const sun of suns) {
      const sinAlt = Math.sin(sun.alt);
      const am = 1 / Math.max(sinAlt, 0.05);
      const dni = 1353 * 0.7 ** (am ** 0.678) * CLEAR[sun.m]!;
      const dhi = (90 + 160 * (1 - CLEAR[sun.m]!)) * Math.sqrt(sinAlt);
      const cosI = s.normal[0] * sun.dir[0] + s.normal[1] * sun.dir[1] + s.normal[2] * sun.dir[2];
      let beam = 0;
      if (cosI > 0 && !blocked(o, sun.dir, bs)) {
        beam = dni * cosI;
        lit[sun.m]! += 1;
      }
      const diffuse = dhi * ((1 + tiltCos) / 2) * (s.kind === 'roof' ? 1 : 0.75);
      month[sun.m]! += (beam + diffuse) * DAYS[sun.m]!;
    }
    const hoursPerDay = lit.map((h) => h);
    const annualHours = hoursPerDay.reduce((a, h, m) => a + h * DAYS[m]!, 0);
    const lo = Math.min(...hoursPerDay);
    const hi = Math.max(...hoursPerDay);
    surfaces.push({
      id: s.id,
      irrWhm2: month.map((v) => BigInt(Math.round(v))),
      sunHours: { dailyMean: { lo, hi }, annual: annualHours, monthly: hoursPerDay },
    });
  }
  return {
    inputsHash: `scene-preview:${hero.id}`,
    weatherHash: 'clear-sky-prior',
    sceneHash: `${casters.length}`,
    method: 'T0',
    kernel: 'gpu-preview',
    resolution: { level: 'sketch', grid: 2000, stepMin: 60, skyPatches: 145, contextRadiusM: 300 },
    stamp: PREVIEW_STAMP,
    surfaces,
    windows: [],
    rooms: [],
    ledger: [],
  };
}

/** Annual kWh/m² of a site surface (sum of its monthly Wh/m²), or null when unknown. */
export function annualKwh(s: SiteResult['surfaces'][number]): number | null {
  if (s.irrWhm2 === 'unknown') return null;
  let t = 0n;
  for (const v of s.irrWhm2) t += v;
  return Number(t) / 1000;
}

function inside(x: number, y: number, ring: readonly [number, number][]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * Preview daylight grids (moment 4), one per above grade storey: sDA falls off with distance to
 * the nearest glazed outdoor wall (about 2.2 head heights deep), ASE rises within 2 m of glass
 * facing the low south west and west sun. Plan frame, 1 m cells.
 */
export function previewDaylight(doc: BuildingDoc, cellMm = 1000): DaylightGrid[] {
  const out: DaylightGrid[] = [];
  const r = (doc.rotationMdeg / 1000) * (Math.PI / 180);
  for (const st of doc.storeys) {
    if (st.belowGrade || !st.rooms.length) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const room of st.rooms)
      for (const [x, y] of room.floor.outer) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    const cols = Math.ceil((maxX - minX) / cellMm);
    const rows = Math.ceil((maxY - minY) / cellMm);
    const sda: (number | null)[] = new Array(cols * rows).fill(null);
    const ase: (number | null)[] = new Array(cols * rows).fill(null);
    for (const room of st.rooms) {
      const ring = room.floor.outer as [number, number][];
      const glazed = room.segments
        .map((seg, i) => ({ seg, p: ring[i]!, q: ring[(i + 1) % ring.length]! }))
        .filter(
          ({ seg, p, q }) =>
            windowRects(seg.window, Math.hypot(q[0] - p[0], q[1] - p[1]) / 1000, st.floorToFloor / 1000)
              .length > 0,
        );
      let rx0 = Infinity;
      let ry0 = Infinity;
      let rx1 = -Infinity;
      let ry1 = -Infinity;
      for (const [x, y] of ring) {
        rx0 = Math.min(rx0, x);
        ry0 = Math.min(ry0, y);
        rx1 = Math.max(rx1, x);
        ry1 = Math.max(ry1, y);
      }
      const c0 = Math.floor((rx0 - minX) / cellMm);
      const c1 = Math.ceil((rx1 - minX) / cellMm);
      const r0 = Math.floor((ry0 - minY) / cellMm);
      const r1 = Math.ceil((ry1 - minY) / cellMm);
      for (let rr = r0; rr < Math.min(rows, r1); rr++)
        for (let cc = c0; cc < Math.min(cols, c1); cc++) {
          const x = minX + (cc + 0.5) * cellMm;
          const y = minY + (rr + 0.5) * cellMm;
          if (!inside(x, y, ring)) continue;
          let best = Infinity;
          let bestBearing = 0;
          for (const { p, q } of glazed) {
            const dx = q[0] - p[0];
            const dy = q[1] - p[1];
            const l2 = dx * dx + dy * dy;
            const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / l2));
            const d = Math.hypot(x - (p[0] + t * dx), y - (p[1] + t * dy)) / 1000;
            if (d < best) {
              best = d;
              // Outward normal (dy, -dx) in plan, rotated to a bearing.
              const ne = dy * Math.cos(r) + -dx * Math.sin(r);
              const nn = -dy * Math.sin(r) + -dx * Math.cos(r);
              bestBearing = ((Math.atan2(ne, nn) * 180) / Math.PI + 360) % 360;
            }
          }
          const i = rr * cols + cc;
          const v = Number.isFinite(best) ? 100 * Math.max(0, Math.min(1, 1.12 - best / 5.3)) : 0;
          sda[i] = Math.round(v);
          const lowSun = bestBearing > 190 && bestBearing < 320;
          const eastSun = bestBearing > 60 && bestBearing < 150;
          const near = Math.max(0, 1 - best / 2.2);
          ase[i] = Math.round((lowSun ? 520 : eastSun ? 300 : 120) * near);
        }
    }
    out.push({
      buildingId: doc.id,
      storeyId: st.id,
      originMm: [minX, minY],
      cellMm,
      cols,
      rows,
      sda,
      ase,
      passPct: 50,
      workPlaneMm: 850,
    });
  }
  return out;
}

/** Pass flags per grid cell (1 pass, 0 fail or outside): the one rule the share and the paint share. */
export function passMask(g: DaylightGrid): Uint8Array {
  const out = new Uint8Array(g.sda.length);
  const t = g.passPct ?? 50;
  g.sda.forEach((v, i) => {
    out[i] = v !== null && v >= t ? 1 : 0;
  });
  return out;
}

/** Share of points passing (sDA at or above the threshold) on one grid, percent. */
export function sdaShare(g: DaylightGrid): number {
  const mask = passMask(g);
  let n = 0;
  let pass = 0;
  g.sda.forEach((v, i) => {
    if (v === null) return;
    n++;
    pass += mask[i]!;
  });
  return n ? (100 * pass) / n : 0;
}
