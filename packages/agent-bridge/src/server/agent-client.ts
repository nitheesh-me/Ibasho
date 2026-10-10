/**
 * Agent-side client for the bridge (used by `apps/mcp` and `iq`). Owner: WP-12.
 * Re-reads `server.json` on every call: the port and token change on each companion launch.
 */
import {
  BRIDGE_MOUNT,
  type LinkError,
  type LiveMethod,
  LiveResultSchemas,
  type LiveResults,
  type ServerJson,
  type SessionsResponse,
  SessionsResponseSchema,
} from '../protocol.ts';
import { readServerJson } from './discovery.ts';
import { LinkCallError } from './hub.ts';

type Env = Record<string, string | undefined>;

export interface AgentClientOptions {
  env?: Env;
  fetch?: typeof fetch;
  /** Override discovery (tests). */
  server?: () => ServerJson | null;
  timeoutMs?: number;
}

export class AppNotRunningError extends Error {
  constructor(reason: string) {
    super(
      `Ibasho live link is not available (${reason}). Start the companion (pnpm --filter @ibasho/companion start), open the app, and turn on Settings > Agent link. Headless tools still work.`,
    );
    this.name = 'AppNotRunningError';
  }
}

export class BridgeAgentClient {
  readonly #opts: AgentClientOptions;
  constructor(opts: AgentClientOptions = {}) {
    this.#opts = opts;
  }

  #server(): ServerJson {
    if (this.#opts.server) {
      const s = this.#opts.server();
      if (!s) throw new AppNotRunningError('no server');
      return s;
    }
    const r = readServerJson(this.#opts.env ?? process.env);
    if (!r.ok) throw new AppNotRunningError(`server.json ${r.reason}`);
    return r.server;
  }

  async #request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    const s = this.#server();
    const f = this.#opts.fetch ?? fetch;
    const url = `http://127.0.0.1:${s.port}${s.bridge ?? BRIDGE_MOUNT}${path}`;
    let res: Response;
    try {
      const init: RequestInit = {
        method,
        headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' },
        signal: AbortSignal.timeout(this.#opts.timeoutMs ?? 30_000),
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      res = await f(url, init);
    } catch (e) {
      throw new AppNotRunningError(e instanceof Error ? e.message : String(e));
    }
    const json = (await res.json().catch(() => null)) as { error?: LinkError; result?: unknown } | null;
    if (!res.ok) {
      const err = json?.error;
      throw new LinkCallError(err?.code ?? 'handler-error', err?.message ?? `HTTP ${res.status}`);
    }
    return json;
  }

  async sessions(): Promise<SessionsResponse> {
    return SessionsResponseSchema.parse(await this.#request('GET', '/agent/sessions'));
  }

  async call<M extends LiveMethod>(method: M, params: unknown, sessionId?: string): Promise<LiveResults[M]> {
    const body: Record<string, unknown> = { method, params };
    if (sessionId) body.sessionId = sessionId;
    const json = (await this.#request('POST', '/agent/call', body)) as { result: unknown };
    const parsed = LiveResultSchemas[method].safeParse(json.result);
    if (!parsed.success)
      throw new LinkCallError('handler-error', `the tab sent a malformed ${method} result`);
    return parsed.data as LiveResults[M];
  }
}
