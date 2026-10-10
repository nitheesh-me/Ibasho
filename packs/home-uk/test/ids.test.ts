import { MEASURE_KINDS } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { GROUPS, MEASURE_IDS, MEASURES, measureOfOption, OPTION_IDS, SUB_GROUPS } from '../src/ids.ts';

const groupOptions = (g: string): string[] =>
  MEASURE_IDS.filter((m) => MEASURES[m].group === g).flatMap((m) => [...MEASURES[m].options]);

describe('home-uk ids (SPEC 9)', () => {
  it('ids are unique kebab-case', () => {
    const all = [...MEASURE_IDS, ...OPTION_IDS];
    for (const id of all) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(new Set(OPTION_IDS).size).toBe(OPTION_IDS.length);
  });

  it('every measure names a known group and kind', () => {
    const groups = new Set<string>([...Object.keys(GROUPS), ...Object.keys(SUB_GROUPS)]);
    for (const m of MEASURE_IDS) {
      expect(groups.has(MEASURES[m].group)).toBe(true);
      expect((MEASURE_KINDS as readonly string[]).includes(MEASURES[m].kind)).toBe(true);
    }
  });

  it('maps options back to measures', () => {
    expect(measureOfOption('loft-300')).toBe('loft');
    expect(measureOfOption('nope')).toBeUndefined();
  });

  it('GH1 search size is 432 heavy and 10,800 packages (SPEC 9, R9)', () => {
    // GH1 excludes vent (MVHR needs AP50 <= 5), cylinder jacket and solar thermal (combi).
    const heavy = ['loft', 'wall', 'floor', 'draught', 'glazing', 'controls']
      .map((g) => 1 + groupOptions(g).length)
      .reduce((a, b) => a * b, 1);
    expect(heavy * 2).toBe(432); // x DHW class
    const heat = 1 + groupOptions('heat').length * (1 + groupOptions('sub-hob').length);
    const pvBattery = 1 + groupOptions('pv').length * (1 + groupOptions('battery').length);
    expect(heat * pvBattery).toBe(50);
    // The DHW class follows from the heat choice, so packages are fabric combos x light variants.
    expect(heavy * heat * pvBattery).toBe(10_800);
  });
});
