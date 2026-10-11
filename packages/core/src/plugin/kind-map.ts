/**
 * Kind to interface map and the registry contract (ARCH 4.1). Owner: WP-00.
 */

import type { NarratorPlugin, PolarityLexiconPlugin, TemplatePackPlugin } from '../ai/provider.ts';
import type {
  ArchetypePlugin,
  CalibrationPlugin,
  CarbonPack,
  CarbonTrajectory,
  ClimatePack,
  ConstructionPlugin,
  EpcProxy,
  ExportTariffPlugin,
  FinancePlugin,
  GrantPlugin,
  IndicatorPlugin,
  MeasureCost,
  MeasureModel,
  PhysicsStage,
  RegionPlugin,
  RulePackPlugin,
  SearchStrategy,
  SystemPlugin,
  TariffPlugin,
  ThermalModel,
  ValueEvidencePlugin,
} from '../engine.ts';
import type { MaintenancePlugin } from '../maintenance.ts';
import type {
  CheckerRung,
  ExporterPlugin,
  ImporterPlugin,
  LocalePack,
  MeasureUi,
  RenderStylePlugin,
  VisualLayerPlugin,
} from '../ui.ts';
import type { BaselineBuilderPlugin, RatingSchemePlugin } from '../v3/codes.ts';
import type { AnalysisLensPlugin, EditorToolPlugin } from '../v3/lens.ts';
import type { MassingGeneratorPlugin } from '../v3/optimise.ts';
import type { DesignProposerPlugin } from '../v3/partner.ts';
import type { CityPackPlugin } from '../v3/place.ts';
import type { SiteMethodPlugin } from '../v3/site.ts';
import type { AnyStageProvider } from '../v3/stage.ts';
import type {
  BenchmarkPlugin,
  BuildingTypePlugin,
  SchedulePlugin,
  ShadePresetPlugin,
  SpaceTypePlugin,
  WindowProductPlugin,
} from '../v3/types.ts';
import type { PluginKind, Query } from './types.ts';

export interface PluginKindMap {
  region: RegionPlugin;
  climate: ClimatePack;
  construction: ConstructionPlugin;
  archetype: ArchetypePlugin;
  system: SystemPlugin;
  'physics-stage': PhysicsStage;
  'thermal-model': ThermalModel;
  measure: MeasureModel;
  'measure-cost': MeasureCost;
  tariff: TariffPlugin;
  'export-tariff': ExportTariffPlugin;
  carbon: CarbonPack;
  'carbon-trajectory': CarbonTrajectory;
  grant: GrantPlugin;
  finance: FinancePlugin;
  'value-evidence': ValueEvidencePlugin;
  'rule-pack': RulePackPlugin;
  indicator: IndicatorPlugin;
  'epc-proxy': EpcProxy;
  calibration: CalibrationPlugin;
  'search-strategy': SearchStrategy;
  importer: ImporterPlugin;
  maintenance: MaintenancePlugin;
  'measure-ui': MeasureUi;
  narrator: NarratorPlugin;
  'template-pack': TemplatePackPlugin;
  'polarity-lexicon': PolarityLexiconPlugin;
  'visual-layer': VisualLayerPlugin;
  'render-style': RenderStylePlugin;
  exporter: ExporterPlugin;
  locale: LocalePack;
  'checker-rung': CheckerRung;
  // v3 (ARCH 15.3)
  'building-type': BuildingTypePlugin;
  'space-type': SpaceTypePlugin;
  schedule: SchedulePlugin;
  'window-product': WindowProductPlugin;
  'shade-preset': ShadePresetPlugin;
  benchmark: BenchmarkPlugin;
  'rating-scheme': RatingSchemePlugin;
  'baseline-builder': BaselineBuilderPlugin;
  'stage-provider': AnyStageProvider;
  'site-method': SiteMethodPlugin;
  'city-pack': CityPackPlugin;
  'massing-generator': MassingGeneratorPlugin;
  'design-proposer': DesignProposerPlugin;
  'analysis-lens': AnalysisLensPlugin;
  'editor-tool': EditorToolPlugin;
}

export type PluginOf<K extends PluginKind> = PluginKindMap[K];
export type AnyPlugin = PluginKindMap[PluginKind];

/** A unit of plugins loaded together, e.g. one pack half. Its module's default export (ARCH 12). */
export interface IbashoModule {
  id: string;
  load(): AnyPlugin[] | Promise<AnyPlugin[]>;
}
export interface ModuleRef {
  id: string;
  /** Lazy import of a module whose default export is an `IbashoModule`. */
  load: () => Promise<{ default: IbashoModule }>;
}
/** Lives in `apps/web/src/manifest.ts`. Each thread loads its half. */
export interface ModuleManifest {
  engine: ModuleRef[];
  ui: ModuleRef[];
}

export interface PluginRegistry {
  /** Throws `RegistryError` on duplicate id or a failed per-plugin check. */
  register(p: AnyPlugin): void;
  /** Throws when absent or of another kind. */
  get<K extends PluginKind>(kind: K, id: string): PluginOf<K>;
  /** Sorted by id, stable. */
  all<K extends PluginKind>(kind: K, q?: Query): readonly PluginOf<K>[];
  has(id: string): boolean;
  /** sha256 of sorted `id@version` lines of the plugins matching `q`. */
  fingerprint(q?: Query): string;
  onChange(cb: () => void): () => void;
}
