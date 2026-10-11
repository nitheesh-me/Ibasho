/**
 * Optimisation outputs and massing generators (ARCH 15.3, SPEC R37, R38, SO 7, BE 2.4).
 * Owner: WP-00 (contract); WP-20 implements, WP-13 records Preview fixtures.
 */
import type { MessageKey } from '../common.ts';
import type { EvidenceGraph, EvidenceId } from '../evidence/types.ts';
import type { PluginBase } from '../plugin/types.ts';
import type { MassingSpec } from './building.ts';
import type { Objective } from './goals.ts';
import type { DesignOp, RecRole } from './partner.ts';
import type { ResultStamp } from './provenance.ts';

/** One evaluated candidate: integer axis values in the order of `OptimiseResult.objectives`. */
export interface Candidate {
  id: string;
  ops: DesignOp[];
  axes: readonly bigint[];
  feasible: boolean;
  /** Why not, when infeasible: rule ids or goal kinds. */
  blockedBy?: string[];
  /** Feasible after a check (the "possible after a check" lane). */
  needsCheck?: boolean;
  evidence: EvidenceId[];
}

export interface Sweep {
  target: string;
  param: string;
  grid: string;
  points: { index: number; axes: readonly bigint[]; evidence: EvidenceId[] }[];
}

export interface OptimiseResult {
  inputsHash: string;
  stamp: ResultStamp;
  objectives: Objective[];
  method: 'exhaustive' | 'nsga2' | 'screen-only';
  seed?: string;
  /** Morris screening (Modelled): mean absolute elementary effect per design axis. */
  screening?: { axis: string; muStar: number; sigma: number }[];
  /** Options tried, counted; the seal links the list (R38). */
  tried: number;
  candidates: Candidate[];
  /** Ids of non-dominated feasible candidates. */
  front: string[];
  /** Dominance witnesses for certificate checks: dominated id and the front id that dominates it. */
  witnesses: { dominated: string; by: string }[];
  picks: {
    role: RecRole;
    id: string | 'none';
    label: MessageKey;
    /**
     * For `lowest-energy`: the bundle's energy use before rooftop generation, kWh/m²·yr. That role
     * ranks efficiency, so show this next to the net EUI (rooftop solar can make another bundle's
     * net EUI lower).
     */
    euiBeforeGeneration?: number;
  }[];
  sweeps: Sweep[];
  /** Nodes behind `Candidate.evidence` and `Sweep` points (axes values, inputs). */
  evidence?: EvidenceGraph;
}

/** Parametric massing operator (phototropic setbacks and similar). Engine side. */
export interface MassingGeneratorPlugin extends PluginBase<'massing-generator'> {
  generatorId: string;
  /** Parameter grids the operator accepts (sweepable). */
  params: { id: string; grid: string; label: MessageKey }[];
  generate(base: MassingSpec, params: Record<string, number>): MassingSpec;
}

/**
 * Pareto dominance on integer axes: `a` dominates `b` when it is no worse on every axis and
 * strictly better on one, honouring each objective's direction.
 */
export function dominates(
  a: readonly bigint[],
  b: readonly bigint[],
  objectives: readonly Objective[],
): boolean {
  let strictly = false;
  for (let i = 0; i < objectives.length; i++) {
    const x = a[i] as bigint;
    const y = b[i] as bigint;
    const better = objectives[i]?.dir === 'min' ? x < y : x > y;
    const worse = objectives[i]?.dir === 'min' ? x > y : x < y;
    if (worse) return false;
    if (better) strictly = true;
  }
  return strictly;
}
