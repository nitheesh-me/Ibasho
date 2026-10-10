import type { Meta, StoryObj } from '@storybook/react-vite';
import { WhyNot } from '../src/whynot/WhyNot.tsx';
import { withKitEvidence } from './kit-decorator.tsx';

const meta: Meta<typeof WhyNot> = { title: 'Kit/WhyNot', component: WhyNot, decorators: [withKitEvidence] };
export default meta;
type S = StoryObj<typeof WhyNot>;

/** One row per reason, sorted so what you can act on comes first. */
export const EveryReason: S = {
  args: {
    onRestore: () => {},
    onAsk: () => {},
    onRule: () => {},
    items: [
      {
        measureId: 'pv',
        name: 'Solar panels',
        reason: 'rule',
        ruleId: 'UK.PV.orientation',
        detail: 'The roof faces north.',
      },
      {
        measureId: 'glazing-double',
        name: 'Double glazing',
        reason: 'memory',
        detail: 'You said you would rather keep the sash windows.',
      },
      {
        measureId: 'wall-ewi',
        name: 'Outside wall insulation',
        reason: 'tenure',
        detail: 'The freeholder decides on the outside walls.',
      },
      {
        measureId: 'floor',
        name: 'Floor insulation',
        reason: 'witness',
        witness: 'Loft insulation and draught-proofing',
      },
      {
        measureId: 'battery',
        name: 'Home battery',
        reason: 'target',
        detail: 'It moves when you use power but barely cuts carbon here.',
      },
      { measureId: 'mvhr', name: 'Ventilation with heat recovery', reason: 'budget', cost: 'ev_whynot.ewi' },
    ],
  },
};
/** Nothing left out. */
export const Empty: S = { args: { items: [] } };
