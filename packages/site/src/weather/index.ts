/**
 * Weather lookup and the EPW reader (SD 2, R28). Owner: WP-16.
 *
 * `weatherFor(site)` prefers a parsed EPW on the `SiteContext`, else the weather shipped for the
 * place's climate pack (Hyderabad TMYx, London PVGIS TMY), else the nearest of the two by
 * latitude with `fallback: true` so the result can say so.
 */
import type { Epw, SiteContext } from '@ibasho/core';
import { sha256Hex } from '@ibasho/core';
import { HYDERABAD_TMYX } from './hyderabad.gen.ts';
import { LONDON_PVGIS_TMY } from './london.gen.ts';
import type { CompactWeather, HourlyWeather } from './types.ts';

export type { CompactWeather, HourlyWeather } from './types.ts';

export const HOURS = 8760;

function series(csv: string, scale: number, what: string): Float64Array {
  const parts = csv.split(',');
  if (parts.length !== HOURS) throw new Error(`weather ${what}: ${parts.length} hours, expected ${HOURS}`);
  const out = new Float64Array(HOURS);
  for (let h = 0; h < HOURS; h++) {
    const v = Number.parseInt(parts[h] as string, 10);
    if (!Number.isFinite(v)) throw new Error(`weather ${what}: hour ${h} is not an integer`);
    out[h] = scale === 1 ? v : v / scale;
  }
  return out;
}

const decoded = new Map<string, HourlyWeather>();

export function decodeWeather(c: CompactWeather): HourlyWeather {
  const hit = decoded.get(c.hash);
  if (hit) return hit;
  const lux = (s: string | undefined, what: string) => {
    if (!s) return null;
    const v = series(s, 1, what);
    for (let h = 0; h < HOURS; h++) v[h] = (v[h] as number) < 0 ? -1 : (v[h] as number) * 10;
    return v;
  };
  const w: HourlyWeather = {
    id: c.id,
    name: c.name,
    lat: c.lat,
    lon: c.lon,
    tzHours: c.tzHours,
    elevationM: c.elevationM,
    albedo: c.albedo,
    hash: c.hash,
    source: c.source,
    ghi: series(c.ghi, 1, 'ghi'),
    dni: series(c.dni, 1, 'dni'),
    dhi: series(c.dhi, 1, 'dhi'),
    dryBulbC: series(c.dryBulbDeci, 10, 'dry bulb'),
    dewPointC: series(c.dewPointDeci, 10, 'dew point'),
    evdn: lux(c.evdnDeca, 'evdn'),
    evdh: lux(c.evdhDeca, 'evdh'),
  };
  decoded.set(c.hash, w);
  return w;
}

/** Shipped weather by climate pack id. */
export const SHIPPED_WEATHER: Readonly<Record<string, CompactWeather>> = {
  'climate.hyderabad': HYDERABAD_TMYX,
  'climate.london': LONDON_PVGIS_TMY,
};

export interface WeatherChoice {
  weather: HourlyWeather;
  /** True when no weather matched the place and the nearer shipped file stands in. */
  fallback: boolean;
}

export function weatherFor(site: Pick<SiteContext, 'place' | 'epw'>): WeatherChoice {
  if (site.epw) return { weather: weatherFromEpw(site.epw), fallback: false };
  const c = SHIPPED_WEATHER[site.place.climatePackId];
  if (c) return { weather: decodeWeather(c), fallback: false };
  const near = Math.abs(site.place.lat) > 35 ? LONDON_PVGIS_TMY : HYDERABAD_TMYX;
  return { weather: decodeWeather(near), fallback: true };
}

/** Hourly weather from a parsed EPW (illuminance from the Perez 1990 model). */
export function weatherFromEpw(e: Epw): HourlyWeather {
  const hit = decoded.get(e.hash);
  if (hit) return hit;
  const f = (a: readonly number[]) => Float64Array.from(a);
  const w: HourlyWeather = {
    id: `epw:${e.location.stationId}`,
    name: e.location.city,
    lat: e.location.lat,
    lon: e.location.lon,
    tzHours: e.location.tzHours,
    elevationM: e.location.elevationM,
    albedo: 0.2,
    hash: e.hash,
    source: e.source,
    ghi: f(e.ghiWhm2),
    dni: f(e.dniWhm2),
    dhi: f(e.dhiWhm2),
    dryBulbC: f(e.dryBulbC),
    dewPointC: f(e.dewPointC),
    evdn: null,
    evdh: null,
  };
  decoded.set(e.hash, w);
  return w;
}

/**
 * Parses EnergyPlus weather text (untrusted input). Checks the LOCATION line, 8,760 data rows
 * and every number it keeps; throws a plain message on the first problem. `hash` is the sha256 of
 * the UTF-8 text (equal to the file bytes for the ASCII files EPW tools write).
 * PLACEHOLDER: there is no `EpwSchema` in `@ibasho/core/schemas` yet (INTERFACES, WP-16).
 */
export function parseEpw(text: string, source: Epw['source']): Epw {
  const lines = text.split(/\r?\n/);
  const loc = (lines[0] ?? '').split(',');
  if (loc[0] !== 'LOCATION' || loc.length < 10) throw new Error('EPW: first line is not LOCATION');
  const num = (v: string | undefined, what: string, lo: number, hi: number) => {
    const n = Number(v);
    if (v === undefined || v.trim() === '' || !Number.isFinite(n) || n < lo || n > hi)
      throw new Error(`EPW: ${what} out of range (${v})`);
    return n;
  };
  const rows = lines.slice(8).filter((l) => l.trim());
  if (rows.length !== HOURS) throw new Error(`EPW: ${rows.length} data rows, expected ${HOURS}`);
  const cols = {
    tdb: [] as number[],
    tdp: [] as number[],
    rh: [] as number[],
    ghi: [] as number[],
    dni: [] as number[],
    dhi: [] as number[],
    ws: [] as number[],
    wd: [] as number[],
  };
  rows.forEach((r, i) => {
    const c = r.split(',');
    if (c.length < 22) throw new Error(`EPW: row ${i + 9} has ${c.length} fields`);
    cols.tdb.push(num(c[6], 'dry bulb', -70, 70));
    cols.tdp.push(num(c[7], 'dew point', -70, 70));
    cols.rh.push(num(c[8], 'relative humidity', 0, 110));
    cols.ghi.push(num(c[13], 'GHI', 0, 1600));
    cols.dni.push(num(c[14], 'DNI', 0, 1600));
    cols.dhi.push(num(c[15], 'DHI', 0, 1000));
    cols.wd.push(num(c[20], 'wind direction', 0, 999));
    cols.ws.push(num(c[21], 'wind speed', 0, 999));
  });
  return {
    schema: 'ibasho.epw/1',
    hash: sha256Hex(text),
    location: {
      city: loc[1] ?? '',
      country: loc[3] ?? '',
      source: loc[4] ?? '',
      stationId: loc[5] ?? '',
      lat: num(loc[6], 'latitude', -90, 90),
      lon: num(loc[7], 'longitude', -180, 180),
      tzHours: num(loc[8], 'time zone', -12, 14),
      elevationM: num(loc[9], 'elevation', -500, 9000),
    },
    period: /TMY|IWEC|TRY|ISHRAE|CWEC/i.test(loc[4] ?? '') ? 'typical' : 'actual',
    dryBulbC: cols.tdb,
    dewPointC: cols.tdp,
    rhPct: cols.rh,
    ghiWhm2: cols.ghi,
    dniWhm2: cols.dni,
    dhiWhm2: cols.dhi,
    windMs: cols.ws,
    windDirDeg: cols.wd,
    source,
  };
}
