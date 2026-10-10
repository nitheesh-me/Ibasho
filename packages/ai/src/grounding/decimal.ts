/**
 * Exact decimal rounding and en-GB number formatting for the renderer (AM 3.2, SPEC 7.4).
 *
 * Determinism (E4): no `Intl`, no `Math`, no float arithmetic. A number is read through
 * `Number.prototype.toString`, which ECMAScript defines exactly (shortest round-trip digits), so the
 * same double gives the same digits in every engine. All rounding is bigint half-even on those digits.
 * Display rounding happens only here; the evidence drawer shows exact values (AM 10 Q1).
 */
import { roundHalfEven } from '@ibasho/core';

/** value = sign * coef * 10^exp, with `coef` a non-negative integer. */
export interface Decimal {
  neg: boolean;
  coef: bigint;
  exp: number;
}

export class DecimalError extends Error {
  override name = 'DecimalError';
}

const NUM = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/;

/** Exact decimal of a finite double (its shortest round-trip form). */
export function toDecimal(n: number): Decimal {
  if (!Number.isFinite(n)) throw new DecimalError(`not a finite number: ${n}`);
  return parseDecimal(String(n));
}

/** Parse a plain or exponent decimal string. */
export function parseDecimal(s: string): Decimal {
  const m = NUM.exec(s);
  if (!m) throw new DecimalError(`not a decimal: ${s}`);
  const int = m[2] ?? '0';
  const frac = m[3] ?? '';
  const e = m[4] ? Number(m[4]) : 0;
  const coef = BigInt(int + frac);
  return { neg: m[1] === '-' && coef !== 0n, coef, exp: e - frac.length };
}

const pow10 = (k: number): bigint => 10n ** BigInt(k);

function align(a: Decimal, b: Decimal): { a: bigint; b: bigint; exp: number } {
  const exp = a.exp < b.exp ? a.exp : b.exp;
  return { a: a.coef * pow10(a.exp - exp), b: b.coef * pow10(b.exp - exp), exp };
}

/** Round to a multiple of `step` (a positive decimal), half to even. */
export function roundToStep(d: Decimal, step: Decimal): Decimal {
  if (step.coef === 0n || step.neg) throw new DecimalError('step must be positive');
  const { a, b, exp } = align(d, step);
  const q = roundHalfEven(a, b);
  const coef = q * b;
  return { neg: d.neg && coef !== 0n, coef, exp };
}

/** Round to `k` significant figures, half to even. */
export function roundToSig(d: Decimal, k: number): Decimal {
  if (!Number.isInteger(k) || k < 1) throw new DecimalError('significant figures must be a positive integer');
  const len = d.coef.toString().length;
  if (d.coef === 0n || len <= k) return d;
  const drop = len - k;
  const q = roundHalfEven(d.coef, pow10(drop));
  return { neg: d.neg && q !== 0n, coef: q, exp: d.exp + drop };
}

/** Magnitude. */
export function absDecimal(d: Decimal): Decimal {
  return { ...d, neg: false };
}

/** Shift the decimal point: value * 10^k. Used for unit conversion of fixed-point evidence. */
export function shift(d: Decimal, k: number): Decimal {
  return { ...d, exp: d.exp + k };
}

/** Plain decimal digits, trailing fractional zeros trimmed, no grouping, ASCII minus. */
export function plain(d: Decimal): string {
  let coef = d.coef;
  let exp = d.exp;
  while (exp < 0 && coef % 10n === 0n && coef !== 0n) {
    coef /= 10n;
    exp += 1;
  }
  if (coef === 0n) return '0';
  let body: string;
  if (exp >= 0) body = (coef * pow10(exp)).toString();
  else {
    const s = coef.toString().padStart(-exp + 1, '0');
    body = `${s.slice(0, s.length + exp)}.${s.slice(s.length + exp)}`;
  }
  return d.neg ? `-${body}` : body;
}

/** The decimal as a JS number (exact when representable). */
export function toNumber(d: Decimal): number {
  return Number(plain(d));
}

/** Group the integer part in threes with commas (en-GB). */
export function group(digits: string): string {
  const neg = digits.startsWith('-');
  const body = neg ? digits.slice(1) : digits;
  const dot = body.indexOf('.');
  const int = dot < 0 ? body : body.slice(0, dot);
  const frac = dot < 0 ? '' : body.slice(dot);
  let out = '';
  for (let i = 0; i < int.length; i++) {
    if (i > 0 && (int.length - i) % 3 === 0) out += ',';
    out += int[i];
  }
  return (neg ? '-' : '') + out + frac;
}

/** Typographic minus (U+2212) for display. */
export const MINUS = '−';
