/**
 * Exact rationals for the score (ARCH 4.3, SPEC R20). Owner: WP-00.
 * A `Q` is always normalised: d > 0 and gcd(|n|, d) = 1. Plain data, structured-cloneable.
 * Wire format: the string `"n/d"` (or `"n"` when d = 1).
 */
import { roundHalfEven } from '../fixed/index.ts';

export interface Q {
  readonly n: bigint;
  readonly d: bigint;
}

export class RationalError extends Error {
  override name = 'RationalError';
}

function abs(x: bigint): bigint {
  return x < 0n ? -x : x;
}

export function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

function toBig(x: bigint | number): bigint {
  if (typeof x === 'bigint') return x;
  if (!Number.isSafeInteger(x)) throw new RationalError(`not a safe integer: ${x}`);
  return BigInt(x);
}

/** Build a normalised rational n/d. */
function make(n: bigint | number, d: bigint | number = 1n): Q {
  let nn = toBig(n);
  let dd = toBig(d);
  if (dd === 0n) throw new RationalError('zero denominator');
  if (dd < 0n) {
    nn = -nn;
    dd = -dd;
  }
  const g = gcd(nn, dd);
  return g > 1n ? { n: nn / g, d: dd / g } : { n: nn, d: dd };
}

const add = (a: Q, b: Q): Q => make(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Q, b: Q): Q => make(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q): Q => make(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q): Q => {
  if (b.n === 0n) throw new RationalError('division by zero');
  return make(a.n * b.d, a.d * b.n);
};
const neg = (a: Q): Q => ({ n: -a.n, d: a.d });
const qabs = (a: Q): Q => ({ n: abs(a.n), d: a.d });
const cmp = (a: Q, b: Q): -1 | 0 | 1 => {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
};
const eq = (a: Q, b: Q): boolean => a.n === b.n && a.d === b.d;
const lt = (a: Q, b: Q): boolean => cmp(a, b) < 0;
const le = (a: Q, b: Q): boolean => cmp(a, b) <= 0;
const min = (a: Q, b: Q): Q => (le(a, b) ? a : b);
const max = (a: Q, b: Q): Q => (le(a, b) ? b : a);
const clamp = (x: Q, lo: Q, hi: Q): Q => {
  if (lt(hi, lo)) throw new RationalError('clamp: hi < lo');
  return min(max(x, lo), hi);
};
const sum = (xs: Iterable<Q>): Q => {
  let s = ZERO;
  for (const x of xs) s = add(s, x);
  return s;
};
const isZero = (a: Q): boolean => a.n === 0n;
/** Largest integer <= a. */
const floor = (a: Q): bigint => {
  const q = a.n / a.d;
  return a.n < 0n && a.n % a.d !== 0n ? q - 1n : q;
};
/** a rounded to the nearest integer, ties to even. */
const roundHE = (a: Q): bigint => roundHalfEven(a.n, a.d);
/** a * 10^scale rounded half even: fixed-point view of a rational. */
const toScaled = (a: Q, scale: number): bigint => roundHalfEven(a.n * 10n ** BigInt(scale), a.d);

const DEC = /^(-)?(\d+)(?:\.(\d+))?$/;
/** Exact rational from a decimal string: `'0.15'` gives 3/20. */
const fromDecimal = (s: string): Q => {
  const m = DEC.exec(s.trim());
  if (!m) throw new RationalError(`not a decimal: ${JSON.stringify(s)}`);
  const frac = m[3] ?? '';
  const n = BigInt((m[2] ?? '0') + frac) * (m[1] ? -1n : 1n);
  return make(n, 10n ** BigInt(frac.length));
};

const WIRE = /^(-?(?:0|[1-9]\d*))(?:\/([1-9]\d*))?$/;
const toWire = (a: Q): string => (a.d === 1n ? a.n.toString() : `${a.n}/${a.d}`);
/** Parse `"n/d"` or `"n"`; the result must already be normalised (canonical wire form). */
const fromWire = (s: string): Q => {
  const m = WIRE.exec(s);
  if (!m || m[1] === '-0') throw new RationalError(`bad rational wire value: ${JSON.stringify(s)}`);
  const v = make(BigInt(m[1]!), m[2] ? BigInt(m[2]) : 1n);
  if (toWire(v) !== s) throw new RationalError(`rational wire value not normalised: ${s}`);
  return v;
};
/** Float approximation, for display only (never for bookkeeping). */
const toNumber = (a: Q): number => Number(a.n) / Number(a.d);
const isQ = (v: unknown): v is Q =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as Q).n === 'bigint' &&
  typeof (v as Q).d === 'bigint' &&
  (v as Q).d > 0n &&
  gcd((v as Q).n, (v as Q).d) === 1n;

const ZERO: Q = { n: 0n, d: 1n };
const ONE: Q = { n: 1n, d: 1n };

/** Rational operations. `Q.of(3, 20)` is 3/20. */
export const Q = {
  of: make,
  ZERO,
  ONE,
  add,
  sub,
  mul,
  div,
  neg,
  abs: qabs,
  cmp,
  eq,
  lt,
  le,
  min,
  max,
  clamp,
  sum,
  isZero,
  floor,
  roundHalfEven: roundHE,
  toScaled,
  fromDecimal,
  toWire,
  fromWire,
  toNumber,
  isQ,
} as const;
