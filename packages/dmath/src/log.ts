/**
 * log(x) and log10(x). Owner: WP-01.
 *
 * `log` is a port of fdlibm 5.3 `e_log.c` (Sun Microsystems, 1993): reduce x = 2^k * (1+f) with
 * sqrt(2)/2 < 1+f < sqrt(2), then log(1+f) = 2s + s*R(s*s) with s = f/(2+f) and a degree-14 Remez
 * polynomial R. Error < 1 ulp.
 *
 * `log10` is a port of fdlibm 5.3 `e_log10.c`: log10(x) = n*log10(2) + log10(e)*log(x/2^n),
 * with log10(2) split into a high part (exact when multiplied by n) and a low part.
 */
import { hiWord, loWord, withHi } from './bits.ts';

const LN2_HI = 0.6931471803691238; // 0x3FE62E42 FEE00000
const LN2_LO = 1.9082149292705877e-10; // 0x3DEA39EF 35793C76
const TWO54 = 18014398509481984; // 0x43500000 00000000
const LG1 = 0.6666666666666735; // 0x3FE55555 55555593
const LG2 = 0.3999999999940942; // 0x3FD99999 9997FA04
const LG3 = 0.2857142874366239; // 0x3FD24924 94229359
const LG4 = 0.22222198432149784; // 0x3FCC71C5 1D8E78AF
const LG5 = 0.1818357216161805; // 0x3FC74664 96CB03DE
const LG6 = 0.15313837699209373; // 0x3FC39A09 D078C69F
const LG7 = 0.14798198605116586; // 0x3FC2F112 DF3E5244

export function log(x: number): number {
  let hx = hiWord(x);
  const lx = loWord(x);
  let k = 0;
  if (hx < 0x00100000) {
    // x < 2^-1022
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity; // log(+-0) = -inf
    if (hx < 0) return Number.NaN; // log(negative) = NaN
    k -= 54;
    x *= TWO54; // subnormal: scale up
    hx = hiWord(x);
  }
  if (hx >= 0x7ff00000) return x + x; // inf or NaN
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  let i = (hx + 0x95f64) & 0x100000;
  x = withHi(x, hx | (i ^ 0x3ff00000)); // normalise x or x/2
  k += i >> 20;
  const f = x - 1;
  if ((0x000fffff & (2 + hx)) < 3) {
    // |f| < 2^-20
    if (f === 0) {
      if (k === 0) return 0;
      const dk = k;
      return dk * LN2_HI + dk * LN2_LO;
    }
    const r = f * f * (0.5 - 0.3333333333333333 * f);
    if (k === 0) return f - r;
    const dk = k;
    return dk * LN2_HI - (r - dk * LN2_LO - f);
  }
  const s = f / (2 + f);
  const dk = k;
  const z = s * s;
  i = hx - 0x6147a;
  const w = z * z;
  const j = 0x6b851 - hx;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  i |= j;
  const r = t2 + t1;
  if (i > 0) {
    const hfsq = 0.5 * f * f;
    if (k === 0) return f - (hfsq - s * (hfsq + r));
    return dk * LN2_HI - (hfsq - (s * (hfsq + r) + dk * LN2_LO) - f);
  }
  if (k === 0) return f - s * (f - r);
  return dk * LN2_HI - (s * (f - r) - dk * LN2_LO - f);
}

const IVLN10 = 0.4342944819032518; // 0x3FDBCB7B 1526E50E
const LOG10_2HI = 0.30102999566361177; // 0x3FD34413 509F6000
const LOG10_2LO = 3.694239077158931e-13; // 0x3D59FEF3 11F12B36

export function log10(x: number): number {
  let hx = hiWord(x);
  const lx = loWord(x);
  let k = 0;
  if (hx < 0x00100000) {
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
    if (hx < 0) return Number.NaN;
    k -= 54;
    x *= TWO54;
    hx = hiWord(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  k += (hx >> 20) - 1023;
  const i = (k & 0x80000000) >>> 31; // 1 when k < 0
  hx = (hx & 0x000fffff) | ((0x3ff - i) << 20);
  const y = k + i;
  x = withHi(x, hx);
  const z = y * LOG10_2LO + IVLN10 * log(x);
  return z + y * LOG10_2HI;
}
