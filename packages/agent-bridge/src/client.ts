/**
 * Browser client: `connectAgentLink()` (ARCH 14). Owner: WP-12. `apps/web` (WP-08) calls it when
 * Settings > Agent link is on and the person has typed the pairing code.
 *
 * Transport: `fetch` streaming of server-sent events for bridge to tab, and `POST /link/frame` for
 * tab to bridge. Both carry the session token in an Authorization header (an `EventSource` cannot
 * set headers, and a token in a URL leaks into logs). No extra dependency on either side.
 *
 * Every incoming call is re-validated with the protocol schemas before a handler sees it, and
 * every call served is reported to `onLedger` for the outbound ledger (SPEC 5.14).
 */
import {
  BRIDGE_MOUNT,
  type ClientInfo,
  type DownFrame,
  DownFrameSchema,
  type LedgerEntry,
  type LinkError,
  type LiveHandlers,
  type LiveMethod,
  type LiveState,
  type PairResponse,
  PairResponseSchema,
  parseLiveParams,
  summariseCall,
  type UpFrame,
} from './protocol.ts';

export type AgentLinkStatus = 'pairing' | 'connected' | 'reconnecting' | 'closed' | 'refused';

export interface AgentLinkOptions {
  /** Companion origin, e.g. `http://127.0.0.1:7357`. */
  origin: string;
  /** Mount path of the bridge; default `/agent-link`. */
  mount?: string;
  /** Pairing code typed by the person, or a stored session from an earlier pairing. */
  pair: { code: string } | { session: PairResponse };
  client: ClientInfo;
  handlers: LiveHandlers;
  onStatus?: (s: AgentLinkStatus, detail?: string) => void;
  onLedger?: (e: LedgerEntry) => void;
  /** Injected for tests. */
  fetch?: typeof fetch;
  /** Reconnect attempts after the stream drops (0 disables). */
  maxReconnects?: number;
  /** Delay before reconnect attempt n (ms). */
  backoff?: (attempt: number) => number;
}

export interface AgentLink {
  readonly session: PairResponse;
  /** Push the tab's current state so `ibasho_live_state` is cheap. */
  pushState(state: LiveState): Promise<void>;
  close(): void;
  /** Resolves when the link is closed for good. */
  readonly closed: Promise<void>;
}

export class AgentLinkError extends Error {
  readonly code: LinkError['code'];
  constructor(code: LinkError['code'], message: string) {
    super(message);
    this.name = 'AgentLinkError';
    this.code = code;
  }
}

/** Parse an SSE byte stream into `data:` payloads. */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true }).replace(/\r\n?/g, '\n');
      let cut = buf.indexOf('\n\n');
      while (cut >= 0) {
        const event = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        const data = event
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(l.startsWith('data: ') ? 6 : 5))
          .join('\n');
        if (data) yield data;
        cut = buf.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function connectAgentLink(opts: AgentLinkOptions): Promise<AgentLink> {
  const f = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const base = `${opts.origin.replace(/\/$/, '')}${opts.mount ?? BRIDGE_MOUNT}`;
  const status = (s: AgentLinkStatus, d?: string) => opts.onStatus?.(s, d);
  const maxReconnects = opts.maxReconnects ?? 5;
  const backoff = opts.backoff ?? ((n: number) => Math.min(8000, 500 * 2 ** n));

  let session: PairResponse;
  if ('code' in opts.pair) {
    status('pairing');
    const res = await f(`${base}/link/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: opts.pair.code, client: opts.client }),
    });
    if (!res.ok) {
      status('refused');
      const j = (await res.json().catch(() => null)) as { error?: LinkError } | null;
      throw new AgentLinkError('unauthorized', j?.error?.message ?? `pairing refused (HTTP ${res.status})`);
    }
    session = PairResponseSchema.parse(await res.json());
  } else {
    session = opts.pair.session;
  }

  const auth = { authorization: `Bearer ${session.sessionToken}` };
  const post = async (frame: UpFrame) => {
    await f(`${base}/link/frame`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify(frame),
    });
  };

  const abort = new AbortController();
  let resolveClosed: () => void = () => {};
  const closed = new Promise<void>((r) => {
    resolveClosed = r;
  });
  let stopped = false;

  const serve = async (frame: Extract<DownFrame, { t: 'call' }>) => {
    const method: LiveMethod = frame.method;
    let ok = false;
    let reply: UpFrame;
    try {
      const params = parseLiveParams(method, frame.params);
      const handler = opts.handlers[method] as (p: unknown) => Promise<unknown>;
      const result = await handler(params);
      ok = true;
      reply = { t: 'result', id: frame.id, ok: true, result };
    } catch (e) {
      const code = e instanceof AgentLinkError ? e.code : 'handler-error';
      reply = { t: 'result', id: frame.id, ok: false, error: { code, message: String(e).slice(0, 500) } };
    }
    opts.onLedger?.({
      at: new Date().toISOString(),
      sessionId: session.sessionId,
      method,
      summary: summariseCall(method, frame.params),
      ok,
    });
    await post(reply);
  };

  /** One stream; resolves true if the bridge said bye (do not reconnect). */
  const runStream = async (): Promise<boolean> => {
    const res = await f(`${base}/link/stream`, { headers: auth, signal: abort.signal });
    if (res.status === 401) throw new AgentLinkError('unauthorized', 'session no longer valid; pair again');
    if (!res.ok || !res.body) throw new Error(`stream failed (HTTP ${res.status})`);
    for await (const data of sseData(res.body)) {
      let json: unknown;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      const r = DownFrameSchema.safeParse(json);
      if (!r.success) continue;
      const frame = r.data;
      if (frame.t === 'welcome') status('connected');
      else if (frame.t === 'bye') return true;
      else if (frame.t === 'call') void serve(frame);
    }
    return false;
  };

  const finish = (s: AgentLinkStatus, detail?: string) => {
    if (stopped) return;
    stopped = true;
    abort.abort();
    status(s, detail);
    resolveClosed();
  };

  const loop = async () => {
    let attempt = 0;
    while (!stopped) {
      try {
        const bye = await runStream();
        if (bye) return finish('closed', 'bridge closed the link');
        attempt = 0;
      } catch (e) {
        if (stopped) return;
        if (e instanceof AgentLinkError) return finish('refused', e.message);
      }
      if (stopped) return;
      if (attempt >= maxReconnects) return finish('closed', 'gave up reconnecting');
      status('reconnecting');
      await new Promise((r) => setTimeout(r, backoff(attempt)));
      attempt += 1;
    }
  };
  void loop();

  return {
    session,
    pushState: (state) => post({ t: 'state', state }),
    close: () => finish('closed', 'closed by the app'),
    closed,
  };
}
