/**
 * The landing page, "Ibasho no kōjō" (SPEC 5.1 and 27, PLAN-V3, UX 16, SV 7). Owner: WP-09.
 *
 * Rendered to static HTML at build time (`prerender.tsx`), so every chapter reads with JavaScript
 * off (AC-L2) and first paint needs no script (AC-L1). The chapter list comes only from
 * `@ibasho/content` (AC-L3), already filtered by `requires` (I4). A chapter whose studio stages are
 * still Preview carries a Preview mark.
 *
 * Colour discipline (DESIGN_SYSTEM 1): gold only on the one hero action; no vermilion, because no
 * seal is pressed on this page; the hero is lit like a lantern (Yoru), the rest is washi (Hiru).
 */
import type { BuildingTypeId } from '@ibasho/core';
import {
  BUILDING_TYPE_COPY,
  definitionOf,
  GLOSSARY,
  LANDING_AUDIENCE_INTRO,
  LANDING_AUDIENCES,
  LANDING_FOOTER,
  LANDING_HERO_CAPTION,
  LANDING_INVITATION,
  LANDING_TAGLINE,
  type LandingChapter,
  markedTerms,
  segments,
  termOf,
} from '@ibasho/content';
import { Glyph, Mon } from '@ibasho/ui';
import type { ReactNode } from 'react';
import { CityArt } from './CityArt.tsx';

const ORDINAL = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven'];

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

/** Glossary ids marked anywhere in the given chapters, in first-use order. */
export function termsUsed(chapters: readonly LandingChapter[], preview = false): string[] {
  const seen = new Set<string>();
  for (const c of chapters) for (const t of [c.line, ...c.body].flatMap(markedTerms)) seen.add(t);
  for (const t of markedTerms(LANDING_INVITATION.line)) seen.add(t);
  if (preview) seen.add('preview');
  return [...seen].filter((id) => GLOSSARY[id]);
}

/** The Preview mark beside a chapter whose results are examples for now. */
function PreviewMark() {
  return (
    <a className="lp-preview" href="#g-preview" title={definitionOf('preview')}>
      <span aria-hidden="true" className="lp-preview__hatch" />
      Preview
    </a>
  );
}

function Mark({ chapter }: { chapter: LandingChapter }) {
  return (
    <div className="lp-mark" aria-hidden="true">
      <Glyph char={chapter.glyph} pad={60} className="lp-mark__glyph" />
      <span className="lp-mark__gloss">{chapter.glyphMeaning}</span>
    </div>
  );
}

function Hero({ chapter }: { chapter: LandingChapter }) {
  const titleId = `${chapter.id}-title`;
  return (
    <section
      id={chapter.id}
      className="lp-hero ib-washi"
      data-theme="yoru"
      data-chapter={chapter.id}
      aria-labelledby={titleId}
    >
      <div className="lp-hero__inner">
        <div className="lp-hero__text">
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
          <p className="lp-hero__line">
            <Copy text={chapter.line} />
          </p>
          {chapter.body.map((p) => (
            <p key={p} className="lp-hero__body">
              <Copy text={p} />
            </p>
          ))}
          <div className="lp-actions">
            <a className="lp-cta" href={LANDING_INVITATION.cta.href}>
              {LANDING_INVITATION.cta.label}
            </a>
            <a className="lp-quiet" href={LANDING_INVITATION.sample.href}>
              {LANDING_INVITATION.sample.label}
            </a>
          </div>
        </div>
        <figure className="lp-hero__art">
          <CityArt />
          <figcaption className="lp-hero__caption">{LANDING_HERO_CAPTION}</figcaption>
        </figure>
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
            <a className="lp-for__link" href={a.link.href}>
              {a.link.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Types() {
  const types = Object.values(BUILDING_TYPE_COPY);
  return (
    <ul className="lp-types" aria-label="Kinds of building">
      {types.map((t) => (
        <li key={t.id} className="lp-types__item">
          <Mon id={`type-${t.id as BuildingTypeId}`} size={32} />
          <span className="lp-types__label">{t.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Chapter({ chapter, index, preview }: { chapter: LandingChapter; index: number; preview: boolean }) {
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
      <Mark chapter={chapter} />
      <div className="lp-ch__text">
        <p className="lp-kicker">
          <span className="lp-kicker__n">{ORDINAL[index] ?? String(index + 1)}</span> {chapter.kicker}
          {preview ? <PreviewMark /> : null}
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
        {chapter.link ? (
          <a className="lp-ch__link" href={chapter.link.href}>
            {chapter.link.label}
          </a>
        ) : null}
      </div>
      {chapter.poster ? (
        <figure className="lp-ch__poster">
          <img src={chapter.poster.src} alt={chapter.poster.alt} loading="lazy" decoding="async" />
        </figure>
      ) : null}
    </section>
  );
}

function Invitation() {
  const inv = LANDING_INVITATION;
  return (
    <section id="invitation" className="lp-invite" aria-labelledby="invitation-title">
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
        <a className="lp-quiet" href={inv.sample.href}>
          {inv.sample.label}
        </a>
      </div>
    </section>
  );
}

function Words({ ids }: { ids: readonly string[] }) {
  if (ids.length === 0) return null;
  return (
    <section id="words" className="lp-words" aria-labelledby="words-title">
      <h2 id="words-title" className="lp-words__title">
        Words we use
      </h2>
      <dl className="lp-words__list">
        {ids.map((id) => (
          <div key={id} id={`g-${id}`} className="lp-words__item">
            <dt>{GLOSSARY[id]!.term}</dt>
            <dd>{GLOSSARY[id]!.plain}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export interface LandingPageProps {
  /** Chapters to show, already filtered and ordered (`visibleChapters`). */
  chapters: readonly LandingChapter[];
  /** Ids of chapters whose results are Preview for now. */
  preview?: ReadonlySet<string>;
}

export function LandingPage({ chapters, preview = new Set() }: LandingPageProps) {
  const [first, ...rest] = chapters;
  const hero = first?.id === 'hero' ? first : undefined;
  const others = hero ? rest : chapters;
  const anyPreview = others.some((c) => preview.has(c.id));
  return (
    <>
      <a className="lp-skip" href="#story">
        Skip to the story
      </a>
      <header className="lp-bar" data-theme="yoru">
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
      <main data-andon="landing" id="story" className="ib-washi">
        {hero ? <Hero chapter={hero} /> : null}
        <Audiences />
        {others.map((c, i) => (
          <Chapter key={c.id} chapter={c} index={i} preview={preview.has(c.id)} />
        ))}
        <Invitation />
        <Words ids={termsUsed(chapters, anyPreview)} />
      </main>
      <footer className="lp-foot">
        <p>{LANDING_FOOTER}</p>
        <p className="lp-foot__name">{LANDING_TAGLINE}</p>
      </footer>
    </>
  );
}
