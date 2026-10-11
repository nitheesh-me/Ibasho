/**
 * The solar year at a place (SD 1.1, 1.2, 1.4): hourly sun positions from the SPA, sun bins for
 * the surface kernel, and monthly cumulative Perez skies over Tregenza or Reinhart patches (the
 * Robinson and Stone 2004 cumulative sky, https://doi.org/10.1016/j.solener.2004.04.016).
 * Owner: WP-16.
 *
 * Time: weather hour h (0 to 8759) covers the hour ending at h + 1, local standard time; the sun
 * is taken at the hour centre on a non-leap year (2025, Delta T 69 s). Directions are unit
 * vectors in the true frame (x east, y north, z up); `toFrame` turns them into the place frame.
 *
 * Sun bins: one per month and hour of day. A bin keeps the DNI-weighted sum of the hourly sun
 * vectors, so the direct irradiance on any plane that faces every hour of the bin is exact
 * (sum of DNI times cos equals n dot the summed vector), and the DNI-weighted mean direction for
 * the visibility ray (within about 6 degrees of every hour in the bin, less near the solstices).
 */
import { cos, D2R, sin } from './dmath/index.ts';
import { type Patches, type SkyCondition, skyCondition, skyPatches, skyVector } from './sky.ts';
import { julianDay, sunGeocentric, sunTopocentric } from './spa.ts';
import type { HourlyWeather } from './weather/index.ts';

export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
/** WMO sunshine: direct normal irradiance at or above 120 W/m2. */
export const SUNSHINE_DNI = 120;

export interface SolarYear {
  /** Month (0 to 11) and day of year (1 to 365) per hour. */
  month: Uint8Array;
  doy: Uint16Array;
  /** Local standard hour of day (0 to 23) per hour. */
  hour: Uint8Array;
  /** Topocentric zenith with refraction, degrees, per hour. */
  zenith: Float64Array;
  /** Sun unit vector per hour (true frame). */
  sun: Float64Array;
}

export interface SunBin {
  month: number;
  hour: number;
  /** DNI-weighted mean direction, unit (true frame). */
  dir: [number, number, number];
  /** Sum over the bin's hours of DNI times the sun vector, Wh/m2. */
  vec: [number, number, number];
  /** Hours in the bin with the sun up, and with sunshine (DNI >= 120 W/m2). */
  hours: number;
  sunshine: number;
}

export interface SkyYear {
  patches: Patches;
  /** Monthly cumulative sky: 12 x count, Wh/m2 per patch (sum of out * max(0, n.d) is irradiance). */
  monthly: Float64Array;
  /** Monthly global horizontal irradiation, Wh/m2. */
  ghi: Float64Array;
}

const yearCache = new Map<string, SolarYear>();

/** Hourly sun for a place and the weather's time zone. */
export function solarYear(lat: number, lon: number, elevationM: number, tzHours: number): SolarYear {
  const key = `${lat}|${lon}|${elevationM}|${tzHours}`;
  const hit = yearCache.get(key);
  if (hit) return hit;
  const month = new Uint8Array(8760);
  const doy = new Uint16Array(8760);
  const hour = new Uint8Array(8760);
  const zenith = new Float64Array(8760);
  const sun = new Float64Array(8760 * 3);
  let h = 0;
  let d = 0;
  for (let m = 0; m < 12; m++) {
    for (let day = 1; day <= (MONTH_DAYS[m] as number); day++) {
      d++;
      for (let hr = 0; hr < 24; hr++) {
        const jd = julianDay(2025, m + 1, day, hr, 30, 0, tzHours);
        const p = sunTopocentric(sunGeocentric(jd, 69), {
          lat,
          lon,
          elevationM,
          pressureMbar: 1013 * (1 - elevationM / 44330),
          tempC: 25,
        });
        month[h] = m;
        doy[h] = d;
        hour[h] = hr;
        zenith[h] = p.zenith;
        const z = p.zenith * D2R;
        const a = p.azimuth * D2R;
        sun[h * 3] = sin(z) * sin(a);
        sun[h * 3 + 1] = sin(z) * cos(a);
        sun[h * 3 + 2] = cos(z);
        h++;
      }
    }
  }
  const y = { month, doy, hour, zenith, sun };
  yearCache.set(key, y);
  return y;
}

/** Sun bins (month by hour of day) with the sun up and some direct beam. */
export function sunBins(y: SolarYear, w: HourlyWeather): SunBin[] {
  const acc = new Map<number, SunBin & { wsum: number; dsum: [number, number, number] }>();
  for (let h = 0; h < 8760; h++) {
    if ((y.zenith[h] as number) >= 90) continue;
    const dni = w.dni[h] as number;
    const key = (y.month[h] as number) * 24 + (y.hour[h] as number);
    let b = acc.get(key);
    if (!b) {
      b = {
        month: y.month[h] as number,
        hour: y.hour[h] as number,
        dir: [0, 0, 1],
        vec: [0, 0, 0],
        hours: 0,
        sunshine: 0,
        wsum: 0,
        dsum: [0, 0, 0],
      };
      acc.set(key, b);
    }
    const sx = y.sun[h * 3] as number;
    const sy = y.sun[h * 3 + 1] as number;
    const sz = y.sun[h * 3 + 2] as number;
    b.hours++;
    if (dni >= SUNSHINE_DNI) b.sunshine++;
    b.vec[0] += dni * sx;
    b.vec[1] += dni * sy;
    b.vec[2] += dni * sz;
    // Weight 1 + DNI so beamless hours still give a direction.
    const wt = 1 + dni;
    b.dsum[0] += wt * sx;
    b.dsum[1] += wt * sy;
    b.dsum[2] += wt * sz;
    b.wsum += wt;
  }
  const out: SunBin[] = [];
  for (const k of [...acc.keys()].sort((a, b) => a - b)) {
    const b = acc.get(k) as SunBin & { dsum: [number, number, number] };
    const l = Math.sqrt(b.dsum[0] * b.dsum[0] + b.dsum[1] * b.dsum[1] + b.dsum[2] * b.dsum[2]);
    if (l === 0) continue;
    out.push({
      month: b.month,
      hour: b.hour,
      dir: [b.dsum[0] / l, b.dsum[1] / l, b.dsum[2] / l],
      vec: b.vec,
      hours: b.hours,
      sunshine: b.sunshine,
    });
  }
  return out;
}

/** Sky condition for hour h (sun below the horizon is held at 89.5 degrees for the shape only). */
export function hourCondition(y: SolarYear, w: HourlyWeather, h: number): SkyCondition {
  const z = Math.min(89.5, y.zenith[h] as number);
  return skyCondition(
    (y.zenith[h] as number) < 90 ? (w.dni[h] as number) : 0,
    w.dhi[h] as number,
    z,
    y.doy[h] as number,
  );
}

const skyCache = new Map<string, SkyYear>();

/** Monthly cumulative Perez skies over Reinhart subdivision `mf`. */
export function skyYear(y: SolarYear, w: HourlyWeather, mf: number, key: string): SkyYear {
  const k = `${key}|${w.hash}|${mf}`;
  const hit = skyCache.get(k);
  if (hit) return hit;
  const patches = skyPatches(mf);
  const monthly = new Float64Array(12 * patches.count);
  const ghi = new Float64Array(12);
  const tmp = new Float64Array(patches.count);
  for (let h = 0; h < 8760; h++) {
    const m = y.month[h] as number;
    ghi[m] = (ghi[m] as number) + (w.ghi[h] as number);
    const dhi = w.dhi[h] as number;
    if (dhi <= 0) continue;
    const s: [number, number, number] = [
      y.sun[h * 3] as number,
      y.sun[h * 3 + 1] as number,
      y.sun[h * 3 + 2] as number,
    ];
    skyVector(patches, s, hourCondition(y, w, h), dhi, tmp);
    const base = m * patches.count;
    for (let p = 0; p < patches.count; p++)
      monthly[base + p] = (monthly[base + p] as number) + (tmp[p] as number);
  }
  const sky = { patches, monthly, ghi };
  if (skyCache.size > 8) skyCache.clear();
  skyCache.set(k, sky);
  return sky;
}

/** Turns a true-frame direction into the place frame (place +y is `trueNorthDeg` east of north). */
export function toFrame(
  trueNorthDeg: number,
): (v: readonly [number, number, number]) => [number, number, number] {
  if (trueNorthDeg === 0) return (v) => [v[0], v[1], v[2]];
  const t = trueNorthDeg * D2R;
  const c = cos(t);
  const s = sin(t);
  return (v) => [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}
