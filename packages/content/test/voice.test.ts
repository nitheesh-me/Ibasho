/** DESIGN_SYSTEM 9 and UX 15: all of our copy passes the voice checker. */
import { describe, expect, it } from 'vitest';
import { checkVoice, collectCopy, PROOFS_INTRO, sentences, VOICE } from '../src/index.ts';

describe('checkVoice', () => {
  it('catches the phrases we never say', () => {
    const bad = [
      'Your savings are guaranteed.',
      'Save up to £420 a year.',
      'AI-verified results.',
      'Verified savings for every home.',
      'Wow!',
      `Loft ${String.fromCharCode(0x2014)} done.`,
      `2${String.fromCharCode(0x2013)}4 days.`,
    ];
    for (const b of bad) expect(checkVoice(b).length, b).toBeGreaterThan(0);
  });

  it('flags very long sentences', () => {
    const long = `${Array.from({ length: 40 }, () => 'word').join(' ')}.`;
    expect(checkVoice(long).map((f) => f.rule)).toEqual(['long-sentence']);
  });

  it('splits sentences on full stops, questions and colons', () => {
    expect(sentences('One. Two? Three: four.')).toEqual(['One.', 'Two?', 'Three:', 'four.']);
  });
});

describe('our copy', () => {
  it('every item passes the voice rules', () => {
    const findings = collectCopy().flatMap(({ path, text }) =>
      checkVoice(text).map((f) => `${path}: ${f.why} (${f.match})`),
    );
    expect(findings).toEqual([]);
  });

  it('"What we prove" never says guaranteed and names what is not proved', () => {
    const all = JSON.stringify(PROOFS_INTRO);
    expect(all).not.toMatch(/guarantee/i);
    for (const m of PROOFS_INTRO.marks) expect(m.notProved.trim()).not.toBe('');
    expect(PROOFS_INTRO.marks.map((m) => m.seal)).toEqual(['proved', 'checked', 'modelled']);
  });

  it('the voice guide pairs good lines with lines the checker rejects or we avoid', () => {
    for (const p of VOICE.pairs) expect(checkVoice(p.do), p.do).toEqual([]);
    expect(VOICE.pairs.some((p) => checkVoice(p.dont).length > 0)).toBe(true);
  });
});
