/**
 * Kernel plugin registry (ARCH 4.1). Owner: WP-00.
 *
 * Per-plugin checks run on `register` (ids, dates, provenance, visual layers, rule packs, shape).
 * Cross-plugin checks (dependencies, measure-cost coverage) need the full set, so they run in
 * `validate()` and in `registerAll()`, which is what boot code should call.
 */
import { NAMED_FNS } from '@ibasho/spec-gen';
import { compareStrings, isIsoDate, isSemVer, regionContains } from '../common.ts';
import { Q } from '../exact/q.ts';
import type { MaintenancePlugin } from '../maintenance.ts';
import { exprFns } from '../rules.ts';
import { sha256Hex } from '../sha256.ts';
import type { AnyPlugin, ModuleRef, PluginOf, PluginRegistry } from './kind-map.ts';
import { NUMERIC_PLUGIN_KINDS, PLUGIN_KINDS, type PluginKind, type Query } from './types.ts';

export type RegistryCheck =
  | 'shape'
  | 'ids'
  | 'dates'
  | 'dependencies'
  | 'provenance'
  | 'visual-layers'
  | 'rule-packs'
  | 'measure-ids'
  | 'side'
  | 'maintenance';

export interface RegistryIssue {
  pluginId: string;
  check: RegistryCheck;
  message: string;
}

export class RegistryError extends Error {
  override name = 'RegistryError';
  readonly issues: readonly RegistryIssue[];
  constructor(issues: readonly RegistryIssue[]) {
    super(issues.map((i) => `[${i.check}] ${i.pluginId}: ${i.message}`).join('\n'));
    this.issues = issues;
  }
}

export interface RegistryOptions {
  /** Named rule functions defined in Lean. Defaults to `@ibasho/spec-gen` `NAMED_FNS`. */
  namedFns?: readonly string[];
}

export interface KernelRegistry extends PluginRegistry {
  /** Register a batch, then run cross-plugin checks. Throws one `RegistryError` with every issue. */
  registerAll(plugins: readonly AnyPlugin[]): void;
  /** Cross-plugin checks over everything registered so far. */
  validate(): RegistryIssue[];
  /** Every registered id, sorted. */
  ids(): string[];
  readonly size: number;
}

/** Plugin ids: lowercase segments joined by `-`, `.` or `/` (e.g. `prices/reference-v1`). */
const PLUGIN_ID = /^[a-z0-9]+(?:[-./][a-z0-9]+)*$/;
const KINDS: ReadonlySet<string> = new Set(PLUGIN_KINDS);

/** Does plugin `p` match query `q`? Exposed for tests and for `fingerprint`. */
export function matchesQuery(p: AnyPlugin, q: Query = {}): boolean {
  if (q.side !== undefined && p.side !== q.side) return false;
  if (q.ids !== undefined && !q.ids.includes(p.id)) return false;
  if (q.region !== undefined && p.regions !== undefined) {
    const region = q.region;
    if (!p.regions.some((r) => regionContains(r, region))) return false;
  }
  if (q.asOf !== undefined) {
    if (p.validFrom !== undefined && p.validFrom > q.asOf) return false;
    if (p.validTo !== undefined && q.asOf > p.validTo) return false;
  }
  return true;
}

/** Checks that need only the plugin itself. */
export function checkPlugin(p: AnyPlugin, opts: RegistryOptions = {}): RegistryIssue[] {
  const issues: RegistryIssue[] = [];
  const id = typeof p.id === 'string' ? p.id : String(p.id);
  const add = (check: RegistryCheck, message: string) => issues.push({ pluginId: id, check, message });

  if (!KINDS.has(p.kind)) add('shape', `unknown kind ${JSON.stringify(p.kind)}`);
  if (!PLUGIN_ID.test(id)) add('ids', `id ${JSON.stringify(id)} is not a lowercase kebab id`);
  if (typeof p.version !== 'string' || !isSemVer(p.version))
    add('shape', `version ${String(p.version)} is not semver`);
  if (p.side !== 'engine' && p.side !== 'ui' && p.side !== 'both')
    add('shape', `side ${String(p.side)} is invalid`);

  if (p.validFrom !== undefined && !isIsoDate(p.validFrom))
    add('dates', `validFrom ${p.validFrom} is not a date`);
  if (p.validTo !== undefined && !isIsoDate(p.validTo)) add('dates', `validTo ${p.validTo} is not a date`);
  if (p.validFrom !== undefined && p.validTo !== undefined && p.validFrom > p.validTo) {
    add('dates', `validFrom ${p.validFrom} is after validTo ${p.validTo}`);
  }

  if (NUMERIC_PLUGIN_KINDS.has(p.kind)) {
    const pv = p.provenance;
    if (!pv) add('provenance', `numeric plugin of kind ${p.kind} has no provenance`);
    else {
      if (pv.sources.length === 0) add('provenance', 'provenance lists no sources');
      if (!isIsoDate(pv.lastChecked)) add('provenance', `lastChecked ${pv.lastChecked} is not a date`);
    }
  }

  if (p.side === 'both') {
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'function')
        add('side', `side 'both' is for pure data plugins, but ${k} is a function`);
    }
  }

  if (p.kind === 'visual-layer' && p.encodesNumbers) {
    if (typeof p.Legend !== 'function') add('visual-layers', 'encodes numbers but has no Legend (AC-15)');
    if (typeof p.evidenceAt !== 'function')
      add('visual-layers', 'encodes numbers but has no evidenceAt (AC-15)');
  }

  if (p.kind === 'maintenance') {
    for (const m of checkMaintenance(p)) add('maintenance', m);
  }

  if (p.kind === 'rule-pack') {
    const known = new Set(opts.namedFns ?? NAMED_FNS);
    const seen = new Set<string>();
    for (const r of p.rules) {
      if (seen.has(r.id)) add('rule-packs', `duplicate rule id ${r.id}`);
      seen.add(r.id);
      if (r.effectiveTo !== undefined && r.effectiveFrom > r.effectiveTo) {
        add('rule-packs', `rule ${r.id}: effectiveFrom is after effectiveTo`);
      }
      if (r.unverifiedRule) continue;
      for (const fn of exprFns(r.when)) {
        if (!known.has(fn))
          add('rule-packs', `rule ${r.id} uses ${fn}, which is not in spec-gen (mark unverifiedRule)`);
      }
    }
  }
  return issues;
}

/** Shape checks for a decay model (SPEC 14): ordered ranges, twin pointers, a target. */
export function checkMaintenance(p: MaintenancePlugin): string[] {
  const out: string[] = [];
  const t = p.ages;
  if (t.kind === 'measure' ? !t.measureId : !t.category) out.push('ages names no measure or system');
  if (p.effects.length === 0 && p.endOfLife === undefined) out.push('no effects and no end of life');
  for (const e of p.effects) {
    if (!e.param.startsWith('/')) out.push(`param ${e.param} is not a JSON Pointer`);
    if (e.onsetYears !== undefined && !(Number.isInteger(e.onsetYears) && e.onsetYears >= 0)) {
      out.push(`${e.param}: onsetYears ${e.onsetYears} is not a whole number of years`);
    }
    const ordered =
      e.rate.form === 'relative'
        ? e.rate.ppbPerYear.lo <= e.rate.ppbPerYear.mid && e.rate.ppbPerYear.mid <= e.rate.ppbPerYear.hi
        : Q.le(e.rate.perYear.lo, e.rate.perYear.mid) && Q.le(e.rate.perYear.mid, e.rate.perYear.hi);
    if (!ordered) out.push(`${e.param}: rate range is not lo <= mid <= hi`);
    if (e.clamp?.min !== undefined && e.clamp.max !== undefined && Q.lt(e.clamp.max, e.clamp.min)) {
      out.push(`${e.param}: clamp min is above max`);
    }
  }
  const eol = p.endOfLife?.ageYears;
  if (eol && !(eol.lo > 0 && eol.lo <= eol.mid && eol.mid <= eol.hi)) {
    out.push('endOfLife.ageYears is not 0 < lo <= mid <= hi');
  }
  return out;
}

export class FingerprintMismatchError extends Error {
  override name = 'FingerprintMismatchError';
}

/**
 * Boot check (ARCH 4.1, DEC TE-6): the main thread and the worker each build a registry from
 * their half of the manifest, then compare the fingerprint of the shared data plugins only.
 * A mismatch is a hard error. Returns the shared fingerprint.
 */
export function assertSharedFingerprint(local: PluginRegistry, remote: string): string {
  const mine = local.fingerprint({ side: 'both' });
  if (mine !== remote) {
    throw new FingerprintMismatchError(`shared plugin fingerprint mismatch: local ${mine}, remote ${remote}`);
  }
  return mine;
}

/** Load every module of one manifest half, in order, and register the plugins as one batch. */
export async function loadModules(
  registry: KernelRegistry,
  refs: readonly ModuleRef[],
): Promise<{ moduleIds: string[]; pluginIds: string[] }> {
  const plugins: AnyPlugin[] = [];
  const moduleIds: string[] = [];
  for (const ref of refs) {
    const mod = (await ref.load()).default;
    moduleIds.push(mod.id);
    plugins.push(...(await mod.load()));
  }
  registry.registerAll(plugins);
  return { moduleIds, pluginIds: plugins.map((p) => p.id).sort(compareStrings) };
}

/** Create an empty registry. */
export function createRegistry(opts: RegistryOptions = {}): KernelRegistry {
  const byId = new Map<string, AnyPlugin>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const cb of [...listeners]) cb();
  };

  const add = (p: AnyPlugin): RegistryIssue[] => {
    const issues = checkPlugin(p, opts);
    if (byId.has(p.id)) issues.unshift({ pluginId: p.id, check: 'ids', message: 'duplicate id' });
    if (issues.length === 0) byId.set(p.id, p);
    return issues;
  };

  const sorted = (filter: (p: AnyPlugin) => boolean): AnyPlugin[] =>
    [...byId.values()].filter(filter).sort((a, b) => compareStrings(a.id, b.id));

  const validate = (): RegistryIssue[] => {
    const issues: RegistryIssue[] = [];
    const all = sorted(() => true);
    for (const p of all) {
      for (const dep of p.requires ?? []) {
        if (!byId.has(dep))
          issues.push({ pluginId: p.id, check: 'dependencies', message: `requires ${dep}, which is absent` });
      }
    }
    const costs = all.filter((p): p is PluginOf<'measure-cost'> => p.kind === 'measure-cost');
    for (const m of all) {
      if (m.kind !== 'measure') continue;
      const regions = m.regions ?? [undefined];
      for (const o of m.options) {
        for (const region of regions) {
          const ok = costs.some(
            (c) =>
              c.optionId === o.id &&
              (region === undefined ||
                c.regions === undefined ||
                c.regions.some((r) => regionContains(r, region))),
          );
          if (!ok) {
            issues.push({
              pluginId: m.id,
              check: 'measure-ids',
              message: `option ${o.id} has no measure-cost${region ? ` for ${region}` : ''}`,
            });
          }
        }
      }
    }
    return issues;
  };

  const registry: KernelRegistry = {
    register(p) {
      const issues = add(p);
      if (issues.length) throw new RegistryError(issues);
      notify();
    },
    registerAll(plugins) {
      const issues: RegistryIssue[] = [];
      for (const p of plugins) issues.push(...add(p));
      issues.push(...validate());
      if (plugins.length) notify();
      if (issues.length) throw new RegistryError(issues);
    },
    get<K extends PluginKind>(kind: K, id: string): PluginOf<K> {
      const p = byId.get(id);
      if (!p) throw new RegistryError([{ pluginId: id, check: 'ids', message: `no plugin with id ${id}` }]);
      if (p.kind !== kind) {
        throw new RegistryError([
          { pluginId: id, check: 'ids', message: `plugin ${id} is a ${p.kind}, not a ${kind}` },
        ]);
      }
      return p as PluginOf<K>;
    },
    all<K extends PluginKind>(kind: K, q?: Query): readonly PluginOf<K>[] {
      return sorted((p) => p.kind === kind && matchesQuery(p, q)) as PluginOf<K>[];
    },
    has: (id) => byId.has(id),
    fingerprint(q) {
      const lines = sorted((p) => matchesQuery(p, q)).map((p) => `${p.id}@${p.version}`);
      return sha256Hex(lines.join('\n'));
    },
    onChange(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    validate,
    ids: () => sorted(() => true).map((p) => p.id),
    get size() {
      return byId.size;
    },
  };
  return registry;
}
