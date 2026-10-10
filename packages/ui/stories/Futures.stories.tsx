import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { type DoNothingData, type FutureCardData, type FutureKey, Futures } from '../src/futures/Futures.tsx';
import { withKitEvidence } from './kit-decorator.tsx';

const meta: Meta<typeof Futures> = {
  title: 'Kit/Futures',
  component: Futures,
  decorators: [withKitEvidence],
};
export default meta;
type S = StoryObj<typeof Futures>;

const four = (p: string) => [
  { key: 'upfront', label: 'Upfront', ev: `ev_f.${p}.upfront` as const },
  { key: 'saving', label: 'Saved a year', ev: `ev_f.${p}.saving` as const, delta: 'saving' as const },
  {
    key: 'carbon',
    label: 'Running carbon cut a year',
    ev: `ev_f.${p}.carbon` as const,
    as: 'tCO2e' as const,
  },
  { key: 'comfort', label: 'Comfort', ev: `ev_f.${p}.comfort` as const, signed: true },
];

export const CARDS: FutureCardData[] = [
  {
    key: 'leastUpfront',
    packageId: 'pkg-lu',
    name: 'Loft insulation and draught-proofing',
    measures: [
      { id: 'loft', name: 'Loft insulation' },
      { id: 'draught', name: 'Draught-proofing' },
    ],
    figures: four('lu'),
    negatives: [],
  },
  {
    key: 'bestReturn',
    packageId: 'pkg-br',
    name: 'Loft, draught-proofing and a heat pump',
    measures: [
      { id: 'loft', name: 'Loft insulation' },
      { id: 'draught', name: 'Draught-proofing' },
      { id: 'ashp', name: 'Air source heat pump' },
    ],
    figures: four('br'),
    more: [{ key: 'payback', label: 'Pays back in', ev: 'ev_f.br.payback' }],
    negatives: [
      { key: 'elec', label: 'Electricity use rises', kind: 'fuel-rise', ev: 'ev_neg.elec.rise.small' },
      {
        key: 'noise',
        label: 'Outdoor unit near the boundary',
        kind: 'risk',
        risk: 'noise',
        ruleId: 'UK.MCS020.noise',
      },
    ],
  },
  {
    key: 'lowestRunningCarbon',
    packageId: 'pkg-lc',
    name: 'Inside wall insulation, loft and a heat pump',
    measures: [
      { id: 'wall-iwi', name: 'Inside wall insulation' },
      { id: 'loft', name: 'Loft insulation' },
      { id: 'ashp', name: 'Air source heat pump' },
    ],
    figures: four('lc'),
    negatives: [
      { key: 'elec', label: 'Electricity use rises', kind: 'fuel-rise', ev: 'ev_neg.elec.rise' },
      {
        key: 'moist',
        label: 'Inside insulation can trap moisture in solid walls',
        kind: 'risk',
        risk: 'moisture',
        ruleId: 'UK.BS5250.iwi',
      },
      { key: 'dis', label: 'Two rooms out of use for a week', kind: 'disruption' },
    ],
  },
];

export const DO_NOTHING: DoNothingData = {
  horizon: 'Over the next fifteen years',
  figures: [
    { key: 'cost', label: 'Extra spent on energy', ev: 'ev_dn.cost' },
    { key: 'carbon', label: 'Carbon from running the home', ev: 'ev_dn.carbon', as: 'tCO2e' },
    { key: 'bill', label: 'A year of bills by then', ev: 'ev_dn.bill' },
  ],
  effects: [
    {
      key: 'boiler',
      label: 'Boiler efficiency drifts down',
      ev: 'ev_dn.boiler.eff',
      band: { lo: 'ev_dn.boiler.lo', hi: 'ev_dn.boiler.hi' },
      source: 'Boiler ageing, field trial summary',
      grade: 'estimate',
    },
    {
      key: 'seals',
      label: 'Window seals and gaps leak more air',
      ev: 'ev_dn.seal.ach',
      source: 'Airtightness decay, published survey',
    },
  ],
  replacements: [
    {
      key: 'boiler',
      label: 'Boiler replacement falls due in',
      due: 'ev_dn.boiler.due',
      cost: 'ev_dn.boiler.cost',
    },
  ],
  negatives: [
    {
      key: 'gas',
      label: 'Gas use rises as the boiler ages',
      kind: 'fuel-rise',
      ev: 'ev_dn.gas.rise',
      maintenanceId: 'boiler-ageing',
    },
    { key: 'damp', label: 'Damp risk grows where gutters are not cleared', kind: 'risk', risk: 'moisture' },
  ],
  notApplicable: ['heat pump servicing', 'solar panel soiling'],
};

function Demo(props: Partial<React.ComponentProps<typeof Futures>>) {
  const [chosen, setChosen] = useState<FutureKey | undefined>('bestReturn');
  return (
    <Futures
      cards={CARDS}
      doNothing={DO_NOTHING}
      {...(chosen ? { chosen } : {})}
      onChoose={setChosen}
      {...props}
    />
  );
}

/** Three leaves in the fixed order, each with what gets worse, and the fourth line beneath. */
export const ThreeFutures: S = { render: () => <Demo /> };
/** Best return held back (before AC-5b) and the fourth line still being worked out. */
export const Withheld: S = {
  render: () => (
    <Demo
      cards={CARDS.map((c) =>
        c.key === 'bestReturn' ? { ...c, withheld: 'Held back until money figures pass their checks.' } : c,
      )}
      doNothing={null}
    />
  ),
};
/** Two picks are the same package; the second says so. Nothing meets the aim on one axis. */
export const SameAndEmpty: S = {
  render: () => (
    <Demo
      cards={[
        CARDS[0] as FutureCardData,
        { ...(CARDS[0] as FutureCardData), key: 'bestReturn', sameAs: 'leastUpfront' },
      ]}
    />
  ),
};
