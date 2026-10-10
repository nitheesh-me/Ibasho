/**
 * Engine worker entry (module worker). Owner: WP-08. Loaded by `src/engine/client.ts` with
 * `new Worker(new URL('../worker/engine.worker.ts', import.meta.url), { type: 'module' })`.
 */
import type * as Comlink from 'comlink';
import { manifest } from '../manifest.ts';
import { serveEngine } from './serve.ts';

serveEngine(self as unknown as Comlink.Endpoint, manifest.engine);
