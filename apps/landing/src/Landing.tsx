/**
 * The landing page, "Ibasho no kōjō" (SPEC 5.1, UX 16, SV 7). Owner: WP-09.
 *
 * Rendered to static HTML at build time (`prerender.tsx`), so every chapter reads with JavaScript
 * off (AC-L2) and first paint needs no script (AC-L1). The chapter list comes only from
 * `@ibasho/content` (AC-L3), already filtered by `requires` (I4).
 *
 * Colour discipline (DESIGN_SYSTEM 1): gold only on the one hero action; no vermilion, because no
 * seal is pressed on this page; the hero is lit like a lantern (Yoru), the rest is washi (Hiru).
 */
import {
  definitionOf,
  GLOSSARY,
  LANDING_INVITATION,
  type LandingChapter,
  markedTerms,
  segments,
  termOf,
} from '@ibasho/content';
import { Glyph } from '@ibasho/ui';
import type { ReactNode } from 'react';

const ORDINAL = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

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
export function termsUsed(chapters: readonly LandingChapter[]): string[] {
  const seen = new Set<string>();
  for (const c of chapters) for (const t of [c.line, ...c.body].flatMap(markedTerms)) seen.add(t);
  for (const t of markedTerms(LANDING_INVITATION.line)) seen.add(t);
  return [...seen].filter((id) => GLOSSARY[id]);
}

/** A paper lantern: timber frame, washi skin, a flame inside. Decorative. */
function Lantern() {
  return (
    <svg className="lp-lantern" viewBox="0 0 120 200" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="lp-flame" cx="50%" cy="58%" r="55%">
          <stop offset="0" stopColor="var(--glow)" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="var(--glow)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--glow)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="112" rx="58" ry="80" fill="url(#lp-flame)" />
      <rect x="26" y="36" width="68" height="132" fill="var(--paper-raised)" opacity="0.18" />
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M20 30h80M20 174h80" strokeWidth="3" />
        <path d="M26 30v144M94 30v144" strokeWidth="2.2" />
        <path d="M26 74h68M26 118h68M60 30v144" strokeWidth="0.9" opacity="0.7" />
        <path d="M34 174l-6 18M86 174l6 18M60 30V10M48 10h24" strokeWidth="2" />
      </g>
    </svg>
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
        <div className="lp-hero__art" aria-hidden="true">
          <Lantern />
          <div className="lp-hero__brush">
            <Glyph char="居" pad={40} />
            <Glyph char="場" pad={40} />
            <Glyph char="所" pad={40} />
          </div>
        </div>
        <div className="lp-hero__text">
          <p className="lp-kicker">
            {chapter.kicker}. <span className="lp-kicker__aside">{chapter.title}</span>
          </p>
          <h1 id={titleId} className="lp-hero__title">
            {chapter.line}
          </h1>
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
      </div>
    </section>
  );
}

function Chapter({ chapter, index }: { chapter: LandingChapter; index: number }) {
  const titleId = `${chapter.id}-title`;
  return (
    <section
      id={chapter.id}
      className="lp-ch"
      data-chapter={chapter.id}
      data-side={index % 2 === 0 ? 'start' : 'end'}
      aria-labelledby={titleId}
    >
      <Mark chapter={chapter} />
      <div className="lp-ch__text">
        <p className="lp-kicker">
          <span className="lp-kicker__n">{ORDINAL[index] ?? String(index + 1)}</span> {chapter.kicker}
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
}

export function LandingPage({ chapters }: LandingPageProps) {
  const [first, ...rest] = chapters;
  const hero = first?.id === 'hero' ? first : undefined;
  const others = hero ? rest : chapters;
  return (
    <>
      <a className="lp-skip" href="#story">
        Skip to the story
      </a>
      <header className="lp-bar" data-theme="yoru">
        <a className="lp-bar__name" href="/">
          Ibasho
        </a>
        <button type="button" className="lp-bar__lantern" data-lantern hidden aria-pressed="false">
          Night
        </button>
      </header>
      <main data-andon="landing" id="story" className="ib-washi">
        {hero ? <Hero chapter={hero} /> : null}
        {others.map((c, i) => (
          <Chapter key={c.id} chapter={c} index={i + (hero ? 1 : 0)} />
        ))}
        <Invitation />
        <Words ids={termsUsed(chapters)} />
      </main>
      <footer className="lp-foot">
        <p>Your home stays on your device. Prices and rules are dated where they appear.</p>
      </footer>
    </>
  );
}
