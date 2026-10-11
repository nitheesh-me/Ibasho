import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GH_COMPONENTS, type GhProperty, type GhUsageRow } from '@ibasho/core';
import { describe, expect, it } from 'vitest';
import { annualise, assessProperty, carbonKg, scoreProperty } from '../src/engine/index.ts';

const DIR = join(import.meta.dirname, '..', '..', '..', 'packages/fixtures/src/portfolio');
const props = JSON.parse(readFileSync(join(DIR, 'properties.json'), 'utf8')) as GhProperty[];
const usage = JSON.parse(readFileSync(join(DIR, 'energy_usage.json'), 'utf8')) as GhUsageRow[];
const p1 = props[0] as GhProperty;
const u1 = usage.filter((u) => u.propertyId === 'P10001');

describe('Green Home Score (brief section 2)', () => {
  it('weights are exactly 1/4, 1/5, 3/20, 3/20, 1/10, 1/10, 1/20', () => {
    expect(GH_COMPONENTS.map((c) => `${c.weight.n}/${c.weight.d}`)).toEqual(['1/4', '1/5', '3/20', '3/20', '1/10', '1/10', '1/20']);
    expect(GH_COMPONENTS.reduce((s, c) => s + (c.weight.n * 20) / c.weight.d, 0)).toBe(20);
  });
  it('P10001 scores 38, Poor, and the score is the rounded weighted sum', () => {
    const s = scoreProperty(p1, annualise(u1, p1.floorAreaM2, '2026-10-11'));
    expect(s.score).toBe(38);
    expect(s.band).toBe('Poor');
    expect(s.score).toBe(Math.floor(s.exact + 0.5));
  });
  it('a better state never scores lower', () => {
    const a = annualise(u1, p1.floorAreaM2, '2026-10-11');
    const base = scoreProperty(p1, a).score;
    const better: GhProperty[] = [
      { ...p1, glazing: 'double' },
      { ...p1, insulation: { ...p1.insulation, loftMm: 270 } },
      { ...p1, insulation: { ...p1.insulation, wall: 'cavity-filled' } },
      { ...p1, heating: 'heat-pump' },
      { ...p1, solarKwp: 3 },
      { ...p1, smartControls: 'smart-thermostat' },
      { ...p1, sapRating: 70, energyRating: 'C' },
    ];
    for (const b of better) expect(scoreProperty(b, a).score).toBeGreaterThanOrEqual(base);
  });
});

describe('annualising meter data', () => {
  it('missing months are scaled or unavailable, never zero', () => {
    const gaps = u1.map((r, i) => (i >= 12 && i < 21 ? { ...r, gasKwh: null } : r));
    const a = annualise(gaps, p1.floorAreaM2, '2026-10-11');
    expect(a.gas.kwh).toBeNull();
    expect(a.gas.method).toBe('insufficient');
    expect(a.intensityKwhM2).toBeNull();
  });
});

describe('assessment (brief sections 3 to 7)', () => {
  const a = assessProperty(p1, u1);
  it('flags P10001 as poor with issues and an available potential', () => {
    expect(a.poor.flagged).toBe(true);
    expect(a.poor.issues.length).toBeGreaterThan(2);
    expect(a.potential.status).toBe('available');
  });
  it('listed savings sum to the whole-package run; heat pump raises electricity', () => {
    const chosen = a.recommendations.filter((r) => a.package?.retrofitIds.includes(r.retrofitId));
    expect(chosen.reduce((s, r) => s + r.saving.electricityKwh, 0)).toBe(a.package?.saving.electricityKwh);
    expect(chosen.reduce((s, r) => s + r.saving.gasKwh, 0)).toBe(a.package?.saving.gasKwh);
    expect(a.recommendations.find((r) => r.retrofitId === 'heat-pump')?.saving.electricityKwh).toBeLessThan(0);
    const ids = a.recommendations.map((r) => r.retrofitId);
    expect(ids.indexOf('cavity-wall')).toBeLessThan(ids.indexOf('heat-pump'));
  });
  it('carbon follows the per-fuel factors; value is a range', () => {
    const s = a.package?.saving;
    expect(s?.carbonKg).toBe(carbonKg(s?.electricityKwh ?? 0, s?.gasKwh ?? 0));
    expect(a.value.valueGBP?.lo).toBeLessThanOrEqual(a.value.valueGBP?.hi ?? 0);
  });
  it('a what-if reruns with only the chosen retrofits; no meters means potential unavailable', () => {
    const w = assessProperty(p1, u1, { retrofits: ['cavity-wall', 'smart-thermostat'] });
    expect(w.package?.retrofitIds).toEqual(['cavity-wall', 'smart-thermostat']);
    expect(w.package?.saving.totalKwh).toBeLessThan(a.package?.saving.totalKwh ?? 0);
    expect(assessProperty(p1, []).potential.status).toBe('unavailable');
  });
});
