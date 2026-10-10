/**
 * NarratorStrip (Engawa 縁側): the veranda between the house and the room (DESIGN_SYSTEM 4.3, 8;
 * SPEC 6 "Narrating", R10, R11; UX 14). Owner: WP-06.
 *
 * Sentences settle one by one in Shippori Mincho. Every number is a `Num` chip bound to evidence:
 * the narrator writes the connective words, code inserts the numbers. Sections that fell back to
 * the template narrator carry a "Plain narrator" marker. Narration never carries a seal (R11), so
 * the chips here carry no seal glyph, seal note or spoken seal; the evidence drawer still shows it.
 *
 * DOM: `section.ib-narrator[data-state]`, each sentence `.ib-narrator__s[data-origin]`.
 */
import type { EvidenceId, RenderedNarration } from '@ibasho/core';
import type { CSSProperties, ReactNode } from 'react';
import { Glyph } from '../glyphs/Glyph.tsx';
import type { BakedChar } from '../glyphs/list.ts';
import { Num, type NumProps } from '../num/Num.tsx';

export type NarratorPart =
  | string
  | { ev: EvidenceId; signed?: boolean; delta?: NumProps['delta']; as?: NumProps['as'] }
  /** A measure name (rendered as a quiet term, not a link). */
  | { measure: string; measureId?: string };

export interface NarratorSentence {
  key: string;
  parts: NarratorPart[];
  /** `template` marks a plain narrator fallback. Default `template`. */
  origin?: 'llm' | 'template';
}

export interface NarratorStripProps {
  sentences: NarratorSentence[];
  /** `narrating` shows the pencil while sentences are still being validated. */
  state?: 'narrating' | 'ready';
  /** The narrator in use, e.g. "Plain narrator", "Local model". Shown small at the foot. */
  narrator?: string;
  /** Decorative chapter kanji (aria-hidden), set vertically on the veranda post. */
  glyph?: BakedChar;
  /** Chapter or section title. */
  title?: ReactNode;
  /** Layout: a column beside the house (default) or a wide band. */
  layout?: 'column' | 'band';
  className?: string;
}

export function NarratorStrip({
  sentences,
  state = 'ready',
  narrator,
  glyph,
  title,
  layout = 'column',
  className,
}: NarratorStripProps) {
  const anyTemplate = sentences.some((s) => (s.origin ?? 'template') === 'template');
  const allTemplate = sentences.length > 0 && sentences.every((s) => (s.origin ?? 'template') === 'template');
  return (
    <section
      className={['ib-narrator', className].filter(Boolean).join(' ')}
      data-state={state}
      data-layout={layout}
      aria-label={typeof title === 'string' ? title : 'Narrator'}
      aria-busy={state === 'narrating' ? true : undefined}
    >
      {glyph ? (
        <span className="ib-narrator__post" aria-hidden="true">
          <Glyph char={glyph} className="ib-narrator__glyph" />
        </span>
      ) : null}
      <div className="ib-narrator__body">
        {title ? <h2 className="ib-narrator__title">{title}</h2> : null}
        <p className="ib-narrator__text" aria-live="polite">
          {sentences.map((s, i) => (
            <span
              key={s.key}
              className="ib-narrator__s"
              data-origin={s.origin ?? 'template'}
              style={{ '--i': i } as CSSProperties}
            >
              {s.parts.map((p, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional
                <Part key={j} part={p} />
              ))}{' '}
            </span>
          ))}
          {state === 'narrating' ? (
            <span className="ib-narrator__pencil" role="status">
              <span className="ib-sr">Writing</span>
            </span>
          ) : null}
        </p>
        {narrator || anyTemplate ? (
          <p className="ib-narrator__foot">
            {anyTemplate ? (
              <span className="ib-narrator__plain" data-plain-narrator="">
                {allTemplate ? 'Plain narrator' : 'Some lines by the plain narrator'}
              </span>
            ) : null}
            {narrator && narrator !== 'Plain narrator' ? <span>{narrator}</span> : null}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Part({ part }: { part: NarratorPart }) {
  if (typeof part === 'string') return <>{part}</>;
  if ('measure' in part) {
    return (
      <span className="ib-narrator__measure" data-measure={part.measureId}>
        {part.measure}
      </span>
    );
  }
  return (
    <Num
      ev={part.ev}
      plain
      {...(part.signed ? { signed: true } : {})}
      {...(part.delta ? { delta: part.delta } : {})}
      {...(part.as ? { as: part.as } : {})}
    />
  );
}

/**
 * Turn a validated `RenderedNarration` (WP-05) into sentences. Text nodes are split after `.`,
 * `?` or `!` followed by a space; numbers and measures stay inside their sentence.
 */
export function sentencesFromRendered(r: RenderedNarration): NarratorSentence[] {
  const out: NarratorSentence[] = [];
  for (const section of r.sections) {
    let parts: NarratorPart[] = [];
    const flush = () => {
      if (parts.some((p) => typeof p !== 'string' || p.trim() !== '')) {
        out.push({ key: `${section.key}.${out.length}`, parts, origin: section.origin });
      }
      parts = [];
    };
    for (const n of section.nodes) {
      if (n.t === 'num') parts.push({ ev: n.evidenceId as EvidenceId });
      else if (n.t === 'measure') parts.push({ measure: n.display, measureId: n.measureId });
      else if (n.t === 'fact') parts.push(n.display);
      else {
        const chunks = n.s.split(/(?<=[.?!])\s+/);
        chunks.forEach((c, i) => {
          if (c) parts.push(c);
          if (i < chunks.length - 1) flush();
        });
      }
    }
    flush();
  }
  return out;
}
