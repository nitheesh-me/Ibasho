/**
 * Template narrator (AM 4.3, SPEC 10): deterministic, instant, always on. It writes the same slotted
 * text an LLM would, so it passes the same validator. Variants are chosen by a seeded PRNG
 * (seed = bundle id, section, key), so a revisit reads the same and the output is byte-identical in
 * every engine (E4).
 */
import {
  type EvidenceBundle,
  type EvidenceItem,
  type NarrationDraft,
  type SectionKey,
  type TemplatePack,
  xoshiro128ss,
} from '@ibasho/core';
import type { RoleMap } from '../evidence/bundle.ts';
import { NUMBER_WORDS } from '../grounding/lexicon.ts';
import { activeRejections } from '../grounding/validate.ts';
import { measureOf } from '../measures.ts';
import { EN_GB } from './en-gb.ts';

export const PICKS = ['leastUpfront', 'bestReturn', 'lowestRunningCarbon'] as const;
export type PickKey = (typeof PICKS)[number];
export const PICK_NAMES: Record<PickKey, string> = {
  leastUpfront: 'Least upfront',
  bestReturn: 'Best return',
  lowestRunningCarbon: 'Lowest running carbon',
};

/** SPEC 5.4 chapters (code names). */
export const CHAPTERS = ['ie', 'kan', 'kokoromi', 'michi', 'ibasho'] as const;
export type ChapterCode = (typeof CHAPTERS)[number];

export type WhyNotReason =
  | { kind: 'rule'; status: 'needs-check' | 'blocked'; ruleId: string; ruleTitle: string }
  | { kind: 'memory' }
  | { kind: 'tenure' }
  | { kind: 'dominated' }
  | { kind: 'budget'; overByRole?: string }
  | { kind: 'not-applicable' };

/** Words the narrator may use beside the evidence. Text values must be digit free. */
export interface StoryContext {
  /** Plural noun phrase, e.g. "the solid brick walls". */
  topLossName?: string;
  /** Measure that moves the bill most (chapter 3). */
  leverMeasure?: string;
  picks?: Partial<Record<PickKey, { packageId: string; measures: string[] }>>;
  /** The future the owner chose (chapter 5). */
  chosen?: PickKey;
  nextStep?: string;
  packages?: Record<string, { measures: string[] }>;
  /** A full sentence explaining a model or pack change (welcome back). */
  diffReason?: string;
  whyNot?: { measureId: string; reason: WhyNotReason }[];
  /** True once the owner has entered bills (chapter 2). */
  billsGiven?: boolean;
}

export interface Story {
  bundle: EvidenceBundle;
  roles: RoleMap;
  context: StoryContext;
}

export type SectionRequest =
  | { section: 'overview' }
  | { section: 'chapter'; chapter: ChapterCode }
  | { section: 'package'; packageId: string }
  | { section: 'tradeoff'; a: PickKey; b: PickKey }
  | { section: 'answer'; question: string }
  | { section: 'welcome-back' }
  | { section: 'why-not' };

export class TemplateError extends Error {
  override name = 'TemplateError';
}

const PLACEHOLDER = /\{(e|m|ms|t):([^}|]+)(?:\|(abs|approx))?\}/g;
const NUMERIC_TEXT = new RegExp(
  `\\p{N}|[%\u2030\uFF05]|(?<![\\p{L}\\p{N}_])(?:${NUMBER_WORDS.join('|')})(?![\\p{L}\\p{N}_])`,
  'iu',
);

interface Writer {
  story: Story;
  pack: TemplatePack;
  seed: string;
  out: string[];
}

function item(story: Story, role: string): EvidenceItem | undefined {
  const id = story.roles[role];
  return id === undefined ? undefined : story.bundle.items.find((i) => i.id === id);
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Fill one template string. Returns null when a role or variable is missing or unsafe. */
function fill(w: Writer, tmpl: string, vars: Record<string, string | string[] | undefined>): string | null {
  let ok = true;
  const sub = (s: string) =>
    s.replace(/\$([a-zA-Z]+)/g, (_m, v: string) => {
      const x = vars[v];
      if (typeof x !== 'string') ok = false;
      return typeof x === 'string' ? x : '';
    });
  const text = tmpl.replace(PLACEHOLDER, (_m, kind: string, name: string, mod?: string) => {
    if (kind === 'e') {
      const id = w.story.roles[sub(name)];
      if (id === undefined) ok = false;
      return mod ? `[[e:${id}|${mod}]]` : `[[e:${id}]]`;
    }
    const v = vars[name];
    if (kind === 'm') {
      if (typeof v !== 'string' || !measureOf(v)) ok = false;
      return `[[m:${v}]]`;
    }
    if (kind === 'ms') {
      const list = Array.isArray(v) ? v : [];
      if (list.length === 0 || list.some((x) => !measureOf(x))) ok = false;
      return joinList(list.map((x) => `[[m:${x}]]`));
    }
    if (typeof v !== 'string' || v.trim() === '' || NUMERIC_TEXT.test(v)) ok = false;
    return typeof v === 'string' ? v : '';
  });
  if (!ok) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Pick a seeded variant of `key` and append it. Returns false when it could not be filled. */
function say(w: Writer, key: string, vars: Record<string, string | string[] | undefined> = {}): boolean {
  const variants = w.pack.templates[key];
  if (!variants || variants.length === 0)
    throw new TemplateError(`template pack ${w.pack.locale} has no key ${key}`);
  const rng = xoshiro128ss(`${w.seed}|${key}|${JSON.stringify(vars)}`);
  const start = rng.int(variants.length);
  for (let k = 0; k < variants.length; k++) {
    const text = fill(w, variants[(start + k) % variants.length]!, vars);
    if (text !== null) {
      w.out.push(text);
      return true;
    }
  }
  return false;
}

const has = (s: Story, role: string) => Object.hasOwn(s.roles, role);
const signOf = (s: Story, role: string) => item(s, role)?.sign;

function notRejected(s: Story, measures: readonly string[]): boolean {
  const rejected = activeRejections(s.bundle);
  return measures.every((m) => !rejected.has(measureOf(m)?.id ?? m));
}

function overview(w: Writer) {
  say(w, 'overview.score');
  say(w, 'overview.bill');
  say(w, 'overview.fuels');
  say(w, 'overview.carbon');
}

function chapter(w: Writer, c: ChapterCode) {
  const s = w.story;
  const ctx = s.context;
  switch (c) {
    case 'ie':
      say(w, 'chapter.ie.open');
      say(w, 'chapter.ie.top', { topLossName: ctx.topLossName });
      say(w, 'chapter.ie.year');
      return;
    case 'kan': {
      say(w, 'chapter.kan.open');
      const sign = signOf(s, 'calibration.shift');
      if (ctx.billsGiven && sign && has(s, 'calibration.after')) {
        say(w, `chapter.kan.${sign}`);
        if (sign !== 'neutral') say(w, 'chapter.kan.size');
      } else say(w, 'chapter.kan.nobills');
      return;
    }
    case 'kokoromi':
      say(w, 'chapter.kokoromi.open');
      if (ctx.leverMeasure && notRejected(s, [ctx.leverMeasure])) {
        say(w, 'chapter.kokoromi.lever', { leverMeasure: ctx.leverMeasure });
      }
      say(w, 'chapter.kokoromi.flow');
      return;
    case 'michi': {
      say(w, 'chapter.michi.open');
      for (const p of PICKS) {
        const pick = ctx.picks?.[p];
        if (!pick || !notRejected(s, pick.measures)) continue;
        say(w, `chapter.michi.${p}`, { p, pickMeasures: pick.measures });
      }
      const hidden = item(s, 'hidden.count');
      if (hidden && typeof hidden.value === 'number' && hidden.value > 0) {
        say(w, hidden.value === 1 ? 'chapter.michi.hidden.one' : 'chapter.michi.hidden.many');
      }
      const nc = item(s, 'needsCheck.count');
      if (nc && typeof nc.value === 'number' && nc.value > 0) say(w, 'chapter.michi.needsCheck');
      if (s.bundle.memory.preferences.budgetCapGBP === undefined) say(w, 'chapter.michi.budget');
      return;
    }
    case 'ibasho': {
      say(w, 'chapter.ibasho.open');
      const p = ctx.chosen;
      const pick = p ? ctx.picks?.[p] : undefined;
      if (p && pick && notRejected(s, pick.measures)) {
        say(w, 'chapter.ibasho.after', { p, chosenMeasures: pick.measures });
        say(w, 'chapter.ibasho.payback', { p });
      }
      if (ctx.nextStep) say(w, 'chapter.ibasho.next', { nextStep: ctx.nextStep });
      say(w, 'chapter.ibasho.seal');
      return;
    }
  }
}

function packageSection(w: Writer, packageId: string) {
  const s = w.story;
  const measures = s.context.packages?.[packageId]?.measures;
  const v = { p: packageId };
  if (measures && notRejected(s, measures)) say(w, 'package.what', { packageMeasures: measures });
  say(w, 'package.upfront', v);
  const ss = signOf(s, `pkg.${packageId}.saving`);
  if (ss === 'saving' || ss === 'increase') say(w, `package.saving.${ss}`, v);
  for (const fuel of ['gas', 'electricity'] as const) {
    const fs = signOf(s, `pkg.${packageId}.${fuel}`);
    if (fs === 'saving' || fs === 'increase') say(w, `package.${fuel}.${fs}`, v);
  }
  const cs = signOf(s, `pkg.${packageId}.carbon`);
  if (cs === 'saving' || cs === 'increase') say(w, `package.carbon.${cs}`, v);
  say(w, 'package.payback', v);
}

function tradeoff(w: Writer, a: PickKey, b: PickKey) {
  const s = w.story;
  const v = { a, b, nameA: PICK_NAMES[a], nameB: PICK_NAMES[b] };
  say(w, 'tradeoff.upfront', v);
  if (signOf(s, `pick.${a}.saving`) === 'saving' && signOf(s, `pick.${b}.saving`) === 'saving') {
    say(w, 'tradeoff.saving', v);
  }
  if (signOf(s, `pick.${a}.carbon`) === 'saving' && signOf(s, `pick.${b}.carbon`) === 'saving') {
    say(w, 'tradeoff.carbon', v);
  }
  const ashpIn = [a, b].some((p) => s.context.picks?.[p]?.measures.some((m) => measureOf(m)?.id === 'ashp'));
  const fuelShift = [a, b].some(
    (p) =>
      signOf(s, `pkg.${s.context.picks?.[p]?.packageId}.gas`) === 'saving' &&
      signOf(s, `pkg.${s.context.picks?.[p]?.packageId}.electricity`) === 'increase',
  );
  if (ashpIn && fuelShift && notRejected(s, ['ashp'])) say(w, 'tradeoff.fuel');
}

const STOP = new Set([
  'the',
  'a',
  'an',
  'of',
  'my',
  'our',
  'is',
  'it',
  'what',
  'how',
  'much',
  'will',
  'would',
  'do',
  'does',
  'i',
  'we',
  'to',
  'for',
  'and',
  'in',
  'on',
  'with',
  'be',
  'me',
  'your',
  'you',
]);
const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((x) => x.length > 1 && !STOP.has(x));

function answer(w: Writer, question: string) {
  const q = new Set(words(question));
  let best: EvidenceItem | undefined;
  let bestScore = 0;
  for (const it of w.story.bundle.items) {
    if (it.kind === 'rank') continue;
    const score = words(it.label).filter((x) => q.has(x)).length;
    if (score > bestScore) {
      best = it;
      bestScore = score;
    }
  }
  if (!best) {
    say(w, 'answer.none');
    return;
  }
  const role = Object.entries(w.story.roles).find(([, id]) => id === best.id)?.[0];
  if (!role) throw new TemplateError(`bundle item ${best.id} has no role`);
  if (!say(w, 'answer.found', { r: role, label: best.label })) say(w, 'answer.bare', { r: role });
}

function heatingSeason(createdAt: string): boolean {
  const month = Number(createdAt.slice(5, 7));
  return month >= 10 || month <= 4;
}

function welcome(w: Writer) {
  const s = w.story;
  const days = item(s, 'visit.daysSince');
  if (days && typeof days.value === 'number')
    say(w, days.value === 1 ? 'welcome.greet.one' : 'welcome.greet.many');
  else say(w, 'welcome.greet.none');
  say(w, heatingSeason(s.bundle.createdAt) ? 'welcome.season.heating' : 'welcome.season.summer');
  if (s.context.diffReason) say(w, 'welcome.diff', { diffReason: s.context.diffReason });
  say(w, 'welcome.plan');
  const rejected = [...activeRejections(s.bundle)].sort();
  const first = rejected.find((m) => measureOf(m));
  if (first) say(w, 'welcome.memory', { rejectedMeasure: first });
  if (s.context.nextStep) say(w, 'welcome.next', { nextStep: s.context.nextStep });
}

function whyNot(w: Writer) {
  const list = w.story.context.whyNot ?? [];
  if (list.length === 0) {
    say(w, 'whynot.none');
    return;
  }
  for (const { measureId, reason } of list) {
    const v = { measure: measureId };
    switch (reason.kind) {
      case 'rule':
        say(w, `whynot.rule.${reason.status}`, { ...v, ruleTitle: reason.ruleTitle });
        break;
      case 'memory':
        say(w, 'whynot.memory', v);
        break;
      case 'tenure':
        say(w, 'whynot.tenure', v);
        break;
      case 'dominated':
        say(w, 'whynot.dominated', v);
        break;
      case 'budget':
        if (!(reason.overByRole && say(w, 'whynot.budget.by', { ...v, r: reason.overByRole }))) {
          say(w, 'whynot.budget', v);
        }
        break;
      case 'not-applicable':
        say(w, 'whynot.na', v);
        break;
    }
  }
}

function sectionKey(r: SectionRequest): SectionKey {
  return r.section;
}

/** Narrate one section. */
export function narrateSection(
  story: Story,
  req: SectionRequest,
  pack: TemplatePack = EN_GB,
): { key: SectionKey; text: string } {
  const sub =
    req.section === 'chapter'
      ? `chapter:${req.chapter}`
      : req.section === 'package'
        ? `package:${req.packageId}`
        : req.section === 'tradeoff'
          ? `tradeoff:${req.a}:${req.b}`
          : req.section;
  const w: Writer = { story, pack, seed: `${story.bundle.bundleId}|${sub}`, out: [] };
  switch (req.section) {
    case 'overview':
      overview(w);
      break;
    case 'chapter':
      chapter(w, req.chapter);
      break;
    case 'package':
      packageSection(w, req.packageId);
      break;
    case 'tradeoff':
      tradeoff(w, req.a, req.b);
      break;
    case 'answer':
      answer(w, req.question);
      break;
    case 'welcome-back':
      welcome(w);
      break;
    case 'why-not':
      whyNot(w);
      break;
  }
  return { key: sectionKey(req), text: w.out.join(' ') };
}

/** Narrate several sections as a draft (keys must be distinct; chapters go one at a time). */
export function narrateTemplate(
  story: Story,
  reqs: readonly SectionRequest[],
  pack: TemplatePack = EN_GB,
): NarrationDraft {
  return { sections: reqs.map((r) => narrateSection(story, r, pack)) };
}
