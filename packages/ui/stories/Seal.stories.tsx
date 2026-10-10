import type { Meta, StoryObj } from '@storybook/react-vite';
import { Seal } from '../src/seal/Seal.tsx';

const meta: Meta<typeof Seal> = { title: 'Andon/Seal', component: Seal };
export default meta;
type S = StoryObj<typeof Seal>;

const sizes = ['sm', 'md', 'lg', 'xl'] as const;
const cell = {
  display: 'grid',
  justifyItems: 'center',
  alignContent: 'end',
  gap: 'var(--ma-3)',
  minHeight: 120,
} as const;
const cap = {
  font: '500 var(--fs-cap)/1.4 var(--font-gothic)',
  letterSpacing: '0.06em',
  color: 'var(--text-2)',
  textAlign: 'center',
} as const;

/** Every level at every size. Shape carries the level as well as colour. */
export const Levels: S = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--ma-5)' }}>
      {sizes.map((size) => (
        <div
          key={size}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))',
            gap: 'var(--ma-4)',
          }}
        >
          <div style={cell}>
            <Seal
              level="proved"
              size={size}
              claim={{ id: 'nothing-better-hidden', sentence: 'Nothing better is hidden' }}
              notProved="that our energy model matches your home exactly."
            />
            <span style={cap}>Proved</span>
          </div>
          <div style={cell}>
            <Seal level="checked" size={size} check={{ rung: 'lean-native', coverage: 'all' }} />
            <span style={cap}>Checked</span>
          </div>
          <div style={cell}>
            <Seal level="modelled" size={size} />
            <span style={cap}>Modelled</span>
          </div>
          <div style={cell}>
            <Seal level="cracked" size={size} />
            <span style={cap}>Check failed</span>
          </div>
          <div style={cell}>
            <Seal level="unverified" size={size} />
            <span style={cap}>Unverified rule</span>
          </div>
          <div style={cell}>
            <Seal level="pressing" size={size} />
            <span style={cap}>Checking</span>
          </div>
        </div>
      ))}
    </div>
  ),
};

/** With its label, as in the evidence drawer's Check tab. */
export const Labelled: S = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--ma-4)' }}>
      <Seal level="checked" showLabel check={{ rung: 'lean-native', coverage: 'all' }} />
      <Seal level="checked" showLabel check={{ rung: 'mirror', coverage: 'sample' }} />
      <Seal level="modelled" showLabel />
      <Seal level="cracked" showLabel />
    </div>
  ),
};

/** The hanko press (reload the story to replay). */
export const Press: S = {
  args: { level: 'checked', size: 'xl', press: true, check: { rung: 'lean-native', coverage: 'all' } },
};
