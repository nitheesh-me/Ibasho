import type { Meta, StoryObj } from '@storybook/react-vite';
import { EpcChip } from '../src/score/EpcChip.tsx';
import { ScoreGroups } from '../src/score/ScoreGroups.tsx';
import { withKitEvidence } from './kit-decorator.tsx';

const meta: Meta<typeof ScoreGroups> = {
  title: 'Kit/ScoreGroups',
  component: ScoreGroups,
  decorators: [withKitEvidence],
};
export default meta;
type S = StoryObj<typeof ScoreGroups>;

const groups = [
  { id: 'fabric-heating' as const, ev: 'ev_score.g.fabric' as const },
  { id: 'running-cost' as const, ev: 'ev_score.g.cost' as const },
  { id: 'carbon' as const, ev: 'ev_score.g.carbon' as const },
  { id: 'comfort' as const, ev: 'ev_score.g.comfort' as const },
];
const indicators = (['F', 'H', 'A', 'E', 'C', 'R', 'T'] as const).map((id) => ({
  id,
  ev: `ev_score.i.${id}` as const,
}));

/** A known score: numeral, four group bars, seven parts on tap. */
export const Known: S = { args: { score: 'ev_score.now', groups, indicators } };
/** Material fields unknown: the score is a band with the likely dot, and Sharpen is offered. */
export const Band: S = {
  args: {
    score: 'ev_score.band',
    groups: groups.map((g) =>
      g.id === 'fabric-heating' ? { ...g, ev: 'ev_score.g.fabric.band' as const } : g,
    ),
    indicators,
    materialUnknown: true,
    onSharpen: () => {},
  },
};
/** All seven parts open. */
export const SevenParts: S = { args: { score: 'ev_score.now', groups, indicators, defaultOpen: true } };
/** Beside the estimated EPC chip, as on the home screen: number and letter never mix. */
export const WithEpc: S = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ma-6)', alignItems: 'start' }}>
      <ScoreGroups score="ev_score.now" groups={groups} indicators={indicators} />
      <EpcChip band="D" />
    </div>
  ),
};
