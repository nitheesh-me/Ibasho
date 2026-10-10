import type { Meta, StoryObj } from '@storybook/react-vite';
import { MonthRing } from '../src/month/MonthRing.tsx';
import { withKitEvidence } from './kit-decorator.tsx';
import { monthIds } from './kit-evidence.ts';

const meta: Meta<typeof MonthRing> = {
  title: 'Kit/MonthRing',
  component: MonthRing,
  decorators: [withKitEvidence],
};
export default meta;
type S = StoryObj<typeof MonthRing>;

/** Gas and electricity through the year. Arrow keys move one month; tap or drag round the ring. */
export const GasAndElectricity: S = {
  args: {
    title: 'Your year',
    summary: 'Gas use peaks in January and almost stops in summer; electricity stays steady.',
    series: [
      { fuel: 'gas', months: monthIds('mo.gas') },
      { fuel: 'electricity', months: monthIds('mo.elec') },
    ],
  },
};
/** After a heat pump: electricity only. */
export const HeatPump: S = {
  args: {
    title: 'With a heat pump',
    summary: 'Electricity now follows the winter, peaking in January.',
    defaultMonth: 0,
    series: [{ fuel: 'electricity', months: monthIds('mo.hp') }],
  },
};
