import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compareStrings, isIsoDate, isSemVer, regionContains } from '../src/common.ts';
import {
  choiceValue,
  isMaterialUnknown,
  known,
  type NumField,
  numCentral,
  numRange,
  type Tri,
  triAnd,
  triNot,
  triOr,
} from '../src/fields.ts';
import { FixedPointError } from '../src/fixed/index.ts';
import { IntervalError, Iv, IvBig, ival } from '../src/ival.ts';
import { type Expr, exprFacts, exprFns } from '../src/rules.ts';
import {
  convert,
  kgFromG,
  kwhFromWh,
  microPenceFromPence,
  microPenceFromPounds,
  pencesFromMicroPence,
  poundsFromMicroPence,
  quantise,
  UnitError,
  whFromKwh,
} from '../src/units.ts';

describe('common', () => {
  it('validates calendar dates', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2023-02-29')).toBe(false);
    expect(isIsoDate('2100-02-29')).toBe(false);
    expect(isIsoDate('2000-02-29')).toBe(true);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-04-31')).toBe(false);
    expect(isIsoDate('2026-04-00')).toBe(false);
    expect(isIsoDate('26-04-01')).toBe(false);
  });
  it('validates semver and regions', () => {
    expect(isSemVer('1.2.3')).toBe(true);
    expect(isSemVer('01.2.3')).toBe(false);
    expect(regionContains('GB', 'GB-ENG')).toBe(true);
    expect(regionContains('GB-ENG', 'GB')).toBe(false);
    expect(regionContains('IN', 'IN-TG')).toBe(true);
    expect(regionContains('GB', 'IN')).toBe(false);
  });
  it('compares strings by code unit', () => {
    expect(['b', 'B', 'a', 'é'].sort(compareStrings)).toEqual(['B', 'a', 'b', 'é']);
    expect(compareStrings('a', 'a')).toBe(0);
  });
});

describe('Kleene logic', () => {
  const vals: Tri[] = [true, false, 'unknown'];
  const completions = (x: Tri): boolean[] => (x === 'unknown' ? [true, false] : [x]);
  const agree = (r: Tri, outcomes: boolean[]) =>
    r === 'unknown' ? new Set(outcomes).size === 2 : outcomes.every((o) => o === r);

  it('is the strongest sound three-valued logic (every completion agrees)', () => {
    for (const a of vals) {
      expect(
        agree(
          triNot(a),
          completions(a).map((x) => !x),
        ),
      ).toBe(true);
      for (const b of vals) {
        const pairs = completions(a).flatMap((x) => completions(b).map((y) => [x, y] as const));
        expect(
          agree(
            triAnd(a, b),
            pairs.map(([x, y]) => x && y),
          ),
        ).toBe(true);
        expect(
          agree(
            triOr(a, b),
            pairs.map(([x, y]) => x || y),
          ),
        ).toBe(true);
      }
    }
    expect(triAnd()).toBe(true);
    expect(triOr()).toBe(false);
  });
});

describe('fields', () => {
  it('central values and ranges', () => {
    const k = known(3);
    expect(numCentral(k)).toBe(3);
    expect(numRange(k)).toEqual({ lo: 3, hi: 3 });
    const e: NumField = { state: 'estimated', value: 1.5, range: [1.2, 1.9], source: { kind: 'stated' } };
    expect(numCentral(e)).toBe(1.5);
    expect(numRange(e)).toEqual({ lo: 1.2, hi: 1.9 });
    const u = {
      state: 'unknown',
      range: [2, 4],
      material: true,
      source: { kind: 'default', pluginId: 'x' },
    } as const;
    expect(numCentral({ ...u, range: [2, 4] })).toBe(3);
    expect(isMaterialUnknown({ ...u, range: [2, 4] })).toBe(true);
    expect(isMaterialUnknown(k)).toBe(false);
    expect(choiceValue({ state: 'known', value: 'gas', source: { kind: 'stated' } })).toBe('gas');
    expect(
      choiceValue({ state: 'unknown', options: ['a'], material: false, source: { kind: 'stated' } }),
    ).toBeUndefined();
  });
});

describe('intervals', () => {
  it('arithmetic', () => {
    const a = ival(1, 2);
    const b = ival(-3, 4);
    expect(Iv.add(a, b)).toEqual({ lo: -2, hi: 6 });
    expect(Iv.sub(a, b)).toEqual({ lo: -3, hi: 5 });
    expect(Iv.neg(a)).toEqual({ lo: -2, hi: -1 });
    expect(Iv.scale(a, -2)).toEqual({ lo: -4, hi: -2 });
    expect(Iv.scale(a, 2)).toEqual({ lo: 2, hi: 4 });
    expect(Iv.mul(a, b)).toEqual({ lo: -6, hi: 8 });
    expect(Iv.hull(a, b)).toEqual({ lo: -3, hi: 4 });
    expect(Iv.intersect(a, b)).toEqual({ lo: 1, hi: 2 });
    expect(Iv.intersect(a, ival(5, 6))).toBeNull();
    expect(Iv.contains(a, 1.5)).toBe(true);
    expect(Iv.containsIval(b, a)).toBe(true);
    expect(Iv.width(b)).toBe(7);
    expect(Iv.mid(b)).toBe(0.5);
    expect(Iv.isPoint(Iv.point(3))).toBe(true);
    expect(Iv.of(2)).toEqual({ lo: 2, hi: 2 });
  });
  it('mul encloses every product', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e3, max: 1e3, noNaN: true }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        (x, w) => {
          const a = ival(x, x + w);
          const p = Iv.mul(a, a);
          expect(Iv.contains(p, x * x)).toBe(true);
        },
      ),
    );
  });
  it('rejects empty and NaN intervals', () => {
    expect(() => ival(2, 1)).toThrow(IntervalError);
    expect(() => ival(Number.NaN)).toThrow(IntervalError);
    expect(() => IvBig.of(2n, 1n)).toThrow(IntervalError);
  });
  it('bigint intervals', () => {
    const a = IvBig.of(1n, 3n);
    expect(IvBig.add(a, IvBig.of(2n))).toEqual({ lo: 3n, hi: 5n });
    expect(IvBig.sub(a, IvBig.of(1n, 2n))).toEqual({ lo: -1n, hi: 2n });
    expect(IvBig.contains(a, 3n)).toBe(true);
  });
});

describe('units and quantisation', () => {
  it('quantises half even, exactly', () => {
    expect(quantise(2.5)).toBe(2n);
    expect(quantise(3.5)).toBe(4n);
    expect(quantise(-2.5)).toBe(-2n);
    expect(quantise(-3.5)).toBe(-4n);
    expect(quantise(1.4999999999999998)).toBe(1n);
    expect(quantise(2 ** 60)).toBe(2n ** 60n);
    expect(() => quantise(Number.NaN)).toThrow(FixedPointError);
    expect(() => quantise(Number.POSITIVE_INFINITY)).toThrow(FixedPointError);
  });
  it('quantise is within half a unit', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e12, max: 1e12, noNaN: true }), (x) => {
        expect(Math.abs(Number(quantise(x)) - x)).toBeLessThanOrEqual(0.5);
      }),
    );
  });
  it('converts linear units and temperatures', () => {
    expect(convert(1.5, 'kWh', 'Wh')).toBe(1500);
    expect(convert(50, '%', '1')).toBe(0.5);
    expect(convert(20, 'degC', 'K')).toBeCloseTo(293.15);
    expect(convert(300, 'K', 'degC')).toBeCloseTo(26.85);
    expect(convert(7, 'W', 'W')).toBe(7);
    expect(() => convert(1, 'kWh', 'W')).toThrow(UnitError);
    expect(() => convert(1, 'dB(A)', 'W')).toThrow(UnitError);
  });
  it('money and energy helpers are exact', () => {
    expect(whFromKwh(1.2345)).toBe(1234n);
    expect(kwhFromWh(1500n)).toBe(1.5);
    expect(microPenceFromPounds('12.34')).toBe(1_234_000_000n);
    expect(microPenceFromPence('26.32')).toBe(26_320_000n);
    expect(poundsFromMicroPence(1_234_000_000n)).toBe('12.34000000');
    expect(pencesFromMicroPence(2_500_000n)).toBe(2n);
    expect(kgFromG(2500n)).toBe(2.5);
  });
});

describe('expression walkers', () => {
  it('collect named functions and facts', () => {
    const e: Expr = {
      and: [
        { cmp: '<=', left: { fact: 'm.u' }, right: { fact: 'h.limit' } },
        { or: [{ in: { fact: 'h.tenure' }, set: ['owner'] }, { not: { const: 'unknown' } }] },
        { fn: 'mcs020a_Lp_le', args: [{ fact: 'p.lp' }] },
        { fn: 'adf_category', args: [{ fact: 'p.ap50' }] },
        { cmp: '=', left: { fact: 'm.u' }, right: 3 },
      ],
    };
    expect(exprFns(e)).toEqual(['adf_category', 'mcs020a_Lp_le']);
    expect(exprFacts(e)).toEqual(['h.limit', 'h.tenure', 'm.u', 'p.ap50', 'p.lp']);
  });
});

describe('small contract helpers', () => {
  it('ops: read-only vs mutating', async () => {
    const { isMutatingOp } = await import('../src/ai/ops.ts');
    expect(isMutatingOp({ op: 'explain', evidenceId: 'ev_1' })).toBe(false);
    expect(isMutatingOp({ op: 'compare', scenarioIds: ['a', 'b'] })).toBe(false);
    expect(isMutatingOp({ op: 'setBudget', capGBP: 15000 })).toBe(true);
  });

  it('stage order and package status codes are stable', async () => {
    const { STAGE_ORDER } = await import('../src/engine.ts');
    const { PACKAGE_STATUS } = await import('../src/api.ts');
    expect(STAGE_ORDER[0]).toBe('geometry');
    expect(STAGE_ORDER.at(-1)).toBe('delivered');
    expect(new Set(STAGE_ORDER).size).toBe(10);
    expect(PACKAGE_STATUS).toEqual({ feasible: 0, 'needs-check': 1, blocked: 2, 'target-miss': 3 });
  });
});
