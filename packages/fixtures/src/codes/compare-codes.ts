/// <reference types="node" />
/**
 * Summarises the real codes stage per golden building against the Preview codes fixtures
 * (README table, WP-19). Run: `node packages/fixtures/src/codes/compare-codes.ts gb1 gb3 gb4 gh1`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASHRAE_APPG, CODES_UK } from '../../../../packs/codes-global/src/engine/index.ts';
import { CODES_IN, ECSBC_EDITIONS } from '../../../../packs/codes-in/src/engine/index.ts';
import { RATING_SCHEMES } from '../../../../packs/ratings/src/engine/index.ts';
import { typesGlobalLibrary } from '../../../../packs/types-global/src/engine/index.ts';
import { typesInLibrary } from '../../../../packs/types-in/src/engine/index.ts';
import { mergeTypeLibraries } from '../../../core/src/index.ts';
import {
  BuildingDocSchema,
  CodesOutSchema,
  CompiledBuildingSchema,
  PlaceSchema,
} from '../../../core/src/schemas/index.ts';
import { computeRealCodes } from '../../../engine/src/codes/provider.ts';
import { computeRealEnergy } from '../../../engine/src/enduse/provider.ts';

const root = join(import.meta.dirname, '..', '..', '..', '..');
const json = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const places = json('packages/fixtures/src/buildings/places.json').map((p: unknown) => PlaceSchema.parse(p));
const lib = mergeTypeLibraries(typesInLibrary, typesGlobalLibrary);
const cat = {
  india: CODES_IN,
  indiaEditions: ECSBC_EDITIONS,
  uk: CODES_UK,
  appG: ASHRAE_APPG,
  ratings: RATING_SCHEMES,
};
for (const id of process.argv.slice(2)) {
  const compiled = CompiledBuildingSchema.parse(json(`packages/fixtures/src/preview/${id}/geometry.json`));
  const doc = BuildingDocSchema.parse(json(`packages/fixtures/src/buildings/${id}.building.json`));
  const place = places.find((p: { id: string }) => p.id === doc.placeId);
  const site = { place, tiles: [], weatherHash: place.climatePackId };
  const t0 = performance.now();
  const energy = computeRealEnergy({ compiled, site, settings: [], asOf: '2026-10-11' }, lib);
  const c = computeRealCodes(
    { compiled, doc, energy, site, codePackIds: place.codePackIds, asOf: '2026-10-11' },
    cat,
    lib,
  );
  const ms = Math.round(performance.now() - t0);
  const prev = CodesOutSchema.parse(json(`packages/fixtures/src/preview/${id}/codes.json`));
  const fmt = (s: unknown) => (s === true ? 'met' : s === false ? 'not met' : 'unknown');
  console.log(
    `\n${id} (${ms} ms): baselines ${c.baselines.map((b) => `${b.code} ${b.eui.lo}-${b.eui.hi} ratio ${b.ratio.lo}-${b.ratio.hi}`).join('; ')}`,
  );
  console.log(
    `  preview baselines: ${prev.baselines.map((b) => `${b.code} ratio ${b.ratio.lo}-${b.ratio.hi}`).join('; ')}`,
  );
  for (const r of c.codes)
    console.log(
      `  ${r.ruleId}: ${fmt(r.status)}${r.tier ? ` tier ${r.tier}` : ''}${r.margin ? ` margin ${r.margin.value} ${r.margin.unit}` : ''}`,
    );
  for (const r of c.ratings)
    console.log(
      `  ${r.scheme} ${r.edition}: ${r.value === 'unknown' ? 'unknown' : `${r.value.lo} to ${r.value.hi}`} -> ${r.level.likely} (possible ${r.level.possible ?? 'none'})`,
    );
}
