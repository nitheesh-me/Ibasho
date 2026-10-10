/**
 * Content shapes. Owner: WP-09. Layer L0 data (imports core types only).
 *
 * Copy strings may carry glossary marks: `[[g:u-value]]` renders the term's own label,
 * `[[g:u-value|U-values]]` renders the given label. Every mark must resolve to a glossary entry
 * with a plain definition (BUILD_PLAN WP-09 I5). See `marks.ts`.
 */
import type { Provenance } from '@ibasho/core';

/** A closed range of whole days, inclusive. `min` may equal `max`. */
export interface DayRange {
  min: number;
  max: number;
}

/** Can the household stay in the home while the work happens. */
export type StayIn = 'yes' | 'mostly' | 'no';

/** How much dust, noise and moving of furniture to expect. */
export type Mess = 'low' | 'medium' | 'high';

/** Disruption: days of work, rooms out of use, can you stay in (SPEC 5.9). */
export interface Disruption {
  /** Typical days with people working on site, for a typical home. Not a quote. */
  days: DayRange;
  /** Rooms or spaces out of use while the work happens, in plain words. Empty when none. */
  rooms: readonly string[];
  stayIn: StayIn;
  mess: Mess;
  /** One or two short sentences on what the work feels like to live through. */
  note: string;
}

/** Accreditation and scheme ids used in next steps. See `measures/accreditations.ts`. */
export type AccreditationId =
  | 'trustmark'
  | 'pas-2035'
  | 'mcs'
  | 'recc'
  | 'gas-safe'
  | 'competent-person'
  | 'fensa'
  | 'nia';

export interface Accreditation {
  id: AccreditationId;
  /** Plain name as an owner would search for it. */
  name: string;
  /** What it means for you, in one or two sentences. */
  plain: string;
  /** Where to check an installer holds it. */
  checkUrl: string;
}

/** Next step: installer type, accreditation, three questions to ask (SPEC 5.9). */
export interface NextStep {
  /** Who to call, in plain words. */
  installer: string;
  /** Accreditations to look for, most important first. */
  accreditation: readonly AccreditationId[];
  /** Why these accreditations matter for this measure. */
  why: string;
  /** Exactly three questions to ask before you sign. */
  questions: readonly [string, string, string];
}

/** Guidance for one measure, keyed by the measure id in `@ibasho/pack-home-uk/ids`. */
export interface MeasureGuidance {
  /** Measure id (`loft`, `wall-iwi`, `ashp`, ...). */
  measureId: string;
  /** Plain name for a person, not an assessor. */
  name: string;
  /** What it is, in one sentence. */
  what: string;
  disruption: Disruption;
  next: NextStep;
  /** Typical figures come from published guidance, not from the engine. */
  provenance: Provenance;
}

/** Guidance for a costed assessment that rules oblige (`assess-moisture`, `assess-pas2035`). */
export interface AssessmentGuidance {
  assessmentId: string;
  name: string;
  what: string;
  disruption: Disruption;
  next: NextStep;
  provenance: Provenance;
}

export interface GlossaryEntry {
  /** Kebab-case id used in marks: `[[g:<id>]]`. */
  id: string;
  /** How the term is written in copy. */
  term: string;
  /** Plain definition: one sentence, no other jargon, ideally with "lower is better" style help. */
  plain: string;
  /** Optional second sentence for the evidence drawer. */
  more?: string;
}
