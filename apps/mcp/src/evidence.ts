/**
 * Evidence views and the grounding guard for tool output. Owner: WP-12.
 *
 * The agent reads numbers only as evidence ids with values (ARCH 14). Every number a tool
 * returns sits in an `EvView` next to its `ev` id; `assertGrounded` walks a payload and fails if
 * a number appears anywhere else. Tools run their output through it before returning.
 */
import type { EvidenceGraph, EvidenceNode, EvidenceValue } from '@ibasho/core';
import { Q } from '@ibasho/core';

export interface EvView {
  ev: string;
  quantity: string;
  /** Exact rendering of the evidence value (fixed point, rational, float, interval or category). */
  value: string;
  unit: string;
  seal: string;
  packageId?: string;
  measureId?: string;
  mode?: string;
}

export function renderValue(v: EvidenceValue): string {
  if ('fixed' in v) return v.fixed;
  if ('exact' in v) return Q.toWire(v.exact);
  if ('float' in v) return String(v.float);
  if ('interval' in v) return `${v.interval.lo}..${v.interval.hi}`;
  return v.cat;
}

export function view(n: EvidenceNode): EvView {
  const out: EvView = {
    ev: n.id,
    quantity: n.quantity,
    value: renderValue(n.value),
    unit: n.unit,
    seal: n.seal,
  };
  if (n.subject.packageId) out.packageId = n.subject.packageId;
  if (n.subject.measureId) out.measureId = n.subject.measureId;
  out.mode = n.subject.mode;
  return out;
}

/** Default quantities worth showing an agent: annual totals, money, carbon, score, EPC, finance. */
export const DEFAULT_PREFIXES = [
  'energy.delivered.',
  'money.bill',
  'acct.carbon_saving',
  'acct.saving.',
  'score.total',
  'score.group.',
  'epc.',
  'fin.n0',
  'fin.npv',
  'fin.payback',
  'feas.status',
];

export interface PickOptions {
  prefixes?: string[];
  packageId?: string | null;
  /** Keep monthly nodes (`subject.month` set). Default false when annual nodes exist. */
  monthly?: boolean;
  limit?: number;
}

/** Select evidence nodes for a payload, annual first, stable order. */
export function pick(graph: EvidenceGraph | undefined, opts: PickOptions = {}): EvView[] {
  if (!graph) return [];
  const prefixes = opts.prefixes ?? DEFAULT_PREFIXES;
  const limit = opts.limit ?? 80;
  let nodes = graph.nodes.filter((n) => prefixes.some((p) => n.quantity === p || n.quantity.startsWith(p)));
  if (opts.packageId !== undefined) {
    nodes = nodes.filter((n) => (n.subject.packageId ?? null) === opts.packageId);
  }
  if (!opts.monthly) {
    const annual = nodes.filter((n) => n.subject.month === undefined);
    if (annual.length > 0) nodes = annual;
  }
  return nodes
    .slice()
    .sort((a, b) => (a.quantity < b.quantity ? -1 : a.quantity > b.quantity ? 1 : a.id < b.id ? -1 : 1))
    .slice(0, limit)
    .map(view);
}

const NUMERIC_STRING = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:\/\d+)?$/;
/** Structural integers allowed outside evidence (none carry a computed quantity). */
const STRUCTURAL_KEYS = new Set(['month', 'hour']);
/** Citation and version strings that may look numeric (a clause "3.2", a version "2"). */
const LABEL_KEYS = new Set(['clause', 'version', 'title', 'id']);

export interface GroundingViolation {
  path: string;
  value: unknown;
}

/** Every number (or numeric string) outside an evidence view, as JSON paths. */
export function groundingViolations(payload: unknown): GroundingViolation[] {
  const out: GroundingViolation[] = [];
  const walk = (x: unknown, path: string, key: string, inEv: boolean) => {
    if (typeof x === 'number' || typeof x === 'bigint') {
      if (!STRUCTURAL_KEYS.has(key)) out.push({ path, value: x });
      return;
    }
    if (typeof x === 'string') {
      if (NUMERIC_STRING.test(x.trim()) && !(inEv && key === 'value') && !LABEL_KEYS.has(key)) {
        out.push({ path, value: x });
      }
      return;
    }
    if (Array.isArray(x)) {
      for (const [i, v] of x.entries()) walk(v, `${path}[${i}]`, key, false);
      return;
    }
    if (x && typeof x === 'object') {
      const isEv = typeof (x as { ev?: unknown }).ev === 'string';
      for (const [k, v] of Object.entries(x)) walk(v, `${path}.${k}`, k, isEv);
    }
  };
  walk(payload, '$', '', false);
  return out;
}

export function assertGrounded(payload: unknown): void {
  const v = groundingViolations(payload);
  if (v.length > 0) {
    throw new Error(
      `ungrounded number in tool output at ${v
        .slice(0, 5)
        .map((x) => x.path)
        .join(', ')}`,
    );
  }
}
