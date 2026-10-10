/** SVG renderer data half: same camera as WebGL, painter's order, every drawn element present. */
import { describe, expect, it } from 'vitest';
import { composeView } from '../src/camera/compose.ts';
import { fitCamera } from '../src/camera/model.ts';
import { palette } from '../src/colour/palette.ts';
import { plinthOf, svgItems, svgJunctions } from '../src/svg/project.ts';
import { drawnIds } from '../src/twin/house.ts';
import { house } from './helpers.ts';

const camera = fitCamera(
  { azimuthDeg: 45, elevationDeg: 30, distance: 40, viewport: { width: 960, height: 600 } },
  house.surfaces.flatMap((s) => s.polygon),
);

describe('svg projection', () => {
  const composed = composeView(house, {
    view: 'cutaway',
    azimuthDeg: 45,
    elevationDeg: 30,
    roofLiftM: 2,
    ceiling: 0,
  });
  const items = svgItems(house, composed, camera, palette('hiru'));

  it('sorts far to near (painter order)', () => {
    for (let i = 1; i < items.length; i++)
      expect(items[i - 1]!.depth).toBeGreaterThanOrEqual(items[i]!.depth);
    expect(items[0]!.key.startsWith('plinth:')).toBe(true);
  });

  it('draws every element the house model draws, except those the view hides', () => {
    const shown = new Set(items.flatMap((i) => (i.elementId ? [i.elementId] : [])));
    const hiddenOnly = new Set(
      composed.filter((c) => c.mode === 'hidden' && c.surface.elementId).map((c) => c.surface.elementId!),
    );
    for (const id of drawnIds(house).elements) expect(shown.has(id) || hiddenOnly.has(id)).toBe(true);
  });

  it('cutaway draws the camera-facing party wall as a dashed section outline', () => {
    const cut = items.filter((i) => i.cut);
    for (const c of cut) {
      expect(c.fill).toBe('none');
      expect(c.dashed).toBe(true);
    }
  });

  it('paths are well formed and keys unique', () => {
    const keys = items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const i of items) expect(i.d).toMatch(/^M-?\d/);
    for (const j of svgJunctions(house, camera)) expect(j.d).toMatch(/^M-?\d[^NI]*$/);
  });

  it('the plinth extends further on the street side', () => {
    const p = plinthOf(house);
    const f = house.footprint;
    const n = house.frontNormal;
    if (Math.abs(n[2]) >= Math.abs(n[0])) {
      const front = n[2] < 0 ? f.z0 - p.z0 : p.z1 - f.z1;
      const back = n[2] < 0 ? p.z1 - f.z1 : f.z0 - p.z0;
      expect(front).toBeGreaterThan(back);
    } else {
      const front = n[0] < 0 ? f.x0 - p.x0 : p.x1 - f.x1;
      const back = n[0] < 0 ? p.x1 - f.x1 : f.x0 - p.x0;
      expect(front).toBeGreaterThan(back);
    }
  });
});
