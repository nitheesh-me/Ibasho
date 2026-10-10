/**
 * Boundary pre-check for agent prose (AM 3.2 and 3.3, rule G2). Owner: WP-12.
 *
 * An agent may not place a number the engine did not compute. Its prose carries slots
 * (`[[e:ev_1a2b]]`, `[[e:ev_1a2b|approx]]`, `[[m:loft]]`, `[[f:3]]`) and the app fills them from
 * evidence. This check runs at the MCP and bridge boundary so a raw digit is refused before it
 * reaches the tab; the tab still runs the full narrator validator (G1 to G8, WP-05).
 */

export interface Slot {
  kind: 'e' | 'm' | 'f';
  ref: string;
  format?: 'approx' | 'abs';
  span: [number, number];
}

export interface SlotIssue {
  rule: 'G1' | 'G2';
  span: [number, number];
  detail: string;
}

const SLOT = /\[\[(e|m|f):([^\]|\s]+)(?:\|(approx|abs))?\]\]/g;

/** Number words that smuggle quantities past a digit check (AM 3.3 G2). "one" stays allowed as a pronoun. */
const NUMBER_WORDS = [
  'zero',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
  'hundred',
  'hundreds',
  'thousand',
  'thousands',
  'million',
  'millions',
  'billion',
  'dozen',
  'half',
  'halves',
  'twice',
  'thrice',
  'double',
  'triple',
  'quarter',
  'quarters',
  'third',
  'thirds',
  'percent',
  'per cent',
];
/** Fixed phrases where a number word names a thing, not a quantity. */
const ALLOWED_AFTER: Record<string, string> = { double: '(?![\\s-]*glaz)', third: '(?![\\s-]*part)' };
const WORDS = new RegExp(
  `\\b(?:${NUMBER_WORDS.map((w) => w.replace(' ', '\\s+') + (ALLOWED_AFTER[w] ?? '')).join('|')})\\b`,
  'giu',
);
/** Any decimal digit in any script, the percent sign, and vulgar fractions. */
const NUMERIC_CHAR = /[\p{Nd}%¼-¾⅐-⅞]/gu;

/** Slots in order of appearance. */
export function parseSlots(text: string): Slot[] {
  const out: Slot[] = [];
  for (const m of text.matchAll(SLOT)) {
    const start = m.index ?? 0;
    const slot: Slot = {
      kind: m[1] as Slot['kind'],
      ref: m[2] ?? '',
      span: [start, start + m[0].length],
    };
    if (m[3]) slot.format = m[3] as 'approx' | 'abs';
    out.push(slot);
  }
  return out;
}

/**
 * G2 on the text outside slots, plus a syntax check that evidence slots name evidence ids
 * (`ev_...`). Does not resolve ids (G1 needs the bundle; the tab does that).
 */
export function checkSlotted(text: string): { ok: boolean; slots: Slot[]; issues: SlotIssue[] } {
  const slots = parseSlots(text);
  const issues: SlotIssue[] = [];
  for (const s of slots) {
    if (s.kind === 'e' && !/^ev_[0-9a-z]+$/.test(s.ref)) {
      issues.push({ rule: 'G1', span: s.span, detail: `evidence slot must name an ev_ id, got "${s.ref}"` });
    }
  }
  // Blank out slots (same length) so spans still index the original text.
  let outside = text;
  for (const s of slots) {
    outside = outside.slice(0, s.span[0]) + ' '.repeat(s.span[1] - s.span[0]) + outside.slice(s.span[1]);
  }
  if (/\[\[|\]\]/.test(outside)) {
    const at = outside.search(/\[\[|\]\]/);
    issues.push({ rule: 'G1', span: [at, at + 2], detail: 'malformed slot' });
  }
  for (const m of outside.matchAll(NUMERIC_CHAR)) {
    const at = m.index ?? 0;
    issues.push({
      rule: 'G2',
      span: [at, at + m[0].length],
      detail: `bare numeral "${m[0]}" outside a slot`,
    });
  }
  for (const m of outside.matchAll(WORDS)) {
    const at = m.index ?? 0;
    issues.push({ rule: 'G2', span: [at, at + m[0].length], detail: `number word "${m[0]}" outside a slot` });
  }
  issues.sort((a, b) => a.span[0] - b.span[0]);
  return { ok: issues.length === 0, slots, issues };
}
