/**
 * Mon: a crest from the set (DESIGN_SYSTEM 7). Owner: WP-06.
 *
 * Line variant by default (stroke 1.5 at 24 px, scaling with size); `filled` inks the disc and
 * knocks the motif out of it, for chapter and seal use. Decorative (`aria-hidden`) unless `title`
 * is set, which makes it an image with that name.
 */
import { MONS, type MonDef, type MonId } from './set.ts';

export interface MonProps {
  id: MonId;
  /** Pixel size: 16, 24, 32 or 48 (DS 7). Default 24. */
  size?: 16 | 24 | 32 | 48;
  filled?: boolean;
  /** Accessible name when the mon stands alone (no adjacent text label). */
  title?: string;
  className?: string;
}

export function Mon({ id, size = 24, filled = false, title, className }: MonProps) {
  const def: MonDef = MONS[id];
  const ink = filled ? 'var(--surface-raised)' : 'currentColor';
  return (
    <svg
      className={['ib-mon', className].filter(Boolean).join(' ')}
      data-mon={id}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      focusable="false"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <circle
        cx="12"
        cy="12"
        r="11"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <g stroke={ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {def.paths.map((p) => (
          <path key={p.d} d={p.d} fill={p.fill ? ink : 'none'} />
        ))}
        {def.circles?.map((c) => (
          <circle key={`${c.cx},${c.cy},${c.r}`} cx={c.cx} cy={c.cy} r={c.r} fill={c.fill ? ink : 'none'} />
        ))}
      </g>
    </svg>
  );
}
