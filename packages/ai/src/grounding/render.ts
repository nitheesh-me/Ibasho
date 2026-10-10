/**
 * Renderer (AM 3.2, D1): substitutes formatted values for slots. Every number in the output comes
 * from a `num` node bound to an evidence id; the UI draws each one as an evidence chip. Fails
 * closed: an unresolved slot throws, so callers validate first.
 */
import type { EvidenceBundle, RenderNode } from '@ibasho/core';
import { measureName } from '../measures.ts';
import { formatItem } from './format.ts';
import { tokenize } from './slots.ts';

export class RenderError extends Error {
  override name = 'RenderError';
}

export interface RenderOptions {
  /** Extra measure display names, beyond the catalogue. */
  measureNames?: Readonly<Record<string, string>>;
}

/** Render slotted text to nodes. Adjacent text is merged. */
export function renderText(text: string, bundle: EvidenceBundle, opts: RenderOptions = {}): RenderNode[] {
  const items = new Map(bundle.items.map((i) => [i.id, i]));
  const facts = new Map(bundle.facts.map((f) => [f.id, f]));
  const out: RenderNode[] = [];
  const pushText = (s: string) => {
    const last = out[out.length - 1];
    if (last && last.t === 'text') out[out.length - 1] = { t: 'text', s: last.s + s };
    else if (s !== '') out.push({ t: 'text', s });
  };
  for (const tok of tokenize(text)) {
    if (tok.t === 'text') pushText(tok.s);
    else if (tok.t === 'bad') throw new RenderError(`malformed slot ${tok.raw}`);
    else if (tok.kind === 'e') {
      const item = items.get(tok.ref);
      if (!item) throw new RenderError(`unknown evidence ${tok.raw}`);
      out.push({ t: 'num', evidenceId: item.hash, display: formatItem(item, tok.mod) });
    } else if (tok.kind === 'm') {
      const name = opts.measureNames?.[tok.ref] ?? measureName(tok.ref);
      if (name === undefined) throw new RenderError(`unknown measure ${tok.raw}`);
      const last = out[out.length - 1];
      const atStart = !last || (last.t === 'text' && /(?:^|[.!?]\s+)$/.test(last.s));
      const display = atStart ? name.charAt(0).toUpperCase() + name.slice(1) : name;
      out.push({ t: 'measure', measureId: tok.ref, display });
    } else {
      const fact = facts.get(tok.ref);
      if (!fact) throw new RenderError(`unknown owner fact ${tok.raw}`);
      out.push({ t: 'fact', factId: fact.id, display: `“${fact.quote}”` });
    }
  }
  return out;
}

/** Plain string of rendered nodes (screen readers, speech, tests). */
export function nodesToString(nodes: readonly RenderNode[]): string {
  return nodes.map((n) => (n.t === 'text' ? n.s : n.display)).join('');
}
