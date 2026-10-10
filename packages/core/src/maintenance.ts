/**
 * Bad outcomes (SPEC 14): decay models, the "If nothing is done" run and negatives. Owner: WP-00.
 *
 * A `maintenance` plugin is a documented decay model from a pack: it names what it ages (a
 * measure or a system), the twin parameter it moves each year with a low, central and high rate,
 * and its sources and grade (required provenance). The engine (WP-02) ages the twin year by year
 * with the same recurrence form as discounting and escalation (SPEC 7.4), never with float powers.
 */
import type { IsoDate, MessageKey, Provenance, RunMode } from './common.ts';
import type { OwnerCtx, SystemCategory } from './engine.ts';
import type { EvidenceGraph, EvidenceId, QuantityId } from './evidence/types.ts';
import type { Q } from './exact/q.ts';
import type { PluginBase } from './plugin/types.ts';
import type { HomeTwin } from './twin.ts';
import type { Fuel, Unit } from './units.ts';

// ---------------------------------------------------------------------------------------------
// Decay models (`maintenance` plugin kind)

/** What a decay model ages. */
export type DecayTarget =
  /** An installed measure (e.g. `draught`): applies when the twin has it, from `done` or fields. */
  | { kind: 'measure'; measureId: string }
  /** A heating, hot water or cooling system: by category, optionally narrowed to `system` plugin ids. */
  | { kind: 'system'; category: SystemCategory; systemIds?: string[] };

/** Low, central and high values of one rate. Invariant: lo <= mid <= hi. */
export interface RateRange<T> {
  lo: T;
  mid: T;
  hi: T;
}

/**
 * Yearly change of one twin parameter.
 * - `relative`: v_t = roundHalfEven(v_{t-1} * (10^9 + ppb) / 10^9) on the parameter's fixed
 *   representation; negative ppb means the value falls (efficiency drift).
 * - `absolute`: v_t = v_{t-1} + perYear, in the parameter's unit (e.g. draught-proofed fraction).
 */
export type DecayRate =
  | { form: 'relative'; ppbPerYear: RateRange<bigint> }
  | { form: 'absolute'; perYear: RateRange<Q> };

export interface DecayEffect {
  /** JSON Pointer into the twin, as in `TwinPatch` (`/systems/space/efficiency`). */
  param: string;
  unit: Unit;
  rate: DecayRate;
  /** Years after install (or after `onsetFrom`) before the decay starts. Default 0. */
  onsetYears?: number;
  /** Age reference: install year of the measure or system, or the run's `asOf`. Default `install`. */
  onsetFrom?: 'install' | 'as-of';
  /** The aged value never leaves this range (e.g. efficiency floor, fraction in [0, 1]). */
  clamp?: { min?: Q; max?: Q };
  /** Quantity id the engine emits for the aged value (e.g. `sys.efficiency.space`). */
  quantity: QuantityId;
  /** Plain explanation (WP-09). */
  explain: MessageKey;
}

/** A counterfactual replacement that falls due when the target reaches end of life. */
export interface DecayEndOfLife {
  /** Age in years at which replacement falls due, low, central and high. */
  ageYears: RateRange<number>;
  /** Like-for-like `system` plugin id; its cost comes from the money pack. */
  replaceWithSystemId?: string;
  explain: MessageKey;
}

/**
 * Decay model (SPEC 14). Provenance is required: every effect cites its sources and grade
 * (registry check `provenance`; grades `estimate` and `announced` show a badge, R17).
 */
export interface MaintenancePlugin extends PluginBase<'maintenance'> {
  ages: DecayTarget;
  /** What neglect means here (e.g. no annual service). Decay applies when maintenance is ignored. */
  neglect: MessageKey;
  effects: DecayEffect[];
  endOfLife?: DecayEndOfLife;
  provenance: Provenance;
}

// ---------------------------------------------------------------------------------------------
// Negatives (SPEC 14, AC-B3)

/** Why an indicator is listed as worse. */
export type NegativeKind =
  /** A fuel's delivered energy or bill rises. */
  | 'fuel-rise'
  /** Year-1 or lifetime money gets worse (negative saving, negative NPV, rising bill). */
  | 'money'
  /** Running or lifetime carbon rises. */
  | 'carbon'
  /** Score, band or comfort hours get worse. */
  | 'performance'
  /** Disruption: days, rooms out of use, moving out. */
  | 'disruption'
  /** A new risk raised by rules or physics. */
  | 'risk';

export type NegativeRisk = 'moisture' | 'overheating' | 'noise' | 'fire' | 'structural' | 'other';

/**
 * One indicator that worsens. Numbers live in the evidence graph only: `evidence` is the node
 * holding the signed change (or the risk finding), so no value is shown without evidence.
 */
export interface Negative {
  /** Quantity id of the indicator (e.g. `energy.delivered.electricity`, `fin.npv`) or `risk.<kind>`. */
  indicator: QuantityId;
  kind: NegativeKind;
  evidence: EvidenceId;
  /** Before and after nodes when the indicator has both. */
  before?: EvidenceId;
  after?: EvidenceId;
  risk?: NegativeRisk;
  /** Rule that raised it, when one did. */
  ruleId?: string;
  /** Decay model behind it, in the "If nothing is done" run. */
  maintenanceId?: string;
  /** Plain copy key (WP-09). */
  message: MessageKey;
}

/** Package id to its negatives. Every package shown (baseline, front, picks) has an entry, maybe empty. */
export type NegativesByPackage = Record<string, Negative[]>;

// ---------------------------------------------------------------------------------------------
// "If nothing is done" run (SPEC 14, AC-B1)

export interface DoNothingRequest {
  twin: HomeTwin;
  owner: OwnerCtx;
  asOf: IsoDate;
  /** Default `your-home`. */
  mode?: RunMode;
  /** Years to age the home. Default `owner.horizonYears`. */
  horizonYears?: number;
  /** Years to report in `years` (0 is today). Default every year up to the horizon. */
  reportYears?: number[];
  /** Which end of each decay range to use. Default `mid`; the band uses `lo` and `hi`. */
  rate?: keyof RateRange<unknown>;
}

/** One aged parameter at one reported year. */
export interface DoNothingEffect {
  maintenanceId: string;
  param: string;
  year: number;
  /** Aged value with its decay source (plugin provenance) as an input. */
  evidence: EvidenceId;
  /** Low and high ends from the rate range. */
  band?: { lo: EvidenceId; hi: EvidenceId };
}

/** A counterfactual replacement falling due in the do-nothing future. */
export interface DoNothingReplacement {
  maintenanceId: string;
  /** Central year it falls due (0 when already past end of life), with its range. */
  dueYear: RateRange<number>;
  /** Cost node (money pack), when a like-for-like cost exists. */
  cost?: EvidenceId;
  evidence: EvidenceId;
}

/** Totals at one reported year. Every value is an evidence id. */
export interface DoNothingYear {
  year: number;
  /** Annual delivered energy per fuel (integer Wh). */
  deliveredWh: Partial<Record<Fuel, EvidenceId>>;
  /** Annual bill, escalated by `owner.escalation`. */
  bill: EvidenceId;
  /** Annual running carbon (gCO2e). */
  carbon: EvidenceId;
  score?: EvidenceId;
}

/** The fourth line beside the three futures: "If nothing is done". */
export interface DoNothingResult {
  hash: string;
  specHash: string;
  /** Registry fingerprint of the `maintenance` plugins used. */
  maintenanceFingerprint: string;
  mode: RunMode;
  horizonYears: number;
  years: DoNothingYear[];
  effects: DoNothingEffect[];
  replacements: DoNothingReplacement[];
  /** Discounted cumulative cost of doing nothing over the horizon, and cumulative carbon. */
  totals: { costNpv: EvidenceId; carbon: EvidenceId };
  /** What gets worse against today (year 0). */
  negatives: Negative[];
  /** Models that matched nothing in this twin, listed so the gap is visible. */
  notApplicable: string[];
  graph: EvidenceGraph;
}
