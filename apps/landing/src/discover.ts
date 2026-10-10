/**
 * Build-time plugin discovery for the landing page (SPEC 5.1, WP-09 I4). Owner: WP-09.
 *
 * A chapter renders only when its required plugins exist. The landing page is static, so it asks
 * at build time, from two sources in order:
 *
 * 1. The app's module manifest (`apps/web/src/manifest.ts`, owner WP-08), when it lists any module.
 *    It is the list the app really registers, so the page never advertises a plugin the app does
 *    not load.
 * 2. Otherwise every module file by the repo convention (`src/{engine,ui}/module.ts`, default export
 *    an `IbashoModule`) under `packs/*` and `packages/*`. Packages matter: search strategies live in
 *    `packages/engine` and checker rungs in `packages/verify` (ARCH 2), so a packs-only scan would
 *    never show "Three futures" or "Proof and privacy".
 *
 * Runs in Node only (from `vite.config.ts` and tests). A module that fails to import, such as a ui
 * half with JSX that Node cannot strip, is skipped and reported, never fatal.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IbashoModule, ModuleManifest, PluginKind } from '@ibasho/core';

export interface DiscoveredPlugin {
  kind: PluginKind;
  id: string;
  /** Module id that loaded it, e.g. `pack-rules-uk/engine`. */
  module: string;
}

export interface Discovery {
  /** Where the plugin list came from. `none` when neither source had any module. */
  source: 'manifest' | 'files' | 'none';
  plugins: DiscoveredPlugin[];
  skipped: { file: string; reason: string }[];
}

const HALVES = ['engine', 'ui'] as const;

function halfModules(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    for (const half of HALVES) {
      const f = join(dir, name, 'src', half, 'module.ts');
      if (existsSync(f)) out.push(f);
    }
  }
  return out;
}

/** Every `packs/<pack>/src/<half>/module.ts` under the repo root, sorted for a stable build. */
export function packModuleFiles(repoRoot: string): string[] {
  return halfModules(join(repoRoot, 'packs'));
}

/** Pack modules, then `packages/<pkg>/src/<half>/module.ts`, each group sorted. */
export function moduleFiles(repoRoot: string): string[] {
  return [...packModuleFiles(repoRoot), ...halfModules(join(repoRoot, 'packages'))];
}

/** Path of the app's module manifest (ARCH 4.1). */
export function manifestFile(repoRoot: string): string {
  return join(repoRoot, 'apps', 'web', 'src', 'manifest.ts');
}

function isModule(x: unknown): x is IbashoModule {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as IbashoModule).id === 'string' &&
    typeof (x as IbashoModule).load === 'function'
  );
}

type Loader = { label: string; load: () => Promise<unknown> };

async function collect(loaders: readonly Loader[], source: Discovery['source']): Promise<Discovery> {
  const plugins: DiscoveredPlugin[] = [];
  const skipped: Discovery['skipped'] = [];
  for (const { label, load } of loaders) {
    try {
      const mod = (await load()) as { default?: unknown };
      if (!isModule(mod?.default)) throw new Error('default export is not an IbashoModule');
      const m = mod.default;
      for (const p of await m.load()) plugins.push({ kind: p.kind, id: p.id, module: m.id });
    } catch (e) {
      skipped.push({ file: label, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  plugins.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { source, plugins, skipped };
}

/** The manifest's module refs, or undefined when it is absent, unreadable or empty. */
async function manifestLoaders(repoRoot: string): Promise<Loader[] | undefined> {
  const file = manifestFile(repoRoot);
  if (!existsSync(file)) return undefined;
  let manifest: ModuleManifest | undefined;
  try {
    const mod = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as { manifest?: ModuleManifest };
    manifest = mod.manifest;
  } catch {
    // A manifest Node cannot import (JSX, browser-only code) falls back to the file scan.
    return undefined;
  }
  const refs = [...(manifest?.engine ?? []), ...(manifest?.ui ?? [])];
  if (refs.length === 0) return undefined;
  return refs.map((r) => ({ label: `manifest:${r.id}`, load: () => r.load() }));
}

/** List the plugins the app would register: from the manifest when it has modules, else module files. Never throws. */
export async function discoverPlugins(repoRoot: string): Promise<Discovery> {
  const fromManifest = await manifestLoaders(repoRoot);
  if (fromManifest) return collect(fromManifest, 'manifest');
  const files = moduleFiles(repoRoot);
  if (files.length === 0) return { source: 'none', plugins: [], skipped: [] };
  return collect(
    files.map((file) => ({ label: file, load: () => import(/* @vite-ignore */ pathToFileURL(file).href) })),
    'files',
  );
}
