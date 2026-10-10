/**
 * Template narrator (SPEC 10, AM 4.3). E4: GH1 narration is byte-identical across runs; the golden
 * file pins the bytes so the same check can run in Chromium and Firefox (WP-10 determinism matrix).
 */
import { describe, expect, it } from 'vitest';
import golden from '../../fixtures/src/narration/gh1.golden.json' with { type: 'json' };
import { validateSection } from '../src/grounding/validate.ts';
import { DATAMARK } from '../src/providers/payload.ts';
import { narrateSection } from '../src/narrator/template.ts';
import { EN_GB } from '../src/narrator/en-gb.ts';
import { buildStory } from '../src/evidence/spec.ts';
import { GH1_REQUESTS, gh1Spec, gh1Story, renderGh1 } from './helpers.ts';

describe('template narrator', () => {
  it('every GH1 section validates clean (it is its own regression test)', () => {
    const story = gh1Story();
    for (const r of GH1_REQUESTS) {
      const s = narrateSection(story, r);
      expect(s.text.length, JSON.stringify(r)).toBeGreaterThan(0);
      expect(validateSection(s.key, s.text, story.bundle), JSON.stringify(r)).toEqual([]);
    }
  });

  it('E4: byte-identical across two runs and equal to the golden file', () => {
    const a = renderGh1();
    const b = renderGh1(gh1Story());
    expect(a.sha256).toBe(b.sha256);
    expect(a.sha256).toBe(golden.sha256);
    expect(a.sections.map((s) => s.rendered)).toEqual(golden.rendered);
  });

  it('writes no digits or number words outside slots, and only en-GB copy', () => {
    for (const s of renderGh1().sections) {
      expect(s.slotted.replace(/\[\[[^\]]*\]\]/g, '')).not.toMatch(/\d/);
      expect(s.rendered).not.toContain(DATAMARK);
      expect(s.rendered).not.toMatch(/\bguarantee/i);
    }
  });

  it('opens chapters as SPEC 5.4 says', () => {
    const r = renderGh1().sections;
    const ch = (c: string) => r.find((s) => s.request.section === 'chapter' && s.request.chapter === c)!.rendered;
    expect(ch('ie')).toMatch(/^This is your home\. On a typical January night at 1\.6 °C outside, it loses heat at 5\.83 kW\./);
    expect(ch('kan')).toMatch(/^Let's check us against your bills\./);
    expect(ch('kokoromi')).toMatch(/^Bigger radiators, or the loft first\?/);
    expect(ch('michi')).toMatch(/^Many changes are possible\. Three stand out\./);
    expect(ch('ibasho')).toMatch(/^Here is your home, mended\./);
  });

  it('variants follow the seed: the same bundle always reads the same, other bundles vary', () => {
    const story = gh1Story();
    expect(narrateSection(story, { section: 'overview' })).toEqual(narrateSection(gh1Story(), { section: 'overview' }));
    const seen = new Set<string>();
    for (let v = 0; v < 24; v++) {
      const other = buildStory({ ...gh1Spec, modelVersion: `0.${v}.0` });
      const s = narrateSection(other, { section: 'overview' });
      expect(validateSection(s.key, s.text, other.bundle)).toEqual([]);
      seen.add(s.text);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('never recommends a ruled-out measure and acknowledges it instead', () => {
    const story = gh1Story();
    story.bundle.memory.preferences.rejected = {
      ...story.bundle.memory.preferences.rejected,
      loft: { scope: 'never', at: '2026-01-01T00:00:00Z' },
    };
    for (const r of GH1_REQUESTS) {
      const s = narrateSection(story, r);
      expect(validateSection(s.key, s.text, story.bundle).filter((i) => i.rule === 'G6'), JSON.stringify(r)).toEqual([]);
    }
    const michi = narrateSection(story, { section: 'chapter', chapter: 'michi' }).text;
    expect(michi).not.toContain('[[m:loft-300]]');
    expect(narrateSection(story, { section: 'chapter', chapter: 'kokoromi' }).text).not.toContain('[[m:loft]]');
  });

  it('falls back to safe phrasing when context is missing or numeric', () => {
    const story = gh1Story();
    story.context = { ...story.context, topLossName: 'the 3 walls', nextStep: 'call 0800 123' };
    const ie = narrateSection(story, { section: 'chapter', chapter: 'ie' }).text;
    expect(ie).not.toContain('3 walls');
    const end = narrateSection(story, { section: 'chapter', chapter: 'ibasho' }).text;
    expect(end).not.toContain('0800');
    expect(validateSection('chapter', end, story.bundle)).toEqual([]);
  });

  it('the en-GB pack has at least one variant per key and no dashes', () => {
    for (const [k, v] of Object.entries(EN_GB.templates)) {
      expect(v.length, k).toBeGreaterThan(0);
      for (const t of v) expect(t).not.toMatch(/[–—]/);
    }
  });
});
