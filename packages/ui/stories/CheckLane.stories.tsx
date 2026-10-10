import { GRADES } from '@ibasho/core';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CheckLane } from '../src/checklane/CheckLane.tsx';
import { GradeBadge } from '../src/grade/GradeBadge.tsx';
import { withKitEvidence } from './kit-decorator.tsx';

const meta: Meta<typeof CheckLane> = {
  title: 'Kit/CheckLane',
  component: CheckLane,
  decorators: [withKitEvidence],
};
export default meta;
type S = StoryObj<typeof CheckLane>;

/** Inside wall insulation waits on a moisture assessment; one check is already recorded. */
function Lane() {
  const [done, setDone] = useState<string[]>([]);
  return (
    <CheckLane
      onRecordDone={(id) => setDone([...done, id])}
      onLearn={() => {}}
      rows={[
        {
          packageId: 'pkg-iwi',
          name: 'Inside wall insulation with the loft',
          measures: [
            { id: 'wall-iwi', name: 'Inside wall insulation' },
            { id: 'loft', name: 'Loft insulation' },
          ],
          check: 'A moisture assessment for inside insulation',
          checkCost: 'ev_chk.moisture',
          costGrade: 'estimate',
          ruleIds: ['UK.BS5250.iwi', 'UK.PAS2035.risk'],
          gains: [
            { key: 'saving', label: 'Would save a year', ev: 'ev_chk.gain', delta: 'saving' },
            { key: 'carbon', label: 'Running carbon cut a year', ev: 'ev_chk.carbon' },
          ],
          done: done.includes('pkg-iwi'),
        },
        {
          packageId: 'pkg-pas',
          name: 'Whole house retrofit plan',
          check: 'A PAS 2035 retrofit assessment',
          checkCost: 'ev_chk.pas',
          costGrade: 'secondary',
          done: true,
        },
      ]}
    />
  );
}
export const PossibleAfterACheck: S = { render: () => <Lane /> };
/** Empty lane. */
export const Empty: S = { args: { rows: [] } };
/** The four source grades (R17): estimate and announced always show. */
export const Grades: S = {
  render: () => (
    <p style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ma-3)' }}>
      {GRADES.map((g) => (
        <GradeBadge key={g} grade={g} long />
      ))}
    </p>
  ),
};
