/** Round 3 moments (WP-07): the shadow you cast, the ladder short name. */
import { describe, expect, it } from 'vitest';
import { castLosses } from '../src/city/cast.ts';
import { shortName } from '../src/city/CityStage.tsx';
import { cityModel } from '../src/city/model.ts';

describe('moment 7: the shadow you cast', () => {
  const model = cityModel({});
  const hero = model.hero!;
  const heroIds = new Set(hero.prisms.map((p) => p.id));
  const context = model.casters.filter((c) => !heroIds.has(c.id));
  const receivers = model.masses.map((m) => ({ id: m.id, ring: m.ring, height: m.likely }));
  it('no added floors, no loss; more floors never take less sun', () => {
    expect(castLosses({ hero, context, receivers, addedM: 0, place: model.place })).toHaveLength(0);
    const sum = (m: number): number =>
      castLosses({ hero, context, receivers, addedM: m, place: model.place }).reduce((a, l) => a + l.lostHours, 0);
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
