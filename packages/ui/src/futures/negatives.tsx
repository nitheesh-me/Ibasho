/**
 * Negatives: what gets worse (SPEC 14, AC-B3). Owner: WP-06.
 *
 * Every result lists what gets worse beside what gets better. `Negatives` always renders, even
 * when empty, so a card never hides the question. Each row names the indicator in plain words and
 * shows its signed change as a `Num` with the increase hatch.
 *
 * DOM: `.ib-negatives[data-count]`, rows `li[data-negative][data-kind]`.
 */
import type { EvidenceId, MessageKey, Negative, NegativeKind, NegativeRisk } from '@ibasho/core';
import { Num } from '../num/Num.tsx';

export interface NegativeItem {
  key: string;
  /** Plain sentence or phrase, e.g. "Electricity use rises". */
  label: string;
  kind: NegativeKind;
  /** Node holding the signed change, or the risk finding. */
  ev?: EvidenceId;
  risk?: NegativeRisk;
  ruleId?: string;
  /** Decay model behind it (the "If nothing is done" line). */
  maintenanceId?: string;
}

export const NEGATIVE_KIND_LABEL: Record<NegativeKind, string> = {
  'fuel-rise': 'Fuel',
  money: 'Money',
  carbon: 'Carbon',
  performance: 'Home',
  disruption: 'Disruption',
  risk: 'New risk',
};

export const RISK_LABEL: Record<NegativeRisk, string> = {
  moisture: 'Moisture',
  overheating: 'Overheating',
  noise: 'Noise',
  fire: 'Fire',
  structural: 'Structure',
  other: 'Other',
};

/** Core `Negative`s to display items; `text` resolves message keys (WP-09 copy). */
export function negativeItems(negs: readonly Negative[], text: (key: MessageKey) => string): NegativeItem[] {
  return negs.map((n, i) => ({
    key: `${n.indicator}#${i}`,
    label: text(n.message),
    kind: n.kind,
    ev: n.evidence,
    ...(n.risk ? { risk: n.risk } : {}),
    ...(n.ruleId ? { ruleId: n.ruleId } : {}),
    ...(n.maintenanceId ? { maintenanceId: n.maintenanceId } : {}),
  }));
}

export interface NegativesProps {
  items: readonly NegativeItem[];
  /** Heading. Default "What gets worse". */
  title?: string;
  /** Shown when nothing gets worse. */
  empty?: string;
  className?: string;
}

export function Negatives({
  items,
  title = 'What gets worse',
  empty = 'Nothing we measure gets worse.',
  className,
}: NegativesProps) {
  return (
    <div className={['ib-negatives', className].filter(Boolean).join(' ')} data-count={items.length}>
      <p className="ib-negatives__title">{title}</p>
      {items.length === 0 ? (
        <p className="ib-negatives__empty">{empty}</p>
      ) : (
        <ul className="ib-negatives__list">
          {items.map((n) => (
            <li key={n.key} className="ib-negatives__item" data-negative="" data-kind={n.kind}>
              <span className="ib-negatives__mark" aria-hidden="true" />
              <span className="ib-negatives__text">
                <span className="ib-negatives__kind">
                  {n.kind === 'risk' && n.risk ? `${RISK_LABEL[n.risk]} risk` : NEGATIVE_KIND_LABEL[n.kind]}
                </span>
                <span className="ib-negatives__label">{n.label}</span>
                {n.ruleId ? <code className="ib-negatives__rule">{n.ruleId}</code> : null}
              </span>
              {n.ev && n.kind !== 'risk' ? (
                <span className="ib-negatives__value">
                  <Num ev={n.ev} size="ui" signed delta="increase" />
                </span>
              ) : n.ev ? (
                <span className="ib-negatives__value">
                  <Num ev={n.ev} size="ui" />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
