/**
 * WhyNot: why a measure is in none of the three futures (DESIGN_SYSTEM 8; SPEC 5.7 "Why not?").
 * Owner: WP-06.
 *
 * Every applicable measure missing from all three picks gets a row with a reason chip. Reasons:
 * - `rule`: a rule rules it out here (the chip shows the rule id);
 * - `memory`: you ruled it out (offers "Bring it back");
 * - `tenure`: someone else decides (offers the ask action);
 * - `witness`: another option beats it on cost, return and carbon at once (names the witness);
 * - `target`: it does not reach your aim on its own or in any package;
 * - `budget`: every package with it is outside your budget.
 * Each chip carries a mark shape as well as its colour (DS 12).
 *
 * DOM: `section.ib-whynot`, rows `li[data-measure][data-reason]`.
 */
import type { EvidenceId } from '@ibasho/core';
import { type ReactNode, useId } from 'react';
import { Mon } from '../mon/Mon.tsx';
import { monFor } from '../mon/set.ts';
import { Num } from '../num/Num.tsx';

export type WhyNotReason = 'rule' | 'memory' | 'tenure' | 'witness' | 'target' | 'budget';

export const WHY_NOT_LABEL: Record<WhyNotReason, string> = {
  rule: 'Rule',
  memory: 'You ruled it out',
  tenure: 'Someone else decides',
  witness: 'Beaten by another option',
  target: 'Misses your aim',
  budget: 'Outside your budget',
};

export interface WhyNotItem {
  measureId: string;
  name: string;
  reason: WhyNotReason;
  /** One plain sentence, e.g. "Listed buildings need consent for outside insulation." */
  detail?: string;
  /** For `rule`. */
  ruleId?: string;
  /** For `witness`: the option that beats it. */
  witness?: string;
  /** For `budget`: the cheapest package with it. */
  cost?: EvidenceId;
}

export interface WhyNotProps {
  items: readonly WhyNotItem[];
  title?: ReactNode;
  /** Bring back a measure you ruled out. */
  onRestore?: (measureId: string) => void;
  /** Ask the landlord or freeholder. */
  onAsk?: (measureId: string) => void;
  askLabel?: string;
  /** Open the rule's evidence. */
  onRule?: (ruleId: string) => void;
  className?: string;
}

/** Stable reading order: what you can act on first, then the hard limits. */
export const WHY_NOT_ORDER: readonly WhyNotReason[] = [
  'memory',
  'budget',
  'tenure',
  'target',
  'witness',
  'rule',
];

export function WhyNot({
  items,
  title = 'Why not these?',
  onRestore,
  onAsk,
  askLabel = 'Ask your landlord',
  onRule,
  className,
}: WhyNotProps) {
  const titleId = useId();
  const sorted = [...items].sort(
    (a, b) =>
      WHY_NOT_ORDER.indexOf(a.reason) - WHY_NOT_ORDER.indexOf(b.reason) || a.name.localeCompare(b.name),
  );
  return (
    <section className={['ib-whynot', className].filter(Boolean).join(' ')} aria-labelledby={titleId}>
      <h3 id={titleId} className="ib-list-title">
        {title}
      </h3>
      {sorted.length === 0 ? (
        <p className="ib-list-empty">Every change that fits your home is in at least one future.</p>
      ) : (
        <ul className="ib-whynot__list">
          {sorted.map((it) => {
            const mon = monFor(it.measureId);
            return (
              <li
                key={it.measureId}
                className="ib-whynot__row"
                data-measure={it.measureId}
                data-reason={it.reason}
              >
                <span className="ib-whynot__mon">{mon ? <Mon id={mon} size={24} /> : null}</span>
                <span className="ib-whynot__main">
                  <span className="ib-whynot__name">{it.name}</span>
                  {it.detail ? <span className="ib-whynot__detail">{it.detail}</span> : null}
                  {it.reason === 'witness' && it.witness ? (
                    <span className="ib-whynot__detail">
                      {it.witness} does better on cost, return and carbon.
                    </span>
                  ) : null}
                  {it.reason === 'budget' && it.cost ? (
                    <span className="ib-whynot__detail">
                      The least it could cost is <Num ev={it.cost} size="ui" />.
                    </span>
                  ) : null}
                </span>
                <span className="ib-whynot__side">
                  <ReasonChip item={it} {...(onRule ? { onRule } : {})} />
                  {it.reason === 'memory' && onRestore ? (
                    <button type="button" className="ib-link-button" onClick={() => onRestore(it.measureId)}>
                      Bring it back
                    </button>
                  ) : null}
                  {it.reason === 'tenure' && onAsk ? (
                    <button type="button" className="ib-link-button" onClick={() => onAsk(it.measureId)}>
                      {askLabel}
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ReasonChip({ item, onRule }: { item: WhyNotItem; onRule?: (ruleId: string) => void }) {
  const body = (
    <>
      <span className="ib-reason__mark" aria-hidden="true" />
      {WHY_NOT_LABEL[item.reason]}
      {item.reason === 'rule' && item.ruleId ? <code className="ib-reason__rule">{item.ruleId}</code> : null}
    </>
  );
  if (item.reason === 'rule' && item.ruleId && onRule) {
    const id = item.ruleId;
    return (
      <button type="button" className="ib-reason" data-reason={item.reason} onClick={() => onRule(id)}>
        {body}
      </button>
    );
  }
  return (
    <span className="ib-reason" data-reason={item.reason}>
      {body}
    </span>
  );
}
