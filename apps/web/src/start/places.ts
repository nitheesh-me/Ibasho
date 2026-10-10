/**
 * The Where step, offline (SPEC 5.2, AC-G3). Owner: WP-08.
 *
 * A short list of English cities, and a UK postcode read locally: only the letters of its area
 * are used to pick the nearest listed city, and nothing is looked up or sent anywhere.
 * PLACEHOLDER: the climate pack has London's typical year only (WP-01 adds cities at M-A), so
 * every place uses it and the page says so. Online postcode and EPC lookup come later
 * (postcodes.io, DEC PR-8), off when offline.
 */
import type { RegionCode } from '@ibasho/core';

export interface Place {
  id: string;
  name: string;
  region: RegionCode;
  lat: number;
  lon: number;
  /** Climate pack with this place's typical year. */
  climatePackId: string;
  /** True when the climate pack holds this place's own weather. */
  ownWeather: boolean;
}

/** Id of the London climate pack (`@ibasho/pack-climate`); kept as data so the main thread does not load the engine half. */
const LONDON_CLIMATE_ID = 'climate-london';

const place = (id: string, name: string, lat: number, lon: number): Place => ({
  id,
  name,
  region: 'GB-ENG',
  lat,
  lon,
  climatePackId: LONDON_CLIMATE_ID,
  ownWeather: id === 'london',
});

export const PLACES: readonly Place[] = [
  place('london', 'London', 51.507, -0.128),
  place('birmingham', 'Birmingham', 52.486, -1.89),
  place('manchester', 'Manchester', 53.481, -2.243),
  place('leeds', 'Leeds', 53.8, -1.549),
  place('liverpool', 'Liverpool', 53.408, -2.991),
  place('sheffield', 'Sheffield', 53.381, -1.47),
  place('bristol', 'Bristol', 51.455, -2.588),
  place('newcastle', 'Newcastle', 54.978, -1.618),
  place('nottingham', 'Nottingham', 52.954, -1.158),
];

export function placeById(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}

/** Postcode areas (the leading letters) of the listed cities. */
const AREAS: Record<string, string> = {
  B: 'birmingham',
  BS: 'bristol',
  L: 'liverpool',
  LS: 'leeds',
  M: 'manchester',
  NE: 'newcastle',
  NG: 'nottingham',
  S: 'sheffield',
};
const LONDON_AREAS = [
  'E',
  'EC',
  'N',
  'NW',
  'SE',
  'SW',
  'W',
  'WC',
  'BR',
  'CR',
  'DA',
  'EN',
  'HA',
  'IG',
  'KT',
  'RM',
  'SM',
  'TW',
  'UB',
];
for (const a of LONDON_AREAS) AREAS[a] = 'london';

/** A full or outward UK postcode, loosely: area letters, a district, optionally the inward part. */
const POSTCODE = /^([A-Z]{1,2})[0-9][A-Z0-9]?(?:\s*[0-9][A-Z]{2})?$/;

export type PostcodeRead =
  | { kind: 'place'; place: Place; area: string }
  | { kind: 'unlisted'; area: string }
  | { kind: 'invalid' };

export function readPostcode(input: string): PostcodeRead {
  const m = POSTCODE.exec(input.trim().toUpperCase());
  if (!m?.[1]) return { kind: 'invalid' };
  const area = m[1];
  const id = AREAS[area];
  const p = id ? placeById(id) : undefined;
  return p ? { kind: 'place', place: p, area } : { kind: 'unlisted', area };
}
