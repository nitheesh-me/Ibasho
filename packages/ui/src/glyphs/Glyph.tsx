/**
 * A baked kanji as inline SVG paths (DESIGN_SYSTEM 3). Always decorative: `aria-hidden`, so pair
 * it with an English label. Owner: WP-06.
 */
import type { SVGProps } from 'react';
import { BAKED_GLYPHS } from './baked.ts';
import type { BakedChar } from './list.ts';

export interface GlyphProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'viewBox'> {
  char: BakedChar;
  /** Padding around the ink box, in em units (1000 per em). */
  pad?: number;
}

/** Ink box of a baked glyph, padded, as an SVG viewBox. */
export function glyphViewBox(char: BakedChar, pad = 0): string {
  const g = BAKED_GLYPHS[char];
  if (!g) throw new Error(`glyph ${char} is not baked`);
  const [x, y, w, h] = g.box;
  // Square box centred on the ink so every kanji sits optically centred in a seal.
  const side = Math.max(w, h) + 2 * pad;
  return `${x + w / 2 - side / 2} ${y + h / 2 - side / 2} ${side} ${side}`;
}

export function Glyph({ char, pad = 0, ...rest }: GlyphProps) {
  const g = BAKED_GLYPHS[char];
  if (!g) throw new Error(`glyph ${char} is not baked`);
  return (
    <svg viewBox={glyphViewBox(char, pad)} aria-hidden="true" focusable="false" data-glyph={char} {...rest}>
      <path d={g.d} fill="currentColor" />
    </svg>
  );
}
