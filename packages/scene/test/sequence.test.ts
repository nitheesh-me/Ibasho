/** Roof-lift keyframes (SV 3.1) and the perspective to orthographic blend. */
import { describe, expect, it } from 'vitest';
import {
  blendMatrices,
  type CameraSequence,
  ROOF_LIFT,
  reducedSequence,
  sampleSequence,
  sequenceDuration,
} from '../src/camera/sequence.ts';

describe('camera sequence', () => {
  it('keys are in time order and the roof lift lands orthographic, lifted and dissolved', () => {
    const ts = ROOF_LIFT.keys.map((k) => k.t);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
    const end = ROOF_LIFT.keys.at(-1)!;
    expect(end.ortho).toBe(1);
    expect(end.roofLiftM).toBe(2);
    expect(end.ceiling).toBe(0);
    expect(sequenceDuration(ROOF_LIFT)).toBe(end.t);
  });

  it('hits every key exactly and clamps outside the range', () => {
    for (const k of ROOF_LIFT.keys) expect(sampleSequence(ROOF_LIFT, k.t)).toEqual(k);
    expect(sampleSequence(ROOF_LIFT, -5)).toEqual(ROOF_LIFT.keys[0]);
    expect(sampleSequence(ROOF_LIFT, 99)).toEqual(ROOF_LIFT.keys.at(-1));
  });

  it('interpolates within the bracketing keys (no overshoot with smoothstep)', () => {
    let prevOrtho = 0;
    let prevLift = 0;
    for (let t = 0; t <= sequenceDuration(ROOF_LIFT); t += 0.05) {
      const s = sampleSequence(ROOF_LIFT, t);
      expect(s.ortho).toBeGreaterThanOrEqual(prevOrtho - 1e-12);
      expect(s.roofLiftM).toBeGreaterThanOrEqual(prevLift - 1e-12);
      expect(s.ortho).toBeLessThanOrEqual(1);
      expect(s.roofLiftM).toBeLessThanOrEqual(2);
      prevOrtho = s.ortho;
      prevLift = s.roofLiftM;
    }
  });

  it('linear ease gives the midpoint at half time', () => {
    const seq: CameraSequence = {
      id: 'lin',
      ease: 'linear',
      keys: [
        { ...ROOF_LIFT.keys[0]!, t: 0, distance: 10 },
        { ...ROOF_LIFT.keys[0]!, t: 2, distance: 20 },
      ],
    };
    expect(sampleSequence(seq, 1).distance).toBeCloseTo(15, 12);
  });

  it('reduced motion is the end state at once', () => {
    const r = reducedSequence(ROOF_LIFT);
    expect(r.keys).toHaveLength(1);
    expect(sequenceDuration(r)).toBe(0);
    const { t: _t, ...end } = ROOF_LIFT.keys.at(-1)!;
    const { t: _t0, ...got } = sampleSequence(r, 0);
    expect(got).toEqual(end);
  });

  it('throws on an empty sequence', () => {
    expect(() => sampleSequence({ id: 'x', ease: 'linear', keys: [] }, 0)).toThrow(/no keys/);
  });

  it('blendMatrices is exact at both ends', () => {
    const a = Array.from({ length: 16 }, (_, i) => i * 0.37 - 2);
    const b = Array.from({ length: 16 }, (_, i) => 5 - i * 0.11);
    expect(blendMatrices(a, b, 0)).toEqual(a);
    expect(blendMatrices(a, b, 1)).toEqual(b);
    expect(blendMatrices(a, b, 0.5)[3]).toBeCloseTo((a[3]! + b[3]!) / 2, 12);
  });
});
