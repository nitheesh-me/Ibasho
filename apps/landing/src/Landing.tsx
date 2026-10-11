/**
 * The landing page, "Ibasho no kōjō" (SPEC 5.1 and 27, PLAN-V3, UX 16, SV 7). Owner: WP-09.
 *
 * Rendered to static HTML at build time (`prerender.tsx`), so every chapter reads with JavaScript
 * off (AC-L2) and first paint needs no script (AC-L1). The chapter list comes only from
 * `@ibasho/content` (AC-L3), already filtered by `requires` (I4). A chapter whose studio stages are
 * still Preview carries a Preview mark on its still.
 *
 * Colour discipline (DESIGN_SYSTEM 1): gold only on the one hero action; no vermilion, because no
 * seal is pressed on this page. The whole page follows the theme: ink on paper by day, lantern by
 * night, so the switch in the bar changes the first screen too (landing review M5).
 */

import {
  BUILDING_TYPE_COPY,
  definitionOf,
  GLOSSARY,
  LANDING_AUDIENCE_INTRO,
  LANDING_AUDIENCES,
  LANDING_EXAMPLE,
  LANDING_FOOTER,
  LANDING_HERO_CAPTION,
  LANDING_INVITATION,
  LANDING_PREVIEW_NOTE,
  LANDING_TAGLINE,
  type LandingChapter,
  markedTerms,
  segments,
  termOf,
} from '@ibasho/content';
import type { BuildingTypeId } from '@ibasho/core';
import { Glyph, Mon } from '@ibasho/ui';
import type { ReactNode } from 'react';
import { CityArt } from './CityArt.tsx';
import type { ExampleData } from './example.ts';
import type { Poster } from './posters.ts';

/** Copy with glossary marks rendered as links to the "Words we use" list. */
export function Copy({ text }: { text: string }): ReactNode {
  return segments(text, termOf).map((s, i) =>
    s.t === 'text' ? (
      s.text
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: segments of one fixed string never reorder
      <a key={i} className="lp-term" href={`#g-${s.id}`} title={definitionOf(s.id)}>
        {s.label}
      </a>
    ),
  );
}

/** Glossary ids marked anywhere on the page, in first-use order. */
export function termsUsed(chapters: readonly LandingChapter[], preview = false): string[] {
  const seen = new Set<string>();
  for (const c of chapters)
    for (const t of [c.line, ...c.body, ...(c.more ?? [])].flatMap(markedTerms)) seen.add(t);
  for (const t of markedTerms(LANDING_INVITATION.line)) seen.add(t);
  if (preview) seen.add('preview');
  return [...seen].filter((id) => GLOSSARY[id]);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** The Preview mark: the word on a pencil hatch, linking to what Preview means. */
function PreviewMark({ corner = false }: { corner?: boolean }) {
  return (
    <a
      className={corner ? 'lp-preview lp-preview--corner' : 'lp-preview'}
      href="#g-preview"
      title={definitionOf('preview')}
    >
      <span aria-hidden="true" className="lp-preview__hatch" />
      Preview
    </a>
  );
}

/** A still from the city scene, small and large, lazily loaded. */
function Still({
  poster,
  eager = false,
  className,
}: {
  poster: Poster;
  eager?: boolean;
  className?: string;
}) {
  return (
    <img
      className={className}
      src={poster.large}
      srcSet={`${poster.small} 800w, ${poster.large} 1600w`}
      sizes="(min-width: 80rem) 50vw, 100vw"
      alt={poster.alt}
      width={1600}
      height={1000}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}

function Hero({
  chapter,
  posters,
  anyPreview,
  example,
}: {
  chapter: LandingChapter;
  posters: ReadonlyMap<string, Poster>;
  anyPreview: boolean;
  example?: ExampleData | undefined;
}) {
  const titleId = `${chapter.id}-title`;
  const day = posters.get('city-day');
  const night = posters.get('lanterns');
  const coords = example ? `${example.lat.toFixed(2)}° N, ${example.lon.toFixed(2)}° E` : undefined;
  return (
    <section id={chapter.id} className="lp-hero" data-chapter={chapter.id} aria-labelledby={titleId}>
      <div className="lp-hero__inner">
        <p className="lp-kicker lp-hero__kicker">
          <span className="lp-hero__brush" aria-hidden="true">
            <Glyph char="居" pad={40} />
            <Glyph char="場" pad={40} />
            <Glyph char="所" pad={40} />
          </span>
          {chapter.kicker}
        </p>
        <h1 id={titleId} className="lp-hero__title">
          {chapter.title}
        </h1>
        <figure className="lp-hero__art">
          {day && night ? (
            <div className="lp-stills">
              <Still poster={day} eager className="lp-still lp-still--hiru" />
              <Still poster={night} eager className="lp-still lp-still--yoru" />
            </div>
          ) : (
            <CityArt />
          )}
          <figcaption className="lp-hero__caption">{LANDING_HERO_CAPTION}</figcaption>
        </figure>
        <p className="lp-hero__line">
          <Copy text={chapter.line} />
        </p>
        {chapter.body.map((p) => (
          <p key={p} className="lp-hero__body">
            <Copy text={p} />
          </p>
        ))}
        <div className="lp-actions lp-hero__actions">
          <a className="lp-cta" href={LANDING_INVITATION.cta.href}>
            <span>{LANDING_INVITATION.cta.label}</span>
            <span className="lp-cta__arrow" aria-hidden="true">
              →
            </span>
          </a>
          <a className="lp-specimen" href={LANDING_EXAMPLE.link.href}>
            <span className="lp-specimen__label">{LANDING_EXAMPLE.link.label}</span>
            <span className="lp-specimen__meta">IIIT Hyderabad{coords ? ` · ${coords}` : ''}</span>
          </a>
        </div>
        {anyPreview ? <p className="lp-hero__note">{LANDING_PREVIEW_NOTE}</p> : null}
      </div>
    </section>
  );
}

function Audiences() {
  return (
    <section id="for" className="lp-for" aria-labelledby="for-title">
      <div className="lp-for__head">
        <h2 id="for-title" className="lp-for__title">
          {LANDING_AUDIENCE_INTRO.title}
        </h2>
        <p className="lp-for__line">{LANDING_AUDIENCE_INTRO.line}</p>
      </div>
      <ul className="lp-for__list">
        {LANDING_AUDIENCES.map((a) => (
          <li key={a.id} className="lp-for__item" data-audience={a.id}>
            <h3 className="lp-for__who">{a.who}</h3>
            <p className="lp-for__need">{a.need}</p>
            <a className="lp-link" href={a.link.href}>
              {a.link.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Vindhya Bhavan, in one page": three figures and three futures from the studio's results. */
function Example({ data, poster }: { data: ExampleData; poster?: Poster | undefined }) {
  const ex = LANDING_EXAMPLE;
  const n = (v: string) => (
    <span className="lp-num" data-preview={data.preview ? '' : undefined}>
      {v}
    </span>
  );
  return (
    <section
      id="example"
      className="lp-ex"
      aria-labelledby="example-title"
      data-preview={data.preview ? '' : undefined}
    >
      <div className="lp-ex__head">
        <p className="lp-ex__meta">
          IIIT Hyderabad · {data.lat.toFixed(2)}° N, {data.lon.toFixed(2)}° E
          {data.preview ? <PreviewMark /> : null}
        </p>
        <h2 id="example-title" className="lp-ex__title">
          {ex.title}
        </h2>
        <p className="lp-ex__line">{ex.line}</p>
        {data.preview ? <p className="lp-ex__note">{ex.previewNote}</p> : null}
      </div>
      {poster ? (
        <figure className="lp-ex__still">
          <Still poster={poster} />
        </figure>
      ) : null}
      <dl className="lp-ex__figures">
        <div className="lp-fig">
          <dt>{ex.euiLabel}</dt>
          <dd>
            {n(data.eui)}
            {data.euiTarget ? (
              <span className="lp-fig__context">
                {ex.euiTarget}: {data.euiTarget}
              </span>
            ) : null}
          </dd>
        </div>
        {data.bill ? (
          <div className="lp-fig">
            <dt>{ex.billLabel}</dt>
            <dd>{n(data.bill)}</dd>
          </div>
        ) : null}
        {data.rating ? (
          <div className="lp-fig">
            <dt>{ex.ratingLabel}</dt>
            <dd>
              {n(data.rating.level)}
              <span className="lp-fig__context">{data.rating.context}</span>
            </dd>
          </div>
        ) : null}
      </dl>
      {data.futures.length > 0 ? (
        <div className="lp-ex__futures">
          <h3 className="lp-ex__sub">{ex.futuresTitle}</h3>
          <p className="lp-ex__subline">{ex.futuresLine}</p>
          <ol className="lp-futures">
            {data.futures.map((f) => (
              <li key={f.role} className="lp-future" data-role={f.role}>
                <h4 className="lp-future__name">{f.name}</h4>
                <p className="lp-future__changes">
                  {f.sameAs ? `The same bundle as ${f.sameAs}.` : f.changes}
                </p>
                <dl className="lp-future__nums">
                  <div>
                    <dt>Upfront</dt>
                    <dd>{n(f.upfront)}</dd>
                  </div>
                  <div>
                    <dt>Bill</dt>
                    <dd>{n(f.bill)}</dd>
                  </div>
                  {f.saves ? (
                    <div>
                      <dt>Saves</dt>
                      <dd>{n(f.saves)}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <a className="lp-link lp-ex__link" href={ex.link.href}>
        {ex.link.label}
      </a>
    </section>
  );
}

function Types() {
  const types = Object.values(BUILDING_TYPE_COPY);
  return (
    <ul className="lp-types" aria-label="Kinds of building">
      {types.map((t) => (
        <li key={t.id} className="lp-types__item">
          <Mon id={`type-${t.id as BuildingTypeId}`} size={24} />
          <span className="lp-types__label">{t.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Chapter({
  chapter,
  index,
  preview,
  poster,
}: {
  chapter: LandingChapter;
  index: number;
  preview: boolean;
  poster?: Poster | undefined;
}) {
  const titleId = `${chapter.id}-title`;
  return (
    <section
      id={chapter.id}
      className="lp-ch"
      data-chapter={chapter.id}
      data-side={index % 2 === 0 ? 'start' : 'end'}
      data-preview={preview ? '' : undefined}
      aria-labelledby={titleId}
    >
      <div className="lp-ch__text">
        <p className="lp-kicker lp-ch__kicker">
          <span className="lp-kicker__n">{pad2(index + 1)}</span>
          <span className="lp-kicker__rule" aria-hidden="true" />
          {chapter.kicker}
        </p>
        <h2 id={titleId} className="lp-ch__title">
          {chapter.title}
        </h2>
        <p className="lp-ch__line">
          <Copy text={chapter.line} />
        </p>
        {chapter.body.map((p) => (
          <p key={p} className="lp-ch__body">
            <Copy text={p} />
          </p>
        ))}
        {chapter.types ? <Types /> : null}
        {chapter.more?.length ? (
          <details className="lp-more">
            <summary>More detail</summary>
            {chapter.more.map((p) => (
              <p key={p}>
                <Copy text={p} />
              </p>
            ))}
          </details>
        ) : null}
        {chapter.link ? (
          <a className="lp-link lp-ch__link" href={chapter.link.href}>
            {chapter.link.label}
          </a>
        ) : null}
      </div>
      <figure className={poster ? 'lp-ch__still' : 'lp-ch__still lp-ch__still--drawn'}>
        {poster ? (
          <Still poster={poster} />
        ) : (
          <div className="lp-panel" aria-hidden="true">
            <Glyph char={chapter.glyph} pad={60} className="lp-panel__glyph" />
            <span className="lp-panel__gloss">{chapter.glyphMeaning}</span>
          </div>
        )}
        {preview ? <PreviewMark corner /> : null}
      </figure>
    </section>
  );
}

function Invitation({ poster }: { poster?: Poster | undefined }) {
  const inv = LANDING_INVITATION;
  return (
    <section
      id="invitation"
      className="lp-invite"
      data-still={poster ? '' : undefined}
      aria-labelledby="invitation-title"
    >
      {poster ? <Still poster={poster} className="lp-invite__still" /> : null}
      <div className="lp-invite__inner">
        <h2 id="invitation-title" className="lp-invite__title">
          {inv.title}
        </h2>
        <p className="lp-invite__line">
          <Copy text={inv.line} />
        </p>
        <div className="lp-actions lp-actions--centre">
          <a className="lp-step" href={inv.cta.href}>
            {inv.cta.label}
          </a>
          <a className="lp-link" href={inv.sample.href}>
            {inv.sample.label}
          </a>
        </div>
      </div>
    </section>
  );
}

function Words({ ids }: { ids: readonly string[] }) {
  if (ids.length === 0) return null;
  return (
    <section id="words" className="lp-words" aria-labelledby="words-title">
      <details className="lp-words__fold" data-words>
        <summary>
          <h2 id="words-title" className="lp-words__title">
            Words we use
          </h2>
        </summary>
        <dl className="lp-words__list">
          {ids.map((id) => (
            <div key={id} id={`g-${id}`} className="lp-words__item">
              <dt>{GLOSSARY[id]!.term}</dt>
              <dd>{GLOSSARY[id]!.plain}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

export interface LandingPageProps {
  /** Chapters to show, already filtered and ordered (`visibleChapters`). */
  chapters: readonly LandingChapter[];
  /** Ids of chapters whose results are Preview for now. */
  preview?: ReadonlySet<string>;
  /** Stills from the city scene that exist, by id. */
  posters?: ReadonlyMap<string, Poster> | undefined;
  /** The worked example's figures, when the studio's results are there. */
  example?: ExampleData | undefined;
}

export function LandingPage({
  chapters,
  preview = new Set(),
  posters = new Map(),
  example,
}: LandingPageProps) {
  const [first, ...rest] = chapters;
  const hero = first?.id === 'hero' ? first : undefined;
  const others = hero ? rest : chapters;
  const anyPreview = others.some((c) => preview.has(c.id)) || example?.preview === true;
  const posterOf = (c: LandingChapter): Poster | undefined =>
    c.poster
      ? { id: c.id, theme: 'hiru', alt: c.poster.alt, large: c.poster.src, small: c.poster.src }
      : c.posterId
        ? posters.get(c.posterId)
        : undefined;
  return (
    <>
      <a className="lp-skip" href="#story">
        Skip to the story
      </a>
      <header className="lp-bar">
        <a className="lp-bar__name" href="/">
          Ibasho
        </a>
        <nav className="lp-bar__nav" aria-label="Site">
          <a className="lp-bar__link" href="#for">
            Who it is for
          </a>
          <a className="lp-bar__link lp-bar__link--studio" href={LANDING_INVITATION.cta.href}>
            Studio
          </a>
          <button type="button" className="lp-bar__lantern" data-lantern hidden aria-pressed="false">
            Night
          </button>
        </nav>
      </header>
      <main data-andon="landing" id="story">
        {hero ? <Hero chapter={hero} posters={posters} anyPreview={anyPreview} example={example} /> : null}
        <Audiences />
        {example ? <Example data={example} poster={posters.get(LANDING_EXAMPLE.posterId)} /> : null}
        {others.map((c, i) => (
          <Chapter key={c.id} chapter={c} index={i} preview={preview.has(c.id)} poster={posterOf(c)} />
        ))}
        <Invitation poster={posters.get(LANDING_INVITATION.posterId)} />
        <Words ids={termsUsed(chapters, anyPreview)} />
      </main>
      <footer className="lp-foot">
        <p>{LANDING_FOOTER}</p>
        <p className="lp-foot__name">{LANDING_TAGLINE}</p>
      </footer>
    </>
  );
}
