/**
 * Main-thread side of the engine worker (ARCH 5.5, 6). Owner: WP-08.
 *
 * `connectEngine` wraps an endpoint (the worker, or a `MessagePort` in tests), builds the UI
 * registry from the manifest's UI half, and calls `init` with its shared fingerprint so a pack
 * mismatch between the two threads fails loudly at boot. `runSearch` runs one search, reads the
 * proxied `{ jobId, result }` and asks the worker's mirror to check the certificate.
 */
import {
  type AnyPlugin,
  createRegistry,
  type HomeTwin,
  type ModuleManifest,
  type SearchProgress,
  type SearchRequest,
  type SearchResult,
} from '@ibasho/core';
import * as Comlink from 'comlink';
import type { AppEngine, VerifyOutcome } from '../worker/serve.ts';

export type RemoteEngine = Comlink.Remote<AppEngine>;

/** The fingerprint of the plugins both threads must share, from this thread's UI half. */
export async function uiFingerprint(manifest: ModuleManifest): Promise<string> {
  const plugins: AnyPlugin[] = [];
  for (const ref of manifest.ui) plugins.push(...(await (await ref.load()).default.load()));
  const registry = createRegistry();
  registry.registerAll(plugins);
  return registry.fingerprint({ side: 'both' });
}

export async function connectEngine(
  endpoint: Comlink.Endpoint,
  manifest: ModuleManifest,
): Promise<RemoteEngine> {
  const remote = Comlink.wrap<AppEngine>(endpoint);
  await remote.init(
    manifest.engine.map((m) => m.id),
    await uiFingerprint(manifest),
  );
  return remote;
}

/** Start the app's engine worker. Browser only. */
export function startWorker(): Worker {
  return new Worker(new URL('../worker/engine.worker.ts', import.meta.url), {
    type: 'module',
    name: 'ibasho-engine',
  });
}

export interface SearchRun {
  result: SearchResult;
  check: VerifyOutcome;
}

export async function runSearch(
  engine: RemoteEngine,
  req: SearchRequest,
  onProgress?: (p: SearchProgress) => void,
): Promise<SearchRun> {
  const job = await engine.search(req, onProgress ? Comlink.proxy(onProgress) : undefined);
  const result = (await job.result) as SearchResult;
  const check = await engine.verify(result.hash, req.twin as HomeTwin);
  return { result, check };
}
