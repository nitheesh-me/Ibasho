/**
 * Exact decimals for display rounding. Owner: WP-06.
 *
 * A `Dec` is `m * 10^e` with a bigint mantissa. Fixed-point evidence values (integer Wh, gCO2e,
 * micro-pence) never pass through a float on their way to the screen, and every display rounding
 * is half even, like the bookkeeping (SPEC 7.4: display rounding happens only in the renderer).
 */
import { roundHalfEven } from '@ibasho/core';

export interface Dec {
  readonly m: bigint;
  readonly e: number;
}

const DEC = /^([+-])?(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i;

export class DecimalError extends Error {
  override name = 'DecimalError';
}

/** Parse a decimal string such as `-12.50`, `1240000` or `1.5e-7`. */
export function decFromString(s: string): Dec {
  const r = DEC.exec(s.trim());
  if (!r) throw new DecimalError(`not a decimal: ${JSON.stringify(s)}`);
  const frac = r[3] ?? '';
  const mag = BigInt(r[2]! + frac);
  return { m: r[1] === '-' ? -mag : mag, e: Number(r[4] ?? 0) - frac.length };
}

/** The exact decimal a JavaScript number prints as (its shortest round-trip form). */
export function decFromNumber(x: number): Dec {
  if (!Number.isFinite(x)) throw new DecimalError(`not finite: ${x}`);
  return decFromString(String(x));
}

/** A rational n/d to `digits` fractional digits, half even. */
export function decFromRatio(n: bigint, d: bigint, digits = 18): Dec {
  if (d === 0n) throw new DecimalError('division by zero');
  return { m: roundHalfEven(n * 10n ** BigInt(digits), d), e: -digits };
}

/** Multiply by 10^k (exact). */
export const shift = (d: Dec, k: number): Dec => ({ m: d.m, e: d.e + k });

export const sign = (d: Dec): -1 | 0 | 1 => (d.m < 0n ? -1 : d.m > 0n ? 1 : 0);
export const abs = (d: Dec): Dec => (d.m < 0n ? { m: -d.m, e: d.e } : d);

/** Round to a multiple of 10^e, half even. Never adds false precision. */
export function roundToExp(d: Dec, e: number): Dec {
  if (d.e >= e) return d;
  return { m: roundHalfEven(d.m, 10n ** BigInt(e - d.e)), e };
}

function digits(m: bigint): number {
  return (m < 0n ? -m : m).toString().length;
}

/** Round to `sig` significant figures, half even. */
export function roundSig(d: Dec, sig: number): Dec {
  if (!Number.isInteger(sig) || sig < 1) throw new DecimalError(`bad significant figures ${sig}`);
  if (d.m === 0n) return { m: 0n, e: 0 };
  const msd = d.e + digits(d.m) - 1;
  return roundToExp(d, msd - sig + 1);
}

/** Remove trailing zeros from the mantissa (1000e0 becomes 1e3). */
export function normalise(d: Dec): Dec {
  if (d.m === 0n) return { m: 0n, e: 0 };
  let { m, e } = d;
  while (m % 10n === 0n) {
    m /= 10n;
    e += 1;
  }
  return { m, e };
}

/**
 * Round to the nearest multiple of `step` (> 0), half even. The result carries the step's
 * resolution: a step of 1000 keeps no digits below the thousands.
 */
export function roundStep(d: Dec, rawStep: Dec): Dec {
  if (rawStep.m <= 0n) throw new DecimalError('step must be positive');
  const step = normalise(rawStep);
  const k = d.e - step.e;
  const n = k >= 0 ? d.m * 10n ** BigInt(k) : d.m;
  const den = k >= 0 ? step.m : step.m * 10n ** BigInt(-k);
  return { m: roundHalfEven(n, den) * step.m, e: step.e };
}

/** Plain decimal string with exactly max(0, -e) fractional digits (`-0` never appears). */
export function decToString(d: Dec): string {
  const neg = d.m < 0n;
  let body: string;
  if (d.e >= 0) body = ((neg ? -d.m : d.m) * 10n ** BigInt(d.e)).toString();
  else {
    const s = (neg ? -d.m : d.m).toString().padStart(-d.e + 1, '0');
    body = `${s.slice(0, s.length + d.e)}.${s.slice(s.length + d.e)}`;
  }
  return neg && d.m !== 0n ? `-${body}` : body;
}

/** Fractional digits the decimal carries. */
export const fractionDigits = (d: Dec): number => Math.max(0, -d.e);
