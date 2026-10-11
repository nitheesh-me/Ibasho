/**
 * Evidence model (ARCH 7). Owner: WP-00.
 * Stages emit drafts; the pipeline runner (WP-01) assigns ids; `verify` (WP-04) assigns seals.
 */
import type { Grade, MessageKey, RunMode, SemVer, SourceRef } from '../common.ts';
import type { Q } from '../exact/q.ts';
import type { Ival } from '../ival.ts';
import type { Unit } from '../units.ts';

export type EvidenceId = `ev_${string}`;
/** `<domain>.<quantity>[.<fuel>][.<month>]` (SPEC 7), e.g. `energy.delivered.gas.0`. */
export type QuantityId = string;
/** Formula id documented in SPEC 7 or a brief, e.g. `BP-3.7`. */
export type FormulaId = string;
/** Certificate check id (ARCH 8.3), e.g. `acct.saving`. */
export type CheckId = string;
export type ClaimId = string;
export type CheckerRungId = 'lean-native' | 'lean-wasm' | 'mirror';

/**
 * Numbers are never `proved`: Proved seals sit on claims only (SPEC R11). `preview` (v3, R26)
 * marks values replayed by a Preview stage provider: never Checked, never sealed by `verify`.
 */
export type SealLevel = 'checked' | 'modelled' | 'unverified' | 'cracked' | 'preview';

export type EvidenceValue =
  | { fixed: string; unit: Unit }
  | { exact: Q }
  | { float: number }
  | { interval: Ival<number> }
  | { cat: string };

export type ProvenanceKind =
  | 'computed'
  | 'stated'
  | 'measured'
  | 'document'
  | 'default'
  | 'catalogue'
  | 'tariff'
  | 'owner-claim'
  | 'calibrated'
  /** v3 (R26): replayed from a Preview fixture, shaped exactly like the real output. */
  | 'preview';

export interface EvidenceSubject {
  /** The home, or in v3 the building id (homes are `single-family` buildings). */
  homeId: string;
  placeId?: string;
  buildingId?: string;
  variantId?: string;
  storeyId?: string;
  roomId?: string;
  surfaceId?: string;
  packageId?: string;
  measureId?: string;
  elementId?: string;
  junctionId?: string;
  zone?: string;
  month?: number;
  mode: RunMode;
}

export interface EvidenceNode {
  id: EvidenceId;
  quantity: QuantityId;
  subject: EvidenceSubject;
  value: EvidenceValue;
  unit: Unit;
  formula: { id: FormulaId; doc: string; expr?: string };
  inputs: { id: EvidenceId; role: string }[];
  provenance: {
    kind: ProvenanceKind;
    plugin?: { id: string; version: SemVer };
    sources?: SourceRef[];
    grade?: Grade;
  };
  uncertainty?: { p10: number; p50: number; p90: number };
  seal: SealLevel;
  check?: { id: CheckId; rung: CheckerRungId; coverage: 'all' | 'sample' };
  derived?: {
    kind: 'rank' | 'ratio' | 'percent' | 'compare' | 'sign' | 'attribution' | 'bisect';
    of: EvidenceId[];
  };
  rounding: { mode: 'sig' | 'step'; value: number };
}

/** What a stage emits: a node without id and seal. `key` lets later drafts reference it as an input. */
export interface EvidenceDraft extends Omit<EvidenceNode, 'id' | 'seal' | 'inputs'> {
  key?: string;
  /** Inputs by assigned id, or by the `key` of a draft in the same batch. */
  inputs: { id?: EvidenceId; key?: string; role: string }[];
}

/** Proved seals sit on claims (SPEC 7.3). */
export interface Claim {
  id: ClaimId;
  theorems: string[];
  notProved: MessageKey;
  appliesTo: { resultHash: string };
}

/**
 * Serialisable evidence graph: plain data, structured-cloneable, nodes sorted by id.
 * `external` lists ids referenced as inputs that live outside this graph (fetched lazily
 * through `EngineApi.evidence`).
 */
export interface EvidenceGraph {
  schema: 'ibasho.evidence/1';
  nodes: EvidenceNode[];
  external: EvidenceId[];
}
