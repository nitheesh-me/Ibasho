import type { Meta, StoryObj } from '@storybook/react-vite';
import { FuelBars } from '../src/fuel/FuelBars.tsx';
import { withKitEvidence } from './kit-decorator.tsx';

const meta: Meta<typeof FuelBars> = {
  title: 'Kit/FuelBars',
  component: FuelBars,
  decorators: [withKitEvidence],
};
export default meta;
type S = StoryObj<typeof FuelBars>;

/** Gas falls (a range), electricity rises (hatched), export falls a little, oil is unchanged. */
export const HeatPumpSwitch: S = {
  args: {
    title: 'What you buy changes',
    summary: 'Gas falls a lot; electricity rises by less, because a heat pump moves more heat than it uses.',
    as: 'kWh',
    rows: [
      { fuel: 'gas', ev: 'ev_fb.gas' },
      { fuel: 'electricity', ev: 'ev_fb.elec' },
      { fuel: 'export', ev: 'ev_fb.export' },
      { fuel: 'oil', ev: 'ev_fb.oil' },
    ],
  },
};
