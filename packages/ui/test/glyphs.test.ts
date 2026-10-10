import { describe, expect, it } from 'vitest';
import { BAKED_FONT, BAKED_GLYPHS } from '../src/glyphs/baked.ts';
import { glyphViewBox } from '../src/glyphs/Glyph.tsx';
import { BAKE_LIST } from '../src/glyphs/list.ts';

// DESIGN_SYSTEM 3: the exact glyphs the seals and chapters use.
const DS3 = '居 家 勘 試 道 場 所 証 検 模 穏 賢 勇 昼 夜'.split(' ');

describe('F9 baked glyphs', () => {
  it('the bake list is exactly the DESIGN_SYSTEM 3 list', () => {
    expect([...BAKE_LIST]).toEqual(DS3);
  });

  it('every kanji has a non-trivial path from Yuji Syuku', () => {
    expect(BAKED_FONT.family).toBe('Yuji Syuku');
    expect(BAKED_FONT.license).toBe('OFL-1.1');
    for (const ch of DS3) {
      const g = BAKED_GLYPHS[ch];
      expect(g, ch).toBeDefined();
      expect(g!.cp).toBe(ch.codePointAt(0));
      expect(g!.d.length, ch).toBeGreaterThan(200);
      expect(g!.d).toMatch(/^M[-\d]/);
      const [, , w, h] = g!.box;
      expect(w).toBeGreaterThan(300);
      expect(h).toBeGreaterThan(300);
    }
  });

  it('centres each glyph in a square view box', () => {
    const [x, y, w, h] = glyphViewBox('証', 20).split(' ').map(Number);
    const [bx, by, bw, bh] = BAKED_GLYPHS.証!.box;
    expect(w).toBe(h);
    expect(x! + w! / 2).toBeCloseTo(bx + bw / 2, 6);
    expect(y! + h! / 2).toBeCloseTo(by + bh / 2, 6);
  });
});
