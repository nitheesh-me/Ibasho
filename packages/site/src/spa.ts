/**
 * NREL Solar Position Algorithm (SPA), ported to TypeScript on deterministic maths. Owner: WP-16.
 *
 * Source: I. Reda and A. Andreas, "Solar Position Algorithm for Solar Radiation Applications",
 * NREL/TP-560-34302, revised January 2008, https://www.nrel.gov/docs/fy08osti/34302.pdf, and the
 * reference C code `spa.c` (https://midcdmz.nrel.gov/spa/). The periodic term tables (Earth
 * heliocentric longitude, latitude and radius, nutation) are the paper's Tables A4.2 and A4.3.
 * Uncertainty: +/-0.0003 degrees for years -2000 to 6000 (paper). The golden vector of the paper
 * (Table A5) is pinned in `test/spa.test.ts` (AC-LK1).
 *
 * Every trigonometric call goes through the site's deterministic maths, so the angles are
 * bit-identical in Node and every browser.
 */
import { asin, atan, atan2, cos, D2R, R2D, sin, tan } from './dmath/index.ts';

type Term = readonly [number, number, number];

const L0: readonly Term[] = [
  [175347046, 0, 0],
  [3341656, 4.6692568, 6283.07585],
  [34894, 4.6261, 12566.1517],
  [3497, 2.7441, 5753.3849],
  [3418, 2.8289, 3.5231],
  [3136, 3.6277, 77713.7715],
  [2676, 4.4181, 7860.4194],
  [2343, 6.1352, 3930.2097],
  [1324, 0.7425, 11506.7698],
  [1273, 2.0371, 529.691],
  [1199, 1.1096, 1577.3435],
  [990, 5.233, 5884.927],
  [902, 2.045, 26.298],
  [857, 3.508, 398.149],
  [780, 1.179, 5223.694],
  [753, 2.533, 5507.553],
  [505, 4.583, 18849.228],
  [492, 4.205, 775.523],
  [357, 2.92, 0.067],
  [317, 5.849, 11790.629],
  [284, 1.899, 796.298],
  [271, 0.315, 10977.079],
  [243, 0.345, 5486.778],
  [206, 4.806, 2544.314],
  [205, 1.869, 5573.143],
  [202, 2.458, 6069.777],
  [156, 0.833, 213.299],
  [132, 3.411, 2942.463],
  [126, 1.083, 20.775],
  [115, 0.645, 0.98],
  [103, 0.636, 4694.003],
  [102, 0.976, 15720.839],
  [102, 4.267, 7.114],
  [99, 6.21, 2146.17],
  [98, 0.68, 155.42],
  [86, 5.98, 161000.69],
  [85, 1.3, 6275.96],
  [85, 3.67, 71430.7],
  [80, 1.81, 17260.15],
  [79, 3.04, 12036.46],
  [75, 1.76, 5088.63],
  [74, 3.5, 3154.69],
  [74, 4.68, 801.82],
  [70, 0.83, 9437.76],
  [62, 3.98, 8827.39],
  [61, 1.82, 7084.9],
  [57, 2.78, 6286.6],
  [56, 4.39, 14143.5],
  [56, 3.47, 6279.55],
  [52, 0.19, 12139.55],
  [52, 1.33, 1748.02],
  [51, 0.28, 5856.48],
  [49, 0.49, 1194.45],
  [41, 5.37, 8429.24],
  [41, 2.4, 19651.05],
  [39, 6.17, 10447.39],
  [37, 6.04, 10213.29],
  [37, 2.57, 1059.38],
  [36, 1.71, 2352.87],
  [36, 1.78, 6812.77],
  [33, 0.59, 17789.85],
  [30, 0.44, 83996.85],
  [30, 2.74, 1349.87],
  [25, 3.16, 4690.48],
];
const L1: readonly Term[] = [
  [628331966747, 0, 0],
  [206059, 2.678235, 6283.07585],
  [4303, 2.6351, 12566.1517],
  [425, 1.59, 3.523],
  [119, 5.796, 26.298],
  [109, 2.966, 1577.344],
  [93, 2.59, 18849.23],
  [72, 1.14, 529.69],
  [68, 1.87, 398.15],
  [67, 4.41, 5507.55],
  [59, 2.89, 5223.69],
  [56, 2.17, 155.42],
  [45, 0.4, 796.3],
  [36, 0.47, 775.52],
  [29, 2.65, 7.11],
  [21, 5.34, 0.98],
  [19, 1.85, 5486.78],
  [19, 4.97, 213.3],
  [17, 2.99, 6275.96],
  [16, 0.03, 2544.31],
  [16, 1.43, 2146.17],
  [15, 1.21, 10977.08],
  [12, 2.83, 1748.02],
  [12, 3.26, 5088.63],
  [12, 5.27, 1194.45],
  [12, 2.08, 4694],
  [11, 0.77, 553.57],
  [10, 1.3, 6286.6],
  [10, 4.24, 1349.87],
  [9, 2.7, 242.73],
  [9, 5.64, 951.72],
  [8, 5.3, 2352.87],
  [6, 2.65, 9437.76],
  [6, 4.67, 4690.48],
];
const L2: readonly Term[] = [
  [52919, 0, 0],
  [8720, 1.0721, 6283.0758],
  [309, 0.867, 12566.152],
  [27, 0.05, 3.52],
  [16, 5.19, 26.3],
  [16, 3.68, 155.42],
  [10, 0.76, 18849.23],
  [9, 2.06, 77713.77],
  [7, 0.83, 775.52],
  [5, 4.66, 1577.34],
  [4, 1.03, 7.11],
  [4, 3.44, 5573.14],
  [3, 5.14, 796.3],
  [3, 6.05, 5507.55],
  [3, 1.19, 242.73],
  [3, 6.12, 529.69],
  [3, 0.31, 398.15],
  [3, 2.28, 553.57],
  [2, 4.38, 5223.69],
  [2, 3.75, 0.98],
];
const L3: readonly Term[] = [
  [289, 5.844, 6283.076],
  [35, 0, 0],
  [17, 5.49, 12566.15],
  [3, 5.2, 155.42],
  [1, 4.72, 3.52],
  [1, 5.3, 18849.23],
  [1, 5.97, 242.73],
];
const L4: readonly Term[] = [
  [114, 3.142, 0],
  [8, 4.13, 6283.08],
  [1, 3.84, 12566.15],
];
const L5: readonly Term[] = [[1, 3.14, 0]];

const B0: readonly Term[] = [
  [280, 3.199, 84334.662],
  [102, 5.422, 5507.553],
  [80, 3.88, 5223.69],
  [44, 3.7, 2352.87],
  [32, 4, 1577.34],
];
const B1: readonly Term[] = [
  [9, 3.9, 5507.55],
  [6, 1.73, 5223.69],
];

const R0: readonly Term[] = [
  [100013989, 0, 0],
  [1670700, 3.0984635, 6283.07585],
  [13956, 3.05525, 12566.1517],
  [3084, 5.1985, 77713.7715],
  [1628, 1.1739, 5753.3849],
  [1576, 2.8469, 7860.4194],
  [925, 5.453, 11506.77],
  [542, 4.564, 3930.21],
  [472, 3.661, 5884.927],
  [346, 0.964, 5507.553],
  [329, 5.9, 5223.694],
  [307, 0.299, 5573.143],
  [243, 4.273, 11790.629],
  [212, 5.847, 1577.344],
  [186, 5.022, 10977.079],
  [175, 3.012, 18849.228],
  [110, 5.055, 5486.778],
  [98, 0.89, 6069.78],
  [86, 5.69, 15720.84],
  [86, 1.27, 161000.69],
  [65, 0.27, 17260.15],
  [63, 0.92, 529.69],
  [57, 2.01, 83996.85],
  [56, 5.24, 71430.7],
  [49, 3.25, 2544.31],
  [47, 2.58, 775.52],
  [45, 5.54, 9437.76],
  [43, 6.01, 6275.96],
  [39, 5.36, 4694],
  [38, 2.39, 8827.39],
  [37, 0.83, 19651.05],
  [37, 4.9, 12139.55],
  [36, 1.67, 12036.46],
  [35, 1.84, 2942.46],
  [33, 0.24, 7084.9],
  [32, 0.18, 5088.63],
  [32, 1.78, 398.15],
  [28, 1.21, 6286.6],
  [28, 1.9, 6279.55],
  [26, 4.59, 10447.39],
];
const R1: readonly Term[] = [
  [103019, 1.10749, 6283.07585],
  [1721, 1.0644, 12566.1517],
  [702, 3.142, 0],
  [32, 1.02, 18849.23],
  [31, 2.84, 5507.55],
  [25, 1.32, 5223.69],
  [18, 1.42, 1577.34],
  [10, 5.91, 10977.08],
  [9, 1.42, 6275.96],
  [9, 0.27, 5486.78],
];
const R2: readonly Term[] = [
  [4359, 5.7846, 6283.0758],
  [124, 5.579, 12566.152],
  [12, 3.14, 0],
  [9, 3.63, 77713.77],
  [6, 1.87, 5573.14],
  [3, 5.47, 18849.23],
];
const R3: readonly Term[] = [
  [145, 4.273, 6283.076],
  [7, 3.92, 12566.15],
];
const R4: readonly Term[] = [[4, 2.56, 6283.08]];

/** Nutation arguments: multipliers of X0..X4 (paper Table A4.3). */
const Y: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 0, 0, 1],
  [-2, 0, 0, 2, 2],
  [0, 0, 0, 2, 2],
  [0, 0, 0, 0, 2],
  [0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0],
  [-2, 1, 0, 2, 2],
  [0, 0, 0, 2, 1],
  [0, 0, 1, 2, 2],
  [-2, -1, 0, 2, 2],
  [-2, 0, 1, 0, 0],
  [-2, 0, 0, 2, 1],
  [0, 0, -1, 2, 2],
  [2, 0, 0, 0, 0],
  [0, 0, 1, 0, 1],
  [2, 0, -1, 2, 2],
  [0, 0, -1, 0, 1],
  [0, 0, 1, 2, 1],
  [-2, 0, 2, 0, 0],
  [0, 0, -2, 2, 1],
  [2, 0, 0, 2, 2],
  [0, 0, 2, 2, 2],
  [0, 0, 2, 0, 0],
  [-2, 0, 1, 2, 2],
  [0, 0, 0, 2, 0],
  [-2, 0, 0, 2, 0],
  [0, 0, -1, 2, 1],
  [0, 2, 0, 0, 0],
  [2, 0, -1, 0, 1],
  [-2, 2, 0, 2, 2],
  [0, 1, 0, 0, 1],
  [-2, 0, 1, 0, 1],
  [0, -1, 0, 0, 1],
  [0, 0, 2, -2, 0],
  [2, 0, -1, 2, 1],
  [2, 0, 1, 2, 2],
  [0, 1, 0, 2, 2],
  [-2, 1, 1, 0, 0],
  [0, -1, 0, 2, 2],
  [2, 0, 0, 2, 1],
  [2, 0, 1, 0, 0],
  [-2, 0, 2, 2, 2],
  [-2, 0, 1, 2, 1],
  [2, 0, -2, 0, 1],
  [2, 0, 0, 0, 1],
  [0, -1, 1, 0, 0],
  [-2, -1, 0, 2, 1],
  [-2, 0, 0, 0, 1],
  [0, 0, 2, 2, 1],
  [-2, 0, 2, 0, 1],
  [-2, 1, 0, 2, 1],
  [0, 0, 1, -2, 0],
  [-1, 0, 1, 0, 0],
  [-2, 1, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [0, 0, 1, 2, 0],
  [0, 0, -2, 2, 2],
  [-1, -1, 1, 0, 0],
  [0, 1, 1, 0, 0],
  [0, -1, 1, 2, 2],
  [2, -1, -1, 2, 2],
  [0, 0, 3, 2, 2],
  [2, -1, 0, 2, 2],
];
/** Nutation coefficients a, b (longitude) and c, d (obliquity), 0.0001 arcsec. */
const PE: readonly (readonly [number, number, number, number])[] = [
  [-171996, -174.2, 92025, 8.9],
  [-13187, -1.6, 5736, -3.1],
  [-2274, -0.2, 977, -0.5],
  [2062, 0.2, -895, 0.5],
  [1426, -3.4, 54, -0.1],
  [712, 0.1, -7, 0],
  [-517, 1.2, 224, -0.6],
  [-386, -0.4, 200, 0],
  [-301, 0, 129, -0.1],
  [217, -0.5, -95, 0.3],
  [-158, 0, 0, 0],
  [129, 0.1, -70, 0],
  [123, 0, -53, 0],
  [63, 0, 0, 0],
  [63, 0.1, -33, 0],
  [-59, 0, 26, 0],
  [-58, -0.1, 32, 0],
  [-51, 0, 27, 0],
  [48, 0, 0, 0],
  [46, 0, -24, 0],
  [-38, 0, 16, 0],
  [-31, 0, 13, 0],
  [29, 0, 0, 0],
  [29, 0, -12, 0],
  [26, 0, 0, 0],
  [-22, 0, 0, 0],
  [21, 0, -10, 0],
  [17, -0.1, 0, 0],
  [16, 0, -8, 0],
  [-16, 0.1, 7, 0],
  [-15, 0, 9, 0],
  [-13, 0, 7, 0],
  [-12, 0, 6, 0],
  [11, 0, 0, 0],
  [-10, 0, 5, 0],
  [-8, 0, 3, 0],
  [7, 0, -3, 0],
  [-7, 0, 0, 0],
  [-7, 0, 3, 0],
  [-7, 0, 3, 0],
  [6, 0, 0, 0],
  [6, 0, -3, 0],
  [6, 0, -3, 0],
  [-6, 0, 3, 0],
  [-6, 0, 3, 0],
  [5, 0, 0, 0],
  [-5, 0, 3, 0],
  [-5, 0, 3, 0],
  [-5, 0, 3, 0],
  [4, 0, 0, 0],
  [4, 0, 0, 0],
  [4, 0, 0, 0],
  [-4, 0, 0, 0],
  [-4, 0, 0, 0],
  [-4, 0, 0, 0],
  [3, 0, 0, 0],
  [-3, 0, 0, 0],
  [-3, 0, 0, 0],
  [-3, 0, 0, 0],
  [-3, 0, 0, 0],
  [-3, 0, 0, 0],
  [-3, 0, 0, 0],
  [-3, 0, 0, 0],
];

const limitDeg = (d: number): number => {
  const l = d - 360 * Math.floor(d / 360);
  return l < 0 ? l + 360 : l;
};

function series(terms: readonly Term[], jme: number): number {
  let s = 0;
  for (const [a, b, c] of terms) s += a * cos(b + c * jme);
  return s;
}

function poly(groups: readonly (readonly Term[])[], jme: number): number {
  let s = 0;
  let p = 1;
  for (const g of groups) {
    s += series(g, jme) * p;
    p *= jme;
  }
  return s / 1e8;
}

/** Julian day (SPA eq. 4), Gregorian calendar, from local time with `tz` hours east of UT. */
export function julianDay(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  tz: number,
  dut1 = 0,
): number {
  const dayDecimal = day + (hour - tz + (minute + (second + dut1) / 60) / 60) / 24;
  let y = year;
  let m = month;
  if (m < 3) {
    m += 12;
    y--;
  }
  let jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dayDecimal - 1524.5;
  if (jd > 2299160) {
    const a = Math.floor(y / 100);
    jd += 2 - a + Math.floor(a / 4);
  }
  return jd;
}

export interface SpaInput {
  /** Julian day (UT). */
  jd: number;
  /** Terrestrial minus universal time, s (about 69 s in 2025). */
  deltaT: number;
  lat: number;
  lon: number;
  elevationM: number;
  /** Mean annual pressure, mbar, and temperature, C (refraction). */
  pressureMbar: number;
  tempC: number;
}

/** Sun-only parts that depend on time alone (shared by every site at that instant). */
export interface SunGeo {
  jd: number;
  /** Apparent sidereal time at Greenwich, degrees. */
  nu: number;
  /** Geocentric right ascension and declination, degrees. */
  alpha: number;
  delta: number;
  /** Earth radius vector, AU. */
  r: number;
}

/** SPA steps 3.1 to 3.9: geocentric sun position at a Julian day. */
export function sunGeocentric(jd: number, deltaT: number): SunGeo {
  const jde = jd + deltaT / 86400;
  const jc = (jd - 2451545) / 36525;
  const jce = (jde - 2451545) / 36525;
  const jme = jce / 10;
  const l = limitDeg(poly([L0, L1, L2, L3, L4, L5], jme) * R2D);
  const b = poly([B0, B1], jme) * R2D;
  const r = poly([R0, R1, R2, R3, R4], jme);
  const theta = limitDeg(l + 180);
  const beta = -b;
  const jce2 = jce * jce;
  const jce3 = jce2 * jce;
  const x0 = 297.85036 + 445267.11148 * jce - 0.0019142 * jce2 + jce3 / 189474;
  const x1 = 357.52772 + 35999.05034 * jce - 0.0001603 * jce2 - jce3 / 300000;
  const x2 = 134.96298 + 477198.867398 * jce + 0.0086972 * jce2 + jce3 / 56250;
  const x3 = 93.27191 + 483202.017538 * jce - 0.0036825 * jce2 + jce3 / 327270;
  const x4 = 125.04452 - 1934.136261 * jce + 0.0020708 * jce2 + jce3 / 450000;
  let dPsi = 0;
  let dEps = 0;
  for (let i = 0; i < Y.length; i++) {
    const y = Y[i] as readonly [number, number, number, number, number];
    const pe = PE[i] as readonly [number, number, number, number];
    const arg = (x0 * y[0] + x1 * y[1] + x2 * y[2] + x3 * y[3] + x4 * y[4]) * D2R;
    dPsi += (pe[0] + jce * pe[1]) * sin(arg);
    dEps += (pe[2] + jce * pe[3]) * cos(arg);
  }
  dPsi /= 36000000;
  dEps /= 36000000;
  const u = jme / 10;
  const eps0 =
    84381.448 +
    u *
      (-4680.93 +
        u *
          (-1.55 +
            u *
              (1999.25 +
                u *
                  (-51.38 +
                    u * (-249.67 + u * (-39.05 + u * (7.12 + u * (27.87 + u * (5.79 + u * 2.45)))))))));
  const eps = eps0 / 3600 + dEps;
  const dTau = -20.4898 / (3600 * r);
  const lambda = theta + dPsi + dTau;
  const nu0 = limitDeg(
    280.46061837 + 360.98564736629 * (jd - 2451545) + jc * jc * (0.000387933 - jc / 38710000),
  );
  const nu = nu0 + dPsi * cos(eps * D2R);
  const lr = lambda * D2R;
  const er = eps * D2R;
  const br = beta * D2R;
  const alpha = limitDeg(atan2(sin(lr) * cos(er) - tan(br) * sin(er), cos(lr)) * R2D);
  const delta = asin(sin(br) * cos(er) + cos(br) * sin(er) * sin(lr)) * R2D;
  return { jd, nu, alpha, delta, r };
}

export interface SunPosition {
  /** Topocentric zenith angle with refraction, degrees. */
  zenith: number;
  /** Topocentric azimuth, degrees clockwise from true north. */
  azimuth: number;
  /** Elevation without refraction, degrees. */
  elevation0: number;
}

/** SPA steps 3.10 to 3.15 for one site. */
export function sunTopocentric(
  g: SunGeo,
  site: { lat: number; lon: number; elevationM: number; pressureMbar: number; tempC: number },
): SunPosition {
  const h = limitDeg(g.nu + site.lon - g.alpha);
  const xi = 8.794 / (3600 * g.r);
  const phi = site.lat * D2R;
  const uu = atan(0.99664719 * tan(phi));
  const x = cos(uu) + (site.elevationM / 6378140) * cos(phi);
  const y = 0.99664719 * sin(uu) + (site.elevationM / 6378140) * sin(phi);
  const hr = h * D2R;
  const xir = xi * D2R;
  const dr = g.delta * D2R;
  const dAlpha = atan2(-x * sin(xir) * sin(hr), cos(dr) - x * sin(xir) * cos(hr));
  const deltaP = atan2((sin(dr) - y * sin(xir)) * cos(dAlpha), cos(dr) - x * sin(xir) * cos(hr));
  const hP = hr - dAlpha;
  const e0 = asin(sin(phi) * sin(deltaP) + cos(phi) * cos(deltaP) * cos(hP)) * R2D;
  let de = 0;
  if (e0 >= -(0.26667 + 0.5667)) {
    de =
      (site.pressureMbar / 1010) *
      (283 / (273 + site.tempC)) *
      (1.02 / (60 * tan((e0 + 10.3 / (e0 + 5.11)) * D2R)));
  }
  const e = e0 + de;
  const gamma = atan2(sin(hP), cos(hP) * sin(phi) - tan(deltaP) * cos(phi)) * R2D;
  return { zenith: 90 - e, azimuth: limitDeg(gamma + 180), elevation0: e0 };
}

/** Full SPA (zenith and azimuth) at one instant and site. */
export function spa(i: SpaInput): SunPosition {
  return sunTopocentric(sunGeocentric(i.jd, i.deltaT), i);
}

/** Unit vector to the sun in a frame with +x east, +y true north, +z up. */
export function sunVector(p: SunPosition): [number, number, number] {
  const z = p.zenith * D2R;
  const a = p.azimuth * D2R;
  const s = sin(z);
  return [s * sin(a), s * cos(a), cos(z)];
}
