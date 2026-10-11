// @vitest-environment happy-dom
import type { StageBarState } from '@ibasho/core';
import { STUDIO_STAGES } from '@ibasho/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvidenceProvider, staticEvidence } from '../src/evidence/context.tsx';
import { hexToLinear, linearToOklab } from '../src/tokens/oklch.ts';
import {
  EndUseBar,
  EuiGauge,
  ModeTabs,
  overallFraction,
  PreviewStamp,
  RAMPS,
  RatingLadder,
  rampColor,
  StageBar,
  stepLevel,
  stepState,
  TypeCards,
} from '../src/v3/index.ts';
import { node } from './helpers.ts';

afterEach(cleanup);

const nodes = [
  node('eui', { interval: { lo: 128, hi: 171 } }, 'kWh/m2.yr', { mode: 'sig', value: 2 }, 'preview'),
  node('target', { float: 140 }, 'kWh/m2.yr', { mode: 'sig', value: 3 }, 'preview'),
  node('cool', { fixed: '410000000', unit: 'Wh' }, 'Wh', { mode: 'step', value: 1e6 }, 'preview'),
  node('light', { fixed: '90000000', unit: 'Wh' }, 'Wh', { mode: 'step', value: 1e6 }, 'preview'),
  node('pv', { fixed: '-60000000', unit: 'Wh' }, 'Wh', { mode: 'step', value: 1e6 }, 'preview'),
  node('sav', { interval: { lo: 9, hi: 24 } }, '%', { mode: 'sig', value: 2 }, 'preview'),
];
const src = staticEvidence(nodes);

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

const bar = (
  over: Partial<Record<string, Partial<StageBarState['stages'][number]>>> = {},
): StageBarState => ({
  jobId: 'j1',
  generation: 1,
  stages: STUDIO_STAGES.map((id) => ({ id, status: 'queued', fraction: 0, preview: true, ...over[id] })),
});

describe('StageBar (DS 13.5)', () => {
  it('names every stage, shows Preview, and offers Cancel only after 1 s', () => {
    vi.useFakeTimers();
    const onCancel = vi.fn();
    render(
      <StageBar
        state={bar({
          geometry: { status: 'done', fraction: 1, tier: 'final' },
          sun: { status: 'running', fraction: 0.4, tier: 'rough' },
        })}
        message="Sun hours: rough now"
        onCancel={onCancel}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getByLabelText('Sun: running, rough result')).toBeTruthy();
    expect(screen.getByText('Preview')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('overall progress ignores skipped stages', () => {
    const s = bar({
      geometry: { status: 'skipped' },
      sun: { status: 'done', fraction: 1 },
      radiation: { status: 'running', fraction: 0.5 },
    });
    expect(overallFraction(s)).toBeCloseTo(1.5 / 6, 6);
  });
});

describe('ladder, modes and marks', () => {
  it('steps the scale ladder and clamps', () => {
    expect(stepLevel('building', 1)).toBe('floor');
    expect(stepLevel('city', -1)).toBe('city');
    expect(stepLevel('room', 1)).toBe('room');
  });
  it('mode tabs move with arrow keys', () => {
    const onChange = vi.fn();
    render(<ModeTabs mode="look" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('choose');
  });
  it('rating steps read likely, possible or not yet against a range', () => {
    expect(stepState(5, 9, 24)).toBe('likely');
    expect(stepState(15, 9, 24)).toBe('possible');
    expect(stepState(30, 9, 24)).toBe('not-yet');
  });
  it('the Preview stamp is a word, never a seal', () => {
    const { container } = render(<PreviewStamp />);
    expect(container.querySelector('.ib-seal')).toBeNull();
    expect(container.textContent).toContain('Preview');
  });
});

describe('ramps (DS 13.2)', () => {
  it('every ramp but the diverging one is lightness monotone', () => {
    for (const r of Object.values(RAMPS)) {
      if (r.diverging) continue;
      const L = Array.from(
        { length: 11 },
        (_, i) => linearToOklab(hexToLinear(rampColor(r.name, i / 10)))[0],
      );
      for (let i = 1; i < L.length; i++)
        expect(L[i] as number, `${r.name} at ${i}`).toBeGreaterThan((L[i - 1] as number) - 1e-6);
    }
  });
});

describe('results marks (AC-E1, AC-PG3)', () => {
  it('EUI gauge, end-use bar and rating ladder put every digit in a Num, sealed preview', () => {
    const { container } = render(
      <EvidenceProvider source={src}>
        <EuiGauge
          eui="ev_eui"
          target={{ ev: 'ev_target', label: 'Standard design' }}
          scaleMax={260}
          preview
        />
        <EndUseBar
          rows={[
            { use: 'cooling', ev: 'ev_cool' },
            { use: 'lighting', ev: 'ev_light' },
            { use: 'pv', ev: 'ev_pv' },
          ]}
          preview
        />
        <RatingLadder
          savings="ev_sav"
          rows={[
            {
              scheme: 'GHMC stars',
              edition: '2026',
              steps: [
                { level: 'One star', atLeast: 5 },
                { level: 'Three stars', atLeast: 15 },
              ],
              applicability: 'adoption-unconfirmed',
            },
          ]}
        />
      </EvidenceProvider>,
    );
    expect(bareDigits(container)).toEqual([]);
    const nums = [...container.querySelectorAll('[data-num]')];
    expect(nums.length).toBeGreaterThan(4);
    expect(nums.every((n) => n.getAttribute('data-seal') === 'preview')).toBe(true);
    expect(container.querySelector('.ib-num .ib-seal')).toBeNull();
    expect(container.textContent).not.toMatch(/compliant|certified/i);
  });
  it('type cards offer all eight types', () => {
    const onChange = vi.fn();
    render(<TypeCards value="office" onChange={onChange} />);
    expect(screen.getAllByRole('button')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: /Hospital/ }));
    expect(onChange).toHaveBeenCalledWith('hospital');
  });
});

describe('Andon controls (no native range or select)', () => {
  it('Range steps by key and button and commits once', async () => {
    const { Range } = await import('../src/v3/index.ts');
    const onChange = vi.fn();
    render(
      <Range
        label="Window share"
        value={30}
        min={0}
        max={90}
        step={5}
        onChange={onChange}
        format={(v) => `${v}%`}
      />,
    );
    const s = screen.getByRole('slider', { name: 'Window share' });
    fireEvent.keyDown(s, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(35);
    fireEvent.click(screen.getByRole('button', { name: 'Less Window share' }));
    expect(onChange).toHaveBeenLastCalledWith(30);
    expect(document.querySelector('input[type="range"]')).toBeNull();
  });
  it('SunScrubber jumps to sunrise and sunset with Home and End', async () => {
    const { SunScrubber } = await import('../src/v3/index.ts');
    const onChange = vi.fn();
    render(<SunScrubber minutes={720} sunriseMin={370} sunsetMin={1110} onChange={onChange} />);
    const s = screen.getByRole('slider', { name: 'Time of day' });
    fireEvent.keyDown(s, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(370);
    fireEvent.keyDown(s, { key: 'PageUp' });
    expect(onChange).toHaveBeenLastCalledWith(780);
  });
  it('Picker opens a listbox and picks with the keyboard', async () => {
    const { Picker } = await import('../src/v3/index.ts');
    const onChange = vi.fn();
    render(
      <Picker
        label="Function"
        value="lab"
        options={[
          { value: 'lab', label: 'Lab' },
          { value: 'office', label: 'Office' },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Lab/ }));
    const list = screen.getByRole('listbox', { name: 'Function' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('office');
    expect(document.querySelector('select')).toBeNull();
  });
});

describe('chip active state (review B-B1)', () => {
  it('active chips keep a readable label: ink text on paper-sunk, never ink on ink', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(`${process.cwd()}/src/styles/v3.css`, 'utf8');
    const rule = css.slice(
      css.indexOf('.ib-chip[aria-pressed="true"],'),
      css.indexOf('}', css.indexOf('.ib-chip[aria-pressed="true"],')),
    );
    expect(rule).toContain('background: var(--paper-sunk)');
    expect(rule).toContain('color: var(--ink)');
    const { CORE } = await import('../src/tokens/color.ts');
    const { contrast } = await import('../src/tokens/oklch.ts');
    for (const t of ['hiru', 'yoru'] as const)
      expect(contrast(CORE.ink[t], CORE['paper-sunk'][t])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('fonts and menu (B-m11, B-m12)', () => {
  it('loadAndonFonts asks for the above-the-fold faces and never waits past the cap', async () => {
    const { loadAndonFonts, ABOVE_THE_FOLD } = await import('../src/index.ts');
    const asked: string[] = [];
    await loadAndonFonts(5, {
      load: (f: string) => {
        asked.push(f);
        return Promise.resolve();
      },
    });
    expect(asked).toEqual([...ABOVE_THE_FOLD]);
    const t = Date.now();
    await loadAndonFonts(20, { load: () => new Promise(() => undefined) });
    expect(Date.now() - t).toBeLessThan(1000);
  });
  it('Menu opens, moves with arrows and picks', async () => {
    const { Menu } = await import('../src/v3/index.ts');
    const onPick = vi.fn();
    render(
      <Menu
        label="More for Campus"
        items={[
          { id: 'rename', label: 'Rename' },
          { id: 'remove', label: 'Remove', danger: true },
        ]}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More for Campus' }));
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('remove');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
