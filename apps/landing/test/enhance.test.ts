// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { currentTheme, readTheme, setupLantern, setupWords, writeTheme } from '../src/enhance.ts';

describe('theme storage', () => {
  it('survives a storage that throws', () => {
    const bad = {
      getItem: (): string | null => {
        throw new Error('blocked');
      },
      setItem: (): void => {
        throw new Error('blocked');
      },
    };
    expect(readTheme(bad)).toBeUndefined();
    expect(() => writeTheme(bad, 'yoru')).not.toThrow();
    expect(readTheme(undefined)).toBeUndefined();
  });

  it('ignores values it did not write', () => {
    expect(readTheme({ getItem: () => 'purple' })).toBeUndefined();
    expect(readTheme({ getItem: () => 'yoru' })).toBe('yoru');
  });

  it('falls back to the system preference', () => {
    const el = document.createElement('div');
    expect(currentTheme(el, true)).toBe('yoru');
    expect(currentTheme(el, false)).toBe('hiru');
    el.dataset.theme = 'hiru';
    expect(currentTheme(el, true)).toBe('hiru');
  });
});

describe('lantern', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    window.localStorage.clear();
    document.body.innerHTML = '<button type="button" data-lantern hidden aria-pressed="false">Night</button>';
  });

  it('reveals the button and switches day and night, remembering the choice', () => {
    setupLantern(document, window);
    const b = document.querySelector<HTMLButtonElement>('[data-lantern]')!;
    expect(b.hidden).toBe(false);
    b.click();
    const first = document.documentElement.dataset.theme;
    expect(first === 'hiru' || first === 'yoru').toBe(true);
    expect(b.getAttribute('aria-pressed')).toBe(String(first === 'yoru'));
    expect(readTheme(window.localStorage)).toBe(first);
    b.click();
    expect(document.documentElement.dataset.theme).not.toBe(first);
  });
});

describe('words we use', () => {
  it('opens the fold when a glossary link is followed', () => {
    document.body.innerHTML =
      '<a class="lp-term" href="#g-eui">EUI</a><details data-words><summary>Words</summary><dl><div id="g-eui"></div></dl></details>';
    setupWords(document, window);
    const fold = document.querySelector<HTMLDetailsElement>('[data-words]')!;
    expect(fold.open).toBe(false);
    document.querySelector<HTMLAnchorElement>('a.lp-term')!.click();
    expect(fold.open).toBe(true);
  });
});
