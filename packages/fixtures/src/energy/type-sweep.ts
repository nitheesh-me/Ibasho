/// <reference types="node" />
/**
 * One generic building per type (R25, all eight) for the real energy stage: a 40 x 25 m plate,
 * rooms in strips by the type's space mix, a ground floor, a repeated middle floor and a roof
 * floor, systems from the type's first archetype, in Hyderabad. Used by the type sweep test
 * and the README table. Run: `node packages/fixtures/src/energy/type-sweep.ts`.
 */

import { BENCHMARKS } from '../../../../packs/benchmarks/src/engine/index.ts';
import { BUILDING_TYPES_IN, typesInLibrary } from '../../../../packs/types-in/src/engine/index.ts';
import type {
  BuildingDoc,
  BuildingResult,
  BuildingTypeId,
  Place,
  Room2D,
  Storey,
} from '../../../core/src/index.ts';
import { BUILDING_TYPES } from '../../../core/src/index.ts';
import { computeRealEnergy } from '../../../engine/src/enduse/provider.ts';
import { compile, rectRing, weldRooms } from '../../../plan/src/index.ts';

export const SWEEP_PLACE: Place = {
  id: 'pl_sweep',
  name: 'Hyderabad sample site',
  lat: 17.4453,
  lon: 78.349,
  elevationM: 545,
  trueNorthMdeg: 0,
  climatePackId: 'climate.hyderabad',
  codePackIds: ['codes-in'],
  moneyPackIds: ['money-in'],
  buildingIds: [],
};

const SYSTEM_IDS: Record<string, string> = {
  'chilled-water': 'chiller-water-cooled',
  vrf: 'vrf-heat-recovery',
  split: 'split-ac-3star',
};

/** A sweep building of one type: strips by space mix on a 40 x 25 m plate, 5 floors. */
export function sweepDoc(typeId: BuildingTypeId): BuildingDoc {
  const t = BUILDING_TYPES_IN.find((b) => b.typeId === typeId);
  if (!t) throw new Error(`no building type ${typeId}`);
  const W = 40_000;
  const D = 25_000;
  const f2f = t.defaultFloorToFloorMm;
  const total = t.spaceMix.reduce((s, x) => s + x.perMille, 0);
  const floor = (tag: string, fb: Room2D['floorBoundary'], cb: Room2D['ceilingBoundary']): Room2D[] => {
    let x = 0;
    const specs = t.spaceMix.map((m, i) => {
      const w = i === t.spaceMix.length - 1 ? W - x : Math.round((W * m.perMille) / total / 100) * 100;
      const r = {
        id: `rm_${tag}_${i}`,
        name: m.spaceTypeId,
        outer: rectRing(x, 0, x + w, D),
        spaceTypeId: m.spaceTypeId,
      };
      x += w;
      return r;
    });
    return weldRooms(specs, {
      ceiling: f2f - 600,
      floorBoundary: fb,
      ceilingBoundary: cb,
      exterior: { kind: 'outdoors' },
      exteriorRules: () => ({ window: { kind: 'ratio', wwrPm: 300, sill: 900 }, shading: [] }),
    });
  };
  const st = (id: string, el: number, rooms: Room2D[], multiplier = 1): Storey => ({
    id,
    name: id,
    elevation: el,
    floorToFloor: f2f,
    multiplier,
    belowGrade: false,
    rooms,
    rooms3d: [],
    cores: [],
  });
  return {
    schema: 'ibasho.building/1',
    id: `sweep_${typeId}`,
    version: 1,
    placeId: SWEEP_PLACE.id,
    name: `Sample ${typeId}`,
    typeId,
    origin: { x: 0, y: 0 },
    rotationMdeg: 0,
    storeys: [
      st('st_g', 0, floor('g', 'ground', 'adjacent')),
      st('st_mid', f2f, floor('mid', 'adjacent', 'adjacent'), 3),
      st('st_top', 4 * f2f, floor('top', 'adjacent', 'roof')),
    ],
    roofs: [],
    shades: [],
    zones: [],
    systems: [
      { systemId: SYSTEM_IDS[t.systemArchetypes[0] ?? 'split'] ?? 'split-ac-3star', fuel: 'electricity' },
    ],
  };
}

export function sweepRun(typeId: BuildingTypeId): BuildingResult {
  const compiled = compile(sweepDoc(typeId));
  return computeRealEnergy(
    {
      compiled,
      site: { place: SWEEP_PLACE, tiles: [], weatherHash: SWEEP_PLACE.climatePackId },
      settings: [],
      asOf: '2026-10-11',
    },
    typesInLibrary,
  );
}

/** The type's first benchmark band (low, typical, high) in kWh/m²·yr, when it has one. */
export function sweepBenchmark(
  typeId: BuildingTypeId,
): { id: string; low: number; typical: number; high: number } | undefined {
  const t = BUILDING_TYPES_IN.find((b) => b.typeId === typeId);
  const b = BENCHMARKS.find((x) => x.benchmarkId === t?.benchmarkIds[0]);
  return b?.median
    ? { id: b.benchmarkId, low: b.median.low, typical: b.median.typical, high: b.median.high }
    : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const typeId of BUILDING_TYPES) {
    const t0 = performance.now();
    const r = sweepRun(typeId);
    const b = sweepBenchmark(typeId);
    const mid = Math.round((r.eui.site.lo + r.eui.site.hi) / 2);
    console.log(
      `| ${typeId} | ${mid} | ${r.eui.site.lo} to ${r.eui.site.hi} | ${b ? `${b.id} ${Math.round(b.low)} to ${Math.round(b.high)}` : 'none'} | ${Math.round(performance.now() - t0)} ms |`,
    );
  }
}
