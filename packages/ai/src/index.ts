/**
 * @ibasho/ai (WP-05): grounded narration, typed ops and the memory domain (AM, SPEC 10).
 * Layer L2: imports L0 only (core), plus `zod` and the `ollama` browser client.
 */

export {
  type BuiltBundle,
  type BundleInput,
  BundleError,
  buildBundle,
  bundleSeed,
  type DerivedEntry,
  type NodeEntry,
  type RoleMap,
} from './evidence/bundle.ts';
export { buildStory, type StorySpec, StorySpecSchema } from './evidence/spec.ts';
export { type Decimal, DecimalError, parseDecimal, roundToSig, roundToStep, toDecimal } from './grounding/decimal.ts';
export { formatItem, type SlotModifier } from './grounding/format.ts';
export { type GroundOptions, groundDraft, type Repairer, type RepairRequest, renderTemplate } from './grounding/ground.ts';
export { NUMBER_WORDS, POLARITY_EN_GB } from './grounding/lexicon.ts';
export { nodesToString, RenderError, type RenderOptions, renderText } from './grounding/render.ts';
export { SentenceBuffer, type Sentence, sentences } from './grounding/sentences.ts';
export { maskSlots, type SlotKind, type SlotToken, slot, type Token, tokenize } from './grounding/slots.ts';
export { activeRejections, type ValidateOptions, validateSection } from './grounding/validate.ts';
export { MEASURE_CATALOGUE, type MeasureEntry, measureName, measureOf } from './measures.ts';
export { InMemoryMemoryRepo, MEMORY_EXPORT_SCHEMA } from './memory/repo.ts';
export {
  COMPOST_DAYS,
  checkWritePolicy,
  daysSinceLastVisit,
  digestOf,
  emptyPreferences,
  MemoryPolicyError,
  offerable,
  preferencesOf,
  purgeCompost,
  rejectionActive,
  resolve,
  searchMemory,
  seedsOf,
  selects,
  visitsOf,
} from './memory/views.ts';
export { EN_GB } from './narrator/en-gb.ts';
export {
  CHAPTERS,
  type ChapterCode,
  narrateSection,
  narrateTemplate,
  PICK_NAMES,
  PICKS,
  type PickKey,
  type SectionRequest,
  type Story,
  type StoryContext,
  TemplateError,
  type WhyNotReason,
} from './narrator/template.ts';
export {
  extractFacts,
  factsJsonSchema,
  type InjectionFlag,
  injectionFlags,
  OwnerFactsSchema,
  QUOTE_MAX,
  type QuarantineResult,
  sanitiseFacts,
} from './notes/quarantine.ts';
export { type IntentResult, parseIntent } from './ops/intent.ts';
export {
  type CatalogueMeasure,
  catalogueFromModels,
  DEFAULT_PARAMS,
  DEFAULT_TARIFFS,
  defaultCatalogue,
  type OpCatalogue,
  type OpContext,
  opPlanJsonSchema,
  validateOps,
} from './ops/validator.ts';
export {
  ConsentRequiredError,
  type LedgerEntry,
  LOCALITY_BADGE,
  type Locality,
  OutboundLedger,
} from './providers/ledger.ts';
export {
  type FetchLike,
  OLLAMA_DEFAULT_HOST,
  OLLAMA_SUGGESTED_MODELS,
  OllamaError,
  type OllamaOptions,
  OllamaProvider,
  type RepairCapable,
} from './providers/ollama.ts';
export {
  DATAMARK,
  datamark,
  type NarrationPayload,
  narrationPayload,
  narrationSchema,
  narratorSystemPrompt,
} from './providers/payload.ts';
export { type NarrateResult, NarratorRouter, type ProviderInfo, type RouterOptions } from './providers/router.ts';
export { TemplateProvider } from './providers/template-provider.ts';
