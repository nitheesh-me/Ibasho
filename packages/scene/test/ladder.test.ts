/** Quality ladder reducer (ARCH 10, DEC TE-8). */
import { describe, expect, it } from 'vitest';
import {
  effectiveTier,
  initialLadder,
  MAX_FLIPS,
  stepLadder,
  TIERS,
  tierSettings,
} from '../src/quality/ladder.ts';

describe('quality ladder', () => {
  it('steps DPR first, then AO, then shadows', () => {
    expect(TIERS[3].dpr).toBeGreaterThan(TIERS[2].dpr);
    expect(TIERS[2].ao).toBe(true);
    expect(TIERS[1].ao).toBe(false);
    expect(TIERS[1].shadows).toBe(true);
    expect(TIERS[0].shadows).toBe(false);
  });

  it('declines and inclines within [0, 3]', () => {
    let s = initialLadder(1);
    s = stepLadder(s, 'decline');
    expect(s.base).toBe(0);
    s = stepLadder(s, 'decline');
    expect(s.base).toBe(0);
    s = stepLadder(initialLadder(3), 'incline');
    expect(s.base).toBe(3);
  });

  it('stops flipping after MAX_FLIPS', () => {
    let s = initialLadder(3);
    for (let i = 0; i < MAX_FLIPS; i++) s = stepLadder(s, i % 2 ? 'incline' : 'decline');
    const frozen = s;
    expect(stepLadder(frozen, 'decline')).toBe(frozen);
    expect(stepLadder(frozen, 'incline')).toBe(frozen);
  });

  it('drops one step while an LLM generates, and restores after', () => {
    let s = stepLadder(initialLadder(2), 'llm-start');
    expect(effectiveTier(s)).toBe(1);
    expect(tierSettings(s)).toBe(TIERS[1]);
    s = stepLadder(s, 'llm-end');
    expect(effectiveTier(s)).toBe(2);
    expect(effectiveTier(stepLadder(initialLadder(0), 'llm-start'))).toBe(0);
  });

  it('comes back one step lower after a context loss, even after the flips cap', () => {
    let s = initialLadder(3);
    for (let i = 0; i < MAX_FLIPS; i++) s = stepLadder(s, 'incline');
    s = stepLadder(s, 'context-lost');
    expect(s.base).toBe(2);
  });
});
