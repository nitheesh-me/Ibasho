/**
 * Companion app (ARCH 11, ARCH 14). Owner: WP-05. Optional local Node helper on 127.0.0.1:7357.
 *
 * Routes:
 * - `GET /health`: open, no secrets. Name, version, routes and which rungs are present.
 * - `POST /verify` (`?batch=1` for NDJSON): the Lean checker on one certificate (see `verify.ts`).
 * - `GET|POST /llm/ollama-cors/api/*`: optional Ollama pass-through (see `ollama.ts`).
 * - the agent link bridge sub-app at `/agent-link` (WP-12), when the host passes one. The bridge
 *   does its own auth (token and pairing code) and CORS, so the guard below skips its prefix.
 *
 * Guard for the companion's own routes (DECISION WP-05, blackboard): the Host must be loopback
 * (blocks DNS rebinding); a browser request must come from an allowed app origin (ARCH 11: CORS
 * restricted to the app origin); a request without an Origin (a script, an agent) must carry
 * `Authorization: Bearer <token>` (ARCH 14). Allowed origins get CORS and Private Network Access
 * preflight answers.
 */
import type { Context, Hono as HonoApp, Next } from 'hono';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { forwardToOllama, OLLAMA_PASS_PREFIX, type OllamaPassOptions } from './ollama.ts';
import { type OriginCheck, originCheck } from './origins.ts';
import { CheckerBusyError, CheckerUnavailableError, type VerifyRunner } from './verify.ts';

export const COMPANION_HOST = '127.0.0.1';
export const COMPANION_PORT = 7357;
export const COMPANION_VERSION = '0.1.0';
/** Same value as `BRIDGE_MOUNT` in `@ibasho/agent-bridge` (WP-12). */
export const BRIDGE_MOUNT = '/agent-link';
/** Certificates are small (a GH1 search is well under 1 MiB); batches may be larger. */
export const VERIFY_MAX_BODY = 32 * 1024 * 1024;

export interface Health {
  ok: true;
  name: 'ibasho-companion';
  version: string;
  routes: string[];
  rungs: { leanNative: boolean };
  ollamaPassThrough: boolean;
  agentLink: boolean;
}

export interface CompanionOptions {
  /** Per-launch token (ARCH 14). Without one, only allowed browser origins can call the routes. */
  token?: string;
  /** Browser origins allowed to call. Default: loopback only. */
  origins?: OriginCheck;
  /** Lean checker runner; omit to leave `/verify` unmounted. */
  verify?: VerifyRunner;
  /** Ollama pass-through; omit to leave it unmounted. */
  ollama?: OllamaPassOptions;
  /** The agent link sub-app (`createBridgeApp` from `@ibasho/agent-bridge/server`). */
  bridge?: HonoApp;
  /** Port in the Host check. Default `COMPANION_PORT`. */
  port?: number;
}

const json = (c: Context, status: number, body: unknown) => c.json(body as object, status as 200);

/** Timing-safe string compare (no early exit on the first differing byte). */
export function safeEqual(a: string, b: string): boolean {
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function isLoopbackHost(host: string | undefined, port: number): boolean {
  if (!host) return false;
  return [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(host.toLowerCase());
}

export function createApp(opts: CompanionOptions = {}): Hono {
  const app = new Hono();
  const allow = opts.origins ?? originCheck();
  const port = opts.port ?? COMPANION_PORT;
  const routes = ['GET /health'];
  if (opts.verify) routes.push('POST /verify');
  if (opts.ollama)
    routes.push(
      `GET ${OLLAMA_PASS_PREFIX}/api/tags`,
      `GET ${OLLAMA_PASS_PREFIX}/api/version`,
      `POST ${OLLAMA_PASS_PREFIX}/api/chat`,
      `POST ${OLLAMA_PASS_PREFIX}/api/show`,
    );
  if (opts.bridge) routes.push(`* ${BRIDGE_MOUNT}/*`);

  // Host check for everything (the bridge included): DNS rebinding cannot reach a loopback Host.
  app.use('*', async (c, next) => {
    const url = new URL(c.req.url);
    if (!isLoopbackHost(c.req.header('host') ?? url.host, port))
      return json(c, 421, { error: 'host must be loopback' });
    await next();
  });

  const guard = async (c: Context, next: Next) => {
    const origin = c.req.header('origin');
    if (origin !== undefined) {
      if (!allow(origin)) return json(c, 403, { error: 'origin not allowed' });
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Vary', 'Origin');
      if (c.req.method === 'OPTIONS') {
        c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        c.header('Access-Control-Allow-Headers', 'authorization, content-type');
        c.header('Access-Control-Max-Age', '600');
        if (c.req.header('access-control-request-private-network') === 'true')
          c.header('Access-Control-Allow-Private-Network', 'true');
        return c.body(null, 204);
      }
    } else {
      const auth = c.req.header('authorization') ?? '';
      const given = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!opts.token || !safeEqual(given, opts.token))
        return json(c, 401, { error: 'bearer token required' });
    }
    await next();
  };

  app.get('/health', (c) => {
    const origin = c.req.header('origin');
    if (origin !== undefined && allow(origin)) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Vary', 'Origin');
    }
    return c.json<Health>({
      ok: true,
      name: 'ibasho-companion',
      version: COMPANION_VERSION,
      routes,
      rungs: { leanNative: opts.verify?.available() ?? false },
      ollamaPassThrough: opts.ollama !== undefined,
      agentLink: opts.bridge !== undefined,
    });
  });

  if (opts.verify) {
    const runner = opts.verify;
    app.use('/verify', guard);
    // Hono's streaming limit also caps chunked bodies that carry no Content-Length.
    const limit = bodyLimit({
      maxSize: VERIFY_MAX_BODY,
      onError: (c) => json(c, 413, { error: 'certificate too large' }),
    });
    app.post('/verify', limit, async (c) => {
      const body = await c.req.text();
      if (body.trim() === '') return json(c, 400, { error: 'empty body; send an ibasho.cert/2 certificate' });
      const batch = c.req.query('batch') === '1';
      try {
        const r = await runner.run(body, { batch, signal: c.req.raw.signal });
        // 0 and 1 are verdicts (a failed check is still a good answer); 2 is a malformed certificate.
        const status = r.code === 2 ? 422 : r.code === 0 || r.code === 1 ? 200 : 500;
        return c.body(r.stdout, status as 200, {
          'content-type': batch ? 'application/x-ndjson' : 'application/json',
        });
      } catch (e) {
        if (e instanceof CheckerUnavailableError) return json(c, 503, { error: e.message });
        if (e instanceof CheckerBusyError) return json(c, 429, { error: e.message });
        return json(c, 500, { error: (e as Error).message });
      }
    });
  }

  if (opts.ollama) {
    const pass = opts.ollama;
    app.use(`${OLLAMA_PASS_PREFIX}/*`, guard);
    app.all(`${OLLAMA_PASS_PREFIX}/*`, async (c) => {
      const sub = new URL(c.req.url).pathname.slice(OLLAMA_PASS_PREFIX.length);
      const res = await forwardToOllama(c.req.raw, sub, pass);
      if (!res) return json(c, 404, { error: 'not forwarded' });
      // A raw Response skips the context headers, so set CORS here (the guard already vetted it).
      const origin = c.req.header('origin');
      if (origin !== undefined) {
        res.headers.set('Access-Control-Allow-Origin', origin);
        res.headers.set('Vary', 'Origin');
      }
      return res;
    });
  }

  if (opts.bridge) app.route(BRIDGE_MOUNT, opts.bridge);

  app.notFound((c) => json(c, 404, { error: 'not found' }));
  return app;
}

export { forwardToOllama, OLLAMA_PASS_PREFIX, type OllamaPassOptions } from './ollama.ts';
export { isLoopbackOrigin, type OriginCheck, originCheck } from './origins.ts';
export {
  CheckerBusyError,
  CheckerUnavailableError,
  type LakeRunnerOptions,
  lakeCheckRunner,
  type VerifyResult,
  type VerifyRunner,
} from './verify.ts';
