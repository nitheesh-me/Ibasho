/**
 * Building types, space types, schedules, window products, shade presets and benchmarks
 * (ARCH 15.3, SPEC R25, TE 3 and 4, TE 11). Owner: WP-00 (contract); WP-18 fills the packs.
 * All are pure data plugins (`side: 'both'`): no functions.
 */
import type { Grade, MessageKey, SourceRef } from '../common.ts';
import type { PluginBase } from '../plugin/types.ts';
import type { BuildingTypeId, ShadeRule } from './building.ts';

/** A sourced value with a low, typical and high (unknown is a range, not zero). */
export interface Sourced<T = number> {
  low: T;
  typical: T;
  high: T;
  source: SourceRef;
  grade: Grade;
}

/** 24 hourly fractions in [0, 1] for each of weekday, Saturday, Sunday or holiday. */
export interface Schedule24x3 {
  weekday: readonly number[];
  saturday: readonly number[];
  sunday: readonly number[];
}

export interface SchedulePlugin extends PluginBase<'schedule'> {
  scheduleId: string;
  use: 'occupancy' | 'lighting' | 'equipment' | 'hvac' | 'dhw' | 'setpoint';
  profile: Schedule24x3;
}

export interface SpaceTypePlugin extends PluginBase<'space-type'> {
  spaceTypeId: string;
  label: MessageKey;
  conditioned: boolean;
  habitable: boolean;
  /** Outdoor air per person (L/s) and per area (L/s·m²), ASHRAE 62.1 style. */
  rpLsPerPerson: Sourced;
  raLsPerM2: Sourced;
  densityPer100m2: Sourced;
  lpdWm2: Sourced;
  epdWm2: Sourced;
  coolSetC: Sourced;
  heatSetC: Sourced;
  dhwLPerPersonDay: Sourced | 'unknown';
  /** Daylight target, lux on the work plane. */
  daylightLux?: Sourced;
  schedules: { occupancy: string; lighting: string; equipment: string; hvac: string; dhw?: string };
}

export interface BuildingTypePlugin extends PluginBase<'building-type'> {
  typeId: BuildingTypeId;
  label: MessageKey;
  /** Mon (crest) id from the UI icon set. */
  mon: string;
  spaceMix: { spaceTypeId: string; perMille: number }[];
  systemArchetypes: string[];
  benchmarkIds: string[];
  /** Code classes per scheme (EC 6), e.g. `{ ecbc: 'business-daytime', a901: 'office' }`. */
  codeClasses: Record<string, string>;
  defaultFloorToFloorMm: number;
  /** Per end use, share of site EUI as a per mille range [lo, hi]. */
  endUsePriors: Partial<Record<string, [number, number]>>;
  /** True for `lab` until a sourced profile lands (R25). */
  placeholder?: true;
}

export interface WindowProductPlugin extends PluginBase<'window-product'> {
  productId: string;
  label: MessageKey;
  uWm2K: Sourced;
  /** Solar heat gain coefficient (g). */
  g: Sourced;
  vlt: Sourced;
  frameFactor: Sourced;
  /** Installed cost per m² in the minor unit of `currency` (micro-paise or micro-pence) as decimal strings. */
  cost?: { currency: 'INR' | 'GBP'; perM2: Sourced<string> };
}

export interface ShadePresetPlugin extends PluginBase<'shade-preset'> {
  presetId: 'chajja' | 'jaali' | 'verandah' | 'courtyard' | 'cool-roof' | (string & {});
  label: MessageKey;
  /** The rule the preset expands to, or a roof finish for cool roofs. */
  rule: ShadeRule | { kind: 'roof-finish'; reflectancePm: number; emittancePm: number };
  /** Visible and solar transmittance multipliers for screens, per mille. */
  transmittancePm?: Sourced;
}

export interface BenchmarkPlugin extends PluginBase<'benchmark'> {
  benchmarkId: string;
  scheme: 'energy-star' | 'cibse-tm46' | 'bee-star' | 'ecbc' | (string & {});
  typeIds: BuildingTypeId[];
  basis: 'site' | 'source';
  /** kWh/m²·yr. A median, a band ladder, or both. */
  median?: Sourced;
  bands?: { label: string; maxKwhM2Yr: number }[];
}

/**
 * The type data an energy model reads, gathered from the type packs (`types-in`, `types-global`)
 * by the app's manifest. Later packs override earlier ones by id.
 */
export interface TypeLibrary {
  spaceTypes: SpaceTypePlugin[];
  schedules: SchedulePlugin[];
  buildingTypes: BuildingTypePlugin[];
  benchmarks?: BenchmarkPlugin[];
}

/** Merge libraries: entries with the same id in a later library replace earlier ones. */
export function mergeTypeLibraries(...libs: TypeLibrary[]): TypeLibrary {
  const by = <T>(key: (x: T) => string, lists: T[][]): T[] => {
    const m = new Map<string, T>();
    for (const l of lists) for (const x of l) m.set(key(x), x);
    return [...m.values()];
  };
  return {
    spaceTypes: by((x: SpaceTypePlugin) => x.spaceTypeId, libs.map((l) => l.spaceTypes)),
    schedules: by((x: SchedulePlugin) => x.scheduleId, libs.map((l) => l.schedules)),
    buildingTypes: by((x: BuildingTypePlugin) => x.typeId, libs.map((l) => l.buildingTypes)),
    benchmarks: by((x: BenchmarkPlugin) => x.benchmarkId, libs.map((l) => l.benchmarks ?? [])),
  };
}
