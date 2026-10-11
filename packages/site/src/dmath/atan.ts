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

const ATANHI = [0.4636476090008061, 0.7853981633974483, 0.982793723247329, 1.5707963267948966];
const ATANLO = [2.2698777452961687e-17, 3.061616997868383e-17, 1.3903311031230998e-17, 6.123233995736766e-17];
const AT = [
  0.3333333333333293, -0.19999999999876483, 0.14285714272503466, -0.11111110405462356, 0.09090887133436507,
  -0.0769187620504483, 0.06661073137387531, -0.058335701337905735, 0.049768779946159324,
  -0.036531572744216916, 0.016285820115365782,
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

const PI = 3.141592653589793;
const PI_O_2 = 1.5707963267948966;
const PI_O_4 = 0.7853981633974483;
const PI_LO = 1.2246467991473532e-16;

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

const PIO2_HI = 1.5707963267948966;
const PIO2_LO = 6.123233995736766e-17;
const PIO4_HI = 0.7853981633974483;
const PS0 = 0.16666666666666666;
const PS1 = -0.3255658186224009;
const PS2 = 0.20121253213486293;
const PS3 = -0.04005553450067941;
const PS4 = 0.0007915349942898145;
const PS5 = 0.00003479331075960212;
const QS1 = -2.403394911734414;
const QS2 = 2.0209457602335057;
const QS3 = -0.6882839716054533;
const QS4 = 0.07703815055590194;

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
