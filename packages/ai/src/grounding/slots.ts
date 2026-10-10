/**
 * Slot tokenizer (SPEC R10, AM 3.2). Grammar, strict:
 *
 *   slot     = "[[" kind ":" ref [ "|" modifier ] "]]"
 *   kind     = "e" | "m" | "f"
 *   ref      = e: "e"? digits     (bundle-local evidence id, `[[e:12]]` or `[[e:e12]]`)
 *              m: [a-z0-9-]+     (measure or option id, kebab-case, ARCH 12)
 *              f: [A-Za-z0-9_.-]+ (owner fact id)
 *   modifier = "approx" | "abs"  (e slots only)
 *
 * Anything that opens `[[` but does not match is a `bad` token: the validator reports it (G1) and
 * the renderer never shows it. Spans are UTF-16 offsets into the source text.
 */
import type { SlotModifier } from './format.ts';

export type SlotKind = 'e' | 'm' | 'f';

export type Token =
  | { t: 'text'; s: string; span: [number, number] }
  | { t: 'slot'; kind: 'e'; ref: `e${number}`; mod?: SlotModifier; raw: string; span: [number, number] }
  | { t: 'slot'; kind: 'm' | 'f'; ref: string; raw: string; span: [number, number] }
  | { t: 'bad'; raw: string; span: [number, number] };

export type SlotToken = Extract<Token, { t: 'slot' }>;

const SLOT = /^\[\[([emf]):([^\]|]{1,80})(?:\|([a-z]{1,12}))?\]\]/;
const E_REF = /^e?(\d{1,6})$/;
const M_REF = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const F_REF = /^[A-Za-z0-9_.-]{1,64}$/;

function slotAt(text: string, i: number): Token {
  const m = SLOT.exec(text.slice(i, i + 100));
  if (!m) {
    const close = text.indexOf(']]', i + 2);
    const end = close < 0 || close - i > 100 ? i + 2 : close + 2;
    return { t: 'bad', raw: text.slice(i, end), span: [i, end] };
  }
  const raw = m[0];
  const span: [number, number] = [i, i + raw.length];
  const kind = m[1] as SlotKind;
  const ref = m[2] ?? '';
  const mod = m[3];
  if (kind === 'e') {
    const em = E_REF.exec(ref);
    if (!em || (mod !== undefined && mod !== 'approx' && mod !== 'abs')) return { t: 'bad', raw, span };
    const id = `e${Number(em[1])}` as `e${number}`;
    return mod ? { t: 'slot', kind, ref: id, mod, raw, span } : { t: 'slot', kind, ref: id, raw, span };
  }
  if (mod !== undefined) return { t: 'bad', raw, span };
  if (kind === 'm' && !M_REF.test(ref)) return { t: 'bad', raw, span };
  if (kind === 'f' && !F_REF.test(ref)) return { t: 'bad', raw, span };
  return { t: 'slot', kind, ref, raw, span };
}

/** Split text into text runs, slots and malformed slot openers. */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let start = 0;
  while (i < text.length) {
    const open = text.indexOf('[[', i);
    if (open < 0) break;
    if (open > start) out.push({ t: 'text', s: text.slice(start, open), span: [start, open] });
    const tok = slotAt(text, open);
    out.push(tok);
    i = tok.span[1];
    start = i;
  }
  if (start < text.length) out.push({ t: 'text', s: text.slice(start), span: [start, text.length] });
  return out;
}

/** Text with every slot replaced by a placeholder of the same length (for lexical checks). */
export function maskSlots(text: string, fill = '\u0000'): string {
  let out = '';
  for (const tok of tokenize(text)) out += tok.t === 'text' ? tok.s : fill.repeat(tok.span[1] - tok.span[0]);
  return out;
}

/** Build a slot string. */
export function slot(kind: 'e', ref: `e${number}`, mod?: SlotModifier): string;
export function slot(kind: 'm' | 'f', ref: string): string;
export function slot(kind: SlotKind, ref: string, mod?: SlotModifier): string {
  return mod ? `[[${kind}:${ref}|${mod}]]` : `[[${kind}:${ref}]]`;
}
