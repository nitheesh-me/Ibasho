/** Minimal types for the parts of opentype.js 1.3.4 that bake-glyphs uses (it ships none). */
declare module 'opentype.js' {
  export interface BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }
  export interface Path {
    toPathData(decimalPlaces?: number): string;
    getBoundingBox(): BoundingBox;
  }
  export interface Glyph {
    index: number;
    unicode?: number;
    advanceWidth?: number;
    getPath(x: number, y: number, fontSize: number): Path;
  }
  export interface Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    names: { fontFamily?: Record<string, string>; version?: Record<string, string> };
    charToGlyph(c: string): Glyph;
  }
  export function parse(buffer: ArrayBuffer): Font;
}
