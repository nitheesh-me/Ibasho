/**
 * Every piece of user-facing copy in this package, with a path, so tests (and WP-10's voice and
 * glossary audits) can check all of it at once. Owner: WP-09.
 */

import { BUILDING_TYPE_COPY } from './building-types.ts';
import { GLOSSARY } from './glossary.ts';
import {
  LANDING_AUDIENCE_INTRO,
  LANDING_AUDIENCES,
  LANDING_CHAPTERS,
  LANDING_EXAMPLE,
  LANDING_FOOTER,
  LANDING_HERO_CAPTION,
  LANDING_INVITATION,
  LANDING_META,
  LANDING_PREVIEW_NOTE,
  LANDING_TAGLINE,
} from './landing/chapters.ts';
import { ACCREDITATIONS } from './measures/accreditations.ts';
import { ASSESSMENT_GUIDANCE } from './measures/assessments.ts';
import { MEASURE_GUIDANCE } from './measures/guidance.ts';
import { PROOFS_INTRO } from './proofs.ts';
import {
  APPLICABILITY_COPY,
  FUTURE_ROLE_COPY,
  GAP_COPY,
  GOAL_PRESET_COPY,
  OBJECTIVE_COPY,
  OP_COPY,
  PRECHECK_WORD,
  RATING_COPY,
  STAGE_COPY,
  STAGE_STATUS_WORD,
  STUDIO_COPY,
  TIER_WORD,
} from './studio.ts';
import type { AssessmentGuidance, MeasureGuidance } from './types.ts';
import { VOICE } from './voice.ts';

export interface CopyItem {
  /** Dotted path, e.g. `measures.loft.next.questions.0`. */
  path: string;
  text: string;
}

function guidanceCopy(prefix: string, g: MeasureGuidance | AssessmentGuidance): CopyItem[] {
  return [
    { path: `${prefix}.name`, text: g.name },
    { path: `${prefix}.what`, text: g.what },
    ...g.disruption.rooms.map((text, i) => ({ path: `${prefix}.disruption.rooms.${i}`, text })),
    { path: `${prefix}.disruption.note`, text: g.disruption.note },
    { path: `${prefix}.next.installer`, text: g.next.installer },
    { path: `${prefix}.next.why`, text: g.next.why },
    ...g.next.questions.map((text, i) => ({ path: `${prefix}.next.questions.${i}`, text })),
  ];
}

/** Flatten a record of strings or string-valued objects into copy items. */
function flat(prefix: string, rec: object): CopyItem[] {
  return Object.entries(rec).flatMap(([k, v]): CopyItem[] => {
    if (typeof v === 'string') return [{ path: `${prefix}.${k}`, text: v }];
    if (Array.isArray(v)) return v.map((text, i) => ({ path: `${prefix}.${k}.${i}`, text: String(text) }));
    if (v && typeof v === 'object') return flat(`${prefix}.${k}`, v);
    return [];
  });
}

/** v3 studio microcopy and building type copy. */
function studioCopy(): CopyItem[] {
  return [
    ...flat('studio.stage', STAGE_COPY),
    ...flat('studio.status', STAGE_STATUS_WORD),
    ...flat('studio.tier', TIER_WORD),
    ...flat('studio.applicability', APPLICABILITY_COPY),
    ...flat('studio.precheck', PRECHECK_WORD),
    ...flat('studio.gap', GAP_COPY),
    ...flat('studio.rating', RATING_COPY),
    ...flat('studio.objective', OBJECTIVE_COPY),
    ...flat('studio.goal', GOAL_PRESET_COPY),
    ...flat('studio', STUDIO_COPY),
    ...flat('studio.future', FUTURE_ROLE_COPY),
    ...flat('studio.op', OP_COPY),
    ...Object.values(BUILDING_TYPE_COPY).flatMap((t) =>
      flat(`types.${t.id}`, {
        label: t.label,
        one: t.one,
        plural: t.plural,
        blurb: t.blurb,
        people: t.people,
        watch: t.watch,
        usualGoals: t.usualGoals,
      }),
    ),
  ];
}

/** All copy the product shows, excluding the voice guide's "don't" examples. */
export function collectCopy(): CopyItem[] {
  const out: CopyItem[] = [];
  for (const [id, g] of Object.entries(MEASURE_GUIDANCE)) out.push(...guidanceCopy(`measures.${id}`, g));
  for (const [id, g] of Object.entries(ASSESSMENT_GUIDANCE))
    out.push(...guidanceCopy(`assessments.${id}`, g));
  for (const [id, a] of Object.entries(ACCREDITATIONS)) {
    out.push(
      { path: `accreditations.${id}.name`, text: a.name },
      { path: `accreditations.${id}.plain`, text: a.plain },
    );
  }
  for (const [id, e] of Object.entries(GLOSSARY)) {
    out.push({ path: `glossary.${id}.term`, text: e.term }, { path: `glossary.${id}.plain`, text: e.plain });
    if (e.more) out.push({ path: `glossary.${id}.more`, text: e.more });
  }
  for (const c of LANDING_CHAPTERS) {
    const p = `landing.${c.id}`;
    out.push(
      { path: `${p}.kicker`, text: c.kicker },
      { path: `${p}.title`, text: c.title },
      { path: `${p}.line`, text: c.line },
      { path: `${p}.glyphMeaning`, text: c.glyphMeaning },
      ...c.body.map((text, i) => ({ path: `${p}.body.${i}`, text })),
    );
    if (c.poster) out.push({ path: `${p}.poster.alt`, text: c.poster.alt });
    if (c.link) out.push({ path: `${p}.link`, text: c.link.label });
    for (const [i, text] of (c.more ?? []).entries()) out.push({ path: `${p}.more.${i}`, text });
  }
  out.push(
    { path: 'landing.audience.title', text: LANDING_AUDIENCE_INTRO.title },
    { path: 'landing.audience.line', text: LANDING_AUDIENCE_INTRO.line },
    { path: 'landing.footer', text: LANDING_FOOTER },
    { path: 'landing.hero.caption', text: LANDING_HERO_CAPTION },
    { path: 'landing.tagline', text: LANDING_TAGLINE },
    { path: 'landing.previewNote', text: LANDING_PREVIEW_NOTE },
    ...flat('landing.example', { ...LANDING_EXAMPLE, posterId: undefined, link: LANDING_EXAMPLE.link.label }),
  );
  for (const a of LANDING_AUDIENCES) {
    out.push(
      { path: `landing.audience.${a.id}.who`, text: a.who },
      { path: `landing.audience.${a.id}.need`, text: a.need },
      { path: `landing.audience.${a.id}.link`, text: a.link.label },
    );
  }
  out.push(
    { path: 'landing.invitation.title', text: LANDING_INVITATION.title },
    { path: 'landing.invitation.line', text: LANDING_INVITATION.line },
    { path: 'landing.invitation.cta', text: LANDING_INVITATION.cta.label },
    { path: 'landing.invitation.sample', text: LANDING_INVITATION.sample.label },
    { path: 'landing.meta.title', text: LANDING_META.title },
    { path: 'landing.meta.description', text: LANDING_META.description },
  );
  const pr = PROOFS_INTRO;
  out.push({ path: 'proofs.title', text: pr.title }, { path: 'proofs.lede', text: pr.lede });
  for (const [i, text] of pr.paragraphs.entries()) out.push({ path: `proofs.paragraphs.${i}`, text });
  for (const m of pr.marks) {
    out.push(
      { path: `proofs.marks.${m.seal}.name`, text: m.name },
      { path: `proofs.marks.${m.seal}.means`, text: m.means },
      { path: `proofs.marks.${m.seal}.notProved`, text: m.notProved },
    );
  }
  for (const [k, text] of Object.entries(pr.groups)) out.push({ path: `proofs.groups.${k}`, text });
  out.push({ path: 'proofs.boundary.title', text: pr.boundary.title });
  for (const [i, text] of pr.boundary.items.entries()) out.push({ path: `proofs.boundary.items.${i}`, text });
  out.push(...studioCopy());
  out.push({ path: 'voice.persona', text: VOICE.persona });
  for (const [i, p] of VOICE.principles.entries()) {
    out.push(
      { path: `voice.principles.${i}.title`, text: p.title },
      { path: `voice.principles.${i}`, text: p.body },
    );
  }
  for (const w of VOICE.proofWords) out.push({ path: `voice.proofWords.${w.word}`, text: w.use });
  for (const [i, p] of VOICE.pairs.entries()) out.push({ path: `voice.pairs.${i}.do`, text: p.do });
  return out;
}
