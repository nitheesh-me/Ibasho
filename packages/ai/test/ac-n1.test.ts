/**
 * AC-N1: across golden bundles x providers x voices, 0 digits or number words are rendered from any
 * LLM. Bundles: the synthetic GH1 story and GH1 over real engine evidence. Providers: scripted
 * models from honest to hostile, with and without the one structured repair. Voices: all three.
 * Numbers may reach the owner only as evidence chips (`num` nodes) whose display comes from the bundle.
 */
import type {
  EvidenceGraph,
  NarrationChunk,
  NarrationDraft,
  NarrationRequest,
  NarratorProvider,
  ProviderCapabilities,
  ProviderStatus,
  RenderedNarration,
  Voice,
} from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import graph from '../../fixtures/src/narration/gh1.engine.graph.json' with { type: 'json' };
import { storyFromEngine } from '../src/evidence/engine-story.ts';
import type { RepairRequest } from '../src/grounding/ground.ts';
import { NUMBER_ALLOW, NUMBER_WORDS } from '../src/grounding/lexicon.ts';
import { renderText } from '../src/grounding/render.ts';
import { CHAPTERS, type PickKey, type SectionRequest, type Story } from '../src/narrator/template.ts';
import { NarratorRouter } from '../src/providers/router.ts';
import { GH1_REQUESTS, gh1Story } from './helpers.ts';

type Style = 'echo' | 'prefix' | 'digits' | 'words' | 'percent' | 'in-measure' | 'unit-copy';

/** What a model of each style writes over a skeleton. Only `echo` and `prefix` are clean. */
function write(style: Style, skel: string, firstEvidence: string): string {
  switch (style) {
    case 'echo':
      return skel;
    case 'prefix':
      return `In short, ${skel.charAt(0).toLowerCase()}${skel.slice(1)}`;
    case 'digits':
      return `${skel} That is about 15,000 kWh, or 3.5 tonnes.`;
    case 'words':
      return `${skel} It saves roughly fifteen hundred pounds over twenty years.`;
    case 'percent':
      return `${skel} Bills fall by a third, nearly 30%.`;
    case 'in-measure':
      return `${skel} [[m:loft]] at three hundred millimetres helps.`;
    case 'unit-copy':
      return `${skel} You save [[e:${firstEvidence}]] which is 2 x more.`;
  }
}

class Scripted implements NarratorProvider {
  readonly id = 'ollama';
  readonly displayName = 'scripted';
  private readonly style: Style;
  private readonly repairStyle: Style | undefined;
  constructor(style: Style, repairStyle?: Style) {
    this.style = style;
    this.repairStyle = repairStyle;
  }
  async probe(): Promise<ProviderStatus> {
    return { state: 'ready' };
  }
  capabilities(): ProviderCapabilities {
    return {
      locality: 'localhost',
      structuredOutput: 'json-schema',
      toolUse: 'none',
      streaming: true,
      contextTokens: 8192,
    };
  }
  async *narrate(req: NarrationRequest): AsyncIterable<NarrationChunk> {
    for (const key of req.sections) {
      yield {
        section: key,
        delta: write(this.style, req.skeleton[key] ?? '', req.bundle.items[0]?.id ?? 'e1'),
      };
    }
    yield { done: true };
  }
  async repair(req: NarrationRequest, r: RepairRequest): Promise<NarrationDraft> {
    const style = this.repairStyle ?? this.style;
    return {
      sections: r.sections.map((s) => ({
        key: s.key,
        text: write(style, req.skeleton[s.key] ?? '', req.bundle.items[0]?.id ?? 'e1'),
      })),
    };
  }
}

const allowedSpans = (s: string) => {
  const spans: [number, number][] = [];
  for (const re of NUMBER_ALLOW)
    for (const m of s.matchAll(new RegExp(re.source, re.flags))) spans.push([m.index, m.index + m[0].length]);
  return spans;
};
const NUMBER_WORD_RE = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:${NUMBER_WORDS.map((w) => w.replace(/ /g, '\\s+')).join('|')})(?![\\p{L}\\p{N}_])`,
  'giu',
);

/** Digits and number words in LLM-written text nodes (allow-listed idioms excepted). */
function llmNumbers(r: RenderedNarration): string[] {
  const out: string[] = [];
  for (const s of r.sections) {
    if (s.origin !== 'llm') continue;
    const text = s.nodes.map((n) => (n.t === 'text' ? n.s : ' ')).join('');
    if (/[\p{N}%\u2030\uFF05]/u.test(text)) out.push(text);
    const ok = allowedSpans(text);
    for (const m of text.matchAll(NUMBER_WORD_RE))
      if (!ok.some(([a, b]) => m.index >= a && m.index < b)) out.push(m[0]);
  }
  return out;
}

function engineStory(): Story {
  return storyFromEngine({
    homeId: 'gh1',
    createdAt: '2026-10-11T09:30:00Z',
    locale: 'en-GB',
    modelVersion: '0.1.0',
    graph: { nodes: graph.nodes as unknown as EvidenceGraph['nodes'] },
    packageIds: graph.packageIds,
    picks: graph.picks as Partial<Record<PickKey, number>>,
    needsCheck: graph.needsCheck,
    memory: { preferences: { rejected: {}, completed: {} } as never, recent: [], hiddenByRejection: 0 },
    context: { billsGiven: false, nextStep: 'ask an installer for a survey' },
  });
}

const BUNDLES: { name: string; story: () => Story; requests: readonly SectionRequest[] }[] = [
  { name: 'gh1-synthetic', story: gh1Story, requests: GH1_REQUESTS },
  {
    name: 'gh1-engine',
    story: engineStory,
    requests: [
      { section: 'overview' },
      ...CHAPTERS.map((chapter) => ({ section: 'chapter' as const, chapter })),
      { section: 'tradeoff', a: 'leastUpfront', b: 'bestReturn' },
      { section: 'welcome-back' },
    ],
  },
];
const PROVIDERS: { name: string; make: () => Scripted }[] = [
  { name: 'echo', make: () => new Scripted('echo') },
  { name: 'prefix', make: () => new Scripted('prefix') },
  { name: 'digits', make: () => new Scripted('digits') },
  { name: 'words', make: () => new Scripted('words') },
  { name: 'percent', make: () => new Scripted('percent') },
  { name: 'in-measure', make: () => new Scripted('in-measure') },
  { name: 'unit-copy', make: () => new Scripted('unit-copy') },
  { name: 'digits-then-clean', make: () => new Scripted('digits', 'echo') },
  { name: 'words-then-digits', make: () => new Scripted('words', 'digits') },
];
const VOICES: readonly Voice[] = ['warm', 'plain', 'storyteller'];

const clock = (() => {
  let t = 0;
  return () => ++t;
})();

describe('AC-N1: golden bundles x providers x voices', () => {
  for (const b of BUNDLES) {
    it(`${b.name}: no LLM-rendered digit or number word, and every chip value comes from the bundle`, async () => {
      const story = b.story();
      // Chips carry the global node id; their display must be one the bundle item can render.
      const byHash = new Map(story.bundle.items.map((i) => [i.hash, i]));
      const displays = (hash: string) => {
        const i = byHash.get(hash)!;
        return new Set(
          (['', '|approx', '|abs'] as const)
            .map((m) => renderText(`[[e:${i.id}${m}]]`, story.bundle)[0])
            .map((n) => (n?.t === 'num' ? n.display : '')),
        );
      };
      let llmSections = 0;
      let cases = 0;
      for (const p of PROVIDERS) {
        for (const voice of VOICES) {
          const router = new NarratorRouter({ providers: [p.make()], clock });
          await router.probeAll();
          for (const req of b.requests) {
            const out = await router.narrate(story, [req], { voice }).polished;
            cases++;
            expect(llmNumbers(out), `${b.name} ${p.name} ${voice} ${JSON.stringify(req)}`).toEqual([]);
            for (const s of out.sections) {
              if (s.origin === 'llm') llmSections++;
              for (const n of s.nodes) {
                if (n.t !== 'num') continue;
                expect(byHash.has(n.evidenceId)).toBe(true);
                expect(displays(n.evidenceId).has(n.display), n.display).toBe(true);
              }
            }
          }
        }
      }
      // Clean providers do get through, so the matrix is not trivially all template.
      expect(llmSections).toBeGreaterThan(0);
      expect(cases).toBe(PROVIDERS.length * VOICES.length * b.requests.length);
    });
  }
});
