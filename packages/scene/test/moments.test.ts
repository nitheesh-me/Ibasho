/** Round 3 moments (WP-07): the shadow you cast, the ladder short name. */
import { describe, expect, it } from 'vitest';
import gb1 from '../../fixtures/src/buildings/gb1.building.json' with { type: 'json' };
import rad from '../../fixtures/src/preview/gb1/radiation.json' with { type: 'json' };
import { diffOf } from '../src/city/CityCompare.tsx';
import { shortName } from '../src/city/CityStage.tsx';
import { castLosses } from '../src/city/cast.ts';
import { heroFromDoc } from '../src/city/hero.ts';
import { cityModel } from '../src/city/model.ts';
import { annualKwh, surfaceKey } from '../src/city/preview.ts';

describe('moment 7: the shadow you cast', () => {
  const model = cityModel({});
  const hero = model.hero!;
  const heroIds = new Set(hero.prisms.map((p) => p.id));
  const context = model.casters.filter((c) => !heroIds.has(c.id));
  const receivers = model.masses.map((m) => ({ id: m.id, ring: m.ring, height: m.likely }));
  it('no added floors, no loss; more floors never take less sun', () => {
    expect(castLosses({ hero, context, receivers, addedM: 0, place: model.place })).toHaveLength(0);
    const sum = (m: number): number =>
      castLosses({ hero, context, receivers, addedM: m, place: model.place }).reduce(
        (a, l) => a + l.lostHours,
        0,
      );
    const a = sum(8);
    const b = sum(40);
    expect(b).toBeGreaterThanOrEqual(a);
    expect(b).toBeGreaterThan(0);
  });
});

describe('ladder name', () => {
  it('keeps two words and drops codes and brackets', () => {
    expect(shortName('Vindhya Bhavan')).toBe('Vindhya Bhavan');
    expect(shortName('Vindhya Bhavan (GB1) research block')).toBe('Vindhya Bhavan');
    expect(shortName('GB2 Himalaya')).toBe('Himalaya');
  });
});

describe('radiation paint matches preview results (studio round 3)', () => {
  it('finds a value for walls and roofs drawn from the document, from JSON shaped results', () => {
    const hero = heroFromDoc(gb1 as never);
    const surfaces = (rad as unknown as { surfaces: { id: string; irrWhm2: string[] }[] }).surfaces;
    const by = new Map(surfaces.map((s) => [surfaceKey(s.id), s]));
    const painted = hero.surfaces.filter(
      (s) => (s.kind === 'wall' || s.kind === 'roof') && by.has(surfaceKey(s.id)),
    );
    expect(painted.length).toBeGreaterThan(100);
    const k = annualKwh(by.get(surfaceKey(painted[0]!.id)) as never);
    expect(k).toBeGreaterThan(100);
    expect(k).toBeLessThan(2500);
  });
});

describe('compare: what differs', () => {
  it('names the change, its direction and the facade where it is largest', () => {
    const base = {
      lens: 'radiation' as const,
      value: 800,
      unit: 'kWh/m²·yr',
      label: 'Radiation on the walls',
      lowerIsBetter: true,
      bins: { NE: 600, SW: 1000 },
    };
    const opt = { ...base, value: 860, bins: { NE: 610, SW: 1120 } };
    const d = diffOf(base, opt, 'radiation', false)!;
    expect(d.tone).toBe('worse');
    expect(d.text).toContain('+60');
    expect(d.text).toContain('SW');
    expect(d.emphasis).toEqual({ bins: ['SW'], tone: 'more' });
    expect(diffOf(base, base, 'radiation', true)!.tone).toBe('same');
    expect(diffOf(base, opt, 'daylight', false)).toBeNull();
  });
});
