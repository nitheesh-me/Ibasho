import { createRegistry } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { climateEngineModule, LONDON_CLIMATE_ID, londonClimate, planeIrradiance } from '../src/engine/index.ts';

describe('London climate pack (M-0)', () => {
  it('registers cleanly through its module (provenance, ids, dates)', async () => {
    const reg = createRegistry();
    reg.registerAll(await climateEngineModule.load());
    expect(reg.get('climate', LONDON_CLIMATE_ID).zone).toBe('uk-temperate');
  });

  it('has 12 finite months with the BP 4.3 annual mean', () => {
    expect(londonClimate.months).toHaveLength(12);
    const mean = londonClimate.months.reduce((s, m) => s + m.thetaE, 0) / 12;
    expect(mean).toBeCloseTo(10.4, 1);
    for (const m of londonClimate.months) {
      expect(m.thetaMin).toBeLessThan(m.thetaE);
      expect(m.thetaMax).toBeGreaterThan(m.thetaE);
      expect(m.windMs).toBeGreaterThan(0);
    }
  });

  it('reproduces the tabulated planes at the compass points', () => {
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(sum(londonClimate.irradiance(180, 90))).toBe(902);
    expect(sum(londonClimate.irradiance(90, 90))).toBe(672);
    expect(sum(londonClimate.irradiance(270, 90))).toBe(672);
    expect(sum(londonClimate.irradiance(0, 90))).toBe(425);
    expect(sum(londonClimate.irradiance(0, 0))).toBe(1073);
    expect(sum(londonClimate.irradiance(360, 90))).toBe(425);
    expect(sum(londonClimate.irradiance(-90, 90))).toBe(672);
  });

  it('interpolates between orientations and tilts', () => {
    const se = londonClimate.irradiance(135, 90);
    const s = londonClimate.irradiance(180, 90);
    const e = londonClimate.irradiance(90, 90);
    se.forEach((v, m) => expect(v).toBeCloseTo((s[m]! + e[m]!) / 2, 10));
    const half = londonClimate.irradiance(180, 45);
    half.forEach((v, m) => expect(v).toBeCloseTo((s[m]! + londonClimate.months[m]!.ghi) / 2, 10));
  });

  it('rejects impossible planes', () => {
    expect(() => planeIrradiance({ ghi: [], north: [], east: [], south: [], west: [] }, 0, -5)).toThrow();
    expect(() => londonClimate.irradiance(Number.NaN, 90)).toThrow();
  });
});
