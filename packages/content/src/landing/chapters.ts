/**
 * Landing chapters, "Ibasho no kōjō" (SPEC 5.1 and 27, PLAN-V3, UX 16, SV 7). Owner: WP-09.
 *
 * The landing page renders exactly this list, in `order`, skipping any chapter whose `requires`
 * are not all met (AC-L3, I4). v3 chapters wait on studio stages (`stage:<StageId>`): a chapter
 * shows once the studio can show that result, and its still carries a Preview mark while any of
 * its stages is still Preview.
 *
 * Each chapter is short on purpose (landing review M4): a title, one line, at most one short
 * paragraph and its still. Detail for professionals sits in `more`, behind a disclosure.
 * Copy may carry glossary marks (`[[g:<id>]]`).
 */
import { missingRequirements, type PluginPresence } from './requires.ts';

/** Baked kanji the landing may show, decoratively, beside an English label (DESIGN_SYSTEM 3). */
export type ChapterGlyph = '居' | '家' | '勘' | '試' | '道' | '場' | '証' | '検' | '模' | '昼';

export interface LandingChapter {
  /** Stable id, used as the section anchor (`/#daylight`). */
  id: string;
  order: number;
  /** Small label above the title, in English. */
  kicker: string;
  title: string;
  /** The one line a reader remembers. */
  line: string;
  /** At most one short paragraph. */
  body: readonly string[];
  /** Detail for professionals, shown behind "More detail". */
  more?: readonly string[];
  /** Decorative kanji, always paired with `glyphMeaning` and hidden from screen readers. */
  glyph: ChapterGlyph;
  glyphMeaning: string;
  /** Plugin ids, `kind:<PluginKind>` or `stage:<StageId>`, all needed for the chapter to render. */
  requires: readonly string[];
  /** Show the eight building types under this chapter. */
  types?: boolean;
  /** Where to see it in the studio. */
  link?: { label: string; href: string };
  /**
   * Chapter id of the stills from the city scene (`posters/manifest.json`), a day and a night one,
   * used once those files exist.
   */
  posterId?: string;
  /** A resolved still. The landing build fills it from `posterId`. */
  poster?: { src: string; srcSet?: string; alt: string };
}

/** Studio addresses the landing links to (apps/web routes under `/app/`). */
export const STUDIO_LINKS = {
  studio: '/app/',
  design: '/app/design',
  vindhya: '/app/p/pl_iiit/b/gb1',
  london: '/app/p/pl_london/b/gh1',
  hitec: '/app/p/pl_hitec/b/gb3',
  knowledgeCity: '/app/p/pl_knowledge_city',
} as const;

export const LANDING_CHAPTERS: readonly LandingChapter[] = [
  {
    id: 'hero',
    order: 1,
    kicker: 'A design and analysis studio',
    title: 'See how a building will live in its city.',
    line: 'Set it among its real neighbours and follow the sun across it, room by room, through a whole year.',
    body: [
      'For homes, offices, schools, hotels, hospitals, labs and apartments. Available for Hyderabad and London today.',
    ],
    glyph: '居',
    glyphMeaning: 'to be, to stay',
    requires: [],
  },
  {
    id: 'city',
    order: 2,
    kicker: 'In its city',
    title: 'Your building, among its real neighbours.',
    line: 'Pick a place and your building takes its spot in a paper model of the city.',
    body: [
      'Where a neighbour’s height is a guess, its top and its shadow are hatched. Type its real floor count and the hatch closes.',
    ],
    more: [
      'Neighbouring buildings come from open map data, and each one keeps a note of where its height came from. We call a guessed one an [[g:height-range]].',
      'Start from one of eight kinds of building, from a house to a hospital, or draw your own floor by floor.',
    ],
    glyph: '場',
    glyphMeaning: 'place',
    requires: ['stage:geometry', 'stage:sun'],
    types: true,
    posterId: 'city',
  },
  {
    id: 'sun',
    order: 3,
    kicker: 'Sun and shade',
    title: 'Follow the sun across the year.',
    line: 'Sweep a day from dawn to dusk and watch the shadows swing across the roofs.',
    body: [
      'In Hyderabad, from mid May to early August, the noon sun stands in the north. North glass needs shading too, and the model shows where.',
    ],
    more: [
      'Every roof, wall and window counts its [[g:sun-hours]] after the neighbours have taken their share. [[g:radiation|Solar radiation]] colours the walls from the ground up.',
      'Add two floors and you can see the sun your neighbours would lose, in hours and in kilowatt hours.',
    ],
    glyph: '昼',
    glyphMeaning: 'daytime',
    requires: ['stage:sun', 'stage:radiation'],
    posterId: 'sun',
  },
  {
    id: 'daylight',
    order: 4,
    kicker: 'Daylight',
    title: 'Light in every room.',
    line: 'Slide a floor out of the building like a drawer and see how far the daylight reaches.',
    body: [
      'Bright areas fill with colour and dim corners stay plain paper. Where low sun falls hard on desks or beds, a warm hatch marks the glare.',
    ],
    more: ['Professionals get the usual measures, [[g:sda]] and [[g:ase]], room by room and floor by floor.'],
    glyph: '居',
    glyphMeaning: 'to stay',
    requires: ['stage:daylight'],
    posterId: 'daylight',
  },
  {
    id: 'energy',
    order: 5,
    kicker: 'Energy, bills and carbon',
    title: 'Where the energy goes, and what it costs.',
    line: 'One bar splits the year into cooling, lighting, equipment, fans, pumps, hot water and solar.',
    body: [
      'The total shows as a range beside a target, so you can see how sure we are. Bills follow the local tariff, month by month.',
    ],
    more: [
      'Energy per square metre is the [[g:eui]]. Each slice of the bar is one of the [[g:end-uses]].',
      'In Telangana a [[g:slab-tariff]] can reprice every unit when a month crosses a step, and we flag those months.',
      'Carbon follows the grid of that place. In hot months we also count the hours each room stays comfortable with ceiling fans alone.',
    ],
    glyph: '勘',
    glyphMeaning: 'to reckon',
    requires: ['stage:energy'],
    posterId: 'energy',
  },
  {
    id: 'codes',
    order: 6,
    kicker: 'Codes and green ratings',
    title: 'Know where you stand before anyone asks.',
    line: 'One early pass against the energy codes and green ratings that apply to your plot.',
    body: [
      'Each line says where the design stands and how sure we are. Rating points show as likely, possible or unknown. A certificate still comes from an assessor.',
    ],
    more: [
      'In India that means [[g:ecbc]], [[g:ecsbc]] and [[g:ens]]. In England it means [[g:part-l]] and the [[g:future-homes]].',
      'Ratings include LEED, IGBC, GRIHA and EDGE, each with the clause behind its [[g:leed-points|points]]. Every line is a [[g:pre-check]].',
    ],
    glyph: '検',
    glyphMeaning: 'to examine',
    requires: ['stage:codes'],
    posterId: 'codes',
  },
  {
    id: 'compare',
    order: 7,
    kicker: 'Compare futures',
    title: 'Change one thing. Watch the rest move.',
    line: 'Keep the building as it is beside its [[g:variant|variants]], and every result updates together.',
    body: [
      'Set a goal, such as the lowest bills or ECSBC Super, and Ibasho searches bundles of changes for the cheapest way there.',
    ],
    more: [
      'Try deeper [[g:chajja|chajjas]], less west glass or a cooler roof. Each change is worked out with all the others, never added up as percentages.',
      'A separate checker, itself mathematically [[g:proved]], repeats the search and confirms nothing better was missed.',
      'What is not proved: that the physics matches your building exactly. That part is [[g:modelled]], and we say so.',
    ],
    glyph: '道',
    glyphMeaning: 'the way',
    requires: ['stage:energy', 'stage:optimise'],
    link: { label: 'Walk through Vindhya Bhavan', href: STUDIO_LINKS.vindhya },
    posterId: 'compare',
  },
  {
    id: 'design',
    order: 8,
    kicker: 'Design before you build',
    title: 'Test a building before it exists.',
    line: 'Changes cost least while a building is still a drawing.',
    body: [
      'Write a short brief, draw the floors and set the building on a free plot. Try it on two plots, or turned another way, side by side.',
    ],
    more: [
      'The brief holds the kind of building, its size, a budget band and your goals. Each type has a starter template you can ignore.',
      'Ibasho suggests changes that reach your goals at the lowest cost. Keep the version you like and come back to it as the building takes shape.',
    ],
    glyph: '模',
    glyphMeaning: 'a model',
    requires: ['stage:geometry', 'stage:sun', 'stage:energy', 'stage:codes'],
    link: { label: 'Start a design', href: STUDIO_LINKS.design },
    posterId: 'design',
  },
  {
    id: 'trust',
    order: 9,
    kicker: 'What you can trust',
    title: 'Plain about what we know.',
    line: 'Every number opens to show its inputs, its method and its sources.',
    body: [
      'Results come from documented physics and published data. The AI helps you explore and explains the choices, but it never writes a number.',
    ],
    more: [
      'What we do not know shows as a range or a hatch. It never quietly becomes zero.',
      'Until a step is calculated for your building, its results carry a [[g:preview|Preview]] mark.',
      'Your places and drawings stay on your device. There is no account, and nothing leaves unless you choose to send it.',
    ],
    glyph: '証',
    glyphMeaning: 'proof',
    requires: [],
    posterId: 'trust',
  },
];

/** Who the studio is for. Always shown: these are people, not features. */
export interface LandingAudience {
  id: string;
  who: string;
  need: string;
  link: { label: string; href: string };
}

export const LANDING_AUDIENCES: readonly LandingAudience[] = [
  {
    id: 'homeowner',
    who: 'Homeowners',
    need: 'See where the warmth leaks from a London terrace, or where the May sun lands on a Hyderabad flat, and what to change first.',
    link: { label: 'Open the London terrace', href: STUDIO_LINKS.london },
  },
  {
    id: 'architect',
    who: 'Architects',
    need: 'Test massing, glass and shading against the code and a green rating before the client meeting, with costs in rupees or pounds.',
    link: { label: 'Start a design', href: STUDIO_LINKS.design },
  },
  {
    id: 'campus',
    who: 'Campus estates teams',
    need: 'Compare blocks under one budget and decide which to fix first. Vindhya Bhavan at IIIT Hyderabad is the worked example.',
    link: { label: 'Walk through Vindhya Bhavan', href: STUDIO_LINKS.vindhya },
  },
  {
    id: 'developer',
    who: 'Developers',
    need: 'Try a plot in two orientations, see early where you stand against the energy code, and find which green measures pay for themselves.',
    link: { label: 'Open Knowledge City', href: STUDIO_LINKS.knowledgeCity },
  },
  {
    id: 'business',
    who: 'Businesses and tenants',
    need: 'Understand the bills on a rented office floor, how it feels with fans on, and a fair split between landlord and tenant.',
    link: { label: 'Open the HITEC City office', href: STUDIO_LINKS.hitec },
  },
];

/** Heading and lead for the audience section. */
export const LANDING_AUDIENCE_INTRO = {
  title: 'Who it is for',
  line: 'One studio with two depths. Plain words first, and the detail a professional needs one tap away.',
} as const;

/** The worked example strip (landing review M7). Numbers come from the studio's own results. */
export const LANDING_EXAMPLE = {
  title: 'Vindhya Bhavan, in one page',
  line: 'A courtyard research block on the IIIT Hyderabad campus, three storeys around open courts.',
  euiLabel: 'Energy per square metre',
  euiTarget: 'ECSBC reference design',
  billLabel: 'Electricity bill',
  ratingLabel: 'Green rating',
  futuresTitle: 'Three futures',
  futuresLine: 'Bundles of changes the search found, each worked out whole.',
  link: { label: 'Walk through Vindhya Bhavan', href: STUDIO_LINKS.vindhya },
  previewNote: 'Example figures. They become this building’s own numbers as each step is calculated.',
  posterId: 'hero-phone',
} as const;

/**
 * Words for the small result plates set over the chapter stills (energy, codes, compare, trust).
 * The figures on them come from the studio's own results for the worked example.
 */
export const LANDING_PLATES = {
  energy: {
    title: 'Where the energy goes',
    range: 'As drawn',
    target: 'ECSBC reference',
    unit: 'kWh/m² a year',
  },
  codes: {
    title: 'Green ratings, as a pre-check',
    note: 'An estimate, not a certification.',
  },
  compare: {
    title: 'Three futures',
    upfront: 'Upfront',
    saves: 'Saves',
  },
  trust: {
    title: 'Energy per square metre',
    method: 'How it is worked out',
    methodValue: 'Energy used over the year, divided by the cooled floor area.',
    inputs: 'Linked values',
    grade: 'Standing',
    gradePreview: 'Example result, not yet checked',
    gradeReal: 'Modelled, not measured',
  },
} as const;

/** One quiet line under the hero actions while any chapter is Preview (landing review M3). */
export const LANDING_PREVIEW_NOTE = 'Some results are examples for now and are marked Preview.';

/** The invitation that closes the page. Not a chapter: it always renders. */
export const LANDING_INVITATION = {
  title: 'Start with a place.',
  line: 'Choose Hyderabad or London, pick a building or draw your own, and explore it in a few minutes. No account needed.',
  cta: { label: 'Open the studio', href: STUDIO_LINKS.studio },
  sample: { label: 'Or walk through Vindhya Bhavan', href: STUDIO_LINKS.vindhya },
  posterId: 'invitation',
} as const;

/** Page metadata for the landing `<head>`. */
export const LANDING_META = {
  title: 'Ibasho: see how a building will live in its city',
  description:
    'A design and analysis studio for buildings in their real city. Sun and shade, daylight, energy, bills, carbon, codes and green ratings, from documented models. Private by default.',
  lang: 'en-GB',
} as const;

/** Caption under the hero drawing of a paper city. */
export const LANDING_HERO_CAPTION =
  'Your building in ink among its neighbours. The hatched shadow marks a height we can only estimate.';

/** The product's tagline, Ibasho no kōjō in English. */
export const LANDING_TAGLINE = 'Ibasho: improving the place where you belong.';

/** The footer line. */
export const LANDING_FOOTER =
  'Your places and drawings stay on your device. Prices, tariffs and code rules carry their source and date.';

/** Chapters to render for the given registry, in order (AC-L3, I4). */
export function visibleChapters(
  presence: PluginPresence,
  chapters: readonly LandingChapter[] = LANDING_CHAPTERS,
): LandingChapter[] {
  return [...chapters]
    .sort((a, b) => a.order - b.order)
    .filter((c) => missingRequirements(c.requires, presence).length === 0);
}
