/**
 * Router, outbound ledger and the grounding loop (AM 3.3, AM 4.2, SPEC 5.14).
 * AC-N3: a provider failure falls back to the template within 100 ms.
 */
import type { AppEvent, EventBus, NarrationChunk, NarrationDraft, NarrationRequest, NarratorProvider, ProviderCapabilities, ProviderStatus } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { groundDraft } from '../src/grounding/ground.ts';
import { nodesToString } from '../src/grounding/render.ts';
import { narrateTemplate } from '../src/narrator/template.ts';
import { ConsentRequiredError, LOCALITY_BADGE, OutboundLedger } from '../src/providers/ledger.ts';
import { NarratorRouter } from '../src/providers/router.ts';
import { TemplateProvider } from '../src/providers/template-provider.ts';
import { gh1Story } from './helpers.ts';

type Behaviour = 'echo' | 'throw' | 'hang' | 'digits' | 'hard' | 'cloud-send';

/** A scripted provider. `echo` returns the skeleton reworded, `digits` writes a bare number. */
class Scripted implements NarratorProvider {
  readonly id: string;
  readonly displayName: string;
  repairs = 0;
  private readonly behaviour: Behaviour;
  private readonly locality: ProviderCapabilities['locality'];
  private readonly repairText: ((req: NarrationRequest) => string) | undefined;
  private readonly ledger: OutboundLedger | undefined;
  constructor(
    id: string,
    behaviour: Behaviour,
    locality: ProviderCapabilities['locality'] = 'localhost',
    repairText?: (req: NarrationRequest) => string,
    ledger?: OutboundLedger,
  ) {
    this.id = id;
    this.displayName = id;
    this.behaviour = behaviour;
    this.locality = locality;
    this.repairText = repairText;
    this.ledger = ledger;
  }
  async probe(): Promise<ProviderStatus> {
    return { state: 'ready' };
  }
  capabilities(): ProviderCapabilities {
    return { locality: this.locality, structuredOutput: 'json-schema', toolUse: 'none', streaming: true, contextTokens: 8192 };
  }
  async *narrate(req: NarrationRequest): AsyncIterable<NarrationChunk> {
    const key = req.sections[0]!;
    const skel = req.skeleton[key] ?? '';
    switch (this.behaviour) {
      case 'throw':
        throw new Error('model crashed');
      case 'hang':
        await new Promise(() => {});
        return;
      case 'cloud-send':
        this.ledger?.record({ providerId: this.id, locality: 'cloud', purpose: 'narrate', endpoint: 'https://example.invalid', payload: { skel } });
        yield { section: key, delta: skel };
        break;
      case 'digits':
        yield { section: key, delta: 'Your home uses about 15000 kWh a year.' };
        break;
      case 'hard':
        // G6: recommends a measure the owner ruled out (no repair allowed).
        yield { section: key, delta: 'You should add [[m:loft-300]] now.' };
        break;
      default:
        yield { section: key, delta: `Put simply: ${skel}` };
    }
    yield { done: true };
  }
  async repair(req: NarrationRequest): Promise<NarrationDraft> {
    this.repairs++;
    const key = req.sections[0]!;
    return { sections: [{ key, text: this.repairText ? this.repairText(req) : 'Still 15000 kWh.' }] };
  }
}

const monotonic = () => performance.now();

describe('NarratorRouter', () => {
  it('lists providers with locality badges, template first', () => {
    const r = new NarratorRouter({ providers: [new Scripted('ollama', 'echo'), new Scripted('claude', 'echo', 'cloud')] });
    expect(r.list()).toEqual([
      { id: 'template', displayName: 'Ibasho (built in)', locality: 'device', badge: 'On this device' },
      { id: 'ollama', displayName: 'ollama', locality: 'localhost', badge: 'On your computer' },
      { id: 'claude', displayName: 'claude', locality: 'cloud', badge: 'In the cloud' },
    ]);
    expect(LOCALITY_BADGE.cloud).toBe('In the cloud');
  });

  it('auto picks a ready device or localhost provider, never cloud; the owner choice wins', async () => {
    const r = new NarratorRouter({ providers: [new Scripted('claude', 'echo', 'cloud'), new Scripted('ollama', 'echo')] });
    expect(r.selected()).toBe('template');
    await r.probeAll();
    expect(r.selected()).toBe('ollama');
    r.setChoice('claude');
    expect(r.selected()).toBe('claude');
    r.setChoice('template');
    expect(r.selected()).toBe('template');
    expect(() => r.setChoice('nope')).toThrow();
    const cloudOnly = new NarratorRouter({ providers: [new Scripted('claude', 'echo', 'cloud')] });
    await cloudOnly.probeAll();
    expect(cloudOnly.selected()).toBe('template');
  });

  it('renders the template at once and polishes with a grounded LLM draft', async () => {
    const story = gh1Story();
    const events: AppEvent[] = [];
    const bus = { emit: (e: AppEvent) => events.push(e) } as unknown as EventBus;
    const r = new NarratorRouter({ providers: [new Scripted('ollama', 'echo')], bus, clock: monotonic });
    await r.probeAll();
    const out = r.narrate(story, [{ section: 'overview' }]);
    expect(out.providerId).toBe('ollama');
    expect(out.template.sections[0]!.origin).toBe('template');
    const polished = await out.polished;
    expect(polished.provider).toBe('ollama');
    expect(polished.sections[0]!.origin).toBe('llm');
    expect(nodesToString(polished.sections[0]!.nodes)).toMatch(/^Put simply: /);
    expect(events.filter((e) => e.t === 'narration.state').map((e) => (e as { generating: boolean }).generating)).toEqual([true, false]);
  });

  for (const behaviour of ['throw', 'hang'] as const) {
    it(`AC-N3: a provider that ${behaviour}s falls back to the template within 100 ms`, async () => {
      const story = gh1Story();
      const r = new NarratorRouter({ providers: [new Scripted('ollama', behaviour)], clock: monotonic, timeoutMs: behaviour === 'hang' ? 60 : 30_000 });
      await r.probeAll();
      const t0 = performance.now();
      const out = r.narrate(story, [{ section: 'overview' }]);
      const polished = await out.polished;
      const failAfter = behaviour === 'hang' ? 60 : 0;
      expect(performance.now() - t0 - failAfter).toBeLessThan(100);
      expect(polished.provider).toBe('template');
      expect(polished.sections).toEqual(out.template.sections);
    });
  }

  it('AC-N3: an owner abort falls back at once', async () => {
    const story = gh1Story();
    const r = new NarratorRouter({ providers: [new Scripted('ollama', 'hang')], clock: monotonic });
    await r.probeAll();
    const ac = new AbortController();
    const out = r.narrate(story, [{ section: 'overview' }], { signal: ac.signal });
    const t0 = performance.now();
    ac.abort();
    const polished = await out.polished;
    expect(performance.now() - t0).toBeLessThan(100);
    expect(polished.provider).toBe('template');
  });

  it('a cloud send without consent sends nothing and falls back; with consent it is ledgered', async () => {
    const story = gh1Story();
    const ledger = new OutboundLedger();
    const r = new NarratorRouter({ providers: [new Scripted('claude', 'cloud-send', 'cloud', undefined, ledger)], ledger, choice: 'claude' });
    await r.probeAll();
    const first = await r.narrate(story, [{ section: 'overview' }]).polished;
    expect(first.provider).toBe('template');
    expect(ledger.list()).toEqual([]);
    ledger.grantConsent('claude');
    const second = await r.narrate(story, [{ section: 'overview' }]).polished;
    expect(second.provider).toBe('claude');
    expect(ledger.list()).toHaveLength(1);
    expect(ledger.list()[0]).toMatchObject({ providerId: 'claude', locality: 'cloud' });
  });
});

describe('OutboundLedger', () => {
  it('records canonical bytes, needs consent for cloud only, caps its size and notifies', () => {
    const l = new OutboundLedger({ clock: () => 'T', limit: 2 });
    const seen: number[] = [];
    const off = l.subscribe((e) => seen.push(e.seq));
    l.record({ providerId: 'ollama', locality: 'localhost', purpose: 'narrate', endpoint: 'x', payload: { b: 1, a: 'é' } });
    expect(l.list()[0]).toMatchObject({ seq: 1, at: 'T', payload: '{"a":"é","b":1}', bytes: 16 });
    let err: unknown;
    try {
      l.record({ providerId: 'claude', locality: 'cloud', purpose: 'narrate', endpoint: 'x', payload: { q: 1 } });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConsentRequiredError);
    expect((err as ConsentRequiredError).preview).toBe('{"q":1}');
    l.grantConsent('claude');
    l.record({ providerId: 'claude', locality: 'cloud', purpose: 'narrate', endpoint: 'x', payload: {} });
    l.record({ providerId: 'claude', locality: 'cloud', purpose: 'narrate', endpoint: 'x', payload: {} });
    expect(l.list().map((e) => e.seq)).toEqual([2, 3]);
    off();
    l.revokeConsent('claude');
    expect(l.hasConsent('claude')).toBe(false);
    expect(seen).toEqual([1, 2, 3]);
  });
});

describe('groundDraft: one structured repair, then per-section template fallback', () => {
  const story = gh1Story();
  const skeleton = narrateTemplate(story, [{ section: 'overview' }]);
  const bill = story.roles['home.bill']!;

  it('accepts a clean draft as llm', async () => {
    const out = await groundDraft({ sections: [{ key: 'overview', text: `You spend about [[e:${bill}|approx]] on energy.` }] }, skeleton, story.bundle, { provider: 'x' });
    expect(out.sections[0]!.origin).toBe('llm');
    expect(out.issues).toEqual([]);
  });

  it('asks for exactly one repair with the issues, and uses the repaired text when it validates', async () => {
    const calls: unknown[] = [];
    const out = await groundDraft({ sections: [{ key: 'overview', text: 'You spend 1840 pounds.' }] }, skeleton, story.bundle, {
      provider: 'x',
      repair: async (r) => {
        calls.push(r);
        return { sections: [{ key: 'overview', text: `You spend about [[e:${bill}|approx]].` }] };
      },
    });
    expect(calls).toHaveLength(1);
    expect((calls[0] as { sections: { issues: { rule: string }[] }[] }).sections[0]!.issues.map((i) => i.rule)).toContain('G2');
    expect(out.sections[0]!.origin).toBe('llm');
    expect(nodesToString(out.sections[0]!.nodes)).toBe('You spend about £1,840 a year.');
  });

  it('falls back to the template when the repair still fails or throws', async () => {
    for (const repair of [async () => ({ sections: [{ key: 'overview' as const, text: 'Still 1840.' }] }), async () => Promise.reject(new Error('down'))]) {
      const out = await groundDraft({ sections: [{ key: 'overview', text: 'You spend 1840 pounds.' }] }, skeleton, story.bundle, { provider: 'x', repair });
      expect(out.sections[0]!.origin).toBe('template');
      expect(nodesToString(out.sections[0]!.nodes)).not.toMatch(/1840\b/);
    }
  });

  it('never repairs a hard violation (G6, G8): straight to the template', async () => {
    const b = structuredClone(story.bundle);
    b.memory.preferences.rejected = { loft: { scope: 'never', at: '2026-01-01T00:00:00Z' } };
    let repairs = 0;
    const out = await groundDraft({ sections: [{ key: 'overview', text: 'Add [[m:loft-300]] first.' }] }, narrateTemplate({ ...story, bundle: b }, [{ section: 'overview' }]), b, {
      provider: 'x',
      repair: async () => {
        repairs++;
        return { sections: [] };
      },
    });
    expect(repairs).toBe(0);
    expect(out.sections[0]!.origin).toBe('template');
    expect(out.issues.map((i) => i.rule)).toContain('G6');
  });

  it('fills a missing section from the template', async () => {
    const out = await groundDraft({ sections: [] }, skeleton, story.bundle, { provider: 'x' });
    expect(out.sections.map((s) => [s.key, s.origin])).toEqual([['overview', 'template']]);
  });

  it('router: a repair-capable provider gets one repair and still falls back cleanly', async () => {
    const p = new Scripted('ollama', 'digits');
    const r = new NarratorRouter({ providers: [p] });
    await r.probeAll();
    const polished = await r.narrate(story, [{ section: 'overview' }]).polished;
    expect(p.repairs).toBe(1);
    expect(polished.sections[0]!.origin).toBe('template');
    const fixed = new Scripted('ollama', 'digits', 'localhost', () => `About [[e:${bill}|approx]] goes on energy.`);
    const r2 = new NarratorRouter({ providers: [fixed] });
    await r2.probeAll();
    const p2 = await r2.narrate(story, [{ section: 'overview' }]).polished;
    expect(p2.sections[0]!.origin).toBe('llm');
  });

  it('TemplateProvider streams the skeleton back unchanged', async () => {
    const chunks = [];
    for await (const c of new TemplateProvider().narrate({ bundle: story.bundle, sections: ['overview'], skeleton: { overview: 'Hi.' }, voice: 'warm', maxTokens: 1 })) chunks.push(c);
    expect(chunks).toEqual([{ section: 'overview', delta: 'Hi.' }, { done: true }]);
  });
});
