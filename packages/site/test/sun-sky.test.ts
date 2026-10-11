import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  acos,
  asin,
  atan,
  atan2,
  decodeWeather,
  efficacy,
  julianDay,
  parseEpw,
  SHIPPED_WEATHER,
  skyCondition,
  skyPatches,
  skyVector,
  solarYear,
  spa,
  sunBins,
} from '../src/index.ts';
import { root } from './inputs.ts';

describe('NREL SPA (AC-LK1, SD V1)', () => {
  it('matches the paper golden vector within 1e-5 degrees', () => {
    const jd = julianDay(2003, 10, 17, 12, 30, 30, -7, 0);
    expect(jd).toBeCloseTo(2452930.312847, 6);
    const p = spa({
      jd,
      deltaT: 67,
      lat: 39.742476,
      lon: -105.1786,
      elevationM: 1830.14,
      pressureMbar: 820,
      tempC: 11,
    });
    expect(Math.abs(p.zenith - 50.11162)).toBeLessThan(1e-5);
    expect(Math.abs(p.azimuth - 194.34024)).toBeLessThan(1e-5);
  });

  it('puts the Hyderabad noon sun north of the zenith in June and south in December', () => {
    const at = (m: number, d: number) =>
      spa({
        jd: julianDay(2025, m, d, 12, 20, 0, 5.5),
        deltaT: 69,
        lat: 17.4453,
        lon: 78.349,
        elevationM: 545,
        pressureMbar: 950,
        tempC: 25,
      });
    const jun = at(6, 21);
    const dec = at(12, 21);
    expect(jun.azimuth < 30 || jun.azimuth > 330).toBe(true);
    expect(90 - jun.zenith).toBeGreaterThan(83);
    expect(Math.abs(dec.azimuth - 180)).toBeLessThan(10);
    expect(90 - dec.zenith).toBeCloseTo(49.1, 0);
  });
});

describe('deterministic inverse trigonometry', () => {
  it('agrees with the platform within 1e-15', () => {
    let worst = 0;
    for (let i = -4000; i <= 4000; i++) {
      const x = i / 400;
      const y = i / 4000;
      worst = Math.max(
        worst,
        Math.abs(atan(x) - Math.atan(x)),
        Math.abs(atan2(x, 0.3 - y) - Math.atan2(x, 0.3 - y)),
      );
      worst = Math.max(worst, Math.abs(asin(y) - Math.asin(y)), Math.abs(acos(y) - Math.acos(y)));
    }
    expect(worst).toBeLessThan(1e-15);
  });
});

describe('sky patches and the Perez sky', () => {
  it('Tregenza has 145 patches and Reinhart MF 2 has 577, each covering the hemisphere', () => {
    for (const [mf, n] of [
      [1, 145],
      [2, 577],
    ] as const) {
      const p = skyPatches(mf);
      expect(p.count).toBe(n);
      const total = p.omega.reduce((s, w) => s + w, 0);
      expect(total).toBeCloseTo(2 * Math.PI, 9);
    }
  });

  it('normalises each hour so the horizontal sum is the diffuse horizontal irradiance', () => {
    const p = skyPatches(1);
    const out = new Float64Array(p.count);
    const cond = skyCondition(600, 150, 35, 100);
    skyVector(p, [0.3, -0.4, Math.sqrt(1 - 0.25)], cond, 150, out);
    let h = 0;
    for (let i = 0; i < p.count; i++) h += (out[i] as number) * (p.dir[i * 3 + 2] as number);
    expect(h).toBeCloseTo(150, 9);
    // Circumsolar brightening: the patch nearest the sun is brighter than the one opposite.
    expect(Math.max(...out)).toBeGreaterThan(Math.min(...out) * 2);
  });

  it('gives plausible luminous efficacies (Perez 1990)', () => {
    const e = efficacy(skyCondition(700, 120, 30, 80), 15);
    expect(e.direct).toBeGreaterThan(80);
    expect(e.direct).toBeLessThan(115);
    expect(e.diffuse).toBeGreaterThan(100);
    expect(e.diffuse).toBeLessThan(140);
  });
});

describe('weather', () => {
  it('shipped Hyderabad weather is the TMYx EPW, byte for byte by hash, and parses the same', () => {
    const file = join(
      root,
      'docs/research/v3/sources/epw/IND_TG_Hyderabad-Gandhi.Intl.AP.431285_TMYx.2011-2025.epw',
    );
    const text = readFileSync(file, 'utf8');
    const epw = parseEpw(text, { id: 'tmyx', title: 'TMYx', retrieved: '2026-10-11' });
    const w = decodeWeather(SHIPPED_WEATHER['climate.hyderabad'] as never);
    expect(epw.hash).toBe(w.hash);
    expect(epw.ghiWhm2.length).toBe(8760);
    for (const h of [0, 12, 4000, 8759]) {
      expect(epw.ghiWhm2[h]).toBe(w.ghi[h]);
      expect(epw.dniWhm2[h]).toBe(w.dni[h]);
    }
    const annual = (a: ArrayLike<number>) => Array.from(a).reduce((s, v) => s + v, 0) / 1000;
    expect(annual(w.ghi)).toBeCloseTo(1907, -1);
  });

  it('rejects malformed EPW text', () => {
    expect(() => parseEpw('NOT,AN,EPW', { id: 'x', title: 'x', retrieved: '2026-10-11' })).toThrow(
      /LOCATION/,
    );
  });

  it('London DNI derived from PVGIS GHI and DHI closes the horizontal balance', () => {
    const w = decodeWeather(SHIPPED_WEATHER['climate.london'] as never);
    const y = solarYear(51.51, -0.13, 25, 0);
    let ghi = 0;
    let parts = 0;
    for (let h = 0; h < 8760; h++) {
      ghi += w.ghi[h] as number;
      parts += (w.dhi[h] as number) + (w.dni[h] as number) * Math.max(0, y.sun[h * 3 + 2] as number);
    }
    expect(Math.abs(parts - ghi) / ghi).toBeLessThan(0.02);
  });

  it('sun bins carry every sun-up hour once', () => {
    const w = decodeWeather(SHIPPED_WEATHER['climate.hyderabad'] as never);
    const y = solarYear(17.4453, 78.349, 545, 5.5);
    const bins = sunBins(y, w);
    const up = Array.from(y.zenith).filter((z) => z < 90).length;
    expect(bins.reduce((s, b) => s + b.hours, 0)).toBe(up);
    expect(up).toBeGreaterThan(4300);
    expect(up).toBeLessThan(4500);
  });
});
