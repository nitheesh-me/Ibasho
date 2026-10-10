import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Slider } from '../src/slider/Slider.tsx';
import { withKitEvidence } from './kit-decorator.tsx';

const meta: Meta<typeof Slider> = { title: 'Kit/Slider', component: Slider, decorators: [withKitEvidence] };
export default meta;
type S = StoryObj<typeof Slider>;

const loft = [0, 1, 2, 3].map((i) => ({ key: `l${i}`, ev: `ev_loft.${i}` as const }));
const flow = [0, 1, 2, 3, 4, 5].map((i) => ({ key: `f${i}`, ev: `ev_flow.${i}` as const }));

/** Loft depth: four stops, the home today marked. Arrow keys, Page keys, Home and End. */
function Loft() {
  const [i, setI] = useState(2);
  return (
    <Slider
      label="Loft insulation depth"
      stops={loft}
      index={i}
      onChange={setI}
      currentIndex={0}
      hint="Deeper insulation keeps more heat in, with smaller gains each step."
    />
  );
}
export const LoftDepth: S = { render: () => <Loft /> };
/** Flow temperature lever. */
export const FlowTemperature: S = {
  args: {
    label: 'Radiator flow temperature',
    stops: flow,
    defaultIndex: 5,
    currentIndex: 5,
    hint: 'Lower flow temperatures let a heat pump work more efficiently.',
  },
};
/** Not available. */
export const Disabled: S = {
  args: { label: 'Loft insulation depth', stops: loft, defaultIndex: 1, disabled: true },
};
