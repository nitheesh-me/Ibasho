import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type AgentLink,
  BRIDGE_HOST,
  BRIDGE_MOUNT,
  connectAgentLink,
  type LedgerEntry,
  type LiveHandlers,
  type LiveState,
} from '../src/index.ts';
import {
  AgentHub,
  BODY_LIMITS,
  BridgeAgentClient,
  bridgeWebSocketEvents,
  createBridgeApp,
  LinkCallError,
  readServerJson,
  removeServerJson,
  writeServerJson,
} from '../src/server/index.ts';

const TOKEN = 'a'.repeat(64);
const ORIGIN = 'http://127.0.0.1:7357';

const state: LiveState = {
  homeId: 'gh1',
  route: '/app/home',
  chapter: null,
  layer: 'heat',
  selection: [],
  resultHash: null,
  agentEditPending: false,
};

function setup(hubOpts: ConstructorParameters<typeof AgentHub>[0] = {}) {
  const ledger: LedgerEntry[] = [];
  const hub = new AgentHub({ callTimeoutMs: 500, onLedger: (e) => ledger.push(e), ...hubOpts });
  const root = new Hono().route(BRIDGE_MOUNT, createBridgeApp({ hub, token: TOKEN, pingMs: 60_000 }));
  const fetchImpl = ((input: string | URL | Request, init?: RequestInit) =>
    root.request(String(input), init)) as typeof fetch;
  const agent = new BridgeAgentClient({
    fetch: fetchImpl,
    server: () => ({ port: 7357, token: TOKEN, pid: process.pid, startedAt: new Date().toISOString() }),
  });
  return { hub, root, fetchImpl, agent, ledger };
}

function handlers(over: Partial<LiveHandlers> = {}): LiveHandlers {
  return {
    state: async () => state,
    apply: async (p) => ({ accepted: p.ops, rejected: [], undoId: 'u1', resultHash: null }),
    view: async () => ({ state }),
    thread: async (p) => ({ path: [p.evidenceId] }),
    screenshot: async () => ({ mime: 'image/png', data: 'iVBORw0KGgo=' }),
    say: async () => ({ rendered: true, issues: [] }),
    ...over,
  };
}

const links: AgentLink[] = [];
afterEach(() => {
  for (const l of links.splice(0)) l.close();
});

async function pairTab(ctx: ReturnType<typeof setup>, h = handlers(), onLedger?: (e: LedgerEntry) => void) {
  const statuses: string[] = [];
  const opts: Parameters<typeof connectAgentLink>[0] = {
    origin: ORIGIN,
    pair: { code: ctx.hub.pairingCode().code },
    client: { app: 'ibasho-web', version: '0.0.0' },
    handlers: h,
    fetch: ctx.fetchImpl,
    onStatus: (s) => statuses.push(s),
    maxReconnects: 0,
  };
  if (onLedger) opts.onLedger = onLedger;
  const link = await connectAgentLink(opts);
  links.push(link);
  await vi.waitFor(() => expect(statuses).toContain('connected'));
  return { link, statuses };
}

describe('L4 bridge auth', () => {
  it('rejects agent routes without the bearer token (401)', async () => {
    const { root } = setup();
    expect((await root.request(`${BRIDGE_MOUNT}/agent/sessions`)).status).toBe(401);
    const wrong = await root.request(`${BRIDGE_MOUNT}/agent/sessions`, {
      headers: { authorization: `Bearer ${'b'.repeat(64)}` },
    });
    expect(wrong.status).toBe(401);
    const call = await root.request(`${BRIDGE_MOUNT}/agent/call`, {
      method: 'POST',
      body: JSON.stringify({ method: 'state', params: {} }),
    });
    expect(call.status).toBe(401);
    const ok = await root.request(`${BRIDGE_MOUNT}/agent/sessions`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(ok.status).toBe(200);
  });

  it('serves /health without a token', async () => {
    const { root } = setup();
    const res = await root.request(`${BRIDGE_MOUNT}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it('refuses a wrong pairing code and rotates after repeated failures', async () => {
    const { hub, root } = setup({ maxPairFailures: 3 });
    const first = hub.pairingCode().code;
    const pair = (code: string) =>
      root.request(`${BRIDGE_MOUNT}/link/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ code, client: { app: 'ibasho-web', version: '0' } }),
      });
    for (let i = 0; i < 3; i++) expect((await pair('ZZZZ-ZZZZ')).status).toBe(401);
    expect(hub.pairingCode().code).not.toBe(first);
    expect((await pair(first)).status).toBe(401);
    const good = hub.pairingCode().code;
    expect((await pair(good.toLowerCase())).status).toBe(200);
    // Single use.
    expect((await pair(good)).status).toBe(401);
  });

  it('expires pairing codes', () => {
    let t = 0;
    const hub = new AgentHub({ now: () => t, pairingTtlMs: 1000 });
    const code = hub.pairingCode().code;
    t = 2000;
    expect(hub.pair(code, { app: 'ibasho-web', version: '0' })).toEqual({ ok: false, reason: 'expired' });
  });

  it('refuses non-loopback Host headers and foreign origins', async () => {
    const { root } = setup();
    const host = await root.request(`${BRIDGE_MOUNT}/health`, { headers: { host: 'evil.example:7357' } });
    expect(host.status).toBe(403);
    const origin = await root.request(`${BRIDGE_MOUNT}/link/pair`, {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(origin.status).toBe(403);
  });

  it('caps request bodies (413) before parsing them', async () => {
    const { root } = setup();
    const big = JSON.stringify({ code: 'x'.repeat(BODY_LIMITS.pair + 1), client: { app: 'ibasho-web' } });
    const pair = await root.request(`${BRIDGE_MOUNT}/link/pair`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: big,
    });
    expect(pair.status).toBe(413);
    const call = await root.request(`${BRIDGE_MOUNT}/agent/call`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ method: 'state', params: {}, pad: 'x'.repeat(BODY_LIMITS.call + 1) }),
    });
    expect(call.status).toBe(413);
  });

  it('binds loopback only', () => {
    expect(BRIDGE_HOST).toBe('127.0.0.1');
  });

  it('refuses /link/stream without a session token', async () => {
    const { root } = setup();
    expect((await root.request(`${BRIDGE_MOUNT}/link/stream`)).status).toBe(401);
    expect((await root.request(`${BRIDGE_MOUNT}/link/frame`, { method: 'POST', body: '{}' })).status).toBe(
      401,
    );
  });
});

describe('live calls through the bridge', () => {
  it('pairs a tab and relays a typed apply to it', async () => {
    const ctx = setup();
    const tabLedger: LedgerEntry[] = [];
    const apply = vi.fn(handlers().apply);
    await pairTab(ctx, handlers({ apply }), (e) => tabLedger.push(e));
    const sessions = await ctx.agent.sessions();
    expect(sessions.sessions).toHaveLength(1);
    expect(sessions.sessions[0]?.connected).toBe(true);
    const r = await ctx.agent.call('apply', {
      ops: [{ op: 'addMeasure', measureId: 'loft', params: { option: 'loft-300' } }],
    });
    expect(r.undoId).toBe('u1');
    expect(apply).toHaveBeenCalledOnce();
    expect(ctx.ledger.map((e) => e.summary)).toEqual(['apply: addMeasure loft']);
    expect(tabLedger.map((e) => [e.method, e.ok])).toEqual([['apply', true]]);
  });

  it('rejects ops outside the typed schema before they reach the tab', async () => {
    const ctx = setup();
    const apply = vi.fn(handlers().apply);
    await pairTab(ctx, handlers({ apply }));
    for (const bad of [
      { ops: [{ op: 'eval', code: 'alert(1)' }] },
      { ops: [{ op: 'addMeasure', measureId: 'loft', code: 'x' }] },
      { ops: [] },
      { ops: [{ op: 'setParam', path: '__proto__.x', value: 1 }] },
    ]) {
      await expect(ctx.agent.call('apply', bad)).rejects.toMatchObject({ code: 'bad-request' });
    }
    expect(apply).not.toHaveBeenCalled();
  });

  it('refuses narration with raw digits (L6 pre-check) and passes slotted text', async () => {
    const ctx = setup();
    const say = vi.fn(handlers().say);
    await pairTab(ctx, handlers({ say }));
    await expect(
      ctx.agent.call('say', { section: 'answer', text: 'Loft insulation saves £120 a year.' }),
    ).rejects.toMatchObject({ code: 'bad-request' });
    await expect(
      ctx.agent.call('say', { section: 'answer', text: 'It saves about half your gas.' }),
    ).rejects.toMatchObject({ code: 'bad-request' });
    const ok = await ctx.agent.call('say', {
      section: 'answer',
      text: 'Topping up [[m:loft]] saves [[e:ev_3f2a|approx]] a year.',
    });
    expect(ok.rendered).toBe(true);
    expect(say).toHaveBeenCalledOnce();
  });

  it('pushes state and reports handler errors and timeouts', async () => {
    const ctx = setup();
    const { link } = await pairTab(
      ctx,
      handlers({
        view: async () => {
          throw new Error('no such layer');
        },
        thread: () => new Promise(() => {}),
      }),
    );
    await link.pushState({ ...state, chapter: 'what-leaks' });
    expect((await ctx.agent.sessions()).sessions[0]?.state?.chapter).toBe('what-leaks');
    await expect(ctx.agent.call('view', { layer: 'nope' })).rejects.toMatchObject({ code: 'handler-error' });
    await expect(ctx.agent.call('thread', { evidenceId: 'ev_1' })).rejects.toMatchObject({ code: 'timeout' });
  });

  it('needs a tab, and a session id when two are open', async () => {
    const ctx = setup();
    await expect(ctx.agent.call('state', {})).rejects.toMatchObject({ code: 'no-session' });
    await pairTab(ctx);
    await pairTab(ctx);
    await expect(ctx.agent.call('state', {})).rejects.toMatchObject({ code: 'ambiguous-session' });
    const id = (await ctx.agent.sessions()).sessions[0]?.id;
    expect((await ctx.agent.call('state', {}, id)).homeId).toBe('gh1');
  });

  it('closes the tab when unpaired', async () => {
    const ctx = setup();
    const { link, statuses } = await pairTab(ctx);
    const id = link.session.sessionId;
    await ctx.root.request(`${BRIDGE_MOUNT}/agent/sessions/${id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    await link.closed;
    expect(statuses.at(-1)).toBe('closed');
    expect((await ctx.agent.sessions()).sessions).toHaveLength(0);
  });
});

describe('WebSocket transport', () => {
  it('requires a hello with a valid session token, then relays calls', async () => {
    const hub = new AgentHub({ callTimeoutMs: 500 });
    const paired = hub.pair(hub.pairingCode().code, { app: 'ibasho-web', version: '0' });
    if (!paired.ok) throw new Error('pair failed');
    const sent: string[] = [];
    const closes: number[] = [];
    const ws = {
      send: (s: string) => sent.push(s),
      close: (code: number) => closes.push(code),
    } as never;
    const ev = (data: string) => ({ data }) as MessageEvent;

    const bad = bridgeWebSocketEvents(hub);
    bad.onMessage?.(ev(JSON.stringify({ t: 'hello', sessionToken: 'x'.repeat(32) })), ws);
    expect(closes).toEqual([1008]);

    const good = bridgeWebSocketEvents(hub);
    good.onOpen?.(new Event('open'), ws);
    good.onMessage?.(ev(JSON.stringify({ t: 'hello', sessionToken: paired.sessionToken })), ws);
    expect(JSON.parse(sent[0] ?? '{}')).toMatchObject({ t: 'welcome', sessionId: paired.sessionId });
    const pending = hub.call(undefined, 'state', {});
    const call = JSON.parse(sent[1] ?? '{}') as { id: string };
    good.onMessage?.(ev(JSON.stringify({ t: 'result', id: call.id, ok: true, result: state })), ws);
    await expect(pending).resolves.toEqual(state);
    good.onClose?.(new CloseEvent('close'), ws);
    await expect(hub.call(undefined, 'state', {})).rejects.toBeInstanceOf(LinkCallError);
  });
});

describe('discovery file', () => {
  it('writes 0600 atomically, reads back, detects stale pids, removes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ibasho-disc-'));
    const env = { IBASHO_CONFIG_DIR: dir };
    try {
      expect(readServerJson(env)).toMatchObject({ ok: false, reason: 'missing' });
      const info = { port: 7357, token: TOKEN, pid: process.pid, startedAt: new Date().toISOString() };
      const path = writeServerJson(info, env);
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(readServerJson(env)).toEqual({ ok: true, server: info });
      writeFileSync(path, JSON.stringify({ ...info, pid: 2 ** 22 + 12345 }));
      expect(readServerJson(env)).toMatchObject({ ok: false, reason: 'stale' });
      writeFileSync(path, '{nope');
      expect(readServerJson(env)).toMatchObject({ ok: false, reason: 'invalid' });
      removeServerJson(env);
      expect(() => readFileSync(path)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('tightens an existing config directory and leftover temp file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ibasho-disc-'));
    const env = { IBASHO_CONFIG_DIR: dir };
    try {
      chmodSync(dir, 0o755);
      const leftover = join(dir, `server.json.${process.pid}.tmp`);
      writeFileSync(leftover, 'old', { mode: 0o644 });
      const info = { port: 7357, token: TOKEN, pid: process.pid, startedAt: new Date().toISOString() };
      const path = writeServerJson(info, env);
      expect(statSync(dir).mode & 0o777).toBe(0o700);
      expect(statSync(path).mode & 0o777).toBe(0o600);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('agent client explains when the app is not running', async () => {
    const client = new BridgeAgentClient({ env: { IBASHO_CONFIG_DIR: join(tmpdir(), 'ibasho-none-x') } });
    await expect(client.sessions()).rejects.toThrow(/Settings > Agent link/);
  });
});
