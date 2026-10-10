/**
 * Sentence segmentation that never splits inside a slot (a slot may render "8.5 years").
 * Used by the validator (rules are sentence scoped) and the streaming sentence buffer (AM 3.3:
 * a sentence renders only after it validates).
 */
import { maskSlots } from './slots.ts';

export interface Sentence {
  text: string;
  span: [number, number];
}

const END = /[.!?]/;

/** Split `text` into sentences; whitespace between sentences is dropped. */
export function sentences(text: string): Sentence[] {
  const masked = maskSlots(text);
  const out: Sentence[] = [];
  let start = 0;
  const push = (end: number) => {
    let a = start;
    let b = end;
    while (a < b && /\s/.test(text[a] ?? '')) a++;
    while (b > a && /\s/.test(text[b - 1] ?? '')) b--;
    if (b > a) out.push({ text: text.slice(a, b), span: [a, b] });
    start = end;
  };
  for (let i = 0; i < masked.length; i++) {
    const c = masked[i] ?? '';
    if (c === '\n' && masked[i + 1] === '\n') {
      push(i);
      continue;
    }
    if (!END.test(c)) continue;
    let j = i + 1;
    while (j < masked.length && /["'’”)]/.test(masked[j] ?? '')) j++;
    if (j >= masked.length || /\s/.test(masked[j] ?? '')) {
      push(j);
      i = j - 1;
    }
  }
  push(text.length);
  return out;
}

/**
 * Streaming buffer: feed deltas, get back the sentences that are complete. A sentence is complete
 * once its terminator is followed by whitespace, so "8.5" inside a rendered value never splits.
 */
export class SentenceBuffer {
  private buf = '';

  push(delta: string): string[] {
    this.buf += delta;
    const found = sentences(this.buf);
    if (found.length < 2) return [];
    const last = found[found.length - 1]!;
    const done = found.slice(0, -1).map((s) => s.text);
    this.buf = this.buf.slice(last.span[0]);
    return done;
  }

  /** Whatever remains at the end of the stream. */
  flush(): string[] {
    const rest = sentences(this.buf).map((s) => s.text);
    this.buf = '';
    return rest;
  }
}
