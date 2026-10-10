/**
 * Shared helpers for the physics stages. Owner: WP-01.
 *
 * Monthly arrays are January first. Energies are kWh, powers W, temperatures degC.
 * `t_m = 0.024 * n_m` converts a mean power in W over month m into kWh (BP 3).
 */
import {
  DAYS_IN_MONTH,
  type EvidenceDraft,
  type EvidenceSubject,
  type FormulaId,
  type InputSource,
  type Monthly,
  type NumField,
  numCentral,
  type ProvenanceKind,
  type StageCtx,
  type Unit,
} from '@ibasho/core';

export class PhysicsError extends Error {
  override name = 'PhysicsError';
}

export const MONTH_COUNT = 12;

/** Build a `Monthly<T>` from a function of the month index. */
export function monthly<T>(f: (m: number) => T): Monthly<T> {
  const out: T[] = [];
  for (let m = 0; m < MONTH_COUNT; m++) out.push(f(m));
  return out as unknown as Monthly<T>;
}

export const ZERO12: Monthly<number> = monthly(() => 0);

/** Days in month m (non-leap year, SAP Table 1a). */
export function days(m: number): number {
  return DAYS_IN_MONTH[m]!;
}

/** Central value of a field, which must be finite. */
export function central(f: NumField, what: string): number {
  const v = numCentral(f);
  if (!Number.isFinite(v)) throw new PhysicsError(`${what} is not finite`);
  return v;
}

export function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

/** Map an input source to the evidence provenance kind. */
export function provenanceOf(src: InputSource): ProvenanceKind {
  switch (src.kind) {
    case 'stated':
      return 'stated';
    case 'measured':
      return 'measured';
    case 'document':
      return 'document';
    case 'default':
      return 'default';
    case 'calibrated':
      return 'calibrated';
    case 'derived':
      return 'computed';
  }
}

export interface DraftOpts {
  key?: string;
  inputs?: { key: string; role: string }[];
  month?: number;
  elementId?: string;
  junctionId?: string;
  provenance?: ProvenanceKind;
  /** Significant figures for display (rounding hint only; the value is kept in full). */
  sig?: number;
}

/**
 * An evidence draft for a float quantity. The key defaults to the quantity id, which is unique
 * within one pipeline run; the runner namespaces keys per run and assigns ids.
 */
export function floatDraft(
  ctx: StageCtx,
  quantity: string,
  value: number,
  unit: Unit,
  formula: { id: FormulaId; doc: string },
  o: DraftOpts = {},
): EvidenceDraft {
  return {
    key: o.key ?? quantity,
    quantity,
    subject: subjectOf(ctx, o),
    value: { float: value },
    unit,
    formula,
    inputs: (o.inputs ?? []).map((i) => ({ key: i.key, role: i.role })),
    provenance: { kind: o.provenance ?? 'computed' },
    rounding: { mode: 'sig', value: o.sig ?? 3 },
  };
}

export function subjectOf(ctx: StageCtx, o: { month?: number; elementId?: string; junctionId?: string }) {
  const s: EvidenceSubject = {
    homeId: ctx.twin.id,
    packageId: ctx.pkg?.id ?? 'baseline',
    mode: ctx.mode,
  };
  if (o.month !== undefined) s.month = o.month;
  if (o.elementId !== undefined) s.elementId = o.elementId;
  if (o.junctionId !== undefined) s.junctionId = o.junctionId;
  return s;
}

/** Drafts for a monthly series `<prefix>.<m>`. */
export function monthlyDrafts(
  ctx: StageCtx,
  prefix: string,
  values: readonly number[],
  unit: Unit,
  formula: { id: FormulaId; doc: string },
  inputs: (m: number) => { key: string; role: string }[] = () => [],
): EvidenceDraft[] {
  return values.map((v, m) => floatDraft(ctx, `${prefix}.${m}`, v, unit, formula, { month: m, inputs: inputs(m) }));
}
