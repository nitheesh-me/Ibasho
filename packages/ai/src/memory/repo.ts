/**
 * Reference `MemoryRepo` (in memory). It is the behaviour the Dexie repo in `packages/store` (WP-08)
 * must match: same views (from `views.ts`), same write policy, same export format. Used by tests,
 * the headless agent link and the app until the store lands.
 */
import type {
  ForgetSelector,
  MemoryDigest,
  MemoryEvent,
  MemoryEventType,
  MemoryRepo,
  NewMemoryEvent,
  Preferences,
  Seed,
} from '@ibasho/core';
import { canonicalJson } from '@ibasho/core';
import { MemoryEventSchema } from '@ibasho/core/schemas';
import { z } from 'zod';
import { checkWritePolicy, digestOf, preferencesOf, purgeCompost, resolve, seedsOf, sortLog } from './views.ts';

export const MEMORY_EXPORT_SCHEMA = 'ibasho.memory/1';

const ExportSchema = z.object({
  schema: z.literal(MEMORY_EXPORT_SCHEMA),
  homeId: z.string().min(1),
  events: z.array(MemoryEventSchema),
});

export interface InMemoryRepoOptions {
  /** ISO clock. */
  clock?: () => string;
  /** Id factory; default `m<seq>` (deterministic). */
  newId?: () => string;
}

export class InMemoryMemoryRepo implements MemoryRepo {
  private readonly logs = new Map<string, MemoryEvent[]>();
  private readonly subs = new Map<string, Set<() => void>>();
  private readonly clock: () => string;
  private readonly newId: () => string;
  private seq = 0;

  constructor(opts: InMemoryRepoOptions = {}) {
    this.clock = opts.clock ?? (() => new Date().toISOString());
    this.newId = opts.newId ?? (() => `m${String(++this.seq).padStart(8, '0')}`);
  }

  private log(homeId: string): MemoryEvent[] {
    let l = this.logs.get(homeId);
    if (!l) {
      l = [];
      this.logs.set(homeId, l);
    }
    return l;
  }

  private notify(homeId: string) {
    for (const cb of this.subs.get(homeId) ?? []) cb();
  }

  async append(e: NewMemoryEvent): Promise<MemoryEvent> {
    checkWritePolicy(e);
    const event = MemoryEventSchema.parse({ ...e, id: this.newId(), at: this.clock() });
    this.log(e.homeId).push(event);
    this.notify(e.homeId);
    return event;
  }

  async preferences(homeId: string): Promise<Preferences> {
    return preferencesOf(this.log(homeId), this.clock());
  }

  async seeds(homeId: string): Promise<Seed[]> {
    return seedsOf(this.log(homeId));
  }

  async digest(homeId: string, focus?: string[]): Promise<MemoryDigest> {
    return digestOf(this.log(homeId), this.clock(), focus ? { focus } : {});
  }

  async history(homeId: string, filter: { type?: MemoryEventType; actor?: MemoryEvent['actor'] } = {}): Promise<MemoryEvent[]> {
    return sortLog(this.log(homeId)).filter(
      (e) => (filter.type === undefined || e.type === filter.type) && (filter.actor === undefined || e.actor === filter.actor),
    );
  }

  /** Live events (undo, edits and forgets applied). */
  async live(homeId: string): Promise<MemoryEvent[]> {
    return resolve(this.log(homeId)).live;
  }

  async undo(eventId: string): Promise<void> {
    for (const [homeId, l] of this.logs) {
      if (l.some((e) => e.id === eventId)) {
        await this.append({ homeId, actor: 'owner', type: 'memoryEdited', payload: { eventId, payload: null } });
        return;
      }
    }
    throw new Error(`no memory event ${eventId}`);
  }

  async exportJSON(homeId: string): Promise<string> {
    return canonicalJson({ schema: MEMORY_EXPORT_SCHEMA, homeId, events: sortLog(this.log(homeId)) });
  }

  async importJSON(json: string): Promise<void> {
    const data = ExportSchema.parse(JSON.parse(json));
    const l = this.log(data.homeId);
    const have = new Set(l.map((e) => e.id));
    for (const e of data.events) {
      if (e.homeId !== data.homeId) throw new Error(`event ${e.id} belongs to ${e.homeId}`);
      if (!have.has(e.id)) l.push(e);
    }
    this.notify(data.homeId);
  }

  /** Moves matching events to the compost (recoverable by `undo` of the returned forget event). */
  async forget(homeId: string, selector: ForgetSelector): Promise<void> {
    await this.append({ homeId, actor: 'owner', type: 'memoryForgotten', payload: { selector } });
  }

  /** Real deletion of compost older than 30 days, or all of it with `emptyNow` (AC-M3). */
  async purge(homeId: string, emptyNow = false): Promise<number> {
    const before = this.log(homeId);
    const after = purgeCompost(before, this.clock(), emptyNow);
    this.logs.set(homeId, after);
    if (after.length !== before.length) this.notify(homeId);
    return before.length - after.length;
  }

  /** Raw stored events, for deletion audits in tests. */
  raw(homeId: string): readonly MemoryEvent[] {
    return [...this.log(homeId)];
  }

  subscribe(homeId: string, cb: () => void): () => void {
    let s = this.subs.get(homeId);
    if (!s) {
      s = new Set();
      this.subs.set(homeId, s);
    }
    s.add(cb);
    return () => {
      s.delete(cb);
    };
  }
}
