/**
 * Grounding and narration contracts (AM 3.4). Owner: WP-00 (contract); WP-05 implements.
 */
import type { MemoryDigest } from './memory.ts';
import type { MeasureId, ScenarioOp } from './ops.ts';

export type EvidenceKind =
  | 'energy'
  | 'energyDelta'
  | 'cost'
  | 'costDelta'
  | 'carbon'
  | 'carbonDelta'
  | 'payback'
  | 'score'
  | 'valueRange'
  | 'rank'
  | 'ratio'
  | 'percent'
  | 'count'
  | 'param';

export type SectionKey =
  | 'overview'
  | 'package'
  | 'tradeoff'
  | 'answer'
  | 'chapter'
  | 'welcome-back'
  | 'why-not';

export interface EvidenceItem {
  /** Bundle-local id. */
  id: `e${number}`;
  /** Global, content addressed (the `EvidenceNode` id it renders). */
  hash: string;
  kind: EvidenceKind;
  label: string;
  value: number | { lo: number; hi: number };
  unit: 'kWh/yr' | 'GBP' | 'GBP/yr' | 'kgCO2e/yr' | 'yr' | 'pts' | '%' | 'rank' | '';
  fuel?: 'gas' | 'electricity' | 'oil' | 'lpg' | 'biomass';
  /** Precomputed; the LLM never infers it. */
  sign?: 'saving' | 'increase' | 'neutral';
  subject: { packageId?: string; measureId?: string; scenarioId?: string };
  provenance: {
    source: 'engine' | 'catalogue' | 'tariff' | 'owner-claim';
    modelVersion: string;
    inputsHash: string;
  };
  rounding: { mode: 'sig' | 'step'; value: number };
}

/** Typed fact from quarantined notes (AM 5). Numbers inside notes are owner claims, never evidence. */
export interface OwnerFact {
  id: string;
  kind: 'constraint' | 'condition' | 'preference' | 'history';
  topic: MeasureId | 'budget' | 'tenure' | (string & {});
  polarity: 'positive' | 'negative' | 'neutral';
  /** At most 120 characters, shown as data and datamarked for narrators. */
  quote: string;
}

export interface EvidenceBundle {
  bundleId: string;
  homeId: string;
  createdAt: string;
  items: EvidenceItem[];
  facts: OwnerFact[];
  memory: MemoryDigest;
  locale: string;
}

export interface NarrationDraft {
  sections: { key: SectionKey; text: string }[];
  ops?: ScenarioOp[];
}

export interface ValidationIssue {
  rule: 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8';
  section: SectionKey;
  span: [number, number];
  detail: string;
  severity: 'repair' | 'hard';
}

export type RenderNode =
  | { t: 'text'; s: string }
  | { t: 'num'; evidenceId: string; display: string }
  | { t: 'measure'; measureId: string; display: string }
  | { t: 'fact'; factId: string; display: string };

export interface RenderedNarration {
  sections: { key: SectionKey; nodes: RenderNode[]; origin: 'llm' | 'template' }[];
  issues: ValidationIssue[];
  provider: string;
  model?: string;
  latencyMs: number;
}
