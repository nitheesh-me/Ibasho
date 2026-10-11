/**
 * Andon input controls for the studio (DESIGN_SYSTEM 8, 12, 13; design review city-V-P B3).
 * Owner: WP-06. No native range or select chrome anywhere in the studio.
 *
 * - `Range`: a stepped input value on a kumiko track (window share, opacity, set points). The
 *   readout is an input, drawn in `code`; results never go here (they use `Slider` with evidence).
 * - `SunScrubber`: the 24 hour time track. Night hatched on `--paper-sunk`, the daylight band on
 *   `--paper-raised`, sunrise and sunset ticks, solar noon, the day's sun altitude as a fine
 *   `--ember` arc, and a `--glow` disc thumb (a crescent at night). Keys: arrows 5 min, Page 1 h,
 *   Home and End go to sunrise and sunset.
 * - `Picker`: a button that opens a listbox (replaces native select), with type-ahead and arrows.
 *
 * Every drag has a button or key alternative (WCAG 2.5.7).
 */
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ------------------------------------------------------------------------------------------------
// Range

export interface RangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Fires on every step while dragging. */
  onInput?: (v: number) => void;
  /** Fires once on release, key or button (commit an edit here). */
  onChange: (v: number) => void;
  /** Readout text, e.g. `30%`. */
  format?: (v: number) => string;
  /** Hide the visible label (the accessible name stays). */
  hideLabel?: boolean;
  /** Mark a limit on the track (e.g. the ECBC 40% line). */
  mark?: { at: number; label: string };
  disabled?: boolean;
}

export function Range({
  label,
  value,
  min,
  max,
  step,
  onInput,
  onChange,
  format,
  hideLabel,
  mark,
  disabled,
}: RangeProps) {
  const [live, setLive] = useState(value);
  const dragging = useRef(false);
  const track = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!dragging.current) setLive(value);
  }, [value]);
  const snap = (v: number) => clamp(Math.round((v - min) / step) * step + min, min, max);
  const share = (v: number) => (max > min ? (v - min) / (max - min) : 0);
  const fmt = format ?? ((v: number) => String(v));
  const fromPointer = (e: PointerEvent) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return live;
    return snap(min + ((e.clientX - r.left) / Math.max(1, r.width)) * (max - min));
  };
  const commit = (v: number) => {
    const changed = v !== live || v !== value;
    setLive(v);
    if (changed) onChange(v);
  };
  const onKey = (e: KeyboardEvent) => {
    const big = Math.max(step, (max - min) / 10);
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? live + step
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? live - step
          : e.key === 'PageUp'
            ? live + big
            : e.key === 'PageDown'
              ? live - big
              : e.key === 'Home'
                ? min
                : e.key === 'End'
                  ? max
                  : undefined;
    if (next === undefined) return;
    e.preventDefault();
    commit(snap(next));
  };
  const ticks = Math.min(24, Math.round((max - min) / step));
  return (
    <div className="ib-range" data-disabled={disabled ? '' : undefined}>
      <span id={id} className={hideLabel ? 'ib-sr' : 'ib-range__label'}>
        {label}
      </span>
      <div className="ib-range__row">
        <button
          type="button"
          className="ib-range__btn"
          aria-label={`Less ${label}`}
          disabled={disabled}
          onClick={() => commit(snap(live - step))}
        >
          −
        </button>
        <div
          ref={track}
          className="ib-range__track"
          onPointerDown={(e) => {
            if (disabled) return;
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
            dragging.current = true;
            const v = fromPointer(e);
            setLive(v);
            onInput?.(v);
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return;
            const v = fromPointer(e);
            setLive(v);
            onInput?.(v);
          }}
          onPointerUp={(e) => {
            if (!dragging.current) return;
            dragging.current = false;
            commit(fromPointer(e));
          }}
        >
          <span
            className="ib-range__cells"
            aria-hidden="true"
            style={{ '--ib-cells': ticks } as CSSProperties}
          />
          <span
            className="ib-range__fill"
            aria-hidden="true"
            style={{ inlineSize: `${share(live) * 100}%` }}
          />
          {mark ? (
            <span
              className="ib-range__mark"
              aria-hidden="true"
              style={{ insetInlineStart: `${share(mark.at) * 100}%` }}
              title={mark.label}
            />
          ) : null}
          <span
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-labelledby={id}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={live}
            aria-valuetext={fmt(live)}
            aria-disabled={disabled || undefined}
            className="ib-range__thumb"
            style={{ insetInlineStart: `${share(live) * 100}%` }}
            onKeyDown={onKey}
          />
        </div>
        <button
          type="button"
          className="ib-range__btn"
          aria-label={`More ${label}`}
          disabled={disabled}
          onClick={() => commit(snap(live + step))}
        >
          +
        </button>
        <code className="ib-range__value">{fmt(live)}</code>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// SunScrubber

export interface SunScrubberProps {
  /** Minutes after local midnight. */
  minutes: number;
  onChange: (minutes: number) => void;
  sunriseMin: number;
  sunsetMin: number;
  /** Sun altitude in degrees for any minute (drawing only). */
  altitude?: (minutes: number) => number;
  label?: string;
  /** Extra controls on the right (play button). */
  children?: ReactNode;
}

const hhmm = (m: number) => {
  const t = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export function SunScrubber({
  minutes,
  onChange,
  sunriseMin,
  sunsetMin,
  altitude,
  label = 'Time of day',
  children,
}: SunScrubberProps) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const at = (m: number) => `${(clamp(m, 0, 1440) / 1440) * 100}%`;
  const fromPointer = (e: PointerEvent) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return minutes;
    return clamp(Math.round((((e.clientX - r.left) / Math.max(1, r.width)) * 1440) / 5) * 5, 0, 1439);
  };
  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowRight: 5,
      ArrowUp: 5,
      ArrowLeft: -5,
      ArrowDown: -5,
      PageUp: 60,
      PageDown: -60,
    };
    let next: number | undefined;
    if (e.key in map) next = minutes + (map[e.key] ?? 0);
    else if (e.key === 'Home') next = sunriseMin;
    else if (e.key === 'End') next = sunsetMin;
    if (next === undefined) return;
    e.preventDefault();
    onChange(clamp(next, 0, 1439));
  };
  const night = minutes < sunriseMin || minutes > sunsetMin;
  let arc = '';
  if (altitude) {
    const pts: string[] = [];
    for (let m = sunriseMin; m <= sunsetMin; m += 15) {
      const a = Math.max(0, altitude(m));
      pts.push(`${((m / 1440) * 1000).toFixed(1)},${(30 - (a / 90) * 28).toFixed(1)}`);
    }
    arc = pts.length ? `M${pts.join('L')}` : '';
  }
  const noon = (sunriseMin + sunsetMin) / 2;
  return (
    <div className="ib-sun">
      <div
        ref={track}
        className="ib-sun__track"
        onPointerDown={(e) => {
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          drag.current = true;
          onChange(fromPointer(e));
        }}
        onPointerMove={(e) => drag.current && onChange(fromPointer(e))}
        onPointerUp={() => {
          drag.current = false;
        }}
      >
        <span
          className="ib-sun__day"
          aria-hidden="true"
          style={{
            insetInlineStart: at(sunriseMin),
            inlineSize: `${((sunsetMin - sunriseMin) / 1440) * 100}%`,
          }}
        />
        <svg className="ib-sun__arc" viewBox="0 0 1000 32" preserveAspectRatio="none" aria-hidden="true">
          {arc ? <path d={arc} /> : null}
        </svg>
        <span
          className="ib-sun__tick"
          data-kind="rise"
          aria-hidden="true"
          style={{ insetInlineStart: at(sunriseMin) }}
        >
          <code>{hhmm(sunriseMin)}</code>
        </span>
        <span
          className="ib-sun__tick"
          data-kind="noon"
          aria-hidden="true"
          style={{ insetInlineStart: at(noon) }}
        />
        <span
          className="ib-sun__tick"
          data-kind="set"
          aria-hidden="true"
          style={{ insetInlineStart: at(sunsetMin) }}
        >
          <code>{hhmm(sunsetMin)}</code>
        </span>
        <span
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={1439}
          aria-valuenow={Math.round(minutes)}
          aria-valuetext={`${hhmm(minutes)}${night ? ', night' : ''}`}
          className="ib-sun__thumb"
          data-night={night ? '' : undefined}
          style={{ insetInlineStart: at(minutes) }}
          onKeyDown={onKey}
        />
      </div>
      <code className="ib-sun__clock">{hhmm(minutes)}</code>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Picker

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  group?: string;
}

export interface PickerProps<T extends string> {
  label: string;
  value: T | undefined;
  options: readonly PickerOption<T>[];
  onChange: (v: T) => void;
  /** Shown when nothing is picked. */
  placeholder?: string;
  hideLabel?: boolean;
  /** Quiet: no border until hover (top bar). */
  quiet?: boolean;
  id?: string;
}

export function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  hideLabel,
  quiet,
  id,
}: PickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const auto = useId();
  const listId = `${id ?? auto}-list`;
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const cur = options.find((o) => o.value === value);
  useEffect(() => {
    if (!open) return;
    const i = Math.max(
      0,
      options.findIndex((o) => o.value === value),
    );
    setActive(i);
    list.current?.focus();
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open, options, value]);
  const pick = (o: PickerOption<T> | undefined) => {
    if (!o) return;
    onChange(o.value);
    setOpen(false);
    btn.current?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActive((a) => Math.min(options.length - 1, a + 1));
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(options.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') pick(options[active]);
    else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
      if (e.key === 'Escape') btn.current?.focus();
      return;
    } else if (e.key.length === 1) {
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
      return;
    } else return;
    e.preventDefault();
  };
  return (
    <div className="ib-picker" data-quiet={quiet ? '' : undefined}>
      {hideLabel ? null : <span className="ib-picker__label">{label}</span>}
      <button
        ref={btn}
        id={id}
        type="button"
        className="ib-picker__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={hideLabel ? `${label}: ${cur?.label ?? placeholder}` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="ib-picker__value" data-empty={cur ? undefined : ''}>
          {cur?.label ?? placeholder}
        </span>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" className="ib-picker__caret">
          <path d="M2 4L6 8L10 4" />
        </svg>
      </button>
      {open ? (
        <div
          ref={list}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listId}-${active}`}
          className="ib-picker__list"
          onKeyDown={onKey}
        >
          {options.map((o, i) => (
            <div
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={o.value === value}
              data-active={i === active ? '' : undefined}
              className="ib-picker__opt"
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
              onKeyDown={() => undefined}
            >
              {o.group && (i === 0 || options[i - 1]?.group !== o.group) ? (
                <span className="ib-picker__group">{o.group}</span>
              ) : null}
              <span>{o.label}</span>
              {o.hint ? <span className="ib-picker__hint">{o.hint}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
