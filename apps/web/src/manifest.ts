/**
 * Module manifest (ARCH 4.1). Owner: WP-08. SKELETON (G0): no modules yet.
 * Each ref lazily imports a pack half whose default export is an `IbashoModule`.
 * The main thread and the worker build their registries from their halves and compare
 * `fingerprint({ side: 'both' })` at boot.
 */
import type { ModuleManifest } from '@ibasho/core';

export const manifest: ModuleManifest = { engine: [], ui: [] };
