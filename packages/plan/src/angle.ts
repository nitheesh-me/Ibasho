/**
 * Deterministic angles for the plan kernel (ARCH 15.2: no transcendental `Math.*`). Only + - * /
 * and `Math.sqrt`, which IEEE 754 rounds identically everywhere. Angles are integer millidegrees.
 */
import { cos, PI, sin } from '@ibasho/dmath';

const SQRT3 = 1.7320508075688772;
const TAN15 = 0.2679491924311227;

/** atan on [0, 1] by reduction to [0, tan 15°] and a 13 term series (error below 1e-15). */
function atan01(z: number): number {
  let base = 0;
  let t = z;
  if (t > TAN15) {
    base = PI / 6;
    t = (t * SQRT3 - 1) / (SQRT3 + t);
  }
  const t2 = t * t;
  let term = t;
  let sum = 0;
  for (let k = 0; k < 13; k++) {
    sum += (k % 2 === 0 ? term : -term) / (2 * k + 1);
    term *= t2;
  }
  return base + sum;
}

/** atan2(y, x) in radians, deterministic. */
export function atan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  let a = ay <= ax ? atan01(ay / ax) : PI / 2 - atan01(ax / ay);
  if (x < 0) a = PI - a;
  return y < 0 ? -a : a;
}

/** Normalise millidegrees to [0, 360000). */
export function normMdeg(m: number): number {
  return ((Math.round(m) % 360_000) + 360_000) % 360_000;
}

/** Azimuth (clockwise from +y, the frame's north) of the vector (dx east, dy north), millidegrees. */
export function azimuthMdeg(dx: number, dy: number): number {
  return normMdeg((atan2(dx, dy) * 180_000) / PI);
}

/** sin and cos of an angle in millidegrees (dmath, deterministic). */
export function sinCosMdeg(m: number): [number, number] {
  const r = (m * PI) / 180_000;
  return [sin(r), cos(r)];
}
