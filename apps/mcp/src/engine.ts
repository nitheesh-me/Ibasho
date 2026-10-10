/**
 * Engine adapter for the headless tools. Owner: WP-12.
 *
 * The MCP server talks to the engine only through the `EngineApi` contract in `@ibasho/core`
 * (ARCH 5.5). It loads the engine at run time, so it works as soon as WP-02 exports a factory
 * and fails with a clear "engine not yet available" error until then.
 *
 * Accepted exports from `packages/engine/src/index.ts`, first match wins:
 *
 *   createEngineApi(opts?: { headless?: boolean }): EngineApi | Promise<EngineApi>   (optional)
 *   engineApi: EngineApi                                                              (an instance)
 *   createEngine({ modules, allowOptions }) plus `init(ids, fingerprint)`              (WP-02, M-0)
 *
 * With `createEngine`, the adapter boots the engine exactly like the worker does: it loads the
 * engine halves of the default UK manifest (`packs/{climate,home-uk,money-uk,rules-uk}`) by path,
 * builds a shared registry for the fingerprint and calls `init`. The search uses `M0_OPTION_IDS`
 * like the worker until the full catalogue is wired; `IBASHO_ENGINE_OPTIONS=all` lifts that.
 * `IBASHO_ENGINE_MODULE` overrides the module path or specifier.
 */

import { pathToFileURL } from 'node:url';
import { type AnyPlugin, createRegistry, type EngineApi, type IbashoModule } from '@ibasho/core';
import { repoPath } from './paths.ts';

/** Engine halves of the default UK manifest, in boot order (same set as the worker at M-0). */
export const UK_ENGINE_MODULES: readonly string[] = [
  'packs/climate/src/engine/module.ts',
  'packs/home-uk/src/engine/module.ts',
  'packs/money-uk/src/engine/module.ts',
  'packs/rules-uk/src/engine/module.ts',
];

export class EngineUnavailableError extends Error {
  readonly code = 'engine-unavailable';
  constructor(detail: string) {
    super(
      `Ibasho engine not yet available: ${detail}. Headless numbers need packages/engine (WP-02) to export createEngine() or createEngineApi(). Tools that do not compute (list homes, get home, memory, live tools) still work.`,
    );
    this.name = 'EngineUnavailableError';
  }
}

export interface EngineSource {
  /** The engine, or throws `EngineUnavailableError`. */
  engine(): Promise<EngineApi>;
}

type EngineModule = {
  createEngineApi?: (opts?: { headless?: boolean }) => EngineApi | Promise<EngineApi>;
  engineApi?: EngineApi;
  createEngine?: (opts: {
    modules: { id: string; load: () => Promise<{ default: IbashoModule }> }[];
    allowOptions?: readonly string[];
  }) => EngineApi;
  M0_OPTION_IDS?: readonly string[];
};

/** Boot `createEngine` the way the worker does: load modules, fingerprint, `init`. */
async function bootCreateEngine(
  mod: EngineModule & { createEngine: NonNullable<EngineModule['createEngine']> },
  env: Record<string, string | undefined>,
): Promise<EngineApi> {
  const modules: IbashoModule[] = [];
  for (const rel of UK_ENGINE_MODULES) {
    const href = pathToFileURL(repoPath(rel, env)).href;
    let m: { default?: IbashoModule };
    try {
      m = (await import(/* @vite-ignore */ href)) as { default?: IbashoModule };
    } catch (e) {
      throw new EngineUnavailableError(`cannot load ${rel} (${e instanceof Error ? e.message : e})`);
    }
    if (!m.default) throw new EngineUnavailableError(`${rel} has no IbashoModule default export`);
    modules.push(m.default);
  }
  const plugins: AnyPlugin[] = [];
  for (const m of modules) plugins.push(...(await m.load()));
  const shared = createRegistry();
  shared.registerAll(plugins);
  const allOptions = env.IBASHO_ENGINE_OPTIONS === 'all';
  const engine = mod.createEngine({
    modules: modules.map((m) => ({ id: m.id, load: async () => ({ default: m }) })),
    ...(!allOptions && mod.M0_OPTION_IDS ? { allowOptions: mod.M0_OPTION_IDS } : {}),
  });
  await engine.init(
    modules.map((m) => m.id),
    shared.fingerprint({ side: 'both' }),
  );
  return engine;
}

function looksLikeEngine(x: unknown): x is EngineApi {
  const e = x as Partial<EngineApi> | null;
  return (
    !!e &&
    typeof e.simulate === 'function' &&
    typeof e.search === 'function' &&
    typeof e.evidence === 'function'
  );
}

/** Default module: the engine package entry in this repo. */
export function defaultEngineSpecifier(env: Record<string, string | undefined> = process.env): string {
  const override = env.IBASHO_ENGINE_MODULE;
  if (override)
    return override.startsWith('.') || override.startsWith('/') ? pathToFileURL(override).href : override;
  return pathToFileURL(repoPath('packages/engine/src/index.ts')).href;
}

/** Load the engine module once; remember a failure only until the next call (it may land later). */
export function engineFromModule(
  specifier: string = defaultEngineSpecifier(),
  env: Record<string, string | undefined> = process.env,
): EngineSource {
  let cached: Promise<EngineApi> | null = null;
  return {
    engine() {
      if (!cached) {
        cached = (async () => {
          let mod: EngineModule;
          try {
            mod = (await import(/* @vite-ignore */ specifier)) as EngineModule;
          } catch (e) {
            throw new EngineUnavailableError(
              `cannot load ${specifier} (${e instanceof Error ? e.message : e})`,
            );
          }
          const createEngine = mod.createEngine;
          const api = mod.createEngineApi
            ? await mod.createEngineApi({ headless: true })
            : mod.engineApi
              ? mod.engineApi
              : createEngine
                ? await bootCreateEngine({ ...mod, createEngine }, env)
                : undefined;
          if (!looksLikeEngine(api)) {
            throw new EngineUnavailableError(
              'packages/engine exports none of createEngineApi, engineApi or createEngine',
            );
          }
          return api;
        })();
        cached.catch(() => {
          cached = null;
        });
      }
      return cached;
    },
  };
}

/** A fixed engine (tests, or an embedding host that already has one). */
export function engineFrom(api: EngineApi): EngineSource {
  return { engine: async () => api };
}

/** No engine at all: every computing tool explains why. */
export const NO_ENGINE: EngineSource = {
  engine: async () => {
    throw new EngineUnavailableError('no engine configured');
  },
};
