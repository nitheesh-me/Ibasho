/**
 * sin(x) and cos(x). Owner: WP-01.
 *
 * Ported from FreeBSD msun (k_sin.c, k_cos.c, s_sin.c, s_cos.c, e_rem_pio2.c "medium" path),
 * which descend from Sun fdlibm 5.3:
 *   Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *   Developed at SunPro, a Sun Microsystems, Inc. business. Permission to use, copy, modify, and
 *   distribute this software is freely granted, provided that this notice is preserved.
 * Source: https://github.com/freebsd/freebsd-src/tree/main/lib/msun/src (retrieved 2026-10-11).
 *
 * Only IEEE basic operations are used, so the bits are the same in every engine. Error is below
 * 1 ulp. Argument reduction uses the three-part Cody-Waite split of pi/2, valid for
 * |x| < 2^20 * pi/2 (about 1.6e6). Larger arguments throw a RangeError: the physics never needs
 * them, and the Payne-Hanek path (`__kernel_rem_pio2`) is not ported.
 */
import { hiWord } from './bits.ts';

const C1 = 0.0416666666666666;
const C2 = -0.001388888888887411;
const C3 = 0.00002480158728947673;
const C4 = -2.7557314351390663e-7;
const C5 = 2.087572321298175e-9;
const C6 = -1.1359647557788195e-11;

const S1 = -0.16666666666666632;
const S2 = 0.00833333333332249;
const S3 = -0.0001984126982985795;
const S4 = 0.0000027557313707070068;
const S5 = -2.5050760253406863e-8;
const S6 = 1.58969099521155e-10;

const INVPIO2 = 0.6366197723675814;
const PIO2_1 = 1.5707963267341256;
const PIO2_1T = 6.077100506506192e-11;
const PIO2_2 = 6.077100506303966e-11;
const PIO2_2T = 2.0222662487959506e-21;
const PIO2_3 = 2.0222662487111665e-21;
const PIO2_3T = 8.4784276603689e-32;
/** 1.5 * 2^52: adding and subtracting it rounds to the nearest integer (ties to even). */
const TOINT = 6755399441055744;

/** cos on [-pi/4, pi/4]; `y` is the tail of x. */
function kcos(x: number, y: number): number {
  const z = x * x;
  const w = z * z;
  const r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6));
  const hz = 0.5 * z;
  const v = 1 - hz;
  return v + (1 - v - hz + (z * r - x * y));
}

/** sin on [-pi/4, pi/4]; `y` is the tail of x, `iy` = 0 when y is zero. */
function ksin(x: number, y: number, iy: 0 | 1): number {
  const z = x * x;
  const w = z * z;
  const r = S2 + z * (S3 + z * S4) + z * w * (S5 + z * S6);
  const v = z * x;
  if (iy === 0) return x + v * (S1 + z * r);
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

/** x = n pi/2 + (y0 + y1), |y0 + y1| <= pi/4. Medium path of e_rem_pio2.c. */
function remPio2(x: number, ix: number): { n: number; y0: number; y1: number } {
  if (ix >= 0x413921fb) throw new RangeError(`dmath trig: |x| = ${x} is beyond the reduction range`);
  const fn = x * INVPIO2 + TOINT - TOINT;
  const n = fn | 0;
  let r = x - fn * PIO2_1;
  let w = fn * PIO2_1T;
  const j = ix >> 20;
  let y0 = r - w;
  let i = j - ((hiWord(y0) >> 20) & 0x7ff);
  if (i > 16) {
    let t = r;
    w = fn * PIO2_2;
    r = t - w;
    w = fn * PIO2_2T - (t - r - w);
    y0 = r - w;
    i = j - ((hiWord(y0) >> 20) & 0x7ff);
    if (i > 49) {
      t = r;
      w = fn * PIO2_3;
      r = t - w;
      w = fn * PIO2_3T - (t - r - w);
      y0 = r - w;
    }
  }
  const y1 = r - y0 - w;
  return { n, y0, y1 };
}

export function sin(x: number): number {
  const ix = hiWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    if (ix < 0x3e500000 && (x | 0) === 0) return x;
    return ksin(x, 0, 0);
  }
  if (ix >= 0x7ff00000) return Number.NaN;
  const { n, y0, y1 } = remPio2(x, ix);
  switch (n & 3) {
    case 0:
      return ksin(y0, y1, 1);
    case 1:
      return kcos(y0, y1);
    case 2:
      return -ksin(y0, y1, 1);
    default:
      return -kcos(y0, y1);
  }
}

export function cos(x: number): number {
  const ix = hiWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    if (ix < 0x3e46a09e && (x | 0) === 0) return 1;
    return kcos(x, 0);
  }
  if (ix >= 0x7ff00000) return Number.NaN;
  const { n, y0, y1 } = remPio2(x, ix);
  switch (n & 3) {
    case 0:
      return kcos(y0, y1);
    case 1:
      return -ksin(y0, y1, 1);
    case 2:
      return -kcos(y0, y1);
    default:
      return ksin(y0, y1, 1);
  }
}

/** pi as the nearest double. */
export const PI = 3.141592653589793;
