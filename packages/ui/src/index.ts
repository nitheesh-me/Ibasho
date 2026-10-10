/**
 * @ibasho/ui: Andon in code (DESIGN_SYSTEM). Owner: WP-06. Layer L2 (imports L0 only).
 *
 * Styles are plain CSS: import `@ibasho/ui/andon.css` once at the app root (tokens, fonts, base
 * and component styles), or `@ibasho/ui/tokens.css` alone for tokens.
 */

// M-A and M-B kit (DESIGN_SYSTEM 8).
export {
  ChartFrame,
  type ChartFrameProps,
  TableAlt,
  type TableAltData,
  type TableCell,
} from './chart/TableAlt.tsx';
export { CheckLane, type CheckLaneProps, type CheckLaneRow } from './checklane/CheckLane.tsx';
export {
  EvidenceProvider,
  type EvidenceSource,
  staticEvidence,
  useEvidenceSource,
  useStaticEvidence,
} from './evidence/context.tsx';
export {
  FUEL_MON,
  FUEL_NAME,
  FUEL_TOKEN,
  FuelBars,
  type FuelBarsProps,
  type FuelRow,
  isSaving,
} from './fuel/FuelBars.tsx';
export {
  type DoNothingData,
  type DoNothingEffectRow,
  DoNothingLine,
  FUTURE_ORDER,
  FutureCard,
  type FutureCardData,
  type FutureFigure,
  type FutureKey,
  Futures,
  type FuturesProps,
} from './futures/Futures.tsx';
export {
  NEGATIVE_KIND_LABEL,
  type NegativeItem,
  Negatives,
  type NegativesProps,
  negativeItems,
  RISK_LABEL,
} from './futures/negatives.tsx';
export { BAKE_LIST, type BakedChar, Glyph, type GlyphProps } from './glyphs/index.ts';
export {
  GRADE_LABEL,
  GRADE_MEANING,
  GradeBadge,
  type GradeBadgeProps,
  isFlagged,
} from './grade/GradeBadge.tsx';
export {
  MEASURE_STATE_LABEL,
  MeasureCard,
  type MeasureCardProps,
  type MeasureState,
} from './measure/MeasureCard.tsx';
export { Mon, type MonProps } from './mon/Mon.tsx';
export { isMonId, MEASURE_MON, MONS, type MonId, monFor } from './mon/set.ts';
export {
  MONTH_NAME,
  MonthRing,
  type MonthRingProps,
  type MonthSeries,
  monthAt,
  monthKey,
} from './month/MonthRing.tsx';
export {
  type NarratorPart,
  type NarratorSentence,
  NarratorStrip,
  type NarratorStripProps,
  sentencesFromRendered,
} from './narrator/NarratorStrip.tsx';
export { type Dec, decFromString, decToString, roundSig, roundStep } from './num/decimal.ts';
export {
  DISPLAY,
  DISPLAY_AS,
  type DisplayAs,
  type FormatOptions,
  type Formatted,
  formatEvidence,
  MINUS,
  type NumPart,
} from './num/format.ts';
export { type Magnitude, magnitude, magnitudeOf } from './num/magnitude.ts';
export { Num, type NumProps } from './num/Num.tsx';
export { EpcChip, type EpcChipProps, epcLabel, epcSpread } from './score/EpcChip.tsx';
export {
  INDICATOR_NAME,
  SCORE_GROUPS,
  SCORE_LINE,
  type ScoreGroupId,
  ScoreGroups,
  type ScoreGroupsProps,
  type ScoreIndicatorId,
} from './score/ScoreGroups.tsx';
export { ClaimSeal, type ClaimSealProps } from './seal/ClaimSeal.tsx';
export {
  type CheckInfo,
  checkDetail,
  NOT_PROVED,
  type NumberSeal,
  RUNG_LABEL,
  SEAL_LABEL,
  type SealKind,
} from './seal/copy.ts';
export {
  type ClaimRef,
  type NumberSealProps,
  type ProvedSealProps,
  Seal,
  type SealProps,
  sealName,
} from './seal/Seal.tsx';
export type { SealSize } from './seal/SealMark.tsx';
export {
  nearestSnap,
  SHEET_SNAPS,
  Sheet,
  type SheetProps,
  type SheetSnap,
  SNAP_HEIGHT,
} from './sheet/Sheet.tsx';
export { Slider, type SliderProps, type SliderStop, sliderKey, stopAt } from './slider/Slider.tsx';
export {
  WHY_NOT_LABEL,
  WHY_NOT_ORDER,
  WhyNot,
  type WhyNotItem,
  type WhyNotProps,
  type WhyNotReason,
} from './whynot/WhyNot.tsx';
