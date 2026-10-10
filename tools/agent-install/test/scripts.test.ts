/**
 * The plugin's standalone scripts: the SubagentStart hook, `iq` and the MCP launcher, run as real
 * processes against a temp config dir and a loopback stand-in for the bridge.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PLUGIN = resolve(import.meta.dirname, '..', '..', '..', 'integrations', 'claude-code');
const TOKEN = 'd'.repeat(64);
let dir: string;
let server: Server;
let port = 0;
const seen: { url: string; auth: string | undefined; body: string }[] = [];

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ibasho-scripts-'));
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
    });
    req.on('end', () => {
      seen.push({ url: req.url ?? '', auth: req.headers.authorization, body });
      if (req.headers.authorization !== `Bearer ${TOKEN}`) {
        res.writeHead(401).end('{"error":{"code":"unauthorized","message":"no"}}');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          sessions: [],
          pairing: { code: 'K7QM-2XPA', expiresAt: '2026-10-11T12:10:00.000Z' },
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  port = typeof addr === 'object' && addr ? addr.port : 0;
});
afterAll(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

function run(
  script: string,
  args: string[],
  cfg: string,
): Promise<{ code: number; out: string; err: string }> {
  return new Promise((res) => {
    const p = spawn(process.execPath, [join(PLUGIN, script), ...args], {
      env: { PATH: process.env.PATH ?? '', HOME: dir, IBASHO_CONFIG_DIR: cfg },
    });
    let out = '';
    let err = '';
    p.stdout.on('data', (c) => {
      out += c;
    });
    p.stderr.on('data', (c) => {
      err += c;
    });
    p.on('close', (code) => res({ code: code ?? 1, out, err }));
  });
}

function writeServer(cfg: string, extra: Record<string, unknown> = {}) {
  mkdirSync(cfg, { recursive: true });
  writeFileSync(
    join(cfg, 'server.json'),
    JSON.stringify({ port, token: TOKEN, pid: process.pid, startedAt: new Date().toISOString(), ...extra }),
  );
}

describe('SubagentStart hook', () => {
  it('says the app is not running when there is no server.json', async () => {
    const r = await run('hooks/inject-context.mjs', ['SubagentStart'], join(dir, 'none'));
    expect(r.code).toBe(0);
    const out = JSON.parse(r.out);
    expect(out.hookSpecificOutput.hookEventName).toBe('SubagentStart');
    expect(out.hookSpecificOutput.additionalContext).toMatch(/not running/);
  });

  it('treats a dead pid as stale', async () => {
    const cfg = join(dir, 'stale');
    writeServer(cfg, { pid: 2 ** 22 + 4321 });
    const r = await run('hooks/inject-context.mjs', ['SubagentStart'], cfg);
    expect(JSON.parse(r.out).hookSpecificOutput.additionalContext).toMatch(/not running/);
  });

  it('injects the base URL, token and pairing code from the live bridge', async () => {
    const cfg = join(dir, 'live');
    writeServer(cfg);
    const r = await run('hooks/inject-context.mjs', ['SubagentStart'], cfg);
    const ctx = JSON.parse(r.out).hookSpecificOutput.additionalContext as string;
    expect(ctx).toContain(`http://127.0.0.1:${port}/agent-link`);
    expect(ctx).toContain(`Bearer ${TOKEN}`);
    expect(ctx).toContain('K7QM-2XPA');
    expect(seen.at(-1)?.url).toBe('/agent-link/agent/sessions');
  });
});

describe('iq helper', () => {
  it('sends the token from server.json and prints the body', async () => {
    const cfg = join(dir, 'iq');
    writeServer(cfg);
    const r = await run('bin/iq.mjs', ['POST', '/agent/call', '{"method":"state","params":{}}'], cfg);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toHaveProperty('pairing');
    const last = seen.at(-1);
    expect(last).toMatchObject({ url: '/agent-link/agent/call', auth: `Bearer ${TOKEN}` });
    expect(JSON.parse(last?.body ?? '{}')).toEqual({ method: 'state', params: {} });
  });

  it('explains when the companion is not running', async () => {
    const r = await run('bin/iq.mjs', ['GET', '/agent/sessions'], join(dir, 'nothing'));
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/Settings > Agent link/);
  });
});

describe('MCP launcher', () => {
  it('finds the checkout by walking up and starts the server on stdio', () => {
    const init = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } },
    });
    const r = spawnSync(process.execPath, [join(PLUGIN, 'bin', 'ibasho-mcp.mjs')], {
      input: `${init}\n`,
      encoding: 'utf8',
      timeout: 15_000,
      env: { PATH: process.env.PATH ?? '', HOME: dir, IBASHO_CONFIG_DIR: join(dir, 'mcp') },
    });
    const first = r.stdout.split('\n').find((l) => l.includes('"id":1'));
    expect(first, r.stderr).toBeTruthy();
    expect(JSON.parse(first ?? '{}').result.serverInfo.name).toBe('ibasho');
  }, 20_000);
});
