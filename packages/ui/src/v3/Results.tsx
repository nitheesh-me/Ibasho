/**
 * Building result marks: EUI gauge, end-use bar, rating ladder (DESIGN_SYSTEM 13, SPEC 22, 23,
 * PLAN-V3 moment 5). Owner: WP-06.
 *
 * Every length is read from the evidence node its label renders (`magnitude`), so a mark never
 * encodes a value the chip does not show. Ranges draw as a band with a likely dot; a partial EUI
 * (an end use unknown) says so and names what is missing (R33, AC-BR1).
 */
import type { Applicability, EndUse, EvidenceId } from '@ibasho/core';
import type { CSSProperties, ReactNode } from 'react';
import { useEvidenceSource } from '../evidence/context.tsx';
import { magnitude, unit } from '../num/magnitude.ts';
import { Num } from '../num/Num.tsx';
import { ApplicabilityChip, PreviewStamp } from './Preview.tsx';

// ------------------------------------------------------------------------------------------------
// EUI gauge

export interface EuiGaugeProps {
  /** Site EUI, usually a range (kWh/m² a year). */
  eui: EvidenceId;
  target?: { ev: EvidenceId; label: string };
  /** Benchmark bands, ascending by their upper edge. */
  bands?: { label: string; ev: EvidenceId }[];
  /** Drawing domain upper end in the EUI unit. */
  scaleMax: number;
  partial?: boolean;
  missing?: string[];
  preview?: boolean;
  caption?: ReactNode;
}

export function EuiGauge({
  eui,
  target,
  bands = [],
  scaleMax,
  partial,
  missing,
  preview,
  caption,
}: EuiGaugeProps) {
  const src = useEvidenceSource();
  const m = magnitude(src.node(eui));
  const t = target ? magnitude(src.node(target.ev)) : undefined;
  const at = (x: number) => `${unit(x / scaleMax) * 100}%`;
  let prev = 0;
  return (
    <figure className="ib-eui" data-partial={partial ? '' : undefined}>
      <figcaption className="ib-eui__head">
        <span className="ib-eui__title">Energy use intensity</span>
        {preview ? <PreviewStamp compact /> : null}
      </figcaption>
      <p className="ib-eui__value">
        <Num ev={eui} size="display" />
        {partial ? <span className="ib-eui__partial">partial</span> : null}
      </p>
      <div className="ib-eui__track" aria-hidden="true">
        {bands.map((b, i) => {
          const hi = magnitude(src.node(b.ev))?.mid ?? prev;
          const style = { insetInlineStart: at(prev), inlineSize: at(hi - prev) } as CSSProperties;
          prev = hi;
          return (
            <span key={b.label} className="ib-eui__band" data-i={i % 2} style={style} title={b.label}>
              <span className="ib-eui__band-label">{b.label}</span>
            </span>
          );
        })}
        {m ? (
          <span
            className="ib-eui__range"
            data-range={m.range ? '' : undefined}
            style={{ insetInlineStart: at(m.lo), inlineSize: at(Math.max(m.hi - m.lo, scaleMax * 0.004)) }}
          />
        ) : null}
        {m ? <span className="ib-eui__dot" style={{ insetInlineStart: at(m.mid) }} /> : null}
        {t ? <span className="ib-eui__target" style={{ insetInlineStart: at(t.mid) }} /> : null}
      </div>
      {target ? (
        <p className="ib-eui__target-line">
          <span className="ib-eui__target-key" aria-hidden="true" />
          {target.label} <Num ev={target.ev} size="ui" />
        </p>
      ) : null}
      {partial && missing?.length ? (
        <p className="ib-eui__missing">Partial: {missing.join(', ')} not yet known, so the range is wider.</p>
      ) : null}
      {caption ? <p className="ib-eui__caption">{caption}</p> : null}
    </figure>
  );
}

// ------------------------------------------------------------------------------------------------
// End-use bar

export const END_USE_LABEL: Record<EndUse, string> = {
  cooling: 'Cooling',
  heating: 'Heating',
  lighting: 'Lighting',
  equipment: 'Equipment',
  fans: 'Fans',
  pumps: 'Pumps',
  'hot-water': 'Hot water',
  other: 'Other',
  pv: 'Solar PV',
};

export interface EndUseBarProps {
  rows: { use: EndUse; ev: EvidenceId; unknown?: boolean }[];
  title?: string;
  preview?: boolean;
  /** Show the per row list under the bar. */
  list?: boolean;
}

export function EndUseBar({ rows, title = 'Where the energy goes', preview, list = true }: EndUseBarProps) {
  const src = useEvidenceSource();
  const sized = rows.map((r) => ({ ...r, m: magnitude(src.node(r.ev)) }));
  const pos = sized.filter((r) => r.use !== 'pv');
  const pv = sized.find((r) => r.use === 'pv');
  const total = pos.reduce((s, r) => s + Math.abs(r.m?.mid ?? 0), 0);
  const pvLen = Math.abs(pv?.m?.mid ?? 0);
  const span = total + pvLen || 1;
  return (
    <figure className="ib-enduse">
      <figcaption className="ib-enduse__head">
        <span>{title}</span>
        {preview ? <PreviewStamp compact /> : null}
      </figcaption>
      <div className="ib-enduse__bar" aria-hidden="true">
        {pv && pvLen > 0 ? (
          <span className="ib-enduse__seg" data-use="pv" style={{ flexBasis: `${(100 * pvLen) / span}%` }} />
        ) : null}
        {pv && pvLen > 0 ? <span className="ib-enduse__zero" /> : null}
        {pos.map((r) => (
          <span
            key={r.use}
            className="ib-enduse__seg"
            data-use={r.use}
            data-unknown={r.unknown ? '' : undefined}
            title={END_USE_LABEL[r.use]}
            style={{ flexBasis: `${(100 * Math.abs(r.m?.mid ?? 0)) / span}%` }}
          />
        ))}
      </div>
      {list ? (
        <ul className="ib-enduse__list">
          {sized.map((r) => (
            <li key={r.use} data-use={r.use}>
              <span className="ib-enduse__key" data-use={r.use} aria-hidden="true" />
              <span className="ib-enduse__name">{END_USE_LABEL[r.use]}</span>
              {r.unknown ? <span className="ib-enduse__unknown">unknown</span> : <Num ev={r.ev} size="ui" />}
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}

// ------------------------------------------------------------------------------------------------
// Rating ladder (moment 5: three gates, one pass)

export type StepState = 'likely' | 'possible' | 'not-yet';

export interface LadderRow {
  scheme: string;
  edition: string;
  /** Steps on the shared savings axis, ascending (`atLeast` in percent, drawing only). */
  steps: { level: string; atLeast: number }[];
  applicability: Applicability;
  /** Points or level in words when the scheme has them, e.g. "likely Two stars". */
  reading?: ReactNode;
  estimate?: boolean;
}

/** Where a step sits against the savings range: below lo is likely, inside is possible. */
export function stepState(atLeast: number, lo: number, hi: number): StepState {
  if (atLeast <= lo) return 'likely';
  if (atLeast <= hi) return 'possible';
  return 'not-yet';
}

export interface RatingLadderProps {
  /** Savings against the code baseline, percent (usually a range). */
  savings: EvidenceId;
  rows: LadderRow[];
  axisMax?: number;
  preview?: boolean;
}

export function RatingLadder({ savings, rows, axisMax = 60, preview }: RatingLadderProps) {
  const src = useEvidenceSource();
  const m = magnitude(src.node(savings));
  const lo = m?.lo ?? 0;
  const hi = m?.hi ?? 0;
  const at = (x: number) => `${unit(x / axisMax) * 100}%`;
  return (
    <figure className="ib-rladder">
      <figcaption className="ib-rladder__head">
        <span>Savings against the code baseline</span>
        <Num ev={savings} />
        {preview ? <PreviewStamp compact /> : null}
      </figcaption>
      <div className="ib-rladder__rows">
        <div
          className="ib-rladder__band"
          aria-hidden="true"
          style={{ insetInlineStart: at(lo), inlineSize: at(hi - lo) }}
        />
        {rows.map((r) => (
          <div key={r.scheme} className="ib-rladder__row">
            <div className="ib-rladder__name">
              <span className="ib-rladder__scheme">{r.scheme}</span>
              <code className="ib-rladder__edition">{r.edition}</code>
              {r.estimate ? <span className="ib-badge-estimate">estimate</span> : null}
            </div>
            <ol className="ib-rladder__steps">
              {r.steps.map((s) => {
                const st = stepState(s.atLeast, lo, hi);
                return (
                  <li
                    key={s.level}
                    className="ib-rladder__step"
                    data-state={st}
                    style={{ insetInlineStart: at(s.atLeast) }}
                    aria-label={`${s.level}: ${st === 'not-yet' ? 'not reached' : st}`}
                  >
                    <span className="ib-rladder__mark" aria-hidden="true" />
                    <span className="ib-rladder__level" aria-hidden="true">
                      {s.level}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="ib-rladder__meta">
              {r.reading ? <span className="ib-rladder__reading">{r.reading}</span> : null}
              <ApplicabilityChip value={r.applicability} />
            </div>
          </div>
        ))}
      </div>
      <p className="ib-rladder__key">
        <span data-state="likely" /> likely <span data-state="possible" /> possible{' '}
        <span data-state="not-yet" /> not reached. Estimates of points, not a rating.
      </p>
    </figure>
  );
}
