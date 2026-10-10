/**
 * Measure catalogue for ops and why-not. Owner: WP-12.
 *
 * Measure, group and option ids are frozen per home pack in `packs/<pack>/src/ids.ts` (WP-01,
 * blackboard INTERFACES). That file is pure data with no imports, so it is loaded at run time
 * like the engine (apps/mcp declares no dependency on packs; INTERFACES request on the blackboard).
 */

import { pathToFileURL } from 'node:url';
import type { RegionCode } from '@ibasho/core';
import { repoPath } from './paths.ts';

export interface MeasureDef {
  group: string;
  kind: string;
  options: readonly string[];
}

export interface MeasureCatalogue {
  pack: string;
  measures: Readonly<Record<string, MeasureDef>>;
  /** Sub-groups (e.g. `sub-cylinder`) whose choice goes to `PackageSpec.subOptions`. */
  subGroups: ReadonlySet<string>;
}

export function packForRegion(region: RegionCode): string {
  return region.startsWith('IN') ? 'home-in' : 'home-uk';
}

/** Load `packs/<pack>/src/ids.ts`; null when the pack has no ids yet. */
export async function loadCatalogue(pack: string): Promise<MeasureCatalogue | null> {
  try {
    const mod = (await import(
      /* @vite-ignore */ pathToFileURL(repoPath(`packs/${pack}/src/ids.ts`)).href
    )) as {
      MEASURES?: Record<string, MeasureDef>;
      SUB_GROUPS?: Record<string, unknown>;
    };
    if (!mod.MEASURES) return null;
    return { pack, measures: mod.MEASURES, subGroups: new Set(Object.keys(mod.SUB_GROUPS ?? {})) };
  } catch {
    return null;
  }
}

/** Cached loader keyed by pack. */
export function catalogueLoader(load: (pack: string) => Promise<MeasureCatalogue | null> = loadCatalogue) {
  const cache = new Map<string, Promise<MeasureCatalogue | null>>();
  return (region: RegionCode) => {
    const pack = packForRegion(region);
    let p = cache.get(pack);
    if (!p) {
      p = load(pack);
      cache.set(pack, p);
    }
    return p;
  };
}

/** Option ids that belong to a measure (or the option itself when given an option id). */
export function optionsFor(cat: MeasureCatalogue | null, measureOrOption: string): string[] {
  const m = cat?.measures[measureOrOption];
  if (m) return [...m.options];
  for (const def of Object.values(cat?.measures ?? {}))
    if (def.options.includes(measureOrOption)) return [measureOrOption];
  return [];
}
