import { describe, expect, it } from 'vitest';
import { cos, exp, log, log10, PI, pow, sin, sqrt } from '../src/index.ts';

/** Distance in ulps between two finite doubles of the same sign. */
function ulps(a: number, b: number): number {
  if (Object.is(a, b)) return 0;
  const buf = new DataView(new ArrayBuffer(16));
  buf.setFloat64(0, a);
  buf.setFloat64(8, b);
  const ia = buf.getBigInt64(0);
  const ib = buf.getBigInt64(8);
  const d = ia > ib ? ia - ib : ib - ia;
  return Number(d);
}

/** Deterministic sample points (xorshift), independent of Math.random. */
function samples(n: number, lo: number, hi: number, seed = 0x9e3779b9): number[] {
  let s = seed >>> 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    out.push(lo + ((hi - lo) * s) / 0x100000000);
  }
  return out;
}

describe('exp (fdlibm e_exp.c)', () => {
  it('special values', () => {
    expect(exp(0)).toBe(1);
    expect(exp(-0)).toBe(1);
    expect(exp(Infinity)).toBe(Infinity);
    expect(exp(-Infinity)).toBe(0);
    expect(Number.isNaN(exp(Number.NaN))).toBe(true);
    expect(exp(710)).toBe(Infinity);
    expect(exp(-746)).toBe(0);
    expect(exp(1e-30)).toBe(1);
    expect(exp(709.78)).toBeGreaterThan(1e308);
  });

  it('matches the platform within 1 ulp across the range', () => {
    let worst = 0;
    for (const x of [...samples(4000, -745, 709.7), ...samples(2000, -2, 2), 1, -1, 0.5, -0.5]) {
      worst = Math.max(worst, ulps(exp(x), Math.exp(x)));
    }
    expect(worst).toBeLessThanOrEqual(1);
  });

  it('pinned bit patterns (cross-engine vectors)', () => {
    // fdlibm rounds exp(1) up by 1 ulp (a known property of e_exp.c); pinned so engines agree.
    expect(exp(1)).toBe(2.7182818284590455);
    expect(exp(-1)).toBe(0.36787944117144233);
    expect(exp(10)).toBe(22026.465794806718);
  });
});

describe('log and log10 (fdlibm e_log.c, e_log10.c)', () => {
  it('special values', () => {
    expect(log(1)).toBe(0);
    expect(log(0)).toBe(-Infinity);
    expect(log(-0)).toBe(-Infinity);
    expect(Number.isNaN(log(-1))).toBe(true);
    expect(Number.isNaN(log(-Infinity))).toBe(true);
    expect(log(Infinity)).toBe(Infinity);
    expect(log10(1000)).toBe(3);
    expect(log10(0)).toBe(-Infinity);
    expect(Number.isNaN(log10(-2))).toBe(true);
    expect(log10(Infinity)).toBe(Infinity);
    expect(log(5e-324)).toBeCloseTo(-744.44007192138, 9);
    expect(log10(5e-324)).toBeCloseTo(-323.30621534311587, 9);
  });

  it('matches the platform within 1 ulp', () => {
    let worst = 0;
    const xs = [
      ...samples(3000, 1e-300, 1e-290),
      ...samples(3000, 0.5, 2),
      ...samples(3000, 1, 1000000),
      ...samples(1000, 1 - 1e-7, 1 + 1e-7),
      2,
      Math.E,
      10,
      1e300,
    ];
    for (const x of xs) worst = Math.max(worst, ulps(log(x), Math.log(x)));
    expect(worst).toBeLessThanOrEqual(1);
    let worst10 = 0;
    for (const x of xs) worst10 = Math.max(worst10, ulps(log10(x), Math.log10(x)));
    expect(worst10).toBeLessThanOrEqual(1);
  });

  it('pinned values', () => {
    expect(log(2)).toBe(0.6931471805599453);
    expect(log(10)).toBe(2.302585092994046);
    expect(log10(2)).toBe(0.3010299956639812);
  });
});

describe('sqrt (correctly rounded)', () => {
  it('equals IEEE sqrt bit for bit', () => {
    const xs = [
      ...samples(3000, 0, 1000000),
      ...samples(1000, 1e-310, 1e-300),
      ...samples(1000, 1e300, 1.7e308),
      2,
      3,
      4,
      5e-324,
      Number.MAX_VALUE,
      Number.MIN_VALUE,
      0.1,
    ];
    for (const x of xs) expect(sqrt(x)).toBe(Math.sqrt(x));
  });

  it('special values', () => {
    expect(sqrt(0)).toBe(0);
    expect(Object.is(sqrt(-0), -0)).toBe(true);
    expect(sqrt(Infinity)).toBe(Infinity);
    expect(Number.isNaN(sqrt(-1))).toBe(true);
    expect(Number.isNaN(sqrt(Number.NaN))).toBe(true);
  });
});

describe('pow', () => {
  it('special cases follow ECMAScript', () => {
    const cases: [number, number][] = [
      [2, 0],
      [Number.NaN, 0],
      [2, Number.NaN],
      [Number.NaN, 2],
      [1, Infinity],
      [0.5, Infinity],
      [2, Infinity],
      [0.5, -Infinity],
      [2, -Infinity],
      [-1, Infinity],
      [Infinity, 2],
      [Infinity, -2],
      [-Infinity, 3],
      [-Infinity, 2],
      [-Infinity, -3],
      [-Infinity, -2],
      [0, 3],
      [-0, 3],
      [-0, 2],
      [0, -3],
      [-0, -3],
      [-0, -2],
      [-2, 0.5],
      [-2, 3],
      [-2, 2],
      [3, 1],
      [9, 0.5],
      [4, -1],
    ];
    for (const [x, y] of cases) expect(Object.is(pow(x, y), x ** y), `pow(${x}, ${y})`).toBe(true);
  });

  it('is within (2 + 2|y ln x|) ulp of the platform on the physics domain', () => {
    const xs = samples(400, 0.001, 100000, 7);
    const ys = samples(400, -4, 4, 11);
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i]!;
      const y = ys[i]!;
      const bound = 2 + 2 * Math.abs(y * Math.log(x));
      expect(ulps(pow(x, y), x ** y)).toBeLessThanOrEqual(bound);
    }
    // SAP appliance exponent on a GH1-sized home.
    expect(ulps(pow(218.4, 0.4714), 218.4 ** 0.4714)).toBeLessThanOrEqual(4);
  });
});

describe('sin and cos (FreeBSD msun k_sin.c, k_cos.c, e_rem_pio2.c)', () => {
  const bits = (x: number) => {
    const v = new DataView(new ArrayBuffer(8));
    v.setFloat64(0, x);
    return v.getBigUint64(0).toString(16).padStart(16, '0');
  };

  it('special values', () => {
    expect(Object.is(sin(0), 0)).toBe(true);
    expect(Object.is(sin(-0), -0)).toBe(true);
    expect(cos(0)).toBe(1);
    expect(Number.isNaN(sin(Infinity))).toBe(true);
    expect(Number.isNaN(cos(-Infinity))).toBe(true);
    expect(Number.isNaN(sin(Number.NaN))).toBe(true);
    expect(sin(1e-30)).toBe(1e-30);
    expect(PI).toBe(Math.PI);
    expect(() => sin(1e7)).toThrow(RangeError);
  });

  it('matches pinned bit patterns (cross-engine vectors)', () => {
    const v: [number, string, string][] = [
      [0.5, '3fdeaee8744b05f0', '3fec1528065b7d50'],
      [1, '3feaed548f090cee', '3fe14a280fb5068c'],
      [2, '3fed18f6ead1b446', 'bfdaa22657537205'],
      [3, '3fc210386db6d55b', 'bfefae04be85e5d2'],
      [10, 'bfe1689ef5f34f52', 'bfead9ac890c6b1f'],
      [100, 'bfe03425b78c4db8', '3feb981dbf665fdf'],
      [-7.25, 'bfea56adb62a27b9', '3fe22c6f50dc3fbe'],
      [0.7853981633974483, '3fe6a09e667f3bcc', '3fe6a09e667f3bcd'],
      [100000, '3fa24daa9c527e96', 'bfeffac3841b3da7'],
    ];
    for (const [x, s, c] of v) {
      expect(bits(sin(x)), `sin(${x})`).toBe(s);
      expect(bits(cos(x)), `cos(${x})`).toBe(c);
    }
  });

  it('is within 1 ulp of the platform on [-1000, 1000]', () => {
    for (const x of samples(20000, -1000, 1000, 3)) {
      expect(ulps(sin(x), Math.sin(x))).toBeLessThanOrEqual(1);
      expect(ulps(cos(x), Math.cos(x))).toBeLessThanOrEqual(1);
    }
  });
});
