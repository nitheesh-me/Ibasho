/**
 * London climate pack. Owner: WP-01.
 * Monthly data: `cities.ts` (BP 4.3 table, NASA POWER, SAP 10.2 Table U2 region 1, CIBSE design
 * temperature). Hourly: the PVGIS 5.2 London TMY (`tmy.ts`), used by the 5R1C thermal model.
 */
import type { ClimatePack, HourlyClimate } from '@ibasho/core';
import { cityPack, LONDON } from './cities.ts';
import { LONDON_TMY_SOURCE } from './london-tmy-data.ts';
import { londonTmy } from './tmy.ts';

export const LONDON_CLIMATE_ID = LONDON.id;

const base = cityPack(LONDON);
const prov = base.provenance!;

/** The London pack with the TMY, async (core contract) and sync (engine adapter `hourlySync`). */
export const londonClimate: ClimatePack & { hourlySync: () => HourlyClimate } = {
  ...base,
  provenance: { sources: [...prov.sources, LONDON_TMY_SOURCE], lastChecked: prov.lastChecked, grade: prov.grade },
  hourly: async () => londonTmy(),
  hourlySync: londonTmy,
};
