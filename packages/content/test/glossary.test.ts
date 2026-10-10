/** WP-09 I5: every term marked for the glossary has a plain definition. */
import { describe, expect, it } from 'vitest';
import {
  collectCopy,
  definitionOf,
  GLOSSARY,
  GLOSSARY_IDS,
  hasMalformedMark,
  markedTerms,
  plainText,
  segments,
  termOf,
} from '../src/index.ts';

describe('glossary marks', () => {
  it('splits copy into text and term segments', () => {
    expect(segments('A [[g:u-value]] and [[g:heat-pump|heat pumps]].', termOf)).toEqual([
      { t: 'text', text: 'A ' },
      { t: 'term', id: 'u-value', label: 'U-value' },
      { t: 'text', text: ' and ' },
      { t: 'term', id: 'heat-pump', label: 'heat pumps' },
      { t: 'text', text: '.' },
    ]);
    expect(plainText('Lower [[g:u-value]] is better.', termOf)).toBe('Lower U-value is better.');
    expect(markedTerms('[[g:kwh]] then [[g:kwp|size]]')).toEqual(['kwh', 'kwp']);
  });

  it('flags malformed marks', () => {
    expect(hasMalformedMark('[[g:U Value]]')).toBe(true);
    expect(hasMalformedMark('[[g:u-value')).toBe(true);
    expect(hasMalformedMark('[[g:u-value]] fine')).toBe(false);
  });

  it('every mark in every piece of copy resolves to a plain definition (I5)', () => {
    const items = collectCopy();
    expect(items.length).toBeGreaterThan(150);
    let marks = 0;
    for (const { path, text } of items) {
      expect(hasMalformedMark(text), `${path}: malformed mark`).toBe(false);
      for (const id of markedTerms(text)) {
        marks++;
        expect(definitionOf(id), `${path}: [[g:${id}]] has no definition`).toBeTruthy();
      }
    }
    expect(marks).toBeGreaterThan(20);
  });
});

describe('glossary entries', () => {
  it('ids are kebab-case and unique, terms unique', () => {
    expect(new Set(GLOSSARY_IDS).size).toBe(GLOSSARY_IDS.length);
    const terms = GLOSSARY_IDS.map((id) => GLOSSARY[id]!.term.toLowerCase());
    expect(new Set(terms).size).toBe(terms.length);
    for (const id of GLOSSARY_IDS) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('definitions are plain: full sentences, short, no marks inside', () => {
    for (const id of GLOSSARY_IDS) {
      const e = GLOSSARY[id]!;
      expect(e.plain, id).toMatch(/[.?]$/);
      expect(e.plain.split(/\s+/).length, `${id} is short`).toBeLessThanOrEqual(30);
      expect(markedTerms(e.plain), `${id} defines with plain words only`).toEqual([]);
    }
  });

  it('U-value says which way is better (UX 15)', () => {
    expect(definitionOf('u-value')).toMatch(/Lower is better/);
  });
});
