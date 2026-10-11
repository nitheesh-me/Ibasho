/**
 * Analysis lenses and editor tools: UI plugins (ARCH 15.3, SPEC 20, 21, UV 5, 6).
 * Owner: WP-00 (contract); WP-07 implements lenses, WP-15 editor tools.
 *
 * A lens is a visual layer with one shared panel: What, When, Where, How fine, Result, Inspect.
 * Its legend states unit, resolution, period, method and "Modelled", and shows the Preview stamp
 * whenever the result it paints came from a Preview provider (AC-LK2, AC-PG3).
 */
import type { MessageKey } from '../common.ts';
import type { EvidenceId, QuantityId } from '../evidence/types.ts';
import type { PluginBase } from '../plugin/types.ts';
import type { Component, QualityTier, SceneHit } from '../ui.ts';
import type { CompiledBuilding, Mm } from './building.ts';
import type { ResultStamp } from './provenance.ts';
import type { BuildingResult } from './result.ts';
import type { Resolution, SiteResult } from './site.ts';

export type LensId =
  | 'shadows'
  | 'sun-hours'
  | 'radiation'
  | 'daylight'
  | 'glare'
  | 'views'
  | 'thermal'
  | 'neighbours'
  | (string & {});

/** One continuous ramp on screen at a time (DESIGN_SYSTEM 13). */
export type RampId = 'sun' | 'heat' | 'daylight' | 'diverging' | 'comfort' | (string & {});

export interface LensPeriod {
  kind: 'instant' | 'day' | 'month' | 'year';
  /** ISO date-time for an instant, date for a day, month index for a month. */
  at?: string | number;
}

/** What a lens paints from. Either result may be absent while stages run. */
export interface LensProps {
  compiled: CompiledBuilding | null;
  site: SiteResult | null;
  result: BuildingResult | null;
  /** Stamp of the result being painted; drives the Preview stamp in the legend. */
  stamp: ResultStamp | null;
  resolution: Resolution;
  period: LensPeriod;
  reducedMotion: boolean;
  tier: QualityTier;
  /** Compare: a second result for the difference view (refused across resolutions, AC-W6). */
  against?: { site: SiteResult | null; result: BuildingResult | null };
}

export interface LensLegendProps {
  stamp: ResultStamp | null;
  resolution: Resolution;
  period: LensPeriod;
  /** Domain of the ramp, in `unit`. */
  domain: [number, number];
}

export interface AnalysisLensPlugin extends PluginBase<'analysis-lens'> {
  lensId: LensId;
  label: MessageKey;
  unit: string;
  ramp: RampId;
  /** Method line for the legend (e.g. "Ray cast, 15 min steps, Modelled"). */
  method: MessageKey;
  quantities: QuantityId[];
  resolutions: Resolution['level'][];
  periods: LensPeriod['kind'][];
  /** Painted in the scene. */
  Layer: Component<LensProps>;
  ReducedMotion: Component<LensProps>;
  /** Plan (SVG) rendering, for the editor and for no-WebGL. */
  Svg?: Component<LensProps>;
  Legend: Component<LensLegendProps>;
  /** Histogram, three key numbers and a table (TableAlt). */
  Panel: Component<LensProps>;
  evidenceAt(hit: SceneHit, props: LensProps): EvidenceId | undefined;
  budget: { drawCalls: number; triangles: number };
}

/** Editor depths (SPEC 20). */
export type EditorDepth = 'massing' | 'plan' | 'detail';

/** Pointer in plan millimetres, after snapping. */
export interface PlanPointer {
  x: Mm;
  y: Mm;
  snapped: 'grid' | 'angle' | 'edge' | 'context' | 'plot' | 'none';
  pointerType: 'mouse' | 'pen' | 'touch' | 'keyboard';
  shift: boolean;
  alt: boolean;
}

/** A Make tool: a keyboard key, pointer handlers and an outline path (AC-ED3, AC-ED4). */
export interface EditorToolPlugin extends PluginBase<'editor-tool'> {
  toolId: string;
  label: MessageKey;
  /** Single key that selects the tool (desktop keyboard map). */
  key: string;
  /** Mon or icon id. */
  icon: string;
  depths: EditorDepth[];
  /** Path in the non-visual plan outline that reaches the tool's actions. */
  outlinePath: string;
  /** Phone (360 px): a button for every drag. */
  phoneActions: { id: string; label: MessageKey }[];
  /** Handlers return an opaque command for the editor's history (Immer patches). */
  onPointerDown?(p: PlanPointer): unknown;
  onPointerMove?(p: PlanPointer): unknown;
  onPointerUp?(p: PlanPointer): unknown;
  /** A typed number while dragging sets the current dimension (mm). */
  onTypedValue?(mm: Mm): unknown;
}
