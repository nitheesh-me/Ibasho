/**
 * MeasureCard (Fuda 札): a measure card in the what-if tray (DESIGN_SYSTEM 8; SPEC 5.6, 5.7, R22;
 * UX 6.1). Owner: WP-06.
 *
 * States, each with a pattern or label as well as colour (DS 12):
 * - `available`: can be added; the action reads "Add to this scenario".
 * - `in-scenario`: added; the action reads "Take out of this scenario".
 * - `ask`: someone else decides (landlord, freeholder); offers the ask action.
 * - `needs-check`: possible after a check, which the card names (R22).
 * - `blocked`: a rule rules it out here; the card gives the reason.
 * - `ruled-out`: you ruled it out; it stays out until you bring it back.
 *
 * DOM: `article.ib-fuda[data-measure][data-state]`.
 */
import type { EvidenceId } from '@ibasho/core';
import { useId } from 'react';
import { Mon } from '../mon/Mon.tsx';
import { monFor } from '../mon/set.ts';
import { Num } from '../num/Num.tsx';

export type MeasureState = 'available' | 'in-scenario' | 'ask' | 'needs-check' | 'blocked' | 'ruled-out';

export const MEASURE_STATE_LABEL: Record<MeasureState, string> = {
  available: 'Available',
  'in-scenario': 'In this scenario',
  ask: 'Someone else decides',
  'needs-check': 'Possible after a check',
  blocked: 'Not possible here',
  'ruled-out': 'You ruled this out',
};

export interface MeasureCardProps {
  measureId: string;
  name: string;
  state: MeasureState;
  /** One plain line on what it does. */
  blurb?: string;
  /** Installed cost range. */
  cost?: EvidenceId;
  /** Reason for `blocked` or `ask` (e.g. "Listed building: needs consent"). */
  reason?: string;
  /** Rule id behind a `blocked` or `needs-check` state. */
  ruleId?: string;
  /** The check, for `needs-check` (e.g. "a moisture assessment for inside insulation"). */
  check?: string;
  /** Toggle in or out of the scenario (`available`, `in-scenario`). */
  onToggle?: (measureId: string, on: boolean) => void;
  /** Ask action for `ask` (default label "Ask your landlord"). */
  onAsk?: (measureId: string) => void;
  askLabel?: string;
  /** Bring back a `ruled-out` measure. */
  onRestore?: (measureId: string) => void;
  className?: string;
}

export function MeasureCard({
  measureId,
  name,
  state,
  blurb,
  cost,
  reason,
  ruleId,
  check,
  onToggle,
  onAsk,
  askLabel = 'Ask your landlord',
  onRestore,
  className,
}: MeasureCardProps) {
  const nameId = useId();
  const mon = monFor(measureId);
  const on = state === 'in-scenario';
  const toggleable = state === 'available' || state === 'in-scenario';
  return (
    <article
      className={['ib-fuda', className].filter(Boolean).join(' ')}
      data-measure={measureId}
      data-state={state}
      aria-labelledby={nameId}
    >
      <span className="ib-fuda__hole" aria-hidden="true" />
      <div className="ib-fuda__crest">{mon ? <Mon id={mon} size={32} /> : null}</div>
      <h3 id={nameId} className="ib-fuda__name">
        {name}
      </h3>
      {blurb ? <p className="ib-fuda__blurb">{blurb}</p> : null}
      {cost ? (
        <p className="ib-fuda__cost">
          <span className="ib-fuda__cost-label">Cost</span> <Num ev={cost} size="ui" />
        </p>
      ) : null}
      <p className="ib-fuda__state" data-state-label="">
        <span className="ib-fuda__stamp" aria-hidden="true" />
        {MEASURE_STATE_LABEL[state]}
      </p>
      {state === 'needs-check' && check ? <p className="ib-fuda__reason">Needs {check}.</p> : null}
      {(state === 'blocked' || state === 'ask') && reason ? (
        <p className="ib-fuda__reason">{reason}</p>
      ) : null}
      {ruleId && (state === 'blocked' || state === 'needs-check') ? (
        <p className="ib-fuda__rule">
          Rule <code>{ruleId}</code>
        </p>
      ) : null}
      <div className="ib-fuda__actions">
        {toggleable && onToggle ? (
          <button
            type="button"
            className="ib-fuda__toggle"
            data-on={on ? '' : undefined}
            aria-describedby={nameId}
            onClick={() => onToggle(measureId, !on)}
          >
            {on ? 'Take out of this scenario' : 'Add to this scenario'}
          </button>
        ) : null}
        {state === 'ask' && onAsk ? (
          <button type="button" className="ib-fuda__action" onClick={() => onAsk(measureId)}>
            {askLabel}
          </button>
        ) : null}
        {state === 'ruled-out' && onRestore ? (
          <button type="button" className="ib-fuda__action" onClick={() => onRestore(measureId)}>
            Bring it back
          </button>
        ) : null}
      </div>
    </article>
  );
}
