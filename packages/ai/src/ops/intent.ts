/**
 * Offline intent parser (AM 6.2, SPEC 5.6, E3). A small grammar over measure synonyms, verbs and
 * parameters that turns a what-if sentence into `ScenarioOp[]` with no model at all. It covers the
 * common cases; LLM planners add the long tail. Its output goes through the OpValidator like any
 * other plan.
 *
 * Conventions: `addMeasure.measureId` is the measure id; a specific size goes in `params.option`
 * (`{ measureId: 'pv', params: { option: 'pv-4kwp' } }`). Picks are named by their keys
 * (`leastUpfront`, `bestReturn`, `lowestRunningCarbon`) in `compare`.
 */
import type { OpPlan, ScenarioOp } from '@ibasho/core';
import { MEASURE_CATALOGUE, SYNONYMS } from '../measures.ts';

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

/** Replace spelled-out numbers ("fifteen thousand", "twenty one") with digits. */
function digitise(s: string): string {
  const words = Object.keys(UNITS).join('|');
  const re = new RegExp(`\\b((?:${words})(?:[ -](?:${words}))?)(?:\\s+(hundred|thousand))?\\b`, 'gi');
  return s.replace(re, (_m, num: string, scale?: string) => {
    const parts = num.toLowerCase().split(/[ -]/);
    let n = parts.reduce((a, p) => a + (UNITS[p] ?? 0), 0);
    if (scale?.toLowerCase() === 'hundred') n *= 100;
    if (scale?.toLowerCase() === 'thousand') n *= 1000;
    return String(n);
  });
}

/** Parse "£15,000", "15k", "8 grand", "12.5k" into pounds. */
function money(s: string): number | undefined {
  const m = /£?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|grand|thousand|K)?\b/.exec(s);
  if (!m) return undefined;
  const base = Number((m[1] ?? '').replace(/,/g, ''));
  if (!Number.isFinite(base)) return undefined;
  return m[2] ? base * 1000 : base;
}

interface Hit {
  measureId: string;
  option?: string;
  index: number;
  end: number;
}

const OPTION_PATTERNS: readonly { re: RegExp; measureId: string; option: string }[] = [
  { re: /\b300\s?mm\b/i, measureId: 'loft', option: 'loft-300' },
  { re: /\b270\s?mm\b/i, measureId: 'loft', option: 'loft-270' },
  { re: /\b2\s?kw(?:p)?\b/i, measureId: 'pv', option: 'pv-2kwp' },
  { re: /\b3\s?kw(?:p)?\b/i, measureId: 'pv', option: 'pv-3kwp' },
  { re: /\b4\s?kw(?:p)?\b/i, measureId: 'pv', option: 'pv-4kwp' },
  { re: /\b5\s?kwh\b/i, measureId: 'battery', option: 'battery-5kwh' },
  { re: /\b10\s?kwh\b/i, measureId: 'battery', option: 'battery-10kwh' },
  { re: /\b(?:bigger|larger|new|upsized?) radiators\b|\bradiators? plus\b/i, measureId: 'ashp', option: 'heat-ashp-radiators-plus' },
];

const wordRe = (phrase: string) =>
  new RegExp(`(?<![\\w-])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}s?(?![\\w-])`, 'i');

/** Measures named in a clause, in order of appearance (longest synonym wins). */
function findMeasures(clause: string): Hit[] {
  const hits: Hit[] = [];
  let masked = clause;
  for (const p of OPTION_PATTERNS) {
    const m = p.re.exec(masked);
    if (!m) continue;
    hits.push({ measureId: p.measureId, option: p.option, index: m.index, end: m.index + m[0].length });
    masked = masked.slice(0, m.index) + ' '.repeat(m[0].length) + masked.slice(m.index + m[0].length);
  }
  for (const { phrase, measureId } of SYNONYMS) {
    const re = wordRe(phrase);
    let m = re.exec(masked);
    while (m) {
      const idx = m.index;
      const near = (h: Hit) => h.measureId === measureId && h.option !== undefined && (idx >= h.end ? idx - h.end <= 12 : h.index - (idx + m![0].length) <= 12);
      const sameMeasureNear = hits.some(near);
      if (!sameMeasureNear && !hits.some((h) => h.measureId === measureId && !h.option)) {
        hits.push({ measureId, index: idx, end: idx + m[0].length });
      } else if (sameMeasureNear) {
        const h = hits.find(near);
        if (h && idx >= h.end) h.end = idx + m[0].length;
      }
      masked = masked.slice(0, idx) + ' '.repeat(m[0].length) + masked.slice(idx + m[0].length);
      m = re.exec(masked);
    }
  }
  // An option pattern with no measure word nearby still names the measure ("a 4kWp array").
  return hits.sort((a, b) => a.index - b.index);
}

type Verb = 'add' | 'remove' | 'reject' | 'snooze';

const REJECT = /\b(?:never|rule out|ruled out|not interested in|don't want|do not want|won't (?:do|have|get|consider)|will not|no way|hate|not for me|isn't for (?:me|us)|is not for (?:me|us)|forget about|refuse|no to|we'?re not doing|definitely not)\b/i;
const SNOOZE = /\b(?:not (?:now|yet|this year)|for now|maybe later|later on|next year|in a few years|park|hold off|snooze|not right now)\b/i;
const REMOVE = /\b(?:without|drop|remove|skip|take out|leave out|minus|no|instead of|rather than|keep (?:the|my|our) (?:gas )?boiler|keep the gas|exclude|lose|don't|do not|not)\b/i;
const ADD = /\b(?:add|adding|with|what if|try|do|get|install|fit|put in|plus|include|also|go for|consider|how about|throw in|swap|switch to|replace|upgrade|just)\b/i;

function verbBefore(raw: string): Verb | null {
  const text = raw.replace(/\b(?:don't|do not|dont) (?:do|get|add|install|fit|bother with|go for)\b/gi, 'skip');
  const spans = (re: RegExp) => {
    const out: [number, number][] = [];
    const g = new RegExp(re.source, 'gi');
    for (let m = g.exec(text); m; m = g.exec(text)) out.push([m.index, m.index + m[0].length]);
    return out;
  };
  const rej = spans(REJECT);
  const inside = (x: [number, number]) => rej.some(([a, b]) => x[0] >= a && x[0] < b);
  const last = (xs: [number, number][]) => xs.reduce((acc, x) => (x[0] > acc ? x[0] : acc), -1);
  const r = last(rej);
  const rm = last(spans(REMOVE).filter((x) => !inside(x)));
  const a = last(spans(ADD).filter((x) => !inside(x)));
  if (r < 0 && rm < 0 && a < 0) return null;
  if (r >= rm && r >= a) return 'reject';
  if (rm >= a) return 'remove';
  return 'add';
}

interface Placed {
  op: ScenarioOp;
  at: number;
}

const SWAP = /\b(?:swap|replace|trade|change)\b.*?\b(for|with|to)\b/i;

function measureOps(clause: string, carry: Verb): { ops: Placed[]; verb: Verb } {
  const hits = findMeasures(clause);
  const ops: Placed[] = [];
  let verb = carry;
  let from = 0;
  const snooze = SNOOZE.test(clause);
  const strongNo = /\bno\b[^,.]*\bever\b|\bnever\b/i.test(clause);
  const swap = SWAP.exec(clause);
  const swapAt = swap ? swap.index + swap[0].length - (swap[1]?.length ?? 0) : -1;
  for (const h of hits) {
    const explicit = verbBefore(clause.slice(from, h.index));
    from = h.end;
    if (explicit) verb = explicit;
    let v: Verb = verb;
    if (swap && hits[0] && h.index < swapAt && hits.some((x) => x.index > swapAt)) v = 'remove';
    else if (swap && h.index > swapAt) v = 'add';
    else if (REJECT.test(clause.slice(h.end)) && explicit !== 'add' && explicit !== 'remove') v = 'reject';
    if (snooze && v !== 'add') v = 'snooze';
    else if (snooze && explicit === null) v = 'snooze';
    if (strongNo && v === 'remove') v = 'reject';
    const at = h.index;
    if (v === 'add') {
      ops.push({ at, op: h.option ? { op: 'addMeasure', measureId: h.measureId, params: { option: h.option } } : { op: 'addMeasure', measureId: h.measureId } });
    } else if (v === 'remove') {
      ops.push({ at, op: { op: 'removeMeasure', measureId: h.measureId } });
    } else {
      ops.push({ at, op: { op: 'rejectMeasure', measureId: h.measureId, scope: v === 'snooze' ? 'snooze' : 'never' } });
    }
    verb = v === 'reject' || v === 'snooze' ? 'add' : v;
  }
  // "Keep the boiler" means no heat pump.
  const keep = /\bkeep (?:the|my|our) (?:gas )?boiler\b/i.exec(clause);
  if (keep && !ops.some((o) => 'measureId' in o.op && o.op.measureId === 'ashp')) {
    ops.push({ at: keep.index, op: { op: 'removeMeasure', measureId: 'ashp' } });
  }
  return { ops, verb };
}

function paramOps(clause: string): Placed[] {
  const c = clause.toLowerCase();
  const out: Placed[] = [];
  const grab = (re: RegExp, path: string) => {
    const m = re.exec(c);
    if (!m) return false;
    out.push({ at: m.index, op: { op: 'setParam', path, value: Number(m[1]) } });
    return true;
  };
  const flow = grab(/\bflow (?:temp(?:erature)?)?[^.?!\d]{0,20}?(\d{2})/, 'heating.flowTempC');
  if (!flow && /\b(?:thermostat|set ?point|degrees?|°|warmer|cooler|temperature)\b/.test(c)) {
    grab(/\b(?:thermostat|set ?point|heating|house|home|rooms?|temperature)\b[^.?!\d]{0,30}?(\d{2}(?:\.\d)?)/, 'occupancy.setpointC');
  }
  grab(/\bdiscount(?: rate)?[^.?!\d]{0,20}?(\d+(?:\.\d+)?)/, 'finance.discountRatePct');
  grab(/\bgas (?:price|costs?|is|at|goes to|rises to|unit rate)[^.?!\d]{0,20}?(\d+(?:\.\d+)?)\s*p\b/, 'price.gasPence') ||
    grab(/\b(\d+(?:\.\d+)?)\s*p(?:ence)?(?: a| per)? (?:kwh|unit) (?:for|of) gas\b/, 'price.gasPence');
  grab(/\b(?:electricity|power)(?: price| costs?| is| at| goes to| rises to| unit rate)?[^.?!\d]{0,20}?(\d+(?:\.\d+)?)\s*p\b/, 'price.electricityPence') ||
    grab(/\b(\d+(?:\.\d+)?)\s*p(?:ence)?(?: a| per)? (?:kwh|unit) (?:for|of) (?:electricity|power)\b/, 'price.electricityPence');
  grab(/\bradiators?[^.?!\d]{0,30}?(\d(?:\.\d+)?)\s*(?:x|times)\b/, 'heating.radiatorOversize');
  return out;
}

const MONEY = String.raw`£?\s*\d[\d,]*(?:\.\d+)?\s*(?:k|grand|thousand)?`;

function budgetOps(clause: string): Placed[] {
  const lead = new RegExp(String.raw`\b(?:budget|spend|afford|up to|max(?:imum)?|cap|no more than|at most|limit)\b[^£\d]{0,25}(${MONEY})`, 'i').exec(clause);
  const trail = new RegExp(String.raw`(£\s*\d[\d,]*(?:\.\d+)?\s*(?:k|grand|thousand)?)\s*budget\b`, 'i').exec(clause);
  const m = lead ?? trail;
  if (!m) return [];
  const amount = m[1] ?? '';
  if (!/£|k\b|grand|thousand|pounds/i.test(amount + clause.slice(m.index + m[0].length, m.index + m[0].length + 8))) {
    if (/\b(?:kw|kwh|mm|years?|°|degrees?|percent|%)/i.test(clause)) return [];
  }
  const v = money(amount);
  return v === undefined ? [] : [{ at: m.index, op: { op: 'setBudget', capGBP: v } }];
}

function horizonOps(clause: string): Placed[] {
  if (/\bpay(?:s)? ?back\b/i.test(clause)) return [];
  const m =
    /\b(?:over|for|horizon(?: of)?|stay(?:ing)?(?: here)?(?: for)?|in the house for|live here for|next|within)\s+(?:about\s+|another\s+)?(\d{1,2})\s+years?\b/i.exec(clause) ??
    /\b(\d{1,2})[- ]year (?:horizon|view|plan)\b/i.exec(clause);
  return m ? [{ at: m.index, op: { op: 'setHorizon', years: Number(m[1]) } }] : [];
}

const TARIFFS: readonly { re: RegExp; fuel: 'electricity' | 'gas'; tariffId: string }[] = [
  { re: /\beconomy ?7\b|\be7\b/i, fuel: 'electricity', tariffId: 'economy-7' },
  { re: /\bagile\b/i, fuel: 'electricity', tariffId: 'octopus-agile' },
  { re: /\bcosy\b/i, fuel: 'electricity', tariffId: 'octopus-cosy' },
  { re: /\boctopus go\b|\bgo tariff\b/i, fuel: 'electricity', tariffId: 'octopus-go' },
  { re: /\bfixed (?:gas )?(?:tariff|deal)\b/i, fuel: 'gas', tariffId: 'fixed-12m' },
  { re: /\bprice cap\b|\bstandard variable\b/i, fuel: 'electricity', tariffId: 'price-cap' },
];

function tariffOps(clause: string): Placed[] {
  if (!/\b(?:tariff|switch|move|on|use|economy|agile|cosy|octopus|price cap|deal)\b/i.test(clause)) return [];
  for (const t of TARIFFS) {
    const m = t.re.exec(clause);
    if (m) return [{ at: m.index, op: { op: 'setTariff', fuel: t.fuel, tariffId: t.tariffId } }];
  }
  return [];
}

const PICK_WORDS: readonly { re: RegExp; id: string }[] = [
  { re: /\bleast upfront\b|\bcheapest\b/i, id: 'leastUpfront' },
  { re: /\bbest return\b|\bbest value\b/i, id: 'bestReturn' },
  { re: /\blowest (?:running )?carbon\b|\bgreenest\b/i, id: 'lowestRunningCarbon' },
];

function compareOps(text: string): ScenarioOp[] {
  if (!/\b(?:compare|versus|vs\.?|against|side by side|difference between)\b/i.test(text)) return [];
  const ids = PICK_WORDS.map((p) => ({ id: p.id, at: p.re.exec(text)?.index ?? -1 }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.id);
  return ids.length >= 2 ? [{ op: 'compare', scenarioIds: ids }] : [];
}

/** Split into clauses on punctuation and joining words, keeping the joiner with the next clause. */
function clauses(s: string): string[] {
  return s
    .split(/(?:[;,.!?]+(?!\d)\s*|\s+(?=(?:but|then|and then|also|instead|plus|while|whereas)\b))/i)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

export interface IntentResult extends OpPlan {
  /** True when the parser recognised nothing (hand over to an LLM planner, if any). */
  unparsed: boolean;
}

/** Parse a what-if utterance. Deterministic. */
export function parseIntent(utterance: string): IntentResult {
  const text = digitise(utterance.replace(/[\u2018\u2019]/g, "'"));
  const ops: ScenarioOp[] = [];
  const cmp = compareOps(text);
  if (cmp.length > 0) return { ops: cmp, rationale: '', unparsed: false };
  let verb: Verb = 'add';
  for (const c of clauses(text)) {
    const m = measureOps(c, verb);
    const placed = [...budgetOps(c), ...horizonOps(c), ...tariffOps(c), ...paramOps(c), ...m.ops];
    placed.sort((x, y) => x.at - y.at);
    ops.push(...placed.map((p) => p.op));
    verb = m.verb;
  }
  // Collapse duplicates: last instruction per measure wins; keep first position.
  const seen = new Map<string, number>();
  const out: ScenarioOp[] = [];
  for (const op of ops) {
    const key = 'measureId' in op ? `m:${op.measureId}` : op.op === 'setParam' ? `p:${op.path}` : `o:${op.op}`;
    const at = seen.get(key);
    if (at === undefined) {
      seen.set(key, out.length);
      out.push(op);
    } else out[at] = op;
  }
  return { ops: out, rationale: '', unparsed: out.length === 0 };
}

/** Every measure id the parser can name (for tests and the planner schema). */
export const PARSER_MEASURES: readonly string[] = MEASURE_CATALOGUE.map((m) => m.id);
