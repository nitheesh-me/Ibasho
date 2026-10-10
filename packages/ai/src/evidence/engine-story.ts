/**
 * Story from real engine evidence (AM 3.1). Turns the `EvidenceGraph` of a `SearchResult` (baseline,
 * front and picks; ARCH 5.5) into the `Story` the template narrator and every provider read, with
 * the narrator roles the en-GB pack uses. Item `hash` values are the engine's own evidence ids, so
 * every chip in the narration opens the real node.
 *
 * Where the engine reports a quantity monthly only (delivered energy, fuel savings, heat demand) the
 * annual figure is an exact sum node whose inputs are the twelve monthly engine nodes (formula
 * `NARR.SUM.MONTHS`); its id is `evidenceId(quantity, subject)` like any other node. The annual bill
 * is the same kind of sum over the per fuel bills. Roles the engine does not expose yet (score,
 * running carbon today, payback, calibration, heat loss rank) are left out, and the template drops
 * those sentences (it never invents a figure).
 *
 * Layer L2: reads only `@ibasho/core` types. Pure and deterministic.
 */
import {
  evidenceId,
  type EvidenceGraph,
  type EvidenceNode,
  type EvidenceSubject,
  type MemoryDigest,
  type OwnerFact,
  type QuantityId,
  type RunMode,
  type SealLevel,
} from '@ibasho/core';
import type { Story, StoryContext } from '../narrator/template.ts';
import { PICKS, type PickKey } from '../narrator/template.ts';
import { BundleError, buildBundle, type DerivedEntry, type NodeEntry } from './bundle.ts';

export interface EngineStoryInput {
  homeId: string;
  /** ISO timestamp (the app clock, injected). */
  createdAt: string;
  locale: string;
  modelVersion: string;
  /** Evidence graph of the search result (only `nodes` is read). */
  graph: Pick<EvidenceGraph, 'nodes'>;
  /** Package ids by row (`SearchResult.packages.ids`). Ids are option ids joined by `+`. */
  packageIds: readonly string[];
  /** Pick rows (`SearchResult.picks`). */
  picks: Partial<Record<PickKey, number>>;
  /** Rows in the check lane (`SearchResult.needsCheck`). */
  needsCheck?: ArrayLike<number>;
  /** Run mode to narrate. Default `your-home`. */
  mode?: RunMode;
  memory: MemoryDigest;
  facts?: readonly OwnerFact[];
  /** Words beside the evidence (next step, chosen pick, why-not list). Picks and packages are filled here. */
  context?: Omit<StoryContext, 'picks' | 'packages'>;
}

const BASELINE = 'baseline';
const SEAL_ORDER: readonly SealLevel[] = ['cracked', 'unverified', 'modelled', 'checked'];

/** Weakest seal of the parts: a sum is no stronger than its weakest input. */
function weakest(nodes: readonly EvidenceNode[]): SealLevel {
  let at = SEAL_ORDER.length - 1;
  for (const n of nodes) at = Math.min(at, SEAL_ORDER.indexOf(n.seal));
  return SEAL_ORDER[at] ?? 'unverified';
}

class GraphIndex {
  private readonly byKey = new Map<string, EvidenceNode>();
  private readonly homeId: string;
  private readonly mode: RunMode;
  constructor(nodes: readonly EvidenceNode[], homeId: string, mode: RunMode) {
    this.homeId = homeId;
    this.mode = mode;
    for (const n of nodes) {
      if (n.subject.mode !== mode && n.subject.mode !== undefined) continue;
      this.byKey.set(GraphIndex.key(n.quantity, n.subject.packageId), n);
    }
  }
  static key(quantity: string, packageId: string | undefined) {
    return `${packageId ?? ''}|${quantity}`;
  }
  get(quantity: string, packageId: string): EvidenceNode | undefined {
    return this.byKey.get(GraphIndex.key(quantity, packageId));
  }
  hasPackage(packageId: string): boolean {
    return this.get('money.bill_saving', packageId) !== undefined || this.get('fin.n0', packageId) !== undefined;
  }
  /** Twelve monthly nodes `<prefix>.0` (January) to `<prefix>.11`, as the engine numbers them; undefined when any is missing. */
  months(prefix: string, packageId: string): EvidenceNode[] | undefined {
    const out: EvidenceNode[] = [];
    for (let m = 0; m < 12; m++) {
      const n = this.get(`${prefix}.${m}`, packageId);
      if (!n) return undefined;
      out.push(n);
    }
    return out;
  }
  /** An exact sum node over `parts` (fixed point added as bigint; floats added in a fixed order). */
  sum(quantity: QuantityId, packageId: string, parts: readonly EvidenceNode[], doc: string): EvidenceNode | undefined {
    if (parts.length === 0) return undefined;
    const unit = parts[0]!.unit;
    if (parts.some((p) => p.unit !== unit)) throw new BundleError(`${quantity}: parts have mixed units`);
    let value: EvidenceNode['value'];
    if (parts.every((p) => 'fixed' in p.value)) {
      let s = 0n;
      for (const p of parts) s += BigInt((p.value as { fixed: string }).fixed);
      value = { fixed: s.toString(), unit };
    } else if (parts.every((p) => 'float' in p.value)) {
      let s = 0;
      for (const p of parts) s += (p.value as { float: number }).float;
      value = { float: s };
    } else return undefined;
    const subject: EvidenceSubject = { homeId: this.homeId, packageId, mode: this.mode };
    return {
      id: evidenceId(quantity, subject),
      quantity,
      subject,
      value,
      unit,
      formula: { id: 'NARR.SUM.MONTHS', doc },
      inputs: parts.map((p, i) => ({ id: p.id, role: `part ${i + 1}` })),
      provenance: { kind: 'computed' },
      seal: weakest(parts),
      rounding: { mode: 'sig', value: 3 },
    };
  }
}

/** Measures of a package id (`a+b+c`), baseline has none. */
export function measuresOfPackage(packageId: string): string[] {
  return packageId === BASELINE ? [] : packageId.split('+').filter((s) => s.length > 0);
}

function signOfSaving(node: EvidenceNode): 'saving' | 'increase' | 'neutral' {
  const v = node.value;
  const n = 'fixed' in v ? BigInt(v.fixed) : 'float' in v ? v.float : 0;
  return n > 0 ? 'saving' : n < 0 ? 'increase' : 'neutral';
}

const toBig = (n: EvidenceNode): bigint => ('fixed' in n.value ? BigInt(n.value.fixed) : 0n);

/** Build a narratable `Story` from a real search result. */
export function storyFromEngine(input: EngineStoryInput): Story {
  const mode = input.mode ?? 'your-home';
  const g = new GraphIndex(input.graph.nodes, input.homeId, mode);
  const nodes: NodeEntry[] = [];
  const derived: DerivedEntry[] = [];
  const add = (e: NodeEntry | undefined) => {
    if (e) nodes.push(e);
  };
  const at = (quantity: string, pkg: string) => g.get(quantity, pkg);

  // Today (baseline).
  const billGas = at('money.bill.gas', BASELINE);
  const billElec = at('money.bill.electricity', BASELINE);
  const bills = [billGas, billElec].filter((n): n is EvidenceNode => n !== undefined);
  const billTotal = g.sum('money.bill.year', BASELINE, bills, 'annual bill = gas bill + electricity bill');
  if (billTotal) add({ role: 'home.bill', node: billTotal, kind: 'cost', label: 'energy bill per year' });
  if (billGas) add({ role: 'home.bill.gas', node: billGas, kind: 'cost', label: 'gas bill per year', fuel: 'gas' });
  if (billElec) add({ role: 'home.bill.electricity', node: billElec, kind: 'cost', label: 'electricity bill per year', fuel: 'electricity' });
  for (const fuel of ['gas', 'electricity'] as const) {
    const months = g.months(`energy.delivered.${fuel}`, BASELINE);
    const year = months && g.sum(`energy.delivered.${fuel}.year`, BASELINE, months, `annual ${fuel} = sum of the twelve months`);
    if (year) add({ role: `home.${fuel}`, node: year, kind: 'energy', label: `${fuel} use per year`, fuel });
  }
  const qh = g.months('heat.qh', BASELINE);
  const heat = qh && g.sum('heat.qh.year', BASELINE, qh, 'annual heat demand = sum of the twelve months');
  if (heat) add({ role: 'home.heatDemand', node: heat, kind: 'energy', label: 'heat needed per year' });

  // Packages in the graph (picks and anything else the engine sent).
  const rows = new Map<string, number>();
  input.packageIds.forEach((id, row) => {
    rows.set(id, row);
  });
  const packages: Record<string, { measures: string[] }> = {};
  const addPackage = (id: string, prefix: string) => {
    const upfront = at('fin.n0', id);
    if (upfront) add({ role: `${prefix}.upfront`, node: upfront, kind: 'cost', label: 'upfront cost after grants' });
    const saving = at('money.bill_saving', id);
    if (saving) add({ role: `${prefix}.saving`, node: saving, kind: 'costDelta', label: 'yearly bill saving', sign: signOfSaving(saving) });
    const carbon = at('acct.carbon_saving', id);
    if (carbon) add({ role: `${prefix}.carbon`, node: carbon, kind: 'carbonDelta', label: 'yearly running carbon saved', sign: signOfSaving(carbon) });
    const npv = at('fin.npv', id);
    if (npv) add({ role: `${prefix}.npv`, node: npv, kind: 'cost', label: 'net present value over the horizon' });
    for (const fuel of ['gas', 'electricity'] as const) {
      const months = g.months(`acct.saving.${fuel}`, id);
      const year = months && g.sum(`acct.saving.${fuel}.year`, id, months, `annual ${fuel} saving = sum of the twelve months`);
      if (year) add({ role: `${prefix}.${fuel}`, node: year, kind: 'energyDelta', label: `yearly ${fuel} saving`, fuel, sign: signOfSaving(year) });
    }
  };
  const graphPackages = [...rows.keys()].filter((id) => id !== BASELINE && g.hasPackage(id));
  for (const id of graphPackages) {
    packages[id] = { measures: measuresOfPackage(id) };
    addPackage(id, `pkg.${id}`);
  }

  // Picks: the engine chose them, so each is first for its criterion.
  const picks: StoryContext['picks'] = {};
  const RANK_LABEL: Record<PickKey, [string, string]> = {
    leastUpfront: ['rank by upfront cost', 'upfront'],
    bestReturn: ['rank by return (net present value)', 'npv'],
    lowestRunningCarbon: ['rank by running carbon saved', 'carbon'],
  };
  for (const p of PICKS) {
    const row = input.picks[p];
    const id = row === undefined ? undefined : input.packageIds[row];
    if (id === undefined || !g.hasPackage(id)) continue;
    picks[p] = { packageId: id, measures: measuresOfPackage(id) };
    addPackage(id, `pick.${p}`);
    const [label, basis] = RANK_LABEL[p];
    const of = `pick.${p}.${basis}`;
    if (nodes.some((n) => n.role === of)) {
      derived.push({ role: `pick.${p}.rank`, kind: 'rank', label, value: 1, of: [of], subject: { packageId: id } });
    }
  }

  // The single measure that moves the bill most (chapter 3), ranked among single measure packages.
  const singles = graphPackages
    .filter((id) => measuresOfPackage(id).length === 1)
    .map((id) => ({ id, node: at('money.bill_saving', id) }))
    .filter((x): x is { id: string; node: EvidenceNode } => x.node !== undefined && 'fixed' in x.node.value)
    .sort((a, b) => {
      const d = toBig(b.node) - toBig(a.node);
      return d > 0n ? 1 : d < 0n ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  let leverMeasure: string | undefined;
  const top = singles[0];
  if (top && signOfSaving(top.node) === 'saving') {
    leverMeasure = measuresOfPackage(top.id)[0];
    add({ role: 'lever.top.bill', node: top.node, kind: 'costDelta', label: 'yearly bill saving from the top lever alone', sign: 'saving' });
    derived.push({ role: 'lever.top.rank', kind: 'rank', label: 'rank of levers by bill saving', value: 1, of: ['lever.top.bill'], subject: { measureId: top.id } });
  }

  // Counts.
  if (input.memory.hiddenByRejection > 0) {
    derived.push({ role: 'hidden.count', kind: 'count', label: 'futures hidden by things you ruled out', value: input.memory.hiddenByRejection, of: [] });
  }
  if (input.needsCheck !== undefined) {
    derived.push({ role: 'needsCheck.count', kind: 'count', label: 'futures possible after a check', value: input.needsCheck.length, of: [] });
  }

  const { bundle, roles } = buildBundle({
    homeId: input.homeId,
    createdAt: input.createdAt,
    locale: input.locale,
    modelVersion: input.modelVersion,
    nodes,
    derived,
    facts: input.facts ?? [],
    memory: input.memory,
  });
  const context: StoryContext = { ...(input.context ?? {}), picks, packages };
  if (leverMeasure !== undefined && context.leverMeasure === undefined) context.leverMeasure = leverMeasure;
  return { bundle, roles, context };
}

/** Quantities `storyFromEngine` reads, for callers that trim a graph before storing it. */
export const ENGINE_STORY_QUANTITIES: readonly RegExp[] = [
  /^money\.bill\.(gas|electricity)$/,
  /^money\.bill_saving$/,
  /^acct\.carbon_saving$/,
  /^acct\.saving\.(gas|electricity)\.\d+$/,
  /^energy\.delivered\.(gas|electricity)\.\d+$/,
  /^heat\.qh\.\d+$/,
  /^fin\.(n0|npv)$/,
];
