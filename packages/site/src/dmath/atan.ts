/**
 * atan, atan2, asin and acos for the site worker. Owner: WP-16.
 *
 * Ported from Sun fdlibm 5.3 (`s_atan.c`, `e_atan2.c`, `e_asin.c`):
 *   Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *   Developed at SunPro, a Sun Microsystems, Inc. business. Permission to use, copy, modify, and
 *   distribute this software is freely granted, provided that this notice is preserved.
 * Source: https://www.netlib.org/fdlibm/ (retrieved 2026-10-11).
 *
 * Only IEEE basic operations and the exactly rounded `Math.sqrt` are used, so every engine gets
 * the same bits. `acos(x)` is `pi/2 - asin(x)` computed in two parts (a few ulp, deterministic);
 * the full `e_acos.c` port can replace it without changing the signature. These belong in
 * `@ibasho/dmath` (ARCH 4.3 lists atan2 and acos); see the WP-16 INTERFACES entry.
 */
import { fromWords, hiWord, loWord } from './bits.ts';

const ATANHI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.5707963267948965580];
const ATANLO = [
  2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17,
];
const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.1111110405462355788e-1,
  9.09088713343650656196e-2, -7.69187620504482999495e-2, 6.66107313738753120669e-2, -5.83357013379057348645e-2,
  4.97687799461593236017e-2, -3.6531572744216915527e-2, 1.62858201153657823623e-2,
];

export function atan(x: number): number {
  if (Number.isNaN(x)) return x;
  const hx = hiWord(x);
  const ix = hx & 0x7fffffff;
  let id: number;
  if (ix >= 0x44100000) {
    // |x| >= 2^66
    const r = (ATANHI[3] as number) + (ATANLO[3] as number);
    return hx > 0 ? r : -r;
  }
  if (ix < 0x3fdc0000) {
    // |x| < 0.4375
    if (ix < 0x3e400000) return x; // |x| < 2^-27
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      // |x| < 1.1875
      if (ix < 0x3fe60000) {
        id = 0;
        x = (2.0 * x - 1.0) / (2.0 + x);
      } else {
        id = 1;
        x = (x - 1.0) / (x + 1.0);
      }
    } else if (ix < 0x40038000) {
      id = 2;
      x = (x - 1.5) / (1.0 + 1.5 * x);
    } else {
      id = 3;
      x = -1.0 / x;
    }
  }
  const a = AT as [number, number, number, number, number, number, number, number, number, number, number];
  const z = x * x;
  const w = z * z;
  const s1 = z * (a[0] + w * (a[2] + w * (a[4] + w * (a[6] + w * (a[8] + w * a[10])))));
  const s2 = w * (a[1] + w * (a[3] + w * (a[5] + w * (a[7] + w * a[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const r = (ATANHI[id] as number) - (x * (s1 + s2) - (ATANLO[id] as number) - x);
  return hx < 0 ? -r : r;
}

const PI = 3.141592653589793116;
const PI_O_2 = 1.5707963267948965580;
const PI_O_4 = 7.8539816339744827900e-1;
const PI_LO = 1.2246467991473531772e-16;

export function atan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return Number.NaN;
  if (x === 1) return atan(y);
  const hx = hiWord(x);
  const hy = hiWord(y);
  const ix = hx & 0x7fffffff;
  const iy = hy & 0x7fffffff;
  const m = ((hy >>> 31) & 1) | ((hx >>> 30) & 2);
  if (y === 0) {
    if (m === 0 || m === 1) return y;
    return m === 2 ? PI : -PI;
  }
  if (x === 0) return hy < 0 ? -PI_O_2 : PI_O_2;
  if (x === Infinity || x === -Infinity) {
    if (y === Infinity || y === -Infinity) {
      const v = [PI_O_4, -PI_O_4, 3.0 * PI_O_4, -3.0 * PI_O_4][m] as number;
      return v;
    }
    return [0, -0, PI, -PI][m] as number;
  }
  if (y === Infinity || y === -Infinity) return hy < 0 ? -PI_O_2 : PI_O_2;
  const k = (iy - ix) >> 20;
  let z: number;
  let mm = m;
  if (k > 60) {
    z = PI_O_2 + 0.5 * PI_LO;
    mm &= 1;
  } else if (hx < 0 && k < -60) z = 0.0;
  else z = atan(Math.abs(y / x));
  switch (mm) {
    case 0:
      return z;
    case 1:
      return -z;
    case 2:
      return PI - (z - PI_LO);
    default:
      return z - PI_LO - PI;
  }
}

const PIO2_HI = 1.5707963267948965580;
const PIO2_LO = 6.12323399573676603587e-17;
const PIO4_HI = 7.85398163397448278999e-1;
const PS0 = 1.66666666666666657415e-1;
const PS1 = -3.25565818622400915405e-1;
const PS2 = 2.01212532134862925881e-1;
const PS3 = -4.00555345006794114027e-2;
const PS4 = 7.91534994289814532176e-4;
const PS5 = 3.4793310759602116757e-5;
const QS1 = -2.40339491173441421878;
const QS2 = 2.02094576023350569471;
const QS3 = -6.8828397160545329303e-1;
const QS4 = 7.70381505559019352791e-2;

export function asin(x: number): number {
  const hx = hiWord(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    if (((ix - 0x3ff00000) | loWord(x)) === 0) return x * PIO2_HI + x * PIO2_LO;
    return Number.NaN;
  }
  if (ix < 0x3fe00000) {
    if (ix < 0x3e500000) return x;
    const t = x * x;
    const p = t * (PS0 + t * (PS1 + t * (PS2 + t * (PS3 + t * (PS4 + t * PS5)))));
    const q = 1.0 + t * (QS1 + t * (QS2 + t * (QS3 + t * QS4)));
    return x + x * (p / q);
  }
  const w0 = 1.0 - Math.abs(x);
  const t = w0 * 0.5;
  const p0 = t * (PS0 + t * (PS1 + t * (PS2 + t * (PS3 + t * (PS4 + t * PS5)))));
  const q0 = 1.0 + t * (QS1 + t * (QS2 + t * (QS3 + t * QS4)));
  const s = Math.sqrt(t);
  let r: number;
  if (ix >= 0x3fef3333) {
    const w = p0 / q0;
    r = PIO2_HI - (2.0 * (s + s * w) - PIO2_LO);
  } else {
    const w = fromWords(hiWord(s), 0);
    const c = (t - w * w) / (s + w);
    const rr = p0 / q0;
    const p = 2.0 * s * rr - (PIO2_LO - 2.0 * c);
    const q = PIO4_HI - 2.0 * w;
    r = PIO4_HI - (p - q);
  }
  return hx > 0 ? r : -r;
}

export function acos(x: number): number {
  return PIO2_HI - (asin(x) - PIO2_LO);
}
