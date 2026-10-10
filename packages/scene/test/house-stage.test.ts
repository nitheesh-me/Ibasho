/** `HouseStage` prop resolution: the M-A defaults WP-08 relies on. */
import { describe, expect, it } from 'vitest';
import { HOUSE_STAGE_LAYERS, houseStageProps } from '../src/HouseStage.tsx';
import { quantities, twin } from './helpers.ts';

describe('houseStageProps', () => {
  it('defaults to the washi cutaway with heat-flow and zone tints, no pencil, no outline', () => {
    const p = houseStageProps({ twin }, null);
    expect(p.style).toBe('washi');
    expect(p.view).toBe('cutaway');
    expect(p.layers).toEqual(HOUSE_STAGE_LAYERS);
    expect(p.pencil).toBe(false);
    expect(p.showOutline).toBe(false);
    expect(p.result).toBeNull();
    expect('quantities' in p).toBe(false);
    expect('reducedMotion' in p).toBe(false);
  });

  it('passes quantities, style and layers through', () => {
    const p = houseStageProps({ twin, quantities, style: 'yoru', layers: [] }, null);
    expect(p.quantities).toBe(quantities);
    expect(p.style).toBe('yoru');
    expect(p.layers).toEqual([]);
  });

  it('lets the escape hatch override anything', () => {
    const p = houseStageProps({ twin, stage: { view: 'exterior', azimuthDeg: 135 } }, null);
    expect(p.view).toBe('exterior');
    expect(p.azimuthDeg).toBe(135);
  });
});
