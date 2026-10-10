/**
 * Grounding validator G1 to G8 (AM 3.3, SPEC 10). Fails closed: anything it cannot prove grounded is
 * an issue. Sentence scoped. G6 and G8 are hard (the section falls back to the template); the rest
 * ask for one structured repair.
 */
import type {
  EvidenceBundle,
  EvidenceItem,
  PolarityLexicon,
  SectionKey,
  ValidationIssue,
} from '@ibasho/core';
import { measureOf, SYNONYMS } from '../measures.ts';
import {
  ACKNOWLEDGE_CUES,
  INJECTION_RESIDUE,
  NUMBER_ALLOW,
  NUMBER_WORDS,
  POLARITY_EN_GB,
  RECOMMEND_CUES,
  SUPERLATIVES,
  UNIT_NOUNS,
} from './lexicon.ts';
import { sentences } from './sentences.ts';
import { maskSlots, type SlotToken, tokenize } from './slots.ts';

export interface ValidateOptions {
  /** Polarity lexicon (G3). Default en-GB. */
  polarity?: PolarityLexicon;
  /** Extra measure display names (id to name) that `[[m:..]]` may use, beyond the catalogue (G1). */
  measureNames?: Readonly<Record<string, string>>;
  /**
   * Imperative fragments the notes quarantine flagged (G8). The validator runs on the device and may
   * hold them; narrators never see them.
   */
  flaggedFragments?: readonly string[];
  /** Instant used to decide whether a snoozed rejection is active. Default `bundle.createdAt`. */
  now?: string;
}

const SEVERITY: Record<ValidationIssue['rule'], ValidationIssue['severity']> = {
  G1: 'repair',
  G2: 'repair',
  G3: 'repair',
  G4: 'repair',
  G5: 'repair',
  G6: 'hard',
  G7: 'repair',
  G8: 'hard',
};

const FUEL_WORDS: Record<string, NonNullable<EvidenceItem['fuel']>> = {
  gas: 'gas',
  electricity: 'electricity',
  electric: 'electricity',
  power: 'electricity',
  oil: 'oil',
  lpg: 'lpg',
  biomass: 'biomass',
  wood: 'biomass',
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (phrase: string, flags = 'gi') =>
  new RegExp(`(?<![\\w-])${phrase.split(' ').map(escapeRe).join('\\s+')}(?![\\w-])`, flags);

/**
 * G2 pattern. Any Unicode number (`\\p{N}`: Devanagari and fullwidth digits, vulgar fractions, Roman
 * numeral letters, superscripts), a percent or per mille sign, or a number word. A hyphen is a word
 * boundary here, so "twenty-five" and "one-third" are caught.
 */
const NUMBER_RE = new RegExp(
  `\\p{N}(?:[\\p{N},.]*\\p{N})?|[%\u2030\uFF05]|${NUMBER_WORDS.map((w) => `(?<![\\p{L}\\p{N}_])${w.split(' ').map(escapeRe).join('\\s+')}(?![\\p{L}\\p{N}_])`).join('|')}`,
  'giu',
);

/** Measure ids that the owner has ruled out and that are active at `now`. */
export function activeRejections(bundle: EvidenceBundle, now = bundle.createdAt): Set<string> {
  const out = new Set<string>();
  for (const [id, r] of Object.entries(bundle.memory.preferences.rejected)) {
    if (r.scope === 'never' || (r.until !== undefined && now < r.until)) out.add(id);
  }
  return out;
}

const measureIdOf = (ref: string): string => measureOf(ref)?.id ?? ref;

function lastWords(s: string, n: number): string {
  const words = s.trimEnd().split(/\s+/);
  return words.slice(-n).join(' ');
}

interface Ctx {
  bundle: EvidenceBundle;
  items: Map<string, EvidenceItem>;
  facts: Set<string>;
  knownMeasure: (ref: string) => boolean;
  rejected: Set<string>;
  polarity: PolarityLexicon;
  fragments: string[];
  section: SectionKey;
  out: ValidationIssue[];
}

function issue(ctx: Ctx, rule: ValidationIssue['rule'], span: [number, number], detail: string) {
  ctx.out.push({ rule, section: ctx.section, span, detail, severity: SEVERITY[rule] });
}

const normalise = (s: string) =>
  s
    .toLowerCase()
    // Unicode letters and digits, so a copied note in any script still matches (G8 fails closed).
    .replace(/[^\p{L}\p{N}£%]+/gu, ' ')
    .trim();

function checkSentence(ctx: Ctx, text: string, base: number) {
  const toks = tokenize(text);
  const masked = maskSlots(text, ' ');
  const at = (a: number, b: number): [number, number] => [base + a, base + b];
  const slots = toks.filter((t): t is SlotToken => t.t === 'slot');

  // G1: every slot resolves.
  for (const t of toks) {
    if (t.t === 'bad') issue(ctx, 'G1', at(t.span[0], t.span[1]), `malformed slot ${t.raw}`);
    else if (t.t === 'slot') {
      const ok =
        t.kind === 'e'
          ? ctx.items.has(t.ref)
          : t.kind === 'f'
            ? ctx.facts.has(t.ref)
            : ctx.knownMeasure(t.ref);
      if (!ok) issue(ctx, 'G1', at(t.span[0], t.span[1]), `unknown reference ${t.raw}`);
    }
  }

  // G2: no numerals or number words outside slots.
  const allowed: [number, number][] = [];
  for (const re of NUMBER_ALLOW) {
    for (const m of masked.matchAll(new RegExp(re.source, re.flags)))
      allowed.push([m.index, m.index + m[0].length]);
  }
  for (const m of masked.matchAll(NUMBER_RE)) {
    const a = m.index;
    if (allowed.some(([x, y]) => a >= x && a < y)) continue;
    issue(ctx, 'G2', at(a, a + m[0].length), `bare number "${m[0]}" outside a slot`);
  }

  // G3, G5 per evidence slot.
  for (const s of slots) {
    if (s.kind !== 'e') continue;
    const item = ctx.items.get(s.ref);
    if (!item) continue;
    const before = masked.slice(0, s.span[0]);
    const after = masked.slice(s.span[1]);
    const near = lastWords(before, 5);
    for (const [want, phrases] of [
      ['saving', ctx.polarity.saving],
      ['increase', ctx.polarity.increase],
    ] as const) {
      const hit = phrases.find((p) => wordRe(p, 'i').test(near));
      if (hit && item.sign !== want) {
        issue(
          ctx,
          'G3',
          at(s.span[0], s.span[1]),
          `"${hit}" needs a ${want} but ${s.raw} is ${item.sign ?? 'unsigned'} (${item.label})`,
        );
      }
    }
    for (const u of UNIT_NOUNS) {
      const hay = u.side === 'before' ? before : after;
      if (!u.re.test(hay)) continue;
      if (item.unit === '') continue;
      const dup = u.fits.includes(item.unit);
      issue(
        ctx,
        'G5',
        at(s.span[0], s.span[1]),
        dup
          ? `unit written twice next to ${s.raw}; the slot already renders its unit (${item.unit})`
          : `unit noun does not fit ${s.raw} (${item.unit}, ${item.label})`,
      );
    }
    if (item.fuel) {
      const words = near.toLowerCase().split(/[^a-z]+/);
      for (let i = words.length - 1; i >= 0; i--) {
        const f = FUEL_WORDS[words[i] ?? ''];
        if (!f) continue;
        if (f !== item.fuel) {
          issue(ctx, 'G5', at(s.span[0], s.span[1]), `"${words[i]}" next to ${s.raw}, which is ${item.fuel}`);
        }
        break;
      }
    }
  }

  // G4: superlatives need a rank-1 item on the same subject.
  const ranks = ctx.bundle.items.filter((i) => i.kind === 'rank' && i.value === 1);
  for (const [sup, objectives] of Object.entries(SUPERLATIVES)) {
    const m = wordRe(sup, 'i').exec(masked);
    if (!m) continue;
    const fits = (r: EvidenceItem) => objectives.some((o) => r.label.toLowerCase().includes(o));
    const subjects = new Set<string>();
    let direct = false;
    for (const s of slots) {
      if (s.kind === 'e') {
        const item = ctx.items.get(s.ref);
        if (!item) continue;
        if (item.kind === 'rank' && item.value === 1 && fits(item)) direct = true;
        if (item.subject.packageId) subjects.add(`p:${item.subject.packageId}`);
        if (item.subject.measureId) subjects.add(`m:${measureIdOf(item.subject.measureId)}`);
      } else if (s.kind === 'm') subjects.add(`m:${measureIdOf(s.ref)}`);
    }
    const backed =
      direct ||
      ranks.some(
        (r) =>
          fits(r) &&
          ((r.subject.packageId !== undefined && subjects.has(`p:${r.subject.packageId}`)) ||
            (r.subject.measureId !== undefined && subjects.has(`m:${measureIdOf(r.subject.measureId)}`))),
      );
    if (!backed) issue(ctx, 'G4', at(m.index, m.index + m[0].length), `"${m[0]}" has no rank evidence`);
  }

  // G6: a ruled-out measure only in acknowledge role.
  if (ctx.rejected.size > 0) {
    let rest = masked;
    let acknowledged = false;
    for (const re of ACKNOWLEDGE_CUES) {
      if (re.test(rest)) acknowledged = true;
      rest = rest.replace(new RegExp(re.source, `${re.flags}g`), ' ');
    }
    const recommends = RECOMMEND_CUES.some((re) => re.test(rest));
    const named: { id: string; span: [number, number]; viaSlot: boolean }[] = [];
    for (const s of slots) {
      if (s.kind === 'm') named.push({ id: measureIdOf(s.ref), span: s.span, viaSlot: true });
      if (s.kind === 'e') {
        const mid = ctx.items.get(s.ref)?.subject.measureId;
        if (mid) named.push({ id: measureIdOf(mid), span: s.span, viaSlot: true });
      }
    }
    for (const { phrase, measureId } of SYNONYMS) {
      if (!ctx.rejected.has(measureId)) continue;
      const m = wordRe(phrase, 'i').exec(masked);
      if (m) named.push({ id: measureId, span: [m.index, m.index + m[0].length], viaSlot: false });
    }
    for (const n of named) {
      if (!ctx.rejected.has(n.id)) continue;
      const bad = n.viaSlot ? !acknowledged || recommends : recommends && !acknowledged;
      if (bad)
        issue(ctx, 'G6', at(n.span[0], n.span[1]), `ruled-out measure ${n.id} is not only acknowledged`);
    }
  }

  // G7: owner claims never share a sentence with a computed outcome.
  if (slots.some((s) => s.kind === 'f') && slots.some((s) => s.kind === 'e')) {
    issue(ctx, 'G7', at(0, text.length), 'owner fact and computed value in one sentence');
  }

  // G8: injection residue.
  for (const re of INJECTION_RESIDUE) {
    const m = re.exec(masked);
    if (m) issue(ctx, 'G8', at(m.index, m.index + m[0].length), `injection residue "${m[0].trim()}"`);
  }
  if (ctx.fragments.length > 0) {
    const flat = normalise(masked);
    for (const f of ctx.fragments) {
      if (flat.includes(f)) issue(ctx, 'G8', at(0, text.length), `copies a flagged note fragment "${f}"`);
    }
  }
}

/** Validate one section's text against a bundle. */
export function validateSection(
  section: SectionKey,
  text: string,
  bundle: EvidenceBundle,
  opts: ValidateOptions = {},
): ValidationIssue[] {
  const extra = opts.measureNames ?? {};
  const ctx: Ctx = {
    bundle,
    items: new Map(bundle.items.map((i) => [i.id, i])),
    facts: new Set(bundle.facts.map((f) => f.id)),
    knownMeasure: (ref) => Object.hasOwn(extra, ref) || measureOf(ref) !== undefined,
    rejected: activeRejections(bundle, opts.now),
    polarity: opts.polarity ?? POLARITY_EN_GB,
    fragments: (opts.flaggedFragments ?? []).map(normalise).filter((f) => f.length >= 12),
    section,
    out: [],
  };
  for (const s of sentences(text)) checkSentence(ctx, s.text, s.span[0]);
  if (text.trim() === '') issue(ctx, 'G1', [0, 0], 'empty section');
  return ctx.out;
}
