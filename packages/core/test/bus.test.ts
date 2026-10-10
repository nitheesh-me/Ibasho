import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../src/events/bus.ts';

describe('event bus (ARCH 4.2)', () => {
  it('delivers typed events in subscription order and only to their type', () => {
    const bus = createEventBus();
    const seen: string[] = [];
    bus.on('twin.changed', (e) => seen.push(`a:${e.homeId}@${e.version}`));
    bus.on('twin.changed', (e) => seen.push(`b:${e.homeId}`));
    bus.on('result.ready', () => seen.push('wrong'));
    bus.emit({ t: 'twin.changed', homeId: 'gh1', version: 2 });
    expect(seen).toEqual(['a:gh1@2', 'b:gh1']);
  });

  it('unsubscribes, including during emit', () => {
    const bus = createEventBus();
    const late = vi.fn();
    const offLate = bus.on('ui.focus', late);
    bus.on('ui.focus', () => offLate());
    bus.emit({ t: 'ui.focus', elementId: 'wall-front' });
    expect(late).toHaveBeenCalledTimes(1); // snapshot of handlers at emit time
    bus.emit({ t: 'ui.focus' });
    expect(late).toHaveBeenCalledTimes(1);
    bus.emit({ t: 'narration.state', generating: true, origin: 'llm' }); // no handlers
  });

  it('runs every handler before rethrowing', () => {
    const bus = createEventBus();
    const after = vi.fn();
    bus.on('ui.chapter', () => {
      throw new Error('one');
    });
    bus.on('ui.chapter', after);
    expect(() => bus.emit({ t: 'ui.chapter', chapter: 'home' })).toThrow('one');
    expect(after).toHaveBeenCalled();
    bus.on('ui.chapter', () => {
      throw new Error('two');
    });
    expect(() => bus.emit({ t: 'ui.chapter', chapter: 'home' })).toThrow(AggregateError);
  });

  it('routes errors to onError when given', () => {
    const onError = vi.fn();
    const bus = createEventBus({ onError });
    bus.on('result.ready', () => {
      throw new Error('x');
    });
    bus.emit({ t: 'result.ready', homeId: 'gh1', resultHash: 'h' });
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
