import type { Meta, StoryObj } from '@storybook/react-vite';
import { CORE, type CoreName, FUEL, NETSU } from '../src/tokens/color.ts';
import { FAMILIES, MA, TYPE_SCALE } from '../src/tokens/scale.ts';

const meta: Meta = { title: 'Andon/Tokens' };
export default meta;

const cap = { font: '500 var(--fs-cap)/1.4 var(--font-gothic)', color: 'var(--text-2)' } as const;
const code = { font: '400 var(--fs-cap)/1.4 var(--font-code)', color: 'var(--text-3)' } as const;

export const Colour: StoryObj = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
        gap: 'var(--ma-4)',
      }}
    >
      {(Object.keys(CORE) as CoreName[]).map((k) => (
        <div key={k} style={{ display: 'grid', gap: 'var(--ma-1)' }}>
          <div style={{ height: 56, background: `var(--${k})`, boxShadow: 'inset 0 0 0 1px var(--line)' }} />
          <span style={cap}>{CORE[k].dye}</span>
          <span style={code}>--{k}</span>
        </div>
      ))}
      {Object.keys(FUEL).map((k) => (
        <div key={k} style={{ display: 'grid', gap: 'var(--ma-1)' }}>
          <div style={{ height: 56, background: `var(--${k})` }} />
          <span style={code}>--{k}</span>
        </div>
      ))}
    </div>
  ),
};

export const Netsu: StoryObj = {
  render: () => (
    <div style={{ maxWidth: '40rem' }}>
      <div style={{ height: 40, background: 'var(--netsu)' }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${NETSU.length}, 1fr)`,
          marginTop: 'var(--ma-2)',
        }}
      >
        {NETSU.map((s) => (
          <span key={s.dye} style={cap}>
            {s.dye}
          </span>
        ))}
      </div>
      <p style={{ ...cap, marginTop: 'var(--ma-3)' }}>Modelled, not measured</p>
    </div>
  ),
};

export const Type: StoryObj = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--ma-4)' }}>
      {Object.entries(TYPE_SCALE)
        .reverse()
        .map(([k]) => (
          <div
            key={k}
            style={{
              display: 'grid',
              gridTemplateColumns: '5rem 1fr',
              alignItems: 'baseline',
              gap: 'var(--ma-4)',
            }}
          >
            <span style={code}>--fs-{k}</span>
            <span
              style={{
                font: `${k.startsWith('d') || k.startsWith('h') ? 700 : 400} var(--fs-${k})/var(--lh-${k}) var(--font-${k.startsWith('d') || k.startsWith('h') ? 'mincho' : 'gothic'})`,
              }}
            >
              Here is your home, mended.
            </span>
          </div>
        ))}
      <p style={cap}>
        {Object.values(FAMILIES)
          .map((f) => `${f.family}: ${f.role}`)
          .join(' / ')}
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--ma-2)' }}>
        {MA.map((px, i) => (
          <div key={px} style={{ display: 'grid', justifyItems: 'center', gap: 'var(--ma-1)' }}>
            <div
              style={{
                width: px,
                height: px,
                background: 'var(--paper-sunk)',
                boxShadow: 'inset 0 0 0 1px var(--line)',
              }}
            />
            <span style={code}>ma-{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  ),
};
