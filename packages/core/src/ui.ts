/**
 * UI-side plugins and typed modules (ARCH 5.6). Owner: WP-00.
 *
 * Core is layer L0 and cannot import React or three.js, so component and hit types are
 * structural: any `React.FC<P>` is assignable to `Component<P>`, and any `THREE.Intersection`
 * is assignable to `SceneHit`.
 */

import type { SearchResult } from './api.ts';
import type { Certificate } from './certificate.ts';
import type { IsoDate, MessageKey } from './common.ts';
import type { CheckerRungId, CheckId, EvidenceId, QuantityId } from './evidence/types.ts';
import type { PluginBase } from './plugin/types.ts';
import type { HomeTwin, MeterData } from './twin.ts';
import type { BuildingDoc, CompiledBuilding } from './v3/building.ts';
import type { ContextBuilding } from './v3/place.ts';
import type { BuildingResult } from './v3/result.ts';

/** Structural stand-in for `React.FC<P>`. */
export type Component<P> = (props: P) => unknown;

/** Structural stand-in for `THREE.Intersection`. */
export interface SceneHit {
  distance: number;
  point: { x: number; y: number; z: number };
  object: { userData: Record<string, unknown> };
  instanceId?: number;
}

/** Structural stand-in for `Blob` (core has no DOM lib). */
export interface BlobLike {
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

export type QualityTier = 0 | 1 | 2 | 3;

export interface LayerProps {
  result: SearchResult | null;
  packageIdx?: number;
  reducedMotion: boolean;
  tier: QualityTier;
}
export interface LegendProps {
  result: SearchResult | null;
  packageIdx?: number;
}

export interface VisualLayerPlugin extends PluginBase<'visual-layer'> {
  layerId: string;
  /** Quantities this layer reads. Distinct from `PluginBase.requires` (plugin ids). */
  quantities: QuantityId[];
  encodesNumbers: boolean;
  /** Animated, drawn over the still-life frame. */
  Overlay: Component<LayerProps>;
  ReducedMotion: Component<LayerProps>;
  Svg?: Component<LayerProps>;
  Legend?: Component<LegendProps>;
  evidenceAt?(hit: SceneHit, res: SearchResult): EvidenceId | undefined;
  budget: { drawCalls: number; triangles: number; particles?: number };
}

export interface RenderStylePlugin extends PluginBase<'render-style'> {
  styleId: 'washi' | 'yoru' | (string & {});
  Bake: Component<Record<string, never>>;
  Live: Component<Record<string, never>>;
  tier: QualityTier;
}

export interface ExportCtx {
  homeId: string;
  twin: HomeTwin;
  result?: SearchResult;
  locale: string;
  /** v3 building formats (gbXML, epJSON, Dragonfly, GeoJSON, IFC). */
  building?: BuildingDoc;
  compiled?: CompiledBuilding;
  buildingResult?: BuildingResult;
}
export interface ExporterPlugin extends PluginBase<'exporter'> {
  format: 'ibasho' | 'pdf' | 'csv' | 'letter' | 'gbxml' | 'epjson' | 'dragonfly' | 'geojson' | 'ifc';
  export(ctx: ExportCtx): Promise<BlobLike>;
}

/** What a v3 building importer returns: a document draft and what the person must confirm. */
export interface BuildingImport {
  doc?: Partial<BuildingDoc>;
  context?: ContextBuilding[];
  /** Proposals (trace assist): rooms, walls or storeys the person confirms one by one (SPEC 20). */
  proposals: { id: string; kind: 'room' | 'wall' | 'storey' | 'scale'; confidence: number; data: unknown }[];
  warnings: string[];
}
export interface ImporterPlugin extends PluginBase<'importer'> {
  /** MIME types or extensions. */
  accepts: string[];
  parse(file: BlobLike): Promise<MeterData | Partial<HomeTwin>>;
  /** v3 (ARCH 15.3): building formats (PDF trace, OSM, GeoJSON, gbXML, IFC). */
  parseBuilding?(file: BlobLike): Promise<BuildingImport>;
}

export interface FontRef {
  family: string;
  weights: number[];
  unicodeRange?: string;
}
export interface LocalePack extends PluginBase<'locale'> {
  locale: string;
  messages: Record<MessageKey, string>;
  fonts?: FontRef[];
}

export interface Verdict {
  check: CheckId;
  ok: boolean;
  rung: CheckerRungId;
  coverage: 'all' | 'sample';
  /** Package row the verdict is about, when the check is per package. */
  packageIdx?: number;
  detail?: string;
}
export interface CheckerRung extends PluginBase<'checker-rung'> {
  rung: CheckerRungId;
  available(): Promise<boolean>;
  check(cert: Certificate, scope: 'all' | 'sample'): Promise<Verdict[]>;
}

/** Mon (family crest) icon id from the `packages/ui` icon set. */
export type MonId = string;
/** How a measure folds onto the house in the fold-assembly layer (WP-07 refines). */
export interface FoldSpec {
  kind: 'wrap' | 'lay' | 'slide' | 'swap' | 'mount';
  /** Element kinds the fold lands on. */
  targets: string[];
  durationMs: number;
}
export interface MeasureUi extends PluginBase<'measure-ui'> {
  measureId: string;
  mon: MonId;
  fold: FoldSpec;
}

// ---------------------------------------------------------------------------------------------
// Typed modules (not plugins: they never vary at runtime)

export type ChapterId = 'home' | 'leaks' | 'futures' | 'fit' | 'after' | (string & {});
export interface Chapter {
  id: ChapterId;
  title: MessageKey;
  order: number;
  /** Target beat length in seconds (VISION 5). */
  beatS: number;
}
export interface OnboardingStep {
  id: string;
  title: MessageKey;
  /** Budgeted time for the step (onboarding total 120 s). */
  timeCostS: number;
}
export interface Panel {
  id: string;
  title: MessageKey;
  zone: 'stage' | 'sheet' | 'drawer' | 'strip';
}
export interface Migration {
  from: number;
  to: number;
  description: string;
  run(db: unknown): Promise<void>;
}
/** T5. */
export interface SoundCue {
  id: string;
  src: string;
  at: IsoDate | 'chapter' | 'seal';
}
