/**
 * Shading presets (chajja, deep overhang, fins, box frame, jaali). Owner: WP-15.
 */
import type { ShadeRule } from '@ibasho/core';

export const SHADE_PRESETS_DATA: { id: string; label: string; rules: ShadeRule[] }[] = [
  { id: 'none', label: 'None', rules: [] },
  {
    id: 'chajja',
    label: 'Chajja',
    rules: [{ kind: 'overhang', depth: 600, aboveHead: 150, extension: 300 }],
  },
  {
    id: 'deep',
    label: 'Deep overhang',
    rules: [{ kind: 'overhang', depth: 1200, aboveHead: 150, extension: 600 }],
  },
  { id: 'fins', label: 'Fins', rules: [{ kind: 'fins', depth: 450, sides: 'both' }] },
  {
    id: 'box',
    label: 'Box frame',
    rules: [
      { kind: 'overhang', depth: 600, aboveHead: 150, extension: 0 },
      { kind: 'fins', depth: 600, sides: 'both' },
    ],
  },
  {
    id: 'jaali',
    label: 'Jaali',
    rules: [{ kind: 'screen', porosityPm: 400, offset: 300, presetId: 'jaali' }],
  },
];
