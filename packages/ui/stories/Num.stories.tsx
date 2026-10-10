import type { Meta, StoryObj } from '@storybook/react-vite';
import { EvidenceProvider, staticEvidence } from '../src/evidence/context.tsx';
import { Num } from '../src/num/Num.tsx';
import { STORY_EVIDENCE } from './evidence.ts';

const source = staticEvidence(STORY_EVIDENCE);

const meta: Meta<typeof Num> = {
  title: 'Andon/Num',
  component: Num,
  decorators: [(Story) => <EvidenceProvider source={source}>{Story()}</EvidenceProvider>],
};
export default meta;
type S = StoryObj<typeof Num>;

const prose = {
  maxWidth: '34rem',
  fontFamily: 'var(--font-mincho)',
  fontWeight: 500,
  fontSize: 'var(--fs-body)',
  lineHeight: 'var(--lh-body-mincho)',
  margin: '0 0 var(--ma-4)',
} as const;

/** Numbers inside narration: every figure opens its evidence. */
export const InASentence: S = {
  render: () => (
    <div data-numeric="">
      <p style={prose}>
        On a typical January night (<Num ev="ev_climate.jan_night" /> outside), your home loses about{' '}
        <Num ev="ev_fabric.loss_now" /> through its walls, roof and gaps.
      </p>
      <p style={prose}>
        With the Best return future, bills fall by <Num ev="ev_money.bill_saving" />. Gas falls by{' '}
        <Num ev="ev_acct.saving.gas" signed delta="saving" />. Electricity rises by{' '}
        <Num ev="ev_acct.saving.electricity" signed delta="increase" />.
      </p>
    </div>
  ),
};

/** The score numeral: a number, never a letter. */
export const Display: S = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--ma-6)', flexWrap: 'wrap' }}>
      <div>
        <p
          style={{
            margin: '0 0 var(--ma-2)',
            font: '500 var(--fs-cap)/1.5 var(--font-gothic)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
          }}
        >
          Ibasho score
        </p>
        <Num ev="ev_score.total" size="display" />
      </div>
      <div>
        <p
          style={{
            margin: '0 0 var(--ma-2)',
            font: '500 var(--fs-cap)/1.5 var(--font-gothic)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
          }}
        >
          Upfront
        </p>
        <Num ev="ev_fin.n0" size="display" />
      </div>
    </div>
  ),
};

const row = {
  display: 'grid',
  gridTemplateColumns: '11rem 1fr',
  alignItems: 'baseline',
  gap: 'var(--ma-3)',
  padding: 'var(--ma-2) 0',
} as const;
const label = { font: '400 var(--fs-ui)/1.5 var(--font-gothic)', color: 'var(--text-2)' } as const;

/** Each seal a number can carry. Hover or focus a chip for its "Not proved" line. */
export const Seals: S = {
  render: () => (
    <div data-numeric="" style={{ maxWidth: '30rem' }}>
      {(
        [
          ['Checked by Lean', 'ev_acct.carbon_saving'],
          ['Checked by the mirror', 'ev_fin.payback'],
          ['Modelled', 'ev_uncert.heat'],
          ['Modelled', 'ev_fabric.u.wall'],
          ['Check failed', 'ev_rule.noise.lp'],
          ['Unverified rule', 'ev_rule.adf.flow'],
        ] as const
      ).map(([l, ev]) => (
        <div key={ev} style={row}>
          <span style={label}>{l}</span>
          <span>
            <Num ev={ev} />
          </span>
        </div>
      ))}
      <div style={row}>
        <span style={label}>Checking (recompute)</span>
        <span>
          <Num ev="ev_money.bill_saving" seal="pressing" />
        </span>
      </div>
      <div style={row}>
        <span style={label}>Evidence missing</span>
        <span>
          <Num ev="ev_nowhere" />
        </span>
      </div>
    </div>
  ),
};
