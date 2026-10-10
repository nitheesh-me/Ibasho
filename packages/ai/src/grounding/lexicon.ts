/**
 * en-GB lexicon for the grounding validator (AM 3.3). Per-locale plugins can replace the polarity
 * part (`PolarityLexiconPlugin`); the rest is English-specific and lives here.
 */
import type { EvidenceItem, PolarityLexicon } from '@ibasho/core';

/** G2: words that state a quantity. Matched as whole words, case-insensitive. */
export const NUMBER_WORDS: readonly string[] = [
  'zero',
  'one',
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
  'dozens',
  'half',
  'halves',
  'halve',
  'halved',
  'third',
  'thirds',
  'quarter',
  'quarters',
  'twice',
  'double',
  'doubled',
  'doubles',
  'triple',
  'tripled',
  'treble',
  'percent',
  'per cent',
  'percentage',
];

/**
 * G2 allowlist: fixed phrases where a number word is not a quantity claim. "Three futures" is a
 * structural constant of the product (SPEC 5.7), "double glazing" is a measure name, "one" as a
 * pronoun. Matched case-insensitively against the sentence; the covered span is exempt.
 */
export const NUMBER_ALLOW: readonly RegExp[] = [
  /\bthree futures\b/gi,
  /\bthree stand out\b/gi,
  /\bthe three\b/gi,
  /\bdouble[- ]glaz(?:ing|ed)\b/gi,
  /\b(?:the|this|that|which|each|every|no|any|another|a|the next|one by) one\b/gi,
  /\bone (?:of|another|day|question|thing|step|more thing|that fits)\b/gi,
  /\bone at a time\b/gi,
  /\bthird (?:party|parties)\b/gi,
  /\bquarter of an hour\b/gi,
];

/** G3 default polarity lexicon (en-GB). Phrases, matched as whole words before a slot. */
export const POLARITY_EN_GB: PolarityLexicon = {
  saving: [
    'saves',
    'save',
    'saving',
    'cuts',
    'cut',
    'cutting',
    'reduces',
    'reduce',
    'lowers',
    'lower',
    'trims',
    'falls by',
    'fall by',
    'drops by',
    'goes down by',
    'go down by',
    'comes down by',
    'less',
    'fewer',
    'shaves',
    'knocks',
  ],
  increase: [
    'raises',
    'raise',
    'adds',
    'add',
    'increases',
    'increase',
    'rises by',
    'rise by',
    'goes up by',
    'go up by',
    'more',
    'extra',
    'costs more',
    'pushes up',
  ],
};

/** G4: superlatives and the objective words a rank item's label must contain. */
export const SUPERLATIVES: Readonly<Record<string, readonly string[]>> = {
  cheapest: ['upfront', 'cost'],
  'least upfront': ['upfront', 'cost'],
  'lowest cost': ['upfront', 'cost', 'bill'],
  best: ['return', 'npv', 'value', 'saving'],
  'best return': ['return', 'npv'],
  'lowest carbon': ['carbon'],
  greenest: ['carbon'],
  'lowest running carbon': ['carbon'],
  biggest: ['loss', 'saving', 'lever', 'carbon', 'bill'],
  largest: ['loss', 'saving', 'lever', 'carbon', 'bill'],
  greatest: ['loss', 'saving', 'lever', 'carbon', 'bill'],
  highest: ['loss', 'saving', 'score', 'return'],
  fastest: ['payback'],
  quickest: ['payback'],
  smallest: ['cost', 'upfront', 'disruption'],
};

/** G5: unit nouns next to a slot, and the item units each one fits. `''` fits any noun. */
export const UNIT_NOUNS: readonly { re: RegExp; fits: readonly EvidenceItem['unit'][]; side: 'before' | 'after' }[] =
  [
    { re: /£\s*$/, fits: ['GBP', 'GBP/yr'], side: 'before' },
    { re: /^\s*(?:pounds|pound|quid|gbp)\b/i, fits: ['GBP', 'GBP/yr'], side: 'after' },
    { re: /^\s*(?:kwh|kilowatt[- ]hours?|units)\b/i, fits: ['kWh/yr'], side: 'after' },
    { re: /^\s*(?:tonnes?|kg|kilograms?|kgco2e)\b/i, fits: ['kgCO2e/yr'], side: 'after' },
    { re: /^\s*(?:a|per|each|every) year\b|^\s*(?:yearly|annually)\b/i, fits: ['GBP/yr', 'kWh/yr', 'kgCO2e/yr'], side: 'after' },
    { re: /^\s*(?:years?|yrs?)\b/i, fits: ['yr'], side: 'after' },
    { re: /^\s*(?:points?|pts)\b/i, fits: ['pts'], side: 'after' },
    { re: /^\s*(?:%|per ?cent)/i, fits: ['%'], side: 'after' },
  ];

/** G6: cues that a sentence acknowledges a ruled-out measure. */
export const ACKNOWLEDGE_CUES: readonly RegExp[] = [
  /\bruled? out\b/i,
  /\byou (?:said|told us) no\b/i,
  /\bnot for you\b/i,
  /\byou(?:'d| would)? rather not\b/i,
  /\byou (?:do not|don't) want\b/i,
  /\byou (?:set|put) aside\b/i,
  /\bleft out\b/i,
  /\bleave out\b/i,
  /\bwe (?:will not|won't) (?:suggest|offer)\b/i,
  /\bnever came back\b/i,
  /\bstill true\b/i,
  /\bwithout\b/i,
  /\bhidden by\b/i,
  /\byou declined\b/i,
  /\byou rejected\b/i,
];

/** G6: cues that a sentence recommends or proposes something. */
export const RECOMMEND_CUES: readonly RegExp[] = [
  /\b(?:we |I )?(?:suggest|recommend|propose|advise)s?\b/i,
  /\b(?:try|consider|choose|pick|go for|get|install|fit|add|start with|look at)\b/i,
  /\byou should\b/i,
  /\bworth (?:it|doing|adding)\b/i,
  /\bthe one that fits\b/i,
  /\bincludes?\b/i,
  /\bwith\b/i,
];

/** G8: residue of injected instructions or prompt echoes. */
export const INJECTION_RESIDUE: readonly RegExp[] = [
  /\bhttps?:\/\//i,
  /\bwww\.[a-z0-9-]+\./i,
  /\b(?:ignore|disregard|forget) (?:all |any )?(?:previous|prior|above|earlier) (?:instructions|rules|messages)\b/i,
  /\bsystem prompt\b/i,
  /\b(?:you are|act as|pretend to be) (?:an? )?(?:ai|assistant|language model|chatbot)\b/i,
  /\bas an ai\b/i,
  /^\s*(?:system|assistant|user)\s*:/im,
  /<\/?(?:system|instructions?|script|im_start|im_end)\b/i,
  /```/,
  /\b(?:set|change) (?:the )?budget to\b/i,
  /\bremember that the owner\b/i,
];
