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
 * Packs are imported by package name. Each `./engine` and `./ui` entry re-exports its module under a name,
 * so `load` lifts it into the `{ default }` shape `ModuleRef` expects.
 */
import type { ModuleManifest } from '@ibasho/core';

export const manifest: ModuleManifest = {
  engine: [
    {
      id: 'pack-climate/engine',
      load: () => import('@ibasho/pack-climate/engine').then((m) => ({ default: m.climateEngineModule })),
    },
    {
      id: 'pack-home-uk/engine',
      load: () => import('@ibasho/pack-home-uk/engine').then((m) => ({ default: m.homeUkEngineModule })),
    },
    {
      id: 'pack-money-uk/engine',
      load: () => import('@ibasho/pack-money-uk/engine').then((m) => ({ default: m.moneyUkEngineModule })),
    },
    {
      id: 'pack-rules-uk/engine',
      load: () => import('@ibasho/pack-rules-uk/engine').then((m) => ({ default: m.rulesUkEngineModule })),
    },
  ],
  // Only `home-uk` has a UI half so far (WP-07): `measure-ui` for every measure id.
  ui: [
    {
      id: 'pack-home-uk/ui',
      load: () => import('@ibasho/pack-home-uk/ui').then((m) => ({ default: m.homeUkUiModule })),
    },
  ],
};

/** Engine module ids in boot order, for `init`. */
export const ENGINE_MODULE_IDS: readonly string[] = manifest.engine.map((m) => m.id);

/**
 * Stage providers (ARCH 15.5, SPEC AC-PG4). Swapping a stage from Preview to real is one line here.
 * Every stage is Preview in V-P; `apps/web/src/studio/preview/runner.ts` serves them until
 * `packages/preview` (WP-13) and the real providers land.
 */
export const STAGE_PROVIDERS = {
  geometry: 'preview.geometry',
  sun: 'preview.sun',
  radiation: 'preview.radiation',
  daylight: 'preview.daylight',
  energy: 'preview.energy',
  codes: 'preview.codes',
  optimise: 'preview.optimise',
} as const satisfies Record<import('@ibasho/core').StageId, string>;

export const isPreviewProvider = (id: string): boolean => id.startsWith('preview.');
