import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MeasureCard } from '../src/measure/MeasureCard.tsx';
import { withKitEvidence } from './kit-decorator.tsx';

const meta: Meta<typeof MeasureCard> = {
  title: 'Kit/MeasureCard',
  component: MeasureCard,
  decorators: [withKitEvidence],
};
export default meta;
type S = StoryObj<typeof MeasureCard>;

const tray = { display: 'flex', flexWrap: 'wrap', gap: 'var(--ma-4)', alignItems: 'stretch' } as const;

/** Every state, side by side, as in the what-if tray. */
function Tray() {
  const [on, setOn] = useState(true);
  return (
    <div style={tray}>
      <MeasureCard
        measureId="loft"
        name="Loft insulation"
        blurb="Top up the loft to keep heat in the rooms below."
        cost="ev_m.loft"
        state={on ? 'in-scenario' : 'available'}
        onToggle={(_, v) => setOn(v)}
      />
      <MeasureCard
        measureId="ashp"
        name="Air source heat pump"
        cost="ev_m.ashp"
        state="available"
        onToggle={() => {}}
      />
      <MeasureCard
        measureId="wall-ewi"
        name="Outside wall insulation"
        state="ask"
        reason="The freeholder decides on changes to the outside walls."
        onAsk={() => {}}
        askLabel="Ask your freeholder"
      />
      <MeasureCard
        measureId="wall-iwi"
        name="Inside wall insulation"
        cost="ev_m.iwi"
        state="needs-check"
        check="a moisture assessment for inside insulation"
        ruleId="UK.BS5250.iwi"
      />
      <MeasureCard
        measureId="pv"
        name="Solar panels"
        state="blocked"
        reason="The roof faces north and is shaded most of the day."
        ruleId="UK.PV.orientation"
      />
      <MeasureCard measureId="glazing-double" name="Double glazing" state="ruled-out" onRestore={() => {}} />
    </div>
  );
}

export const States: S = { render: () => <Tray /> };
