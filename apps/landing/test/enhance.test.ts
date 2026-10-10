// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { currentTheme, readTheme, setupLantern, writeTheme } from '../src/enhance.ts';

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
