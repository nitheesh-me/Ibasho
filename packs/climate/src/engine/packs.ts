/**
 * Every climate pack of this package, by id. Owner: WP-01.
 */
import type { ClimatePack } from '@ibasho/core';
import { cityPack, DELHI, EDINBURGH, HYDERABAD, MANCHESTER, MUMBAI } from './cities.ts';
import { londonClimate } from './london.ts';
import { sapUkAverageClimate } from './sap-u.ts';

export const manchesterClimate = cityPack(MANCHESTER);
export const edinburghClimate = cityPack(EDINBURGH);
export const hyderabadClimate = cityPack(HYDERABAD);
export const mumbaiClimate = cityPack(MUMBAI);
export const delhiClimate = cityPack(DELHI);

export const CLIMATE_PACKS: readonly ClimatePack[] = [
  londonClimate,
  manchesterClimate,
  edinburghClimate,
  hyderabadClimate,
  mumbaiClimate,
  delhiClimate,
  sapUkAverageClimate,
];

/** A climate pack by id, or a clear error. */
export function climateById(id: string): ClimatePack {
  const c = CLIMATE_PACKS.find((p) => p.id === id);
  if (!c) throw new Error(`no climate pack ${id}`);
  return c;
}
