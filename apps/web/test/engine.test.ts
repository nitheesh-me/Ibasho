/**
 * The app's engine worker body on a MessageChannel, exactly as the browser worker serves it:
 * the real manifest, the real WP-02 engine, the real WP-04 mirror. No mocks.
 */
import { exitCode } from '@ibasho/verify';
import type * as Comlink from 'comlink';
import { afterAll, describe, expect, it } from 'vitest';
import { connectEngine, runSearch } from '../src/engine/client.ts';
import { sampleHome, searchRequest } from '../src/home/sample.ts';
import { homeView, packageName } from '../src/home/view.ts';
import { ENGINE_MODULE_IDS, manifest } from '../src/manifest.ts';
import { serveEngine } from '../src/worker/serve.ts';

const channel = new MessageChannel();
serveEngine(channel.port1 as unknown as Comlink.Endpoint, manifest.engine);
afterAll(() => {
  channel.port1.close();
  channel.port2.close();
});

const home = sampleHome('gh1')!;
// One init per worker, as in the browser (a second init would register the packs twice).
const ready = connectEngine(channel.port2 as unknown as Comlink.Endpoint, manifest);

describe('engine worker wiring', () => {
  it('lists the four UK engine modules in boot order', () => {
    expect(ENGINE_MODULE_IDS).toEqual([
      'pack-climate/engine',
      'pack-home-uk/engine',
      'pack-money-uk/engine',
      'pack-rules-uk/engine',
    ]);
    expect(sampleHome('nowhere')).toBeUndefined();
  });

  it('boots, searches GH1, and the mirror agrees with every row', async () => {
    const engine = await ready;
    const phases: string[] = [];
    const { result, check } = await runSearch(engine, searchRequest(home), (p) => phases.push(p.phase));
    expect(result.packages.ids).toHaveLength(8);
    expect(result.packages.n0).toBeInstanceOf(BigInt64Array);
    expect(phases).toContain('heavy');
    expect(check.rung).toBe('mirror');
    expect(check.coverage).toBe('all');
    expect(check.report.error).toBeUndefined();
    expect(check.report.ok).toBe(true);
    expect(exitCode(check.report)).toBe(0);
    expect(check.report.specHash).toBe(result.specHash);

    const view = homeView(result, check.report.ok);
    expect(view.checked).toBe(true);
    expect(view.picks.map((p) => p.title)).toEqual(['Least upfront', 'Best return', 'Lowest running carbon']);
    for (const p of view.picks) {
      expect(p.figures).toHaveLength(4);
      for (const f of p.figures) expect(result.graph.nodes.some((n) => n.id === f.ev)).toBe(true);
    }
    expect(view.picks[2]?.sameAs).toBe(
      view.picks[1]?.packageId === view.picks[2]?.packageId ? 'Best return' : undefined,
    );
    expect(view.claims.map((c) => c.sentence)).toEqual(['What you ruled out never came back']);
    expect(view.lane.length).toBeGreaterThan(0);
    expect(view.lane.every((l) => /air source heat pump/i.test(l.name))).toBe(true);
    expect(view.lane[0]?.reason).toMatch(/network operator/);
  });

  it('refuses to verify a result it does not hold', async () => {
    const engine = await ready;
    await expect(engine.verify('nope', home.twin)).rejects.toThrow(/no result/);
  });

  it('a mirror disagreement takes the Checked seal away', async () => {
    const engine = await ready;
    const { result } = await runSearch(engine, searchRequest(home));
    expect(homeView(result, false).checked).toBe(false);
  });
});

describe('names', () => {
  it('reads package ids as plain measure names', () => {
    expect(packageName('baseline')).toBe('No change');
    expect(packageName('draught-proofing-chimney-balloon+loft-300')).toBe(
      'Draught-proofing and loft insulation top-up',
    );
    expect(packageName('mystery-option')).toBe('mystery-option');
  });
});
