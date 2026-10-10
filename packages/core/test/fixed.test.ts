import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyFactor,
  DF_SCALE,
  discountFactors,
  divRound,
  Fixed,
  FixedPointError,
  formatScaled,
  fromWire,
  growthFactors,
  mulDiv,
  parseScaled,
  percentToPpb,
  roundHalfEven,
  sumBig,
  toWire,
} from '../src/fixed/index.ts';
import vectors from './vectors/discount.json' with { type: 'json' };

/** Reference: exact rational rounding via scaled comparison, written differently on purpose. */
function refRoundHalfEven(n: bigint, d: bigint): bigint {
  if (d < 0n) return refRoundHalfEven(-n, -d);
  const neg = n < 0n;
  const a = neg ? -n : n;
  let q = a / d;
  const r = a - q * d;
  if (r * 2n > d || (r * 2n === d && q % 2n === 1n)) q += 1n;
  return neg ? -q : q;
}

describe('roundHalfEven', () => {
  it.each([
    [5n, 2n, 2n],
    [7n, 2n, 4n],
    [-5n, 2n, -2n],
    [-7n, 2n, -4n],
    [1n, 3n, 0n],
    [2n, 3n, 1n],
    [-2n, 3n, -1n],
    [5n, -2n, -2n],
    [10n, 5n, 2n],
    [0n, 7n, 0n],
  ])('%s / %s = %s', (n, d, q) => {
    expect(roundHalfEven(n, d)).toBe(q);
  });

  it('agrees with an independent reference', () => {
    fc.assert(
      fc.property(fc.bigInt(-(10n ** 30n), 10n ** 30n), fc.bigInt(-(10n ** 15n), 10n ** 15n), (n, d) => {
        fc.pre(d !== 0n);
        expect(roundHalfEven(n, d)).toBe(refRoundHalfEven(n, d));
      }),
    );
  });

  it('is within half a unit of the exact quotient', () => {
    fc.assert(
      fc.property(fc.bigInt(-(10n ** 20n), 10n ** 20n), fc.bigInt(1n, 10n ** 12n), (n, d) => {
        const q = roundHalfEven(n, d);
        const err = 2n * (n - q * d);
        expect(err <= d && err >= -d).toBe(true);
      }),
    );
  });

  it('rejects division by zero', () => {
    expect(() => roundHalfEven(1n, 0n)).toThrow(FixedPointError);
    expect(() => divRound(1n, 0n)).toThrow(FixedPointError);
  });
});

describe('divRound and mulDiv', () => {
  it.each([
    ['half-even', 7n, 2n, 4n],
    ['floor', 7n, 2n, 3n],
    ['floor', -7n, 2n, -4n],
    ['ceil', 7n, 2n, 4n],
    ['ceil', -7n, 2n, -3n],
    ['trunc', -7n, 2n, -3n],
    ['floor', 6n, 3n, 2n],
    ['floor', 7n, -2n, -4n],
  ] as const)('%s(%s / %s) = %s', (mode, n, d, q) => {
    expect(divRound(n, d, mode)).toBe(q);
  });

  it('defaults to half-even', () => {
    expect(divRound(5n, 2n)).toBe(2n);
  });

  it('mulDiv rounds once after an exact product', () => {
    expect(mulDiv(3n, 5n, 2n)).toBe(8n); // 7.5 -> 8
    expect(mulDiv(10n ** 20n, 10n ** 20n, 10n ** 30n)).toBe(10n ** 10n);
    expect(mulDiv(7n, 1n, 2n, 'floor')).toBe(3n);
  });
});

describe('discountFactors (G0-5)', () => {
  for (const c of vectors.cases) {
    it(`matches the hand-computed vector at ${c.ratePercent}% for ${vectors.years} years`, () => {
      const got = discountFactors(BigInt(c.ratePpb), vectors.years);
      expect(got.map(String)).toEqual(c.factors);
      expect(percentToPpb(c.ratePercent)).toBe(BigInt(c.ratePpb));
    });
  }

  it('starts at the scale, is strictly decreasing for r > 0', () => {
    const d = discountFactors(35_000_000n, 40);
    expect(d[0]).toBe(DF_SCALE);
    for (let i = 1; i < d.length; i++) expect(d[i]! < d[i - 1]!).toBe(true);
  });

  it('zero years and zero rate', () => {
    expect(discountFactors(35_000_000n, 0)).toEqual([DF_SCALE]);
    expect(discountFactors(0n, 3)).toEqual([DF_SCALE, DF_SCALE, DF_SCALE, DF_SCALE]);
  });

  it('rejects bad inputs', () => {
    expect(() => discountFactors(35_000_000n, -1)).toThrow(FixedPointError);
    expect(() => discountFactors(35_000_000n, 1.5)).toThrow(FixedPointError);
    expect(() => discountFactors(-1_000_000_000n, 2)).toThrow(FixedPointError);
  });
});

describe('growthFactors and applyFactor', () => {
  it('escalates and degrades with the same recurrence form', () => {
    expect(growthFactors(20_000_000n, 2)).toEqual([DF_SCALE, 1_020_000_000_000n, 1_040_400_000_000n]);
    expect(growthFactors(-5_000_000n, 1)).toEqual([DF_SCALE, 995_000_000_000n]);
    expect(growthFactors(-1_000_000_000n, 1)).toEqual([DF_SCALE, 0n]);
  });

  it('rejects bad inputs', () => {
    expect(() => growthFactors(-1_000_000_001n, 1)).toThrow(FixedPointError);
    expect(() => growthFactors(0n, -2)).toThrow(FixedPointError);
  });

  it('applies a scaled factor with half-even rounding', () => {
    expect(applyFactor(1_000n, 500_000_000_000n)).toBe(500n);
    expect(applyFactor(3n, 500_000_000_000n)).toBe(2n); // 1.5 -> 2
    expect(applyFactor(5n, 500_000_000_000n)).toBe(2n); // 2.5 -> 2
  });
});

describe('decimal parsing and formatting', () => {
  it.each([
    ['3.5', 7, 35_000_000n],
    ['12.34', 8, 1_234_000_000n],
    ['-0.5', 0, 0n],
    ['1.5', 0, 2n],
    ['2.5', 0, 2n],
    ['-2.5', 0, -2n],
    ['0.123456789', 6, 123_457n],
    [' 7 ', 2, 700n],
  ])('parseScaled(%s, %s) = %s', (s, scale, v) => {
    expect(parseScaled(s, scale)).toBe(v);
  });

  it('rejects non-decimals and bad scales', () => {
    expect(() => parseScaled('1e3', 2)).toThrow(FixedPointError);
    expect(() => parseScaled('abc', 2)).toThrow(FixedPointError);
    expect(() => parseScaled('1.0', -1)).toThrow(FixedPointError);
    expect(() => formatScaled(1n, 1.5)).toThrow(FixedPointError);
  });

  it('formats exactly', () => {
    expect(formatScaled(1_234_000_000n, 8)).toBe('12.34000000');
    expect(formatScaled(-5n, 2)).toBe('-0.05');
    expect(formatScaled(42n, 0)).toBe('42');
  });

  it('format then parse round-trips', () => {
    fc.assert(
      fc.property(fc.bigInt(-(10n ** 24n), 10n ** 24n), fc.integer({ min: 0, max: 12 }), (n, scale) => {
        expect(parseScaled(formatScaled(n, scale), scale)).toBe(n);
      }),
    );
  });
});

describe('wire format', () => {
  it('round-trips and is strict', () => {
    fc.assert(
      fc.property(fc.bigInt(), (n) => {
        expect(fromWire(toWire(n))).toBe(n);
      }),
    );
    for (const bad of ['01', '+1', '-0', '1.0', '', ' 1', '1e3'])
      expect(() => fromWire(bad)).toThrow(FixedPointError);
  });

  it('sums bigints', () => {
    expect(sumBig([1n, 2n, 3n])).toBe(6n);
    expect(sumBig([])).toBe(0n);
  });

  it('exposes the ARCH 4.3 namespace', () => {
    expect(Fixed.discountFactors).toBe(discountFactors);
    expect(Fixed.mulDiv).toBe(mulDiv);
    expect(Fixed.roundHalfEven).toBe(roundHalfEven);
  });
});
