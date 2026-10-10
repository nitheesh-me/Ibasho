/**
 * Geometry from evidence. Owner: WP-06.
 *
 * Bars, rings and band strips need a length. That length is read from the same evidence node the
 * label's `Num` renders, so a mark never encodes a value the chip does not show (DS 1 rule 3).
 * These are plain JS numbers for drawing only; they are never printed.
 */
import type { EvidenceId, EvidenceNode } from '@ibasho/core';
import { decFromString } from './decimal.ts';

export interface Magnitude {
  lo: number;
  hi: number;
  /** Likely value: the point, or the middle of a range. */
  mid: number;
  /** True when the node is a range (estimated or unknown). */
  range: boolean;
}

function decToNumber(s: string): number {
  const d = decFromString(s);
  return Number(d.m) * 10 ** d.e;
}

/** The node's value as drawable numbers, or undefined for categorical values. */
export function magnitude(node: EvidenceNode | undefined): Magnitude | undefined {
  if (!node) return undefined;
  const v = node.value;
  if ('fixed' in v) {
    const x = decToNumber(v.fixed);
    return { lo: x, hi: x, mid: x, range: false };
  }
  if ('exact' in v) {
    const x = Number(v.exact.n) / Number(v.exact.d);
    return { lo: x, hi: x, mid: x, range: false };
  }
  if ('float' in v) return { lo: v.float, hi: v.float, mid: v.float, range: false };
  if ('interval' in v) {
    const { lo, hi } = v.interval;
    return { lo, hi, mid: (lo + hi) / 2, range: true };
  }
  return undefined;
}

/** Look up and measure in one step. */
export function magnitudeOf(
  lookup: (id: EvidenceId) => EvidenceNode | undefined,
  id: EvidenceId | undefined,
): Magnitude | undefined {
  return id ? magnitude(lookup(id)) : undefined;
}

/** Clamp to [0, 1]. */
export const unit = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : Number.isFinite(x) ? x : 0);
