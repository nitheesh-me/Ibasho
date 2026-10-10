/**
 * Narrator provider plugins (AM 4.1). Owner: WP-00 (contract); WP-05 implements.
 * The AM brief's own `PluginRegistry` is renamed `NarratorRegistry` here to avoid clashing with
 * the kernel registry (ARCH 4.1).
 */
import type { PluginBase } from '../plugin/types.ts';
import type { MemoryDigest } from './memory.ts';
import type { EvidenceBundle, OwnerFact, SectionKey } from './narration.ts';
import type { OpPlan } from './ops.ts';

/** Structural stand-in for `AbortSignal` (core has no DOM lib); a real `AbortSignal` satisfies it. */
export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

export interface ProviderCapabilities {
  locality: 'device' | 'localhost' | 'cloud';
  structuredOutput: 'json-schema' | 'json' | 'none';
  toolUse: 'native' | 'schema-ops' | 'none';
  streaming: boolean;
  contextTokens: number;
  approxDownloadMB?: number;
  /** Estimated from prompt size. */
  costPerNarrationUSD?: number;
}

export type ProviderStatus =
  | { state: 'unavailable'; reason: string }
  | { state: 'needs-consent'; downloadMB: number }
  | { state: 'downloading'; progress: number }
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'error'; error: string };

export type Voice = 'warm' | 'plain' | 'storyteller';

export interface NarrationRequest {
  bundle: EvidenceBundle;
  sections: SectionKey[];
  /** Template narrator output to polish. */
  skeleton: Partial<Record<SectionKey, string>>;
  question?: string;
  voice: Voice;
  maxTokens: number;
}
export type NarrationChunk =
  | { section: SectionKey; delta: string }
  | { done: true; usage?: { in: number; out: number } };

export interface PlanRequest {
  utterance: string;
  bundle: EvidenceBundle;
  memory: MemoryDigest;
  /** JSON Schema of the allowed ops, compiled per backend. */
  opSchema: unknown;
}

/** Raw note text. Only `extractFacts` ever sees it (AM 5). */
export interface QuarantinedNote {
  id: string;
  text: string;
  origin: 'owner' | 'previous-owner' | 'listing' | 'survey' | 'epc';
}

export interface NarratorProvider {
  /** 'template' | 'ollama' | 'webllm' | 'claude' | 'chrome-ai' | plugin ids. */
  id: string;
  displayName: string;
  probe(signal?: AbortSignalLike): Promise<ProviderStatus>;
  capabilities(): ProviderCapabilities;
  prepare?(onProgress: (p: number) => void, signal?: AbortSignalLike): Promise<void>;
  narrate(req: NarrationRequest, signal?: AbortSignalLike): AsyncIterable<NarrationChunk>;
  planOps?(req: PlanRequest, signal?: AbortSignalLike): Promise<OpPlan>;
  extractFacts?(note: QuarantinedNote, signal?: AbortSignalLike): Promise<OwnerFact[]>;
  dispose?(): Promise<void>;
}

/** Templates keyed by evidence kind and section, with seeded variants. */
export interface TemplatePack {
  locale: string;
  templates: Record<string, string[]>;
}
/** Verbs that require a given sign near a slot (validator G3). */
export interface PolarityLexicon {
  saving: string[];
  increase: string[];
}
export interface OpSchemaContribution {
  measureId: string;
  params: Record<string, { type: 'number' | 'string'; min?: number; max?: number; enum?: string[] }>;
}

export interface NarratorRegistry {
  addProvider(p: NarratorProvider): void;
  addTemplates(pack: TemplatePack): void;
  addOpSchema(s: OpSchemaContribution): void;
  addPolarityLexicon(locale: string, lex: PolarityLexicon): void;
}

export interface NarratorPlugin extends PluginBase<'narrator'> {
  provider: NarratorProvider;
}
export interface TemplatePackPlugin extends PluginBase<'template-pack'> {
  pack: TemplatePack;
}
export interface PolarityLexiconPlugin extends PluginBase<'polarity-lexicon'> {
  locale: string;
  lexicon: PolarityLexicon;
}
