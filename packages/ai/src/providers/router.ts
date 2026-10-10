/**
 * Narrator router (AM 4.2, SPEC 10, SPEC 5.14).
 *
 * 1. The template narrator renders first, synchronously, always.
 * 2. The owner's choice wins. Without one, a ready on-device or on-your-computer provider may polish
 *    in the background (`autoLocal`). Cloud is never chosen automatically, and a cloud send needs
 *    consent given after seeing the payload (the ledger throws otherwise).
 * 3. Polish is grounded (G1 to G8, one structured repair, per-section template fallback). Any
 *    provider failure, timeout or abort falls back to the template at once (AC-N3).
 * 4. `narration.state` is emitted on the bus so the scene can drop a quality tier while generating.
 */
import type {
  AbortSignalLike,
  EventBus,
  NarrationDraft,
  NarrationRequest,
  NarratorProvider,
  ProviderStatus,
  RenderedNarration,
  SectionKey,
  Voice,
} from '@ibasho/core';
import { groundDraft, renderTemplate } from '../grounding/ground.ts';
import type { ValidateOptions } from '../grounding/validate.ts';
import { narrateTemplate, type SectionRequest, type Story } from '../narrator/template.ts';
import { LOCALITY_BADGE, type Locality, OutboundLedger } from './ledger.ts';
import type { RepairCapable } from './ollama.ts';

export interface ProviderInfo {
  id: string;
  displayName: string;
  locality: Locality;
  badge: string;
}

export interface RouterOptions {
  providers: NarratorProvider[];
  ledger?: OutboundLedger;
  bus?: EventBus;
  /** Owner's choice from Settings: a provider id, or `auto`. */
  choice?: string;
  /** Let a ready device or localhost provider polish without an explicit choice. */
  autoLocal?: boolean;
  /** Polish budget before falling back. */
  timeoutMs?: number;
  /** Monotonic milliseconds, for `latencyMs`. */
  clock?: () => number;
  validate?: ValidateOptions;
}

export interface NarrateResult {
  /** Rendered at once, deterministic. */
  template: RenderedNarration;
  /** Resolves to the polished narration, or to the template when polish is off or fails. */
  polished: Promise<RenderedNarration>;
  providerId: string;
}

const isRepairCapable = (p: NarratorProvider): p is NarratorProvider & RepairCapable =>
  typeof (p as Partial<RepairCapable>).repair === 'function';

/** Abort controller that works without DOM types. */
class Abort implements AbortSignalLike {
  aborted = false;
  private readonly listeners = new Set<() => void>();
  addEventListener(_t: 'abort', l: () => void) {
    this.listeners.add(l);
  }
  removeEventListener(_t: 'abort', l: () => void) {
    this.listeners.delete(l);
  }
  abort() {
    if (this.aborted) return;
    this.aborted = true;
    for (const l of [...this.listeners]) l();
  }
}

export class NarratorRouter {
  readonly ledger: OutboundLedger;
  private readonly providers: Map<string, NarratorProvider>;
  private readonly status = new Map<string, ProviderStatus>();
  private choice: string;
  private readonly autoLocal: boolean;
  private readonly timeoutMs: number;
  private readonly clock: () => number;

  private readonly opts: RouterOptions;

  constructor(opts: RouterOptions) {
    this.opts = opts;
    this.providers = new Map(opts.providers.map((p) => [p.id, p]));
    this.ledger = opts.ledger ?? new OutboundLedger();
    this.choice = opts.choice ?? 'auto';
    this.autoLocal = opts.autoLocal ?? true;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.clock = opts.clock ?? (() => 0);
  }

  /** Providers with their locality badges, template first. */
  list(): ProviderInfo[] {
    const out: ProviderInfo[] = [{ id: 'template', displayName: 'Ibasho (built in)', locality: 'device', badge: LOCALITY_BADGE.device }];
    for (const p of this.providers.values()) {
      const locality = p.capabilities().locality;
      out.push({ id: p.id, displayName: p.displayName, locality, badge: LOCALITY_BADGE[locality] });
    }
    return out;
  }

  setChoice(id: string): void {
    if (id !== 'auto' && id !== 'template' && !this.providers.has(id)) throw new Error(`unknown provider ${id}`);
    this.choice = id;
  }

  /** Probe every provider (never throws; a failure is `unavailable`). */
  async probeAll(signal?: AbortSignalLike): Promise<Record<string, ProviderStatus>> {
    const out: Record<string, ProviderStatus> = {};
    for (const p of this.providers.values()) {
      let s: ProviderStatus;
      try {
        s = await p.probe(signal);
      } catch (err) {
        s = { state: 'unavailable', reason: err instanceof Error ? err.message : String(err) };
      }
      this.status.set(p.id, s);
      out[p.id] = s;
    }
    return out;
  }

  /** The provider that would polish now, or `template`. */
  selected(): string {
    if (this.choice === 'template') return 'template';
    const ready = (p: NarratorProvider) => this.status.get(p.id)?.state === 'ready';
    if (this.choice !== 'auto') {
      const p = this.providers.get(this.choice);
      return p && ready(p) ? p.id : 'template';
    }
    if (!this.autoLocal) return 'template';
    for (const locality of ['device', 'localhost'] as const) {
      for (const p of this.providers.values()) {
        if (p.capabilities().locality === locality && ready(p)) return p.id;
      }
    }
    return 'template';
  }

  /** Template now, polish later. `reqs` must have distinct section keys (chapters one at a time). */
  narrate(story: Story, reqs: readonly SectionRequest[], opts: { voice?: Voice; question?: string; maxTokens?: number; signal?: AbortSignalLike } = {}): NarrateResult {
    const t0 = this.clock();
    const skeleton = narrateTemplate(story, reqs);
    const template = { ...renderTemplate(skeleton, story.bundle, this.opts.validate), latencyMs: this.clock() - t0 };
    const providerId = this.selected();
    const provider = this.providers.get(providerId);
    if (!provider) return { template, polished: Promise.resolve(template), providerId: 'template' };
    return { template, polished: this.polish(provider, story, skeleton, template, opts), providerId };
  }

  private async polish(
    provider: NarratorProvider,
    story: Story,
    skeleton: NarrationDraft,
    template: RenderedNarration,
    opts: { voice?: Voice; question?: string; maxTokens?: number; signal?: AbortSignalLike },
  ): Promise<RenderedNarration> {
    const t0 = this.clock();
    const req: NarrationRequest = {
      bundle: story.bundle,
      sections: skeleton.sections.map((s) => s.key),
      skeleton: Object.fromEntries(skeleton.sections.map((s) => [s.key, s.text])) as Partial<Record<SectionKey, string>>,
      voice: opts.voice ?? 'warm',
      maxTokens: opts.maxTokens ?? 800,
    };
    if (opts.question !== undefined) req.question = opts.question;
    const abort = new Abort();
    const onOuter = () => abort.abort();
    opts.signal?.addEventListener('abort', onOuter);
    if (opts.signal?.aborted) abort.abort();
    let timer: unknown;
    const fallback = (): RenderedNarration => ({ ...template, provider: 'template', latencyMs: this.clock() - t0 });
    this.opts.bus?.emit({ t: 'narration.state', generating: true, origin: 'llm' });
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          abort.abort();
          reject(new Error('timeout'));
        }, this.timeoutMs);
        abort.addEventListener('abort', () => reject(new Error('aborted')));
      });
      const draft = await Promise.race([collect(provider, req, abort), timeout]);
      const groundOpts = {
        ...this.opts.validate,
        provider: provider.id,
        clock: this.clock,
        ...(isRepairCapable(provider)
          ? { repair: (r: Parameters<RepairCapable['repair']>[1]) => Promise.race([provider.repair(req, r, abort), timeout]) }
          : {}),
      };
      const out = await groundDraft(draft, skeleton, story.bundle, groundOpts);
      return { ...out, latencyMs: this.clock() - t0 };
    } catch {
      return fallback();
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onOuter);
      this.opts.bus?.emit({ t: 'narration.state', generating: false, origin: 'template' });
    }
  }
}

/** Gather a provider's streamed chunks into a draft. */
async function collect(provider: NarratorProvider, req: NarrationRequest, signal: AbortSignalLike): Promise<NarrationDraft> {
  const text = new Map<SectionKey, string>();
  for await (const chunk of provider.narrate(req, signal)) {
    if (signal.aborted) throw new Error('aborted');
    if ('done' in chunk) break;
    text.set(chunk.section, (text.get(chunk.section) ?? '') + chunk.delta);
  }
  return { sections: [...text.entries()].map(([key, t]) => ({ key, text: t })) };
}
