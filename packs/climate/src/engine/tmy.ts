/**
 * London typical meteorological year as a core `HourlyClimate` (SPEC R5). Owner: WP-01.
 * Data and licence: `london-tmy-data.ts` (PVGIS 5.2, JRC). Parsing is exact: integers, then one
 * division by 10 for tenths. The result is built once and cached (it is immutable by contract).
 */
import type { HourlyClimate } from '@ibasho/core';
import { LONDON_TMY } from './london-tmy-data.ts';

export const HOURS_PER_YEAR = 8760;

function series(csv: string, scale: number, what: string): Float64Array {
  const parts = csv.split(',');
  if (parts.length !== HOURS_PER_YEAR) throw new Error(`TMY ${what} has ${parts.length} hours, expected 8760`);
  const out = new Float64Array(HOURS_PER_YEAR);
  for (let h = 0; h < HOURS_PER_YEAR; h++) {
    const v = Number.parseInt(parts[h]!, 10);
    if (!Number.isFinite(v)) throw new Error(`TMY ${what} hour ${h} is not an integer`);
    out[h] = scale === 1 ? v : v / scale;
  }
  return out;
}

let cached: HourlyClimate | undefined;

/** The London TMY, synchronously (engine and tests). */
export function londonTmy(): HourlyClimate {
  if (!cached) {
    cached = {
      thetaE: series(LONDON_TMY.T, 10, 'T'),
      ghi: series(LONDON_TMY.GHI, 1, 'GHI'),
      dhi: series(LONDON_TMY.DHI, 1, 'DHI'),
      windMs: series(LONDON_TMY.WS, 10, 'WS'),
      rh: series(LONDON_TMY.RH, 1, 'RH'),
      source: 'tmy',
    };
  }
  return cached;
}
