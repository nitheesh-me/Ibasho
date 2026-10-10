/**
 * Plugin model (ARCH 4.1). Owner: WP-00.
 */
import type { Grade, IsoDate, MessageKey, Provenance, RegionCode, SemVer } from '../common.ts';

export type EnginePluginKind =
  | 'region'
  | 'climate'
  | 'construction'
  | 'archetype'
  | 'system'
  | 'physics-stage'
  | 'thermal-model'
  | 'measure'
  | 'measure-cost'
  | 'tariff'
  | 'export-tariff'
  | 'carbon'
  | 'carbon-trajectory'
  | 'grant'
  | 'finance'
  | 'value-evidence'
  | 'rule-pack'
  | 'indicator'
  | 'epc-proxy'
  | 'calibration'
  | 'search-strategy'
  | 'importer'
  | 'maintenance';
export type UiPluginKind =
  | 'measure-ui'
  | 'narrator'
  | 'template-pack'
  | 'polarity-lexicon'
  | 'visual-layer'
  | 'render-style'
  | 'exporter'
  | 'locale'
  | 'checker-rung';
export type PluginKind = EnginePluginKind | UiPluginKind;

export const ENGINE_PLUGIN_KINDS: readonly EnginePluginKind[] = [
  'region',
  'climate',
  'construction',
  'archetype',
  'system',
  'physics-stage',
  'thermal-model',
  'measure',
  'measure-cost',
  'tariff',
  'export-tariff',
  'carbon',
  'carbon-trajectory',
  'grant',
  'finance',
  'value-evidence',
  'rule-pack',
  'indicator',
  'epc-proxy',
  'calibration',
  'search-strategy',
  'importer',
  'maintenance',
];
export const UI_PLUGIN_KINDS: readonly UiPluginKind[] = [
  'measure-ui',
  'narrator',
  'template-pack',
  'polarity-lexicon',
  'visual-layer',
  'render-style',
  'exporter',
  'locale',
  'checker-rung',
];
export const PLUGIN_KINDS: readonly PluginKind[] = [...ENGINE_PLUGIN_KINDS, ...UI_PLUGIN_KINDS];

/**
 * Kinds that carry numbers and therefore must carry provenance (registry check "Provenance").
 * Code-only kinds (stages, models, strategies, importers, UI components) are exempt.
 */
export const NUMERIC_PLUGIN_KINDS: ReadonlySet<PluginKind> = new Set<PluginKind>([
  'region',
  'climate',
  'construction',
  'archetype',
  'system',
  'measure',
  'measure-cost',
  'tariff',
  'export-tariff',
  'carbon',
  'carbon-trajectory',
  'grant',
  'finance',
  'value-evidence',
  'rule-pack',
  'indicator',
  'epc-proxy',
  'maintenance',
]);

export interface PluginBase<K extends PluginKind> {
  kind: K;
  id: string;
  version: SemVer;
  title: MessageKey;
  regions?: RegionCode[];
  validFrom?: IsoDate;
  validTo?: IsoDate;
  provenance?: Provenance;
  requires?: string[];
  /** 'both' only for pure data plugins (they are compared across threads at boot). */
  side: 'engine' | 'ui' | 'both';
}

export interface Query {
  region?: RegionCode;
  asOf?: IsoDate;
  ids?: string[];
  side?: 'engine' | 'ui' | 'both';
}

/** True when a grade must show a visible badge (R17). */
export function gradeNeedsBadge(g: Grade): boolean {
  return g === 'estimate' || g === 'announced';
}
