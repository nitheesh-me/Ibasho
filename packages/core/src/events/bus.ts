/**
 * Typed application event bus (ARCH 4.2). Owner: WP-00.
 * Synchronous, in subscription order. A throwing handler does not stop the others; errors are
 * collected and rethrown together after every handler ran (or passed to `onError` if given).
 */

import type { MemoryEvent } from '../ai/memory.ts';
import type { CheckerRungId } from '../evidence/types.ts';
import type { ChapterId } from '../ui.ts';

export type AppEvent =
  | { t: 'twin.changed'; homeId: string; version: number }
  | { t: 'result.ready'; homeId: string; resultHash: string }
  | { t: 'cert.verdict'; resultHash: string; rung: CheckerRungId; coverage: 'all' | 'sample'; ok: boolean }
  | { t: 'memory.event'; event: MemoryEvent }
  | { t: 'narration.state'; generating: boolean; origin: 'llm' | 'template' }
  | { t: 'ui.chapter'; chapter: ChapterId }
  | { t: 'ui.focus'; elementId?: string };

export type AppEventType = AppEvent['t'];

export interface EventBus {
  emit(e: AppEvent): void;
  on<T extends AppEventType>(t: T, cb: (e: Extract<AppEvent, { t: T }>) => void): () => void;
}

export interface EventBusOptions {
  /** Receives handler errors instead of having `emit` rethrow them. */
  onError?: (err: unknown, e: AppEvent) => void;
}

export function createEventBus(opts: EventBusOptions = {}): EventBus {
  const handlers = new Map<AppEventType, Set<(e: AppEvent) => void>>();
  return {
    emit(e) {
      const set = handlers.get(e.t);
      if (!set) return;
      const errors: unknown[] = [];
      for (const cb of [...set]) {
        try {
          cb(e);
        } catch (err) {
          if (opts.onError) opts.onError(err, e);
          else errors.push(err);
        }
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) throw new AggregateError(errors, `${errors.length} handlers failed for ${e.t}`);
    },
    on(t, cb) {
      let set = handlers.get(t);
      if (!set) {
        set = new Set();
        handlers.set(t, set);
      }
      const h = cb as (e: AppEvent) => void;
      set.add(h);
      return () => {
        set.delete(h);
      };
    },
  };
}
