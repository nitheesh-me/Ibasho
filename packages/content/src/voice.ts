/**
 * Voice guide (DESIGN_SYSTEM 9, UX 15) as data, plus a checker that every piece of copy in this
 * package passes in tests. Owner: WP-09. Other packages may run `checkVoice` on their own copy.
 */

export interface VoicePair {
  do: string;
  dont: string;
}

export interface VoiceGuide {
  /** Who is speaking. */
  persona: string;
  principles: readonly { title: string; body: string }[];
  pairs: readonly VoicePair[];
  /** Words for the proof boundary: what each one may be used for. */
  proofWords: readonly { word: string; use: string }[];
}

export const VOICE: VoiceGuide = {
  persona:
    'A calm architect friend who sketches while talking. Warm, specific, unhurried, never selling. First the feeling, then the number, then a door to the evidence.',
  principles: [
    {
      title: 'Short sentences',
      body: 'One idea a sentence. Most under fifteen words. If a sentence needs a comma and an “and”, try two.',
    },
    {
      title: 'Second person, plain English',
      body: 'Talk to the person: your home, your bills. British spelling. Technical words carry a plain definition.',
    },
    {
      title: 'Feeling, number, evidence',
      body: 'Start with what it is like to live with. Then the number, as a range when we are not sure. Then the way in.',
    },
    {
      title: 'Name the condition',
      body: 'A number that depends on the weather or the household says so: “on a typical January night, 4 °C outside”.',
    },
    {
      title: 'Unknown is not zero',
      body: 'Say what we do not know and how much it matters. Never fill a gap silently.',
    },
    {
      title: 'Doors, not walls',
      body: 'If something is not possible, say why and what would change it. Renting is a different door, not a dead end.',
    },
    {
      title: 'Honest about proof',
      body: 'Only claims are proved. Numbers are checked or modelled. Every seal says what it does not prove.',
    },
    {
      title: 'Japan as grammar',
      body: 'Japanese appears as decoration beside English, never as something you must read to understand.',
    },
  ],
  pairs: [
    { do: 'Your back bedroom loses the most heat.', dont: 'Thermal envelope deficiency detected.' },
    { do: 'About £310 to £420 a year.', dont: 'Save up to £420!' },
    { do: 'Gas goes down. Electricity goes up a little.', dont: 'Reduce your energy by 40%.' },
    { do: 'You can ask your landlord for this. Here is a letter.', dont: 'Not available for tenants.' },
    { do: 'We are not sure about your floor. One question fixes that.', dont: 'Data missing.' },
    { do: 'This number is proved to add up.', dont: 'AI-verified!' },
    { do: 'Estimated from homes like yours.', dont: 'Showing a default as if it were fact.' },
    { do: 'Possible after a moisture check.', dont: 'Error: measure blocked.' },
  ],
  proofWords: [
    { word: 'Proved', use: 'Only on a claim backed by a Lean theorem. Never on a single number.' },
    { word: 'Checked', use: 'A number whose arithmetic the certificate re-derived. Name the checker.' },
    { word: 'Modelled', use: 'Every physics result. Tested against published data, not proved.' },
    { word: 'Estimated', use: 'A value filled in from homes like yours, until you tell us.' },
  ],
};

/** En dash and em dash, built from code points so this file stays dash free. */
const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

/** A phrase the product never says (DESIGN_SYSTEM 9). Matched case-insensitively. */
export const BANNED: readonly { pattern: RegExp; why: string }[] = [
  { pattern: /\bguarantee(d|s)?\b/i, why: 'Never "guaranteed": we prove bookkeeping, not outcomes.' },
  { pattern: /\bverified savings?\b/i, why: 'Savings are modelled, never verified.' },
  { pattern: /\bAI[- ]verified\b/i, why: 'The AI narrates. It verifies nothing.' },
  { pattern: /\bsave up to\b/i, why: 'Give a range, not a ceiling.' },
  { pattern: /\b100% accurate\b/i, why: 'Physics is a model.' },
  { pattern: /\brisk[- ]free\b/i, why: 'Every change has some risk; say which.' },
  { pattern: /!/, why: 'No exclamation marks. Calm, not excited.' },
  { pattern: DASH, why: 'No em or en dashes. Use a comma, colon, full stop or "to".' },
];

export interface VoiceFinding {
  rule: 'banned' | 'long-sentence';
  match: string;
  why: string;
}

/** Longest sentence we allow in content copy, in words. Headlines and lists are much shorter. */
export const MAX_SENTENCE_WORDS = 28;

/** Check one piece of copy against the voice rules. Empty means it passes. */
export function checkVoice(copy: string): VoiceFinding[] {
  const out: VoiceFinding[] = [];
  for (const b of BANNED) {
    const m = copy.match(b.pattern);
    if (m) out.push({ rule: 'banned', match: m[0], why: b.why });
  }
  for (const s of sentences(copy)) {
    const words = s.split(/\s+/).filter(Boolean).length;
    if (words > MAX_SENTENCE_WORDS)
      out.push({ rule: 'long-sentence', match: s, why: `${words} words; keep under ${MAX_SENTENCE_WORDS}.` });
  }
  return out;
}

/** Split on sentence ends. Good enough for our own copy, which avoids abbreviations with full stops. */
export function sentences(copy: string): string[] {
  return copy
    .split(/(?<=[.?:;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
