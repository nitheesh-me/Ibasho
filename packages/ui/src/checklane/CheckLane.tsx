/**
 * CheckLane: "Possible after a check" (DESIGN_SYSTEM 8; SPEC R22, 5.7; DEC SC-4). Owner: WP-06.
 *
 * Packages blocked only by undecided rules wait here, outside the certified front, until the owner
 * records that the check is done. Each row names the check in plain words, its cost with the cost
 * grade (R17: `estimate` until sourced), what the package would add, and the rule that asks.
 * The lane is drawn as an engawa step: a pencil dashed edge says "not yet", never a seal.
 *
 * DOM: `section.ib-checklane`, rows `li[data-package][data-check-done]`.
 */
import type { EvidenceId, Grade } from '@ibasho/core';
import { type ReactNode, useId } from 'react';
import { GradeBadge } from '../grade/GradeBadge.tsx';
import { Mon } from '../mon/Mon.tsx';
import { monFor } from '../mon/set.ts';
import { Num, type NumProps } from '../num/Num.tsx';

export interface CheckLaneRow {
  packageId: string;
  /** Plain measure names, e.g. "Inside wall insulation". */
  name: string;
  measures?: { id: string; name: string }[];
  /** The check, e.g. "A moisture assessment for inside insulation". */
  check: string;
  /** Cost of the check, and its source grade. */
  checkCost?: EvidenceId;
  costGrade: Grade;
  /** Rules that wait on the check. */
  ruleIds?: string[];
  /** What the package would add once the check passes (one or two figures). */
  gains?: { key: string; label: string; ev: EvidenceId; signed?: boolean; delta?: NumProps['delta'] }[];
  /** The owner has recorded the check as done. */
  done?: boolean;
}

export interface CheckLaneProps {
  rows: readonly CheckLaneRow[];
  title?: ReactNode;
  /** Record that the check is done (moves the package towards the front on the next search). */
  onRecordDone?: (packageId: string) => void;
  /** Learn about the check (next step card). */
  onLearn?: (packageId: string) => void;
  className?: string;
}

export function CheckLane({
  rows,
  title = 'Possible after a check',
  onRecordDone,
  onLearn,
  className,
}: CheckLaneProps) {
  const titleId = useId();
  return (
    <section className={['ib-checklane', className].filter(Boolean).join(' ')} aria-labelledby={titleId}>
      <h3 id={titleId} className="ib-list-title">
        {title}
      </h3>
      <p className="ib-checklane__lede">
        These could join the futures once a check says they are safe here. They stay out until you record that
        the check is done.
      </p>
      {rows.length === 0 ? (
        <p className="ib-list-empty">Nothing is waiting on a check.</p>
      ) : (
        <ul className="ib-checklane__list">
          {rows.map((r) => (
            <li
              key={r.packageId}
              className="ib-checklane__row"
              data-package={r.packageId}
              data-check-done={r.done ? '' : undefined}
            >
              <div className="ib-checklane__what">
                {r.measures && r.measures.length > 0 ? (
                  <span className="ib-checklane__mons" aria-hidden="true">
                    {r.measures.map((m) => {
                      const mon = monFor(m.id);
                      return mon ? <Mon key={m.id} id={mon} size={24} /> : null;
                    })}
                  </span>
                ) : null}
                <span className="ib-checklane__name">{r.name}</span>
              </div>
              <div className="ib-checklane__check">
                <span className="ib-checklane__needs">Needs</span>
                <span className="ib-checklane__check-name">{r.check}</span>
                <span className="ib-checklane__cost">
                  {r.checkCost ? (
                    <>
                      <span className="ib-checklane__cost-label">About</span>{' '}
                      <Num ev={r.checkCost} size="ui" />
                    </>
                  ) : (
                    <span className="ib-checklane__cost-label">Cost not known yet</span>
                  )}
                  <GradeBadge grade={r.costGrade} />
                </span>
                {r.ruleIds && r.ruleIds.length > 0 ? (
                  <span className="ib-checklane__rules">
                    Asked by{' '}
                    {r.ruleIds.map((id, i) => (
                      <span key={id}>
                        {i > 0 ? ', ' : null}
                        <code>{id}</code>
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
              {r.gains && r.gains.length > 0 ? (
                <dl className="ib-checklane__gains">
                  {r.gains.map((g) => (
                    <div key={g.key} className="ib-figure" data-figure={g.key}>
                      <dt className="ib-figure__label">{g.label}</dt>
                      <dd className="ib-figure__value">
                        <Num
                          ev={g.ev}
                          size="ui"
                          {...(g.signed ? { signed: true } : {})}
                          {...(g.delta ? { delta: g.delta } : {})}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <div className="ib-checklane__actions">
                {r.done ? (
                  <span className="ib-checklane__done">
                    Check recorded. Joins the futures on the next search.
                  </span>
                ) : onRecordDone ? (
                  <button type="button" className="ib-button" onClick={() => onRecordDone(r.packageId)}>
                    The check is done
                  </button>
                ) : null}
                {onLearn ? (
                  <button type="button" className="ib-link-button" onClick={() => onLearn(r.packageId)}>
                    About this check
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
