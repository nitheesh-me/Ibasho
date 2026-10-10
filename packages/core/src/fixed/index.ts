/**
 * Integer fixed point for bookkeeping (ARCH 4.3, SPEC 7.4). Owner: WP-00.
 * Mirrors `proofs/Ibasho/Spec/V2/Fixed.lean` (WP-04). Every rounding point is named and exact.
 *
 * Units after quantisation: energy in integer Wh, carbon in integer gCO2e, money in integer
 * micro-pence (micro-paise for INR). Rates are integer parts per billion (ppb): 3.5% = 35_000_000n.
 * Discount and growth factors are integers scaled by 10^12.
 */

export type Wh = bigint;
export type GCO2e = bigint;
export type MicroPence = bigint;
export type MicroPaise = bigint;
/** Rate in parts per billion. */
export type Ppb = bigint;

/** Scale of discount and growth factors: 10^12 means 1. */
export const DF_SCALE = 1_000_000_000_000n;
/** One whole in parts per billion. */
export const PPB = 1_000_000_000n;

export type RoundingMode = 'half-even' | 'floor' | 'ceil' | 'trunc';

export class FixedPointError extends Error {
  override name = 'FixedPointError';
}

function floorDiv(n: bigint, d: bigint): bigint {
  const q = n / d; // truncates toward zero
  return n % d !== 0n && n < 0n !== d < 0n ? q - 1n : q;
}

/**
 * n / d rounded to the nearest integer, ties to even (banker's rounding). `d` must be non-zero.
 * Works for any signs.
 */
export function roundHalfEven(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new FixedPointError('roundHalfEven: division by zero');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const q = floorDiv(n, d);
  const r = n - q * d; // 0 <= r < d
  const twice = 2n * r;
  if (twice > d) return q + 1n;
  if (twice < d) return q;
  return q % 2n === 0n ? q : q + 1n;
}

/** n / d with an explicit rounding mode. */
export function divRound(n: bigint, d: bigint, mode: RoundingMode = 'half-even'): bigint {
  if (d === 0n) throw new FixedPointError('divRound: division by zero');
  switch (mode) {
    case 'half-even':
      return roundHalfEven(n, d);
    case 'floor':
      return floorDiv(n, d);
    case 'ceil':
      return -floorDiv(-n, d);
    case 'trunc':
      return n / d;
  }
}

/**
 * a * b / d, rounded once at the end (the named rounding point is the division).
 * Intermediate product is exact (bigint), so no precision is lost before rounding.
 */
export function mulDiv(a: bigint, b: bigint, d: bigint, mode: RoundingMode = 'half-even'): bigint {
  return divRound(a * b, d, mode);
}

function checkYears(years: number): void {
  if (!Number.isInteger(years) || years < 0)
    throw new FixedPointError(`years must be a non-negative integer, got ${years}`);
}

/**
 * Discount factors D_0..D_years scaled by 10^12 (SPEC 7.4):
 *   D_0 = 10^12,  D_t = roundHalfEven(D_{t-1} * 10^9 / (10^9 + r_ppb)).
 * Rounding happens once per year step, exactly as in Lean. Returns `years + 1` factors.
 */
export function discountFactors(rPpb: Ppb, years: number): bigint[] {
  checkYears(years);
  if (PPB + rPpb <= 0n) throw new FixedPointError('discount rate must be greater than -100%');
  const out: bigint[] = [DF_SCALE];
  let d = DF_SCALE;
  for (let t = 1; t <= years; t++) {
    d = roundHalfEven(d * PPB, PPB + rPpb);
    out.push(d);
  }
  return out;
}

/**
 * Growth factors G_0..G_years scaled by 10^12, the same recurrence form used for escalation
 * (g > 0) and degradation (g < 0):  G_0 = 10^12,  G_t = roundHalfEven(G_{t-1} * (10^9 + g_ppb) / 10^9).
 */
export function growthFactors(gPpb: Ppb, years: number): bigint[] {
  checkYears(years);
  if (PPB + gPpb < 0n) throw new FixedPointError('growth rate must be at least -100%');
  const out: bigint[] = [DF_SCALE];
  let g = DF_SCALE;
  for (let t = 1; t <= years; t++) {
    g = roundHalfEven(g * (PPB + gPpb), PPB);
    out.push(g);
  }
  return out;
}

/** Apply a 10^12-scaled factor to an amount: roundHalfEven(amount * factor / 10^12). */
export function applyFactor(amount: bigint, factor: bigint): bigint {
  return roundHalfEven(amount * factor, DF_SCALE);
}

const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;

/**
 * Parse an exact decimal string into an integer scaled by 10^scale, rounding half even if the
 * string has more fractional digits than `scale`. Never goes through a float.
 * `parseScaled('3.5', 7)` = 35_000_000n (3.5% in ppb is `parseScaled('3.5', 7)`).
 */
export function parseScaled(s: string, scale: number): bigint {
  const m = DECIMAL.exec(s.trim());
  if (!m) throw new FixedPointError(`not a decimal: ${JSON.stringify(s)}`);
  if (!Number.isInteger(scale) || scale < 0)
    throw new FixedPointError('scale must be a non-negative integer');
  const neg = m[1] === '-';
  const int = m[2]!;
  const frac = m[3] ?? '';
  const digits = BigInt(int + frac);
  const shift = scale - frac.length;
  const mag = shift >= 0 ? digits * 10n ** BigInt(shift) : roundHalfEven(digits, 10n ** BigInt(-shift));
  return neg ? -mag : mag;
}

/** Percentage decimal string to ppb: `'3.5'` gives 35_000_000n. */
export function percentToPpb(percent: string): Ppb {
  return parseScaled(percent, 7);
}

/** Format an integer scaled by 10^scale as an exact decimal string (no trailing-zero trimming). */
export function formatScaled(n: bigint, scale: number): string {
  if (!Number.isInteger(scale) || scale < 0)
    throw new FixedPointError('scale must be a non-negative integer');
  const neg = n < 0n;
  const abs = (neg ? -n : n).toString().padStart(scale + 1, '0');
  const body = scale === 0 ? abs : `${abs.slice(0, abs.length - scale)}.${abs.slice(abs.length - scale)}`;
  return neg ? `-${body}` : body;
}

const WIRE_INT = /^-?(0|[1-9]\d*)$/;

/** Wire format of a fixed-point integer: a decimal string, never a JSON number. */
export function toWire(n: bigint): string {
  return n.toString();
}
/** Parse the wire format strictly (no leading zeros, no plus sign, no `-0`). */
export function fromWire(s: string): bigint {
  if (!WIRE_INT.test(s) || s === '-0')
    throw new FixedPointError(`bad fixed-point wire value: ${JSON.stringify(s)}`);
  return BigInt(s);
}

/** Sum of bigints. */
export function sumBig(xs: Iterable<bigint>): bigint {
  let s = 0n;
  for (const x of xs) s += x;
  return s;
}

/** Namespace object matching ARCH 4.3 `Fixed`. */
export const Fixed = {
  roundHalfEven,
  divRound,
  mulDiv,
  discountFactors,
  growthFactors,
  applyFactor,
  parseScaled,
  formatScaled,
  percentToPpb,
  toWire,
  fromWire,
  sumBig,
  DF_SCALE,
  PPB,
} as const;
