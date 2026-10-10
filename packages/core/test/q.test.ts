import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { gcd, Q, RationalError } from '../src/exact/q.ts';

const arbQ = fc
  .tuple(fc.bigInt(-(10n ** 12n), 10n ** 12n), fc.bigInt(1n, 10n ** 9n))
  .map(([n, d]) => Q.of(n, d));

describe('Q construction', () => {
  it('normalises sign and gcd', () => {
    expect(Q.of(6, -4)).toEqual({ n: -3n, d: 2n });
    expect(Q.of(0, 5)).toEqual({ n: 0n, d: 1n });
    expect(Q.of(3n)).toEqual({ n: 3n, d: 1n });
  });

  it('rejects zero denominators and unsafe numbers', () => {
    expect(() => Q.of(1, 0)).toThrow(RationalError);
    expect(() => Q.of(0.5, 1)).toThrow(RationalError);
    expect(() => Q.of(2 ** 60, 1)).toThrow(RationalError);
  });

  it('gcd', () => {
    expect(gcd(12n, -18n)).toBe(6n);
    expect(gcd(0n, 0n)).toBe(0n);
  });
});

describe('Q arithmetic', () => {
  it('sums the SPEC R2 weights to one', () => {
    const w = ['1/5', '1/5', '3/20', '3/20', '1/10', '1/10', '1/10'].map(Q.fromWire);
    expect(Q.eq(Q.sum(w), Q.ONE)).toBe(true);
  });

  it('field laws hold', () => {
    fc.assert(
      fc.property(arbQ, arbQ, arbQ, (a, b, c) => {
        expect(Q.add(a, b)).toEqual(Q.add(b, a));
        expect(Q.add(Q.add(a, b), c)).toEqual(Q.add(a, Q.add(b, c)));
        expect(Q.mul(a, Q.add(b, c))).toEqual(Q.add(Q.mul(a, b), Q.mul(a, c)));
        expect(Q.sub(a, a)).toEqual(Q.ZERO);
        if (!Q.isZero(b)) expect(Q.mul(Q.div(a, b), b)).toEqual(a);
        expect(Q.isQ(Q.add(a, b))).toBe(true);
      }),
    );
  });

  it('orders consistently', () => {
    fc.assert(
      fc.property(arbQ, arbQ, (a, b) => {
        expect(Q.cmp(a, b)).toBe(-Q.cmp(b, a) || 0);
        expect(Q.le(Q.min(a, b), Q.max(a, b))).toBe(true);
        expect(Q.lt(a, b)).toBe(Q.cmp(a, b) < 0);
      }),
    );
  });

  it('neg, abs, clamp', () => {
    expect(Q.neg(Q.of(1, 2))).toEqual({ n: -1n, d: 2n });
    expect(Q.abs(Q.of(-3, 4))).toEqual({ n: 3n, d: 4n });
    expect(Q.clamp(Q.of(3, 2), Q.ZERO, Q.ONE)).toEqual(Q.ONE);
    expect(Q.clamp(Q.of(-1, 2), Q.ZERO, Q.ONE)).toEqual(Q.ZERO);
    expect(Q.clamp(Q.of(1, 2), Q.ZERO, Q.ONE)).toEqual(Q.of(1, 2));
    expect(() => Q.clamp(Q.ZERO, Q.ONE, Q.ZERO)).toThrow(RationalError);
    expect(() => Q.div(Q.ONE, Q.ZERO)).toThrow(RationalError);
  });

  it('floor, rounding and scaling', () => {
    expect(Q.floor(Q.of(7, 2))).toBe(3n);
    expect(Q.floor(Q.of(-7, 2))).toBe(-4n);
    expect(Q.floor(Q.of(-6, 2))).toBe(-3n);
    expect(Q.roundHalfEven(Q.of(5, 2))).toBe(2n);
    expect(Q.roundHalfEven(Q.of(7, 2))).toBe(4n);
    expect(Q.toScaled(Q.of(2, 3), 3)).toBe(667n);
    expect(Q.toNumber(Q.of(1, 4))).toBe(0.25);
  });
});

describe('Q decimal and wire forms', () => {
  it('parses decimals exactly', () => {
    expect(Q.fromDecimal('0.15')).toEqual({ n: 3n, d: 20n });
    expect(Q.fromDecimal('-2.50')).toEqual({ n: -5n, d: 2n });
    expect(Q.fromDecimal('4')).toEqual({ n: 4n, d: 1n });
    expect(() => Q.fromDecimal('1/2')).toThrow(RationalError);
  });

  it('wire round-trips and rejects non-canonical forms', () => {
    fc.assert(
      fc.property(arbQ, (q) => {
        expect(Q.fromWire(Q.toWire(q))).toEqual(q);
      }),
    );
    expect(Q.toWire(Q.of(3, 1))).toBe('3');
    for (const bad of ['2/4', '1/1', '-0', '1/-2', '01/2', '1/0', 'x'])
      expect(() => Q.fromWire(bad)).toThrow(RationalError);
  });

  it('isQ rejects non-normalised and foreign values', () => {
    expect(Q.isQ({ n: 2n, d: 4n })).toBe(false);
    expect(Q.isQ({ n: 1n, d: -2n })).toBe(false);
    expect(Q.isQ({ n: 1, d: 2 })).toBe(false);
    expect(Q.isQ(null)).toBe(false);
    expect(Q.isQ(Q.of(1, 2))).toBe(true);
  });
});
