import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterAll, describe, expect, it } from 'vitest';
import {
  BRIDGE_MOUNT,
  CheckerBusyError,
  createApp,
  type Health,
  lakeCheckRunner,
  originCheck,
  VERIFY_MAX_BODY,
  type VerifyRunner,
} from '../src/index.ts';
import { forwardToOllama } from '../src/ollama.ts';

const BASE = 'http://127.0.0.1:7357';
const APP_ORIGIN = 'http://localhost:5173';

function fakeRunner(
  code: number,
  stdout = '{"schema":"ibasho.verdicts/1","ok":true}',
  available = true,
): VerifyRunner & { seen: { body: string; batch: boolean }[] } {
  const seen: { body: string; batch: boolean }[] = [];
  return {
    seen,
    available: () => available,
    async run(body, { batch }) {
      seen.push({ body, batch });
      return { code, stdout, stderr: '' };
    },
  };
}

describe('GET /health', () => {
  it('answers without auth and lists what is mounted', async () => {
    const res = await createApp().request(`${BASE}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual<Health>({
      ok: true,
      name: 'ibasho-companion',
      version: '0.1.0',
      routes: ['GET /health'],
      rungs: { leanNative: false },
      ollamaPassThrough: false,
      agentLink: false,
    });
  });

  it('reports the Lean rung, pass-through and agent link when present, with CORS for the app', async () => {
    const app = createApp({ verify: fakeRunner(0), ollama: {}, bridge: new Hono() });
    const res = await app.request(`${BASE}/health`, { headers: { origin: APP_ORIGIN } });
    const h = (await res.json()) as Health;
    expect(h.rungs.leanNative).toBe(true);
    expect(h.ollamaPassThrough).toBe(true);
    expect(h.agentLink).toBe(true);
    expect(h.routes).toContain('POST /verify');
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
  });

  it('refuses a non-loopback Host (DNS rebinding)', async () => {
    const res = await createApp().request('http://evil.example:7357/health');
    expect(res.status).toBe(421);
  });
});

describe('guard: origin, token, CORS', () => {
  const app = createApp({ token: 'tok', verify: fakeRunner(0) });
  const post = (headers: Record<string, string>) =>
    app.request(`${BASE}/verify`, { method: 'POST', body: '{}', headers });

  it('a script needs the bearer token', async () => {
    expect((await post({})).status).toBe(401);
    expect((await post({ authorization: 'Bearer nope' })).status).toBe(401);
    expect((await post({ authorization: 'Bearer tok' })).status).toBe(200);
  });

  it('a browser needs an allowed origin and gets CORS back', async () => {
    expect((await post({ origin: 'https://evil.example' })).status).toBe(403);
    const ok = await post({ origin: APP_ORIGIN });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
  });

  it('answers preflight, including Private Network Access', async () => {
    const res = await app.request(`${BASE}/verify`, {
      method: 'OPTIONS',
      headers: {
        origin: APP_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-private-network': 'true',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-private-network')).toBe('true');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('extra origins come from the list, exact match only', () => {
    const allow = originCheck(['https://ibasho.example/', ' ']);
    expect(allow('https://ibasho.example')).toBe(true);
    expect(allow('https://ibasho.example.evil')).toBe(false);
    expect(allow('http://127.0.0.1:4173')).toBe(true);
    expect(allow('null')).toBe(false);
  });
});

describe('POST /verify', () => {
  const call = (app: Hono, body: string, q = '') =>
    app.request(`${BASE}/verify${q}`, { method: 'POST', body, headers: { authorization: 'Bearer t' } });

  it('maps checker exit codes: 0 and 1 are verdicts, 2 is malformed', async () => {
    const pass = fakeRunner(0);
    const r0 = await call(createApp({ token: 't', verify: pass }), '{"schema":"ibasho.cert/2"}');
    expect(r0.status).toBe(200);
    expect(await r0.json()).toEqual({ schema: 'ibasho.verdicts/1', ok: true });
    expect(pass.seen).toEqual([{ body: '{"schema":"ibasho.cert/2"}', batch: false }]);
    expect((await call(createApp({ token: 't', verify: fakeRunner(1) }), '{}')).status).toBe(200);
    expect((await call(createApp({ token: 't', verify: fakeRunner(2) }), '{}')).status).toBe(422);
  });

  it('batch mode passes --batch and returns NDJSON', async () => {
    const r = fakeRunner(0, '{"ok":true}\n{"ok":true}\n');
    const res = await call(createApp({ token: 't', verify: r }), '{}\n{}\n', '?batch=1');
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    expect(r.seen[0]?.batch).toBe(true);
  });

  it('rejects an empty body and says how to build a missing checker', async () => {
    expect((await call(createApp({ token: 't', verify: fakeRunner(0) }), '  ')).status).toBe(400);
    const missing = lakeCheckRunner({ proofsDir: '/nonexistent', nice: false });
    const res = await call(createApp({ token: 't', verify: missing }), '{}');
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toContain('lake build ibasho-check');
  });
});

describe('POST /verify limits', () => {
  it('refuses an oversized body, streamed without Content-Length too', async () => {
    const r = fakeRunner(0);
    const app = createApp({ token: 't', verify: r });
    const chunk = new Uint8Array(1024 * 1024).fill(123);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(ctl) {
        if (sent > VERIFY_MAX_BODY) ctl.close();
        else {
          sent += chunk.byteLength;
          ctl.enqueue(chunk);
        }
      },
    });
    const res = await app.request(`${BASE}/verify`, {
      method: 'POST',
      body,
      headers: { authorization: 'Bearer t' },
      duplex: 'half',
    } as RequestInit);
    expect(res.status).toBe(413);
    expect(r.seen).toEqual([]);
  });

  it('a busy checker answers 429', async () => {
    const busy: VerifyRunner = {
      available: () => true,
      run: () => Promise.reject(new CheckerBusyError('busy')),
    };
    const res = await createApp({ token: 't', verify: busy }).request(`${BASE}/verify`, {
      method: 'POST',
      body: '{}',
      headers: { authorization: 'Bearer t' },
    });
    expect(res.status).toBe(429);
  });
});

describe('lakeCheckRunner (real process)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ibasho-companion-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  // A stand-in for ibasho-check: echoes its args and input length, exits 1 when the input says so.
  const bin = join(dir, 'ibasho-check');
  writeFileSync(
    bin,
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell script, not a template.
    '#!/bin/sh\nIN=$(cat)\nprintf \'{"args":"%s","len":%d}\\n\' "$*" "${#IN}"\ncase "$IN" in *fail*) exit 1;; esac\nexit 0\n',
  );
  chmodSync(bin, 0o755);

  it('pipes the certificate on stdin, passes --batch and returns the exit code', async () => {
    const r = lakeCheckRunner({ proofsDir: dir, binary: bin });
    expect(r.available()).toBe(true);
    const ok = await r.run('{"x":1}', { batch: false });
    expect(ok).toEqual({ code: 0, stdout: '{"args":"","len":7}\n', stderr: '' });
    const bad = await r.run('fail', { batch: true });
    expect(bad.code).toBe(1);
    expect(bad.stdout).toContain('"args":"--batch"');
  });

  it('runs one check at a time', async () => {
    const r = lakeCheckRunner({ proofsDir: dir, binary: bin, nice: false });
    const out = await Promise.all([
      r.run('a', { batch: false }),
      r.run('bb', { batch: false }),
      r.run('ccc', { batch: false }),
    ]);
    expect(out.map((o) => o.stdout.trim())).toEqual([
      '{"args":"","len":1}',
      '{"args":"","len":2}',
      '{"args":"","len":3}',
    ]);
  });

  it('caps the queue and skips checks whose caller hung up', async () => {
    const r = lakeCheckRunner({ proofsDir: dir, binary: bin, nice: false, maxQueue: 2 });
    const gone = new AbortController();
    gone.abort();
    const runs = [r.run('a', { batch: false }), r.run('b', { batch: false, signal: gone.signal })];
    await expect(r.run('c', { batch: false })).rejects.toBeInstanceOf(CheckerBusyError);
    const [a, b] = await Promise.allSettled(runs);
    expect(a?.status).toBe('fulfilled');
    expect(b?.status).toBe('rejected');
    await new Promise((ok) => setTimeout(ok, 0));
    expect((await r.run('d', { batch: false })).code).toBe(0);
  });
});

describe('Ollama CORS pass-through', () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({ models: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-secret': 'no' },
    });
  };
  const app = createApp({ ollama: { host: 'http://127.0.0.1:11434', fetch } });

  it('forwards the provider endpoints without the browser Origin, and adds CORS for the app', async () => {
    const res = await app.request(`${BASE}/llm/ollama-cors/api/tags`, { headers: { origin: APP_ORIGIN } });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
    expect(res.headers.get('x-secret')).toBeNull();
    expect(seen[0]?.url).toBe('http://127.0.0.1:11434/api/tags');
    expect(JSON.stringify(seen[0]?.init?.headers)).not.toContain('origin');

    const chat = await app.request(`${BASE}/llm/ollama-cors/api/chat`, {
      method: 'POST',
      body: '{"model":"qwen3:4b","messages":[]}',
      headers: { origin: APP_ORIGIN, 'content-type': 'application/json' },
    });
    expect(chat.status).toBe(200);
    expect(new TextDecoder().decode(seen[1]?.init?.body as ArrayBuffer)).toBe(
      '{"model":"qwen3:4b","messages":[]}',
    );
  });

  it('is not an open proxy: other paths, other methods, other origins and remote hosts are refused', async () => {
    expect(
      (
        await app.request(`${BASE}/llm/ollama-cors/api/pull`, {
          method: 'POST',
          body: '{}',
          headers: { origin: APP_ORIGIN },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request(`${BASE}/llm/ollama-cors/api/delete`, {
          method: 'DELETE',
          headers: { origin: APP_ORIGIN },
        })
      ).status,
    ).toBe(404);
    expect(
      (await app.request(`${BASE}/llm/ollama-cors/api/tags`, { headers: { origin: 'https://evil.example' } }))
        .status,
    ).toBe(403);
    const remote = await forwardToOllama(new Request('http://x/api/tags'), '/api/tags', {
      host: 'http://10.0.0.5:11434',
      fetch,
    });
    expect(remote?.status).toBe(500);
  });

  it('says 502 when the daemon is down', async () => {
    const down = createApp({
      ollama: {
        fetch: async () => {
          throw new Error('ECONNREFUSED');
        },
      },
    });
    const res = await down.request(`${BASE}/llm/ollama-cors/api/version`, {
      headers: { origin: APP_ORIGIN },
    });
    expect(res.status).toBe(502);
  });
});

describe('agent link mount point', () => {
  it('mounts the bridge sub-app at /agent-link and leaves its auth to it', async () => {
    const bridge = new Hono();
    bridge.get('/status', (c) => c.json({ bridge: true }));
    const app = createApp({ token: 't', bridge });
    expect(BRIDGE_MOUNT).toBe('/agent-link');
    const res = await app.request(`${BASE}/agent-link/status`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ bridge: true });
    // The Host check still applies to the bridge.
    expect((await app.request('http://evil.example:7357/agent-link/status')).status).toBe(421);
  });
});
