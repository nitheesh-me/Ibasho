import { createRegistry } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import {
  climateEngineModule,
  LONDON_CLIMATE_ID,
  londonClimate,
  planeIrradiance,
} from '../src/engine/index.ts';

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
    // BP 4.3 London, monthly columns (kWh/m2 per month, January first).
    expect(londonClimate.irradiance(180, 90)).toEqual([55, 61, 82, 89, 90, 87, 89, 86, 86, 73, 56, 49]);
    expect(londonClimate.irradiance(90, 90)).toEqual([20, 29, 52, 74, 91, 95, 95, 78, 61, 38, 22, 16]);
    expect(londonClimate.irradiance(0, 90)).toEqual([10, 16, 31, 45, 62, 69, 66, 51, 35, 21, 11, 8]);
    expect(londonClimate.irradiance(270, 90)).toEqual(londonClimate.irradiance(90, 90));
    expect(londonClimate.irradiance(360, 90)).toEqual(londonClimate.irradiance(0, 90));
    expect(londonClimate.irradiance(-90, 90)).toEqual(londonClimate.irradiance(270, 90));
    // The table's year row is rounded on its own, so monthly sums may differ from it by 1.
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const year: [number, number, number][] = [
      [180, 90, 902],
      [90, 90, 672],
      [0, 90, 425],
      [0, 0, 1073],
    ];
    for (const [az, tilt, total] of year) {
      expect(Math.abs(sum(londonClimate.irradiance(az, tilt)) - total)).toBeLessThanOrEqual(1);
    }
  });

  it('interpolates between orientations and tilts', () => {
    const se = londonClimate.irradiance(135, 90);
    const s = londonClimate.irradiance(180, 90);
    const e = londonClimate.irradiance(90, 90);
    se.forEach((v, m) => {
      expect(v).toBeCloseTo((s[m]! + e[m]!) / 2, 10);
    });
    const half = londonClimate.irradiance(180, 45);
    half.forEach((v, m) => {
      expect(v).toBeCloseTo((s[m]! + londonClimate.months[m]!.ghi) / 2, 10);
    });
  });

  it('rejects impossible planes', () => {
    expect(() => planeIrradiance({ ghi: [], north: [], east: [], south: [], west: [] }, 0, -5)).toThrow();
    expect(() => londonClimate.irradiance(Number.NaN, 90)).toThrow();
  });
});
