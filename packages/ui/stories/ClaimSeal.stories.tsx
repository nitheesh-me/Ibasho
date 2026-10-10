import type { Meta, StoryObj } from '@storybook/react-vite';
import { ClaimSeal } from '../src/seal/ClaimSeal.tsx';

const meta: Meta<typeof ClaimSeal> = { title: 'Andon/ClaimSeal', component: ClaimSeal };
export default meta;
type S = StoryObj<typeof ClaimSeal>;

// Claim copy mirrors packages/spec-gen/src/generated/seals.json (the app passes it in).
const nothingBetter = {
  id: 'nothing-better-hidden',
  sentence: 'Nothing better is hidden',
  theorems: [
    'check_sound',
    'checkFront_sound',
    'checkFront_complete',
    'witness_sound',
    'enum_complete_sound',
  ],
  notProved: 'that our energy model matches your home exactly.',
};

export const NothingBetterIsHidden: S = {
  args: {
    claim: nothingBetter,
    statement:
      'No option that passes our rules beats these three on cost, return and running carbon at once.',
    proofHref: '#proof',
    certificateHref: '#certificate',
    press: true,
  },
};

export const WhatYouRuledOut: S = {
  args: {
    claim: {
      id: 'rejected-never-returned',
      sentence: 'What you ruled out never came back',
      theorems: ['rejected_never_offered', 'rejection_antitone', 'restore_monotone'],
      notProved: 'whether a ruled out measure would have suited you.',
    },
    proofHref: '#proof',
    certificateHref: '#certificate',
  },
};

export const InlineInAPanel: S = {
  args: {
    variant: 'inline',
    claim: {
      id: 'every-rule-passed',
      sentence: 'Every option shown passes every rule we encoded',
      theorems: ['kleene_sound', 'unknown_never_feasible', 'feasibleB_sound'],
      notProved: 'that our encoding matches the law. Check with your planning authority.',
    },
    proofHref: '#proof',
  },
};
