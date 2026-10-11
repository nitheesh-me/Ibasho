/**
 * Chapter `requires` (SPEC 5.1, WP-09 I4). Owner: WP-09.
 *
 * A requirement is one of:
 * - a plugin id (`rules-uk`, `loft`);
 * - `kind:<PluginKind>`, meaning "any plugin of that kind" (`kind:checker-rung`), for a capability
 *   whose plugin id its owner has not fixed yet;
 * - `stage:<StageId>`, meaning the studio has a provider for that stage (ARCH 15.5), Preview or
 *   real. A chapter whose stages are all present but some are Preview still renders, marked Preview.
 *
 * A chapter renders only when every requirement holds.
 */
import {
  PLUGIN_KINDS,
  type PluginKind,
  type PluginRegistry,
  STUDIO_STAGES,
  type StageId,
  type StageImpl,
} from '@ibasho/core';

/** What the landing can see of the plugin registry. A `PluginRegistry` satisfies it via `presenceOf`. */
export interface PluginPresence {
  has(id: string): boolean;
  hasKind(kind: PluginKind): boolean;
  /** The studio's provider for a stage: `preview`, `real`, or undefined when there is none. */
  stage?(id: StageId): StageImpl | undefined;
}

export type Requirement =
  | { t: 'id'; id: string }
  | { t: 'kind'; kind: PluginKind }
  | { t: 'stage'; stage: StageId };

const KIND_PREFIX = 'kind:';
const STAGE_PREFIX = 'stage:';

/** Parse one `requires` string. Throws on an unknown kind or stage, so a typo cannot hide a chapter. */
export function parseRequirement(req: string): Requirement {
  if (req.startsWith(STAGE_PREFIX)) {
    const stage = req.slice(STAGE_PREFIX.length);
    if (!(STUDIO_STAGES as readonly string[]).includes(stage)) throw new Error(`unknown stage "${stage}"`);
    return { t: 'stage', stage: stage as StageId };
  }
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
  if (r.t === 'stage') return presence.stage?.(r.stage) !== undefined;
  return r.t === 'id' ? presence.has(r.id) : presence.hasKind(r.kind);
}

/** True when any `stage:` requirement is met only by a Preview provider. */
export function needsPreview(requires: readonly string[], presence: PluginPresence): boolean {
  return requires.some((req) => {
    const r = parseRequirement(req);
    return r.t === 'stage' && presence.stage?.(r.stage) === 'preview';
  });
}

/** A stage provider id names its kind: `preview.sun` is Preview, anything else is real. */
export function stageImplOf(providerId: string): StageImpl {
  return providerId.startsWith('preview.') ? 'preview' : 'real';
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

/**
 * Presence from a static list of `{ kind, id }` pairs, such as a build-time plugin list, plus the
 * studio's stage providers (`STAGE_PROVIDERS` in the app manifest) when known.
 */
export function presenceFromList(
  plugins: Iterable<{ kind: PluginKind; id: string }>,
  stages: Partial<Record<StageId, string>> = {},
): PluginPresence {
  const ids = new Set<string>();
  const kinds = new Set<PluginKind>();
  for (const p of plugins) {
    ids.add(p.id);
    kinds.add(p.kind);
  }
  return {
    has: (id) => ids.has(id),
    hasKind: (kind) => kinds.has(kind),
    stage: (id) => {
      const provider = stages[id];
      return provider ? stageImplOf(provider) : undefined;
    },
  };
}
