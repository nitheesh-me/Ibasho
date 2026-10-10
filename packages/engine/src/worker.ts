/**
 * Worker entry: exposes the engine through Comlink (ARCH 5.5). Owner: WP-02.
 *
 * The app's worker file (WP-08, `apps/web`) imports this and calls
 * `exposeEngine(self, { modules: manifest.engine })`. The engine package cannot import the app's
 * manifest (packages never import apps, ARCH 3), so the manifest is passed in.
 *
 * Comlink notes for the main thread:
 * - pass `onProgress` wrapped in `Comlink.proxy`;
 * - `search` returns a proxied `{ jobId, result }`; read them with `await r.jobId` and
 *   `await r.result` (Comlink awaits the inner promise and structured-clones the result);
 * - `cancel(jobId)` is honoured between slices, within about 20 ms plus one message hop (B8).
 */
import * as Comlink from 'comlink';
import { createEngine, type Engine, type EngineOptions } from './api.ts';

/** The engine as exposed: `search` returns a Comlink proxy so its inner promise can cross. */
export type ExposedEngine = Omit<Engine, 'registry' | 'stateOf'>;

export function exposedEngine(engine: Engine): ExposedEngine {
  const { registry: _r, stateOf: _s, ...api } = engine;
  return {
    ...api,
    async search(req, onProgress) {
      const r = await engine.search(req, onProgress);
      return Comlink.proxy(r);
    },
  };
}

/** Create an engine and expose it on `endpoint` (a worker's global scope or a MessagePort). */
export function exposeEngine(endpoint: Comlink.Endpoint, opts: EngineOptions = {}): Engine {
  const engine = createEngine(opts);
  Comlink.expose(exposedEngine(engine), endpoint);
  return engine;
}
