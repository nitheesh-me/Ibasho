/**
 * Surface kernel (SD 1.3 to 1.5, 5.1): for every sensor on the hero's walls, windows and roofs,
 * which sky patches and sun bins it sees, and from that its sky view factor, sunshine hours,
 * monthly irradiation (obstructed and unobstructed) and the shading ledger. Owner: WP-16.
 *
 * Irradiation on a sensor with normal n in month m:
 *   direct  = sum over sun bins b of V(b) * max(0, n . vec_b)
 *   diffuse = sum over patches p of V(p) * K_m[p] * max(0, n . d_p)   (cumulative Perez sky)
 *   ground  = albedo * GHI_m * (1 - n_z) / 2                           (not obstructed, not traced)
 * Inter-building reflections are not included (as Ladybug Incident Radiation; SD 1.5).
 *
 * Shading ledger: every ray's annual contribution times the sensor's area is rounded to whole
 * Wh once, then added either to "received" or to the first building it hits. Unobstructed is
 * the sum over all rays, so received plus the ledger equals unobstructed exactly for every
 * receiver (AC-LK3), and `ledgerCloses` checks it.
 *
 * The job is a generator: it yields its fraction done after each slice of sensors, so a worker
 * can check for cancel between slices; `drain` runs it to the end synchronously.
 */
import type { Sensors, SiteScene } from './scene.ts';
import type { SkyYear, SunBin } from './solar.ts';
import { MONTH_DAYS } from './solar.ts';

export interface SurfaceAnalysis {
  /** Per analysed surface, in `scene.surfaces` order. */
  surfaces: {
    id: string;
    kind: string;
    areaM2: number;
    sensors: number;
    /** Monthly irradiation, Wh/m2, area-weighted mean over sensors. */
    irr: number[];
    unshaded: number[];
    /** Monthly mean sunshine hours per day (area-weighted). */
    sunHours: number[];
    /** 10th and 90th percentile of sensors' annual mean daily sunshine hours. */
    sunDaily: [number, number];
    svf: number;
    /** Whole Wh per year over the surface (ledger totals). */
    receivedWh: bigint;
    unobstructedWh: bigint;
  }[];
  /** Receiver surface id, blocker id, whole Wh per year; sorted, non-zero. */
  ledger: { receiver: string; blocker: string; lostWh: bigint }[];
  sensorCount: number;
  rays: number;
}

export interface SurfaceJobInput {
  scene: SiteScene;
  sensors: Sensors;
  sky: SkyYear;
  /** Patch directions in the place frame, 3 per patch. */
  patchDir: Float64Array;
  bins: SunBin[];
  /** Bin directions and summed vectors in the place frame, 3 each. */
  binDir: Float64Array;
  binVec: Float64Array;
  albedo: number;
  /** Sensors per slice between yields. */
  slice?: number;
}

export function* surfaceJob(inp: SurfaceJobInput): Generator<number, SurfaceAnalysis, void> {
  const { scene, sensors, sky, patchDir, bins, binDir, binVec } = inp;
  const np = sky.patches.count;
  const nb = bins.length;
  const bvh = scene.bvh;
  const rays0 = bvh.rays;
  const ns = scene.surfaces.length;
  // Per surface accumulators.
  const irr = new Float64Array(ns * 12);
  const uns = new Float64Array(ns * 12);
  const sunH = new Float64Array(ns * 12);
  const svf = new Float64Array(ns);
  const area = new Float64Array(ns);
  const cnt = new Int32Array(ns);
  const recv = new Float64Array(ns);
  const unob = new Float64Array(ns);
  const daily: number[][] = Array.from({ length: ns }, () => []);
  const lost = new Map<number, Float64Array>();
  // Horizontal unobstructed normaliser for the sky view factor.
  let horiz = 0;
  for (let p = 0; p < np; p++) horiz += (sky.patches.omega[p] as number) * (patchDir[p * 3 + 2] as number);
  // Annual sky per patch (for ledger contributions).
  const skyAnnual = new Float64Array(np);
  for (let m = 0; m < 12; m++)
    for (let p = 0; p < np; p++)
      skyAnnual[p] = (skyAnnual[p] as number) + (sky.monthly[m * np + p] as number);
  const sensIrr = new Float64Array(12);
  const sensUns = new Float64Array(12);
  const sensSun = new Float64Array(12);
  const slice = inp.slice ?? 64;
  for (let s = 0; s < sensors.count; s++) {
    if (s > 0 && s % slice === 0) yield s / sensors.count;
    const ox = sensors.p[s * 3] as number;
    const oy = sensors.p[s * 3 + 1] as number;
    const oz = sensors.p[s * 3 + 2] as number;
    const nx = sensors.n[s * 3] as number;
    const ny = sensors.n[s * 3 + 1] as number;
    const nz = sensors.n[s * 3 + 2] as number;
    const w = sensors.w[s] as number;
    const si = sensors.surf[s] as number;
    sensIrr.fill(0);
    sensUns.fill(0);
    sensSun.fill(0);
    let sv = 0;
    let rWh = 0;
    let uWh = 0;
    const blocked = (owner: number, wh: number) => {
      let a = lost.get(si);
      if (!a) {
        a = new Float64Array(scene.owners.length);
        lost.set(si, a);
      }
      a[owner] = (a[owner] as number) + wh;
    };
    // Sky patches.
    for (let p = 0; p < np; p++) {
      const dx = patchDir[p * 3] as number;
      const dy = patchDir[p * 3 + 1] as number;
      const dz = patchDir[p * 3 + 2] as number;
      const c = nx * dx + ny * dy + nz * dz;
      if (c <= 1e-9) continue;
      const hit = bvh.cast(ox, oy, oz, dx, dy, dz);
      const q = Math.round((skyAnnual[p] as number) * c * w);
      uWh += q;
      for (let m = 0; m < 12; m++)
        sensUns[m] = (sensUns[m] as number) + (sky.monthly[m * np + p] as number) * c;
      if (hit < 0) {
        sv += (sky.patches.omega[p] as number) * c;
        rWh += q;
        for (let m = 0; m < 12; m++)
          sensIrr[m] = (sensIrr[m] as number) + (sky.monthly[m * np + p] as number) * c;
      } else if (q !== 0) blocked(bvh.owner[hit] as number, q);
    }
    // Sun bins.
    for (let b = 0; b < nb; b++) {
      const dx = binDir[b * 3] as number;
      const dy = binDir[b * 3 + 1] as number;
      const dz = binDir[b * 3 + 2] as number;
      if (nx * dx + ny * dy + nz * dz <= 1e-9) continue;
      const bin = bins[b] as SunBin;
      const e = Math.max(
        0,
        nx * (binVec[b * 3] as number) +
          ny * (binVec[b * 3 + 1] as number) +
          nz * (binVec[b * 3 + 2] as number),
      );
      const hit = bvh.cast(ox, oy, oz, dx, dy, dz);
      const q = Math.round(e * w);
      uWh += q;
      sensUns[bin.month] = (sensUns[bin.month] as number) + e;
      if (hit < 0) {
        rWh += q;
        sensIrr[bin.month] = (sensIrr[bin.month] as number) + e;
        sensSun[bin.month] = (sensSun[bin.month] as number) + bin.sunshine;
      } else if (q !== 0) blocked(bvh.owner[hit] as number, q);
    }
    // Ground reflection: same with and without context, so it is in both totals.
    const gf = (inp.albedo * (1 - nz)) / 2;
    let gAnnual = 0;
    for (let m = 0; m < 12; m++) {
      const g = (sky.ghi[m] as number) * gf;
      gAnnual += g;
      sensIrr[m] = (sensIrr[m] as number) + g;
      sensUns[m] = (sensUns[m] as number) + g;
    }
    const gq = Math.round(gAnnual * w);
    rWh += gq;
    uWh += gq;
    let annualH = 0;
    for (let m = 0; m < 12; m++) {
      irr[si * 12 + m] = (irr[si * 12 + m] as number) + (sensIrr[m] as number) * w;
      uns[si * 12 + m] = (uns[si * 12 + m] as number) + (sensUns[m] as number) * w;
      sunH[si * 12 + m] = (sunH[si * 12 + m] as number) + (sensSun[m] as number) * w;
      annualH += sensSun[m] as number;
    }
    (daily[si] as number[]).push(annualH / 365);
    svf[si] = (svf[si] as number) + (horiz > 0 ? sv / horiz : 0) * w;
    area[si] = (area[si] as number) + w;
    cnt[si] = (cnt[si] as number) + 1;
    recv[si] = (recv[si] as number) + rWh;
    unob[si] = (unob[si] as number) + uWh;
  }
  const pct = (a: number[], q: number) => {
    if (a.length === 0) return 0;
    const b = [...a].sort((x, y) => x - y);
    return b[Math.min(b.length - 1, Math.floor(q * (b.length - 1) + 0.5))] as number;
  };
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const out: SurfaceAnalysis = {
    surfaces: scene.surfaces.map((sf, i) => {
      const a = (area[i] as number) || 1;
      return {
        id: sf.id,
        kind: sf.kind,
        areaM2: sf.areaM2,
        sensors: cnt[i] as number,
        irr: Array.from({ length: 12 }, (_, m) => (irr[i * 12 + m] as number) / a),
        unshaded: Array.from({ length: 12 }, (_, m) => (uns[i * 12 + m] as number) / a),
        sunHours: Array.from(
          { length: 12 },
          (_, m) => (sunH[i * 12 + m] as number) / a / (MONTH_DAYS[m] as number),
        ),
        sunDaily: [r1(pct(daily[i] as number[], 0.1)), r1(pct(daily[i] as number[], 0.9))],
        svf: (svf[i] as number) / a,
        receivedWh: BigInt(recv[i] as number),
        unobstructedWh: BigInt(unob[i] as number),
      };
    }),
    ledger: [],
    sensorCount: sensors.count,
    rays: bvh.rays - rays0,
  };
  for (const si of [...lost.keys()].sort((a, b) => a - b)) {
    const a = lost.get(si) as Float64Array;
    const receiver = (scene.surfaces[si] as { id: string }).id;
    for (let o = 0; o < a.length; o++) {
      const v = a[o] as number;
      if (v !== 0) out.ledger.push({ receiver, blocker: scene.owners[o] as string, lostWh: BigInt(v) });
    }
  }
  out.ledger.sort((x, y) =>
    x.receiver < y.receiver
      ? -1
      : x.receiver > y.receiver
        ? 1
        : x.blocker < y.blocker
          ? -1
          : x.blocker > y.blocker
            ? 1
            : 0,
  );
  return out;
}

/** Runs a generator job to the end (no yielding to the event loop). */
export function drain<T>(g: Generator<number, T, void>): T {
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

/** AC-LK3: for every receiver, received plus the ledger equals unobstructed, exactly. */
export function ledgerCloses(a: SurfaceAnalysis): { ok: boolean; bad: string[] } {
  const lost = new Map<string, bigint>();
  for (const l of a.ledger) lost.set(l.receiver, (lost.get(l.receiver) ?? 0n) + l.lostWh);
  const bad = a.surfaces
    .filter((s) => s.receivedWh + (lost.get(s.id) ?? 0n) !== s.unobstructedWh)
    .map((s) => s.id);
  return { ok: bad.length === 0, bad };
}
