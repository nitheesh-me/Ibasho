/**
 * Design operations, live recommendations, change explanations and the design partner
 * (ARCH 15.4, AR 4 to 6 and 8, SPEC R42, R43, 25). Owner: WP-00 (contract); WP-05 implements
 * the partner and explainer, WP-20 the search, WP-12 exposes `DesignOp`s to agents.
 *
 * D1 holds for proposals: the partner chooses what to try, the pack declares which values exist
 * (grids), the engine says what happens. A `DesignOp` never carries a raw quantity (AC-OP3).
 */
import type { MessageKey } from '../common.ts';
import type { CheckerRungId, EvidenceId } from '../evidence/types.ts';
import type { PluginBase } from '../plugin/types.ts';
import type { FacadeBin } from './building.ts';
import type { ObjectiveId } from './goals.ts';

/** An index into a pack-declared grid of values (e.g. `overhang.depth` standard grid, step 2). */
export interface GridRef {
  grid: string;
  index: number;
}

/** Target of a facade-level op: a bin, or one segment by id. */
export type FacadeTarget = { facade: FacadeBin } | { segId: string };

export type DesignOp =
  // Massing
  | { op: 'setOrientation'; value: GridRef }
  | { op: 'setFloorCount'; value: GridRef }
  | { op: 'setFloorToFloor'; storeyId?: string; value: GridRef }
  | { op: 'setSetback'; storey: number; edge: number; value: GridRef }
  | { op: 'addCourtyard'; value: GridRef }
  // Plan
  | { op: 'addFloor'; copyOf?: string }
  | { op: 'setRoomFunction'; roomId: string; spaceTypeId: string }
  | { op: 'splitRoom'; roomId: string; axis: 'u' | 'v'; at: GridRef }
  | { op: 'mergeRooms'; roomIds: [string, string] }
  | { op: 'moveCore'; coreId: string; direction: 'n' | 'e' | 's' | 'w'; by: GridRef }
  // Openings
  | ({ op: 'setWWR'; value: GridRef } & FacadeTarget)
  | { op: 'setGlazing'; target: FacadeTarget | { openingId: string }; productId: string }
  | ({ op: 'setSillHeight'; value: GridRef } & FacadeTarget)
  // Shading
  | ({ op: 'addOverhang'; depth: GridRef; extension?: GridRef } & FacadeTarget)
  | ({ op: 'addFins'; depth: GridRef; spacing?: GridRef } & FacadeTarget)
  | ({ op: 'addJaali'; porosity: GridRef } & FacadeTarget)
  | ({ op: 'addLightShelf'; depth: GridRef } & FacadeTarget)
  | ({ op: 'removeShading' } & FacadeTarget)
  // Envelope
  | { op: 'setWallAssembly'; constructionId: string; target?: FacadeTarget }
  | { op: 'setRoofAssembly'; constructionId: string }
  | { op: 'setRoofFinish'; presetId: string }
  // Systems
  | { op: 'setHVAC'; systemId: string; zoneId?: string }
  | { op: 'setSetpoint'; kind: 'cool' | 'heat'; value: GridRef; zoneId?: string }
  | { op: 'setLPD'; value: GridRef; spaceTypeId?: string }
  | { op: 'addDaylightControls'; zoneId?: string }
  | { op: 'addPV'; roofId: string; coverage: GridRef }
  | { op: 'addSolarHotWater' }
  | { op: 'setWaterFixtures'; presetId: string }
  // Operations
  | { op: 'setSchedule'; spaceTypeId: string; scheduleId: string }
  | { op: 'setRates'; tariffId: string }
  // Meta
  | { op: 'sweep'; target: string; param: string; grid: string; steps: 'all' | number[] }
  | { op: 'variant'; name: string; ops: DesignOp[] }
  | { op: 'reject'; family: string; reason?: string };
export type DesignOpName = DesignOp['op'];

/** Recommendation item roles (AR 4.1, R37 picks for non-home types). */
export type RecRole =
  | 'least-upfront'
  | 'lowest-running'
  | 'lowest-energy'
  | 'best-return'
  | 'lowest-carbon'
  | 'most-points'
  | 'pinned'
  | 'partner';

export interface RecItem {
  /** Hash of the op list, stable across recomputes. */
  id: string;
  role: RecRole;
  ops: DesignOp[];
  evidence: EvidenceId[];
  stability: 'clear' | 'tied' | 'new' | 'unchanged';
  origin: 'search' | 'partner' | 'owner';
}

/** Derived, never stored as truth (R42); keyed by an inputs hash. */
export interface RecSet {
  id: string;
  inputsHash: string;
  generation: number;
  tier: 'instant' | 'rerank' | 'full';
  objectives: ObjectiveId[];
  items: RecItem[];
  hiddenByMemory: { count: number; byKey: Record<string, number> };
  certificate?: { id: string; rung: CheckerRungId };
}

/** "Why it changed" (AR 5.1): exact Shapley over at most four change groups. */
export interface ChangeExplanation {
  from: { recSetId: string; at: string };
  to: { recSetId: string; at: string };
  groups: {
    id: string;
    origin: 'owner-edit' | 'memory' | 'external-data' | 'model-update';
    label: MessageKey;
    events: string[];
  }[];
  quantities: {
    evidenceId: EvidenceId;
    delta: EvidenceId;
    contributions: { group: string; evidenceId: EvidenceId }[];
  }[];
  leader?: {
    card: RecRole;
    was: string;
    now: string;
    reason:
      | { kind: 'infeasible'; rule: string }
      | { kind: 'outscored'; mainGroup: string }
      | { kind: 'band' };
  };
  paths: { output: EvidenceId; chain: EvidenceId[] }[];
}

/** A partner proposal: ghosted card with its ops, the engine's result and a slot-only rationale. */
export interface Proposal {
  id: string;
  provider: 'offline' | 'ollama' | 'claude' | (string & {});
  ops: DesignOp[];
  /** Slots only, validated like narration. */
  rationale: string;
  /** Engine evidence for the proposal's variant, once evaluated. */
  evidence: EvidenceId[];
  /** Options tried that were not better (R43). */
  triedNotBetter: { ops: DesignOp[]; evidence: EvidenceId[] }[];
  status: 'proposed' | 'accepted' | 'dismissed' | 'tweaked';
  dismissReason?: string;
}

/** Cross-building decision memory (AR 3.4): typed, nearest neighbour over a feature vector. */
export interface DecisionRecord {
  id: string;
  buildingId: string;
  features: {
    typeId: string;
    climateZone: string;
    ageBand: string;
    storeys: number;
    wwrBand: string;
    structure: string;
    tenure: string;
  };
  family: string;
  verdict: 'accepted' | 'rejected';
  reason?: string;
}

/** Offline or LLM proposer of `DesignOp`s (UI side; the engine evaluates). */
export interface DesignProposerPlugin extends PluginBase<'design-proposer'> {
  provider: Proposal['provider'];
  local: boolean;
  /** Proposals for a goal or question, at most `max`, using only pack grids. */
  propose(req: {
    buildingId: string;
    question?: string;
    objectives: ObjectiveId[];
    grids: Record<string, readonly unknown[]>;
    max: number;
  }): Promise<Proposal[]>;
}
