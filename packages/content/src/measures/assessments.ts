/**
 * Guidance for the costed assessments that rules oblige (SPEC 9: `ENG.MOIST.IWI`, `UK.PAS2035`).
 * Owner: WP-09. Keyed by the ids in `ASSESSMENTS` from `packs/home-uk/src/ids.ts`.
 */
import type { Provenance } from '@ibasho/core';
import type { AssessmentGuidance } from '../types.ts';

const CHECKED = '2026-10-11';

const provenance = (id: string, title: string, url: string): Provenance => ({
  sources: [{ id, title, url, retrieved: CHECKED }],
  lastChecked: CHECKED,
  grade: 'estimate',
});

const LIST = [
  {
    assessmentId: 'assess-moisture',
    name: 'Moisture check for your walls',
    what: 'A survey and a calculation of whether insulating your walls from the inside could trap water in the brick.',
    disruption: {
      days: { min: 1, max: 1 },
      rooms: [],
      stayIn: 'yes',
      mess: 'low',
      note: 'One visit to look at the walls, gutters and pointing, and perhaps take a few readings. The calculation happens back at the office.',
    },
    next: {
      installer: 'A surveyor or retrofit assessor who knows older, [[g:solid-wall]] homes.',
      accreditation: ['pas-2035'],
      why: 'This check is what turns “possible after a moisture check” into a clear yes or no.',
      questions: [
        'Will you model the wall over several years of weather, not just a single winter day?',
        'Will you look at rain, gutters and pointing on the outside first?',
        'If the answer is no, what would make it yes?',
      ],
    },
    provenance: provenance(
      'he-retrofit',
      'Historic England, retrofit and energy efficiency in historic buildings',
      'https://historicengland.org.uk/advice/technical-advice/retrofit-and-energy-efficiency-in-historic-buildings/',
    ),
  },
  {
    assessmentId: 'assess-pas2035',
    name: 'Whole house retrofit assessment',
    what: 'A PAS 2035 assessment and a [[g:retrofit-coordinator]] who plans your changes as one job.',
    disruption: {
      days: { min: 1, max: 1 },
      rooms: ['Every room, briefly, to measure and photograph'],
      stayIn: 'yes',
      mess: 'low',
      note: 'One visit of a few hours. The coordinator then stays with the project until it is signed off.',
    },
    next: {
      installer: 'A retrofit assessor and coordinator, often from the same firm.',
      accreditation: ['pas-2035', 'trustmark'],
      why: 'Funded schemes require it. It is also the best protection against changes that fight each other.',
      questions: [
        'Will you give me a written plan for the whole house, in the order the work should happen?',
        'Who checks the work once it is done, and when?',
        'Is your coordinator independent of the installers you recommend?',
      ],
    },
    provenance: provenance(
      'trustmark-pas-2035',
      'TrustMark, PAS 2035 and the retrofit coordinator role',
      'https://www.trustmark.org.uk/ourservices/pas-2035',
    ),
  },
] as const satisfies readonly AssessmentGuidance[];

export type GuidedAssessmentId = (typeof LIST)[number]['assessmentId'];

export const ASSESSMENT_GUIDANCE: Readonly<Record<GuidedAssessmentId, AssessmentGuidance>> = Object.freeze(
  Object.fromEntries(LIST.map((g): [string, AssessmentGuidance] => [g.assessmentId, g])) as Record<
    GuidedAssessmentId,
    AssessmentGuidance
  >,
);

export const GUIDED_ASSESSMENT_IDS: readonly GuidedAssessmentId[] = LIST.map((g) => g.assessmentId);
