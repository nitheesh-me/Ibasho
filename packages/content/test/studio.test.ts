/** v3 studio microcopy and building type copy: complete for every core union, and plain. */
import { APPLICABILITY, BUILDING_TYPES, GOAL_PRESETS, OBJECTIVE_IDS, STUDIO_STAGES } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import {
  APPLICABILITY_COPY,
  BUILDING_TYPE_COPY,
  countOf,
  describeOps,
  GOAL_PRESET_COPY,
  OBJECTIVE_COPY,
  roomLabel,
  rupees,
  STAGE_COPY,
  typeLabel,
} from '../src/index.ts';

describe('studio copy', () => {
  it('has words for every stage, applicability, objective and goal preset', () => {
    for (const s of STUDIO_STAGES) expect(STAGE_COPY[s].label, s).toBeTruthy();
    for (const a of APPLICABILITY) expect(APPLICABILITY_COPY[a].label, a).toBeTruthy();
    for (const o of OBJECTIVE_IDS) expect(OBJECTIVE_COPY[o].label, o).toBeTruthy();
    for (const g of GOAL_PRESETS) expect(GOAL_PRESET_COPY[g.id]?.label, g.id).toBeTruthy();
  });

  it('never says compliant, even on the applicability ladder', () => {
    expect(JSON.stringify(APPLICABILITY_COPY)).not.toMatch(/compliant/i);
  });
});

describe('money and changes in words', () => {
  it('writes rupees in lakh and crore, two significant figures', () => {
    expect(rupees(28403678.26)).toBe('Rs 2.8 crore');
    expect(rupees(1717598)).toBe('Rs 17 lakh');
    expect(rupees(46250)).toBe('Rs 46,000');
    expect(rupees(0)).toBe('Nothing');
  });

  it('summarises a bundle of changes', () => {
    expect(describeOps([])).toBe('The building as drawn');
    const ops = ['addOverhang', 'addOverhang', 'setGlazing', 'setRoofFinish', 'setLPD', 'addPV'].map(
      (op) => ({ op }),
    );
    expect(describeOps(ops)).toBe(
      'Overhangs over the windows, low-E double glazing, a cool white roof and 2 more',
    );
  });
});

describe('building types', () => {
  it('covers all eight types', () => {
    expect(Object.keys(BUILDING_TYPE_COPY).sort()).toEqual([...BUILDING_TYPES].sort());
  });

  it('counts and labels read naturally', () => {
    expect(countOf('apartments', 1)).toBe('1 apartment building');
    expect(countOf('office', 3)).toBe('3 offices');
    expect(typeLabel('education')).toBe('School or college');
    expect(typeLabel('spaceport')).toBe('Building');
  });

  it('labels rooms function first, then name', () => {
    expect(roomLabel('Library', 'IIIT Library')).toBe('Library, IIIT Library');
    expect(roomLabel('Classroom')).toBe('Classroom');
    expect(roomLabel('Library', 'library')).toBe('Library');
  });
});
