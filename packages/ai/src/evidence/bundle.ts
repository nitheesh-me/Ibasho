/**
 * Evidence bundle builder (AM 3.1). Turns engine evidence nodes into the small, typed bundle a
 * narrator sees: bundle-local ids (`e1`, `e2`, ...) for short prompts, the global node id as `hash`
 * for traceability, display units, precomputed signs, and derived facts (ranks, counts) so no
 * narrator ever has to compute a comparison itself.
 *
 * Deterministic: ids follow entry order, and values come from exact fixed-point strings or rationals
 * through decimal arithmetic.
 */
import {
  canonicalHash,
  type EvidenceBundle,
  type EvidenceItem,
  type EvidenceKind,
  type EvidenceNode,
  type MemoryDigest,
  type OwnerFact,
  roundHalfEven,
} from '@ibasho/core';
import { type Decimal, parseDecimal, shift, toDecimal, toNumber } from '../grounding/decimal.ts';

export class BundleError extends Error {
  override name = 'BundleError';
}

type DisplayUnit = EvidenceItem['unit'];

/** One engine node to include, with its narrator role. */
export interface NodeEntry {
  /** Stable role name the template narrator looks up (`pick.bestReturn.saving`). */
  role: string;
  node: EvidenceNode;
  kind: EvidenceKind;
  label: string;
  /** Display unit. Default derived from the node unit. */
  unit?: DisplayUnit;
  fuel?: EvidenceItem['fuel'];
  /** Override the precomputed sign (for example a positive "saving" quantity). */
  sign?: EvidenceItem['sign'];
  /** Use the node's p10 to p90 band as the value. */
  range?: 'p10-p90';
  rounding?: EvidenceItem['rounding'];
  subject?: EvidenceItem['subject'];
}

/** A fact the engine or app derived (rank, count, comparison): it has no node of its own here. */
export interface DerivedEntry {
  role: string;
  kind: Extract<EvidenceKind, 'rank' | 'count' | 'ratio' | 'percent' | 'param'>;
  label: string;
  value: number | { lo: number; hi: number };
  unit?: DisplayUnit;
  subject?: EvidenceItem['subject'];
  /** Roles this fact is derived from (they must be in the same bundle). */
  of: string[];
  /** Global id when one exists; otherwise a content hash is used. */
  hash?: string;
  source?: EvidenceItem['provenance']['source'];
  rounding?: EvidenceItem['rounding'];
}

export interface BundleInput {
  homeId: string;
  /** ISO timestamp (the app clock, injected). */
  createdAt: string;
  locale: string;
  modelVersion: string;
  nodes: readonly NodeEntry[];
  derived?: readonly DerivedEntry[];
  facts?: readonly OwnerFact[];
  memory: MemoryDigest;
}

export type RoleMap = Record<string, `e${number}`>;

export interface BuiltBundle {
  bundle: EvidenceBundle;
  roles: RoleMap;
}

/** Fixed-point unit to display unit, with the decimal shift. */
const CONVERT: Record<string, { unit: DisplayUnit; shift: number }> = {
  Wh: { unit: 'kWh/yr', shift: -3 },
  kWh: { unit: 'kWh/yr', shift: 0 },
  'kWh/yr': { unit: 'kWh/yr', shift: 0 },
  'micro-pence': { unit: 'GBP', shift: -8 },
  'micro-pence/yr': { unit: 'GBP/yr', shift: -8 },
  GBP: { unit: 'GBP', shift: 0 },
  'GBP/yr': { unit: 'GBP/yr', shift: 0 },
  gCO2e: { unit: 'kgCO2e/yr', shift: -3 },
  'gCO2e/yr': { unit: 'kgCO2e/yr', shift: -3 },
  kgCO2e: { unit: 'kgCO2e/yr', shift: 0 },
  tCO2e: { unit: 'kgCO2e/yr', shift: 3 },
  yr: { unit: 'yr', shift: 0 },
  pts: { unit: 'pts', shift: 0 },
  '%': { unit: '%', shift: 0 },
  rank: { unit: 'rank', shift: 0 },
};

/** Default display rounding per unit (AM 3.2: money to 10 pounds, years to 0.5). */
const DEFAULT_ROUNDING: Record<DisplayUnit, EvidenceItem['rounding']> = {
  'kWh/yr': { mode: 'sig', value: 3 },
  GBP: { mode: 'sig', value: 3 },
  'GBP/yr': { mode: 'step', value: 10 },
  'kgCO2e/yr': { mode: 'sig', value: 3 },
  yr: { mode: 'step', value: 0.5 },
  pts: { mode: 'step', value: 1 },
  '%': { mode: 'step', value: 1 },
  rank: { mode: 'step', value: 1 },
  '': { mode: 'sig', value: 3 },
};

const SOURCE: Record<EvidenceNode['provenance']['kind'], EvidenceItem['provenance']['source']> = {
  computed: 'engine',
  calibrated: 'engine',
  measured: 'engine',
  stated: 'engine',
  document: 'engine',
  default: 'engine',
  catalogue: 'catalogue',
  tariff: 'tariff',
  'owner-claim': 'owner-claim',
};

function qToDecimal(n: bigint, d: bigint): Decimal {
  const scaled = roundHalfEven(n * 10n ** 12n, d);
  return { neg: scaled < 0n, coef: scaled < 0n ? -scaled : scaled, exp: -12 };
}

function nodeValue(e: NodeEntry, k: number): number | { lo: number; hi: number } {
  const conv = (d: Decimal) => toNumber(shift(d, k));
  const v = e.node.value;
  if (e.range === 'p10-p90') {
    const u = e.node.uncertainty;
    if (!u) throw new BundleError(`${e.role}: node ${e.node.id} has no uncertainty band`);
    return { lo: conv(toDecimal(u.p10)), hi: conv(toDecimal(u.p90)) };
  }
  if ('fixed' in v) return conv(parseDecimal(v.fixed));
  if ('exact' in v) return conv(qToDecimal(v.exact.n, v.exact.d));
  if ('float' in v) return conv(toDecimal(v.float));
  if ('interval' in v) return { lo: conv(toDecimal(v.interval.lo)), hi: conv(toDecimal(v.interval.hi)) };
  throw new BundleError(`${e.role}: categorical node ${e.node.id} cannot be narrated as a number`);
}

const DELTA_KINDS: ReadonlySet<EvidenceKind> = new Set(['energyDelta', 'costDelta', 'carbonDelta']);

/** Deltas are after minus before, so for energy, cost and carbon a negative delta is a saving. */
function signOf(kind: EvidenceKind, value: EvidenceItem['value']): EvidenceItem['sign'] | undefined {
  if (!DELTA_KINDS.has(kind)) return undefined;
  const lo = typeof value === 'number' ? value : value.lo;
  const hi = typeof value === 'number' ? value : value.hi;
  if (hi < 0) return 'saving';
  if (lo > 0) return 'increase';
  if (lo === 0 && hi === 0) return 'neutral';
  return 'neutral';
}

/** Content-addressed bundle id; ignores the clock and memory so variants stay stable on revisit. */
export function bundleSeed(
  items: readonly EvidenceItem[],
  facts: readonly OwnerFact[],
  locale: string,
): string {
  return `b_${canonicalHash({ items, facts, locale }).slice(0, 24)}`;
}

export function buildBundle(input: BundleInput): BuiltBundle {
  const roles: RoleMap = {};
  const items: EvidenceItem[] = [];
  const claim = (role: string): `e${number}` => {
    if (Object.hasOwn(roles, role)) throw new BundleError(`duplicate role ${role}`);
    const id = `e${items.length + 1}` as `e${number}`;
    roles[role] = id;
    return id;
  };

  for (const e of input.nodes) {
    const conv = CONVERT[e.node.unit];
    const unit: DisplayUnit = e.unit ?? conv?.unit ?? '';
    if (e.unit !== undefined && conv && conv.unit !== e.unit) {
      throw new BundleError(`${e.role}: node unit ${e.node.unit} does not display as ${e.unit}`);
    }
    const value = nodeValue(e, conv?.shift ?? 0);
    const id = claim(e.role);
    const item: EvidenceItem = {
      id,
      hash: e.node.id,
      kind: e.kind,
      label: e.label,
      value,
      unit,
      subject: e.subject ?? {
        ...(e.node.subject.packageId !== undefined ? { packageId: e.node.subject.packageId } : {}),
        ...(e.node.subject.measureId !== undefined ? { measureId: e.node.subject.measureId } : {}),
      },
      provenance: {
        source: SOURCE[e.node.provenance.kind],
        modelVersion: e.node.provenance.plugin?.version ?? input.modelVersion,
        inputsHash: canonicalHash(e.node.inputs).slice(0, 20),
      },
      rounding: e.rounding ?? DEFAULT_ROUNDING[unit],
    };
    const fuel = e.fuel;
    if (fuel !== undefined) item.fuel = fuel;
    const sign = e.sign ?? signOf(e.kind, value);
    if (sign !== undefined) item.sign = sign;
    items.push(item);
  }

  for (const d of input.derived ?? []) {
    const missing = d.of.filter((r) => !Object.hasOwn(roles, r));
    if (missing.length > 0)
      throw new BundleError(`${d.role}: derived from unknown roles ${missing.join(', ')}`);
    const unit: DisplayUnit = d.unit ?? (d.kind === 'rank' ? 'rank' : d.kind === 'percent' ? '%' : '');
    const of = d.of.map((r) => roles[r]);
    const id = claim(d.role);
    items.push({
      id,
      hash:
        d.hash ?? `dv_${canonicalHash({ kind: d.kind, label: d.label, value: d.value, of }).slice(0, 20)}`,
      kind: d.kind,
      label: d.label,
      value: d.value,
      unit,
      subject: d.subject ?? {},
      provenance: {
        source: d.source ?? 'engine',
        modelVersion: input.modelVersion,
        inputsHash: canonicalHash(of).slice(0, 20),
      },
      rounding: d.rounding ?? DEFAULT_ROUNDING[unit],
    });
  }

  const facts = [...(input.facts ?? [])];
  const bundle: EvidenceBundle = {
    bundleId: bundleSeed(items, facts, input.locale),
    homeId: input.homeId,
    createdAt: input.createdAt,
    items,
    facts,
    memory: input.memory,
    locale: input.locale,
  };
  return { bundle, roles };
}
