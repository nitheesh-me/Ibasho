/**
 * GradeBadge: how good a source is (DESIGN_SYSTEM 8; SPEC R17). Owner: WP-06.
 *
 * `primary` and `secondary` are quiet ink outlines. `announced` and `estimate` are the R17 flags:
 * anything graded so shows a visible badge, with a dashed or pencil-hatched edge as well as
 * colour, so the grade reads in greyscale.
 *
 * DOM: `span.ib-grade[data-grade]`, its full meaning in `title` and the accessible name.
 */
import type { Grade } from '@ibasho/core';

export const GRADE_LABEL: Record<Grade, string> = {
  primary: 'Primary source',
  secondary: 'Secondary source',
  announced: 'Announced',
  estimate: 'Estimate',
};

export const GRADE_MEANING: Record<Grade, string> = {
  primary: 'From the original publisher of the figure.',
  secondary: 'From a reputable source that quotes the original.',
  announced: 'Announced but not yet in force or published in full.',
  estimate: 'Our estimate: no published source yet, so treat it as a guide.',
};

/** R17: grades that must always show a visible badge. */
export const isFlagged = (g: Grade): boolean => g === 'announced' || g === 'estimate';

export interface GradeBadgeProps {
  grade: Grade;
  /** Short form ("Estimate") or the long label. Default short. */
  long?: boolean;
  className?: string;
}

export function GradeBadge({ grade, long = false, className }: GradeBadgeProps) {
  const short = grade === 'primary' ? 'Primary' : grade === 'secondary' ? 'Secondary' : GRADE_LABEL[grade];
  return (
    <span
      className={['ib-grade', className].filter(Boolean).join(' ')}
      data-grade={grade}
      data-flagged={isFlagged(grade) ? '' : undefined}
      title={GRADE_MEANING[grade]}
    >
      {long ? GRADE_LABEL[grade] : short}
      <span className="ib-sr">. {GRADE_MEANING[grade]}</span>
    </span>
  );
}
