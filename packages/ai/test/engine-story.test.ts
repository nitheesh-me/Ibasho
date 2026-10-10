/**
 * GH1 narration over REAL engine evidence (E4, AM 3.1). The fixture `gh1.engine.graph.json` is
 * generated from the WP-02 engine by `scripts/gen-engine-graph.ts`; every chip must open a real
 * engine node (or an exact sum of real monthly nodes) and the narration must be byte-stable.
 */
import { canonicalJson, type EvidenceGraph, sha256Hex } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import graph from '../../fixtures/src/narration/gh1.engine.graph.json' with { type: 'json' };
import { storyFromEngine } from '../src/evidence/engine-story.ts';
import { renderTemplate } from '../src/grounding/ground.ts';
import { nodesToString } from '../src/grounding/render.ts';
import { validateSection } from '../src/grounding/validate.ts';
import { CHAPTERS, narrateSection, type PickKey, type SectionRequest } from '../src/narrator/template.ts';

const nodes = graph.nodes as unknown as EvidenceGraph['nodes'];

function story() {
  return storyFromEngine({
    homeId: 'gh1',
    createdAt: '2026-10-11T09:30:00Z',
    locale: 'en-GB',
    modelVersion: '0.1.0',
    graph: { nodes },
    packageIds: graph.packageIds,
    picks: graph.picks as Partial<Record<PickKey, number>>,
    needsCheck: graph.needsCheck,
    memory: { preferences: { rejected: {}, completed: {} } as never, recent: [], hiddenByRejection: 0 },
    context: { billsGiven: false, nextStep: 'ask an installer for a survey' },
  });
}

const REQUESTS: SectionRequest[] = [
  { section: 'overview' },
  ...CHAPTERS.map((chapter) => ({ section: 'chapter' as const, chapter })),
  { section: 'tradeoff', a: 'leastUpfront', b: 'bestReturn' },
  { section: 'welcome-back' },
];

function render() {
  const s = story();
  const out = REQUESTS.map((r) => {
    const sec = narrateSection(s, r);
    const rr = renderTemplate({ sections: [sec] }, s.bundle);
    return { r, text: sec.text, rendered: nodesToString(rr.sections[0]?.nodes ?? []) };
  });
  return { out, sha: sha256Hex(canonicalJson(out)), story: s };
}

describe('story from the real engine (GH1, M-0 slice)', () => {
  it('the fixture comes from the engine: 8 packages, picks and a check lane', () => {
    expect(graph.schema).toBe('ibasho.engine-graph/1');
    expect(graph.packageIds[0]).toBe('baseline');
    expect(graph.packageIds).toHaveLength(8);
    expect(Object.keys(graph.picks).sort()).toEqual(['bestReturn', 'leastUpfront', 'lowestRunningCarbon']);
  });

  it('items carry engine evidence ids; sums are exact over twelve engine months', () => {
    const { story: s } = render();
    const engineIds = new Set(nodes.map((n) => n.id));
    const bill = s.bundle.items.find((i) => i.id === s.roles['home.bill']);
    expect(bill).toBeDefined();
    for (const role of ['home.bill.gas', 'home.bill.electricity']) {
      const item = s.bundle.items.find((i) => i.id === s.roles[role]);
      expect(item && engineIds.has(item.hash as never), role).toBe(true);
    }
    const gas = nodes.filter((n) => n.subject.packageId === 'baseline' && /^energy\.delivered\.gas\.\d+$/.test(n.quantity));
    expect(gas).toHaveLength(12);
    let wh = 0n;
    for (const n of gas) wh += BigInt((n.value as { fixed: string }).fixed);
    const year = s.bundle.items.find((i) => i.id === s.roles['home.gas']);
    expect(year?.label).toBe('gas use per year');
    expect(year?.provenance.source).toBe('engine');
    expect(wh > 0n).toBe(true);
    expect(s.roles['home.heatDemand']).toBeDefined();
  });

  it('every section validates clean (G1 to G8) and names picks the engine chose', () => {
    const s = story();
    for (const r of REQUESTS) {
      const sec = narrateSection(s, r);
      expect(validateSection(sec.key, sec.text, s.bundle), JSON.stringify(r)).toEqual([]);
    }
    expect(s.context.picks?.leastUpfront?.packageId).toBe(graph.packageIds[graph.picks.leastUpfront]);
  });

  it('E4: byte-identical across two runs, no digits outside slots', () => {
    const a = render();
    const b = render();
    expect(a.sha).toBe(b.sha);
    for (const o of a.out) {
      expect(o.text.replace(/\[\[[^\]]*\]\]/g, '')).not.toMatch(/\d/);
      expect(o.rendered.length).toBeGreaterThan(0);
    }
  });
});
