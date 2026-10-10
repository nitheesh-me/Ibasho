/**
 * Landing chapters, "Ibasho no kōjō" (SPEC 5.1, UX 16, SV 7). Owner: WP-09.
 *
 * The landing page renders exactly this list, in `order`, skipping any chapter whose `requires`
 * are not all registered (AC-L3, I4). Each chapter follows Dami Lee's order: the human first,
 * then tension, then data, then proof. Copy may carry glossary marks (`[[g:<id>]]`).
 */
import { missingRequirements, type PluginPresence } from './requires.ts';

/** Baked kanji the landing may show, decoratively, beside an English label (DESIGN_SYSTEM 3). */
export type ChapterGlyph = '居' | '家' | '試' | '道' | '証';

export interface LandingChapter {
  /** Stable id, used as the section anchor (`/#what-if`). */
  id: string;
  order: number;
  /** Small label above the title, in English. */
  kicker: string;
  title: string;
  /** The one line a reader remembers. */
  line: string;
  /** Short paragraphs. */
  body: readonly string[];
  /** Decorative kanji, always paired with `glyphMeaning` and hidden from screen readers. */
  glyph: ChapterGlyph;
  glyphMeaning: string;
  /** Plugin ids, or `kind:<PluginKind>`, that must be registered for the chapter to render. */
  requires: readonly string[];
  /**
   * Baked poster (SPEC 5.1). PLACEHOLDER: posters are baked from the scene once WP-07 lands
   * (gate M-E); until then the landing shows the glyph and the words.
   */
  poster?: { src: string; alt: string };
}

export const LANDING_CHAPTERS: readonly LandingChapter[] = [
  {
    id: 'hero',
    order: 1,
    kicker: 'Ibasho',
    title: 'A place where you belong.',
    line: 'A living drawing of your home, and what it could become.',
    body: [
      'Ibasho draws a working copy of your home. Change it, and it works everything out again.',
      'It shows where the warmth goes. It shows what the house could become. And it proves it hid nothing better from you.',
    ],
    glyph: '居',
    glyphMeaning: 'to be, to stay',
    requires: [],
  },
  {
    id: 'drawn',
    order: 2,
    kicker: 'Your home, drawn',
    title: 'Unknown is not zero.',
    line: 'If we do not know, we say so, and show you how much it matters.',
    body: [
      'Give us a postcode and pick the shape of your house. We draw the rest from homes like yours.',
      'Anything we guess looks pencilled in, and carries a [[g:likely-range]]. Answer one question and the pencil turns to ink.',
      'Add last year’s bills and the model corrects itself in front of you. Then it tells you how far out it was.',
    ],
    glyph: '家',
    glyphMeaning: 'home',
    requires: ['climate-london', 'kind:archetype'],
  },
  {
    id: 'what-if',
    order: 3,
    kicker: 'What if',
    title: 'Change one thing. Watch the rest move.',
    line: 'Bigger radiators and a thicker loft change what a heat pump costs to run.',
    body: [
      'Make the radiators bigger. Add loft insulation. The [[g:heat-pump]] runs cooler, works more efficiently, and the bill moves with it.',
      'Changes act on each other, so we never just add up percentages. Each time, the whole house is worked out again.',
      'Gas goes down. Electricity goes up a little. You see both.',
    ],
    glyph: '試',
    glyphMeaning: 'to try',
    requires: ['loft', 'ashp', 'kind:tariff'],
  },
  {
    id: 'futures',
    order: 4,
    kicker: 'Three futures',
    title: 'Only ones you can build.',
    line: 'Least upfront. Best return. Lowest running carbon.',
    body: [
      'We try every combination we know for your home, often thousands of them. Three come forward, each named for what it does best.',
      'Each one passes the rules we hold for your home: planning, your tenancy, the noise test for a heat pump.',
      'If something is missing, we say why. You ruled it out, or it needs a check first.',
    ],
    glyph: '道',
    glyphMeaning: 'the way',
    requires: ['kind:search-strategy', 'rules-uk'],
  },
  {
    id: 'proof',
    order: 5,
    kicker: 'Proof and privacy',
    title: 'Nothing better is hidden.',
    line: 'Every number opens. Your home stays with you.',
    body: [
      'Tap any number to see where it came from: its inputs, its formula, its sources, and how it was checked.',
      'A separate checker, proved sound in [[g:lean]], works through the search again for your home. Of every option we know, none you can build beats any of the three on cost, return and running carbon at once.',
      'Not proved: that our energy model matches your home exactly. The physics is [[g:modelled]], and we say so.',
      'Your home stays on your device. No account. Nothing leaves unless you choose to send it.',
    ],
    glyph: '証',
    glyphMeaning: 'proof',
    requires: ['kind:checker-rung'],
  },
];

/** The invitation that closes the page. Not a chapter: it always renders. */
export const LANDING_INVITATION = {
  title: 'Come in.',
  line: 'Two minutes, a postcode and a few pictures. No account, and nothing leaves your device.',
  cta: { label: 'Step into your home', href: '/app/start' },
  sample: { label: 'See a sample home', href: '/app/home/gh1' },
} as const;

/** Page metadata for the landing `<head>`. */
export const LANDING_META = {
  title: 'Ibasho: a living drawing of your home',
  description:
    'Draw your home in two minutes. See where the warmth goes, try changes, and get three futures you can actually build. Private by default.',
  lang: 'en-GB',
} as const;

/** Chapters to render for the given registry, in order (AC-L3, I4). */
export function visibleChapters(
  presence: PluginPresence,
  chapters: readonly LandingChapter[] = LANDING_CHAPTERS,
): LandingChapter[] {
  return [...chapters]
    .sort((a, b) => a.order - b.order)
    .filter((c) => missingRequirements(c.requires, presence).length === 0);
}
