/**
 * Slot tokenizer, number formatting and the renderer (AM 3.2, R10, D1).
 */
import { describe, expect, it } from 'vitest';
import { parseDecimal, plain, roundToSig, roundToStep, toDecimal } from '../src/grounding/decimal.ts';
import { formatItem } from '../src/grounding/format.ts';
import { nodesToString, RenderError, renderText } from '../src/grounding/render.ts';
import { SentenceBuffer, sentences } from '../src/grounding/sentences.ts';
import { maskSlots, slot, tokenize } from '../src/grounding/slots.ts';
import { gh1Story } from './helpers.ts';
import type { EvidenceItem } from '@ibasho/core';

const item = (over: Partial<EvidenceItem>): EvidenceItem => ({
  id: 'e1',
  hash: 'ev_x',
  kind: 'cost',
  label: 'x',
  value: 0,
  unit: '',
  subject: {},
  provenance: { source: 'engine', modelVersion: '0', inputsHash: '0' },
  rounding: { mode: 'sig', value: 3 },
  ...over,
});

describe('decimal', () => {
  it('reads doubles exactly through their shortest form', () => {
    expect(plain(toDecimal(0.1))).toBe('0.1');
    expect(plain(toDecimal(1e21))).toBe('1000000000000000000000');
    expect(plain(toDecimal(1.5e-7))).toBe('0.00000015');
    expect(plain(toDecimal(-0))).toBe('0');
  });
  it('rounds half to even on decimal digits, not binary', () => {
    expect(plain(roundToStep(parseDecimal('2.5'), parseDecimal('1')))).toBe('2');
    expect(plain(roundToStep(parseDecimal('3.5'), parseDecimal('1')))).toBe('4');
    expect(plain(roundToStep(parseDecimal('1.005'), parseDecimal('0.01')))).toBe('1');
    expect(plain(roundToStep(parseDecimal('8.25'), parseDecimal('0.5')))).toBe('8');
    expect(plain(roundToStep(parseDecimal('8.75'), parseDecimal('0.5')))).toBe('9');
    expect(plain(roundToSig(parseDecimal('15012.4'), 3))).toBe('15000');
    expect(plain(roundToSig(parseDecimal('2445'), 3))).toBe('2440');
    expect(plain(roundToSig(parseDecimal('-2455'), 3))).toBe('-2460');
  });
});

describe('formatItem', () => {
  it('formats money, energy, carbon, years, points and ranks in en-GB', () => {
    expect(formatItem(item({ value: 1843.27, unit: 'GBP/yr', rounding: { mode: 'step', value: 10 } }))).toBe('£1,840 a year');
    expect(formatItem(item({ value: -96.4, unit: 'GBP/yr', rounding: { mode: 'step', value: 10 } }))).toBe('−£100 a year');
    expect(formatItem(item({ value: -96.4, unit: 'GBP/yr', rounding: { mode: 'step', value: 10 } }), 'abs')).toBe('£100 a year');
    expect(formatItem(item({ value: { lo: 1820, hi: 2640 }, unit: 'GBP' }))).toBe('£1,820 to £2,640');
    expect(formatItem(item({ value: { lo: -243, hi: -178 }, unit: 'GBP/yr', rounding: { mode: 'step', value: 10 } }), 'abs')).toBe('£180 to £240 a year');
    expect(formatItem(item({ value: 15012.4, unit: 'kWh/yr' }))).toBe('15,000 kWh a year');
    expect(formatItem(item({ value: 3071.6, unit: 'kgCO2e/yr' }))).toBe('3,070 kg CO2e a year');
    expect(formatItem(item({ value: 11.3, unit: 'yr', rounding: { mode: 'sig', value: 3 } }), 'approx')).toBe('11.5 years');
    expect(formatItem(item({ value: 1, unit: 'yr', rounding: { mode: 'step', value: 0.5 } }))).toBe('1 year');
    expect(formatItem(item({ value: 54, unit: 'pts', rounding: { mode: 'step', value: 1 } }))).toBe('54 points');
    expect(formatItem(item({ value: 41.3, unit: '%', rounding: { mode: 'step', value: 1 } }))).toBe('41%');
    expect(formatItem(item({ value: 1, unit: 'rank', kind: 'rank' }))).toBe('first');
    expect(formatItem(item({ value: 12, unit: 'rank', kind: 'rank' }))).toBe('number 12');
  });
  it('collapses a range whose ends round to the same value', () => {
    expect(formatItem(item({ value: { lo: 101, hi: 104 }, unit: 'GBP', rounding: { mode: 'step', value: 10 } }))).toBe('£100');
  });
});

describe('tokenize', () => {
  it('parses e, m and f slots with modifiers and spans', () => {
    const t = tokenize('Save [[e:12|abs]] with [[m:loft-300]] ([[f:n1.2]]).');
    expect(t.map((x) => x.t)).toEqual(['text', 'slot', 'text', 'slot', 'text', 'slot', 'text']);
    expect(t[1]).toMatchObject({ kind: 'e', ref: 'e12', mod: 'abs', span: [5, 17] });
    expect(t[3]).toMatchObject({ kind: 'm', ref: 'loft-300' });
    expect(t[5]).toMatchObject({ kind: 'f', ref: 'n1.2' } as never);
  });
  it('accepts [[e:e3]] and [[e:3]] alike and rejects malformed slots', () => {
    expect(tokenize('[[e:e3]]')[0]).toMatchObject({ t: 'slot', ref: 'e3' });
    expect(tokenize('[[e:3]]')[0]).toMatchObject({ t: 'slot', ref: 'e3' });
    for (const bad of ['[[e:x]]', '[[e:3|wild]]', '[[m:Loft_300]]', '[[m:loft|abs]]', '[[q:1]]', '[[e:3', '[[ ]]']) {
      expect(tokenize(bad).some((x) => x.t === 'bad'), bad).toBe(true);
    }
  });
  it('masks slots and builds them', () => {
    expect(maskSlots('a [[e:1]] b', '#')).toBe('a ####### b');
    expect(slot('e', 'e4', 'approx')).toBe('[[e:e4|approx]]');
    expect(slot('m', 'loft')).toBe('[[m:loft]]');
  });
});

describe('sentences', () => {
  it('never splits inside a slot and handles terminators', () => {
    const s = sentences('It pays back in [[e:3|approx]]. Still true? Yes!');
    expect(s.map((x) => x.text)).toEqual(['It pays back in [[e:3|approx]].', 'Still true?', 'Yes!']);
  });
  it('streams complete sentences only', () => {
    const b = new SentenceBuffer();
    expect(b.push('It costs [[e:1]]. It')).toEqual(['It costs [[e:1]].']);
    expect(b.push(' saves')).toEqual([]);
    expect(b.flush()).toEqual(['It saves']);
  });
});

describe('renderText', () => {
  it('turns every slot into a chip bound to the global evidence id', () => {
    const story = gh1Story();
    const id = story.roles['home.bill']!;
    const nodes = renderText(`[[m:loft]] helps. You spend about [[e:${id}|approx]].`, story.bundle);
    expect(nodes[0]).toEqual({ t: 'measure', measureId: 'loft', display: 'Loft insulation' });
    const num = nodes.find((n) => n.t === 'num');
    expect(num).toMatchObject({ t: 'num', display: '£1,840 a year' });
    expect((num as { evidenceId: string }).evidenceId).toMatch(/^ev_/);
    expect(nodesToString(nodes)).toBe('Loft insulation helps. You spend about £1,840 a year.');
  });
  it('fails closed on anything unresolved', () => {
    const story = gh1Story();
    expect(() => renderText('[[e:999]]', story.bundle)).toThrow(RenderError);
    expect(() => renderText('[[m:jacuzzi]]', story.bundle)).toThrow(RenderError);
    expect(() => renderText('[[f:nope]]', story.bundle)).toThrow(RenderError);
    expect(() => renderText('[[e:x]]', story.bundle)).toThrow(RenderError);
  });
});
