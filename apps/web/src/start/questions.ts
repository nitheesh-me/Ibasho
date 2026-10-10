/**
 * The Tune step: up to six picture questions (SPEC 5.2, UX 5.2). Owner: WP-08.
 *
 * Each answer narrows one part of the twin and marks it as told by you; "Not sure" keeps the
 * estimate and its range. Values are RdSAP 10 defaults (Table 16 for lofts, Table 24 for windows),
 * the same sources the engine's measure models use.
 * PLACEHOLDER: the order is the typical UK order from UX 5.2. Ordering by value of information
 * waits for `EngineApi.valueOfInformation` (it throws `NotImplementedYet` today).
 */
import type { ControlType, Element, HomeTwin, NumField } from '@ibasho/core';

export type PictureId =
  | 'loft-bare'
  | 'loft-thin'
  | 'loft-deep'
  | 'glass-single'
  | 'glass-double'
  | 'glass-new'
  | 'draught-most'
  | 'draught-some'
  | 'draught-none';

export interface TuneChoice {
  id: string;
  label: string;
  /** A drawing for the choice, when the question is a picture question. */
  picture?: PictureId;
  apply(twin: HomeTwin): void;
}

export interface TuneQuestion {
  id: string;
  prompt: string;
  /** Why we ask, in one plain line. */
  why: string;
  choices: readonly TuneChoice[];
}

const told = (value: number, lo: number, hi: number): NumField => ({
  state: 'estimated',
  value,
  range: [lo, hi],
  source: { kind: 'stated' },
});

function setElements(twin: HomeTwin, match: (e: Element) => boolean, u: NumField, constructionId: string) {
  for (const e of twin.elements) {
    if (!match(e)) continue;
    e.u = u;
    e.constructionId = constructionId;
  }
}

const isLoft = (e: Element) => e.kind === 'roof' && !/rafter|flat/.test(e.constructionId);
const isWindow = (e: Element) => e.kind === 'window';

export const TUNE_QUESTIONS: readonly TuneQuestion[] = [
  {
    id: 'loft',
    prompt: 'Which looks most like your loft?',
    why: 'The roof is often where most heat escapes.',
    choices: [
      {
        id: 'bare',
        label: 'Bare joists',
        picture: 'loft-bare',
        apply: (t) => setElements(t, isLoft, told(2.3, 1.8, 2.3), 'loft-joists-0mm'),
      },
      {
        id: 'thin',
        label: 'A thin yellow layer',
        picture: 'loft-thin',
        apply: (t) => setElements(t, isLoft, told(0.68, 0.5, 1.0), 'loft-joists-50mm'),
      },
      {
        id: 'deep',
        label: 'A deep fluffy layer',
        picture: 'loft-deep',
        apply: (t) => setElements(t, isLoft, told(0.21, 0.16, 0.3), 'loft-joists-200mm'),
      },
    ],
  },
  {
    id: 'glazing',
    prompt: 'What are most of your windows like?',
    why: 'Glass loses heat faster than walls.',
    choices: [
      {
        id: 'single',
        label: 'One pane of glass',
        picture: 'glass-single',
        apply: (t) => setElements(t, isWindow, told(4.8, 4.6, 5.0), 'window-single-sash'),
      },
      {
        id: 'double-old',
        label: 'Double, fitted before about 2002',
        picture: 'glass-double',
        apply: (t) => setElements(t, isWindow, told(2.8, 2.4, 3.1), 'window-double-pre2002'),
      },
      {
        id: 'double-new',
        label: 'Double, fitted more recently',
        picture: 'glass-new',
        apply: (t) => setElements(t, isWindow, told(2.0, 1.6, 2.4), 'window-double-post2002'),
      },
    ],
  },
  {
    id: 'draughts',
    prompt: 'How many windows and doors are sealed against draughts?',
    why: 'Cold air coming in has to be heated.',
    choices: [
      {
        id: 'most',
        label: 'Most of them',
        picture: 'draught-most',
        apply: (t) => {
          t.ventilation.draughtProofedFrac = told(0.8, 0.7, 0.9);
        },
      },
      {
        id: 'some',
        label: 'Some of them',
        picture: 'draught-some',
        apply: (t) => {
          t.ventilation.draughtProofedFrac = told(0.4, 0.25, 0.6);
        },
      },
      {
        id: 'none',
        label: 'Hardly any',
        picture: 'draught-none',
        apply: (t) => {
          t.ventilation.draughtProofedFrac = told(0.05, 0, 0.15);
        },
      },
    ],
  },
  {
    id: 'controls',
    prompt: 'How do you control the heating?',
    why: 'Good controls avoid heating empty rooms.',
    choices: controlChoices([
      ['timer', 'A timer only', 'programmer-only'],
      ['thermostat', 'A timer and a thermostat', 'programmer-thermostat'],
      ['trvs', 'Those, plus dials on the radiators', 'programmer-thermostat-trvs'],
    ]),
  },
  {
    id: 'warmth',
    prompt: 'How warm do you keep the living room?',
    why: 'Each degree changes the heat the home needs.',
    choices: [
      {
        id: 'cool',
        label: 'On the cool side',
        apply: (t) => {
          t.occupancy.setpointC = told(18, 17, 19);
        },
      },
      {
        id: 'usual',
        label: 'About usual',
        apply: (t) => {
          t.occupancy.setpointC = told(20, 19, 21);
        },
      },
      {
        id: 'warm',
        label: 'Nice and warm',
        apply: (t) => {
          t.occupancy.setpointC = told(22, 21, 23);
        },
      },
    ],
  },
  {
    id: 'hours',
    prompt: 'When is the heating on, on a winter weekday?',
    why: 'Hours of heating shape the bill.',
    choices: [
      {
        id: 'twice',
        label: 'Morning and evening',
        apply: (t) => {
          t.occupancy.heatingHours = told(9, 7, 10);
        },
      },
      {
        id: 'most',
        label: 'Most of the day',
        apply: (t) => {
          t.occupancy.heatingHours = told(14, 12, 16);
        },
      },
      {
        id: 'evening',
        label: 'Evenings only',
        apply: (t) => {
          t.occupancy.heatingHours = told(5, 4, 6);
        },
      },
    ],
  },
];

function controlChoices(rows: [string, string, ControlType][]): TuneChoice[] {
  return rows.map(([id, label, value]) => ({
    id,
    label,
    apply: (t) => {
      t.systems.controls = { state: 'known', value, source: { kind: 'stated' } };
    },
  }));
}

if (TUNE_QUESTIONS.length > 6) throw new Error('the Tune step asks at most six questions (SPEC 5.2)');

/** Apply the answered questions in order. Unanswered ("Not sure") questions keep the estimate. */
export function applyTune(twin: HomeTwin, answers: Readonly<Record<string, string>>): void {
  for (const q of TUNE_QUESTIONS) {
    const c = q.choices.find((x) => x.id === answers[q.id]);
    c?.apply(twin);
  }
}
