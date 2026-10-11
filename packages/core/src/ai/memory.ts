/**
 * Memory domain contracts (AM 7.1). Owner: WP-00 (contract); WP-05 implements the domain,
 * WP-08 implements `MemoryRepo` in `packages/store`.
 */
import type { Goal, GoalStrength, MemoryScope } from '../v3/goals.ts';
import type { DesignOp } from '../v3/partner.ts';
import type { MeasureId, ScenarioOp } from './ops.ts';

export type Right = 'yes' | 'no' | 'ask' | 'unknown';
export type Priority = 'warmth' | 'quiet' | 'air-quality' | 'cool-summers' | 'low-disruption';
export type Tenure = 'owner' | 'tenant' | 'landlord' | 'unknown';

/** Typed payload per memory event type. */
export interface MemoryPayloads {
  measureRejected: { measureId: MeasureId; scope: 'never' | 'snooze'; until?: string; reason?: string };
  measureRestored: { measureId: MeasureId };
  measureCompleted: { measureId: MeasureId; optionId?: string };
  budgetSet: { capGBP: number | null };
  tenureSet: { tenure: Tenure };
  priorityRanked: { priorities: Priority[] };
  seedProposed: {
    seedId: string;
    text: string;
    proposes: { type: MemoryEventType; payload: unknown } | null;
  };
  seedAccepted: { seedId: string };
  seedDismissed: { seedId: string };
  opApplied: { op: ScenarioOp };
  packageViewed: { packageId: string; resultHash?: string };
  questionAsked: { question: string };
  memoryEdited: { eventId: string; payload: unknown };
  memoryForgotten: { selector: ForgetSelector };
  // v3 (AR 3.3): scoped goals, variants, recommendations, the partner, external data
  goalSet: { key: string; goal: Goal; strength: GoalStrength; scope: MemoryScope };
  goalCleared: { key: string; scope: MemoryScope };
  constraintSet: { key: 'rights' | 'designLimit'; value: unknown; scope: MemoryScope };
  variantCreated: { variantId: string; parentId: string; ops: DesignOp[] };
  variantArchived: { variantId: string };
  recommendationShown: { recSetId: string; inputsHash: string; leaderIds: string[] };
  recommendationPinned: { recSetId: string; itemId: string };
  recommendationUnpinned: { recSetId: string; itemId: string };
  partnerProposed: { proposalId: string; ops: DesignOp[]; rationale: string; provider: string };
  partnerAccepted: { proposalId: string; reason?: string };
  partnerDismissed: { proposalId: string; reason?: string };
  externalDataChanged: { pack: string; from: string; to: string };
}
export type MemoryEventType = keyof MemoryPayloads;

interface MemoryEventBase<T extends MemoryEventType> {
  id: string;
  homeId: string;
  /** ISO timestamp. */
  at: string;
  actor: 'owner' | 'engine' | 'llm-proposal';
  type: T;
  payload: MemoryPayloads[T];
  source?: { kind: 'ui' | 'chat' | 'note'; ref?: string; quote?: string };
  /** v3 (R42): the scope the event applies to; absent means the home or building (`homeId`). */
  scope?: MemoryScope;
  /** v3 bi-temporal: when the fact holds in the world. `at` is when it was recorded. ISO timestamps. */
  validFrom?: string;
  validTo?: string;
}
export type MemoryEvent = { [T in MemoryEventType]: MemoryEventBase<T> }[MemoryEventType];

export interface Preferences {
  budgetCapGBP?: number;
  horizonYears?: number;
  tenure: Tenure;
  rights: { roof: Right; externalWalls: Right; windows: Right };
  rejected: Record<MeasureId, { scope: 'never' | 'snooze'; until?: string; reason?: string; at: string }>;
  completed: Record<MeasureId, { at: string }>;
  /** Ranked, most important first. */
  priorities: Priority[];
}

export interface Seed {
  id: string;
  homeId: string;
  text: string;
  status: 'proposed' | 'accepted' | 'dismissed';
  proposedAt: string;
}

/** What narrators see: typed, small, never raw notes. */
export interface MemoryDigest {
  preferences: Preferences;
  /** Recent events relevant to the focus measures, newest first. */
  recent: MemoryEvent[];
  hiddenByRejection: number;
}

export type ForgetSelector =
  | { kind: 'all' }
  | { kind: 'event'; eventId: string }
  | { kind: 'type'; type: MemoryEventType }
  | { kind: 'measure'; measureId: MeasureId };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** A memory event before the repository assigns `id` and `at`. */
export type NewMemoryEvent = DistributiveOmit<MemoryEvent, 'id' | 'at'>;

/** Implemented by `packages/store` (WP-08), consumed by `packages/ai` (WP-05). */
export interface MemoryRepo {
  append(e: NewMemoryEvent): Promise<MemoryEvent>;
  preferences(homeId: string): Promise<Preferences>;
  seeds(homeId: string): Promise<Seed[]>;
  digest(homeId: string, focus?: MeasureId[]): Promise<MemoryDigest>;
  history(
    homeId: string,
    filter?: { type?: MemoryEventType; actor?: MemoryEvent['actor'] },
  ): Promise<MemoryEvent[]>;
  /** Appends a compensating event. */
  undo(eventId: string): Promise<void>;
  exportJSON(homeId: string): Promise<string>;
  importJSON(json: string): Promise<void>;
  /** Real deletion, not a flag. */
  forget(homeId: string, selector: ForgetSelector): Promise<void>;
  subscribe(homeId: string, cb: () => void): () => void;
}
