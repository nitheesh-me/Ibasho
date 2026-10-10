/**
 * The engine behind Comlink on a MessageChannel, as the app's worker exposes it (WP-02, M-0).
 * Node's MessageChannel is the web one, so this exercises the same structured clone (typed arrays,
 * bigint) and the proxied `{ jobId, result }` that the browser worker uses.
 */
import { createRegistry, type SearchProgress, type SearchResult } from '@ibasho/core';
import * as Comlink from 'comlink';
import { afterAll, describe, expect, it } from 'vitest';
import { M0_OPTION_IDS } from '../src/search/plan.ts';
import { type ExposedEngine, exposeEngine } from '../src/worker.ts';
import { allPlugins, MODULES, request } from './gh1.ts';

// The engine tsconfig carries no DOM or Node types (the engine is platform free), so the global
// MessageChannel is typed here.
interface Port {
  close(): void;
}
const { MessageChannel } = globalThis as unknown as {
  MessageChannel: new () => { port1: Port; port2: Port };
};
const channel = new MessageChannel();
const engine = exposeEngine(channel.port1 as unknown as Comlink.Endpoint, {
  modules: MODULES.map((m) => ({ id: m.id, load: async () => ({ default: m }) })),
  allowOptions: M0_OPTION_IDS,
});
const remote = Comlink.wrap<ExposedEngine>(channel.port2 as unknown as Comlink.Endpoint);
afterAll(() => {
  channel.port1.close();
  channel.port2.close();
});

describe('engine over Comlink', () => {
  it('init, search with progress, and the result crosses as typed arrays', async () => {
    const shared = createRegistry();
    shared.registerAll(await allPlugins());
    await remote.init(
      MODULES.map((m) => m.id),
      shared.fingerprint({ side: 'both' }),
    );
    const phases: SearchProgress['phase'][] = [];
    const job = await remote.search(
      request(),
      Comlink.proxy((p: SearchProgress) => {
        phases.push(p.phase);
      }),
    );
    const jobId = await job.jobId;
    const result = (await job.result) as SearchResult;
    expect(jobId).toMatch(/^job-/);
    expect(result.packages.ids).toHaveLength(8);
    expect(result.packages.n0).toBeInstanceOf(BigInt64Array);
    expect(result.front).toBeInstanceOf(Uint32Array);
    expect(result.hash).toBe(engine.stateOf(result.hash)?.result.hash);
    expect(phases).toContain('heavy');
    const nodes = await remote.evidence(result.hash, { quantity: 'fin.npv' });
    expect(nodes.length).toBeGreaterThan(0);
  });
});
