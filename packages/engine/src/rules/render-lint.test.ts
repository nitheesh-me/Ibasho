/**
 * Sentence renderer and rule lint (WP-03 M-B, C7 shape; the pack lint runs in rules-uk).
 */
import type { Rule } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { BUILTIN_RULES } from './builtins.ts';
import { lintRules } from './lint.ts';
import { renderExpr, renderRule } from './render.ts';

/** En and em dash characters, built from code points so this file stays free of them. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
const base: Rule = {
  id: 'T.LOOPED',
  jurisdiction: 'GB',
  measures: ['ashp'],
  scope: 'measure',
  when: { cmp: '=', left: { fact: 'h.supply.looped' }, right: 1 },
  effect: { kind: 'check', check: 'dno-approval' },
  effectiveFrom: '2019-04-01',
  source: {
    url: 'https://www.energynetworks.org/',
    clause: 'test (DEC SC-3, reviewer memory)',
    grade: 'secondary',
  },
  explain: 't.explain',
};

describe('renderRule', () => {
  it('reads as one plain sentence', () => {
    expect(renderRule(base)).toBe('If the electricity supply is looped, a DNO approval is needed first.');
    expect(
      renderExpr({
        and: [
          { cmp: '>', left: { fact: 'h.wall.u' }, right: 0.7 },
          {
            or: [
              { cmp: '=', left: { fact: 'h.flat' }, right: 1 },
              { in: { fact: 'm.ewi.finish' }, set: ['render', 'stone'] },
            ],
          },
        ],
      }),
    ).toBe(
      'the wall U-value is more than 0.7 and either the home is a flat or the new wall finish is render or stone',
    );
    expect(renderExpr({ not: { fn: 'mcs020a_Lp_le', args: [{ fact: 'm.ashp.noise' }] } })).toContain(
      'above 37.0 dB(A)',
    );
    expect(
      renderRule({ ...base, when: { const: true }, effect: { kind: 'consent', authority: 'LPA' } }),
    ).toBe('You need planning permission from the local planning authority.');
  });
  it('never contains a dash punctuation mark', () => {
    for (const r of BUILTIN_RULES) expect(renderRule(r)).not.toMatch(DASHES);
  });
});

describe('lintRules', () => {
  it('passes good rules and the built-ins', () => {
    expect(lintRules([base, ...BUILTIN_RULES])).toEqual([]);
  });
  it('flags grade, url, dates, duplicates, fns in status rules and uncited reviewer memory', () => {
    const bad: Rule[] = [
      { ...base, id: 'A', source: { ...base.source, url: 'http://x', grade: 'nope' as never } },
      { ...base, id: 'A', effectiveTo: '2000-01-01' },
      { ...base, id: 'B', when: { fn: 'mcs020a_Lp_le', args: [{ fact: 'm.ashp.noise' }] } },
      { ...base, id: 'C', source: { ...base.source, clause: 'from reviewer memory' } },
    ];
    expect(lintRules(bad).map((i) => `${i.ruleId}:${i.check}`)).toEqual([
      'A:grade',
      'A:source-url',
      'A:duplicate-id',
      'A:dates',
      'B:fn-status',
      'C:secondary-dec',
    ]);
  });
});
