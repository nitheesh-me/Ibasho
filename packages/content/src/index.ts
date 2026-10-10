/**
 * @ibasho/content: the words. Owner: WP-09. Layer L0 data (imports core only).
 *
 * Measure guidance (disruption, next step) keyed by the ids in `packs/home-uk/src/ids.ts`,
 * the glossary, the voice guide and its checker, the landing chapters with `requires`, and the
 * intro copy for "What we prove".
 */
export { type CopyItem, collectCopy } from './copy.ts';
export { definitionOf, GLOSSARY, GLOSSARY_IDS, termOf } from './glossary.ts';
export {
  type ChapterGlyph,
  LANDING_CHAPTERS,
  LANDING_INVITATION,
  LANDING_META,
  type LandingChapter,
  visibleChapters,
} from './landing/chapters.ts';
export {
  missingRequirements,
  type PluginPresence,
  parseRequirement,
  presenceFromList,
  presenceOf,
  type Requirement,
  requirementMet,
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
  checkVoice,
  MAX_SENTENCE_WORDS,
  sentences,
  VOICE,
  type VoiceFinding,
  type VoiceGuide,
  type VoicePair,
} from './voice.ts';
