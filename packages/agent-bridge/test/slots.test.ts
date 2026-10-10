import { describe, expect, it } from 'vitest';
import { checkSlotted, parseSlots } from '../src/index.ts';

describe('slot pre-check (G2 at the boundary)', () => {
  it('parses slots with formats', () => {
    expect(parseSlots('a [[e:ev_1a|approx]] b [[m:loft]] [[f:3]]')).toEqual([
      { kind: 'e', ref: 'ev_1a', format: 'approx', span: [2, 20] },
      { kind: 'm', ref: 'loft', span: [23, 33] },
      { kind: 'f', ref: '3', span: [34, 41] },
    ]);
  });

  it.each([
    ['digits', 'Saves 120 a year.'],
    ['percent', 'Cuts gas by a lot %'],
    ['non-latin digits', 'Saves ١٢٠ a year.'],
    ['fraction', 'About ½ of the heat.'],
    ['number word', 'It halves the bill, about half.'],
    ['twice', 'Twice as warm.'],
    ['seventy', 'Seventy pounds.'],
    ['per cent', 'Ten per cent less.'],
  ])('refuses %s', (_name, text) => {
    expect(checkSlotted(text).ok).toBe(false);
  });

  it.each([
    'Topping up [[m:loft]] saves [[e:ev_3f2a|approx]] a year.',
    'One of the cheapest changes is [[m:draught]].',
    'Double glazing is not allowed here; the first step is the loft.',
    'A third-party survey would settle it.',
  ])('accepts %s', (text) => {
    expect(checkSlotted(text)).toMatchObject({ ok: true, issues: [] });
  });

  it('flags evidence slots that are not evidence ids, and broken brackets', () => {
    expect(checkSlotted('Saves [[e:12]].').issues[0]?.rule).toBe('G1');
    expect(checkSlotted('Saves [[e:ev_1 ]].').ok).toBe(false);
  });
});
