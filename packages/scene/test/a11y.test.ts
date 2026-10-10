/** `a11y-scene` outline parity (SPEC 5.3 AC-H1): outline ids equal the ids the scene draws. */
import { describe, expect, it } from 'vitest';
import { buildOutline, elementLabel, outlineTargets } from '../src/a11y/model.ts';
import { drawnIds } from '../src/twin/house.ts';
import { house, quantities, twin } from './helpers.ts';

describe('scene outline', () => {
  const groups = buildOutline(twin, quantities);
  const targets = outlineTargets(groups);

  it('every drawn element and junction has an outline item, and nothing extra', () => {
    const drawn = drawnIds(house);
    const els = new Set(targets.filter((t) => t.kind === 'element').map((t) => t.id));
    const jns = new Set(targets.filter((t) => t.kind === 'junction').map((t) => t.id));
    expect([...drawn.elements].sort()).toEqual([...els].sort());
    expect([...drawn.junctions].sort()).toEqual([...jns].sort());
    expect(jns.size).toBeGreaterThan(0);
  });

  it('every twin element appears once', () => {
    const els = targets.filter((t) => t.kind === 'element').map((t) => t.id);
    expect(new Set(els).size).toBe(els.length);
    expect(els.sort()).toEqual(twin.elements.map((e) => e.id).sort());
  });

  it('descriptions say modelled, not measured, and name the condition', () => {
    for (const g of groups)
      for (const it of g.items) {
        expect(it.description === 'No value yet.' || it.description.includes('Modelled, not measured.')).toBe(
          true,
        );
      }
    const withLoss = groups[0]!.items.find((i) => i.description.includes(' W on '));
    expect(withLoss?.description).toContain(quantities.condition.label);
  });

  it('labels read as words', () => {
    expect(elementLabel({ id: 'win-front-bay', kind: 'window' })).toBe('Window (front bay)');
    expect(elementLabel({ id: 'roof', kind: 'roof' })).toBe('Roof (roof)');
    expect(elementLabel({ id: 'wall-', kind: 'wall' })).toBe('Wall');
  });
});
