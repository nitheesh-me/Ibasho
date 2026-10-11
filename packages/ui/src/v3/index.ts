/**
 * v3 studio kit (DESIGN_SYSTEM 13). Owner: WP-06.
 */

export { CompareGrid, type CompareSlot, type FilmFrame, FilmStrip } from './Compare.tsx';
export {
  Menu,
  type MenuItem,
  type MenuProps,
  Picker,
  type PickerOption,
  type PickerProps,
  Range,
  type RangeProps,
  SunScrubber,
  type SunScrubberProps,
} from './Controls.tsx';
export {
  MODE_KEY,
  MODE_LABEL,
  MODE_LINE,
  ModeTabs,
  type ModeTabsProps,
  SCALE_LABEL,
  SCALE_LEVELS,
  ScaleLadder,
  type ScaleLadderProps,
  type ScaleLevel,
  STUDIO_MODES,
  type StudioMode,
  stepLevel,
} from './Ladder.tsx';
export {
  ChoiceChips,
  LedgerRow,
  type LedgerRowProps,
  ORIGIN_LABEL,
  SCOPE_LABEL,
  Stepper,
  type StepperProps,
} from './Ledger.tsx';
export {
  AnalysisLegend,
  type AnalysisLegendProps,
  Histogram,
  LensPanel,
  type LensPanelProps,
  RESOLUTION_LABEL,
} from './Lens.tsx';
export {
  APPLICABILITY_LABEL,
  ApplicabilityChip,
  PREVIEW_LINE,
  PreviewStamp,
  Stale,
  type StaleProps,
  TierCaption,
} from './Preview.tsx';
export {
  END_USE_LABEL,
  EndUseBar,
  type EndUseBarProps,
  EuiGauge,
  type EuiGaugeProps,
  type LadderRow,
  RatingLadder,
  type RatingLadderProps,
  type StepState,
  stepState,
} from './Results.tsx';
export { LENS_RAMP, RAMPS, type RampDef, type RampName, rampColor, rampGradient } from './ramps.ts';
export { overallFraction, STAGE_LABEL, StageBar, type StageBarProps } from './StageBar.tsx';
export {
  ScheduleStrip,
  TYPE_INFO,
  TypeCard,
  type TypeCardProps,
  TypeCards,
  type TypeInfo,
} from './Types.tsx';
