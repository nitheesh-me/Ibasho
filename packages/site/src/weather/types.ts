/**
 * Hourly weather for the site worker (8,760 hours, local standard time, hour h covers the interval
 * ending at h + 1). Owner: WP-16.
 */
import type { SourceRef } from '@ibasho/core';

/** Shipped form: comma separated integers (see `scripts/gen-weather.ts`). */
export interface CompactWeather {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tzHours: number;
  elevationM: number;
  albedo: number;
  hash: string;
  source: SourceRef;
  ghi: string;
  dni: string;
  dhi: string;
  dryBulbDeci: string;
  dewPointDeci: string;
  /** Direct normal and diffuse horizontal illuminance, tens of lux (-1 missing); absent: Perez 1990 efficacy. */
  evdnDeca?: string;
  evdhDeca?: string;
}

/** Decoded form the analysis reads. */
export interface HourlyWeather {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tzHours: number;
  elevationM: number;
  albedo: number;
  hash: string;
  source: SourceRef;
  ghi: Float64Array;
  dni: Float64Array;
  dhi: Float64Array;
  dryBulbC: Float64Array;
  dewPointC: Float64Array;
  /** Lux, or null when the file has no illuminance columns (Perez 1990 efficacy fills them). */
  evdn: Float64Array | null;
  evdh: Float64Array | null;
}
