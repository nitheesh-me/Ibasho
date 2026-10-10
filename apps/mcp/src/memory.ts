/**
 * Headless "things you told us" log for the MCP tools (ARCH 14, AM 7.1). Owner: WP-12.
 *
 * One JSON Lines file per home under `~/.config/ibasho/memory/<homeId>.jsonl`. Every line is a
 * `MemoryEvent` validated with `MemoryEventSchema`; lines that fail are skipped, never trusted.
 * Forgetting deletes lines for real (AM 7.1) and leaves one `memoryForgotten` marker with the
 * selector only. The app's own log lives in IndexedDB (WP-08); the two meet through `.ibasho`
 * export and import, not here.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ForgetSelector, MemoryEvent, MemoryEventType, NewMemoryEvent, Preferences } from '@ibasho/core';
import { MemoryEventSchema } from '@ibasho/core/schemas';

/** Event types an agent may record on the person's behalf (typed statements only). */
export const AGENT_MEMORY_TYPES = [
  'measureRejected',
  'measureRestored',
  'measureCompleted',
  'budgetSet',
  'tenureSet',
  'priorityRanked',
  'questionAsked',
] as const satisfies readonly MemoryEventType[];
export type AgentMemoryType = (typeof AGENT_MEMORY_TYPES)[number];

const SAFE_ID = /^[A-Za-z0-9._:-]{1,80}$/;

export class MemoryLog {
  readonly #dir: string;
  readonly #now: () => Date;
  #seq = 0;

  constructor(dir: string, now: () => Date = () => new Date()) {
    this.#dir = dir;
    this.#now = now;
  }

  #path(homeId: string): string {
    if (!SAFE_ID.test(homeId)) throw new Error(`invalid home id "${homeId}"`);
    return join(this.#dir, `${homeId.replace(/:/g, '_')}.jsonl`);
  }

  list(homeId: string, type?: MemoryEventType): MemoryEvent[] {
    let raw: string;
    try {
      raw = readFileSync(this.#path(homeId), 'utf8');
    } catch {
      return [];
    }
    const out: MemoryEvent[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const r = MemoryEventSchema.safeParse(JSON.parse(line));
        if (r.success && (!type || r.data.type === type)) out.push(r.data);
      } catch {
        // A corrupt line is skipped, never trusted.
      }
    }
    return out;
  }

  #write(homeId: string, events: MemoryEvent[]): void {
    mkdirSync(this.#dir, { recursive: true, mode: 0o700 });
    const path = this.#path(homeId);
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, events.map((e) => `${JSON.stringify(e)}\n`).join(''), { mode: 0o600 });
    renameSync(tmp, path);
  }

  append(e: NewMemoryEvent): MemoryEvent {
    const at = this.#now();
    this.#seq += 1;
    const event = MemoryEventSchema.parse({
      ...e,
      id: `m_${at.getTime().toString(36)}_${this.#seq.toString(36)}`,
      at: at.toISOString(),
    });
    this.#write(event.homeId, [...this.list(event.homeId), event]);
    return event;
  }

  /** Real deletion; returns how many events were removed. */
  forget(homeId: string, selector: ForgetSelector): { removed: MemoryEvent[] } {
    const all = this.list(homeId);
    const hit = (e: MemoryEvent): boolean => {
      switch (selector.kind) {
        case 'all':
          return true;
        case 'event':
          return e.id === selector.eventId;
        case 'type':
          return e.type === selector.type;
        case 'measure':
          return 'measureId' in e.payload && e.payload.measureId === selector.measureId;
      }
    };
    const removed = all.filter(hit);
    const kept = all.filter((e) => !hit(e));
    this.#write(homeId, kept);
    if (removed.length > 0) {
      this.append({ homeId, actor: 'owner', type: 'memoryForgotten', payload: { selector } });
    }
    return { removed };
  }

  /** Folded preferences (AM 7.1), used to fill `SearchRequest.memory`. */
  preferences(homeId: string): Preferences {
    const p: Preferences = {
      tenure: 'unknown',
      rights: { roof: 'unknown', externalWalls: 'unknown', windows: 'unknown' },
      rejected: {},
      completed: {},
      priorities: [],
    };
    for (const e of this.list(homeId)) {
      switch (e.type) {
        case 'measureRejected': {
          const r: Preferences['rejected'][string] = { scope: e.payload.scope, at: e.at };
          if (e.payload.until) r.until = e.payload.until;
          if (e.payload.reason) r.reason = e.payload.reason;
          p.rejected[e.payload.measureId] = r;
          break;
        }
        case 'measureRestored':
          delete p.rejected[e.payload.measureId];
          break;
        case 'measureCompleted':
          p.completed[e.payload.measureId] = { at: e.at };
          break;
        case 'budgetSet':
          if (e.payload.capGBP === null) delete p.budgetCapGBP;
          else p.budgetCapGBP = e.payload.capGBP;
          break;
        case 'tenureSet':
          p.tenure = e.payload.tenure;
          break;
        case 'priorityRanked':
          p.priorities = [...e.payload.priorities];
          break;
        default:
          break;
      }
    }
    return p;
  }
}
