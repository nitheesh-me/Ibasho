/**
 * Memory domain (AM 7.1, SPEC 5.12, 5.13). Pure functions over the append-only event log; the store
 * (WP-08, Dexie) persists events and calls these to materialise views, so every implementation of
 * `MemoryRepo` behaves the same.
 *
 * Semantics:
 * - Events fold in log order (`at`, then `id`). The latest explicit owner action wins.
 * - Undo is a compensating `memoryEdited { eventId, payload: null }` that voids the target (an undo
 *   of an undo restores it). `memoryEdited` with a payload replaces the target's payload.
 * - Forget appends `memoryForgotten { selector }`: matching earlier events go to the compost (views
 *   skip them; restorable by undoing the forget). `purgeCompost` deletes them for real after 30 days,
 *   or at once on "empty now" (AC-M3).
 * - LLM-originated memory is only ever a `seedProposed` event (AC-M2). Accepting a seed applies
 *   what it proposes, as the owner.
 */
import type {
  ForgetSelector,
  MemoryDigest,
  MemoryEvent,
  MemoryEventType,
  NewMemoryEvent,
  Preferences,
  Seed,
  Tenure,
} from '@ibasho/core';
import { measureOf } from '../measures.ts';

export const COMPOST_DAYS = 30;
const DAY_MS = 86_400_000;

export class MemoryPolicyError extends Error {
  override name = 'MemoryPolicyError';
}

/** Write policy (AC-M2, AM 7.1): only seeds may come from an LLM. */
export function checkWritePolicy(e: NewMemoryEvent): void {
  if (e.actor === 'llm-proposal' && e.type !== 'seedProposed') {
    throw new MemoryPolicyError(`an LLM may only propose seeds, not ${e.type}`);
  }
  if (e.type === 'seedAccepted' && e.actor !== 'owner') {
    throw new MemoryPolicyError('only the owner accepts a seed');
  }
}

export function sortLog(events: readonly MemoryEvent[]): MemoryEvent[] {
  return [...events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const measureOfEvent = (e: MemoryEvent): string | undefined => {
  switch (e.type) {
    case 'measureRejected':
    case 'measureRestored':
    case 'measureCompleted':
      return e.payload.measureId;
    case 'opApplied':
      return 'measureId' in e.payload.op ? e.payload.op.measureId : undefined;
    case 'seedProposed': {
      const p = e.payload.proposes?.payload as { measureId?: unknown } | undefined;
      return typeof p?.measureId === 'string' ? p.measureId : undefined;
    }
    default:
      return undefined;
  }
};

/** Does a forget selector cover this event? */
export function selects(sel: ForgetSelector, e: MemoryEvent): boolean {
  switch (sel.kind) {
    case 'all':
      return true;
    case 'event':
      return e.id === sel.eventId;
    case 'type':
      return e.type === sel.type;
    case 'measure':
      return measureOfEvent(e) === sel.measureId;
  }
}

export interface Resolved {
  /** Events in effect, in log order, with edits applied. */
  live: MemoryEvent[];
  /** Ids in the compost, with the time they were forgotten. */
  compost: Map<string, string>;
  /** Ids voided by undo. */
  voided: Set<string>;
}

/**
 * Resolve undo, edits and forgets. Edits and voids apply to any earlier or later event; a forget
 * covers events logged before it. Iterates to a fixed point because voiding an edit or a forget
 * changes what is in effect.
 */
export function resolve(events: readonly MemoryEvent[]): Resolved {
  const log = sortLog(events);
  let voided = new Set<string>();
  for (let round = 0; round < 8; round++) {
    const next = new Set<string>();
    // An edit voids its target only if the edit itself is not voided. Later edits win.
    for (const e of log) {
      if (e.type !== 'memoryEdited' || voided.has(e.id)) continue;
      if (e.payload.payload === null) next.add(e.payload.eventId);
      else next.delete(e.payload.eventId);
    }
    if (next.size === voided.size && [...next].every((x) => voided.has(x))) break;
    voided = next;
  }
  const edits = new Map<string, unknown>();
  for (const e of log) {
    if (e.type === 'memoryEdited' && !voided.has(e.id) && e.payload.payload !== null) edits.set(e.payload.eventId, e.payload.payload);
  }
  const compost = new Map<string, string>();
  for (const f of log) {
    if (f.type !== 'memoryForgotten' || voided.has(f.id)) continue;
    for (const e of log) {
      if (e.at > f.at || (e.at === f.at && e.id >= f.id)) break;
      if (e.type === 'memoryForgotten' || e.type === 'memoryEdited') continue;
      if (selects(f.payload.selector, e) && !compost.has(e.id)) compost.set(e.id, f.at);
    }
  }
  const live: MemoryEvent[] = [];
  for (const e of log) {
    if (voided.has(e.id) || compost.has(e.id)) continue;
    if (e.type === 'memoryEdited' || e.type === 'memoryForgotten') continue;
    const edited = edits.get(e.id);
    live.push(edited === undefined ? e : ({ ...e, payload: edited } as MemoryEvent));
  }
  return { live, compost, voided };
}

const RIGHTS: Record<Tenure, Preferences['rights']> = {
  owner: { roof: 'yes', externalWalls: 'yes', windows: 'yes' },
  landlord: { roof: 'yes', externalWalls: 'yes', windows: 'yes' },
  tenant: { roof: 'ask', externalWalls: 'ask', windows: 'ask' },
  unknown: { roof: 'unknown', externalWalls: 'unknown', windows: 'unknown' },
};

export function emptyPreferences(): Preferences {
  return { tenure: 'unknown', rights: { ...RIGHTS.unknown }, rejected: {}, completed: {}, priorities: [] };
}

type Rejection = Preferences['rejected'][string];

/** Apply one in-effect event to preferences (owner semantics). */
function apply(p: Preferences, type: MemoryEventType, payload: unknown, at: string): void {
  switch (type) {
    case 'measureRejected': {
      const r = payload as { measureId: string; scope: 'never' | 'snooze'; until?: string; reason?: string };
      const rej: Rejection = { scope: r.scope, at };
      if (r.until !== undefined) rej.until = r.until;
      if (r.reason !== undefined) rej.reason = r.reason;
      p.rejected[r.measureId] = rej;
      return;
    }
    case 'measureRestored':
      delete p.rejected[(payload as { measureId: string }).measureId];
      return;
    case 'measureCompleted':
      p.completed[(payload as { measureId: string }).measureId] = { at };
      return;
    case 'budgetSet': {
      const cap = (payload as { capGBP: number | null }).capGBP;
      if (cap === null) delete p.budgetCapGBP;
      else p.budgetCapGBP = cap;
      return;
    }
    case 'tenureSet': {
      const t = (payload as { tenure: Tenure }).tenure;
      p.tenure = t;
      p.rights = { ...RIGHTS[t] };
      return;
    }
    case 'priorityRanked':
      p.priorities = [...new Set((payload as { priorities: Preferences['priorities'] }).priorities)];
      return;
    case 'opApplied': {
      const op = (payload as { op: { op: string; years?: number; capGBP?: number; measureId?: string; scope?: 'never' | 'snooze'; until?: string; reason?: string } }).op;
      if (op.op === 'setHorizon' && op.years !== undefined) p.horizonYears = op.years;
      if (op.op === 'setBudget' && op.capGBP !== undefined) p.budgetCapGBP = op.capGBP;
      if (op.op === 'rejectMeasure' && op.measureId && op.scope) {
        apply(p, 'measureRejected', { measureId: op.measureId, scope: op.scope, ...(op.until ? { until: op.until } : {}), ...(op.reason ? { reason: op.reason } : {}) }, at);
      }
      return;
    }
    default:
      return;
  }
}

/** Is a rejection in force at `now`? */
export function rejectionActive(r: Rejection, now: string): boolean {
  return r.scope === 'never' || (r.until !== undefined && now < r.until);
}

/** Materialised preferences at `now`. Expired snoozes are dropped. */
export function preferencesOf(events: readonly MemoryEvent[], now: string, resolved = resolve(events)): Preferences {
  const p = emptyPreferences();
  const seeds = new Map<string, { type: MemoryEventType; payload: unknown } | null>();
  for (const e of resolved.live) {
    if (e.type === 'seedProposed') {
      seeds.set(e.payload.seedId, e.payload.proposes);
      continue;
    }
    if (e.type === 'seedAccepted') {
      const prop = seeds.get(e.payload.seedId);
      if (prop && prop.type !== 'seedProposed' && prop.type !== 'seedAccepted') apply(p, prop.type, prop.payload, e.at);
      continue;
    }
    if (e.actor === 'llm-proposal') continue;
    apply(p, e.type, e.payload, e.at);
  }
  for (const [m, r] of Object.entries(p.rejected)) if (!rejectionActive(r, now)) delete p.rejected[m];
  return p;
}

/** Seeds and their status (Memory Garden tray). */
export function seedsOf(events: readonly MemoryEvent[], resolved = resolve(events)): Seed[] {
  const out = new Map<string, Seed>();
  for (const e of resolved.live) {
    if (e.type === 'seedProposed') {
      out.set(e.payload.seedId, { id: e.payload.seedId, homeId: e.homeId, text: e.payload.text, status: 'proposed', proposedAt: e.at });
    } else if (e.type === 'seedAccepted' || e.type === 'seedDismissed') {
      const s = out.get(e.payload.seedId);
      if (s && s.status === 'proposed') s.status = e.type === 'seedAccepted' ? 'accepted' : 'dismissed';
    }
  }
  return [...out.values()];
}

/** What narrators see (AM 7.1): preferences in full plus recent relevant events, newest first. */
export function digestOf(
  events: readonly MemoryEvent[],
  now: string,
  opts: { focus?: readonly string[]; hiddenByRejection?: number; limit?: number } = {},
): MemoryDigest {
  const resolved = resolve(events);
  const preferences = preferencesOf(events, now, resolved);
  const focus = opts.focus ? new Set(opts.focus) : undefined;
  const recent = resolved.live
    .filter((e) => e.actor !== 'llm-proposal' && e.type !== 'questionAsked')
    .filter((e) => {
      if (!focus) return true;
      const m = measureOfEvent(e);
      return m === undefined || focus.has(m);
    })
    .reverse()
    .slice(0, opts.limit ?? 10);
  return { preferences, recent, hiddenByRejection: opts.hiddenByRejection ?? 0 };
}

/** The memory part of an engine `SearchRequest` (ruled-out and completed measure ids at `now`). */
export function searchMemory(prefs: Preferences, now: string): { rejected: string[]; completed: string[] } {
  return {
    rejected: Object.entries(prefs.rejected)
      .filter(([, r]) => rejectionActive(r, now))
      .map(([m]) => m)
      .sort(),
    completed: Object.keys(prefs.completed).sort(),
  };
}

/**
 * The feasibility filter's memory clause (AM 7.2 `feasible`, Lean `rejected_never_offered`): a
 * package may be offered only if it holds no active rejection and no completed measure. Like the
 * engine's memory built-in (`packages/engine/src/search/run.ts`), an entry may name an option id or
 * the measure that owns it, so ruling out `loft` blocks `loft-300`.
 */
export function offerable(measures: readonly string[], mem: { rejected: readonly string[]; completed: readonly string[] }): boolean {
  const hit = (list: readonly string[], o: string) => list.includes(o) || list.includes(measureOf(o)?.id ?? o);
  return measures.every((m) => !hit(mem.rejected, m) && !hit(mem.completed, m));
}

/** Purge the compost: real deletion of events forgotten 30 or more days ago (or all, on "empty now"). */
export function purgeCompost(events: readonly MemoryEvent[], now: string, emptyNow = false): MemoryEvent[] {
  const { compost, voided } = resolve(events);
  const cutoff = new Date(Date.parse(now) - COMPOST_DAYS * DAY_MS).toISOString();
  const gone = new Set<string>();
  for (const [id, forgotAt] of compost) if (emptyNow || forgotAt <= cutoff) gone.add(id);
  // A forget whose every target is gone has done its job; it is deleted too (it names what was forgotten).
  const log = sortLog(events);
  for (const f of log) {
    if (f.type !== 'memoryForgotten' || voided.has(f.id)) continue;
    const targets = log.filter((e) => compost.get(e.id) !== undefined && selects(f.payload.selector, e) && e.at <= f.at);
    if (targets.every((t) => gone.has(t.id)) && (emptyNow || f.at <= cutoff)) gone.add(f.id);
  }
  // Edits that point at deleted events go too.
  for (const e of log) if (e.type === 'memoryEdited' && gone.has(e.payload.eventId)) gone.add(e.id);
  return log.filter((e) => !gone.has(e.id));
}

/** A visit is a run of events with gaps under six hours (welcome back, AM 7.1 chapters). */
export function visitsOf(events: readonly MemoryEvent[], gapHours = 6): { start: string; end: string; events: MemoryEvent[] }[] {
  const out: { start: string; end: string; events: MemoryEvent[] }[] = [];
  for (const e of sortLog(events)) {
    const last = out[out.length - 1];
    if (last && Date.parse(e.at) - Date.parse(last.end) < gapHours * 3_600_000) {
      last.end = e.at;
      last.events.push(e);
    } else out.push({ start: e.at, end: e.at, events: [e] });
  }
  return out;
}

/** Whole days since the end of the last visit before `now`, or undefined on a first visit. */
export function daysSinceLastVisit(events: readonly MemoryEvent[], now: string): number | undefined {
  const before = events.filter((e) => e.at < now);
  const visits = visitsOf(before);
  const last = visits[visits.length - 1];
  if (!last) return undefined;
  return Math.floor((Date.parse(now) - Date.parse(last.end)) / DAY_MS);
}
