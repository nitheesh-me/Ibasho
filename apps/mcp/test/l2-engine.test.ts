/**
 * L2 (headless parity) for the MCP server: the run-time engine adapter boots the REAL engine
 * (`packages/engine`, WP-02) with the default UK manifest, and a GH1 search through it returns the
 * same result hash as the worker API fixture (`packages/fixtures/src/results/gh1-m0.search.json`,
 * generated and drift-tested by WP-02). Then every computing tool runs on real numbers and stays
 * grounded.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BRIDGE_MOUNT } from '@ibasho/agent-bridge';
import { AgentHub, BridgeAgentClient, createBridgeApp } from '@ibasho/agent-bridge/server';
import type { EngineApi, HomeTwin, IsoDate, OwnerCtx } from '@ibasho/core';
import { parseTwin } from '@ibasho/core/schemas';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createIbashoMcpServer,
  type EngineSource,
  engineFromModule,
  fileCatalog,
  groundingViolations,
  MemoryLog,
} from '../src/index.ts';
import { repoPath } from '../src/paths.ts';

const ASOF = '2026-10-11' as IsoDate;
const fixture = JSON.parse(
  readFileSync(repoPath('packages/fixtures/src/results/gh1-m0.search.json'), 'utf8'),
) as { hash: string; picks: Record<string, number> };
const gh1: HomeTwin = parseTwin(
  JSON.parse(readFileSync(repoPath('packages/fixtures/src/homes/gh1.twin.json'), 'utf8')),
);
const owner: OwnerCtx = { tenure: 'owner', discountRatePpb: 35_000_000n, horizonYears: 25 };

let tmp: string;
let source: EngineSource;
let engine: EngineApi;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'ibasho-mcp-l2-'));
  source = engineFromModule(undefined, {});
  engine = await source.engine();
}, 60_000);
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

async function connect(): Promise<Client> {
  mkdirSync(join(tmp, 'homes'), { recursive: true });
  const hub = new AgentHub({ callTimeoutMs: 1000 });
  const bridge = createBridgeApp({ hub, token: 'd'.repeat(64), pingMs: 60_000, basePath: BRIDGE_MOUNT });
  const live = new BridgeAgentClient({
    fetch: ((input: string | URL | Request, init?: RequestInit) =>
      bridge.request(String(input), init)) as typeof fetch,
    server: () => null,
  });
  const server = createIbashoMcpServer({
    env: { IBASHO_CONFIG_DIR: tmp },
    engine: source,
    homes: fileCatalog({
      fixturesDir: repoPath('packages/fixtures/src/homes'),
      homesDir: join(tmp, 'homes'),
    }),
    memory: new MemoryLog(join(tmp, 'memory')),
    live,
    now: () => new Date(`${ASOF}T12:00:00Z`),
    loadMirror: async () => null,
  });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'l2', version: '0.0.0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

async function call(c: Client, name: string, args: Record<string, unknown>) {
  const r = (await c.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: { text?: string }[];
  };
  const text = r.content[0]?.text ?? '';
  expect(r.isError, `${name}: ${text}`).toBeFalsy();
  const json = JSON.parse(text) as Record<string, unknown>;
  expect(groundingViolations(json), name).toEqual([]);
  return json;
}

describe('L2 headless parity with the worker API (real engine)', () => {
  it('boots createEngine through the adapter and reproduces the GH1 M-0 search hash', async () => {
    const job = await engine.search({
      twin: gh1,
      owner,
      target: { kind: 'default' },
      memory: { rejected: [], completed: [] },
      asOf: ASOF,
    });
    const result = await job.result;
    expect(result.hash).toBe(fixture.hash);
  }, 60_000);

  it('the adapter caches the booted engine', async () => {
    expect(await source.engine()).toBe(engine);
  });

  it('runs every computing tool on real numbers, grounded', async () => {
    const client = await connect();
    const sim = await call(client, 'ibasho_simulate', { homeId: 'gh1', modes: ['standard', 'your-home'] });
    expect((sim.evidence as unknown[]).length).toBeGreaterThan(0);
    const wi = await call(client, 'ibasho_what_if', {
      homeId: 'gh1',
      ops: [{ op: 'addMeasure', measureId: 'loft', params: { option: 'loft-300' } }],
    });
    expect(wi.packageId).toBe('loft-300');
    expect((wi.rejected as unknown[]).length).toBe(0);
    await call(client, 'ibasho_memory_remember', {
      homeId: 'gh1',
      type: 'tenureSet',
      payload: { tenure: 'owner' },
      quote: 'I own the house.',
    });
    const fut = await call(client, 'ibasho_search_futures', { homeId: 'gh1' });
    expect(fut.resultHash).toBe(fixture.hash);
    const hash = fut.resultHash as string;
    const ev = (sim.evidence as { ev: string }[])[0]?.ev;
    await call(client, 'ibasho_evidence', { evidenceId: ev });
    await call(client, 'ibasho_why_not', { resultHash: hash, measure: 'wall-iwi' });
    await call(client, 'ibasho_compare', { resultHash: hash, packages: ['baseline', 'loft-300'] });
  }, 120_000);
});
