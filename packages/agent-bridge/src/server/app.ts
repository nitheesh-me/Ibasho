/**
 * The bridge as a Hono sub-app (ARCH 14). Owner: WP-12. The companion (WP-05) mounts it:
 *
 *   app.route(BRIDGE_MOUNT, createBridgeApp({ hub, token }));
 *
 * Routes, relative to the mount:
 *
 * | Route                         | Auth                      | Who   |
 * |-------------------------------|---------------------------|-------|
 * | GET  /health                  | none                      | any   |
 * | GET  /agent/sessions          | Bearer server token       | agent |
 * | POST /agent/call              | Bearer server token       | agent |
 * | POST /agent/pairing/rotate    | Bearer server token       | agent |
 * | DELETE /agent/sessions/:id    | Bearer server token       | agent |
 * | POST /link/pair               | pairing code in the body  | tab   |
 * | GET  /link/stream             | Bearer session token, SSE | tab   |
 * | POST /link/frame              | Bearer session token      | tab   |
 * | GET  /link/ws                 | `hello` frame first       | tab   |
 *
 * Every request must carry a loopback Host header (a DNS rebinding guard), and `/link/*`
 * answers CORS only for the allowed app origins.
 */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import type { UpgradeWebSocket, WSContext, WSEvents } from 'hono/ws';
import {
  AGENT_LINK_PROTOCOL,
  AgentCallSchema,
  type DownFrame,
  type LinkError,
  PairRequestSchema,
  type SessionsResponse,
} from '../protocol.ts';
import { type AgentHub, type Connection, LinkCallError, safeEqual } from './hub.ts';

export interface BridgeAppOptions {
  hub: AgentHub;
  /** The per-launch token written to `server.json`. */
  token: string;
  /**
   * Origins allowed to pair and stream (`/link/*`). Default: any loopback http origin, which
   * covers the Vite dev server and the companion-served app.
   */
  allowedOrigins?: (origin: string) => boolean;
  /** Pass `upgradeWebSocket` from `@hono/node-ws` to enable `/link/ws`. */
  upgradeWebSocket?: UpgradeWebSocket;
  /** Keep-alive interval for the SSE stream. */
  pingMs?: number;
  /** Serve under this prefix directly (standalone use and tests); omit when the host mounts it. */
  basePath?: string;
}

/** Request body caps: a frame may carry a base64 PNG screenshot; everything else is small. */
export const BODY_LIMITS = { frame: 16 * 1024 * 1024, call: 1024 * 1024, pair: 16 * 1024 } as const;

const tooLarge = (c: { json: (b: unknown, s: 413) => Response }) =>
  c.json({ error: { code: 'bad-request', message: 'request body too large' } }, 413);

const LOOPBACK_HOST = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/i;
const LOOPBACK_ORIGIN = /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/i;

export function isLoopbackOrigin(origin: string): boolean {
  return LOOPBACK_ORIGIN.test(origin);
}

const errorStatus: Record<LinkError['code'], 400 | 401 | 404 | 409 | 410 | 422 | 502 | 504> = {
  unauthorized: 401,
  'bad-request': 400,
  'no-session': 404,
  'ambiguous-session': 409,
  timeout: 504,
  closed: 410,
  'handler-error': 502,
  refused: 422,
};

function bearer(header: string | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return m?.[1] ?? null;
}

export function createBridgeApp(opts: BridgeAppOptions): Hono {
  const { hub, token } = opts;
  const allowed = opts.allowedOrigins ?? isLoopbackOrigin;
  const pingMs = opts.pingMs ?? 15_000;
  const httpConns = new Map<string, Connection>();
  const app = opts.basePath ? new Hono().basePath(opts.basePath) : new Hono();

  app.use('*', async (c, next) => {
    const host = c.req.header('host');
    if (host !== undefined && !LOOPBACK_HOST.test(host)) {
      return c.json({ error: { code: 'unauthorized', message: 'loopback only' } }, 403);
    }
    await next();
  });

  app.get('/health', (c) => c.json({ ok: true, protocol: AGENT_LINK_PROTOCOL }));

  // ---------------------------------------------------------------- agent side
  app.use('/agent/*', async (c, next) => {
    const t = bearer(c.req.header('authorization'));
    if (!t || !safeEqual(t, token)) {
      return c.json({ error: { code: 'unauthorized', message: 'missing or wrong bearer token' } }, 401);
    }
    await next();
  });

  app.get('/agent/sessions', (c) =>
    c.json<SessionsResponse>({ sessions: hub.sessions(), pairing: hub.pairingCode() }),
  );

  app.post('/agent/pairing/rotate', (c) => {
    hub.rotatePairingCode();
    return c.json(hub.pairingCode());
  });

  app.delete('/agent/sessions/:id', (c) => {
    hub.unpair(c.req.param('id'));
    return c.json({ ok: true });
  });

  app.post('/agent/call', bodyLimit({ maxSize: BODY_LIMITS.call, onError: tooLarge }), async (c) => {
    const body = AgentCallSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: { code: 'bad-request', message: body.error.message } }, 400);
    }
    try {
      const result = await hub.call(body.data.sessionId, body.data.method, body.data.params);
      return c.json({ result });
    } catch (e) {
      const err =
        e instanceof LinkCallError
          ? { code: e.code, message: e.message }
          : { code: 'handler-error' as const, message: String(e) };
      return c.json({ error: err }, errorStatus[err.code]);
    }
  });

  // ---------------------------------------------------------------- tab side
  app.use(
    '/link/*',
    cors({
      origin: (origin) => (allowed(origin) ? origin : null),
      allowHeaders: ['authorization', 'content-type'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      maxAge: 600,
    }),
  );
  app.use('/link/*', async (c, next) => {
    const origin = c.req.header('origin');
    if (origin !== undefined && !allowed(origin)) {
      return c.json({ error: { code: 'unauthorized', message: 'origin not allowed' } }, 403);
    }
    await next();
  });

  app.post('/link/pair', bodyLimit({ maxSize: BODY_LIMITS.pair, onError: tooLarge }), async (c) => {
    const body = PairRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: { code: 'bad-request', message: body.error.message } }, 400);
    const r = hub.pair(body.data.code, body.data.client);
    if (!r.ok) {
      return c.json(
        { error: { code: 'unauthorized', message: r.reason === 'expired' ? 'code expired' : 'wrong code' } },
        401,
      );
    }
    return c.json({ sessionId: r.sessionId, sessionToken: r.sessionToken, protocol: r.protocol });
  });

  app.get('/link/stream', (c) => {
    const t = bearer(c.req.header('authorization'));
    const sessionId = t ? hub.authenticate(t) : null;
    if (!t || !sessionId) {
      return c.json({ error: { code: 'unauthorized', message: 'pair first' } }, 401);
    }
    return streamSSE(c, async (stream) => {
      let done: () => void = () => {};
      const finished = new Promise<void>((r) => {
        done = r;
      });
      const send = (f: DownFrame) => {
        void stream.writeSSE({ data: JSON.stringify(f) });
        if (f.t === 'bye') done();
      };
      const conn = hub.connect(t, send);
      if (!conn) return;
      httpConns.get(sessionId)?.close('replaced by a newer connection');
      httpConns.set(sessionId, conn);
      const ping = setInterval(() => send({ t: 'ping' }), pingMs);
      stream.onAbort(done);
      await finished;
      clearInterval(ping);
      conn.close('stream closed');
      if (httpConns.get(sessionId) === conn) httpConns.delete(sessionId);
    });
  });

  app.post('/link/frame', bodyLimit({ maxSize: BODY_LIMITS.frame, onError: tooLarge }), async (c) => {
    const t = bearer(c.req.header('authorization'));
    const sessionId = t ? hub.authenticate(t) : null;
    if (!sessionId) return c.json({ error: { code: 'unauthorized', message: 'pair first' } }, 401);
    const conn = httpConns.get(sessionId);
    if (!conn) return c.json({ error: { code: 'closed', message: 'open /link/stream first' } }, 410);
    conn.receive(await c.req.json().catch(() => null));
    return c.json({ ok: true });
  });

  if (opts.upgradeWebSocket) {
    app.get(
      '/link/ws',
      opts.upgradeWebSocket((c) => {
        const origin = c.req.header('origin');
        if (origin !== undefined && !allowed(origin)) return { onOpen: (_e, ws) => ws.close(1008, 'origin') };
        return bridgeWebSocketEvents(hub);
      }),
    );
  }

  return app;
}

/**
 * WebSocket transport. The first frame must be `{ t: 'hello', sessionToken }` within the
 * timeout; anything else closes the socket with 1008.
 */
export function bridgeWebSocketEvents(hub: AgentHub, helloTimeoutMs = 5_000): WSEvents {
  let conn: Connection | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const decode = (data: unknown): unknown => {
    if (typeof data !== 'string') return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  };
  return {
    onOpen: (_evt, ws: WSContext) => {
      timer = setTimeout(() => {
        if (!conn) ws.close(1008, 'hello expected');
      }, helloTimeoutMs);
    },
    onMessage: (evt, ws: WSContext) => {
      const frame = decode(evt.data);
      if (conn) {
        conn.receive(frame);
        return;
      }
      const hello = frame as { t?: unknown; sessionToken?: unknown } | null;
      if (hello?.t !== 'hello' || typeof hello.sessionToken !== 'string') {
        ws.close(1008, 'hello expected');
        return;
      }
      conn = hub.connect(hello.sessionToken, (f) => {
        ws.send(JSON.stringify(f));
        if (f.t === 'bye') ws.close(1000, f.reason);
      });
      clearTimeout(timer);
      if (!conn) ws.close(1008, 'pair first');
    },
    onClose: () => {
      clearTimeout(timer);
      conn?.close('socket closed');
      conn = null;
    },
  };
}
