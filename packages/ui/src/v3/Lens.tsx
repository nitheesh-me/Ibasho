/**
 * Lens panel and analysis legend (DESIGN_SYSTEM 13.2, SPEC 21, UV 6.1). Owner: WP-06.
 *
 * Every lens shares one panel so learning one teaches all: What, When, Where, How fine, Result,
 * Inspect. The legend states the ramp, unit, min and max, resolution, period, method, tier and
 * "Modelled, not measured", and carries the Preview stamp whenever the painted result came from a
 * Preview provider (AC-LK2, AC-PG3). A difference legend refuses mixed resolutions and says why.
 */
import type { EvidenceId, ResolutionLevel } from '@ibasho/core';
import type { ReactNode } from 'react';
import { Num } from '../num/Num.tsx';
import { PreviewStamp, TierCaption } from './Preview.tsx';
import { RAMPS, type RampName, rampColor, rampGradient } from './ramps.ts';

export const RESOLUTION_LABEL: Record<ResolutionLevel, string> = {
  sketch: 'Sketch',
  standard: 'Standard',
  fine: 'Fine',
};

export interface AnalysisLegendProps {
  ramp: RampName;
  /** Unit in words for the bar caption, e.g. "kWh/m² a year". */
  unit: string;
  min?: EvidenceId;
  max?: EvidenceId;
  resolution: ResolutionLevel;
  /** Technical resolution detail, e.g. "grid 1 m, 15 min steps". */
  resolutionDetail?: string;
  period: string;
  method: string;
  tier?: 'rough' | 'refined' | 'final';
  preview?: boolean;
  /** Difference legend: refuse two results of different resolution (AC-W6). */
  refuse?: string;
  onOpenMethod?: () => void;
}

export function AnalysisLegend(p: AnalysisLegendProps) {
  if (p.refuse) {
    return (
      <div className="ib-legend" data-refused="">
        <p className="ib-legend__refuse">{p.refuse}</p>
      </div>
    );
  }
  return (
    <figure className="ib-legend" data-ramp={p.ramp}>
      <figcaption className="ib-legend__head">
        <span className="ib-legend__what">{RAMPS[p.ramp].quantity}</span>
        <span className="ib-legend__unit">{p.unit}</span>
        <TierCaption tier={p.tier} />
        {p.preview ? <PreviewStamp compact /> : null}
      </figcaption>
      <div className="ib-legend__bar" style={{ backgroundImage: rampGradient(p.ramp) }} aria-hidden="true" />
      <div className="ib-legend__ends">
        <span>
          {p.min ? <Num ev={p.min} size="ui" plain /> : <span className="ib-legend__low">low</span>}
        </span>
        <span>
          {p.max ? <Num ev={p.max} size="ui" plain /> : <span className="ib-legend__high">high</span>}
        </span>
      </div>
      <p className="ib-legend__line">
        {RESOLUTION_LABEL[p.resolution]}
        {p.resolutionDetail ? <code> {p.resolutionDetail}</code> : null}. {p.period}. {p.method}. Modelled,
        not measured.
        {p.onOpenMethod ? (
          <>
            {' '}
            <button type="button" className="ib-link" onClick={p.onOpenMethod}>
              Open method
            </button>
          </>
        ) : null}
      </p>
    </figure>
  );
}

/** A histogram drawn from bin counts (drawing only, never printed). */
export function Histogram({ bins, ramp, label }: { bins: readonly number[]; ramp: RampName; label: string }) {
  const max = Math.max(1, ...bins);
  return (
    <svg
      className="ib-histo"
      viewBox={`0 0 ${bins.length * 10} 40`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {bins.map((b, i) => {
        const h = (36 * b) / max;
        return (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: bins are positional
            key={i}
            x={i * 10 + 1}
            y={40 - h}
            width={8}
            height={h}
            fill={rampColor(ramp, bins.length === 1 ? 0.5 : i / (bins.length - 1))}
          />
        );
      })}
    </svg>
  );
}

export interface LensPanelProps {
  title: string;
  /** One sentence: "Hours of direct sun on each surface on 21 March". */
  what: ReactNode;
  when: ReactNode;
  where: ReactNode;
  resolution: ResolutionLevel;
  onResolution?: (r: ResolutionLevel) => void;
  legend: ReactNode;
  /** Up to three key numbers. */
  keys: { label: string; ev: EvidenceId }[];
  histogram?: ReactNode;
  inspect?: ReactNode;
  preview?: boolean;
  /** Table alternative or extra detail. */
  children?: ReactNode;
}

export function LensPanel(p: LensPanelProps) {
  return (
    <section className="ib-lens" aria-label={`${p.title} lens`}>
      <header className="ib-lens__head">
        <h3 className="ib-lens__title">{p.title}</h3>
        {p.preview ? <PreviewStamp compact /> : null}
      </header>
      <dl className="ib-lens__rows">
        <div>
          <dt>What</dt>
          <dd>{p.what}</dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>{p.when}</dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>{p.where}</dd>
        </div>
        <div>
          <dt>How fine</dt>
          <dd>
            <fieldset className="ib-chips" aria-label="Resolution">
              {(['sketch', 'standard', 'fine'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className="ib-chip"
                  aria-pressed={r === p.resolution}
                  onClick={() => p.onResolution?.(r)}
                  disabled={!p.onResolution}
                >
                  {RESOLUTION_LABEL[r]}
                </button>
              ))}
            </fieldset>
          </dd>
        </div>
      </dl>
      <div className="ib-lens__result">
        {p.legend}
        {p.keys.length ? (
          <ul className="ib-lens__keys">
            {p.keys.slice(0, 3).map((k) => (
              <li key={k.label}>
                <span className="ib-lens__key-label">{k.label}</span>
                <Num ev={k.ev} />
              </li>
            ))}
          </ul>
        ) : null}
        {p.histogram}
      </div>
      {p.inspect ? (
        <div className="ib-lens__inspect">
          <h4>Inspect</h4>
          {p.inspect}
        </div>
      ) : null}
      {p.children}
    </section>
  );
}
