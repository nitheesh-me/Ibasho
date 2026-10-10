import type { Meta, StoryObj } from '@storybook/react-vite';
import { NarratorStrip } from '../src/narrator/NarratorStrip.tsx';
import { withKitEvidence } from './kit-decorator.tsx';

const meta: Meta<typeof NarratorStrip> = {
  title: 'Kit/NarratorStrip',
  component: NarratorStrip,
  decorators: [withKitEvidence],
};
export default meta;
type S = StoryObj<typeof NarratorStrip>;

const sentences = [
  {
    key: 'a',
    origin: 'llm' as const,
    parts: [
      'On a typical January night (',
      { ev: 'ev_climate.jan_night' as const },
      ' outside), your home loses about ',
      { ev: 'ev_fabric.loss_now' as const },
      '.',
    ],
  },
  {
    key: 'b',
    origin: 'llm' as const,
    parts: ['Most of it leaves through the solid walls and the loft.'],
  },
  {
    key: 'c',
    origin: 'template' as const,
    parts: [
      'With ',
      { measure: 'loft insulation', measureId: 'loft-top-up' },
      ', gas falls by ',
      { ev: 'ev_acct.saving.gas' as const, signed: true, delta: 'saving' as const },
      ' a year.',
    ],
  },
];

/** Sentences settle one by one; one line came from the plain narrator. */
export const Column: S = {
  args: { sentences, glyph: '居', title: 'Where the warmth goes', narrator: 'Local model' },
};
/** Every line by the plain narrator. */
export const PlainNarrator: S = {
  args: {
    sentences: sentences.map((s) => ({ ...s, origin: 'template' as const })),
    title: 'Where the warmth goes',
  },
};
/** Still being written: the pencil shows. */
export const Narrating: S = { args: { sentences: sentences.slice(0, 1), state: 'narrating', glyph: '家' } };
/** A wide band under the scene. */
export const Band: S = { args: { sentences, layout: 'band', narrator: 'Local model' } };
