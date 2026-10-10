/**
 * Chapter `requires` (SPEC 5.1, WP-09 I4). Owner: WP-09.
 *
 * A requirement is either a plugin id (`rules-uk`, `loft`) or `kind:<PluginKind>` meaning "any
 * plugin of that kind" (`kind:checker-rung`). The kind form lets a chapter wait for a capability
 * whose plugin id its owner has not fixed yet. A chapter renders only when every requirement holds.
 */
import { PLUGIN_KINDS, type PluginKind, type PluginRegistry } from '@ibasho/core';

/** What the landing can see of the plugin registry. A `PluginRegistry` satisfies it via `presenceOf`. */
export interface PluginPresence {
  has(id: string): boolean;
  hasKind(kind: PluginKind): boolean;
}

export type Requirement = { t: 'id'; id: string } | { t: 'kind'; kind: PluginKind };

const KIND_PREFIX = 'kind:';

/** Parse one `requires` string. Throws on an unknown plugin kind, so a typo cannot hide a chapter. */
export function parseRequirement(req: string): Requirement {
  if (!req.startsWith(KIND_PREFIX)) {
    if (req.length === 0) throw new Error('empty requirement');
    return { t: 'id', id: req };
  }
  const kind = req.slice(KIND_PREFIX.length);
  if (!(PLUGIN_KINDS as readonly string[]).includes(kind)) throw new Error(`unknown plugin kind "${kind}"`);
  return { t: 'kind', kind: kind as PluginKind };
}

export function requirementMet(req: string, presence: PluginPresence): boolean {
  const r = parseRequirement(req);
  return r.t === 'id' ? presence.has(r.id) : presence.hasKind(r.kind);
}

/** The requirements of `requires` that are not met, in order. Empty means the item may render. */
export function missingRequirements(requires: readonly string[], presence: PluginPresence): string[] {
  return requires.filter((r) => !requirementMet(r, presence));
}

/** Presence from a live registry (the app, or a landing page that loads pack modules). */
export function presenceOf(registry: Pick<PluginRegistry, 'has' | 'all'>): PluginPresence {
  return {
    has: (id) => registry.has(id),
    hasKind: (kind) => registry.all(kind).length > 0,
  };
}

/** Presence from a static list of `{ kind, id }` pairs, such as a build-time plugin list. */
export function presenceFromList(plugins: Iterable<{ kind: PluginKind; id: string }>): PluginPresence {
  const ids = new Set<string>();
  const kinds = new Set<PluginKind>();
  for (const p of plugins) {
    ids.add(p.id);
    kinds.add(p.kind);
  }
  return { has: (id) => ids.has(id), hasKind: (kind) => kinds.has(kind) };
}
