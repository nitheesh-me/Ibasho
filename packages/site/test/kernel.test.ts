import { describe, expect, it } from 'vitest';
import { Bvh, buildScene, groundSunHours, julianDay, skyPatches, spa } from '../src/index.ts';
import { neighbour, rect, synthBuilding, tile } from './synth.ts';

/** Deterministic pseudo random numbers for test geometry. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function bruteHit(tri: Float64Array, o: number[], d: number[]): number {
  let best = -1;
  let bt = Infinity;
  for (let t = 0; t < tri.length / 9; t++) {
    const a = [tri[t * 9], tri[t * 9 + 1], tri[t * 9 + 2]] as number[];
    const e1 = [0, 1, 2].map((k) => (tri[t * 9 + 3 + k] as number) - (a[k] as number));
    const e2 = [0, 1, 2].map((k) => (tri[t * 9 + 6 + k] as number) - (a[k] as number));
    const cr = (u: number[], v: number[]) => [
      (u[1] as number) * (v[2] as number) - (u[2] as number) * (v[1] as number),
      (u[2] as number) * (v[0] as number) - (u[0] as number) * (v[2] as number),
      (u[0] as number) * (v[1] as number) - (u[1] as number) * (v[0] as number),
    ];
    const dot = (u: number[], v: number[]) =>
      (u[0] as number) * (v[0] as number) +
      (u[1] as number) * (v[1] as number) +
      (u[2] as number) * (v[2] as number);
    const p = cr(d, e2);
    const det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = o.map((x, k) => x - (a[k] as number));
    const u = dot(s, p) / det;
    if (u < 0 || u > 1) continue;
    const q = cr(s, e1);
    const v = dot(d, q) / det;
    if (v < 0 || u + v > 1) continue;
    const dist = dot(e2, q) / det;
    if (dist > 1e-6 && dist < bt) {
      bt = dist;
      best = t;
    }
  }
  return best;
}

describe('BVH visibility kernel', () => {
  it('finds the same nearest triangle as brute force on random soup', () => {
    const r = rng(7);
    const n = 600;
    const tri = new Float64Array(n * 9);
    for (let t = 0; t < n; t++) {
      const c = [r() * 100 - 50, r() * 100 - 50, r() * 40];
      for (let v = 0; v < 3; v++)
        for (let k = 0; k < 3; k++) tri[t * 9 + v * 3 + k] = (c[k] as number) + r() * 8 - 4;
    }
    const bvh = new Bvh(tri, new Int32Array(n));
    let hits = 0;
    for (let i = 0; i < 2000; i++) {
      const o = [r() * 120 - 60, r() * 120 - 60, r() * 10];
      const z = r();
      const a = r() * Math.PI * 2;
      const d = [Math.sqrt(1 - z * z) * Math.cos(a), Math.sqrt(1 - z * z) * Math.sin(a), z];
      const b = bvh.cast(
        o[0] as number,
        o[1] as number,
        o[2] as number,
        d[0] as number,
        d[1] as number,
        d[2] as number,
      );
      expect(b).toBe(bruteHit(tri, o, d));
      if (b >= 0) hits++;
      const any = bvh.cast(
        o[0] as number,
        o[1] as number,
        o[2] as number,
        d[0] as number,
        d[1] as number,
        d[2] as number,
        Infinity,
        true,
      );
      expect(any >= 0).toBe(b >= 0);
    }
    expect(hits).toBeGreaterThan(100);
  });

  it('sky view factor at the centre of a long canyon matches the analytic value (SD V5)', () => {
    // Two 600 m long walls, H/W = 1 (H = W = 20 m), axis north-south; floor centre SVF = 1/sqrt(1 + (2H/W)^2) for an infinite canyon.
    const hero = synthBuilding('canyon_probe', [
      { id: 'rm_probe', ring: rect(-100, -100, 100, 100), height: 10 },
    ]);
    const site = [
      neighbour('w_west', rect(-30000, -300000, -10000, 300000), 20000),
      neighbour('w_east', rect(10000, -300000, 30000, 300000), 20000),
    ];
    const scene = buildScene(hero, { tiles: [tile(site)], radiusM: 2000 });
    for (const mf of [1, 2, 4]) {
      const p = skyPatches(mf);
      let num = 0;
      let den = 0;
      for (let i = 0; i < p.count; i++) {
        const dx = p.dir[i * 3] as number;
        const dy = p.dir[i * 3 + 1] as number;
        const dz = p.dir[i * 3 + 2] as number;
        const w = (p.omega[i] as number) * dz;
        den += w;
        // From 1 m east of the probe, on the canyon floor.
        if (scene.bvh.cast(1, 0, 0.05, dx, dy, dz, Infinity, true) < 0) num += w;
      }
      const svf = num / den;
      const exact = 1 / Math.sqrt(1 + 4);
      expect(Math.abs(svf - exact)).toBeLessThan(mf === 1 ? 0.03 : 0.015);
    }
  });

  it('cube shadow hours on 21 December agree with an analytic box test (SD V6)', () => {
    const hero = synthBuilding('cube', [
      { id: 'rm_cube', ring: rect(-5000, -5000, 5000, 5000), height: 10000 },
    ]);
    const scene = buildScene(hero, { tiles: [], radiusM: 100 });
    const inCube = (x: number, y: number) => Math.abs(x) < 5 && Math.abs(y) < 5;
    const g = groundSunHours(scene, {
      lat: 17.4453,
      lon: 78.349,
      elevationM: 545,
      tzHours: 5.5,
      month: 12,
      day: 21,
      stepMin: 15,
      cellM: 1,
      marginM: 20,
      skip: inCube,
    });
    // Oracle: same sun steps, ray against the axis-aligned box [-5, 5]^2 x [0, 10] analytically.
    const dirs: number[][] = [];
    for (let m = 0; m < 1440; m += 15) {
      const t = m + 7.5;
      const p = spa({
        jd: julianDay(2025, 12, 21, Math.floor(t / 60), t % 60, 0, 5.5),
        deltaT: 69,
        lat: 17.4453,
        lon: 78.349,
        elevationM: 545,
        pressureMbar: 1013,
        tempC: 15,
      });
      if (p.zenith >= 90) continue;
      const z = (p.zenith * Math.PI) / 180;
      const a = (p.azimuth * Math.PI) / 180;
      dirs.push([Math.sin(z) * Math.sin(a), Math.sin(z) * Math.cos(a), Math.cos(z)]);
    }
    let agree = 0;
    let total = 0;
    let shaded = 0;
    for (let j = 0; j < g.rows; j++) {
      for (let i = 0; i < g.cols; i++) {
        const x = g.x0 + (i + 0.5) * g.cellM;
        const y = g.y0 + (j + 0.5) * g.cellM;
        const v = g.hours[j * g.cols + i] as number;
        if (Number.isNaN(v)) continue;
        let h = 0;
        for (const d of dirs) if (!boxHit([x, y, 0.05], d, [-5, -5, 0], [5, 5, 10])) h += 0.25;
        total++;
        if (Math.abs(h - v) < 1e-9) agree++;
        if (v < 8) shaded++;
      }
    }
    expect(shaded).toBeGreaterThan(50);
    expect(agree / total).toBeGreaterThan(0.99);
  }, 60_000);

  it('leaves unknown-height neighbours out of the shade and lists them (R29)', () => {
    const hero = synthBuilding('h', [{ id: 'rm_h', ring: rect(0, 0, 10000, 10000) }]);
    const scene = buildScene(hero, {
      tiles: [
        tile([
          neighbour('n_known', rect(0, 20000, 10000, 30000), 15000),
          neighbour('n_ghost', rect(20000, 0, 30000, 10000), 'unknown'),
          neighbour('n_far', rect(900000, 0, 910000, 10000), 9000),
        ]),
      ],
      radiusM: 300,
    });
    expect(scene.unknownHeightIds).toEqual(['n_ghost']);
    expect(scene.contextIds).toEqual(['n_known']);
    expect(scene.owners[0]).toBe('h');
  });

  it('treats a neighbour the hero overlaps as replaced, but keeps one that only touches', () => {
    const hero = synthBuilding('t', [{ id: 'rm_t', ring: rect(0, 0, 5000, 10000) }]);
    const scene = buildScene(hero, {
      tiles: [
        tile([
          neighbour('osm_terrace', rect(-40000, -1000, 25000, 11000), 8000),
          neighbour('osm_next', rect(5000, 0, 10000, 10000), 8000),
        ]),
      ],
      radiusM: 300,
    });
    expect(scene.overlappedIds).toEqual(['osm_terrace']);
    expect(scene.contextIds).toEqual(['osm_next']);
  });
});

function boxHit(o: number[], d: number[], lo: number[], hi: number[]): boolean {
  let t0 = 1e-6;
  let t1 = Infinity;
  for (let k = 0; k < 3; k++) {
    const dk = d[k] as number;
    const ok = o[k] as number;
    if (Math.abs(dk) < 1e-15) {
      if (ok < (lo[k] as number) || ok > (hi[k] as number)) return false;
      continue;
    }
    let a = ((lo[k] as number) - ok) / dk;
    let b = ((hi[k] as number) - ok) / dk;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
}
