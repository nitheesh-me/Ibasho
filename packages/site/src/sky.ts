/**
 * Sky subdivision and sky models (SD 1.2). Owner: WP-16.
 *
 * - Tregenza 145 patches (MF 1) and the Reinhart subdivision (MF 2 gives 577), as in Radiance
 *   `genskyvec` and `gendaymtx`: 7 bands of 12 degrees with 30, 30, 24, 24, 18, 12, 6 patches, plus
 *   a zenith cap, each band split into MF rows and each patch into MF columns.
 * - Perez all-weather sky (Perez, Seals and Michalsky 1993, Solar Energy 50(3) 235 to 245,
 *   https://doi.org/10.1016/0038-092X(93)90017-I), coefficients as tabulated in Radiance
 *   `gendaylit.c` (G. Ward and J. Mardaljevic). Relative radiance per patch is normalised so the
 *   sky integrates to the hour's DHI on a horizontal plane (the `gendaymtx` approach).
 * - Perez 1990 luminous efficacy (Perez, Ineichen, Seals, Michalsky, Stewart, Solar Energy 44(5)
 *   271 to 289, https://doi.org/10.1016/0038-092X(90)90055-H) when the weather file has no
 *   illuminance columns.
 */
import { atan2, cos, D2R, exp, log, PI, powi, sin } from './dmath/index.ts';

export interface Patches {
  mf: number;
  count: number;
  /** Unit direction per patch centre (x east, y north, z up), flat xyz. */
  dir: Float64Array;
  /** Solid angle per patch, sr. */
  omega: Float64Array;
  /** Patch bounds, degrees: altitude low and high, azimuth centre and width. */
  alt0: Float64Array;
  alt1: Float64Array;
  azC: Float64Array;
  azW: Float64Array;
}

const TREGENZA = [30, 30, 24, 24, 18, 12, 6];
const cache = new Map<number, Patches>();

/** Patch centres and solid angles for Reinhart subdivision `mf` (1 is Tregenza). */
export function skyPatches(mf: number): Patches {
  const hit = cache.get(mf);
  if (hit) return hit;
  const rows: { alt0: number; alt1: number; n: number }[] = [];
  const step = 90 / (TREGENZA.length * mf + 0.5);
  for (let b = 0; b < TREGENZA.length * mf; b++) {
    const n = (TREGENZA[Math.floor(b / mf)] as number) * mf;
    rows.push({ alt0: b * step, alt1: (b + 1) * step, n });
  }
  const count = rows.reduce((s, r) => s + r.n, 0) + 1;
  const dir = new Float64Array(count * 3);
  const omega = new Float64Array(count);
  const alt0 = new Float64Array(count);
  const alt1 = new Float64Array(count);
  const azC = new Float64Array(count);
  const azW = new Float64Array(count);
  let k = 0;
  for (const r of rows) {
    const altC = ((r.alt0 + r.alt1) / 2) * D2R;
    const w = (2 * PI * (sin(r.alt1 * D2R) - sin(r.alt0 * D2R))) / r.n;
    for (let j = 0; j < r.n; j++) {
      // Radiance numbers patches from north, turning east; the centre of patch j sits at j * width.
      const az = ((j * 360) / r.n) * D2R;
      dir[k * 3] = cos(altC) * sin(az);
      dir[k * 3 + 1] = cos(altC) * cos(az);
      dir[k * 3 + 2] = sin(altC);
      omega[k] = w;
      alt0[k] = r.alt0;
      alt1[k] = r.alt1;
      azC[k] = (j * 360) / r.n;
      azW[k] = 360 / r.n;
      k++;
    }
  }
  const capAlt = (rows[rows.length - 1] as { alt1: number }).alt1;
  dir[k * 3 + 2] = 1;
  omega[k] = 2 * PI * (1 - sin(capAlt * D2R));
  alt0[k] = capAlt;
  alt1[k] = 90;
  azC[k] = 0;
  azW[k] = 360;
  const p = { mf, count, dir, omega, alt0, alt1, azC, azW };
  cache.set(mf, p);
  return p;
}

/** Index of the patch whose centre is nearest a unit direction (upper hemisphere). */
export function patchOf(p: Patches, x: number, y: number, z: number): number {
  let best = 0;
  let bd = -2;
  for (let i = 0; i < p.count; i++) {
    const d =
      x * (p.dir[i * 3] as number) + y * (p.dir[i * 3 + 1] as number) + z * (p.dir[i * 3 + 2] as number);
    if (d > bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

// Perez 1993 coefficients: [bin][a..e][c1..c4].
const PZ: readonly (readonly (readonly [number, number, number, number])[])[] = [
  [
    [1.3525, -0.2576, -0.269, -1.4366],
    [-0.767, 0.0007, 1.2734, -0.1233],
    [2.8, 0.6004, 1.2375, 1.0],
    [1.8734, 0.6297, 0.9738, 0.2809],
    [0.0356, -0.1246, -0.5718, 0.9938],
  ],
  [
    [-1.2219, -0.773, 1.4148, 1.1016],
    [-0.2054, 0.0367, -3.9128, 0.9156],
    [6.975, 0.1774, 6.4477, -0.1239],
    [-1.5798, -0.5081, -1.7812, 0.108],
    [0.2624, 0.0672, -0.219, -0.4285],
  ],
  [
    [-1.1, -0.2515, 0.8952, 0.0156],
    [0.2782, -0.1812, -4.5, 1.1766],
    [24.7219, -13.0812, -37.7, 34.8438],
    [-5.0, 1.5218, 3.9229, -2.6204],
    [-0.0156, 0.1597, 0.4199, -0.5562],
  ],
  [
    [-0.5484, -0.6654, -0.2672, 0.7117],
    [0.7234, -0.6219, -5.6812, 2.6297],
    [33.3389, -18.3, -62.25, 52.0781],
    [-3.5, 0.0016, 1.1477, 0.1062],
    [0.4659, -0.3296, -0.0876, -0.0329],
  ],
  [
    [-0.6, -0.3566, -2.5, 2.325],
    [0.2937, 0.0496, -5.6812, 1.8415],
    [21.0, -4.7656, -21.5906, 7.2492],
    [-3.5, -0.1554, 1.4062, 0.3988],
    [0.0032, 0.0766, -0.0656, -0.1294],
  ],
  [
    [-1.0156, -0.367, 1.0078, 1.4051],
    [0.2875, -0.5328, -3.85, 3.375],
    [14.0, -0.9999, -7.1406, 7.5469],
    [-3.4, -0.1078, -1.075, 1.5702],
    [-0.0672, 0.4016, 0.3017, -0.4844],
  ],
  [
    [-1.0, 0.0211, 0.5025, -0.5119],
    [-0.3, 0.1922, 0.7023, -1.6317],
    [19.0, -5.0, 1.2438, -1.9094],
    [-4.0, 0.025, 0.3844, 0.2656],
    [1.0468, -0.3788, -2.4517, 1.4656],
  ],
  [
    [-1.05, 0.0289, 0.426, 0.359],
    [-0.325, 0.1156, 0.7781, 0.0025],
    [31.0625, -14.5, -46.1148, 55.375],
    [-7.2312, 0.405, 13.35, 0.6234],
    [1.5, -0.6426, 1.8564, 0.5636],
  ],
];
const EPS_EDGES = [1.065, 1.23, 1.5, 1.95, 2.8, 4.5, 6.2];

/** Clearness bin 0..7 from epsilon. */
export function epsBin(eps: number): number {
  let b = 0;
  while (b < EPS_EDGES.length && eps >= (EPS_EDGES[b] as number)) b++;
  return b;
}

/** Extraterrestrial normal irradiance, W/m2, day of year 1..365 (Spencer-style cosine). */
export function extraterrestrial(doy: number): number {
  return 1367 * (1 + 0.033 * cos((2 * PI * doy) / 365));
}

/** Relative optical air mass (Kasten and Young 1989), zenith in degrees. */
export function airMass(zenithDeg: number): number {
  const z = zenithDeg > 93.885 ? 93.885 : zenithDeg;
  // (96.07995 - z)^-1.6364 = exp(-1.6364 * ln(96.07995 - z))
  return 1 / (cos(z * D2R) + 0.50572 * exp(-1.6364 * log(96.07995 - z)));
}

export interface SkyCondition {
  /** Sun zenith, radians. */
  zen: number;
  eps: number;
  delta: number;
  bin: number;
}

export function skyCondition(dni: number, dhi: number, zenithDeg: number, doy: number): SkyCondition {
  const zen = zenithDeg * D2R;
  const z3 = 1.041 * powi(zen, 3);
  const eps = dhi > 0 ? ((dhi + dni) / dhi + z3) / (1 + z3) : 1;
  let delta = (dhi * airMass(zenithDeg)) / extraterrestrial(doy);
  if (delta < 0.01) delta = 0.01;
  if (delta > 0.6) delta = 0.6;
  return { zen, eps, delta, bin: epsBin(eps) };
}

/** Perez 1993 parameters a..e for a sky condition. */
export function perezParams(c: SkyCondition): [number, number, number, number, number] {
  const t = PZ[c.bin] as readonly (readonly [number, number, number, number])[];
  const q = (i: number) => {
    const r = t[i] as readonly [number, number, number, number];
    return r[0] + r[1] * c.zen + c.delta * (r[2] + r[3] * c.zen);
  };
  let cc = q(2);
  let d = q(3);
  if (c.bin === 0) {
    const rc = t[2] as readonly [number, number, number, number];
    const rd = t[3] as readonly [number, number, number, number];
    // Bin 1 special forms: c = exp((delta (c1 + c2 Z))^c3) - c4; d = -exp(delta (d1 + d2 Z)) + d3 + delta d4.
    const base = c.delta * (rc[0] + rc[1] * c.zen);
    cc = exp(base > 0 ? exp(rc[2] * log(base)) : 0) - rc[3];
    d = -exp(c.delta * (rd[0] + rd[1] * c.zen)) + rd[2] + c.delta * rd[3];
  }
  return [q(0), q(1), cc, d, q(4)];
}

/**
 * Relative Perez luminance (or radiance) at a sky direction: zenith angle cosine `cz` of the
 * element and cosine `cg` of its angle to the sun.
 */
export function perezRelative(
  p: readonly [number, number, number, number, number],
  cz: number,
  cg: number,
): number {
  const czc = cz < 0.01 ? 0.01 : cz;
  const g = atan2(Math.sqrt(Math.max(0, 1 - cg * cg)), cg);
  return (1 + p[0] * exp(p[1] / czc)) * (1 + p[2] * exp(p[3] * g) + p[4] * cg * cg);
}

/**
 * Patch radiance times solid angle for one hour, W/m2 per patch, so that the horizontal sum
 * equals `dhi`: irradiance on a plane is sum(V * out[p] * max(0, n . d_p)).
 */
export function skyVector(
  patches: Patches,
  sun: readonly [number, number, number],
  c: SkyCondition,
  dhi: number,
  out: Float64Array,
): void {
  const p = perezParams(c);
  let horiz = 0;
  for (let i = 0; i < patches.count; i++) {
    const dx = patches.dir[i * 3] as number;
    const dy = patches.dir[i * 3 + 1] as number;
    const dz = patches.dir[i * 3 + 2] as number;
    const l = perezRelative(p, dz, dx * sun[0] + dy * sun[1] + dz * sun[2]);
    const v = l > 0 ? l * (patches.omega[i] as number) : 0;
    out[i] = v;
    horiz += v * dz;
  }
  const k = horiz > 0 ? dhi / horiz : 0;
  for (let i = 0; i < patches.count; i++) out[i] = (out[i] as number) * k;
}

const EFF_DIRECT = [
  [57.2, -4.55, -2.98, 117.12],
  [98.99, -3.46, -1.21, 12.38],
  [109.83, -4.9, -1.71, -8.81],
  [110.34, -5.84, -1.99, -4.56],
  [106.36, -3.97, -1.75, -6.16],
  [107.19, -1.25, -1.51, -26.73],
  [105.75, 0.77, -1.26, -34.44],
  [101.18, 1.58, -1.1, -8.29],
] as const;
const EFF_DIFFUSE = [
  [97.24, -0.46, 12.0, -8.91],
  [107.22, 1.15, 0.59, -3.95],
  [104.97, 2.96, -5.53, -8.77],
  [102.39, 5.59, -13.95, -13.9],
  [100.71, 5.94, -22.75, -23.74],
  [106.42, 3.83, -36.15, -28.83],
  [141.88, 1.9, -53.24, -14.03],
  [152.23, 0.35, -45.27, -7.98],
] as const;

/** Perez 1990 luminous efficacy, lm/W, for the direct normal and diffuse parts. */
export function efficacy(c: SkyCondition, dewPointC: number): { direct: number; diffuse: number } {
  const w = exp(0.07 * dewPointC - 0.075);
  const a = EFF_DIRECT[c.bin] as readonly [number, number, number, number];
  const b = EFF_DIFFUSE[c.bin] as readonly [number, number, number, number];
  const direct = a[0] + a[1] * w + a[2] * exp(5.73 * c.zen - 5) + a[3] * c.delta;
  const diffuse = b[0] + b[1] * w + b[2] * cos(c.zen) + b[3] * log(c.delta);
  return { direct: direct > 0 ? direct : 0, diffuse: diffuse > 0 ? diffuse : 0 };
}
