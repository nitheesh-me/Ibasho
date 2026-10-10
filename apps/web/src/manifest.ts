/**
 * Module manifest (ARCH 4.1). Owner: WP-08.
 *
 * Each ref lazily imports a pack half whose default export is an `IbashoModule`. The worker builds
 * the engine registry from `engine`, the main thread builds the UI registry from `ui`, and the two
 * compare `fingerprint({ side: 'both' })` at boot (`init`).
 *
 * Plain TypeScript with no JSX and no browser globals: `apps/landing` imports this file in Node at
 * build time to list the plugins the app really loads.
 *
 * Packs are imported by package name. Each `./engine` entry re-exports its module under a name,
 * so `load` lifts it into the `{ default }` shape `ModuleRef` expects.
 */
import type { ModuleManifest } from '@ibasho/core';

export const manifest: ModuleManifest = {
  engine: [
    { id: 'pack-climate/engine', load: () => import('@ibasho/pack-climate/engine').then((m) => ({ default: m.climateEngineModule })) },
    { id: 'pack-home-uk/engine', load: () => import('@ibasho/pack-home-uk/engine').then((m) => ({ default: m.homeUkEngineModule })) },
    { id: 'pack-money-uk/engine', load: () => import('@ibasho/pack-money-uk/engine').then((m) => ({ default: m.moneyUkEngineModule })) },
    { id: 'pack-rules-uk/engine', load: () => import('@ibasho/pack-rules-uk/engine').then((m) => ({ default: m.rulesUkEngineModule })) },
  ],
  // PLACEHOLDER: no pack UI halves exist yet (`packs/home-uk/src/ui` is WP-07, M-A).
  ui: [],
};

/** Engine module ids in boot order, for `init`. */
export const ENGINE_MODULE_IDS: readonly string[] = manifest.engine.map((m) => m.id);
