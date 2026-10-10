/**
 * Obligations (WP-03 M-B, C4): normalisation and the twin patch are idempotent.
 */
import type { Obligation } from '@ibasho/core';
import { parseTwin } from '@ibasho/core/schemas';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import gh1Json from '../../../fixtures/src/homes/gh1.twin.json' with { type: 'json' };
import { applyPatch } from '../pipeline/patch.ts';
import { normaliseObligations, obligationPatch } from './obligations.ts';

const gh1 = parseTwin(gh1Json);

const obligation: fc.Arbitrary<Obligation> = fc.oneof(
  fc.record({
    kind: fc.constant('max-u' as const),
    element: fc.constantFrom('wall' as const, 'roof' as const, 'floor' as const),
    maxU: fc.constantFrom(0.16, 0.25, 0.3, 0.55),
  }),
  fc.record({ kind: fc.constant('emitter-flow' as const), maxFlowC: fc.constantFrom(45, 50, 55) }),
  fc.record({
    kind: fc.constant('ventilation' as const),
    system: fc.constantFrom(
      'natural' as const,
      'intermittent-extract' as const,
      'mev' as const,
      'mvhr' as const,
    ),
    category: fc.constantFrom('B' as const, 'C' as const),
  }),
  fc.constant({ kind: 'hp-meets-design-load' as const }),
  fc.record({
    kind: fc.constant('assessment' as const),
    check: fc.constantFrom('moisture-assessment' as const, 'pas2035-assessment' as const),
  }),
);

describe('normaliseObligations', () => {
  it('keeps the strictest of each kind', () => {
    expect(
      normaliseObligations([
        { kind: 'max-u', element: 'wall', maxU: 0.55 },
        { kind: 'max-u', element: 'wall', maxU: 0.3 },
        { kind: 'ventilation', system: 'intermittent-extract', category: 'B' },
        { kind: 'ventilation', system: 'mev', category: 'C' },
      ]),
    ).toEqual([
      { kind: 'max-u', element: 'wall', maxU: 0.3 },
      { kind: 'ventilation', system: 'mev', category: 'C' },
    ]);
  });
  it('C4: idempotent, duplicate-free and order-free', () => {
    fc.assert(
      fc.property(fc.array(obligation, { maxLength: 12 }), (xs) => {
        const n = normaliseObligations(xs);
        expect(normaliseObligations(n)).toEqual(n);
        expect(normaliseObligations([...xs, ...xs])).toEqual(n);
        expect(normaliseObligations([...xs].reverse())).toEqual(n);
      }),
    );
  });
});

describe('obligationPatch', () => {
  it('sets every wall above 0.30 to 0.30 and leaves the rest', () => {
    const { patch, unpatched } = obligationPatch(gh1, [
      { kind: 'max-u', element: 'wall', maxU: 0.3 },
      { kind: 'emitter-flow', maxFlowC: 55 },
    ]);
    expect(patch.set.map((s) => s.path)).toEqual(['/elements/0/u', '/elements/1/u']);
    expect(unpatched).toEqual([{ kind: 'emitter-flow', maxFlowC: 55 }]);
  });
  it('C4: applying the patch twice equals applying it once', () => {
    fc.assert(
      fc.property(fc.array(obligation, { maxLength: 8 }), (xs) => {
        const once = applyPatch(gh1, obligationPatch(gh1, xs).patch);
        const twice = applyPatch(once, obligationPatch(once, xs).patch);
        expect(twice).toEqual(once);
        expect(obligationPatch(once, xs).patch.set).toEqual([]);
      }),
    );
  });
});
