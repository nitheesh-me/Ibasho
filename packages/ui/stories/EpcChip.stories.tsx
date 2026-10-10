import { BANDS } from '@ibasho/core';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EpcChip } from '../src/score/EpcChip.tsx';
import { withKitEvidence } from './kit-decorator.tsx';

const meta: Meta<typeof EpcChip> = {
  title: 'Kit/EpcChip',
  component: EpcChip,
  decorators: [withKitEvidence],
};
export default meta;
type S = StoryObj<typeof EpcChip>;

/** Until AC-R1 passes the chip always shows the band either side. */
export const WithSpread: S = { args: { band: 'D' } };
/** Opens the rating evidence. */
export const WithEvidence: S = { args: { band: 'C', ev: 'ev_score.now' } };
/** After AC-R1: the spread may go. */
export const Validated: S = { args: { band: 'C', bandValidated: true } };
/** Every band, small. */
export const AllBands: S = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ma-3)' }}>
      {BANDS.map((b) => (
        <EpcChip key={b} band={b} size="sm" />
      ))}
    </div>
  ),
};
