/**
 * Andon chrome over the city stage (DESIGN_SYSTEM 4, 13; QA city V-P B2, B3): WP-06's
 * `ScaleLadder` and `PreviewStamp`, lens chips with a ramp swatch, a sun scrubber over 24 hours
 * with the day's sun arc, a month strip with presets, the analysis legend, a compass with turn and
 * zoom buttons, a scale bar, the pinned honesty chip with a floor stepper, and a toast. Every drag
 * has a button or key; targets are 44 px; numbers are M PLUS 1 Code with tabular figures.
 * The 24 hour sun scrubber is WP-06's `SunScrubber`.
 * Owner: WP-07.
 */
import { PreviewStamp, ScaleLadder, Stepper } from '@ibasho/ui';
import { type KeyboardEvent, type ReactNode, useRef } from 'react';
import type { ContextMass } from './geometry.ts';
import { type CityRampId, rampGradientCss } from './ramps.ts';
import { dateLabel, dateOfDay, dayOfYear } from './sun.ts';
import type { CityLensId, ZoomLevel } from './types.ts';

/** Scoped styles: Andon tokens only, panels square with BrushFrame edges and kage or tomoshibi. */
export const CITY_CSS = `
.ib-city { font-family: var(--font-gothic); color: var(--ink); }
.ib-city :focus-visible { outline: 2px solid var(--focus, var(--deep)); outline-offset: 2px; box-shadow: 0 0 0 4px var(--paper); }
.ib-city-panel {
  background: color-mix(in oklch, var(--paper-raised) 86%, transparent);
  -webkit-backdrop-filter: blur(10px) saturate(1.05); backdrop-filter: blur(10px) saturate(1.05);
  border: 1px solid color-mix(in oklch, var(--ink-3) 35%, transparent);
  border-radius: 0; box-shadow: var(--kage-1);
}
.ib-city[data-theme="yoru"] .ib-city-panel { box-shadow: var(--tomoshibi); }
.ib-city-panel--pad { padding: var(--ma-2) var(--ma-3); }
.ib-city .ib-ladder { font-size: var(--fs-ui); }
.ib-city-chips { display: flex; gap: var(--ma-1); margin: 0; padding: 0; border: 0; overflow-x: auto; scrollbar-width: none;
  scroll-snap-type: x proximity; -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 8px, #000 calc(100% - 16px), transparent);
  mask-image: linear-gradient(90deg, transparent 0, #000 8px, #000 calc(100% - 16px), transparent); padding-inline: 8px; }
.ib-city-chip { appearance: none; scroll-snap-align: start; display: inline-flex; align-items: center; gap: 6px; flex: none;
  min-block-size: 44px; padding: 0 var(--ma-3); border: 1px solid var(--line); border-radius: 0;
  background: color-mix(in oklch, var(--paper-raised) 84%, transparent); color: var(--text-2);
  font: 500 var(--fs-ui)/1 var(--font-gothic); cursor: pointer; white-space: nowrap;
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.ib-city-chip:hover { color: var(--ink); border-color: var(--ink-3); }
.ib-city-chip[aria-checked="true"], .ib-city-chip[aria-pressed="true"] { background: var(--paper-sunk); color: var(--ink);
  box-shadow: inset 0 -2px 0 var(--ink); }
.ib-city[data-theme="yoru"] .ib-city-chip[aria-checked="true"] { box-shadow: inset 0 -2px 0 var(--glow), var(--tomoshibi); }
.ib-city-swatch { inline-size: 14px; block-size: 6px; border: 1px solid var(--line); }
.ib-city-num, .ib-city code { font-family: var(--font-code); font-variant-numeric: tabular-nums; }
.ib-city-unit { color: var(--text-2); font-size: var(--fs-cap); }
.ib-city-time { display: grid; gap: 4px; padding: 6px 12px; }
.ib-city-time__row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ib-city-scrub { position: relative; flex: 1 1 220px; min-inline-size: 180px; block-size: 44px; touch-action: none; cursor: pointer; }
.ib-city-scrub svg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; overflow: visible; }
.ib-city-months { display: flex; gap: 2px; flex: 1 1 200px; }
.ib-city-months button { flex: 1; min-inline-size: 18px; min-block-size: 32px; border: 0; border-block-end: 2px solid var(--line);
  background: transparent; color: var(--text-3); font: 500 var(--fs-cap)/1 var(--font-gothic); cursor: pointer; padding: 0; }
.ib-city-months button[aria-pressed="true"] { color: var(--ink); border-block-end-color: var(--ink); }
.ib-city-big-clock { font: 400 var(--fs-h2)/1 var(--font-code); font-variant-numeric: tabular-nums; letter-spacing: 0.02em; padding: 4px 14px; }
.ib-city-note { font: 500 var(--fs-ui)/1.4 var(--font-gothic); padding: 6px 10px; max-inline-size: 280px; }
.ib-city-label { display: inline-grid; gap: 1px; padding: 2px 6px; background: var(--paper-raised); border: 1px solid var(--line);
  font: 500 12px/1.3 var(--font-gothic); color: var(--ink); white-space: nowrap; text-align: center; }
.ib-city-label b { font-weight: 500; }
.ib-city-label .ib-city-num { font-size: 11px; color: var(--text-2); }
.ib-city-locator { display: grid; justify-items: center; transform: translate(-50%, -100%); }
.ib-city-locator__plate { padding: 2px 8px; background: var(--paper-raised); border: 1px solid var(--ink); font: 500 12px/1.4 var(--font-gothic);
  color: var(--ink); white-space: nowrap; box-shadow: var(--kage-1); }
.ib-city-locator__leader { inline-size: 1px; block-size: 46px; background: var(--ink); }
.ib-city-compass { display: grid; grid-template-columns: 44px 44px 44px; gap: 2px; }
.ib-city-compass button { inline-size: 44px; block-size: 44px; display: grid; place-items: center; border: 1px solid var(--line);
  background: color-mix(in oklch, var(--paper-raised) 86%, transparent); color: var(--ink); cursor: pointer; padding: 0; border-radius: 0; }
.ib-city-scale { display: flex; align-items: end; gap: 8px; font: 400 var(--fs-cap)/1 var(--font-code); color: var(--ink); }
.ib-city-scale__bar { block-size: 4px; border: 1px solid var(--ink); border-block-start: 0; }
.ib-city-legend { display: grid; gap: 6px; }
.ib-city-legend .ib-legend__ends { font-family: var(--font-code); font-variant-numeric: tabular-nums; color: var(--text-2); }
.ib-city-legend .ib-legend__line { max-inline-size: 32em; }
.ib-city-share { display: grid; gap: 2px; font-size: var(--fs-cap); }
.ib-city-share__bar { position: relative; block-size: 8px; background: var(--paper-sunk); border: 1px solid var(--line); }
.ib-city-share__fill { position: absolute; inset-block: 0; inset-inline-start: 0; background: var(--ink); }
.ib-city-share__tick { position: absolute; inset-block: -3px; inline-size: 2px; background: var(--glow); }
.ib-city-lanterns { display: grid; grid-template-columns: auto 1fr; gap: 4px 8px; align-items: center; font-size: var(--fs-cap); }
.ib-city-disc { display: inline-block; inline-size: 12px; block-size: 12px; border-radius: 50%; margin-inline-end: 3px; }
.ib-city-dashed { inline-size: 18px; block-size: 10px; border: 1px dashed var(--ink-3); }
.ib-city-chip-pin { display: grid; gap: 6px; padding: 10px 12px; max-inline-size: 300px; font-size: var(--fs-ui); }
.ib-city-chip-pin header { display: flex; justify-content: space-between; gap: 8px; font-weight: 700; }
.ib-city-chip-pin .ib-city-sub { color: var(--text-2); font-size: var(--fs-cap); }
.ib-city-btn { appearance: none; min-block-size: 44px; padding: 0 var(--ma-3); border: 1px solid var(--ink); border-radius: 0;
  background: var(--paper-raised); color: var(--ink); font: 500 var(--fs-ui)/1 var(--font-gothic); cursor: pointer; }
.ib-city-btn[aria-pressed="true"] { background: var(--paper-sunk); box-shadow: inset 0 -2px 0 var(--ink); }
.ib-city-x { appearance: none; inline-size: 44px; block-size: 44px; margin: -10px -10px 0 0; border: 0; background: transparent; color: var(--ink-2); cursor: pointer; }
.ib-city-toast { padding: 8px 12px; font-size: var(--fs-ui); max-inline-size: 340px; }
.ib-city-storeys { display: grid; gap: 2px; }
.ib-city-storeys button { min-inline-size: 44px; min-block-size: 32px; padding: 0 8px; border: 1px solid var(--line); border-radius: 0;
  background: color-mix(in oklch, var(--paper-raised) 86%, transparent); color: var(--text-2); font: 500 var(--fs-cap)/1 var(--font-gothic); cursor: pointer; }
.ib-city-storeys button[aria-pressed="true"] { background: var(--paper-sunk); color: var(--ink); box-shadow: inset 3px 0 0 var(--ink); }
.ib-city-sheet { position: absolute; inset-inline: 0; inset-block-end: 0; display: grid; align-content: start; gap: 8px;
  padding: 8px 8px 12px; overflow-y: auto; border-inline: 0; border-block-end: 0; }
.ib-city-sheet__grip { justify-self: center; inline-size: 40px; block-size: 4px; background: var(--ink-3); opacity: 0.5; }
.ib-city-fade { position: absolute; inset: 0; pointer-events: none; transition-property: opacity; transition-timing-function: linear; }
@media (prefers-reduced-motion: reduce) { .ib-city * { transition-duration: 150ms !important; } }
`;

export const LENS_LABEL: Record<CityLensId, string> = {
  none: 'Paper',
  shadows: 'Shadows',
  'sun-hours': 'Sun hours',
  radiation: 'Radiation',
  daylight: 'Daylight',
  lanterns: 'Lanterns',
};
const LENS_RAMP: Partial<Record<CityLensId, CityRampId>> = {
  shadows: 'kage',
  'sun-hours': 'hidamari',
  radiation: 'hinata',
  daylight: 'akari',
};
const LENSES = Object.keys(LENS_LABEL) as CityLensId[];

/** Lens chips as a radio group with roving focus and a ramp swatch in each (QA B3, M11). */
export function LensChips(p: { lens: CityLensId; onLens: (l: CityLensId) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const i = LENSES.indexOf(p.lens);
    const d =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!d) return;
    e.preventDefault();
    const n = LENSES[(i + d + LENSES.length) % LENSES.length]!;
    p.onLens(n);
    refs.current[LENSES.indexOf(n)]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Lens" className="ib-city-chips" onKeyDown={onKey}>
      {LENSES.map((l, i) => {
        const ramp = LENS_RAMP[l];
        return (
          // biome-ignore lint/a11y/useSemanticElements: chips styled as Andon buttons, radio semantics by role
          <button
            key={l}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={p.lens === l}
            tabIndex={p.lens === l ? 0 : -1}
            className="ib-city-chip"
            onClick={() => p.onLens(l)}
          >
            {ramp ? (
              <span
                className="ib-city-swatch"
                style={{ backgroundImage: rampGradientCss(ramp) }}
                aria-hidden="true"
              />
            ) : null}
            {l === 'lanterns' ? (
              <span
                className="ib-city-disc"
                style={{ background: 'var(--glow)', inlineSize: 8, blockSize: 8 }}
                aria-hidden="true"
              />
            ) : null}
            {LENS_LABEL[l]}
          </button>
        );
      })}
    </div>
  );
}

export function Ladder(p: {
  level: ZoomLevel;
  onLevel: (l: ZoomLevel) => void;
  layout: 'vertical' | 'breadcrumb';
  detail: Partial<Record<ZoomLevel, string>>;
  enabled: readonly ZoomLevel[];
}) {
  return (
    <ScaleLadder
      level={p.level}
      onChange={p.onLevel}
      layout={p.layout}
      detail={p.detail}
      enabled={p.enabled}
    />
  );
}

/** Storeys as a section: a thin bar per storey, top floor first (QA B3: no native select). */
export function StoreyStack(p: {
  storeys: { id: string; name: string }[];
  storeyId: string | undefined;
  onStorey: (id: string) => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a button stack, not a form fieldset
    <div className="ib-city-storeys" role="group" aria-label="Storey">
      {[...p.storeys].reverse().map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={s.id === p.storeyId}
          onClick={() => p.onStorey(s.id)}
          title={s.name}
        >
          {shortStorey(s.name)}
        </button>
      ))}
    </div>
  );
}

function shortStorey(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('cellar') || n.includes('basement')) return 'B';
  const m = name.match(/\d+/);
  if (m) return `L${m[0]}`;
  if (n.startsWith('first')) return 'L1';
  if (n.startsWith('second')) return 'L2';
  if (n.startsWith('third')) return 'L3';
  if (n.startsWith('ground')) return 'G';
  return name.slice(0, 3);
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Year: a 12 notch month strip (the 21st of each) as a slider by day, arrows one day. */
export function MonthStrip(p: { date: string; onDate: (d: string) => void }) {
  const year = Number(p.date.slice(0, 4)) || 2026;
  const month = Number(p.date.slice(5, 7)) - 1;
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const d =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? -1
          : 0;
    if (!d) return;
    e.preventDefault();
    p.onDate(dateOfDay(Math.min(365, Math.max(1, dayOfYear(p.date) + d)), year));
  };
  return (
    <div
      className="ib-city-months"
      role="slider"
      tabIndex={0}
      aria-label="Day of the year"
      aria-valuemin={1}
      aria-valuemax={365}
      aria-valuenow={dayOfYear(p.date)}
      aria-valuetext={dateLabel(p.date)}
      onKeyDown={onKey}
    >
      {MONTHS.map((m, i) => (
        <button
          // biome-ignore lint/suspicious/noArrayIndexKey: twelve fixed months
          key={i}
          type="button"
          tabIndex={-1}
          aria-pressed={i === month}
          aria-label={`21 ${MONTH_NAMES[i]}`}
          onClick={() => p.onDate(`${year}-${String(i + 1).padStart(2, '0')}-21`)}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

export interface LegendSpec {
  title: string;
  unit: string;
  ramp: CityRampId | null;
  domain?: [number, number];
  /** The ramp reads high to low (shadow hours). */
  reversed?: boolean;
  period: string;
  method: string;
  resolution: string;
  preview: boolean;
  extra?: ReactNode;
}

/** `AnalysisLegend` markup (WP-06 classes) with numeric ends and a scene ramp. */
export function CityLegend({ spec }: { spec: LegendSpec }) {
  return (
    <figure className="ib-legend ib-city-legend" aria-label={`${spec.title} legend`}>
      <figcaption className="ib-legend__head">
        <span className="ib-legend__what">{spec.title}</span>
        <span className="ib-legend__unit">{spec.unit}</span>
        {spec.preview ? <PreviewStamp compact /> : null}
      </figcaption>
      {spec.ramp ? (
        <>
          <div
            className="ib-legend__bar"
            style={{ backgroundImage: rampGradientCss(spec.ramp, spec.reversed ? 'to left' : 'to right') }}
            aria-hidden="true"
          />
          <div className="ib-legend__ends">
            <span>{spec.domain?.[0]}</span>
            <span>{spec.domain?.[1]}</span>
          </div>
        </>
      ) : null}
      {spec.extra}
      <p className="ib-legend__line">
        {spec.resolution}. {spec.period}. {spec.method}. Modelled, not measured.
      </p>
    </figure>
  );
}

/** The daylight tally: a bar to the share passing with the target tick (QA B5). */
export function ShareBar({ share, target }: { share: number; target: number }) {
  return (
    <div className="ib-city-share">
      <span>
        <span className="ib-city-num">{share.toFixed(0)}%</span> of floor area passes, target{' '}
        <span className="ib-city-num">{target}%</span>
      </span>
      <span className="ib-city-share__bar" aria-hidden="true">
        <span className="ib-city-share__fill" style={{ inlineSize: `${Math.min(100, share)}%` }} />
        <span className="ib-city-share__tick" style={{ insetInlineStart: `${target}%` }} />
      </span>
    </div>
  );
}

/** Lantern key (QA B1): three discs of rising glow, three hues in words, a dashed sample. */
export function LanternKey({ scale }: { scale: number }) {
  return (
    <div className="ib-city-lanterns">
      <span>
        {[0.25, 0.55, 1].map((a) => (
          <span
            key={a}
            className="ib-city-disc"
            style={{ background: `color-mix(in oklch, var(--glow) ${a * 100}%, var(--paper-sunk))` }}
          />
        ))}
      </span>
      <span>
        Brighter for higher EUI, <span className="ib-city-num">0</span> to{' '}
        <span className="ib-city-num">{scale}</span> <span className="ib-city-unit">kWh/m²·yr</span>
      </span>
      <span>
        <span className="ib-city-disc" style={{ background: 'var(--deep)' }} />
        <span className="ib-city-disc" style={{ background: 'var(--glow)' }} />
        <span className="ib-city-disc" style={{ background: 'var(--ember)' }} />
      </span>
      <span>Pool hue: cooling, lighting, equipment</span>
      <span className="ib-city-dashed" />
      <span>Not modelled</span>
    </div>
  );
}

/** Compass with turn, north and zoom buttons (QA M4: every gesture has a button). */
export function Compass(p: {
  azimuthDeg: number;
  onTurn: (deg: number) => void;
  onNorth: () => void;
  onZoom: (factor: number) => void;
}) {
  const a = -((p.azimuthDeg + 180) % 360);
  return (
    // biome-ignore lint/a11y/useSemanticElements: a button cluster, not a form fieldset
    <div className="ib-city-compass" role="group" aria-label="View">
      <button type="button" aria-label="Turn left 45 degrees" onClick={() => p.onTurn(45)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M11 4 L6 9 L11 14" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <button type="button" aria-label="North up" onClick={p.onNorth}>
        <svg
          width="28"
          height="28"
          viewBox="-14 -14 28 28"
          aria-hidden="true"
          style={{ transform: `rotate(${a}deg)` }}
        >
          <circle r="12" fill="none" stroke="var(--ink-3)" />
          <path d="M0 -10 L4 4 L0 1 L-4 4 Z" fill="var(--ink)" />
          <text y="-6" x="7" fontSize="7" fill="var(--ink)">
            N
          </text>
        </svg>
      </button>
      <button type="button" aria-label="Turn right 45 degrees" onClick={() => p.onTurn(-45)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M7 4 L12 9 L7 14" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => p.onZoom(1.25)}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8 H13" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <span aria-hidden="true" />
      <button type="button" aria-label="Zoom in" onClick={() => p.onZoom(0.8)}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8 H13 M8 3 V13" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </div>
  );
}

/** Scale bar in metres from the current metres per CSS pixel. */
export function ScaleBar({ metresPerPx }: { metresPerPx: number }) {
  const steps = [5, 10, 20, 50, 100, 200, 500];
  const m = steps.filter((s) => s / metresPerPx <= 120).at(-1) ?? 5;
  return (
    <div className="ib-city-scale" role="img" aria-label={`Scale bar, ${m} metres`}>
      <span className="ib-city-scale__bar" style={{ inlineSize: m / metresPerPx }} />
      <span>{m} m</span>
    </div>
  );
}

/** The pinned honesty chip (moment 2): source, range and a floor stepper that closes the band. */
export function PinnedChip(p: {
  mass: ContextMass;
  floors: number;
  onFloors: (n: number) => void;
  onEnter: () => void;
  onClose: () => void;
}) {
  const m = p.mass;
  const est = m.user === undefined && m.hi - m.lo > 0.5;
  const source: Record<ContextMass['source'], string> = {
    user: 'you',
    'osm-height': 'OpenStreetMap height',
    'osm-levels': 'OpenStreetMap floor count',
    'open-buildings': 'Open Buildings 2.5D estimate',
    overture: 'Overture',
    unknown: 'unknown, guessed from footprint size',
  };
  return (
    <section className="ib-city-panel ib-city-chip-pin" aria-label={`${m.name ?? 'Neighbour'} details`}>
      <header>
        <span>{m.name ?? 'Neighbour'}</span>
        <button type="button" className="ib-city-x" aria-label="Close" onClick={p.onClose}>
          ×
        </button>
      </header>
      <span>
        {m.user !== undefined ? (
          <>
            Height <span className="ib-city-num">{m.user.toFixed(0)} m</span>, entered by you
          </>
        ) : est ? (
          <>
            About <span className="ib-city-num">{m.likely.toFixed(0)} m</span>, could be{' '}
            <span className="ib-city-num">{m.lo.toFixed(0)}</span> to{' '}
            <span className="ib-city-num">{m.hi.toFixed(0)} m</span>
          </>
        ) : (
          <>
            Height <span className="ib-city-num">{m.likely.toFixed(0)} m</span>
          </>
        )}
      </span>
      <span className="ib-city-sub">
        Source: {source[m.source]}
        {m.sources.includes('standin') ? ' (stand in data)' : ''}
      </span>
      {m.user === undefined ? (
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Floors</span>
          <Stepper
            id={`floors-${m.id}`}
            value={p.floors}
            step={1}
            min={1}
            max={60}
            onChange={p.onFloors}
            label="floors"
          />
          <button type="button" className="ib-city-btn" onClick={p.onEnter}>
            Enter a real count
          </button>
        </span>
      ) : null}
    </section>
  );
}
