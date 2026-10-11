/**
 * The eight building types (R25) for India: space mix, system archetypes, code classes,
 * benchmarks, floor to floor and end-use priors (per mille of site EUI, from the BT brief and
 * BEE benchmark studies; estimates). `lab` is a placeholder until a sourced profile lands (R25).
 */
import type { BuildingTypeId, BuildingTypePlugin } from '@ibasho/core';
import { PROV } from './sources.ts';

const T = (
  typeId: BuildingTypeId,
  mon: string,
  spaceMix: [string, number][],
  systems: string[],
  benchmarkIds: string[],
  codeClasses: Record<string, string>,
  f2f: number,
  priors: Record<string, [number, number]>,
  placeholder?: true,
): BuildingTypePlugin => ({
  kind: 'building-type',
  id: `types-in-type-${typeId}`,
  version: '0.1.0',
  title: `types.building.${typeId}`,
  side: 'both',
  regions: ['IN'],
  provenance: PROV,
  typeId,
  label: `types.building.${typeId}`,
  mon,
  spaceMix: spaceMix.map(([spaceTypeId, perMille]) => ({ spaceTypeId, perMille })),
  systemArchetypes: systems,
  benchmarkIds,
  codeClasses,
  defaultFloorToFloorMm: f2f,
  endUsePriors: priors,
  ...(placeholder ? { placeholder } : {}),
});

export const BUILDING_TYPES_IN: BuildingTypePlugin[] = [
  T('office', 'office', [['office-open', 600], ['office', 150], ['lobby', 50], ['circulation', 120], ['toilet-core', 50], ['plant', 30]], ['chilled-water', 'vrf'], ['bee-office-composite', 'cbecs-office'], { ecbc: 'business-daytime', a901: 'office' }, 4000, {
    cooling: [400, 600],
    lighting: [120, 220],
    equipment: [150, 300],
    fans: [50, 120],
    pumps: [20, 60],
  }),
  T('hotel', 'hotel', [['guest-room', 600], ['lobby', 100], ['kitchen', 50], ['circulation', 150], ['plant', 100]], ['chilled-water', 'vrf'], ['cbecs-hotel'], { ecbc: 'hospitality', a901: 'hotel' }, 3300, {
    cooling: [350, 550],
    'hot-water': [80, 200],
    lighting: [80, 160],
    equipment: [100, 200],
  }),
  T('education', 'education', [['classroom', 450], ['office', 150], ['library', 50], ['lab', 100], ['circulation', 200], ['toilet-core', 50]], ['split', 'chilled-water'], ['cbecs-education'], { ecbc: 'educational', a901: 'school' }, 3900, {
    cooling: [300, 550],
    lighting: [150, 300],
    equipment: [100, 250],
    fans: [50, 150],
  }),
  T('hospital', 'hospital', [['ward', 500], ['office', 100], ['lab', 100], ['lobby', 50], ['circulation', 200], ['plant', 50]], ['chilled-water'], ['bee-hospital-composite', 'cbecs-hospital'], { ecbc: 'healthcare', a901: 'hospital' }, 4200, {
    cooling: [350, 550],
    'hot-water': [50, 150],
    equipment: [150, 300],
    lighting: [80, 160],
  }),
  T('lab', 'lab', [['lab', 600], ['office', 200], ['circulation', 150], ['plant', 50]], ['chilled-water'], ['cbecs-lab'], { ecbc: 'business-24h', a901: 'laboratory' }, 4200, { cooling: [350, 600], equipment: [200, 400], fans: [100, 250] }, true),
  T('apartments', 'apartments', [['living', 400], ['bedroom', 400], ['kitchen', 100], ['stair', 100]], ['split'], ['ens-apartments'], { ens: 'residential', a901: 'multifamily' }, 3000, {
    cooling: [200, 450],
    lighting: [100, 250],
    equipment: [200, 400],
    'hot-water': [50, 250],
  }),
  T('rental', 'rental', [['living', 400], ['bedroom', 400], ['kitchen', 100], ['stair', 100]], ['split'], ['ens-apartments'], { ens: 'residential', a901: 'multifamily' }, 3000, {
    cooling: [200, 450],
    lighting: [100, 250],
    equipment: [200, 400],
    'hot-water': [50, 250],
  }),
  T('single-family', 'single-family', [['living', 450], ['bedroom', 450], ['kitchen', 100]], ['split'], ['ens-apartments'], { ens: 'residential', a901: 'single-family' }, 3000, {
    cooling: [200, 450],
    lighting: [100, 250],
    equipment: [200, 400],
    'hot-water': [50, 250],
  }),
];
