/**
 * Sheet (Shoji 障子): a translucent sliding sheet (DESIGN_SYSTEM 4.3, 4.4, 8). Owner: WP-06.
 *
 * Wide screens: a side sheet that slides in on its rail from the right edge. Narrow screens: a
 * bottom sheet with three snap points (peek, half, full). Dragging the grip snaps to the nearest
 * point, and every snap also has a button, so nothing needs a drag (WCAG 2.5.7). Esc closes.
 * The sheet is not modal: the house beside it stays usable, so focus is not trapped.
 *
 * DOM: `aside.ib-sheet[data-open][data-snap][data-placement]`, `role="dialog"`, `aria-modal="false"`.
 */
import { useDrag } from '@use-gesture/react';
import { type CSSProperties, type ReactNode, useId, useRef, useState } from 'react';

export type SheetSnap = 'peek' | 'half' | 'full';
export const SHEET_SNAPS: readonly SheetSnap[] = ['peek', 'half', 'full'];
/** Height of each snap as a share of the viewport (bottom placement). */
export const SNAP_HEIGHT: Record<SheetSnap, number> = { peek: 0.22, half: 0.52, full: 0.92 };
const SNAP_LABEL: Record<SheetSnap, string> = { peek: 'Peek', half: 'Half', full: 'Full' };

export interface SheetProps {
  open: boolean;
  onClose?: () => void;
  title: ReactNode;
  /** Small line above the title, e.g. the element kind. */
  kicker?: ReactNode;
  /** Controlled snap (bottom placement). */
  snap?: SheetSnap;
  defaultSnap?: SheetSnap;
  onSnapChange?: (snap: SheetSnap) => void;
  /** `auto` is a side sheet from 900 px wide and a bottom sheet below. */
  placement?: 'auto' | 'side' | 'bottom';
  /** Shoji translucency (default) or opaque paper. */
  translucent?: boolean;
  /** Footer actions. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** The snap nearest to a height given as a share of the viewport. */
export function nearestSnap(share: number): SheetSnap {
  let best: SheetSnap = 'peek';
  for (const s of SHEET_SNAPS) {
    if (Math.abs(SNAP_HEIGHT[s] - share) < Math.abs(SNAP_HEIGHT[best] - share)) best = s;
  }
  return best;
}

export function Sheet({
  open,
  onClose,
  title,
  kicker,
  snap,
  defaultSnap = 'half',
  onSnapChange,
  placement = 'auto',
  translucent = true,
  actions,
  className,
  children,
}: SheetProps) {
  const titleId = useId();
  const [inner, setInner] = useState<SheetSnap>(defaultSnap);
  const current = snap ?? inner;
  const [drag, setDrag] = useState(0);
  const ref = useRef<HTMLElement>(null);

  const choose = (s: SheetSnap) => {
    if (snap === undefined) setInner(s);
    onSnapChange?.(s);
  };

  const bind = useDrag(
    ({ movement: [, my], last, velocity: [, vy], direction: [, dy] }) => {
      if (!last) {
        setDrag(my);
        return;
      }
      setDrag(0);
      const vh = typeof window === 'undefined' ? 800 : window.innerHeight || 800;
      // Project a flick a little further, as paper on a rail keeps sliding.
      const projected = my + dy * vy * 120;
      const share = SNAP_HEIGHT[current] - projected / vh;
      if (share < SNAP_HEIGHT.peek - 0.12 && onClose) {
        onClose();
        return;
      }
      choose(nearestSnap(share));
    },
    { axis: 'y', filterTaps: true, keys: false, pointer: { touch: true } },
  );

  const style = {
    '--ib-sheet-share': SNAP_HEIGHT[current],
    '--ib-sheet-drag': `${drag}px`,
  } as CSSProperties;

  return (
    <aside
      ref={ref}
      className={['ib-sheet', className].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-open={open ? '' : undefined}
      data-snap={current}
      data-placement={placement}
      data-translucent={translucent ? '' : undefined}
      data-dragging={drag !== 0 ? '' : undefined}
      inert={!open}
      aria-hidden={open ? undefined : true}
      style={style}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onClose) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="ib-sheet__grip" {...bind()} aria-hidden="true">
        <span className="ib-sheet__grip-bar" />
      </div>
      <header className="ib-sheet__head">
        <div className="ib-sheet__titles">
          {kicker ? <p className="ib-kicker">{kicker}</p> : null}
          <h2 id={titleId} className="ib-sheet__title">
            {title}
          </h2>
        </div>
        <div className="ib-sheet__controls">
          <fieldset className="ib-sheet__snaps">
            <legend className="ib-sr">Sheet height</legend>
            {SHEET_SNAPS.map((s) => (
              <button
                key={s}
                type="button"
                className="ib-sheet__snap"
                data-snap={s}
                aria-pressed={current === s}
                title={SNAP_LABEL[s]}
                onClick={() => choose(s)}
              >
                <span className="ib-sheet__snap-mark" aria-hidden="true" />
                <span className="ib-sr">{SNAP_LABEL[s]}</span>
              </button>
            ))}
          </fieldset>
          {onClose ? (
            <button type="button" className="ib-sheet__close" onClick={onClose}>
              <span aria-hidden="true" className="ib-sheet__close-x" />
              <span className="ib-sr">Close</span>
            </button>
          ) : null}
        </div>
      </header>
      <div className="ib-sheet__body">{children}</div>
      {actions ? <footer className="ib-sheet__actions">{actions}</footer> : null}
    </aside>
  );
}
