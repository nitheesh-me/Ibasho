/// <reference types="node" />
/**
 * Compares the real energy stage with the Preview fixtures (README table, WP-18).
 * Run: `node packages/fixtures/src/energy/compare-energy.ts gb1 gb2 gb3 gb4 gh1`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { typesGlobalLibrary } from '../../../../packs/types-global/src/engine/index.ts';
import { typesInLibrary } from '../../../../packs/types-in/src/engine/index.ts';
import { END_USES, mergeTypeLibraries } from '../../../core/src/index.ts';
import {
  BuildingResultSchema,
  CompiledBuildingSchema,
  PlaceSchema,
} from '../../../core/src/schemas/index.ts';
import { computeRealEnergy } from '../../../engine/src/enduse/provider.ts';

const root = join(import.meta.dirname, '..', '..', '..', '..');
const places = JSON.parse(
  readFileSync(join(root, 'packages/fixtures/src/buildings/places.json'), 'utf8'),
).map((p: unknown) => PlaceSchema.parse(p));
for (const id of process.argv.slice(2)) {
  const compiled = CompiledBuildingSchema.parse(
    JSON.parse(readFileSync(join(root, `packages/fixtures/src/preview/${id}/geometry.json`), 'utf8')),
  );
  const prev = BuildingResultSchema.parse(
    JSON.parse(readFileSync(join(root, `packages/fixtures/src/preview/${id}/energy.json`), 'utf8')),
  );
  const doc = JSON.parse(
    readFileSync(join(root, `packages/fixtures/src/buildings/${id}.building.json`), 'utf8'),
  );
  const place = places.find((p: { id: string }) => p.id === doc.placeId);
  const lib = place.climatePackId.includes('london')
    ? mergeTypeLibraries(typesInLibrary, typesGlobalLibrary)
    : typesInLibrary;
  const t0 = performance.now();
  const r = computeRealEnergy(
    {
      compiled,
      site: { place, tiles: [], weatherHash: place.climatePackId },
      settings: [],
      asOf: '2026-10-11',
    },
    lib,
  );
  const ms = performance.now() - t0;
  const mwh = (res: typeof r) =>
    Object.fromEntries(
      END_USES.map((u) => [
        u,
        Math.round(res.endUses[u].reduce((s: number, v) => s + (v === 'unknown' ? 0 : Number(v)), 0) / 1e5) /
          10,
      ]),
    );
  console.log(
    id,
    `${ms.toFixed(0)} ms`,
    'real EUI',
    r.eui.site,
    'preview',
    prev.eui.site,
    'm2',
    r.conditionedM2,
  );
  console.log('  real', JSON.stringify(mwh(r)));
  console.log('  prev', JSON.stringify(mwh(prev)));
  console.log(
    '  bills',
    r.bills
      .map((b) => `${b.carrier} ${(Number(b.total) / 1e8).toFixed(0)} ${b.currency} kVA ${b.demandKva ?? ''}`)
      .join(', '),
    'prev',
    prev.bills.map((b) => (Number(b.total) / 1e8).toFixed(0)).join(','),
  );
}
