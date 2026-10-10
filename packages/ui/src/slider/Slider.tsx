/**
 * Slider (Kumiko 組子): a slider as a wooden lattice bar (DESIGN_SYSTEM 8, 12; UX 6.1). Owner: WP-06.
 *
 * The bar is a strip of kumiko joinery; a lattice cell lights at each stop and a timber key sits on
 * the chosen one. Values are discrete stops, each an evidence node, so the readout is a `Num` and
 * the bar never shows a number the evidence does not hold (e.g. loft depths of a measure, or flow
 * temperatures). Keyboard: arrows step, Page keys jump a quarter, Home and End go to the ends.
 * Dragging is never required (WCAG 2.5.7): tap the bar or use the step buttons.
 *
 * DOM: `.ib-kumiko[data-index]`, the thumb `[role="slider"]` with `aria-valuetext` in words.
 */

import type { EvidenceId } from '@ibasho/core';
import { useDrag } from '@use-gesture/react';
import { type CSSProperties, type KeyboardEvent, type ReactNode, useId, useRef, useState } from 'react';
import { useEvidenceSource } from '../evidence/context.tsx';
import { formatEvidence } from '../num/format.ts';
import { Num, type NumProps } from '../num/Num.tsx';

export interface SliderStop {
  key: string;
  /** The value at this stop. */
  ev: EvidenceId;
  /** Spoken text when the node is missing or a stop needs words ("As now"). */
  label?: string;
}

export interface SliderProps {
  /** Visible label; a string is also the accessible name. */
  label: ReactNode;
  /** Accessible name when `label` is not a string. */
  ariaLabel?: string;
  stops: readonly SliderStop[];
  /** Controlled index. */
  index?: number;
  defaultIndex?: number;
  onChange?: (index: number, stop: SliderStop) => void;
  /** One line under the bar, e.g. "Deeper insulation, smaller gains each step." */
  hint?: ReactNode;
  /** Mark one stop as the home today. */
  currentIndex?: number;
  as?: NumProps['as'];
  disabled?: boolean;
  className?: string;
}

/** Index after a key press, or undefined when the key is not a slider key. */
export function sliderKey(key: string, index: number, count: number): number | undefined {
  const last = count - 1;
  const page = Math.max(1, Math.round(count / 4));
  const clamp = (i: number) => (i < 0 ? 0 : i > last ? last : i);
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return clamp(index + 1);
    case 'ArrowLeft':
    case 'ArrowDown':
      return clamp(index - 1);
    case 'PageUp':
      return clamp(index + page);
    case 'PageDown':
      return clamp(index - page);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return undefined;
  }
}

/** The stop nearest a share (0 to 1) along the bar. */
export const stopAt = (share: number, count: number): number =>
  count <= 1 ? 0 : Math.min(count - 1, Math.max(0, Math.round(share * (count - 1))));

export function Slider({
  label,
  ariaLabel,
  stops,
  index,
  defaultIndex = 0,
  onChange,
  hint,
  currentIndex,
  as,
  disabled = false,
  className,
}: SliderProps) {
  const src = useEvidenceSource();
  const labelId = useId();
  const hintId = useId();
  const [inner, setInner] = useState(defaultIndex);
  const [dragging, setDragging] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const count = stops.length;
  const at = Math.min(Math.max(0, index ?? inner), Math.max(0, count - 1));
  const stop = stops[at];

  const set = (i: number) => {
    if (disabled || i === at || !stops[i]) return;
    if (index === undefined) setInner(i);
    onChange?.(i, stops[i] as SliderStop);
  };

  const bind = useDrag(
    ({ xy: [x], first, last, event }) => {
      if (disabled) return;
      const rect = bar.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      if (first) event.preventDefault?.();
      setDragging(!last);
      set(stopAt((x - rect.left) / rect.width, count));
    },
    { filterTaps: false, keys: false, pointer: { touch: true } },
  );

  const spoken = (s: SliderStop | undefined): string => {
    if (!s) return '';
    const node = src.node(s.ev);
    if (!node) return s.label ?? 'Not known';
    try {
      const f = formatEvidence(node, {
        ...(src.locale ? { locale: src.locale } : {}),
        ...(as ? { as } : {}),
      });
      return s.label ? `${f.spoken}, ${s.label}` : f.spoken;
    } catch {
      return s.label ?? 'Not known';
    }
  };

  const share = count <= 1 ? 0 : at / (count - 1);
  const style = { '--at': share, '--count': count } as CSSProperties;

  return (
    <div
      className={['ib-kumiko', className].filter(Boolean).join(' ')}
      data-index={at}
      data-disabled={disabled ? '' : undefined}
      data-dragging={dragging ? '' : undefined}
      style={style}
    >
      <div className="ib-kumiko__head">
        <span id={labelId} className="ib-kumiko__label">
          {label}
        </span>
        <span className="ib-kumiko__value">
          {stop ? <Num ev={stop.ev} size="ui" {...(as ? { as } : {})} /> : null}
          {stop?.label ? <span className="ib-kumiko__stop-label">{stop.label}</span> : null}
        </span>
      </div>
      <div className="ib-kumiko__row">
        <button
          type="button"
          className="ib-kumiko__step"
          data-step="down"
          disabled={disabled || at === 0}
          onClick={() => set(at - 1)}
        >
          <span aria-hidden="true" className="ib-kumiko__step-mark" />
          <span className="ib-sr">Less</span>
        </button>
        <div className="ib-kumiko__bar" ref={bar} {...bind()}>
          <span className="ib-kumiko__lattice" aria-hidden="true" />
          <span className="ib-kumiko__cells" aria-hidden="true">
            {stops.map((s, i) => (
              <span
                key={s.key}
                className="ib-kumiko__cell"
                data-on={i <= at ? '' : undefined}
                data-current={i === currentIndex ? '' : undefined}
              />
            ))}
          </span>
          <span
            className="ib-kumiko__key"
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-labelledby={ariaLabel ? undefined : labelId}
            aria-label={ariaLabel}
            aria-describedby={hint ? hintId : undefined}
            aria-valuemin={0}
            aria-valuemax={Math.max(0, count - 1)}
            aria-valuenow={at}
            aria-valuetext={spoken(stop)}
            aria-disabled={disabled || undefined}
            onKeyDown={(e: KeyboardEvent) => {
              const next = sliderKey(e.key, at, count);
              if (next === undefined) return;
              e.preventDefault();
              set(next);
            }}
          />
        </div>
        <button
          type="button"
          className="ib-kumiko__step"
          data-step="up"
          disabled={disabled || at >= count - 1}
          onClick={() => set(at + 1)}
        >
          <span aria-hidden="true" className="ib-kumiko__step-mark" />
          <span className="ib-sr">More</span>
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="ib-kumiko__hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
