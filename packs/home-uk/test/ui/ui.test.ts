/** home-uk ui half: one `measure-ui` per measure id, valid plugins, thumbnails for every form. */
import { checkPlugin, createRegistry } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { MEASURE_IDS } from '../../src/ids.ts';
import {
  ARCHETYPE_FORMS,
  ARCHETYPE_LABEL,
  HOME_UK_MEASURE_UI,
  HOME_UK_MON_IDS,
  homeUkUiModule,
  THUMB_H,
  THUMB_W,
  thumbnailDrawing,
} from '../../src/ui/index.ts';

/** Keys of `MONS` in `packages/ui/src/mon/set.ts` (WP-06) this pack uses. */
const MON_KEYS = new Set([
  'loft',
  'wall',
  'floor',
  'draught',
  'glazing',
  'controls',
  'mvhr',
  'heat-pump',
  'pv',
  'battery',
  'cylinder',
  'solar-thermal',
  'gas-disconnect',
]);
const ELEMENT_KINDS = new Set(['roof', 'wall', 'floor', 'window', 'door', 'system']);

describe('measure-ui', () => {
  it('covers every measure id exactly once', () => {
    expect(HOME_UK_MEASURE_UI.map((p) => p.measureId)).toEqual(MEASURE_IDS);
    expect(new Set(HOME_UK_MEASURE_UI.map((p) => p.id)).size).toBe(MEASURE_IDS.length);
  });

  it('passes the kernel plugin checks and registers as one module', async () => {
    for (const p of HOME_UK_MEASURE_UI) expect(checkPlugin(p), p.id).toEqual([]);
    const reg = createRegistry();
    const plugins = await homeUkUiModule.load();
    reg.registerAll(plugins);
    expect(reg.validate()).toEqual([]);
  });

  it('gives each a mon id and a fold onto known targets in whole creases', () => {
    for (const p of HOME_UK_MEASURE_UI) {
      expect(p.side).toBe('ui');
      expect(p.mon).toMatch(/^[a-z0-9-]+$/);
      expect(MON_KEYS.has(p.mon), p.mon).toBe(true);
      expect(p.fold.targets.length).toBeGreaterThan(0);
      for (const t of p.fold.targets) expect(ELEMENT_KINDS.has(t), `${p.id} ${t}`).toBe(true);
      expect(p.fold.durationMs % 900).toBe(0);
    }
    expect(HOME_UK_MON_IDS).toEqual([...new Set(HOME_UK_MEASURE_UI.map((p) => p.mon))].sort());
  });
});

describe('archetype thumbnails', () => {
  it('draws every built form with a label', () => {
    for (const f of ARCHETYPE_FORMS) {
      expect(ARCHETYPE_LABEL[f].length).toBeGreaterThan(0);
      expect(thumbnailDrawing(f).strokes.some((s) => s.own)).toBe(true);
    }
  });

  it('uses straight lines only, inside the 96 by 64 grid', () => {
    for (const f of ARCHETYPE_FORMS) {
      for (const s of thumbnailDrawing(f).strokes) {
        expect(s.d).toMatch(/^[MLHVZ0-9. -]+$/);
        // Check x against the width and y against the height: M and L take x y, H x, V y.
        for (const [, cmd, args] of s.d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
          const ns = (args ?? '').trim().split(/\s+/).filter(Boolean).map(Number);
          const axes = cmd === 'H' ? ['x'] : cmd === 'V' ? ['y'] : cmd === 'Z' ? [] : ['x', 'y'];
          expect(ns.length, `${f} ${s.d}`).toBe(axes.length);
          ns.forEach((n, i) => {
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThanOrEqual(axes[i] === 'x' ? THUMB_W : THUMB_H);
          });
        }
      }
    }
  });

  it('shows neighbours exactly where the form has shared walls', () => {
    const neighbours = (f: (typeof ARCHETYPE_FORMS)[number]) =>
      thumbnailDrawing(f).strokes.filter((s) => !s.own).length;
    expect(neighbours('detached')).toBe(0);
    expect(neighbours('independent-house')).toBe(0);
    expect(neighbours('semi-detached')).toBeGreaterThan(0);
    expect(neighbours('mid-terrace')).toBeGreaterThan(neighbours('semi-detached'));
    expect(neighbours('enclosed-mid-terrace')).toBe(neighbours('mid-terrace') + 1);
  });

  it('is deterministic and distinct per form', () => {
    const ds = ARCHETYPE_FORMS.map((f) => JSON.stringify(thumbnailDrawing(f).strokes));
    expect(new Set(ds).size).toBe(ds.length);
    expect(JSON.stringify(thumbnailDrawing('flat'))).toBe(JSON.stringify(thumbnailDrawing('flat')));
  });
});
