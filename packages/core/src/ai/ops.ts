/**
 * Scenario ops: what the LLM or the offline intent parser may propose (AM 6.1). Owner: WP-00.
 * Op parameter ranges come from `MeasureModel.options[].params` (ARCH 5.6), not from here.
 */
import type { Fuel } from '../units.ts';

export type MeasureId = string;
/** Dotted path into owner-editable twin parameters, e.g. `occupancy.setpointC`. */
export type ParamPath = string;

export type ScenarioOp =
  | { op: 'addMeasure'; measureId: MeasureId; params?: Record<string, number | string> }
  | { op: 'removeMeasure'; measureId: MeasureId }
  | { op: 'setParam'; path: ParamPath; value: number | string }
  | { op: 'setTariff'; fuel: Fuel; tariffId: string }
  | { op: 'setBudget'; capGBP: number }
  | { op: 'setHorizon'; years: number }
  | { op: 'compare'; scenarioIds: string[] }
  | { op: 'explain'; evidenceId: string }
  | { op: 'rejectMeasure'; measureId: MeasureId; scope: 'never' | 'snooze'; until?: string; reason?: string };

export const READ_ONLY_OPS: ReadonlySet<ScenarioOp['op']> = new Set(['compare', 'explain']);

export function isMutatingOp(op: ScenarioOp): boolean {
  return !READ_ONLY_OPS.has(op.op);
}

export interface OpPlan {
  ops: ScenarioOp[];
  /** Slots only, validated like narration. */
  rationale: string;
}

export interface OpValidation {
  accepted: ScenarioOp[];
  rejected: {
    op: ScenarioOp;
    code:
      | 'schema'
      | 'range'
      | 'unknown-measure'
      | 'memory-conflict'
      | 'tenure'
      | 'budget'
      // v3 DesignOps (AR 8)
      | 'geometry'
      | 'code-compliance'
      | 'grid';
    detail: string;
  }[];
  /** True when any accepted op mutates state. */
  needsConfirmation: boolean;
}
