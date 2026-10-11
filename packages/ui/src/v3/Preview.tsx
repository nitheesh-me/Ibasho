/**
 * Preview, stale, tier and applicability marks (DESIGN_SYSTEM 13.3, SPEC R26, R34). Owner: WP-06.
 *
 * - `PreviewStamp`: the word "Preview" on a pencil hatch beside a number or a panel title. Never
 *   vermilion or gold, never with a seal (AC-PG3).
 * - `Stale`: pencil hatch and "updating" over content whose inputs changed. The old value stays
 *   visible under the hatch but is never shown as current.
 * - `TierCaption`: "rough" or "refining" until a stage is final.
 * - `ApplicabilityChip`: the R34 ladder in plain words. The word "compliant" never appears.
 */
import type { Applicability, Tier } from '@ibasho/core';
import type { ReactNode } from 'react';

export const PREVIEW_LINE =
  'Preview data, shaped like the real result but not yet computed for this building';

export function PreviewStamp({
  title = PREVIEW_LINE,
  compact = false,
}: {
  title?: string;
  compact?: boolean;
}) {
  return (
    <span className="ib-preview" data-compact={compact ? '' : undefined} title={title}>
      <span aria-hidden="true" className="ib-preview__hatch" />
      <span className="ib-preview__word">Preview</span>
      <span className="ib-sr">{` (${title})`}</span>
    </span>
  );
}

export interface StaleProps {
  stale: boolean;
  children: ReactNode;
  /** Inline wrappers sit inside a line of text. */
  inline?: boolean;
  label?: string;
}

export function Stale({ stale, children, inline = false, label = 'updating' }: StaleProps) {
  const Tag = inline ? 'span' : 'div';
  return (
    <Tag className="ib-stale" data-stale={stale ? '' : undefined} aria-busy={stale || undefined}>
      {children}
      {stale ? (
        <span className="ib-stale__word" aria-live="polite">
          {label}
        </span>
      ) : null}
    </Tag>
  );
}

const TIER_WORD: Record<Tier, string> = { rough: 'rough', refined: 'refining', final: '' };

export function TierCaption({ tier }: { tier: Tier | undefined }) {
  if (!tier || tier === 'final') return null;
  return (
    <span className="ib-tier" data-tier={tier}>
      {TIER_WORD[tier]}
    </span>
  );
}

export const APPLICABILITY_LABEL: Record<Applicability, string> = {
  reference: 'Reference',
  partial: 'Partial check',
  'adoption-unconfirmed': 'Local adoption must be confirmed',
  professional: 'Needs a professional',
  'not-a-certificate': 'Pre-check, not a certificate',
};

export function ApplicabilityChip({ value }: { value: Applicability }) {
  return (
    <span className="ib-appl" data-appl={value}>
      {APPLICABILITY_LABEL[value]}
    </span>
  );
}
