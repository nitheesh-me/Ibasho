/**
 * MonthRing: the year as a ring of twelve months with a per-fuel monthly ring chart
 * (DESIGN_SYSTEM 8, 12; DEC PR-5, which replaces the 24 sekki ring). Owner: WP-06.
 *
 * January sits at the top and the year runs clockwise. Each month is a wedge; inside it the fuels
 * stack outwards from the inner rim, each in its fuel colour with its fuel hatch, so the ring reads
 * in greyscale too. Wedge lengths are read from the nodes the readout's `Num`s show, scaled to the
 * largest month, and there are no axis numbers. Arrow keys move one month (wrapping), Home and End
 * go to January and December; a tap on a wedge chooses it; dragging round the ring scrubs.
 *
 * DOM: `figure.ib-chart.ib-monthring`, the ring `[role="slider"][data-month]`, wedges `[data-wedge]`.
 */

import { type EvidenceId, MONTHS, type Month, type Monthly } from '@ibasho/core';
import { useDrag } from '@use-gesture/react';
import { type CSSProperties, type KeyboardEvent, type ReactNode, useId, useRef, useState } from 'react';
import { ChartFrame } from '../chart/TableAlt.tsx';
import { useEvidenceSource } from '../evidence/context.tsx';
import { FUEL_MON, FUEL_NAME, FUEL_TOKEN, type FuelRow } from '../fuel/FuelBars.tsx';
import { Mon } from '../mon/Mon.tsx';
import { formatEvidence } from '../num/format.ts';
import { magnitude } from '../num/magnitude.ts';
import { Num, type NumProps } from '../num/Num.tsx';

export const MONTH_NAME: readonly string[] = [
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

export interface MonthSeries {
  fuel: FuelRow;
  months: Monthly<EvidenceId>;
}

export interface MonthRingProps {
  series: readonly MonthSeries[];
  /** One sentence, e.g. "Gas use peaks in January and almost stops in summer." */
  summary: ReactNode;
  title?: ReactNode;
  month?: Month;
  defaultMonth?: Month;
  onMonthChange?: (month: Month) => void;
  as?: NumProps['as'];
  className?: string;
}

/**
 * Month after a key press, or undefined when the key is not a ring key. Wraps round the year.
 * As in the ARIA slider pattern, Right and Up go forward, Page keys jump a season.
 */
export function monthKey(key: string, m: Month): Month | undefined {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return ((m + 1) % 12) as Month;
    case 'ArrowLeft':
    case 'ArrowDown':
      return ((m + 11) % 12) as Month;
    case 'PageUp':
      return ((m + 3) % 12) as Month;
    case 'PageDown':
      return ((m + 9) % 12) as Month;
    case 'Home':
      return 0;
    case 'End':
      return 11;
    default:
      return undefined;
  }
}

/** Month under a point, from its offset to the ring centre (y down). January is at the top. */
export function monthAt(dx: number, dy: number): Month {
  const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  return (Math.floor(deg / 30) % 12) as Month;
}

const C = 100;
const R0 = 34;
const R1 = 84;
const f = (x: number) => Math.round(x * 100) / 100;

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [f(C + r * Math.cos(a)), f(C + r * Math.sin(a))];
}

/** An annular sector between radii a and b and angles d0 to d1 (degrees, clockwise from the top). */
function sector(a: number, b: number, d0: number, d1: number): string {
  const [x0, y0] = polar(b, d0);
  const [x1, y1] = polar(b, d1);
  const [x2, y2] = polar(a, d1);
  const [x3, y3] = polar(a, d0);
  return `M${x0} ${y0}A${b} ${b} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${a} ${a} 0 0 0 ${x3} ${y3}Z`;
}

/** Hatch for each fuel (DS 2.3), drawn over the fuel colour. */
function Hatch({ id, fuel }: { id: string; fuel: FuelRow }) {
  const ink = 'var(--surface-raised)';
  const common = { id, patternUnits: 'userSpaceOnUse' as const, width: 4, height: 4 };
  switch (fuel) {
    case 'electricity':
      return (
        <pattern {...common} patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={ink} strokeWidth="1" />
        </pattern>
      );
    case 'oil':
      return (
        <pattern {...common}>
          <circle cx="2" cy="2" r="0.7" fill={ink} />
        </pattern>
      );
    case 'lpg':
      return (
        <pattern {...common} patternTransform="rotate(45)">
          <path d="M0 2H4M2 0V4" stroke={ink} strokeWidth="0.7" />
        </pattern>
      );
    case 'biomass':
      return (
        <pattern {...common} width={6}>
          <path
            d="M0 2.5A1.5 1.5 0 0 1 3 2.5A1.5 1.5 0 0 0 6 2.5"
            stroke={ink}
            strokeWidth="0.7"
            fill="none"
          />
        </pattern>
      );
    case 'district':
      return (
        <pattern {...common}>
          <line x1="0" y1="2" x2="4" y2="2" stroke={ink} strokeWidth="0.8" />
        </pattern>
      );
    case 'export':
      return (
        <pattern {...common}>
          <circle cx="2" cy="2" r="0.5" fill={ink} />
        </pattern>
      );
    default:
      return <pattern {...common} />;
  }
}

export function MonthRing({
  series,
  summary,
  title,
  month,
  defaultMonth = 0,
  onMonthChange,
  as,
  className,
}: MonthRingProps) {
  const src = useEvidenceSource();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [inner, setInner] = useState<Month>(defaultMonth);
  const at = month ?? inner;
  const svg = useRef<SVGSVGElement>(null);
  const numProps = as ? { as } : {};

  const choose = (m: Month) => {
    if (m === at) return;
    if (month === undefined) setInner(m);
    onMonthChange?.(m);
  };

  // Per month, per fuel, the drawable size (absolute, the likely value of a range).
  const sizes = MONTHS.map((m) =>
    series.map((s) => {
      const g = magnitude(src.node(s.months[m]));
      return g ? Math.abs(g.mid) : 0;
    }),
  );
  const peak = Math.max(1e-9, ...sizes.map((row) => row.reduce((a, b) => a + b, 0)));

  const bind = useDrag(
    ({ xy: [x, y] }) => {
      const rect = svg.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const dx = x - (rect.left + rect.width / 2);
      const dy = y - (rect.top + rect.height / 2);
      // Only the ring itself takes pointer input, not the empty centre.
      const r = Math.hypot(dx, dy) / (rect.width / 200);
      if (r < R0 - 6) return;
      choose(monthAt(dx, dy));
    },
    { filterTaps: false, keys: false, pointer: { touch: true } },
  );

  const valueText = (m: Month) => {
    const parts = series.map((s) => {
      const n = src.node(s.months[m]);
      if (!n) return `${FUEL_NAME[s.fuel]} not known`;
      try {
        const t = formatEvidence(n, { ...(src.locale ? { locale: src.locale } : {}), ...numProps });
        return `${FUEL_NAME[s.fuel]} ${t.spoken}`;
      } catch {
        return `${FUEL_NAME[s.fuel]} not known`;
      }
    });
    return [MONTH_NAME[m], ...parts].join(', ');
  };

  return (
    <ChartFrame
      className={['ib-monthring', className].filter(Boolean).join(' ')}
      title={title}
      summary={summary}
      table={{
        caption: 'Energy each month, by fuel',
        rowHeading: 'Month',
        columns: series.map((s) => FUEL_NAME[s.fuel]),
        rows: MONTHS.map((m) => ({
          key: String(m),
          head: MONTH_NAME[m],
          cells: series.map((s) => ({ ev: s.months[m], ...numProps })),
        })),
      }}
      legend={
        <ul className="ib-monthring__legend">
          {series.map((s) => (
            <li
              key={s.fuel}
              className="ib-monthring__key"
              style={{ '--fuel': `var(${FUEL_TOKEN[s.fuel]})` } as CSSProperties}
            >
              <svg width="14" height="14" aria-hidden="true">
                <rect width="14" height="14" fill="var(--fuel)" />
                <rect width="14" height="14" fill={`url(#${uid}-h-${s.fuel})`} />
              </svg>
              {FUEL_NAME[s.fuel]}
            </li>
          ))}
        </ul>
      }
    >
      <div className="ib-monthring__layout">
        <div
          className="ib-monthring__ring"
          {...bind()}
          role="slider"
          tabIndex={0}
          aria-label="Month"
          aria-valuemin={0}
          aria-valuemax={11}
          aria-valuenow={at}
          aria-valuetext={valueText(at)}
          data-month={at}
          onKeyDown={(e: KeyboardEvent) => {
            const next = monthKey(e.key, at);
            if (next === undefined) return;
            e.preventDefault();
            choose(next);
          }}
        >
          <svg ref={svg} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
            <defs>
              {series.map((s) => (
                <Hatch key={s.fuel} id={`${uid}-h-${s.fuel}`} fuel={s.fuel} />
              ))}
            </defs>
            {/* Shita-e: the pencil construction circles behind the chart. */}
            <circle className="ib-monthring__guide" cx={C} cy={C} r={R1} />
            <circle className="ib-monthring__guide" cx={C} cy={C} r={(R0 + R1) / 2} />
            <circle className="ib-monthring__rim" cx={C} cy={C} r={R0} />
            {MONTHS.map((m) => {
              const d0 = m * 30 + 1.2;
              const d1 = (m + 1) * 30 - 1.2;
              let r = R0 + 1;
              const row = sizes[m] as number[];
              return (
                <g key={m} className="ib-monthring__wedge" data-wedge={m} data-on={m === at ? '' : undefined}>
                  <path className="ib-monthring__slot" d={sector(R0 + 1, R1, d0, d1)} />
                  {series.map((s, i) => {
                    const len = ((row[i] ?? 0) / peak) * (R1 - R0 - 1);
                    if (len <= 0.05) return null;
                    const a = r;
                    r += len;
                    const d = sector(a, r, d0, d1);
                    return (
                      <g key={s.fuel} data-fuel={s.fuel}>
                        <path d={d} fill={`var(${FUEL_TOKEN[s.fuel]})`} />
                        <path d={d} fill={`url(#${uid}-h-${s.fuel})`} />
                      </g>
                    );
                  })}
                  <text
                    className="ib-monthring__letter"
                    x={polar(R1 + 9, m * 30 + 15)[0]}
                    y={polar(R1 + 9, m * 30 + 15)[1]}
                  >
                    {(MONTH_NAME[m] as string).charAt(0)}
                  </text>
                </g>
              );
            })}
            <path className="ib-monthring__focus" d={sector(R0 - 2, R1 + 2, at * 30, (at + 1) * 30)} />
            <text className="ib-monthring__centre" x={C} y={C}>
              {(MONTH_NAME[at] as string).slice(0, 3)}
            </text>
          </svg>
        </div>
        <div className="ib-monthring__readout" aria-live="polite">
          <p className="ib-monthring__month">{MONTH_NAME[at]}</p>
          <ul className="ib-monthring__values">
            {series.map((s) => (
              <li key={s.fuel} data-fuel={s.fuel}>
                <span className="ib-monthring__fuel">
                  <Mon id={FUEL_MON[s.fuel]} size={16} />
                  {FUEL_NAME[s.fuel]}
                </span>
                <Num ev={s.months[at]} size="ui" {...numProps} />
              </li>
            ))}
          </ul>
          <div className="ib-monthring__steps">
            <button
              type="button"
              className="ib-link-button"
              onClick={() => choose(monthKey('ArrowLeft', at) as Month)}
            >
              Previous month
            </button>
            <button
              type="button"
              className="ib-link-button"
              onClick={() => choose(monthKey('ArrowRight', at) as Month)}
            >
              Next month
            </button>
          </div>
        </div>
      </div>
    </ChartFrame>
  );
}
