/**
 * @ibasho/content: the words. Owner: WP-09. Layer L0 data (imports core only).
 *
 * Measure guidance (disruption, next step) keyed by the ids in `packs/home-uk/src/ids.ts`,
 * the glossary, the voice guide and its checkers, the landing chapters with `requires`, the
 * intro copy for "What we prove", v3 studio microcopy and building type copy.
 */
export {
  BUILDING_TYPE_COPY,
  type BuildingTypeCopy,
  countOf,
  roomLabel,
  typeLabel,
} from './building-types.ts';
export { type CopyItem, collectCopy } from './copy.ts';
export { definitionOf, GLOSSARY, GLOSSARY_IDS, termOf } from './glossary.ts';
export {
  type ChapterGlyph,
  LANDING_AUDIENCE_INTRO,
  LANDING_AUDIENCES,
  LANDING_CHAPTERS,
  LANDING_FOOTER,
  LANDING_HERO_CAPTION,
  LANDING_INVITATION,
  LANDING_META,
  LANDING_TAGLINE,
  type LandingAudience,
  type LandingChapter,
  STUDIO_LINKS,
  visibleChapters,
} from './landing/chapters.ts';
export {
  missingRequirements,
  needsPreview,
  type PluginPresence,
  parseRequirement,
  presenceFromList,
  presenceOf,
  type Requirement,
  requirementMet,
  stageImplOf,
} from './landing/requires.ts';
export { hasMalformedMark, markedTerms, plainText, type Segment, segments } from './marks.ts';
export { ACCREDITATION_SOURCES, ACCREDITATIONS } from './measures/accreditations.ts';
export {
  ASSESSMENT_GUIDANCE,
  GUIDED_ASSESSMENT_IDS,
  type GuidedAssessmentId,
} from './measures/assessments.ts';
export {
  GUIDED_MEASURE_IDS,
  type GuidedMeasureId,
  guidanceFor,
  MEASURE_GUIDANCE,
} from './measures/guidance.ts';
export { PROOFS_INTRO, type ProofsIntro } from './proofs.ts';
export {
  APPLICABILITY_COPY,
  GAP_COPY,
  GOAL_PRESET_COPY,
  OBJECTIVE_COPY,
  PRECHECK_WORD,
  RATING_COPY,
  STAGE_COPY,
  STAGE_STATUS_WORD,
  type StageCopy,
  STUDIO_COPY,
  TIER_WORD,
} from './studio.ts';
export type {
  Accreditation,
  AccreditationId,
  AssessmentGuidance,
  DayRange,
  Disruption,
  GlossaryEntry,
  MeasureGuidance,
  Mess,
  NextStep,
  StayIn,
} from './types.ts';
export {
  BANNED,
  checkCustomerCopy,
  checkVoice,
  DEV_ARTEFACTS,
  MAX_SENTENCE_WORDS,
  sentences,
  VOICE,
  type VoiceFinding,
  type VoiceGuide,
  type VoicePair,
} from './voice.ts';
