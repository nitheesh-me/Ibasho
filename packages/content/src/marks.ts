/**
 * Glossary marks in copy. Owner: WP-09.
 *
 * `[[g:u-value]]` shows the glossary term; `[[g:u-value|U-values]]` shows the given label. UI renders
 * a term segment with a dotted underline and its plain definition (UX 15). `plainText` strips the
 * marks for places that cannot render them (meta tags, aria labels, the narrator's input).
 */

export type Segment = { t: 'text'; text: string } | { t: 'term'; id: string; label: string };

const MARK = /\[\[g:([a-z0-9]+(?:-[a-z0-9]+)*)(?:\|([^\]]+))?\]\]/g;

/** Split copy into text and term segments. `label` falls back to `termOf(id)`, then to the id. */
export function segments(
  copy: string,
  termOf: (id: string) => string | undefined = () => undefined,
): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of copy.matchAll(MARK)) {
    const at = m.index;
    if (at > last) out.push({ t: 'text', text: copy.slice(last, at) });
    const id = m[1]!;
    out.push({ t: 'term', id, label: m[2] ?? termOf(id) ?? id });
    last = at + m[0].length;
  }
  if (last < copy.length) out.push({ t: 'text', text: copy.slice(last) });
  return out;
}

/** Every glossary id marked in a piece of copy, in order of appearance. */
export function markedTerms(copy: string): string[] {
  return [...copy.matchAll(MARK)].map((m) => m[1]!);
}

/** Copy with marks replaced by their labels. */
export function plainText(
  copy: string,
  termOf: (id: string) => string | undefined = () => undefined,
): string {
  return segments(copy, termOf)
    .map((s) => (s.t === 'text' ? s.text : s.label))
    .join('');
}

/** True when the copy contains a malformed mark (`[[g:` without a valid close). */
export function hasMalformedMark(copy: string): boolean {
  const stripped = copy.replace(MARK, '');
  return stripped.includes('[[g:') || stripped.includes('[[');
}
