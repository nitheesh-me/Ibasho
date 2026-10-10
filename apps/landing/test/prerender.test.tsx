// @vitest-environment happy-dom
/** AC-L2 (readable without JS), AC-L3 (content-driven), I4 (hide on missing plugin), I5 (glossary). */
import { GLOSSARY, LANDING_CHAPTERS, type PluginPresence, plainText, termOf } from '@ibasho/content';
import { describe, expect, it } from 'vitest';
import { fillTemplate, renderHead, renderLanding } from '../src/prerender.tsx';

const everything: PluginPresence = { has: () => true, hasKind: () => true };
const nothing: PluginPresence = { has: () => false, hasKind: () => false };

function parse(html: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html lang="en-GB"><body>${html}</body></html>`,
    'text/html',
  );
}

const chapterIds = (d: Document) =>
  [...d.querySelectorAll('[data-chapter]')].map((s) => s.getAttribute('data-chapter'));

describe('static landing', () => {
  const doc = parse(renderLanding(everything));

  it('renders the five chapters from content, in order (AC-L3)', () => {
    expect(chapterIds(doc)).toEqual(LANDING_CHAPTERS.map((c) => c.id));
  });

  it('carries every word of every chapter in the HTML itself (AC-L2)', () => {
    const text = doc.body.textContent ?? '';
    for (const c of LANDING_CHAPTERS) {
      for (const copy of [c.kicker, c.title, c.line, ...c.body]) {
        expect(text, `${c.id}: ${copy}`).toContain(plainText(copy, termOf));
      }
    }
  });

  it('hides chapters whose plugins are missing, keeping the hero (I4)', () => {
    expect(chapterIds(parse(renderLanding(nothing)))).toEqual(['hero']);
    const partial: PluginPresence = { has: (id) => id !== 'rules-uk', hasKind: () => true };
    const shown = chapterIds(parse(renderLanding(partial)));
    expect(shown).not.toContain('futures');
    expect(shown).toContain('proof');
  });

  it('has one h1, labelled sections and decorative kanji hidden from screen readers', () => {
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    for (const s of doc.querySelectorAll('section[aria-labelledby]')) {
      expect(doc.getElementById(s.getAttribute('aria-labelledby')!), s.id).not.toBeNull();
    }
    const glyphs = [...doc.querySelectorAll('svg[data-glyph]')];
    expect(glyphs.length).toBeGreaterThan(5);
    for (const g of glyphs)
      expect(g.closest('[aria-hidden="true"]'), g.getAttribute('data-glyph')!).not.toBeNull();
  });

  it('uses gold for exactly one action, and no seal at all', () => {
    expect(doc.querySelectorAll('.lp-cta')).toHaveLength(1);
    expect(doc.querySelector('.lp-cta')?.getAttribute('href')).toBe('/app/start');
    expect(doc.querySelectorAll('.ib-seal')).toHaveLength(0);
  });

  it('every glossary link lands on a plain definition on the page (I5)', () => {
    const links = [...doc.querySelectorAll('a.lp-term')];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      const id = a.getAttribute('href')!.slice(1);
      const target = doc.getElementById(id);
      expect(target, id).not.toBeNull();
      expect(target!.querySelector('dd')?.textContent).toBe(GLOSSARY[id.slice(2)]!.plain);
    }
  });

  it('never leaks a raw glossary mark into the page, with or without plugins', () => {
    for (const presence of [everything, nothing]) expect(renderLanding(presence)).not.toContain('[[');
  });

  it('keeps the lantern button hidden until script enhances it', () => {
    expect(doc.querySelector('[data-lantern]')?.hasAttribute('hidden')).toBe(true);
  });
});

describe('template', () => {
  it('fills both placeholders and fails loudly when one is missing', () => {
    const out = fillTemplate('<head><!--landing-head--></head><body><!--landing-body--></body>', nothing);
    expect(out).toContain('name="description"');
    expect(out).toContain('data-chapter="hero"');
    expect(() => fillTemplate('<body></body>', nothing)).toThrow(/landing-head/);
  });

  it('escapes head attributes', () => {
    expect(renderHead()).not.toMatch(/content="[^"]*</);
  });
});
