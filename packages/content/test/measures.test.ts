/**
 * AC-P2 / WP-09 I2: every T1 measure id has complete disruption and next-step guidance.
 * The ids come from the source of truth, `packs/home-uk/src/ids.ts` (owner WP-01).
 */
import { describe, expect, it } from 'vitest';
import { ASSESSMENTS, MEASURE_IDS } from '../../../packs/home-uk/src/ids.ts';
import {
  ACCREDITATIONS,
  ASSESSMENT_GUIDANCE,
  type AssessmentGuidance,
  GUIDED_MEASURE_IDS,
  guidanceFor,
  MEASURE_GUIDANCE,
  type MeasureGuidance,
} from '../src/index.ts';

const sorted = (xs: readonly string[]) => [...xs].sort();

function expectComplete(id: string, g: MeasureGuidance | AssessmentGuidance) {
  expect(g.name.trim(), `${id} name`).not.toBe('');
  expect(g.what.trim(), `${id} what`).not.toBe('');
  const { days, rooms, stayIn, mess, note } = g.disruption;
  expect(Number.isInteger(days.min) && Number.isInteger(days.max), `${id} whole days`).toBe(true);
  expect(days.min, `${id} days.min`).toBeGreaterThanOrEqual(0);
  expect(days.max, `${id} days.max`).toBeGreaterThanOrEqual(days.min);
  expect(days.max, `${id} days.max`).toBeLessThanOrEqual(30);
  expect(['yes', 'mostly', 'no']).toContain(stayIn);
  expect(['low', 'medium', 'high']).toContain(mess);
  for (const r of rooms) expect(r.trim(), `${id} room`).not.toBe('');
  expect(note.trim(), `${id} note`).not.toBe('');
  expect(g.next.installer.trim(), `${id} installer`).not.toBe('');
  expect(g.next.why.trim(), `${id} why`).not.toBe('');
  for (const a of g.next.accreditation) expect(ACCREDITATIONS[a], `${id} accreditation ${a}`).toBeDefined();
  expect(new Set(g.next.accreditation).size, `${id} accreditation unique`).toBe(g.next.accreditation.length);
  expect(g.next.questions, `${id} three questions`).toHaveLength(3);
  for (const q of g.next.questions) expect(q.trim().endsWith('?'), `${id}: "${q}" is a question`).toBe(true);
  expect(new Set(g.next.questions).size, `${id} questions distinct`).toBe(3);
  expect(g.provenance.sources.length, `${id} sources`).toBeGreaterThan(0);
  for (const s of g.provenance.sources) expect(s.url, `${id} source ${s.id}`).toMatch(/^https:\/\//);
  expect(g.provenance.grade).toBe('estimate');
}

describe('measure guidance (AC-P2)', () => {
  it('covers exactly the measure ids in packs/home-uk/src/ids.ts', () => {
    expect(sorted(GUIDED_MEASURE_IDS)).toEqual(sorted(MEASURE_IDS));
    expect(sorted(Object.keys(MEASURE_GUIDANCE))).toEqual(sorted(MEASURE_IDS));
  });

  it.each(MEASURE_IDS)('%s has complete disruption and next-step content', (id) => {
    const g = guidanceFor(id);
    expect(g, id).toBeDefined();
    expect(g!.measureId).toBe(id);
    expectComplete(id, g!);
  });

  it('every measure except the do-it-yourself jacket names at least one accreditation', () => {
    for (const id of MEASURE_IDS) {
      if (id === 'cylinder-jacket') continue;
      expect(guidanceFor(id)!.next.accreditation.length, id).toBeGreaterThan(0);
    }
  });

  it('heat pump work names MCS first and the gas cap names Gas Safe', () => {
    expect(guidanceFor('ashp')!.next.accreditation[0]).toBe('mcs');
    expect(guidanceFor('ashp')!.next.accreditation).toContain('gas-safe');
    expect(guidanceFor('hob-induction')!.next.accreditation).toContain('gas-safe');
  });

  it('wall insulation goes through a retrofit coordinator (PAS 2035)', () => {
    expect(guidanceFor('wall-iwi')!.next.accreditation).toContain('pas-2035');
    expect(guidanceFor('wall-ewi')!.next.accreditation).toContain('pas-2035');
  });

  it('returns undefined for an unknown id', () => {
    expect(guidanceFor('time-machine')).toBeUndefined();
  });
});

describe('assessment guidance', () => {
  it('covers exactly the costed assessments in ids.ts', () => {
    expect(sorted(Object.keys(ASSESSMENT_GUIDANCE))).toEqual(sorted(ASSESSMENTS));
  });

  it.each(ASSESSMENTS)('%s is complete', (id) => {
    const g = ASSESSMENT_GUIDANCE[id];
    expect(g.assessmentId).toBe(id);
    expectComplete(id, g);
  });
});

describe('accreditations', () => {
  it('each has a plain meaning and an https place to check', () => {
    for (const [id, a] of Object.entries(ACCREDITATIONS)) {
      expect(a.id).toBe(id);
      expect(a.plain.trim()).not.toBe('');
      expect(a.checkUrl).toMatch(/^https:\/\//);
    }
  });
});
