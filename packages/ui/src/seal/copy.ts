/**
 * Seal copy (SPEC R11, DESIGN_SYSTEM 9). Owner: WP-06.
 * English defaults for T1. Every seal carries one line saying what is not proved. Never
 * "guaranteed", "verified savings" or "AI-verified". Callers may pass their own line.
 */
import type { CheckerRungId, SealLevel } from '@ibasho/core';

/** States a seal on a number can be in. Numbers are never Proved (SPEC R11). */
export type NumberSeal = SealLevel | 'pressing';
/** Every seal state, including Proved, which only a claim may carry. */
export type SealKind = NumberSeal | 'proved';

export const SEAL_LABEL: Record<SealKind, string> = {
  proved: 'Proved',
  checked: 'Checked',
  modelled: 'Modelled',
  cracked: 'Check failed',
  unverified: 'Unverified rule',
  pressing: 'Checking',
  preview: 'Preview',
};

export const RUNG_LABEL: Record<CheckerRungId, string> = {
  'lean-native': 'Lean',
  'lean-wasm': 'Lean in your browser',
  mirror: 'the mirror checker',
};

/** Default "Not proved" lines for number seals. */
export const NOT_PROVED: Record<NumberSeal, string> = {
  checked: 'that the inputs are right. Only the arithmetic was re-derived from the certificate.',
  modelled: 'that our energy model matches your home exactly.',
  cracked: 'this number. Its check failed, so we show it marked for you to judge.',
  unverified: 'this rule. It has no checked encoding yet.',
  pressing: 'anything yet. The check is still running.',
  preview: 'anything. This is Preview data, recorded to show the flow, not computed for this building.',
};

export interface CheckInfo {
  rung: CheckerRungId;
  coverage: 'all' | 'sample';
}

/** "by Lean, every row" or "by the mirror checker, on a sample". */
export function checkDetail(check: CheckInfo | undefined): string | undefined {
  if (!check) return undefined;
  return `by ${RUNG_LABEL[check.rung]}, ${check.coverage === 'all' ? 'every row' : 'on a sample'}`;
}

export const notProvedLine = (body: string): string => `Not proved: ${body}`;
