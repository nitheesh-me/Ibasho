/**
 * StageBar (Inkstone, DESIGN_SYSTEM 13.5, SPEC 19). Owner: WP-06.
 *
 * Seven beads in the engawa: geometry, sun and shadows, radiation, daylight, energy, codes,
 * options. Hollow while waiting, filling while running (with the stage's own sentence), solid when
 * final, half when only a rough or refined tier has arrived, split when failed, a short line when
 * skipped, hatched when stale. Cancel appears after 1 s of running. Past 10 s the bar adds percent
 * and time left. Under reduced motion beads change state without animation (CSS).
 *
 * The bar is never the only signal: a polite live region speaks the current sentence. Progress
 * metadata (percent, seconds) is tool state, not a result, so it is drawn in `code`, never in `Num`.
 *
 * DOM: `div.ib-stagebar[data-running]`, beads `li[data-stage][data-status][data-tier]`.
 */
import type { StageBarState, StageId, StageStatus, Tier } from '@ibasho/core';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { PreviewStamp } from './Preview.tsx';

export const STAGE_LABEL: Record<StageId, string> = {
  geometry: 'Geometry',
  sun: 'Sun',
  radiation: 'Radiation',
  daylight: 'Daylight',
  energy: 'Energy',
  codes: 'Codes',
  optimise: 'Search',
};

const STATUS_WORD: Record<StageStatus, string> = {
  idle: 'waiting',
  queued: 'waiting',
  running: 'running',
  done: 'done',
  skipped: 'skipped, nothing it reads changed',
  stale: 'out of date',
  cancelled: 'cancelled',
  failed: 'stopped',
};

export interface StageBarProps {
  state: StageBarState;
  /** The current sentence, e.g. "Sun hours: rough now, final in about 8 s". */
  message?: string;
  onCancel?: () => void;
  /** Hide labels under the beads (phone engawa). */
  compact?: boolean;
  /** Override the 1 s delay before Cancel shows (tests). */
  cancelAfterMs?: number;
}

function beadStyle(fraction: number): CSSProperties {
  return { '--ib-bead-fill': `${Math.round(Math.min(1, Math.max(0, fraction)) * 360)}deg` } as CSSProperties;
}

function isRunning(state: StageBarState): boolean {
  return state.stages.some((s) => s.status === 'running' || s.status === 'queued');
}

/** Overall progress over the stages in this job (skipped and idle stages excluded). */
export function overallFraction(state: StageBarState): number {
  const live = state.stages.filter((s) => s.status !== 'skipped' && s.status !== 'idle');
  if (live.length === 0) return 0;
  let sum = 0;
  for (const s of live) sum += s.status === 'done' ? 1 : s.status === 'running' ? s.fraction : 0;
  return sum / live.length;
}

export function StageBar({ state, message, onCancel, compact = false, cancelAfterMs = 1000 }: StageBarProps) {
  const running = isRunning(state);
  const [canCancel, setCanCancel] = useState(false);
  const [long, setLong] = useState(false);
  const startedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!running) {
      setCanCancel(false);
      setLong(false);
      startedFor.current = undefined;
      return;
    }
    if (startedFor.current === state.jobId) return;
    startedFor.current = state.jobId;
    setCanCancel(false);
    setLong(false);
    const a = setTimeout(() => setCanCancel(true), cancelAfterMs);
    const b = setTimeout(() => setLong(true), 10_000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [running, state.jobId, cancelAfterMs]);

  const preview = state.stages.some((s) => s.preview && s.status !== 'idle' && s.status !== 'skipped');
  const current = state.stages.find((s) => s.status === 'running');
  const pct = Math.round(overallFraction(state) * 100);
  const eta = current?.etaMs;
  const doneAll = !running && state.stages.some((s) => s.status === 'done');

  return (
    <section
      className="ib-stagebar"
      data-running={running ? '' : undefined}
      data-compact={compact ? '' : undefined}
      aria-label="Analysis progress"
    >
      <ol className="ib-stagebar__beads">
        {state.stages.map((s) => (
          <li
            key={s.id}
            className="ib-stagebar__stage"
            data-stage={s.id}
            data-status={s.status}
            data-tier={s.tier}
            aria-label={`${STAGE_LABEL[s.id]}: ${STATUS_WORD[s.status]}${tierWord(s.tier, s.status)}`}
          >
            <span className="ib-stagebar__bead" aria-hidden="true" style={beadStyle(s.fraction)} />
            {compact ? null : (
              <span className="ib-stagebar__label" aria-hidden="true">
                {STAGE_LABEL[s.id]}
              </span>
            )}
          </li>
        ))}
      </ol>
      <div
        className="ib-stagebar__track"
        role="progressbar"
        aria-label="Overall"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span className="ib-stagebar__ink" style={{ inlineSize: `${pct}%` }} />
      </div>
      <p className="ib-stagebar__msg" aria-live="polite">
        {compact && running && current
          ? STAGE_LABEL[current.id]
          : (message ?? (running ? 'Working' : doneAll ? 'Up to date' : 'Ready'))}
        {running && long && !compact ? (
          <code className="ib-stagebar__meta">
            {' '}
            {pct}%{eta !== undefined ? `, about ${Math.max(1, Math.round(eta / 1000))} s left` : ''}
          </code>
        ) : null}
      </p>
      {preview ? <PreviewStamp compact /> : null}
      {running && canCancel && onCancel ? (
        <button type="button" className="ib-stagebar__cancel" onClick={onCancel}>
          Cancel
        </button>
      ) : null}
    </section>
  );
}

function tierWord(tier: Tier | undefined, status: StageStatus): string {
  if (status !== 'running' && status !== 'done') return '';
  if (tier === 'rough') return ', rough result';
  if (tier === 'refined') return ', refined result';
  return '';
}
