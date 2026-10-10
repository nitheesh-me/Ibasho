// @vitest-environment happy-dom
import type { RenderedNarration } from '@ibasho/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckLane } from '../src/checklane/CheckLane.tsx';
import { EvidenceProvider } from '../src/evidence/context.tsx';
import { FuelBars, isSaving } from '../src/fuel/FuelBars.tsx';
import { FUTURE_ORDER, Futures } from '../src/futures/Futures.tsx';
import { GradeBadge, isFlagged } from '../src/grade/GradeBadge.tsx';
import { MeasureCard } from '../src/measure/MeasureCard.tsx';
import { MonthRing, monthAt, monthKey } from '../src/month/MonthRing.tsx';
import { NarratorStrip, sentencesFromRendered } from '../src/narrator/NarratorStrip.tsx';
import { magnitude } from '../src/num/magnitude.ts';
import { EpcChip, epcLabel, epcSpread } from '../src/score/EpcChip.tsx';
import { SCORE_LINE, ScoreGroups } from '../src/score/ScoreGroups.tsx';
import { nearestSnap, Sheet } from '../src/sheet/Sheet.tsx';
import { Slider, sliderKey, stopAt } from '../src/slider/Slider.tsx';
import { WhyNot } from '../src/whynot/WhyNot.tsx';
import { CARDS, DO_NOTHING } from '../stories/Futures.stories.tsx';
import { kitSource, monthIds } from '../stories/kit-evidence.ts';

afterEach(cleanup);

function show(ui: ReactNode, open = vi.fn()) {
  const r = render(<EvidenceProvider source={{ ...kitSource, open }}>{ui}</EvidenceProvider>);
  return { ...r, open };
}

/** AC-E1 at the component level: no digit outside a `Num` (identifiers in `code` aside). */
function bareDigits(root: HTMLElement): string[] {
  const out: string[] = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t = walk.nextNode(); t; t = walk.nextNode()) {
    const el = t.parentElement;
    if (!el || el.closest('[data-num], code, [aria-hidden="true"], .ib-sr')) continue;
    if (/\d/.test(t.textContent ?? '')) out.push(t.textContent ?? '');
  }
  return out;
}

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

describe('magnitude', () => {
  it('reads points, fixed decimals and ranges for drawing', () => {
    expect(magnitude(kitSource.node('ev_score.now'))).toMatchObject({ mid: 58, range: false });
    expect(magnitude(kitSource.node('ev_score.band'))).toEqual({ lo: 54, hi: 66, mid: 60, range: true });
    expect(magnitude(kitSource.node('ev_fb.elec'))?.mid).toBe(1412000);
    expect(magnitude(undefined)).toBeUndefined();
  });
});

describe('Sheet', () => {
  it('snaps to the nearest point and offers a button for each', () => {
    expect(nearestSnap(0.1)).toBe('peek');
    expect(nearestSnap(0.6)).toBe('half');
    expect(nearestSnap(0.85)).toBe('full');
    const onSnap = vi.fn();
    const onClose = vi.fn();
    show(
      <Sheet open title="Loft" onClose={onClose} onSnapChange={onSnap} placement="bottom">
        Body
      </Sheet>,
    );
    const sheet = screen.getByRole('dialog', { name: 'Loft' });
    expect(sheet.getAttribute('aria-modal')).toBe('false');
    expect(sheet.dataset.snap).toBe('half');
    fireEvent.click(screen.getByRole('button', { name: 'Full' }));
    expect(onSnap).toHaveBeenCalledWith('full');
    expect(sheet.dataset.snap).toBe('full');
    fireEvent.keyDown(sheet, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('is inert and hidden when closed', () => {
    show(
      <Sheet open={false} title="Loft">
        Body
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('NarratorStrip', () => {
  it('marks the plain narrator and keeps numbers as chips without seals', () => {
    const { container } = show(
      <NarratorStrip
        sentences={[
          {
            key: 'a',
            parts: ['Gas falls by ', { ev: 'ev_acct.saving.gas', signed: true, delta: 'saving' }, '.'],
          },
        ]}
      />,
    );
    expect(screen.getByText('Plain narrator')).toBeTruthy();
    const chip = container.querySelector('[data-num]') as HTMLElement;
    expect(chip.classList.contains('ib-num--plain')).toBe(true);
    // R11: no seal glyph, no seal note and no seal in the spoken name.
    expect(chip.querySelector('.ib-num__seal, .ib-num__note')).toBeNull();
    expect(chip.getAttribute('aria-label')).not.toMatch(/Checked|Modelled|Cracked|Unverified/);
    expect(bareDigits(container)).toEqual([]);
  });

  it('splits rendered narration into sentences', () => {
    const r = {
      sections: [
        {
          key: 'overview',
          origin: 'llm',
          nodes: [
            { t: 'text', s: 'Your home leaks heat. It loses ' },
            { t: 'num', evidenceId: 'ev_fabric.loss_now', display: '2,100 W' },
            { t: 'text', s: ' on a cold night.' },
          ],
        },
      ],
    } as unknown as RenderedNarration;
    const s = sentencesFromRendered(r);
    expect(s).toHaveLength(2);
    expect(s[1]?.parts).toContainEqual({ ev: 'ev_fabric.loss_now' });
    expect(s.every((x) => x.origin === 'llm')).toBe(true);
  });
});

describe('ScoreGroups and EpcChip', () => {
  it('shows a number, four groups, the typical household line and no letter', () => {
    const { container } = show(<ScoreGroups score="ev_score.now" groups={groups} indicators={indicators} />);
    expect(container.querySelectorAll('.ib-bar[data-group]')).toHaveLength(4);
    expect(screen.getByText(SCORE_LINE)).toBeTruthy();
    expect(container.querySelector('.ib-score')?.textContent).not.toMatch(/\b[A-G]\b(?! )/);
    expect(bareDigits(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Show all seven parts' }));
    expect(container.querySelectorAll('[data-indicator]')).toHaveLength(7);
  });

  it('turns into a band while material fields are unknown (AC-H2)', () => {
    const onSharpen = vi.fn();
    const { container } = show(
      <ScoreGroups score="ev_score.band" groups={groups} materialUnknown onSharpen={onSharpen} />,
    );
    expect(container.querySelector('.ib-score')?.hasAttribute('data-band')).toBe(true);
    expect(container.querySelector('.ib-score__strip')?.hasAttribute('data-range')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Sharpen' }));
    expect(onSharpen).toHaveBeenCalled();
  });

  it('labels the chip Estimated EPC and shows the spread until validated (F7)', () => {
    expect(epcSpread('A')).toEqual({ lo: 'A', hi: 'B' });
    expect(epcSpread('D')).toEqual({ lo: 'C', hi: 'E' });
    expect(epcLabel('D', false)).toBe('Estimated EPC band D, could be C to E');
    show(<EpcChip band="D" />);
    const chip = screen.getByRole('img', { name: 'Estimated EPC band D, could be C to E' });
    expect(chip.hasAttribute('data-spread')).toBe(true);
    cleanup();
    show(<EpcChip band="C" bandValidated />);
    expect(screen.getByRole('img', { name: 'Estimated EPC band C' }).hasAttribute('data-spread')).toBe(false);
  });

  it('opens the band evidence', () => {
    const { open } = show(<EpcChip band="C" ev="ev_score.now" />);
    fireEvent.click(screen.getByRole('button'));
    expect(open).toHaveBeenCalledWith('ev_score.now', expect.any(HTMLElement));
  });
});

describe('Futures', () => {
  it('keeps the fixed order, lists negatives on every card and adds the fourth line (AC-B1, AC-B3)', () => {
    const onChoose = vi.fn();
    const { container } = show(
      <Futures cards={[...CARDS].reverse()} doNothing={DO_NOTHING} onChoose={onChoose} />,
    );
    const picks = [...container.querySelectorAll<HTMLElement>('article.ib-future')].map(
      (a) => a.dataset.pick,
    );
    expect(picks).toEqual(FUTURE_ORDER.map((f) => f.key));
    for (const card of container.querySelectorAll('article.ib-future')) {
      expect(card.querySelector('.ib-negatives'), 'every card lists what gets worse').not.toBeNull();
    }
    expect(
      within(container.querySelector('[data-pick="leastUpfront"]') as HTMLElement).getByText(
        'Nothing we measure gets worse.',
      ),
    ).toBeTruthy();
    const nothing = container.querySelector('[data-do-nothing]') as HTMLElement;
    expect(within(nothing).getByRole('heading', { name: 'If nothing is done' })).toBeTruthy();
    expect(nothing.querySelectorAll('[data-effect]')).toHaveLength(2);
    expect(nothing.querySelector('.ib-grade[data-grade="estimate"]')).not.toBeNull();
    expect(nothing.querySelectorAll('[data-negative]').length).toBeGreaterThan(0);
    expect(bareDigits(container)).toEqual([]);
    fireEvent.click(
      within(container.querySelector('[data-pick="bestReturn"]') as HTMLElement).getByRole('button', {
        name: 'Make this my plan',
      }),
    );
    expect(onChoose).toHaveBeenCalledWith('bestReturn');
  });

  it('shows the fourth line as pending and empty picks honestly', () => {
    const { container } = show(<Futures cards={[CARDS[0]!]} doNothing={null} />);
    expect(container.querySelector('[data-do-nothing]')?.hasAttribute('data-pending')).toBe(true);
    expect(container.querySelectorAll('article[data-empty]')).toHaveLength(2);
  });
});

describe('MeasureCard', () => {
  it('names the check, the reason and the state in words', () => {
    const onToggle = vi.fn();
    show(
      <>
        <MeasureCard
          measureId="loft"
          name="Loft insulation"
          cost="ev_m.loft"
          state="available"
          onToggle={onToggle}
        />
        <MeasureCard
          measureId="wall-iwi"
          name="Inside wall insulation"
          state="needs-check"
          check="a moisture assessment for inside insulation"
          ruleId="UK.BS5250.iwi"
        />
        <MeasureCard measureId="pv" name="Solar panels" state="blocked" reason="The roof faces north." />
      </>,
    );
    expect(screen.getByText('Needs a moisture assessment for inside insulation.')).toBeTruthy();
    expect(screen.getByText('Possible after a check')).toBeTruthy();
    expect(screen.getByText('The roof faces north.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add to this scenario' }));
    expect(onToggle).toHaveBeenCalledWith('loft', true);
  });
});

describe('FuelBars', () => {
  it('splits savings left and increases right, with a table toggle', () => {
    expect(isSaving('gas', -1)).toBe(true);
    expect(isSaving('export', -1)).toBe(false);
    const { container } = show(
      <FuelBars
        summary="Gas falls; electricity rises."
        rows={[
          { fuel: 'gas', ev: 'ev_fb.gas' },
          { fuel: 'electricity', ev: 'ev_fb.elec' },
          { fuel: 'oil', ev: 'ev_fb.oil' },
        ]}
      />,
    );
    const dir = (f: string) =>
      (container.querySelector(`[data-fuel="${f}"]`) as HTMLElement).dataset.direction;
    expect([dir('gas'), dir('electricity'), dir('oil')]).toEqual(['saving', 'increase', 'none']);
    expect(container.querySelector('[data-fuel="gas"]')?.hasAttribute('data-range')).toBe(true);
    expect(bareDigits(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(container.querySelector('table[data-table-alt]')).not.toBeNull();
  });
});

describe('Slider', () => {
  it('maps keys and positions to stops', () => {
    expect(sliderKey('ArrowRight', 0, 4)).toBe(1);
    expect(sliderKey('ArrowLeft', 0, 4)).toBe(0);
    expect(sliderKey('End', 0, 4)).toBe(3);
    expect(sliderKey('PageUp', 0, 8)).toBe(2);
    expect(sliderKey('a', 0, 4)).toBeUndefined();
    expect(stopAt(0.49, 4)).toBe(1);
    expect(stopAt(2, 4)).toBe(3);
  });

  it('steps with keys and buttons and speaks the value in words', () => {
    const onChange = vi.fn();
    const stops = [0, 1, 2, 3].map((i) => ({ key: `l${i}`, ev: `ev_loft.${i}` as const }));
    const { container } = show(<Slider label="Loft depth" stops={stops} onChange={onChange} />);
    const thumb = screen.getByRole('slider', { name: 'Loft depth' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('0');
    expect(thumb.getAttribute('aria-valuetext')).not.toMatch(/^\s*$/);
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(1, stops[1]);
    expect(thumb.getAttribute('aria-valuenow')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(thumb.getAttribute('aria-valuenow')).toBe('2');
    expect(container.querySelector('.ib-kumiko__value [data-num]')?.getAttribute('data-ev')).toBe(
      'ev_loft.2',
    );
    expect(bareDigits(container)).toEqual([]);
  });
});

describe('WhyNot', () => {
  it('gives each measure a reason chip, actionable reasons first', () => {
    const onRestore = vi.fn();
    const { container } = show(
      <WhyNot
        onRestore={onRestore}
        items={[
          { measureId: 'pv', name: 'Solar panels', reason: 'rule', ruleId: 'UK.PV.orientation' },
          { measureId: 'glazing-double', name: 'Double glazing', reason: 'memory' },
          { measureId: 'mvhr', name: 'Ventilation', reason: 'budget', cost: 'ev_whynot.ewi' },
          { measureId: 'floor', name: 'Floor insulation', reason: 'witness', witness: 'Loft insulation' },
        ]}
      />,
    );
    const rows = [...container.querySelectorAll<HTMLElement>('li[data-reason]')].map((r) => r.dataset.reason);
    expect(rows).toEqual(['memory', 'budget', 'witness', 'rule']);
    expect(screen.getByText('UK.PV.orientation')).toBeTruthy();
    expect(screen.getByText('Loft insulation does better on cost, return and carbon.')).toBeTruthy();
    expect(bareDigits(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Bring it back' }));
    expect(onRestore).toHaveBeenCalledWith('glazing-double');
  });
});

describe('CheckLane and GradeBadge', () => {
  it('names the check, its cost grade and records it done (R22, R17)', () => {
    expect(isFlagged('estimate')).toBe(true);
    expect(isFlagged('primary')).toBe(false);
    const onDone = vi.fn();
    const { container } = show(
      <CheckLane
        onRecordDone={onDone}
        rows={[
          {
            packageId: 'pkg-iwi',
            name: 'Inside wall insulation',
            check: 'A moisture assessment for inside insulation',
            checkCost: 'ev_chk.moisture',
            costGrade: 'estimate',
            ruleIds: ['UK.BS5250.iwi'],
          },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Possible after a check' })).toBeTruthy();
    expect(screen.getByText('A moisture assessment for inside insulation')).toBeTruthy();
    expect(container.querySelector('.ib-grade[data-grade="estimate"][data-flagged]')).not.toBeNull();
    expect(bareDigits(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'The check is done' }));
    expect(onDone).toHaveBeenCalledWith('pkg-iwi');
  });

  it('renders every grade with a word', () => {
    show(<GradeBadge grade="announced" />);
    expect(screen.getByText('Announced')).toBeTruthy();
  });
});

describe('MonthRing', () => {
  it('wraps round the year and finds the month under a point', () => {
    expect(monthKey('ArrowRight', 11)).toBe(0);
    expect(monthKey('ArrowLeft', 0)).toBe(11);
    expect(monthKey('Home', 5)).toBe(0);
    // ARIA slider: Up and PageUp go forward like Right.
    expect(monthKey('ArrowUp', 0)).toBe(1);
    expect(monthKey('PageUp', 11)).toBe(2);
    expect(monthAt(0, -10)).toBe(0);
    expect(monthAt(10, 0)).toBe(3);
    expect(monthAt(0, 10)).toBe(6);
    expect(monthAt(-1, -10)).toBe(11);
    expect(monthAt(-10, 0.1)).toBe(8);
  });

  it('moves one month per arrow key and reads the month aloud', () => {
    const onMonth = vi.fn();
    const { container } = show(
      <MonthRing
        summary="Gas peaks in January."
        series={[
          { fuel: 'gas', months: monthIds('mo.gas') },
          { fuel: 'electricity', months: monthIds('mo.elec') },
        ]}
        onMonthChange={onMonth}
      />,
    );
    const ring = screen.getByRole('slider', { name: 'Month' });
    expect(ring.getAttribute('aria-valuetext')).toMatch(/^January, Gas /);
    fireEvent.keyDown(ring, { key: 'ArrowLeft' });
    expect(onMonth).toHaveBeenLastCalledWith(11);
    expect(screen.getByText('December')).toBeTruthy();
    expect(container.querySelectorAll('[data-wedge]')).toHaveLength(12);
    expect(container.querySelector('.ib-monthring__readout [data-ev="ev_mo.gas.m11"]')).not.toBeNull();
    expect(bareDigits(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(container.querySelectorAll('table[data-table-alt] tbody tr')).toHaveLength(12);
  });
});
