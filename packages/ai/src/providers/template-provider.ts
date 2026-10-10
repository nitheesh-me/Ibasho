/**
 * The template narrator as a `NarratorProvider` (id `template`, on this device). It returns the
 * skeleton it is given, which is the template narrator's own output, so it can sit in a registry
 * beside LLM providers and pass through the same grounding.
 */
import type { NarrationChunk, NarrationRequest, NarratorProvider, ProviderCapabilities, ProviderStatus } from '@ibasho/core';

export class TemplateProvider implements NarratorProvider {
  readonly id = 'template';
  readonly displayName = 'Ibasho (built in)';

  async probe(): Promise<ProviderStatus> {
    return { state: 'ready' };
  }

  capabilities(): ProviderCapabilities {
    return { locality: 'device', structuredOutput: 'json', toolUse: 'none', streaming: true, contextTokens: 0 };
  }

  async *narrate(req: NarrationRequest): AsyncIterable<NarrationChunk> {
    for (const key of req.sections) {
      const text = req.skeleton[key];
      if (text !== undefined) yield { section: key, delta: text };
    }
    yield { done: true };
  }
}
