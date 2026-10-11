/**
 * Sun hours on the ground grid on one day (SD 1.4; BRE BR 209 "2 hours of sun on 21 March"):
 * for each cell of a grid around the hero, the hours the sun is up and visible, with sun
 * positions every `stepMin` minutes from the SPA. Geometric (clear sky), not weather weighted.
 * Owner: WP-16.
 *
 * Not part of `SiteResult` yet (no field for a ground grid; see the WP-16 INTERFACES entry). The
 * scene lens can call it directly in the worker.
 */
import { cos, D2R, sin } from './dmath/index.ts';
import type { SiteScene } from './scene.ts';
import { toFrame } from './solar.ts';
import { julianDay, sunGeocentric, sunTopocentric } from './spa.ts';

export interface GroundGrid {
  /** South-west cell corner, scene metres. */
  x0: number;
  y0: number;
  cellM: number;
  cols: number;
  rows: number;
  /** Hours of sun per cell, row-major from the south-west; NaN inside the hero footprint. */
  hours: Float64Array;
}

export interface GroundOptions {
  lat: number;
  lon: number;
  elevationM: number;
  tzHours: number;
  month: number;
  day: number;
  stepMin: number;
  cellM: number;
  /** Grid margin around the hero, metres. */
  marginM: number;
  /** Year for the SPA (default 2025). */
  year?: number;
  /** Cells to skip (inside buildings), given the cell centre in scene metres. */
  skip?: (x: number, y: number) => boolean;
}

export function groundSunHours(scene: SiteScene, o: GroundOptions): GroundGrid {
  const frame = toFrame(scene.trueNorthDeg);
  const suns: [number, number, number][] = [];
  for (let m = 0; m < 24 * 60; m += o.stepMin) {
    const t = m + o.stepMin / 2;
    const jd = julianDay(o.year ?? 2025, o.month, o.day, Math.floor(t / 60), t % 60, 0, o.tzHours);
    const p = sunTopocentric(sunGeocentric(jd, 69), {
      lat: o.lat,
      lon: o.lon,
      elevationM: o.elevationM,
      pressureMbar: 1013,
      tempC: 15,
    });
    if (p.zenith >= 90) continue;
    const z = p.zenith * D2R;
    const a = p.azimuth * D2R;
    suns.push(frame([sin(z) * sin(a), sin(z) * cos(a), cos(z)]));
  }
  const r = scene.heroRadiusM + o.marginM;
  const cols = Math.max(1, Math.round((2 * r) / o.cellM));
  const rows = cols;
  const x0 = -r;
  const y0 = -r;
  const hours = new Float64Array(cols * rows);
  const dt = o.stepMin / 60;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = x0 + (i + 0.5) * o.cellM;
      const y = y0 + (j + 0.5) * o.cellM;
      if (o.skip?.(x, y)) {
        hours[j * cols + i] = Number.NaN;
        continue;
      }
      let h = 0;
      for (const s of suns) if (scene.bvh.cast(x, y, 0.05, s[0], s[1], s[2], Infinity, true) < 0) h += dt;
      hours[j * cols + i] = h;
    }
  }
  return { x0, y0, cellM: o.cellM, cols, rows, hours };
}
