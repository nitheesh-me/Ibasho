/**
 * ScoreGroups: the Ibasho score numeral with four group bars, and all seven indicators on tap
 * (DESIGN_SYSTEM 8; SPEC R2, 5.3, AC-H2; DEC PR-4). Owner: WP-06.
 *
 * - A number from 0 to 100, never a letter (F7). Letters belong to `EpcChip`.
 * - While a material field is unknown the score is a band: the node is a range, `Num` prints
 *   "54 to 66" and the strip draws a hatched band with the likely dot (UX 5.3).
 * - Four groups at first glance (Fabric and heating, Running cost, Carbon, Comfort); the seven
 *   indicators open on tap. Every bar length is read from the node its `Num` shows.
 *
 * DOM: `section.ib-score[data-band]`, bars `.ib-bar[data-group]`, indicators `[data-indicator]`.
 */
import type { EvidenceId } from '@ibasho/core';
import { type CSSProperties, useId, useState } from 'react';
import { useEvidenceSource } from '../evidence/context.tsx';
import { type Magnitude, magnitude, unit } from '../num/magnitude.ts';
import { Num } from '../num/Num.tsx';

export type ScoreGroupId = 'fabric-heating' | 'running-cost' | 'carbon' | 'comfort';
/** The seven indicators (SF 2.1). Keys are internal; the UI shows names only. */
export type ScoreIndicatorId = 'F' | 'C' | 'E' | 'A' | 'H' | 'R' | 'T';

export const SCORE_GROUPS: readonly { id: ScoreGroupId; name: string; indicators: ScoreIndicatorId[] }[] = [
  { id: 'fabric-heating', name: 'Fabric and heating', indicators: ['F', 'H'] },
  { id: 'running-cost', name: 'Running cost', indicators: ['A', 'E'] },
  { id: 'carbon', name: 'Carbon', indicators: ['C', 'R'] },
  { id: 'comfort', name: 'Comfort', indicators: ['T'] },
];

export const INDICATOR_NAME: Record<ScoreIndicatorId, string> = {
  F: 'Fabric',
  H: 'Heating system',
  A: 'Running cost',
  E: 'Energy use',
  C: 'Carbon',
  R: 'Renewables and flexibility',
  T: 'Comfort',
};

export const SCORE_LINE = 'Scored for a typical household, so your bills do not change it.';

export interface ScoreGroupsProps {
  /** Total score, 0 to 100 (a range while material fields are unknown). */
  score: EvidenceId;
  /** Group scores, 0 to 100 each, in any order. */
  groups: { id: ScoreGroupId; ev: EvidenceId }[];
  /** Indicator scores, 0 to 100 each, shown on tap. */
  indicators?: { id: ScoreIndicatorId; ev: EvidenceId }[];
  /** True while any material field is unknown (AC-H2); forces the band treatment. */
  materialUnknown?: boolean;
  /** "Sharpen" action, offered while the score is a band. */
  onSharpen?: () => void;
  /** Starts with the seven indicators open. */
  defaultOpen?: boolean;
  className?: string;
}

export function ScoreGroups({
  score,
  groups,
  indicators,
  materialUnknown = false,
  onSharpen,
  defaultOpen = false,
  className,
}: ScoreGroupsProps) {
  const src = useEvidenceSource();
  const [open, setOpen] = useState(defaultOpen);
  const listId = useId();
  const total = magnitude(src.node(score));
  const band = materialUnknown || Boolean(total?.range);
  const byGroup = new Map(groups.map((g) => [g.id, g.ev]));
  const byIndicator = new Map((indicators ?? []).map((g) => [g.id, g.ev]));

  return (
    <section
      className={['ib-score', className].filter(Boolean).join(' ')}
      data-band={band ? '' : undefined}
      aria-label="Ibasho score"
    >
      <div className="ib-score__head">
        <p className="ib-kicker">Ibasho score</p>
        <div className="ib-score__numeral">
          <Num ev={score} size="display" />
        </div>
        <Strip m={total} className="ib-score__strip" />
        {band ? (
          <p className="ib-score__band-note">
            A range, because some things about your home are not known yet.
            {onSharpen ? (
              <>
                {' '}
                <button type="button" className="ib-link-button" onClick={onSharpen}>
                  Sharpen
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <ul className="ib-score__groups" id={listId}>
        {SCORE_GROUPS.map((g) => {
          const ev = byGroup.get(g.id);
          return (
            <li key={g.id} className="ib-score__group">
              <Bar label={g.name} ev={ev} group={g.id} />
              {open && indicators ? (
                <ul className="ib-score__indicators">
                  {g.indicators.map((k) => (
                    <li key={k} data-indicator={k}>
                      <Bar label={INDICATOR_NAME[k]} ev={byIndicator.get(k)} small />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="ib-score__foot">
        <p className="ib-score__line">{SCORE_LINE}</p>
        {indicators && indicators.length > 0 ? (
          <button
            type="button"
            className="ib-link-button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen(!open)}
          >
            {open ? 'Show the four groups' : 'Show all seven parts'}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Bar({
  label,
  ev,
  group,
  small,
}: {
  label: string;
  ev: EvidenceId | undefined;
  group?: ScoreGroupId;
  small?: boolean;
}) {
  const src = useEvidenceSource();
  const m = ev ? magnitude(src.node(ev)) : undefined;
  return (
    <div className="ib-bar" data-group={group} data-size={small ? 'sm' : undefined}>
      <span className="ib-bar__label">{label}</span>
      <span className="ib-bar__value">
        {ev ? <Num ev={ev} size="ui" /> : <span className="ib-bar__none">Not scored</span>}
      </span>
      <Strip m={m} className="ib-bar__track" />
    </div>
  );
}

/** A 0 to 100 strip: solid to the value, or a hatched band with a likely dot for a range. */
function Strip({ m, className }: { m: Magnitude | undefined; className: string }) {
  const style = m
    ? ({
        '--lo': unit(m.lo / 100),
        '--hi': unit(m.hi / 100),
        '--mid': unit(m.mid / 100),
      } as CSSProperties)
    : undefined;
  return (
    <span
      className={`ib-strip ${className}`}
      data-range={m?.range ? '' : undefined}
      data-empty={m ? undefined : ''}
      style={style}
      aria-hidden="true"
    >
      <span className="ib-strip__fill" />
      {m?.range ? <span className="ib-strip__dot" /> : null}
    </span>
  );
}
