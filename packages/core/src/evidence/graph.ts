/**
 * Evidence graph builder and index (ARCH 3 principle 3, ARCH 7). Owner: WP-00.
 *
 * The pipeline runner (WP-01) feeds stage drafts through `addDrafts`, which assigns ids and
 * resolves in-batch `key` references. `build()` checks that every input resolves (or is declared
 * external, for lazily fetched nodes) and that the graph is acyclic, then returns plain sorted data.
 */
import { compareStrings } from '../common.ts';
import { canonicalHash, canonicalJson } from '../hash.ts';
import type {
  EvidenceDraft,
  EvidenceGraph,
  EvidenceId,
  EvidenceNode,
  EvidenceSubject,
  QuantityId,
  SealLevel,
} from './types.ts';

export class EvidenceGraphError extends Error {
  override name = 'EvidenceGraphError';
}

/**
 * Deterministic id from quantity and subject: `ev_` plus the first 20 hex digits of the
 * canonical hash. The same quantity for the same subject always gets the same id.
 */
export function evidenceId(quantity: QuantityId, subject: EvidenceSubject): EvidenceId {
  return `ev_${canonicalHash({ quantity, subject }).slice(0, 20)}`;
}

export interface EvidenceGraphBuilder {
  /** Add a finished node. Re-adding an identical node is a no-op; a different one with the same id throws. */
  add(node: EvidenceNode): EvidenceId;
  /**
   * Add stage drafts. Ids come from `idFor` (default `evidenceId(quantity, subject)`); seals start at
   * `seal` (default the builder's `defaultSeal`). Inputs may name an id or the `key` of any draft
   * added earlier or in the same batch.
   */
  addDrafts(
    drafts: readonly EvidenceDraft[],
    opts?: { idFor?: (d: EvidenceDraft) => EvidenceId; seal?: SealLevel },
  ): EvidenceId[];
  /** Allow `id` to be referenced as an input without being in this graph (lazy evidence). */
  markExternal(id: EvidenceId): void;
  /** Id assigned to a draft key. */
  idOfKey(key: string): EvidenceId | undefined;
  has(id: EvidenceId): boolean;
  get(id: EvidenceId): EvidenceNode | undefined;
  readonly size: number;
  /** Validate and return the graph as plain data with nodes sorted by id. */
  build(): EvidenceGraph;
}

export interface EvidenceGraphBuilderOptions {
  /** Seal for drafts. The engine never decides seals; `verify` upgrades them (ARCH 7). */
  defaultSeal?: SealLevel;
}

export function createEvidenceGraphBuilder(opts: EvidenceGraphBuilderOptions = {}): EvidenceGraphBuilder {
  const defaultSeal: SealLevel = opts.defaultSeal ?? 'unverified';
  const nodes = new Map<EvidenceId, EvidenceNode>();
  const external = new Set<EvidenceId>();
  const keys = new Map<string, EvidenceId>();

  const add = (node: EvidenceNode): EvidenceId => {
    if (!node.id.startsWith('ev_'))
      throw new EvidenceGraphError(`evidence id must start with ev_: ${node.id}`);
    const prev = nodes.get(node.id);
    if (prev) {
      if (canonicalJson(prev) !== canonicalJson(node)) {
        throw new EvidenceGraphError(`conflicting evidence nodes for id ${node.id} (${node.quantity})`);
      }
      return node.id;
    }
    nodes.set(node.id, node);
    return node.id;
  };

  return {
    add,
    addDrafts(drafts, o = {}) {
      const idFor = o.idFor ?? ((d: EvidenceDraft) => evidenceId(d.quantity, d.subject));
      const seal = o.seal ?? defaultSeal;
      // First pass: assign ids so in-batch keys resolve regardless of order.
      const ids = drafts.map((d) => {
        const id = idFor(d);
        if (d.key !== undefined) {
          const prev = keys.get(d.key);
          if (prev !== undefined && prev !== id) throw new EvidenceGraphError(`draft key ${d.key} reused`);
          keys.set(d.key, id);
        }
        return id;
      });
      drafts.forEach((d, i) => {
        const { key: _key, inputs, ...rest } = d;
        const resolved = inputs.map((inp) => {
          const id = inp.id ?? (inp.key !== undefined ? keys.get(inp.key) : undefined);
          if (id === undefined) {
            throw new EvidenceGraphError(
              `draft ${d.quantity}: input ${inp.key ?? '(no id or key)'} does not resolve`,
            );
          }
          return { id, role: inp.role };
        });
        add({ ...rest, id: ids[i]!, inputs: resolved, seal });
      });
      return ids;
    },
    markExternal(id) {
      external.add(id);
    },
    idOfKey: (key) => keys.get(key),
    has: (id) => nodes.has(id),
    get: (id) => nodes.get(id),
    get size() {
      return nodes.size;
    },
    build() {
      const usedExternal = new Set<EvidenceId>();
      for (const n of nodes.values()) {
        for (const inp of n.inputs) {
          if (nodes.has(inp.id)) continue;
          if (external.has(inp.id)) usedExternal.add(inp.id);
          else throw new EvidenceGraphError(`node ${n.id} (${n.quantity}) has dangling input ${inp.id}`);
        }
      }
      assertAcyclic(nodes);
      const sorted = [...nodes.values()].sort((a, b) => compareStrings(a.id, b.id));
      return {
        schema: 'ibasho.evidence/1',
        nodes: sorted,
        external: [...usedExternal].sort(compareStrings),
      };
    },
  };
}

function assertAcyclic(nodes: ReadonlyMap<EvidenceId, EvidenceNode>): void {
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color = new Map<EvidenceId, number>();
  for (const start of nodes.keys()) {
    if ((color.get(start) ?? WHITE) !== WHITE) continue;
    const stack: { id: EvidenceId; i: number }[] = [{ id: start, i: 0 }];
    color.set(start, GREY);
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const node = nodes.get(top.id);
      const inputs = node ? node.inputs : [];
      if (top.i < inputs.length) {
        const next = inputs[top.i++]!.id;
        if (!nodes.has(next)) continue;
        const c = color.get(next) ?? WHITE;
        if (c === GREY) throw new EvidenceGraphError(`evidence cycle through ${next}`);
        if (c === WHITE) {
          color.set(next, GREY);
          stack.push({ id: next, i: 0 });
        }
      } else {
        color.set(top.id, BLACK);
        stack.pop();
      }
    }
  }
}

export interface EvidenceIndex {
  get(id: EvidenceId): EvidenceNode | undefined;
  inputsOf(id: EvidenceId): EvidenceNode[];
  dependentsOf(id: EvidenceId): EvidenceNode[];
  /** Transitive inputs of `id` inside the graph, dependencies first, excluding `id`. */
  closure(id: EvidenceId): EvidenceId[];
  byQuantity(quantity: QuantityId): EvidenceNode[];
}

/** Read-side index over a built graph. */
export function indexGraph(g: EvidenceGraph): EvidenceIndex {
  const byId = new Map<EvidenceId, EvidenceNode>();
  const deps = new Map<EvidenceId, EvidenceNode[]>();
  const byQ = new Map<QuantityId, EvidenceNode[]>();
  for (const n of g.nodes) {
    byId.set(n.id, n);
    const list = byQ.get(n.quantity) ?? [];
    list.push(n);
    byQ.set(n.quantity, list);
  }
  for (const n of g.nodes) {
    for (const inp of n.inputs) {
      const list = deps.get(inp.id) ?? [];
      list.push(n);
      deps.set(inp.id, list);
    }
  }
  return {
    get: (id) => byId.get(id),
    inputsOf: (id) => (byId.get(id)?.inputs ?? []).flatMap((i) => byId.get(i.id) ?? []),
    dependentsOf: (id) => deps.get(id) ?? [],
    closure(id) {
      const out: EvidenceId[] = [];
      const seen = new Set<EvidenceId>([id]);
      const visit = (cur: EvidenceId) => {
        for (const inp of byId.get(cur)?.inputs ?? []) {
          if (seen.has(inp.id) || !byId.has(inp.id)) continue;
          seen.add(inp.id);
          visit(inp.id);
          out.push(inp.id);
        }
      };
      visit(id);
      return out;
    },
    byQuantity: (q) => byQ.get(q) ?? [],
  };
}

/** Merge lazily fetched nodes into a graph. Conflicting nodes for one id throw. */
export function mergeGraphs(a: EvidenceGraph, b: EvidenceGraph): EvidenceGraph {
  const builder = createEvidenceGraphBuilder();
  for (const n of a.nodes) builder.add(n);
  for (const n of b.nodes) builder.add(n);
  for (const id of [...a.external, ...b.external]) builder.markExternal(id);
  return builder.build();
}

/** Content hash of a graph. */
export function graphHash(g: EvidenceGraph): string {
  return canonicalHash(g);
}
