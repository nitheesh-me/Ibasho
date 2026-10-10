/**
 * Notes quarantine (AM 5, D6, SPEC 10). Raw property notes never reach a narrator or the ops channel.
 * Only this extractor reads them, and it returns typed, enum-only `OwnerFact`s with a short quote.
 * T1 is rules based (no LLM needed); an LLM extractor fills the same schema and goes through the
 * same `sanitiseFacts` gate.
 *
 * Defences here: heuristic flags for text addressed to an AI (shown as a badge, AM 5 rule 5),
 * flagged fragments handed to the validator (G8), numbers in notes kept as owner claims only, and
 * the memory write gate: a fact that would change preferences becomes a seed proposal, never an
 * active memory (AM 5 rule 6, AC-M2).
 */
import type { NewMemoryEvent, OwnerFact, QuarantinedNote } from '@ibasho/core';
import { z } from 'zod';
import { SYNONYMS } from '../measures.ts';

export const QUOTE_MAX = 120;

export type InjectionFlag =
  | 'addressed-to-ai'
  | 'override-instructions'
  | 'role-words'
  | 'url'
  | 'encoded-blob'
  | 'markup'
  | 'memory-planting'
  | 'op-triggering'
  | 'number-planting';

export interface QuarantineResult {
  noteId: string;
  facts: OwnerFact[];
  flags: InjectionFlag[];
  /** Imperative fragments the validator must never see copied into narration (G8). Device only. */
  fragments: string[];
  /** Seeds for the Memory Garden (never active memory). */
  seeds: NewMemoryEvent[];
}

const FLAG_RULES: readonly { flag: InjectionFlag; re: RegExp }[] = [
  // Override attempts in the languages the corpus covers (fr, es, de, it, nl, pt, ja, hi).
  {
    flag: 'override-instructions',
    re: /\b(?:ignorez|ignora|ignoriere|ignore|negeer)\b[^.!?\n]{0,30}\b(?:instructions?|instrucciones|anweisungen|istruzioni|instructies|instruções|instrucoes)\b|指示を無視|निर्देशों को अनदेखा/i,
  },
  {
    flag: 'override-instructions',
    re: /\b(?:ignore|disregard|forget|override|bypass)\b[^.!?\n]{0,40}\b(?:instructions?|rules?|prompts?|guidelines|above|previous|prior|everything)\b/i,
  },
  {
    flag: 'addressed-to-ai',
    re: /\b(?:ai|assistant|chatbot|language model|llm|narrator|model|claude|gpt|ollama|qwen)\b[^.!?\n]{0,30}\b(?:must|should|will|shall|please|always|never)\b|\b(?:dear|attention|note to|hey|hi)\s+(?:ai|assistant|narrator|model|bot)\b|\byou are (?:now|a|an)\b|\bnew instructions?\b|\bpretend\b|\bact as\b/i,
  },
  {
    flag: 'role-words',
    re: /(?:^|\n|\s)(?:system|assistant|developer|user)\s*[:>]|<\/?(?:system|assistant|user|im_start|im_end|instructions?)\b|\[(?:system|inst)\]/i,
  },
  { flag: 'url', re: /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.|\b[a-z0-9-]+\.(?:com|net|org|io|ru|xyz|co\.uk)\b/i },
  { flag: 'encoded-blob', re: /[A-Za-z0-9+/]{40,}={0,2}|(?:%[0-9a-f]{2}){6,}|(?:\\u[0-9a-f]{4}){4,}/i },
  { flag: 'markup', re: /<!--|-->|```|<script|<\/?[a-z]+[^>]*>|\]\(|\u200b|\u200c|\u200d|\u2060|\ufeff/i },
  {
    flag: 'memory-planting',
    re: /\b(?:remember|memori[sz]e) (?:this|that)\s*[:,]|\b(?:remember|memori[sz]e|store|save|note) (?:that|this)?\s*(?:the )?(?:owner|user|they|i|we)\b|\bthe owner (?:wants|prefers|has agreed|agreed|insists|always wants)\b|\badd (?:this )?to (?:your |the )?memory\b/i,
  },
  {
    flag: 'op-triggering',
    re: /\b(?:set|change|raise|increase|lower|reduce|update)\s+(?:the\s+)?(?:budget|horizon|tariff|thermostat|setpoint|target)\b|\b(?:add|remove|apply|reject|select|choose)\s+(?:the\s+)?(?:measure|package|option|op)\b|\bsetBudget\b|\baddMeasure\b|\brejectMeasure\b|\bsetParam\b/i,
  },
  {
    flag: 'number-planting',
    re: /\b(?:say|state|tell (?:them|the owner|people|buyers)|report|claim|write|show)\b[^.!?\n]{0,50}(?:\d|percent|per cent|%|\b(?:half|double|twice|triple|quarter|third|zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|hundred|thousand)\b)/i,
  },
];

/** Decode the most common obfuscations before scanning (zero-width characters, spaced letters). */
function scanForms(text: string): string[] {
  const noZw = text.replace(/[\u200b-\u200d\u2060\ufeff]/g, '');
  const despaced = noZw.replace(/\b(?:[a-z] ){3,}[a-z]\b/gi, (m) => m.replace(/ /g, ''));
  const leet = despaced.replace(
    /[0134578@$]/g,
    (c) =>
      ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's' })[c] ?? c,
  );
  return [text, noZw, despaced, leet];
}

export function injectionFlags(text: string): InjectionFlag[] {
  const forms = scanForms(text);
  const out = new Set<InjectionFlag>();
  for (const { flag, re } of FLAG_RULES) {
    // number-planting reads digits, so it never uses the leet form.
    const hay = flag === 'number-planting' ? forms.slice(0, 3) : forms;
    if (hay.some((f) => re.test(f))) out.add(flag);
  }
  return [...out].sort();
}

/** Sentences (or lines) of a note. */
function clauses(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const IMPERATIVE =
  /^(?:please\s+)?(?:ignore|disregard|forget|override|say|tell|write|state|report|claim|set|change|add|remove|apply|reject|remember|recommend|always|never|you (?:must|should|will)|do not|don't|output|print|respond|reply|act|pretend)\b/i;

/** Clauses that read as instructions, normalised for the validator's G8 copy check. */
function imperativeFragments(text: string, flagged: boolean): string[] {
  if (!flagged) return [];
  return clauses(text)
    .filter((c) => IMPERATIVE.test(c) || injectionFlags(c).length > 0)
    .map((c) => c.slice(0, 200));
}

const NEG =
  /\b(?:no|not|never|won't|wont|don't|dont|do not|refuse|without|avoid|against|hate|dislike|rather not|isn't|cannot|can't|mustn't)\b/i;
const POS = /\b(?:want|wants|like|keen|love|would like|interested|happy to|planning|plan to|prefer|yes)\b/i;
const HISTORY =
  /\b(?:was|were|had|has been|have been|installed|fitted|replaced|boarded|added|done|in (?:19|20)\d\d|last year|years ago|previous owner)\b/i;
const HISTORY_STRONG = /\b(?:installed|fitted|replaced|boarded|removed|in (?:19|20)\d\d|years ago)\b/i;
const CONDITION =
  /\b(?:damp|mould|mold|leak|leaks|leaking|crack|cracked|rot|rotten|condensation|draughty|drafty|cold|broken|rust|failing|old|noisy|sagging|blocked)\b/i;
const CONSTRAINT =
  /\b(?:conservation area|listed|article 4|freeholder|landlord|lease|leasehold|planning|consent|not allowed|can't|cannot|mustn't|must not|forbidden|council)\b/i;

const BUDGET = /\b(?:budget|afford|spend|money|cost|£|pounds|grand)\b/i;
const TENURE = /\b(?:rent|renting|tenant|landlord|leasehold|freehold|own the|owner[- ]occupier|mortgage)\b/i;

function kindOf(c: string): OwnerFact['kind'] {
  if (CONSTRAINT.test(c)) return 'constraint';
  // "old, happy to switch" is a wish about the future, not a report on the present.
  if (POS.test(c) && !NEG.test(c) && !HISTORY_STRONG.test(c)) return 'preference';
  if (CONDITION.test(c)) return 'condition';
  if (HISTORY.test(c) && !POS.test(c)) return 'history';
  return 'preference';
}

function polarityOf(c: string): OwnerFact['polarity'] {
  if (NEG.test(c)) return 'negative';
  if (POS.test(c)) return 'positive';
  return 'neutral';
}

const wordRe = (phrase: string) =>
  new RegExp(
    `(?<![\\w-])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}(?![\\w-])`,
    'i',
  );

/** Topics a clause talks about, as measure ids, `budget` or `tenure`. */
function topicsOf(c: string): string[] {
  const out: string[] = [];
  let rest = c;
  for (const { phrase, measureId } of SYNONYMS) {
    const re = wordRe(phrase);
    if (re.test(rest)) {
      if (!out.includes(measureId)) out.push(measureId);
      rest = rest.replace(re, ' ');
    }
  }
  if (BUDGET.test(c)) out.push('budget');
  if (TENURE.test(c)) out.push('tenure');
  return out;
}

export function truncateQuote(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= QUOTE_MAX) return t;
  return `${t.slice(0, QUOTE_MAX - 1).trimEnd()}\u2026`;
}

/** Rules-based extractor. Deterministic; ids are `<noteId>.<n>`. Seeds carry `homeId`. */
export function extractFacts(note: QuarantinedNote, homeId = ''): QuarantineResult {
  const flags = injectionFlags(note.text);
  const facts: OwnerFact[] = [];
  const seeds: NewMemoryEvent[] = [];
  const seen = new Set<string>();
  for (const c of clauses(note.text)) {
    // A clause that is itself an injection never becomes a fact, nor does an order inside a flagged note.
    if (injectionFlags(c).length > 0) continue;
    if (flags.length > 0 && IMPERATIVE.test(c)) continue;
    for (const topic of topicsOf(c)) {
      const kind = kindOf(c);
      const polarity = polarityOf(c);
      const key = `${topic}|${kind}|${polarity}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const id = `${note.id}.${facts.length + 1}`;
      const quote = truncateQuote(c);
      facts.push({ id, kind, topic, polarity, quote });
      // Memory write gate: a stated preference against a measure becomes a seed, never a rejection.
      if (kind === 'preference' && polarity === 'negative' && topic !== 'budget' && topic !== 'tenure') {
        seeds.push({
          homeId,
          actor: 'llm-proposal',
          type: 'seedProposed',
          payload: {
            seedId: `seed-${id}`,
            text: `A note says no to ${topic}. Rule it out?`,
            proposes: { type: 'measureRejected', payload: { measureId: topic, scope: 'never' } },
          },
          source: { kind: 'note', ref: note.id, quote: quote.slice(0, QUOTE_MAX) },
        });
      }
    }
  }
  return {
    noteId: note.id,
    facts,
    flags,
    fragments: imperativeFragments(note.text, flags.length > 0),
    seeds,
  };
}

const TOPIC = z.string().min(1).max(40);
/** The only shape an LLM extractor may return (AM 5 rule 2). */
export const OwnerFactsSchema = z.object({
  facts: z
    .array(
      z.object({
        kind: z.enum(['constraint', 'condition', 'preference', 'history']),
        topic: TOPIC,
        polarity: z.enum(['positive', 'negative', 'neutral']),
        quote: z.string(),
      }),
    )
    .max(20),
});

/**
 * Gate for LLM-extracted facts: topics must be known measure ids, `budget` or `tenure`; quotes must
 * be verbatim substrings of the note (no invented text), are truncated, and must not themselves be
 * injections.
 */
export function sanitiseFacts(note: QuarantinedNote, raw: unknown): OwnerFact[] {
  const parsed = OwnerFactsSchema.safeParse(raw);
  if (!parsed.success) return [];
  const topics = new Set<string>(['budget', 'tenure', ...SYNONYMS.map((s) => s.measureId)]);
  const flat = note.text.replace(/\s+/g, ' ');
  const out: OwnerFact[] = [];
  for (const f of parsed.data.facts) {
    const quote = f.quote.replace(/\s+/g, ' ').trim();
    if (!topics.has(f.topic) || quote === '' || !flat.includes(quote) || injectionFlags(quote).length > 0)
      continue;
    out.push({
      id: `${note.id}.${out.length + 1}`,
      kind: f.kind,
      topic: f.topic,
      polarity: f.polarity,
      quote: truncateQuote(quote),
    });
  }
  return out;
}

/** JSON Schema for the extractor (enum-only, no tools, no ranges). */
export function factsJsonSchema(): Record<string, unknown> {
  const topics = ['budget', 'tenure', ...new Set(SYNONYMS.map((s) => s.measureId))];
  return {
    type: 'object',
    additionalProperties: false,
    required: ['facts'],
    properties: {
      facts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'topic', 'polarity', 'quote'],
          properties: {
            kind: { type: 'string', enum: ['constraint', 'condition', 'preference', 'history'] },
            topic: { type: 'string', enum: topics },
            polarity: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
            quote: { type: 'string' },
          },
        },
      },
    },
  };
}
