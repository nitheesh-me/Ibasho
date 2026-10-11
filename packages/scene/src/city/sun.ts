/**
 * Sun and time for the city stage (SD 1.1). Owner: WP-07.
 * suncalc 2 (degrees, azimuth from north) is the preview sun (ARCH 15.9: the SPA port in `site` is canonical); the picture only.
 */
import * as SunCalcNs from 'suncalc';

const SunCalc: typeof SunCalcNs =
  (SunCalcNs as unknown as { default?: typeof SunCalcNs }).default ?? SunCalcNs;

const DEG = 180 / Math.PI;

/** A moment at a place: civil date and minutes after local standard midnight. */
export interface CityTime {
  /** `YYYY-MM-DD`. */
  date: string;
  /** Minutes after local midnight, 0 to 1440. */
  minutes: number;
}

export interface CitySun {
  azimuthDeg: number;
  altitudeDeg: number;
  /** Unit vector towards the sun, world frame (x east, y up, z south). */
  dir: [number, number, number];
  up: boolean;
}

/** India Standard Time; places elsewhere pass their own offset. */
export const IST_HOURS = 5.5;

export function timeToDate(t: CityTime, tzHours = IST_HOURS): Date {
  const [y, m, d] = t.date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + (t.minutes - tzHours * 60) * 60_000);
}

export function sunOf(t: CityTime, lat: number, lon: number, tzHours = IST_HOURS): CitySun {
  // suncalc 2: degrees, azimuth clockwise from north.
  const p = SunCalc.getPosition(timeToDate(t, tzHours), lat, lon);
  const azimuthDeg = ((p.azimuth % 360) + 360) % 360;
  const altitudeDeg = p.altitude;
  const az = azimuthDeg / DEG;
  const alt = altitudeDeg / DEG;
  return {
    azimuthDeg,
    altitudeDeg,
    dir: [Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt)],
    up: altitudeDeg > 0,
  };
}

/** Sunrise and sunset in local minutes. */
export function dayWindow(
  date: string,
  lat: number,
  lon: number,
  tzHours = IST_HOURS,
): { rise: number; set: number } {
  const noon = timeToDate({ date, minutes: 720 }, tzHours);
  const t = SunCalc.getTimes(noon, lat, lon);
  const toMin = (d: Date | null): number => {
    if (!d) return Number.NaN;
    const [y, m, dd] = date.split('-').map(Number) as [number, number, number];
    return (d.getTime() - Date.UTC(y, m - 1, dd)) / 60_000 + tzHours * 60;
  };
  const rise = toMin(t.sunrise);
  const set = toMin(t.sunset);
  return Number.isFinite(rise) && Number.isFinite(set) ? { rise, set } : { rise: 360, set: 1080 };
}

/** Day of year (1 to 365) of a `YYYY-MM-DD` date, and back (non leap reference year). */
export function dayOfYear(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
}

export function dateOfDay(day: number, year = 2026): string {
  const d = new Date(Date.UTC(year, 0, 1) + (Math.round(day) - 1) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** `--t-sweep`: 12 s per day (DESIGN_SYSTEM 13.6). */
export const SWEEP_MS = 12_000;

/** Local minutes at sweep progress `p` (0 to 1), dawn to dusk. */
export function sweepMinutes(p: number, w: { rise: number; set: number }): number {
  const c = p < 0 ? 0 : p > 1 ? 1 : p;
  return w.rise + 10 + (w.set - w.rise - 20) * c;
}

export function clockLabel(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dateLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
}
