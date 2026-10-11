// Local copy of packages/dmath/src/exp.ts (WP-01), unchanged apart from this line, until @ibasho/dmath is a declared dependency of @ibasho/site (INTERFACES, WP-16).
/**
 * exp(x): port of fdlibm 5.3 `e_exp.c` (Sun Microsystems, 1993). Owner: WP-01.
 * Error < 1 ulp. Only IEEE basic operations are used, so the result is bit-identical in every
 * conforming JavaScript engine.
 *
 * Method (from fdlibm): reduce x = k*ln2 + r with |r| <= 0.5*ln2, approximate exp(r) with a
 * degree-5 Remez polynomial in r*r, then scale by 2^k.
 */
import { hiWord, loWord, withHi } from './bits.ts';

const HUGE = 1e300;
const TWOM1000 = 9.332636185032189e-302; // 2^-1000
const O_THRESHOLD = 709.782712893384; // 0x40862E42 FEFA39EF
const U_THRESHOLD = -745.1332191019411; // 0xC0874910 D52D3051
const LN2_HI = 0.6931471803691238; // 0x3FE62E42 FEE00000
const LN2_LO = 1.9082149292705877e-10; // 0x3DEA39EF 35793C76
const INVLN2 = 1.4426950408889634; // 0x3FF71547 652B82FE
const P1 = 0.16666666666666602; // 0x3FC55555 5555553E
const P2 = -0.0027777777777015593; // 0xBF66C16C 16BEBD93
const P3 = 0.00006613756321437934; // 0x3F11566A AF25DE2C
const P4 = -0.0000016533902205465252; // 0xBEBBBD41 C5D26BF1
const P5 = 4.1381367970572385e-8; // 0x3E663769 72BEA4D0

export function exp(x: number): number {
  let hx = hiWord(x);
  const xsb = (hx >>> 31) & 1; // sign bit
  hx &= 0x7fffffff; // high word of |x|

  // Non-finite and out-of-range arguments.
  if (hx >= 0x40862e42) {
    if (hx >= 0x7ff00000) {
      if (((hx & 0xfffff) | loWord(x)) !== 0) return x + x; // NaN
      return xsb === 0 ? x : 0; // exp(+inf) = inf, exp(-inf) = 0
    }
    if (x > O_THRESHOLD) return HUGE * HUGE; // overflow
    if (x < U_THRESHOLD) return TWOM1000 * TWOM1000; // underflow
  }

  // Argument reduction.
  let hi = 0;
  let lo = 0;
  let k = 0;
  if (hx > 0x3fd62e42) {
    // |x| > 0.5 ln2
    if (hx < 0x3ff0a2b2) {
      // and |x| < 1.5 ln2
      hi = xsb === 0 ? x - LN2_HI : x + LN2_HI;
      lo = xsb === 0 ? LN2_LO : -LN2_LO;
      k = 1 - xsb - xsb;
    } else {
      // C `(int)(invln2*x + halF[xsb])` truncates toward zero.
      k = Math.trunc(INVLN2 * x + (xsb === 0 ? 0.5 : -0.5));
      const t = k;
      hi = x - t * LN2_HI; // t*LN2_HI is exact here
      lo = t * LN2_LO;
    }
    x = hi - lo;
  } else if (hx < 0x3e300000) {
    // |x| < 2^-28
    return 1 + x;
  }

  // x is now in the primary range.
  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2) - x);
  const y = 1 - (lo - (x * c) / (2 - c) - hi);
  if (k >= -1021) return withHi(y, hiWord(y) + (k << 20)); // add k to the exponent of y
  return withHi(y, hiWord(y) + ((k + 1000) << 20)) * TWOM1000;
}
