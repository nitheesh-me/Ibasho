/**
 * Rules (ARCH 5.4, RP 3). Owner: WP-00 (contracts); WP-03 owns the evaluator and packs.
 * Expressions are JSON data, evaluated three-valued (Kleene) by TS and by Lean.
 */

import type { NamedFn } from '@ibasho/spec-gen';
import type { Grade, IsoDate, MessageKey, RegionCode } from './common.ts';
import type { Tri } from './fields.ts';
import type { MeasureKind } from './measure-kinds.ts';
import type { CheckKind, Element, VentSystem } from './twin.ts';

export type Authority =
  | 'LPA'
  | 'LPA-prior-approval'
  | 'LBC'
  | 'building-control'
  | 'freeholder'
  | 'landlord'
  | 'RWA'
  | 'DISCOM'
  | 'DNO'
  | 'highway'
  | 'neighbour';

/**
 * Fact id, namespaced by subject: `h.*` home facts (RP 4), `m.*` option facts from
 * `MeasureModel.facts`, `p.*` package facts (counts, totals, noise inputs), `o.*` owner context.
 */
export type FactId = string;
export interface FactRef {
  fact: FactId;
}

/** What an `oblige` effect requires. Applied before physics; idempotent (Lean `Oblige`). */
export type Obligation =
  | { kind: 'max-u'; element: Element['kind']; maxU: number }
  | { kind: 'ventilation'; system: VentSystem; category?: 'A' | 'B' | 'C' }
  | { kind: 'emitter-flow'; maxFlowC: number }
  | { kind: 'hp-meets-design-load' }
  | { kind: 'assessment'; check: CheckKind }
  | { kind: 'add-option'; optionId: string };

export type Effect =
  | { kind: 'block'; reason: MessageKey }
  | { kind: 'consent'; authority: Authority; typicalWeeks?: number }
  | { kind: 'oblige'; spec: Obligation }
  | { kind: 'check'; check: CheckKind }
  | { kind: 'warn'; risk: MessageKey }
  | { kind: 'info'; note: MessageKey };

export type CmpOp = '<' | '<=' | '=' | '>=' | '>' | '!=';

export type Expr =
  | { and: Expr[] }
  | { or: Expr[] }
  | { not: Expr }
  | { cmp: CmpOp; left: FactRef; right: FactRef | number | string }
  | { in: FactRef; set: (string | number)[] }
  | { fn: NamedFn; args: FactRef[] }
  | { const: Tri };

/**
 * Named rule functions, each defined in Lean (`proofs/Ibasho/Spec/V2/Rules`). The list is
 * generated into spec-gen, which is its single source of truth.
 */
export { NAMED_FNS, type NamedFn } from '@ibasho/spec-gen';

export interface Rule {
  /** Stable id, e.g. `ENG.PD.ASHP.NOISE`. */
  id: string;
  jurisdiction: RegionCode | 'CITY';
  measures: MeasureKind[] | '*';
  scope: 'measure' | 'package';
  when: Expr;
  effect: Effect;
  effectiveFrom: IsoDate;
  effectiveTo?: IsoDate;
  source: { url: string; clause: string; grade: Grade };
  explain: MessageKey;
  /** Set when a named function is not yet in spec-gen; its seal reads "Unverified rule". */
  unverifiedRule?: true;
}

export interface Feasibility {
  status: 'feasible' | 'needs-check' | 'blocked';
  consents: { ruleId: string; authority: Authority }[];
  obligations: { ruleId: string; spec: Obligation }[];
  checks: { ruleId: string; check: CheckKind }[];
  warnings: { ruleId: string; risk: MessageKey }[];
  blockedBy?: string[];
  unknownBy?: { ruleId: string; facts: FactId[] }[];
}

/** Every named function used in an expression, sorted and unique. */
export function exprFns(e: Expr): NamedFn[] {
  const out = new Set<NamedFn>();
  walk(e, (x) => {
    if ('fn' in x) out.add(x.fn);
  });
  return [...out].sort();
}

/** Every fact id an expression reads, sorted and unique. */
export function exprFacts(e: Expr): FactId[] {
  const out = new Set<FactId>();
  walk(e, (x) => {
    if ('cmp' in x) {
      out.add(x.left.fact);
      if (typeof x.right === 'object') out.add(x.right.fact);
    } else if ('in' in x) out.add(x.in.fact);
    else if ('fn' in x) for (const a of x.args) out.add(a.fact);
  });
  return [...out].sort();
}

function walk(e: Expr, visit: (e: Expr) => void): void {
  visit(e);
  if ('and' in e) for (const c of e.and) walk(c, visit);
  else if ('or' in e) for (const c of e.or) walk(c, visit);
  else if ('not' in e) walk(e.not, visit);
}
