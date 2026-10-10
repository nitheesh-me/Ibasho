/**
 * Headless tool logic: engine calls through `EngineApi`, a small result cache, and payloads in
 * which every number is an evidence view. Owner: WP-12.
 */

import { pathToFileURL } from 'node:url';
import {
  type CheckerRung,
  canonicalHash,
  type EvidenceGraph,
  type EvidenceId,
  type EvidenceNode,
  type HomeTwin,
  type IsoDate,
  PACKAGE_STATUS,
  type RunMode,
  type SearchResult,
  type SimBundle,
  type Target,
  type Verdict,
} from '@ibasho/core';
import { catalogueLoader, type MeasureCatalogue, optionsFor } from './catalogue.ts';
import type { EngineSource } from './engine.ts';
import { type EvView, pick, view } from './evidence.ts';
import type { HomeCatalog } from './homes.ts';
import type { MemoryLog } from './memory.ts';
import { applyOps, opLabel, ownerCtx, type RejectedOp } from './ops.ts';
import { repoPath } from './paths.ts';

const STATUS_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(PACKAGE_STATUS).map(([k, v]) => [v, k]),
);
const NO_WITNESS = 0xffffffff;

type Cached =
  | { kind: 'search'; homeId: string; twin: HomeTwin; result: SearchResult }
  | { kind: 'sim'; homeId: string; twin: HomeTwin; bundle: SimBundle; packageId: string };

export function todayIso(now: Date = new Date()): IsoDate {
  return now.toISOString().slice(0, 10) as IsoDate;
}

export interface HeadlessDeps {
  engine: EngineSource;
  homes: HomeCatalog;
  memory: MemoryLog;
  now?: () => Date;
  /** Loads the TS mirror checker (WP-04); default imports `packages/verify/src/index.ts`. */
  loadMirror?: () => Promise<CheckerRung | null>;
  /** Measure catalogue per home pack; default loads `packs/<pack>/src/ids.ts`. */
  loadCatalogue?: (pack: string) => Promise<MeasureCatalogue | null>;
}

export async function defaultLoadMirror(): Promise<CheckerRung | null> {
  try {
    const mod = (await import(
      /* @vite-ignore */ pathToFileURL(repoPath('packages/verify/src/index.ts')).href
    )) as {
      mirrorRung?: CheckerRung;
      createMirrorRung?: () => CheckerRung;
    };
    return mod.mirrorRung ?? mod.createMirrorRung?.() ?? null;
  } catch {
    return null;
  }
}

export class Headless {
  readonly #d: HeadlessDeps;
  readonly #cache = new Map<string, Cached>();
  readonly #limit = 16;
  readonly #catalogue: ReturnType<typeof catalogueLoader>;

  constructor(deps: HeadlessDeps) {
    this.#d = deps;
    this.#catalogue = catalogueLoader(deps.loadCatalogue);
  }

  /** Measures with their group and option ids, for the agent to build ops from. */
  async measures(twin: HomeTwin) {
    const cat = await this.#catalogue(twin.region);
    if (!cat) return null;
    return {
      pack: cat.pack,
      measures: Object.entries(cat.measures).map(([measureId, m]) => ({
        measureId,
        group: m.group,
        options: [...m.options],
      })),
    };
  }

  #asOf(): IsoDate {
    return todayIso(this.#d.now?.() ?? new Date());
  }

  #remember(hash: string, c: Cached): void {
    this.#cache.delete(hash);
    this.#cache.set(hash, c);
    while (this.#cache.size > this.#limit) {
      const first = this.#cache.keys().next().value;
      if (first === undefined) break;
      this.#cache.delete(first);
    }
  }

  cached(hash: string): Cached | undefined {
    return this.#cache.get(hash);
  }

  #getCached(hash: string): Cached {
    const c = this.#cache.get(hash);
    if (!c) {
      throw new Error(
        `unknown result hash "${hash}". Results live in memory for this MCP session; run ibasho_simulate or ibasho_search_futures again.`,
      );
    }
    return c;
  }

  async simulate(homeId: string, modes: RunMode[], prefixes?: string[]) {
    const { entry, twin } = this.#d.homes.get(homeId);
    const engine = await this.#d.engine.engine();
    const bundle = await engine.simulate({ twin, modes, asOf: this.#asOf() });
    this.#remember(bundle.hash, { kind: 'sim', homeId: entry.id, twin, bundle, packageId: 'baseline' });
    return {
      homeId: entry.id,
      resultHash: bundle.hash,
      modes,
      evidence: pick(bundle.graph, prefixes ? { prefixes } : {}),
    };
  }

  async whatIf(homeId: string, ops: unknown[], modes: RunMode[], prefixes?: string[]) {
    const { entry, twin } = this.#d.homes.get(homeId);
    const applied = applyOps(twin, ops, await this.#catalogue(twin.region));
    const rejected = applied.rejected.map((r) => ({ op: opLabel(r.op), code: r.code, detail: r.detail }));
    const accepted = applied.accepted.map(opLabel);
    if (applied.accepted.length === 0) {
      return { homeId: entry.id, accepted, rejected, note: 'no op was accepted; nothing ran' };
    }
    const engine = await this.#d.engine.engine();
    const asOf = this.#asOf();
    const base = await engine.simulate({ twin, modes, asOf });
    const variant = await engine.simulate({ twin: applied.twin, pkg: applied.pkg, modes, asOf });
    this.#remember(base.hash, { kind: 'sim', homeId: entry.id, twin, bundle: base, packageId: 'baseline' });
    this.#remember(variant.hash, {
      kind: 'sim',
      homeId: entry.id,
      twin: applied.twin,
      bundle: variant,
      packageId: applied.pkg.id,
    });
    const opts = prefixes ? { prefixes } : {};
    const deltas = pick(variant.graph, {
      prefixes: ['acct.saving.', 'acct.carbon_saving', 'money.bill_saving'],
    });
    return {
      homeId: entry.id,
      accepted,
      rejected,
      packageId: applied.pkg.id,
      before: { resultHash: base.hash, evidence: pick(base.graph, opts) },
      after: { resultHash: variant.hash, evidence: pick(variant.graph, opts) },
      deltas,
      note:
        deltas.length === 0
          ? 'The engine emitted no saving nodes for this run. Compare before and after by quantity; do not subtract values yourself in prose.'
          : 'Deltas are engine evidence (acct.saving per fuel). Quote them with their ev ids.',
    };
  }

  async searchFutures(
    homeId: string,
    opts: { target?: Target; budgetGBP?: number | undefined; horizonYears?: number | undefined },
  ) {
    const { entry, twin } = this.#d.homes.get(homeId);
    const prefs = this.#d.memory.preferences(entry.id);
    const tenure = prefs.tenure === 'unknown' ? 'unknown' : prefs.tenure;
    const owner = ownerCtx(tenure, {
      budgetGBP: opts.budgetGBP ?? prefs.budgetCapGBP,
      horizonYears: opts.horizonYears ?? prefs.horizonYears,
    });
    const engine = await this.#d.engine.engine();
    const job = await engine.search({
      twin,
      owner,
      target: opts.target ?? { kind: 'default' },
      memory: {
        rejected: Object.keys(prefs.rejected).sort(),
        completed: Object.keys(prefs.completed).sort(),
      },
      asOf: this.#asOf(),
    });
    const result = await job.result;
    this.#remember(result.hash, { kind: 'search', homeId: entry.id, twin, result });
    return this.#searchPayload(entry.id, result);
  }

  #searchPayload(homeId: string, r: SearchResult) {
    const t = r.packages;
    const idOf = (i: number | undefined) => (i === undefined ? null : (t.ids[i] ?? null));
    const futureEvidence = (pkgId: string) =>
      pick(r.graph, {
        prefixes: [
          'fin.n0',
          'fin.npv',
          'fin.payback',
          'acct.carbon_saving',
          'money.bill_saving',
          'score.total',
        ],
        packageId: pkgId,
      });
    const front = Array.from(r.front, (i) => {
      const id = t.ids[i] ?? `#${i}`;
      return {
        packageId: id,
        status: STATUS_NAME[t.status[i] ?? 0] ?? 'unknown',
        evidence: futureEvidence(id),
      };
    });
    const whyNot: { packageId: string; status: string; ruleIds: string[]; dominatedBy: string | null }[] = [];
    const onFront = new Set(r.front);
    for (let i = 0; i < t.ids.length && whyNot.length < 25; i++) {
      if (onFront.has(i)) continue;
      const st = t.status[i] ?? 0;
      if (st === PACKAGE_STATUS.feasible && (t.witness[i] ?? NO_WITNESS) === NO_WITNESS) continue;
      const w = t.witness[i] ?? NO_WITNESS;
      whyNot.push({
        packageId: t.ids[i] ?? `#${i}`,
        status: STATUS_NAME[st] ?? 'unknown',
        ruleIds: t.ruleIds[i] ?? [],
        dominatedBy: w === NO_WITNESS ? null : idOf(w),
      });
    }
    return {
      homeId,
      resultHash: r.hash,
      specHash: r.specHash,
      certificateHash: canonicalHash(r.certificate),
      baseline: pick(r.graph, { packageId: null }),
      picks: {
        leastUpfront: idOf(r.picks.leastUpfront),
        bestReturn: idOf(r.picks.bestReturn),
        lowestRunningCarbon: idOf(r.picks.lowestRunningCarbon),
      },
      front,
      needsCheck: Array.from(r.needsCheck, (i) => ({
        packageId: t.ids[i] ?? `#${i}`,
        ruleIds: t.ruleIds[i] ?? [],
      })),
      whyNot,
      note: 'Picks and front members are package ids; their numbers are in evidence. Use ibasho_why_not for a measure that is missing, ibasho_evidence to open any ev id.',
    };
  }

  async evidence(evidenceId: string, resultHash?: string) {
    const fromGraph = (g: EvidenceGraph) => g.nodes.find((n) => n.id === evidenceId);
    let node: EvidenceNode | undefined;
    let hash = resultHash;
    if (resultHash) {
      const c = this.#getCached(resultHash);
      node = fromGraph(c.kind === 'search' ? c.result.graph : c.bundle.graph);
    } else {
      for (const [h, c] of this.#cache) {
        node = fromGraph(c.kind === 'search' ? c.result.graph : c.bundle.graph);
        if (node) {
          hash = h;
          break;
        }
      }
    }
    if (!node && hash) {
      const engine = await this.#d.engine.engine();
      [node] = await engine.evidence(hash, [evidenceId as EvidenceId]);
    }
    if (!node) throw new Error(`evidence ${evidenceId} not found; pass the resultHash it came from`);
    return {
      resultHash: hash ?? null,
      node: view(node),
      formula: node.formula,
      inputs: node.inputs.map((i) => ({ ev: i.id, role: i.role })),
      provenance: {
        kind: node.provenance.kind,
        plugin: node.provenance.plugin?.id ?? null,
        grade: node.provenance.grade ?? null,
        sources: (node.provenance.sources ?? []).map((s) => ({ ...s })),
      },
      seal: node.seal,
      check: node.check ?? null,
    };
  }

  async whyNot(resultHash: string, measureOrOption: string) {
    const c = this.#getCached(resultHash);
    if (c.kind !== 'search') throw new Error('why-not needs a search result hash (ibasho_search_futures)');
    const r = c.result;
    const t = r.packages;
    const cat = await this.#catalogue(c.twin.region);
    const wanted = new Set(optionsFor(cat, measureOrOption));
    if (wanted.size === 0) wanted.add(measureOrOption);
    const mentions = (pkgId: string) => pkgId.split('+').some((opt) => wanted.has(opt));
    const prefs = this.#d.memory.preferences(c.homeId);
    const ruledOut = prefs.rejected[measureOrOption];
    const rows: number[] = [];
    for (let i = 0; i < t.ids.length; i++) if (mentions(t.ids[i] ?? '')) rows.push(i);
    const front = new Set(r.front);
    const onFront = rows.filter((i) => front.has(i)).map((i) => t.ids[i]);
    const tally: Record<string, { packages: string[]; ruleIds: string[] }> = {};
    for (const i of rows) {
      const st = STATUS_NAME[t.status[i] ?? 0] ?? 'unknown';
      const w = t.witness[i] ?? NO_WITNESS;
      const reason = st === 'feasible' ? (w === NO_WITNESS ? 'on-front' : 'dominated') : st;
      const slot = tally[reason] ?? { packages: [], ruleIds: [] };
      tally[reason] = slot;
      if (slot.packages.length < 5) slot.packages.push(t.ids[i] ?? `#${i}`);
      for (const rid of t.ruleIds[i] ?? []) if (!slot.ruleIds.includes(rid)) slot.ruleIds.push(rid);
    }
    const checksToUnlock = tally['needs-check']?.ruleIds ?? [];
    return {
      resultHash,
      measure: measureOrOption,
      options: [...wanted],
      ruledOutByYou: ruledOut ? { scope: ruledOut.scope, at: ruledOut.at } : null,
      inSearch: rows.length > 0,
      onFront,
      reasons: tally,
      checksToUnlock,
      explanation:
        rows.length === 0
          ? ruledOut
            ? 'You ruled this out, so the search never offered it (memory is passed to the search).'
            : 'No package in this search contains it: the measure is not applicable to this home, or its pack is not loaded.'
          : onFront.length > 0
            ? 'It is on the front in at least one package.'
            : 'Every package with it is blocked, needs a check, misses the target, or is dominated. See reasons.',
    };
  }

  async verify(resultHash: string) {
    const c = this.#getCached(resultHash);
    if (c.kind !== 'search') throw new Error('verify needs a search result hash (ibasho_search_futures)');
    const rung = await (this.#d.loadMirror ?? defaultLoadMirror)();
    if (!rung || !(await rung.available())) {
      return {
        resultHash,
        certificateHash: canonicalHash(c.result.certificate),
        checked: false,
        rung: null,
        note: 'No checker is available yet (packages/verify, WP-04). Nothing is claimed as Checked.',
      };
    }
    const verdicts: Verdict[] = await rung.check(c.result.certificate, 'all');
    const failed = verdicts.filter((v) => !v.ok);
    return {
      resultHash,
      certificateHash: canonicalHash(c.result.certificate),
      checked: failed.length === 0,
      rung: rung.rung,
      verdicts: verdicts.map((v) => ({
        check: v.check,
        ok: v.ok,
        coverage: v.coverage,
        detail: v.detail ?? null,
      })),
      failed: failed.map((v) => v.check),
    };
  }

  certificate(hash: string): unknown {
    for (const c of this.#cache.values()) {
      if (c.kind === 'search' && (c.result.hash === hash || canonicalHash(c.result.certificate) === hash)) {
        return c.result.certificate;
      }
    }
    return null;
  }

  async compareHomes(a: string, b: string, modes: RunMode[], prefixes?: string[]) {
    const [x, y] = await Promise.all([this.simulate(a, modes, prefixes), this.simulate(b, modes, prefixes)]);
    return { kind: 'homes', a: x, b: y };
  }

  comparePackages(resultHash: string, a: string, b: string) {
    const c = this.#getCached(resultHash);
    if (c.kind !== 'search') throw new Error('package comparison needs a search result hash');
    const side = (id: string) => {
      const i = c.result.packages.ids.indexOf(id);
      if (i < 0) throw new Error(`package ${id} is not in result ${resultHash}`);
      return {
        packageId: id,
        status: STATUS_NAME[c.result.packages.status[i] ?? 0] ?? 'unknown',
        ruleIds: c.result.packages.ruleIds[i] ?? [],
        evidence: pick(c.result.graph, {
          packageId: id,
          prefixes: ['fin.', 'acct.', 'money.', 'score.', 'epc.'],
        }),
      };
    };
    return {
      kind: 'packages',
      resultHash,
      a: side(a),
      b: side(b),
      note: 'Evidence for packages off the front may be lazy; open ids with ibasho_evidence.',
    };
  }
}

export type { EvView, RejectedOp };
