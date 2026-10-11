/**
 * "What we prove": intro copy for `/app/proofs` (SPEC 5.10, LV 9). Owner: WP-09.
 *
 * The list of theorems itself is generated from `seals.json` (WP-04, WP-08). This file holds only
 * the words around it. Never "guaranteed": we prove bookkeeping and search, not outcomes.
 */

export interface ProofsIntro {
  title: string;
  lede: string;
  paragraphs: readonly string[];
  /** The three kinds of mark, in the order the page explains them. */
  marks: readonly {
    seal: 'proved' | 'checked' | 'modelled';
    name: string;
    means: string;
    notProved: string;
  }[];
  /** Headings for the generated theorem groups (claims first, then bookkeeping). */
  groups: { claims: string; claimsNote: string; bookkeeping: string; bookkeepingNote: string };
  /** What sits outside every proof. */
  boundary: { title: string; items: readonly string[] };
}

export const PROOFS_INTRO: ProofsIntro = {
  title: 'What we prove',
  lede: 'Some things here are proved. Most are modelled. We tell you which, every time.',
  paragraphs: [
    'A proof is stronger than a test. A test tries some cases. A proof covers every case, and a machine checks each step.',
    'We write our proofs in [[g:lean]]. They are about our bookkeeping and our search: that the sums add up, and that nothing better was left out.',
    'They are not about the weather, your boiler or how warm you like it. Those come from a physics model, and a model can be wrong.',
  ],
  marks: [
    {
      seal: 'proved',
      name: 'Proved',
      means: 'A claim that holds for every building, checked by Lean.',
      notProved: 'Each proved claim carries one line saying what it does not cover.',
    },
    {
      seal: 'checked',
      name: 'Checked',
      means: 'A number whose arithmetic was worked again, independently, from the [[g:certificate]].',
      notProved: 'That the inputs are right. Only the arithmetic was re-derived.',
    },
    {
      seal: 'modelled',
      name: 'Modelled',
      means: 'A result from our physics model, tested against published data.',
      notProved: 'That our energy model matches your building exactly.',
    },
  ],
  groups: {
    claims: 'Claims about your futures',
    claimsNote: 'These sit on the futures you are shown. Each names the theorems behind it.',
    bookkeeping: 'Bookkeeping',
    bookkeepingNote:
      'Small facts that keep the score honest: it stays between 0 and 100, and its weights add to one.',
  },
  boundary: {
    title: 'Outside every proof',
    items: [
      'How much energy your building really uses. That is modelled.',
      'Prices, grants and carbon factors. We show their source and date.',
      'Whether an installer does good work. Ask the three questions on each step of your plan.',
      'The narrator’s words. It may only repeat numbers that are already checked, and it never carries a seal.',
    ],
  },
};
