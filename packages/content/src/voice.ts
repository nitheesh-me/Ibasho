/**
 * Voice guide (DESIGN_SYSTEM 9, UX 15) as data, plus checkers that every piece of copy in this
 * package passes in tests. Owner: WP-09. Other packages may run `checkVoice` or
 * `checkCustomerCopy` on their own copy.
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
    'A calm architect friend who sketches while talking. Warm, specific, unhurried, never selling. The same voice for a homeowner, an architect and a campus estates team: plain first, with the detail one tap away.',
  principles: [
    {
      title: 'Short sentences',
      body: 'One idea a sentence. Most under fifteen words. If a sentence needs a comma and an “and”, try two.',
    },
    {
      title: 'Second person, plain English',
      body: 'Talk to the person: your building, your bills. British spelling. Technical words carry a plain definition.',
    },
    {
      title: 'Feeling, number, evidence',
      body: 'Start with what it is like to be inside. Then the number, as a range when we are not sure. Then the way in.',
    },
    {
      title: 'Name the condition',
      body: 'A number that depends on the weather, the hour or the people says so: “at noon on 21 May”, “with fans on”.',
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
      title: 'A pre-check, not a certificate',
      body: 'Codes and green ratings show where a design stands and how sure we are. Only an assessor can certify a building.',
    },
    {
      title: 'Preview says so',
      body: 'Example results carry the word Preview until the real calculation for that step is ready. Never let one pass as a result.',
    },
    {
      title: 'Function first, then name',
      body: 'Rooms read by what they are for, then their name: “Library, IIIT Library”. Never a person’s name.',
    },
    {
      title: 'Two depths, one number',
      body: 'Plain and Pro explain differently. The number underneath is the same.',
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
    { do: 'We are not sure how tall the tower next door is. One floor count fixes that.', dont: 'Data missing.' },
    { do: 'This number is proved to add up.', dont: 'AI-verified!' },
    { do: 'Estimated from buildings like yours.', dont: 'Showing a default as if it were fact.' },
    { do: 'Possible after a moisture check.', dont: 'Error: measure blocked.' },
    { do: 'Pre-check: passes the ECSBC energy target, with two facts still unknown.', dont: 'ECSBC compliant.' },
    { do: 'Likely 6 LEED points, possibly 9.', dont: 'LEED Gold achieved.' },
    { do: 'About 140 to 175 kWh per square metre a year.', dont: 'EUI: 157.3 kWh/m²/yr.' },
    { do: 'Preview. These numbers show the shape of the result, not your building yet.', dont: 'Results ready.' },
    { do: 'Classrooms stay comfortable with fans alone for most of March.', dont: 'Thermal comfort compliance 78%.' },
  ],
  proofWords: [
    { word: 'Proved', use: 'Only on a claim backed by a Lean theorem. Never on a single number.' },
    { word: 'Checked', use: 'A number whose arithmetic the certificate re-derived. Name the checker.' },
    { word: 'Modelled', use: 'Every physics result. Tested against published data, not proved.' },
    { word: 'Estimated', use: 'A value filled in from buildings like yours, until you tell us.' },
    { word: 'Preview', use: 'An example result in the real shape, shown before that step is calculated. Never sealed.' },
    { word: 'Pre-check', use: 'Where a design stands against a code or rating. Never a pass that an assessor would sign.' },
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
  { pattern: /\bcompliant\b/i, why: 'Never "compliant": say "pre-check: passes" and name the code.' },
  {
    pattern: /\b(LEED|IGBC|GRIHA|EDGE|ECSBC|ECBC|green)[- ]certified\b|\bcertified (building|design|green|result)s?\b/i,
    why: 'Only an assessor certifies. We show a pre-check.',
  },
  { pattern: /\brisk[- ]free\b/i, why: 'Every change has some risk; say which.' },
  { pattern: /!/, why: 'No exclamation marks. Calm, not excited.' },
  { pattern: DASH, why: 'No em or en dashes. Use a comma, colon, full stop or "to".' },
];

/**
 * Words that belong to the workshop, not the product (CLAUDE.md "Customer-facing content only").
 * Any of these in shipped copy means a development note leaked to a customer.
 */
export const DEV_ARTEFACTS: readonly { pattern: RegExp; why: string }[] = [
  { pattern: /\b(WP|AC|BP|UX|SV)-[A-Z0-9]+\b/, why: 'Work package or acceptance id.' },
  { pattern: /\b(M|V)-(0|[A-I]|P|H|[1-7])\b/, why: 'Milestone name.' },
  { pattern: /\bplace ?holders?\b|\bstand[- ]ins?\b|\bstubs?\b|\bTODO\b|\bFIXME\b/i, why: 'Unfinished work note.' },
  { pattern: /\bfixtures?\b|\bmock(ed)?\b|\bdummy\b|\blorem\b/i, why: 'Test data word.' },
  { pattern: /\btiers?\b/i, why: 'Internal word. Say "level", "rough" or "detailed".' },
  { pattern: /\bSPEC\b|\bR\d{1,2}\b|\bI\d\b/, why: 'Spec or requirement reference.' },
  { pattern: /\b(to be sourced|not yet wired|wire (it|this) up|ask (agent|WP))\b/i, why: 'Note to the team.' },
  { pattern: /\b[a-z]+[A-Z][a-zA-Z]*\(|\b[a-z_]+\.(ts|tsx|json)\b/, why: 'Code or file name.' },
];

export interface VoiceFinding {
  rule: 'banned' | 'long-sentence' | 'dev-artefact';
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

/**
 * Check copy a customer will read: the voice rules plus no development artefacts. Apps can run
 * this over their own strings in tests.
 */
export function checkCustomerCopy(copy: string): VoiceFinding[] {
  const out = checkVoice(copy);
  for (const d of DEV_ARTEFACTS) {
    const m = copy.match(d.pattern);
    if (m) out.push({ rule: 'dev-artefact', match: m[0], why: d.why });
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
