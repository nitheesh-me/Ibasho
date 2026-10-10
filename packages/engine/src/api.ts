/**
 * `EngineApi` implementation (ARCH 5.5). Owner: WP-02.
 *
 * Runs in the worker (see `worker.ts`) or directly in Node for tests and the CI proxy. Plugins come
 * from the engine half of the module manifest: `init` loads the modules whose ids it is given,
 * registers them as one batch and checks the shared fingerprint against the main thread's
 * (ARCH 4.1 boot, DEC TE-6).
 *
 * M-0 implements `init`, `simulate`, `search` (sliced, cancellable, with progress), `cancel` and
 * `evidence`. The rest throw `NotImplementedYet` naming the milestone (PLACEHOLDER): `uncertainty`,
 * `flips` (M-B, WP-02), `calibrate`, `valueOfInformation` (M-A/M-D, WP-01), `noise` (M-B, WP-03).
 */
import {
  type AnyPlugin,
  assertSharedFingerprint,
  createEvidenceGraphBuilder,
  createRegistry,
  type EngineApi,
  type EvidenceId,
  type EvidenceNode,
  indexGraph,
  type KernelRegistry,
  type ModuleRef,
  RUN_MODES,
  type SearchRequest,
  type SearchResult,
} from '@ibasho/core';
import { simulateBundle } from './pipeline/index.ts';
import { envFromRegistry } from './search/env.ts';
import { addPackageEvidence, runSearch, type SearchState } from './search/run.ts';
import { Slicer } from './search/slicer.ts';

export class NotImplementedYet extends Error {
  override name = 'NotImplementedYet';
}
export class EngineNotReady extends Error {
  override name = 'EngineNotReady';
}

export interface EngineOptions {
  /** Engine half of the module manifest (apps/web/src/manifest.ts). */
  modules?: readonly ModuleRef[];
  /** Plugins to register directly (tests, CI proxy). Registered at `init` with the modules. */
  plugins?: readonly AnyPlugin[];
  /** Option ids the search may use; `M0_OPTION_IDS` gives the 8-package walking skeleton. */
  allowOptions?: readonly string[];
  /** Search slice length in ms before yielding for a cancel (ARCH 5.5: about 20). */
  sliceMs?: number;
  /** Finished searches kept for `evidence` (LRU). */
  keepResults?: number;
}

/** The engine plus a few handles tests and the worker wrapper use. */
export interface Engine extends EngineApi {
  readonly registry: KernelRegistry;
  /** Lazy-evidence state of a finished search, by result hash. */
  stateOf(resultHash: string): SearchState | undefined;
}

export function createEngine(opts: EngineOptions = {}): Engine {
  const registry = createRegistry();
  let ready = false;
  let jobSeq = 0;
  const cancelled = new Set<string>();
  const states = new Map<string, SearchState>();
  const keep = opts.keepResults ?? 4;
  const lazyGraphs = new Map<string, Map<string, EvidenceNode[]>>();

  const need = () => {
    if (!ready) throw new EngineNotReady('call init() first');
  };
  const remember = (s: SearchState) => {
    states.delete(s.result.hash);
    states.set(s.result.hash, s);
    while (states.size > keep) {
      const oldest = states.keys().next().value as string;
      states.delete(oldest);
      lazyGraphs.delete(oldest);
    }
  };

  const packageNodes = (s: SearchState, packageId: string): EvidenceNode[] => {
    let perHash = lazyGraphs.get(s.result.hash);
    if (!perHash) {
      perHash = new Map();
      lazyGraphs.set(s.result.hash, perHash);
    }
    const hit = perHash.get(packageId);
    if (hit) return hit;
    const r = s.rows.findIndex((p) => p.id === packageId);
    if (r < 0) throw new RangeError(`no package ${packageId} in result ${s.result.hash}`);
    const builder = createEvidenceGraphBuilder();
    addPackageEvidence(builder, s, 0);
    if (r !== 0) addPackageEvidence(builder, s, r);
    const nodes = builder.build().nodes.filter((n) => n.subject.packageId === packageId);
    perHash.set(packageId, nodes);
    return nodes;
  };

  const engine: Engine = {
    registry,
    stateOf: (h) => states.get(h),

    async init(manifestIds, sharedFingerprint) {
      const refs = (opts.modules ?? []).filter((m) => manifestIds.includes(m.id));
      const missing = manifestIds.filter((id) => !(opts.modules ?? []).some((m) => m.id === id));
      if (missing.length) throw new EngineNotReady(`unknown engine modules: ${missing.join(', ')}`);
      const plugins: AnyPlugin[] = [...(opts.plugins ?? [])];
      for (const ref of refs) plugins.push(...(await (await ref.load()).default.load()));
      registry.registerAll(plugins);
      assertSharedFingerprint(registry, sharedFingerprint);
      ready = true;
    },

    async simulate(req) {
      need();
      if (req.thermal) throw new NotImplementedYet('5R1C thermal runs land at M-A (WP-01)');
      const env = envFromRegistry(registry, req.twin, req.asOf);
      const modes = req.modes.length ? req.modes : RUN_MODES;
      return simulateBundle(
        { twin: req.twin, modes, asOf: req.asOf, ...(req.pkg ? { pkg: req.pkg } : {}) },
        env.pipeline,
      );
    },

    async search(req: SearchRequest, onProgress) {
      need();
      const jobId = `job-${++jobSeq}`;
      const env = envFromRegistry(registry, req.twin, req.asOf, opts.allowOptions);
      const slicer = new Slicer(jobId, () => cancelled.has(jobId), opts.sliceMs ?? 20);
      const result: Promise<SearchResult> = runSearch(req, env, slicer, onProgress).then(
        (s) => {
          cancelled.delete(jobId);
          remember(s);
          return s.result;
        },
        (e: unknown) => {
          cancelled.delete(jobId);
          throw e;
        },
      );
      // A caller that never awaits a cancelled job must not surface an unhandled rejection; this
      // extra handler does not change what awaiting callers see.
      result.catch(() => undefined);
      return { jobId, result };
    },

    cancel(jobId) {
      cancelled.add(jobId);
    },

    async evidence(resultHash, ids) {
      const s = states.get(resultHash);
      if (!s) throw new RangeError(`no result ${resultHash} in this worker (it may have been evicted)`);
      if (Array.isArray(ids)) {
        const idx = indexGraph(s.result.graph);
        const lazy = [...(lazyGraphs.get(resultHash)?.values() ?? [])].flat();
        const byId = new Map(lazy.map((n) => [n.id, n]));
        return ids.flatMap((id: EvidenceId) => idx.get(id) ?? byId.get(id) ?? []);
      }
      const { quantity, packageId } = ids;
      const match = (q: string) => q === quantity || q.startsWith(`${quantity}.`);
      if (packageId === undefined) return s.result.graph.nodes.filter((n) => match(n.quantity));
      return packageNodes(s, packageId).filter((n) => match(n.quantity));
    },

    async uncertainty() {
      throw new NotImplementedYet('uncertainty (LHS 200) lands at M-B (WP-02)');
    },
    async calibrate() {
      throw new NotImplementedYet('calibration lands at M-A (WP-01)');
    },
    async valueOfInformation() {
      throw new NotImplementedYet('value of information lands at M-D (WP-01)');
    },
    async flips() {
      throw new NotImplementedYet('flip points land at M-B (WP-02)');
    },
    async noise() {
      throw new NotImplementedYet('the noise rule lands at M-B (WP-03)');
    },
  };
  return engine;
}
