/**
 * Futures (Byobu 屏風): the three-panel folding screen, and the fourth line "If nothing is done"
 * (DESIGN_SYSTEM 8, 9; SPEC 5.7, R7, 14, AC-B1, AC-B3). Owner: WP-06.
 *
 * - Fixed order: Least upfront, Best return, Lowest running carbon. Each card states its axis in
 *   plain words; the kanji 穏 賢 勇 are decorative (`aria-hidden`).
 * - Four figures per card, the rest behind "More". Every figure is a `Num`.
 * - Every card lists what gets worse (`Negatives`), even when nothing does.
 * - Beneath the screen, "If nothing is done": the home ageing without maintenance, with each wear
 *   effect citing its decay source, replacements falling due, and what gets worse.
 *
 * DOM: `section.ib-futures`, cards `article.ib-future[data-pick]`, the fourth line
 * `section.ib-nothing[data-do-nothing]`.
 */
import type { EvidenceId } from '@ibasho/core';
import { type CSSProperties, type ReactNode, useId, useState } from 'react';
import { Glyph } from '../glyphs/Glyph.tsx';
import type { BakedChar } from '../glyphs/list.ts';
import { GradeBadge } from '../grade/GradeBadge.tsx';
import { Mon } from '../mon/Mon.tsx';
import { monFor } from '../mon/set.ts';
import { Num, type NumProps } from '../num/Num.tsx';
import { type NegativeItem, Negatives } from './negatives.tsx';

export type FutureKey = 'leastUpfront' | 'bestReturn' | 'lowestRunningCarbon';

export const FUTURE_ORDER: readonly {
  key: FutureKey;
  title: string;
  axis: string;
  glyph: BakedChar;
}[] = [
  {
    key: 'leastUpfront',
    title: 'Least upfront',
    axis: 'The smallest bill to start, among changes that meet your aim.',
    glyph: '穏',
  },
  {
    key: 'bestReturn',
    title: 'Best return',
    axis: 'Gives back the most over the years, in today’s money.',
    glyph: '賢',
  },
  {
    key: 'lowestRunningCarbon',
    title: 'Lowest running carbon',
    axis: 'Cuts the most carbon from running the home over its life.',
    glyph: '勇',
  },
];

export interface FutureFigure {
  key: string;
  label: string;
  ev: EvidenceId;
  signed?: boolean;
  delta?: NumProps['delta'];
  as?: NumProps['as'];
}

export interface FutureCardData {
  key: FutureKey;
  packageId: string;
  /** Plain measure names, e.g. "Draught-proofing and loft insulation". */
  name: string;
  /** Measures in the package, for the crest row. */
  measures?: { id: string; name: string }[];
  /** The four figures: upfront range, yearly saving range, running carbon saved a year, comfort change. */
  figures: FutureFigure[];
  /** Behind "More": per-fuel deltas, lifetime carbon, NPV, payback, band, consents, disruption. */
  more?: FutureFigure[];
  /** What gets worse with this package (required; may be empty). */
  negatives: NegativeItem[];
  /** Set when an earlier card shows the same package. */
  sameAs?: FutureKey;
  /** The card is held back, with the reason (e.g. Best return before AC-5b). */
  withheld?: string;
  /** Extra content under the figures (consent card, seal). */
  extra?: ReactNode;
}

export interface DoNothingEffectRow {
  key: string;
  /** Plain words, e.g. "Boiler efficiency drifts down". */
  label: string;
  /** Aged value at the reported year. */
  ev: EvidenceId;
  /** Low and high ends of the decay range. */
  band?: { lo: EvidenceId; hi: EvidenceId };
  /** Decay source, e.g. "Boiler ageing, Energy Saving Trust field trial". */
  source: string;
  /** Source grade badge when `estimate` or `announced` (R17). */
  grade?: 'estimate' | 'announced';
}

export interface DoNothingData {
  /** Plain horizon, e.g. "Over the next fifteen years". Write numbers as words or pass `horizonEv`. */
  horizon?: string;
  horizonEv?: EvidenceId;
  /** Headline figures: cost of doing nothing, carbon, a year's bill at the horizon. */
  figures: FutureFigure[];
  effects: DoNothingEffectRow[];
  replacements?: { key: string; label: string; due: EvidenceId; cost?: EvidenceId }[];
  negatives: NegativeItem[];
  /** Decay models that matched nothing in this home, named so the gap is visible. */
  notApplicable?: string[];
}

export interface FuturesProps {
  cards: FutureCardData[];
  /** The fourth line. `null` while it is still being worked out. */
  doNothing: DoNothingData | null;
  chosen?: FutureKey;
  onChoose?: (key: FutureKey) => void;
  /** Label of the choose action. Default "Make this my plan". */
  chooseLabel?: string;
  title?: ReactNode;
  className?: string;
}

export function Futures({
  cards,
  doNothing,
  chosen,
  onChoose,
  chooseLabel = 'Make this my plan',
  title = 'Three futures',
  className,
}: FuturesProps) {
  const titleId = useId();
  const byKey = new Map(cards.map((c) => [c.key, c]));
  return (
    <section className={['ib-futures-screen', className].filter(Boolean).join(' ')} aria-labelledby={titleId}>
      <h2 id={titleId} className="ib-futures-screen__title">
        {title}
      </h2>
      <ol className="ib-byobu">
        {FUTURE_ORDER.map((f, i) => {
          const card = byKey.get(f.key);
          return (
            <li key={f.key} className="ib-byobu__panel" style={{ '--i': i } as CSSProperties}>
              {card ? (
                <FutureCard
                  card={card}
                  chosen={chosen === f.key}
                  {...(onChoose ? { onChoose } : {})}
                  chooseLabel={chooseLabel}
                />
              ) : (
                <EmptyCard keyName={f.key} />
              )}
            </li>
          );
        })}
      </ol>
      <DoNothingLine data={doNothing} />
    </section>
  );
}

function Head({ k }: { k: FutureKey }) {
  const f = FUTURE_ORDER.find((x) => x.key === k) as (typeof FUTURE_ORDER)[number];
  return (
    <header className="ib-future__head">
      <span className="ib-future__glyph" aria-hidden="true">
        <Glyph char={f.glyph} />
      </span>
      <h3 className="ib-future__title">{f.title}</h3>
      <p className="ib-future__axis">{f.axis}</p>
    </header>
  );
}

function EmptyCard({ keyName }: { keyName: FutureKey }) {
  return (
    <article className="ib-future ib-washi" data-pick={keyName} data-empty="">
      <Head k={keyName} />
      <p className="ib-future__note">No change meets your aim on this axis yet.</p>
    </article>
  );
}

export function FutureCard({
  card,
  chosen = false,
  onChoose,
  chooseLabel = 'Make this my plan',
}: {
  card: FutureCardData;
  chosen?: boolean;
  onChoose?: (key: FutureKey) => void;
  chooseLabel?: string;
}) {
  const [more, setMore] = useState(false);
  const moreId = useId();
  if (card.withheld) {
    return (
      <article className="ib-future ib-washi" data-pick={card.key} data-withheld="">
        <Head k={card.key} />
        <p className="ib-future__note">{card.withheld}</p>
        <Negatives items={card.negatives} />
      </article>
    );
  }
  const same = card.sameAs ? FUTURE_ORDER.find((f) => f.key === card.sameAs)?.title : undefined;
  return (
    <article
      className="ib-future ib-washi"
      data-pick={card.key}
      data-package={card.packageId}
      data-chosen={chosen ? '' : undefined}
    >
      <Head k={card.key} />
      {chosen ? <p className="ib-kicker ib-future__chosen">Your plan</p> : null}
      <p className="ib-future__name">{card.name}</p>
      {card.measures && card.measures.length > 0 ? (
        <ul className="ib-future__mons" aria-label="Changes in this future">
          {card.measures.map((m) => {
            const mon = monFor(m.id);
            return (
              <li key={m.id} className="ib-future__mon" title={m.name}>
                {mon ? (
                  <Mon id={mon} size={24} />
                ) : (
                  <span className="ib-future__mon-blank" aria-hidden="true" />
                )}
                <span className="ib-sr">{m.name}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {same ? <p className="ib-future__same">The same change as {same}.</p> : null}
      <Figures items={card.figures} className="ib-future__figures" />
      {card.more && card.more.length > 0 ? (
        <>
          <button
            type="button"
            className="ib-link-button ib-future__more-toggle"
            aria-expanded={more}
            aria-controls={moreId}
            onClick={() => setMore(!more)}
          >
            {more ? 'Less' : 'More'}
          </button>
          <div id={moreId} hidden={!more} className="ib-future__more">
            {more ? <Figures items={card.more} className="ib-future__figures" data-size="sm" /> : null}
          </div>
        </>
      ) : null}
      {card.extra}
      <Negatives items={card.negatives} className="ib-future__negatives" />
      {onChoose ? (
        <button
          type="button"
          className="ib-button ib-future__choose"
          aria-pressed={chosen}
          onClick={() => onChoose(card.key)}
        >
          {chooseLabel}
        </button>
      ) : null}
    </article>
  );
}

function Figures({
  items,
  className,
  ...rest
}: {
  items: FutureFigure[];
  className: string;
  'data-size'?: string;
}) {
  return (
    <dl className={className} {...rest}>
      {items.map((f) => (
        <div key={f.key} className="ib-figure" data-figure={f.key}>
          <dt className="ib-figure__label">{f.label}</dt>
          <dd className="ib-figure__value">
            <Num
              ev={f.ev}
              {...(f.signed ? { signed: true } : {})}
              {...(f.delta ? { delta: f.delta } : {})}
              {...(f.as ? { as: f.as } : {})}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The fourth line: "If nothing is done" (SPEC 14, AC-B1). */
export function DoNothingLine({ data, className }: { data: DoNothingData | null; className?: string }) {
  const titleId = useId();
  return (
    <section
      className={['ib-nothing', className].filter(Boolean).join(' ')}
      data-do-nothing=""
      data-pending={data ? undefined : ''}
      aria-labelledby={titleId}
    >
      <header className="ib-nothing__head">
        <h3 id={titleId} className="ib-nothing__title">
          If nothing is done
        </h3>
        <p className="ib-nothing__sub">
          {data ? (
            <>
              {data.horizon ?? 'Over the years ahead'}
              {data.horizonEv ? (
                <>
                  {' '}
                  (<Num ev={data.horizonEv} size="ui" />)
                </>
              ) : null}
              , the home ages without upkeep. Each change below comes from a documented wear model, with its
              source.
            </>
          ) : (
            'Still working out how the home ages without upkeep.'
          )}
        </p>
      </header>
      {data ? (
        <div className="ib-nothing__grid">
          <Figures items={data.figures} className="ib-nothing__figures" />
          <div className="ib-nothing__col">
            <p className="ib-negatives__title">What wears out</p>
            {data.effects.length === 0 ? (
              <p className="ib-negatives__empty">No wear model applies to this home yet.</p>
            ) : (
              <ul className="ib-nothing__effects">
                {data.effects.map((e) => (
                  <li key={e.key} className="ib-nothing__effect" data-effect="">
                    <span className="ib-nothing__effect-label">{e.label}</span>
                    <span className="ib-nothing__effect-value">
                      <Num ev={e.ev} size="ui" />
                      {e.band ? (
                        <span className="ib-nothing__effect-band">
                          {' '}
                          between <Num ev={e.band.lo} size="ui" /> and <Num ev={e.band.hi} size="ui" />
                        </span>
                      ) : null}
                    </span>
                    <span className="ib-nothing__source">
                      Source: {e.source}
                      {e.grade ? <GradeBadge grade={e.grade} /> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {data.replacements && data.replacements.length > 0 ? (
              <>
                <p className="ib-negatives__title">Falls due</p>
                <ul className="ib-nothing__effects">
                  {data.replacements.map((r) => (
                    <li key={r.key} className="ib-nothing__effect" data-replacement="">
                      <span className="ib-nothing__effect-label">{r.label}</span>
                      <span className="ib-nothing__effect-value">
                        <Num ev={r.due} size="ui" />
                        {r.cost ? (
                          <>
                            {', about '}
                            <Num ev={r.cost} size="ui" />
                          </>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
          <Negatives items={data.negatives} className="ib-nothing__negatives" />
          {data.notApplicable && data.notApplicable.length > 0 ? (
            <p className="ib-nothing__gap">Not modelled for this home: {data.notApplicable.join(', ')}.</p>
          ) : null}
        </div>
      ) : (
        <span className="ib-pencil" aria-hidden="true" />
      )}
    </section>
  );
}
