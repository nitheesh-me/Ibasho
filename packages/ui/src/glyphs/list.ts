/**
 * Kanji baked from Yuji Syuku into SVG paths (DESIGN_SYSTEM 3). Decorative only: every use is
 * `aria-hidden` and paired with an English label. Owner: WP-06.
 */
export const BAKE_LIST = [
  '居',
  '家',
  '勘',
  '試',
  '道',
  '場',
  '所',
  '証',
  '検',
  '模',
  '穏',
  '賢',
  '勇',
  '昼',
  '夜',
] as const;

export type BakedChar = (typeof BAKE_LIST)[number];

export interface BakedGlyph {
  /** Unicode code point. */
  cp: number;
  /** Ink bounding box in em units: [x, y, width, height]. */
  box: readonly [number, number, number, number];
  /** SVG path data, 1000 unit em, y down. */
  d: string;
}
