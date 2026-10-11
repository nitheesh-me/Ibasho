/**
 * Hourly weather and sun for the real energy stage (WP-18). A full EPW from the site context is
 * used when present (8,760 hours); otherwise the built-in mean day per month (weather.gen.ts) is
 * repeated over each month. Sun vectors follow the textbook declination, equation of time and
 * hour angle (Duffie and Beckman, Solar Engineering of Thermal Processes, 1.6 and 1.5), with
 * dmath sin and cos only (deterministic).
 */
import type { SiteContext } from '@ibasho/core';
import { cos, PI, sin } from '@ibasho/dmath';
import { MEAN_DAY_WEATHER, type MeanDayWeather } from './weather.gen.ts';

export const HOURS = 8760;
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** First hour of each month. */
export const MONTH_START: readonly number[] = DAYS_IN_MONTH.reduce<number[]>((acc, _d, i) => {
  acc.push(i === 0 ? 0 : (acc[i - 1] as number) + (DAYS_IN_MONTH[i - 1] as number) * 24);
  return acc;
}, []);

export const monthOfHour = (h: number): number => {
  let m = 0;
  while (m < 11 && h >= (MONTH_START[m + 1] as number)) m++;
  return m;
};

export interface HourlyWeather {
  id: string;
  lat: number;
  lon: number;
  tzHours: number;
  tC: Float64Array;
  ghi: Float64Array;
  dhi: Float64Array;
  rh: Float64Array;
  /** Monthly mean dry bulb, for running means and mains water. */
  monthlyTC: number[];
  source: 'epw' | 'mean-day';
}

function fromMeanDay(w: MeanDayWeather): HourlyWeather {
  const tC = new Float64Array(HOURS);
  const ghi = new Float64Array(HOURS);
  const dhi = new Float64Array(HOURS);
  const rh = new Float64Array(HOURS);
  for (let h = 0; h < HOURS; h++) {
    const m = monthOfHour(h);
    const k = m * 24 + (h % 24);
    tC[h] = (w.tDeci[k] as number) / 10;
    ghi[h] = w.ghi[k] as number;
    dhi[h] = w.dhi[k] as number;
    rh[h] = w.rh[k] as number;
  }
  return {
    id: w.id,
    lat: w.lat,
    lon: w.lon,
    tzHours: w.tzHours,
    tC,
    ghi,
    dhi,
    rh,
    monthlyTC: monthlyMeans(tC),
    source: 'mean-day',
  };
}

function monthlyMeans(t: Float64Array): number[] {
  return DAYS_IN_MONTH.map((d, m) => {
    let s = 0;
    const a = MONTH_START[m] as number;
    for (let h = a; h < a + d * 24; h++) s += t[h] as number;
    return s / (d * 24);
  });
}

/** Weather for a site: its EPW when attached, else the built-in mean days for its climate pack. */
export function hourlyWeather(site?: SiteContext): HourlyWeather {
  const epw = site?.epw;
  if (epw && epw.dryBulbC.length >= HOURS) {
    const tC = Float64Array.from(epw.dryBulbC.slice(0, HOURS));
    return {
      id: `epw:${epw.hash.slice(0, 12)}`,
      lat: epw.location.lat,
      lon: epw.location.lon,
      tzHours: epw.location.tzHours,
      tC,
      ghi: Float64Array.from(epw.ghiWhm2.slice(0, HOURS)),
      dhi: Float64Array.from(epw.dhiWhm2.slice(0, HOURS)),
      rh: Float64Array.from(epw.rhPct.slice(0, HOURS)),
      monthlyTC: monthlyMeans(tC),
      source: 'epw',
    };
  }
  const id = site?.place.climatePackId ?? 'climate.hyderabad';
  const w =
    MEAN_DAY_WEATHER[id] ??
    (id.includes('london') ? MEAN_DAY_WEATHER['climate.london'] : MEAN_DAY_WEATHER['climate.hyderabad']);
  return fromMeanDay(w as MeanDayWeather);
}

/** Sun unit vector (east, north, up) at the middle of each hour. */
export interface SunPath {
  east: Float64Array;
  north: Float64Array;
  up: Float64Array;
}

export function sunPath(w: HourlyWeather): SunPath {
  const east = new Float64Array(HOURS);
  const north = new Float64Array(HOURS);
  const up = new Float64Array(HOURS);
  const phi = (w.lat * PI) / 180;
  const sp = sin(phi);
  const cp = cos(phi);
  for (let h = 0; h < HOURS; h++) {
    const n = Math.floor(h / 24) + 1;
    const decl = ((23.45 * PI) / 180) * sin((2 * PI * (284 + n)) / 365);
    const b = (2 * PI * (n - 81)) / 364;
    const eot = 9.87 * sin(2 * b) - 7.53 * cos(b) - 1.5 * sin(b);
    const solarHour = (h % 24) + 0.5 + (4 * (w.lon - 15 * w.tzHours) + eot) / 60;
    const omega = ((solarHour - 12) * 15 * PI) / 180;
    const sd = sin(decl);
    const cd = cos(decl);
    const co = cos(omega);
    up[h] = sp * sd + cp * cd * co;
    east[h] = -cd * sin(omega);
    north[h] = cp * sd - sp * cd * co;
  }
  return { east, north, up };
}

/** Hourly irradiance (W/m², equal to Wh/m² in the hour) on a surface: isotropic sky, ground 0.2. */
export function surfaceIrradiance(
  w: HourlyWeather,
  sun: SunPath,
  azimuthDeg: number,
  tiltDeg: number,
): Float64Array {
  const az = (azimuthDeg * PI) / 180;
  const tl = (tiltDeg * PI) / 180;
  const st = sin(tl);
  const ct = cos(tl);
  const nx = sin(az) * st;
  const ny = cos(az) * st;
  const out = new Float64Array(HOURS);
  for (let h = 0; h < HOURS; h++) {
    const g = w.ghi[h] as number;
    if (g <= 0) continue;
    const d = Math.min(g, w.dhi[h] as number);
    const u = sun.up[h] as number;
    const cosT = nx * (sun.east[h] as number) + ny * (sun.north[h] as number) + ct * u;
    const beam = u > 0.05 && cosT > 0 ? Math.min(6, cosT / u) * (g - d) : 0;
    out[h] = beam + (d * (1 + ct)) / 2 + (g * 0.2 * (1 - ct)) / 2;
  }
  return out;
}
