/**
 * Compare grid and film strip (SPEC 18.4, 20, UV 4.1, 5.2). Owner: WP-06.
 *
 * CompareGrid: one view, two side by side, or a 1 + 3 layout for three or four (the Shugi rule: no
 * four corners meet). Each slot names its scenario and can be focused.
 *
 * FilmStrip: past versions as small drawings with the EUI after each, so people can step back to the
 * version that was better ("undo is a scroll"). Arrow keys move; every frame is a button.
 */
import type { EvidenceId } from '@ibasho/core';
import type { KeyboardEvent, ReactNode } from 'react';
import { Num } from '../num/Num.tsx';

export interface CompareSlot {
  id: string;
  label: string;
  kicker?: string;
  body: ReactNode;
}

export function CompareGrid({
  slots,
  focus,
  onFocus,
}: {
  slots: CompareSlot[];
  focus?: string | undefined;
  onFocus?: (id: string) => void;
}) {
  const n = Math.min(4, slots.length);
  const layout = n <= 1 ? 'one' : n === 2 ? 'two' : 'one-three';
  return (
    <div className="ib-compare" data-layout={layout} data-count={n}>
      {slots.slice(0, 4).map((s, i) => (
        <section
          key={s.id}
          className="ib-compare__slot"
          data-lead={i === 0 ? '' : undefined}
          data-focus={focus === s.id ? '' : undefined}
          aria-label={s.label}
        >
          <header className="ib-compare__head">
            {s.kicker ? <span className="ib-compare__kicker">{s.kicker}</span> : null}
            <span className="ib-compare__label">{s.label}</span>
            {onFocus ? (
              <button
                type="button"
                className="ib-link"
                onClick={() => onFocus(s.id)}
                aria-pressed={focus === s.id}
              >
                {focus === s.id ? 'Main view' : 'Show large'}
              </button>
            ) : null}
          </header>
          <div className="ib-compare__body">{s.body}</div>
        </section>
      ))}
    </div>
  );
}

export interface FilmFrame {
  id: string;
  label: string;
  /** When, in words ("2 min ago" is the caller's copy). */
  when?: string;
  thumb: ReactNode;
  eui?: EvidenceId;
  origin?: 'person' | 'agent' | 'partner' | 'import';
}

export function FilmStrip({
  frames,
  current,
  onPick,
  title = 'Versions',
}: {
  frames: FilmFrame[];
  current?: string | undefined;
  onPick?: (id: string) => void;
  title?: string;
}) {
  const onKey = (e: KeyboardEvent<HTMLOListElement>) => {
    if (!onPick || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const i = frames.findIndex((f) => f.id === current);
    const next = frames[Math.min(frames.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))];
    if (next) {
      e.preventDefault();
      onPick(next.id);
    }
  };
  return (
    <section className="ib-film" aria-label={title}>
      <h4 className="ib-film__title">{title}</h4>
      <ol className="ib-film__frames" onKeyDown={onKey}>
        {frames.map((f) => (
          <li key={f.id} className="ib-film__frame" data-current={f.id === current ? '' : undefined}>
            <button
              type="button"
              className="ib-film__btn"
              aria-current={f.id === current ? 'step' : undefined}
              onClick={() => onPick?.(f.id)}
            >
              <span className="ib-film__thumb" aria-hidden="true">
                {f.thumb}
              </span>
              <span className="ib-film__label">{f.label}</span>
              {f.origin && f.origin !== 'person' ? <span className="ib-film__origin">{f.origin}</span> : null}
              {f.when ? <span className="ib-film__when">{f.when}</span> : null}
            </button>
            {f.eui ? (
              <span className="ib-film__eui">
                <Num ev={f.eui} size="ui" plain />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
