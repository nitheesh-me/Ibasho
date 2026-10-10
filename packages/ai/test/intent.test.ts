/**
 * E3: the offline intent parser scores at least 70% exact ops on its 120-utterance gold set
 * (`packages/fixtures/src/utterances/whatif.gold.json`). Exact means the same ops in the same order.
 */
import { canonicalJson } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import gold from '../../fixtures/src/utterances/whatif.gold.json' with { type: 'json' };
import { parseIntent } from '../src/ops/intent.ts';
import { defaultCatalogue, validateOps } from '../src/ops/validator.ts';

const prefs = {
  tenure: 'owner' as const,
  rights: { roof: 'yes' as const, externalWalls: 'yes' as const, windows: 'yes' as const },
  rejected: {},
  completed: {},
  priorities: [],
};

describe('intent parser (E3)', () => {
  it('has 120 gold utterances', () => {
    expect(gold.items).toHaveLength(120);
  });

  it('scores at least 70% exact ops', () => {
    const misses: string[] = [];
    let exact = 0;
    for (const { u, ops } of gold.items) {
      const got = parseIntent(u).ops;
      if (canonicalJson(got) === canonicalJson(ops)) exact++;
      else misses.push(`${u}\n   want ${canonicalJson(ops)}\n   got  ${canonicalJson(got)}`);
    }
    const score = exact / gold.items.length;
    if (process.env['IBASHO_SHOW_MISSES']) console.log(`${exact}/120\n${misses.join('\n')}`);
    expect(score).toBeGreaterThanOrEqual(0.7);
  });

  it('every gold op is valid against the default catalogue', () => {
    for (const { ops } of gold.items) {
      const v = validateOps(ops, {
        catalogue: defaultCatalogue(),
        preferences: prefs,
        now: '2026-10-11T00:00:00Z',
      });
      expect(v.rejected).toEqual([]);
    }
  });

  it('is deterministic and never throws on junk', () => {
    for (const s of ['', '???', '[[e:1]]', 'set budget to £', 'a'.repeat(5000), '\u0000‮']) {
      expect(parseIntent(s)).toEqual(parseIntent(s));
    }
  });
});
