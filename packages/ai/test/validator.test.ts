/**
 * E5: each of G1 to G8 rejects its seeded violation fixture
 * (`packages/fixtures/src/narration/violations.json`), and clean controls pass.
 */
import type { SectionKey } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import violations from '../../fixtures/src/narration/violations.json' with { type: 'json' };
import { validateSection } from '../src/grounding/validate.ts';
import { gh1Story, withRoles } from './helpers.ts';

const story = gh1Story();

describe('validator G1 to G8 (E5)', () => {
  it('covers every rule', () => {
    const rules = new Set(violations.cases.map((c) => c.rule));
    expect([...rules].sort()).toEqual(['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8']);
  });

  for (const c of violations.cases) {
    it(`${c.rule} rejects: ${c.text}`, () => {
      const text = withRoles(c.text, story);
      const opts = 'fragments' in c && c.fragments ? { flaggedFragments: c.fragments } : {};
      const issues = validateSection(c.section as SectionKey, text, story.bundle, opts);
      expect(issues.map((i) => i.rule)).toContain(c.rule);
      const hard = issues
        .filter((i) => i.rule === c.rule)
        .every((i) => i.severity === (c.rule === 'G6' || c.rule === 'G8' ? 'hard' : 'repair'));
      expect(hard).toBe(true);
    });
  }

  for (const c of violations.controls) {
    it(`passes control: ${c.text}`, () => {
      expect(validateSection(c.section as SectionKey, withRoles(c.text, story), story.bundle)).toEqual([]);
    });
  }

  it('spans point into the section text', () => {
    const text = 'Fine. It saves about 300 pounds.';
    const [g2] = validateSection('overview', text, story.bundle).filter((i) => i.rule === 'G2');
    expect(g2).toBeDefined();
    expect(text.slice(g2!.span[0], g2!.span[1])).toBe('300');
  });

  it('G2 catches numbers in any script and hyphenated number words', () => {
    for (const text of [
      'It saves about \u0969\u0966\u0966 pounds.',
      'It saves about \uFF13\uFF10\uFF10 pounds.',
      'It saves \u00BD of the bill.',
      'It saves \u216B pounds.',
      'It saves twenty-five pounds.',
      'It cuts the bill by one-third.',
      'It saves \uFF05 on the bill.',
    ]) {
      expect(
        validateSection('overview', text, story.bundle).map((i) => i.rule),
        text,
      ).toContain('G2');
    }
  });

  it('treats an expired snooze as no longer ruled out', () => {
    const b = structuredClone(story.bundle);
    b.memory.preferences.rejected = {
      'wall-ewi': { scope: 'snooze', until: '2026-01-01T00:00:00Z', at: '2025-06-01T00:00:00Z' },
    };
    expect(validateSection('package', 'Try [[m:wall-ewi]] next.', b).filter((i) => i.rule === 'G6')).toEqual(
      [],
    );
    b.memory.preferences.rejected = {
      'wall-ewi': { scope: 'snooze', until: '2027-01-01T00:00:00Z', at: '2025-06-01T00:00:00Z' },
    };
    expect(validateSection('package', 'Try [[m:wall-ewi]] next.', b).map((i) => i.rule)).toContain('G6');
  });

  it('flags an empty section', () => {
    expect(validateSection('overview', '   ', story.bundle).map((i) => i.rule)).toEqual(['G1']);
  });
});
