/**
 * L1 (contract) and L3 (typed ops only) for the MCP server, through the SDK in-memory transport.
 * The engine is a FAKE (test/fake-engine.ts): these tests check wiring and grounding, not physics.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type AgentLink, BRIDGE_MOUNT, connectAgentLink, type LiveHandlers } from '@ibasho/agent-bridge';
import { AgentHub, BridgeAgentClient, createBridgeApp } from '@ibasho/agent-bridge/server';
import type { CheckerRung } from '@ibasho/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ALL_TOOLS,
  createIbashoMcpServer,
  engineFrom,
  engineFromModule,
  fileCatalog,
  groundingViolations,
  HEADLESS_TOOLS,
  LIVE_TOOLS,
  MemoryLog,
  NO_ENGINE,
  PROMPTS,
  RESOURCE_TEMPLATES,
  RESOURCE_URIS,
} from '../src/index.ts';
import { repoPath } from '../src/paths.ts';
import { type FakeEngine, fakeEngine } from './fake-engine.ts';

const TOKEN = 'c'.repeat(64);
let tmp: string;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ibasho-mcp-'));
});
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

interface Ctx {
  client: Client;
  engine: FakeEngine;
  hub: AgentHub;
  fetchImpl: typeof fetch;
}

let n = 0;
async function connect(opts: { engine?: 'fake' | 'none'; mirror?: CheckerRung | null } = {}): Promise<Ctx> {
  n += 1;
  const dir = join(tmp, `run${n}`);
  mkdirSync(join(dir, 'homes'), { recursive: true });
  const engine = fakeEngine();
  const hub = new AgentHub({ callTimeoutMs: 1000 });
  const bridge = createBridgeApp({ hub, token: TOKEN, pingMs: 60_000, basePath: BRIDGE_MOUNT });
  const fetchImpl = ((input: string | URL | Request, init?: RequestInit) =>
    bridge.request(String(input), init)) as typeof fetch;
  const live = new BridgeAgentClient({
    fetch: fetchImpl,
    server: () => ({ port: 7357, token: TOKEN, pid: process.pid, startedAt: new Date().toISOString() }),
  });
  const server = createIbashoMcpServer({
    env: { IBASHO_CONFIG_DIR: dir },
    engine: opts.engine === 'none' ? NO_ENGINE : engineFrom(engine),
    homes: fileCatalog({
      fixturesDir: repoPath('packages/fixtures/src/homes'),
      homesDir: join(dir, 'homes'),
    }),
    memory: new MemoryLog(join(dir, 'memory')),
    live,
    loadMirror: async () => opts.mirror ?? null,
  });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, engine, hub, fetchImpl };
}

type ToolResult = { isError?: boolean; content: { type: string; text?: string; data?: string }[] };

async function call(c: Client, name: string, args: Record<string, unknown> = {}) {
  const r = (await c.callTool({ name, arguments: args })) as ToolResult;
  const text = r.content[0]?.text;
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { r, json: json as Record<string, unknown> & { [k: string]: unknown } };
}

function grounded(json: unknown) {
  expect(groundingViolations(json)).toEqual([]);
}

describe('L1 MCP contract', () => {
  it('lists every ARCH 14 tool with an object input schema and a description', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...ALL_TOOLS].sort());
    expect(ALL_TOOLS).toHaveLength(19);
    for (const t of tools) {
      expect(t.inputSchema.type).toBe('object');
      expect((t.description ?? '').length).toBeGreaterThan(20);
    }
  });

  it('lists resources, templates and prompts', async () => {
    const { client } = await connect();
    const res = await client.listResources();
    for (const u of RESOURCE_URIS) expect(res.resources.map((r) => r.uri)).toContain(u);
    expect(res.resources.map((r) => r.uri)).toContain('ibasho://home/fixture%3Agh1');
    const tpl = await client.listResourceTemplates();
    expect(tpl.resourceTemplates.map((t) => t.uriTemplate).sort()).toEqual([...RESOURCE_TEMPLATES].sort());
    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((p) => p.name).sort()).toEqual([...PROMPTS].sort());
    const p = await client.getPrompt({ name: 'explore-my-home', arguments: { homeId: 'fixture:gh1' } });
    expect(JSON.stringify(p.messages)).toContain('ev id');
  });

  it('validates input with zod', async () => {
    const { client } = await connect();
    const bad = [
      ['ibasho_get_home', { homeId: 5 }],
      ['ibasho_simulate', { homeId: 'gh1', modes: ['sideways'] }],
      ['ibasho_evidence', { evidenceId: 'not-an-id' }],
      ['ibasho_live_view', { camera: 'drone' }],
      ['ibasho_memory_remember', { homeId: 'gh1', type: 'opApplied', payload: {}, quote: 'x' }],
    ] as const;
    for (const [name, args] of bad) {
      const out = await client.callTool({ name, arguments: args as Record<string, unknown> }).then(
        (r) => (r as ToolResult).isError === true,
        () => true,
      );
      expect(out, name).toBe(true);
    }
  });

  it('returns evidence ids for every number from every headless tool', async () => {
    const mirror: CheckerRung = {
      kind: 'checker-rung',
      id: 'fake-mirror',
      version: '0.0.0',
      rung: 'mirror',
      available: async () => true,
      check: async () => [{ check: 'acct.saving', ok: true, rung: 'mirror', coverage: 'all' }],
    } as unknown as CheckerRung;
    const { client } = await connect({ mirror });
    const outputs: unknown[] = [];
    const run = async (name: string, args: Record<string, unknown>) => {
      const { r, json } = await call(client, name, args);
      expect(r.isError, `${name}: ${r.content[0]?.text}`).toBeFalsy();
      grounded(json);
      outputs.push(json);
      return json;
    };
    const list = await run('ibasho_list_homes', {});
    expect(JSON.stringify(list)).toContain('fixture:gh1');
    const home = await run('ibasho_get_home', { homeId: 'gh1' });
    const cat = home.catalogue as { measures: { measureId: string; group: string }[] };
    expect(cat.measures.find((m) => m.measureId === 'ashp')?.group).toBe('heat');
    expect((home.estimated as unknown[]).length).toBe(33);
    expect((home.known as unknown[]).length).toBe(27);
    const sim = await run('ibasho_simulate', { homeId: 'gh1', modes: ['standard', 'your-home'] });
    const ev = sim.evidence as { ev: string; value: string }[];
    expect(ev.length).toBeGreaterThan(0);
    for (const e of ev) expect(e.ev).toMatch(/^ev_/);
    const wi = await run('ibasho_what_if', {
      homeId: 'gh1',
      ops: [{ op: 'addMeasure', measureId: 'loft', params: { option: 'loft-300' } }],
    });
    expect((wi.deltas as unknown[]).length).toBeGreaterThan(0);
    expect(wi.packageId).toBe('loft-300');
    const heat = await run('ibasho_what_if', {
      homeId: 'gh1',
      ops: [
        { op: 'addMeasure', measureId: 'ashp', params: { option: 'heat-ashp' } },
        { op: 'addMeasure', measureId: 'cylinder' },
        { op: 'addMeasure', measureId: 'draught' },
      ],
    });
    expect(heat.packageId).toBe('cylinder-new+draught-proofing-chimney-balloon+heat-ashp');
    const fut = await run('ibasho_search_futures', { homeId: 'gh1', budgetGBP: 12000 });
    const hash = fut.resultHash as string;
    expect(fut.picks).toMatchObject({ leastUpfront: 'baseline', bestReturn: 'loft-300' });
    await run('ibasho_evidence', { evidenceId: ev[0]?.ev });
    const why = await run('ibasho_why_not', { resultHash: hash, measure: 'wall-iwi' });
    expect(why.reasons).toHaveProperty('dominated');
    const ashp = await run('ibasho_why_not', { resultHash: hash, measure: 'ashp' });
    expect(ashp.checksToUnlock).toEqual(['UK.DNO.HP.LOOPED']);
    const ver = await run('ibasho_verify', { resultHash: hash });
    expect(ver.checked).toBe(true);
    await run('ibasho_compare', { homes: ['gh1', 'fixture:gh1'] });
    await run('ibasho_compare', { resultHash: hash, packages: ['baseline', 'loft-300'] });
    await run('ibasho_memory_list', { homeId: 'gh1' });
    expect(outputs).toHaveLength(13);
    const cert = await client.readResource({ uri: `ibasho://cert/${hash}` });
    expect((cert.contents[0] as { text?: string } | undefined)?.text).toContain('ibasho.cert/2');
  });

  it('says plainly when the engine is not available, and keeps non-computing tools working', async () => {
    const { client } = await connect({ engine: 'none' });
    const { r, json } = await call(client, 'ibasho_simulate', { homeId: 'gh1' });
    expect(r.isError).toBe(true);
    expect(json.error).toBe('engine-unavailable');
    expect(String(json.message)).toMatch(/not yet available/);
    expect((await call(client, 'ibasho_get_home', { homeId: 'gh1' })).r.isError).toBeFalsy();
    const ver = await call(client, 'ibasho_verify', { resultHash: 'deadbeefcafe' });
    expect(ver.r.isError).toBe(true);
  });

  it('engine adapter reports a missing module or a missing factory', async () => {
    await expect(engineFromModule(join(tmp, 'nope.ts')).engine()).rejects.toThrow(/not yet available/);
    const mod = join(tmp, 'empty-engine.mjs');
    writeFileSync(mod, 'export const x = 1;\n');
    await expect(engineFromModule(`file://${mod}`).engine()).rejects.toThrow(/createEngineApi/);
    const good = join(tmp, 'good-engine.mjs');
    writeFileSync(
      good,
      'export function createEngineApi() { return { simulate() {}, search() {}, evidence() {} }; }\n',
    );
    await expect(engineFromModule(`file://${good}`).engine()).resolves.toHaveProperty('simulate');
  });

  it('serves schema and home resources', async () => {
    const { client } = await connect();
    const ops = await client.readResource({ uri: 'ibasho://schema/ops' });
    const schema = JSON.parse((ops.contents[0] as { text?: string } | undefined)?.text ?? '{}') as {
      anyOf?: unknown[];
      oneOf?: unknown[];
    };
    expect((schema.anyOf ?? schema.oneOf ?? []).length).toBe(9);
    const twin = await client.readResource({ uri: 'ibasho://schema/twin' });
    expect((twin.contents[0] as { text?: string } | undefined)?.text).toContain('ibasho.twin/2');
    const home = await client.readResource({ uri: 'ibasho://home/fixture%3Agh1' });
    expect(JSON.parse((home.contents[0] as { text?: string } | undefined)?.text ?? '{}')).toMatchObject({
      id: 'gh1',
      schema: 'ibasho.twin/2',
    });
  });
});

describe('L3 typed ops only', () => {
  it('rejects any op outside the ScenarioOp schema before the engine runs', async () => {
    const { client, engine } = await connect();
    // Unknown op kinds fail input validation.
    const evalOp = await client
      .callTool({ name: 'ibasho_what_if', arguments: { homeId: 'gh1', ops: [{ op: 'eval', code: '1' }] } })
      .then(
        (r) => (r as ToolResult).isError === true,
        () => true,
      );
    expect(evalOp).toBe(true);
    // Known kinds with extra or malformed fields fail the strict core schema.
    const { json } = await call(client, 'ibasho_what_if', {
      homeId: 'gh1',
      ops: [
        { op: 'addMeasure', measureId: 'loft', params: { option: 'loft-300' }, code: 'process.exit()' },
        { op: 'setParam', path: '__proto__.polluted', value: 1 },
        { op: 'setParam', path: 'legal.valueGBP', value: 1 },
        { op: 'addMeasure', measureId: 'loft' },
        { op: 'explain', evidenceId: 'ev_1' },
        { op: 'addMeasure', measureId: 'solar-roof-tiles' },
        { op: 'addMeasure', measureId: 'loft', params: { option: 'pv-3kwp' } },
      ],
    });
    const rejected = json.rejected as { code: string }[];
    expect(rejected.map((x) => x.code)).toEqual([
      'schema',
      'schema',
      'range',
      'range',
      'read-only',
      'unknown-measure',
      'range',
    ]);
    expect(json.accepted).toEqual([]);
    expect(engine.calls).toHaveLength(0);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('applies an owner parameter to a copy, re-validated', async () => {
    const { client, engine } = await connect();
    const { r, json } = await call(client, 'ibasho_what_if', {
      homeId: 'gh1',
      ops: [{ op: 'setParam', path: 'occupancy.setpointC', value: 19 }],
    });
    expect(r.isError).toBeFalsy();
    expect(json.accepted).toEqual(['setParam occupancy.setpointC']);
    expect(engine.calls.map((c) => c.method)).toEqual(['simulate', 'simulate']);
    const before = (json.before as { resultHash: string }).resultHash;
    const after = (json.after as { resultHash: string }).resultHash;
    expect(before).not.toBe(after);
  });

  it('has no code execution path in the agent link sources', () => {
    const roots = [repoPath('apps/mcp/src'), repoPath('packages/agent-bridge/src')];
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts')) files.push(p);
      }
    };
    for (const r of roots) walk(r);
    expect(files.length).toBeGreaterThan(8);
    const banned = [
      /\beval\s*\(/,
      /new\s+Function\s*\(/,
      /node:vm/,
      /child_process/,
      /\bexecSync\b/,
      /\bspawn\s*\(/,
    ];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const b of banned) expect(b.test(src), `${f} matches ${b}`).toBe(false);
    }
  });
});

describe('memory tools', () => {
  it('remembers typed statements with a quote, feeds the search, and forgets for real', async () => {
    const { client, engine } = await connect();
    const bad = await call(client, 'ibasho_memory_remember', {
      homeId: 'gh1',
      type: 'measureRejected',
      payload: { measureId: 'wall-iwi', scope: 'forever' },
      quote: 'no inside insulation',
    });
    expect(bad.r.isError).toBe(true);
    const ok = await call(client, 'ibasho_memory_remember', {
      homeId: 'gh1',
      type: 'measureRejected',
      payload: { measureId: 'wall-iwi', scope: 'never', reason: 'keep the cornicing' },
      quote: 'I never want inside wall insulation, the cornicing stays',
    });
    expect(ok.r.isError).toBeFalsy();
    const list = await call(client, 'ibasho_memory_list', { homeId: 'gh1' });
    expect(list.json.preferences).toMatchObject({ ruledOut: [{ measureId: 'wall-iwi', scope: 'never' }] });
    const fut = await call(client, 'ibasho_search_futures', { homeId: 'gh1' });
    const searchCall = engine.calls.find((c) => c.method === 'search')?.arg as {
      memory: { rejected: string[] };
    };
    expect(searchCall.memory.rejected).toEqual(['wall-iwi']);
    const why = await call(client, 'ibasho_why_not', {
      resultHash: fut.json.resultHash,
      measure: 'wall-iwi',
    });
    expect(why.json.ruledOutByYou).toMatchObject({ scope: 'never' });
    expect(why.json.inSearch).toBe(false);
    const forget = await call(client, 'ibasho_memory_forget', {
      homeId: 'gh1',
      selector: { kind: 'measure', measureId: 'wall-iwi' },
    });
    expect((forget.json.forgotten as unknown[]).length).toBe(1);
    const after = await call(client, 'ibasho_memory_list', { homeId: 'gh1' });
    expect((after.json.events as { type: string }[]).map((e) => e.type)).toEqual(['memoryForgotten']);
  });
});

describe('live tools through the bridge (fake tab)', () => {
  const links: AgentLink[] = [];
  afterEach(() => {
    for (const l of links.splice(0)) l.close();
  });

  const tab = (over: Partial<LiveHandlers> = {}): LiveHandlers => ({
    state: async () => ({
      homeId: 'gh1',
      route: '/app/home',
      chapter: null,
      layer: null,
      selection: [],
      resultHash: null,
      agentEditPending: false,
    }),
    apply: async (p) => ({ accepted: p.ops, rejected: [], undoId: 'undo-1', resultHash: null }),
    view: async () => ({
      state: {
        homeId: 'gh1',
        route: '/app/home',
        chapter: null,
        layer: 'heat',
        selection: [],
        resultHash: null,
        agentEditPending: false,
      },
    }),
    thread: async (p) => ({ path: [p.evidenceId, 'ev_2'] }),
    screenshot: async () => ({
      mime: 'image/png',
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    }),
    say: async () => ({ rendered: true, issues: [] }),
    ...over,
  });

  it('gives the pairing code when no tab is paired, then drives the tab', async () => {
    const ctx = await connect();
    const none = await call(ctx.client, 'ibasho_live_sessions');
    expect((none.json.pairing as { code: string }).code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    const offline = await call(ctx.client, 'ibasho_live_state');
    expect(offline.json.error).toBe('live-no-session');

    const say = vi.fn(tab().say);
    const statuses: string[] = [];
    const link = await connectAgentLink({
      origin: 'http://127.0.0.1:7357',
      pair: { code: (none.json.pairing as { code: string }).code },
      client: { app: 'ibasho-web', version: '0.0.0' },
      handlers: tab({ say }),
      fetch: ctx.fetchImpl,
      onStatus: (s) => statuses.push(s),
      maxReconnects: 0,
    });
    links.push(link);
    await vi.waitFor(() => expect(statuses).toContain('connected'));

    const sessions = await call(ctx.client, 'ibasho_live_sessions');
    expect(sessions.json.pairing).toBeNull();
    expect((await call(ctx.client, 'ibasho_live_state')).json.homeId).toBe('gh1');
    const applied = await call(ctx.client, 'ibasho_live_apply', {
      ops: [{ op: 'addMeasure', measureId: 'loft', params: { option: 'loft-300' } }],
      label: 'Top up the loft',
    });
    expect(applied.json).toMatchObject({ accepted: ['addMeasure loft'], undoId: 'undo-1' });
    const badApply = await call(ctx.client, 'ibasho_live_apply', {
      ops: [{ op: 'addMeasure', measureId: 'loft', script: 'x' }],
    });
    expect(badApply.json.error).toBe('live-bad-request');
    expect(
      (await call(ctx.client, 'ibasho_live_view', { layer: 'heat', camera: 'cutaway' })).r.isError,
    ).toBeFalsy();
    expect((await call(ctx.client, 'ibasho_live_thread', { evidenceId: 'ev_1' })).json.path).toEqual([
      'ev_1',
      'ev_2',
    ]);
    const shot = (await ctx.client.callTool({ name: 'ibasho_live_screenshot', arguments: {} })) as ToolResult;
    expect(shot.content[0]).toMatchObject({ type: 'image' });
    expect((shot.content[0]?.data ?? '').length).toBeGreaterThan(20);

    // L6: a raw digit is refused before it reaches the tab; slots pass.
    const raw = await call(ctx.client, 'ibasho_live_say', {
      section: 'answer',
      text: 'This saves £300 a year.',
    });
    expect(raw.r.isError).toBe(true);
    expect(String(raw.json.message)).toMatch(/G2/);
    const slotted = await call(ctx.client, 'ibasho_live_say', {
      section: 'answer',
      text: 'Topping up [[m:loft]] saves [[e:ev_3f2a|approx]] a year.',
    });
    expect(slotted.json).toMatchObject({ rendered: true });
    expect(say).toHaveBeenCalledOnce();
  });

  it('lists the live tools and explains when the app is not running', async () => {
    expect(LIVE_TOOLS).toHaveLength(7);
    expect(HEADLESS_TOOLS).toHaveLength(12);
    const server = createIbashoMcpServer({
      env: { IBASHO_CONFIG_DIR: join(tmp, 'no-app') },
      engine: NO_ENGINE,
    });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 't', version: '0' });
    await Promise.all([server.connect(a), client.connect(b)]);
    const r = await call(client, 'ibasho_live_sessions');
    expect(r.json.error).toBe('app-not-running');
    expect(String(r.json.message)).toMatch(/Settings > Agent link/);
  });
});
