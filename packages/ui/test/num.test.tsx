// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvidenceProvider, staticEvidence } from '../src/evidence/context.tsx';
import { Num } from '../src/num/Num.tsx';
import { node } from './helpers.ts';

afterEach(cleanup);

const saving = node('money.bill_saving', { fixed: '34012000000', unit: 'micro-pence/yr' }, 'micro-pence/yr', {
  mode: 'step',
  value: 1e9,
});
const heat = node(
  'heat.qh.total',
  { fixed: '9876543', unit: 'Wh' },
  'Wh',
  { mode: 'sig', value: 3 },
  'modelled',
);
const broken = node(
  'acct.saving.gas',
  { fixed: '-3104000', unit: 'Wh' },
  'Wh',
  { mode: 'sig', value: 2 },
  'cracked',
);

function withEvidence(ui: React.ReactNode, open = vi.fn()) {
  render(<EvidenceProvider source={staticEvidence([saving, heat, broken], open)}>{ui}</EvidenceProvider>);
  return open;
}

describe('Num', () => {
  it('renders an evidence chip with tabular parts, unit and seal', () => {
    withEvidence(<Num ev="ev_money.bill_saving" />);
    const chip = screen.getByRole('button');
    expect(chip.dataset.num).toBe('');
    expect(chip.dataset.ev).toBe('ev_money.bill_saving');
    expect(chip.dataset.seal).toBe('checked');
    expect(chip.querySelector('.ib-num__prefix')!.textContent).toBe('£');
    expect(chip.querySelector('.ib-num__digits')!.textContent).toBe('340');
    expect(chip.querySelector('.ib-num__unit')!.textContent).toBe(' a year');
    expect(chip.querySelector('.ib-seal[data-seal="checked"] svg')).not.toBeNull();
    expect(chip.getAttribute('aria-label')).toBe(
      '340 pounds a year. Checked by the mirror checker, every row. Open evidence.',
    );
  });

  it('carries its "Not proved" line as the description', () => {
    withEvidence(<Num ev="ev_heat.qh.total" />);
    const chip = screen.getByRole('button');
    const note = document.getElementById(chip.getAttribute('aria-describedby')!)!;
    expect(note.textContent).toBe('Modelled. Not proved: that our energy model matches your home exactly.');
    expect(chip.dataset.seal).toBe('modelled');
  });

  it('shows a failed check marked, never hidden', () => {
    withEvidence(<Num ev="ev_acct.saving.gas" signed delta="saving" />);
    const chip = screen.getByRole('button');
    expect(chip.dataset.seal).toBe('cracked');
    expect(chip.dataset.delta).toBe('saving');
    expect(chip.querySelector('.ib-num__value')!.textContent).toBe('−3,100 kWh');
    expect(chip.getAttribute('aria-label')).toContain('Check failed');
  });

  it('opens the evidence drawer from the chip', () => {
    const open = withEvidence(<Num ev="ev_heat.qh.total" />);
    fireEvent.click(screen.getByRole('button'));
    expect(open).toHaveBeenCalledWith('ev_heat.qh.total', screen.getByRole('button'));
  });

  it('accepts the pressing override during recompute', () => {
    withEvidence(<Num ev="ev_money.bill_saving" seal="pressing" />);
    expect(screen.getByRole('button').dataset.seal).toBe('pressing');
  });

  it('never renders a bare number when the evidence is missing', () => {
    render(<Num ev="ev_nowhere" />);
    const chip = screen.getByRole('img', { name: 'Evidence missing' });
    expect(chip.dataset.ev).toBe('ev_nowhere');
    expect(chip.textContent).not.toMatch(/\d/);
  });

  it('keeps every digit inside a [data-num] chip (M0-5 audit shape)', () => {
    const { container } = render(
      <EvidenceProvider source={staticEvidence([saving, heat])}>
        <p data-numeric="">
          Bills fall by <Num ev="ev_money.bill_saving" />. Heating needs <Num ev="ev_heat.qh.total" />.
        </p>
      </EvidenceProvider>,
    );
    const p = container.querySelector('[data-numeric]')!;
    const walker = document.createTreeWalker(p, 4 /* NodeFilter.SHOW_TEXT */);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (/\d/.test(t.textContent ?? '')) expect(t.parentElement!.closest('[data-num]')).not.toBeNull();
    }
    expect(p.querySelectorAll('[data-num]')).toHaveLength(2);
  });

  it('re-settles the digits when the value changes', () => {
    const a = node('x', { fixed: '1000', unit: 'Wh' }, 'Wh', { mode: 'step', value: 1000 });
    const b = node('x', { fixed: '2000', unit: 'Wh' }, 'Wh', { mode: 'step', value: 1000 });
    const { rerender } = render(
      <EvidenceProvider source={staticEvidence([a])}>
        <Num ev="ev_x" />
      </EvidenceProvider>,
    );
    expect(document.querySelector('.ib-num__value')!.hasAttribute('data-settle')).toBe(false);
    rerender(
      <EvidenceProvider source={staticEvidence([b])}>
        <Num ev="ev_x" />
      </EvidenceProvider>,
    );
    const v = document.querySelector('.ib-num__value')!;
    expect(v.textContent).toBe('2 kWh');
    expect(v.hasAttribute('data-settle')).toBe(true);
  });
});
