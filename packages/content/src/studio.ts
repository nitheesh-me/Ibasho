/**
 * Studio microcopy for v3 (SPEC 15 to 27, DESIGN_SYSTEM 13). Owner: WP-09.
 *
 * Plain words for the states, stages, code and rating ladders, goals and comparison axes that the
 * studio shows. Keyed by the core v3 unions, so a new stage or status fails typecheck here until
 * it has words. Copy may carry glossary marks (`[[g:<id>]]`); render with `segments`, or strip with
 * `plainText` for labels and aria text.
 */
import type {
  Applicability,
  GapStatus,
  ObjectiveId,
  StageId,
  StageStatus,
  Tier,
} from '@ibasho/core';

export interface StageCopy {
  /** Short bead label. */
  label: string;
  /** What the stage is doing, in the progress line. */
  doing: string;
  /** What the result tells you, in one sentence (help text, Plain depth). */
  means: string;
}

export const STAGE_COPY: Readonly<Record<StageId, StageCopy>> = {
  geometry: {
    label: 'Shape',
    doing: 'Reading the floors, rooms and windows',
    means: 'Floor areas, wall and window areas, and how much of each wall is glass.',
  },
  sun: {
    label: 'Sun',
    doing: 'Tracing the sun past the neighbours',
    means: 'Where the sun reaches through the year, and the shadows your building casts.',
  },
  radiation: {
    label: 'Radiation',
    doing: 'Adding up the sky on every roof and wall',
    means: 'How much of the sun’s energy lands on each surface in a year.',
  },
  daylight: {
    label: 'Daylight',
    doing: 'Lighting each floor',
    means: 'How much of each floor works by daylight, and where harsh sun brings glare.',
  },
  energy: {
    label: 'Energy',
    doing: 'Running the year, hour by hour',
    means: 'Energy by end use, bills, carbon and comfort, with a range where we are not sure.',
  },
  codes: {
    label: 'Codes',
    doing: 'Checking codes and green ratings',
    means: 'Where the design stands against each code and rating that applies here.',
  },
  optimise: {
    label: 'Options',
    doing: 'Trying bundles of changes',
    means: 'The best bundles of changes for your goals, each worked out whole.',
  },
};

export const STAGE_STATUS_WORD: Readonly<Record<StageStatus, string>> = {
  idle: 'Waiting',
  queued: 'Waiting',
  running: 'Working',
  done: 'Done',
  skipped: 'Up to date, nothing it reads changed',
  stale: 'Updating',
  cancelled: 'Stopped by you',
  failed: 'Could not finish',
};

export const TIER_WORD: Readonly<Record<Tier, string>> = {
  rough: 'Rough for now',
  refined: 'Sharpening',
  final: 'Final',
};

/** Code and rating applicability (R34), in the words a customer reads. Never "compliant". */
export const APPLICABILITY_COPY: Readonly<Record<Applicability, { label: string; means: string }>> = {
  reference: {
    label: 'Rule found',
    means: 'We found the rule that applies here and read the design against it.',
  },
  partial: {
    label: 'Partly checked',
    means: 'We can check some of this rule. The rest needs facts we do not have yet.',
  },
  'adoption-unconfirmed': {
    label: 'Check the local edition',
    means: 'Which edition your council or state enforces depends on the permit date. Please confirm it locally.',
  },
  professional: {
    label: 'Needs an assessor',
    means: 'This part needs a professional to inspect or calculate it. We show where you are likely to stand.',
  },
  'not-a-certificate': {
    label: 'Not a certificate',
    means: 'This is a [[g:pre-check]]. Only an approved assessor can certify a building.',
  },
};

/** A code pre-check line (R34). */
export const PRECHECK_WORD = {
  pass: 'Pre-check: passes',
  fail: 'Pre-check: falls short',
  unknown: 'Pre-check: not known yet',
} as const;

/** A goal's gap (SPEC 27, AC-PD3). */
export const GAP_COPY: Readonly<Record<GapStatus, string>> = {
  met: 'Meets the target',
  'not-met': 'Not there yet',
  unknown: 'Not known yet',
};

/** Rating points are always an estimate (R36). */
export const RATING_COPY = {
  likely: 'Likely',
  possible: 'Possible',
  unknown: 'Unknown',
  caption: 'An estimate, not a certification.',
} as const;

/** Comparison axes for the optimiser (R37), with the direction that is better. */
export const OBJECTIVE_COPY: Readonly<Record<ObjectiveId, { label: string; better: string }>> = {
  capex: { label: 'Upfront cost', better: 'Lower is better' },
  opex: { label: 'Running cost', better: 'Lower is better' },
  eui: { label: 'Energy per square metre', better: 'Lower is better' },
  carbon: { label: 'Running carbon', better: 'Lower is better' },
  comfort: { label: 'Comfortable hours', better: 'More is better' },
  sda: { label: 'Daylit floor area', better: 'More is better' },
  ase: { label: 'Floor with glare risk', better: 'Less is better' },
  npv: { label: 'Value in today’s money', better: 'Higher is better' },
};

/** Ready-made goals in the design brief, keyed by `GOAL_PRESETS` ids in core. */
export const GOAL_PRESET_COPY: Readonly<Record<string, { label: string; means: string }>> = {
  'net-zero-ready-uk': {
    label: 'Net zero ready',
    means: 'Low enough energy use that clean electricity can run it with no fossil fuel on site.',
  },
  'fhs-2025': {
    label: 'Future Homes Standard',
    means: 'Meets the [[g:future-homes]] energy and heating limits for new homes in England.',
  },
  'part-l': {
    label: 'Part L',
    means: 'Passes the [[g:part-l]] energy targets for a new building in England.',
  },
  'london-plan': {
    label: 'London Plan energy',
    means: 'Follows the London Plan steps: use less, supply cleanly, then add renewables on site.',
  },
  'ecsbc-super': {
    label: 'ECSBC Super',
    means: 'Reaches the highest level of the [[g:ecsbc]], the newer Indian building code.',
  },
  'leed-gold': {
    label: 'LEED Gold',
    means: 'Enough likely [[g:leed-points]] for Gold, as an estimate before any assessment.',
  },
  'lowest-opex': {
    label: 'Lowest running cost',
    means: 'The bundle with the smallest yearly bills among the options we tried.',
  },
};

/** Words that appear around results. */
export const STUDIO_COPY = {
  preview: {
    word: 'Preview',
    line: 'Preview. These numbers show the shape of the result, not your building yet.',
    long: 'This step shows an example result while its full calculation is being finished. It turns into your building’s own number as soon as it is ready.',
  },
  stale: 'Updating',
  modelled: 'Modelled, not measured.',
  estimated: 'Estimated from buildings like yours.',
  range: 'A range, because some facts are not known yet.',
  noneBetter: 'Nothing better among the options we tried.',
  noneBetterNot: 'Not proved: that these are the only options worth trying.',
  cancel: 'Stop',
  cancelled: 'Stopped. Your drawing is safe.',
  failed: 'This step could not finish. Your drawing is safe, and the other results still stand.',
  savedLocally: 'Saved on this device.',
  noAccount: 'No account needed. Your places and drawings stay on this device.',
  phoneDraw: 'Drawing a building needs a bigger screen. You can still change room uses, windows and shading here.',
  emptyPlaces: 'No places yet. Start with a city, or open one of the sample buildings.',
  emptyVariants: 'Only the building as drawn so far. Change something to make a first variant.',
  unknownHeight: 'Height not known. The hatched band shows how far its shadow could reach.',
  oneFactCloses: 'Type the number of floors and the band closes.',
} as const;
