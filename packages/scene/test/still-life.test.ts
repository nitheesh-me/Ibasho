/** Still-life controller (DEC TE-8, G5): render while moving, bake once at rest, then only composite. */
import { describe, expect, it } from 'vitest';
import { initialStill, REST_MS, type StillState, tick, wantsFrames } from '../src/still-life/machine.ts';

const run = (s: StillState, now: number, changed = false, bakeFrames = 4, allowBake = true) =>
  tick(s, { now, changed, bakeFrames, allowBake });

describe('still-life machine', () => {
  it('renders live until the camera rests for REST_MS', () => {
    let s = initialStill(0);
    let r = run(s, 10, true);
    expect(r.action).toBe('live');
    s = r.state;
    r = run(s, 10 + REST_MS - 1);
    expect(r.action).toBe('live');
    expect(r.state.phase).toBe('live');
  });

  it('bakes exactly bakeFrames frames, then composites without scene renders', () => {
    let s = initialStill(0);
    const actions: string[] = [];
    for (let t = REST_MS; t < REST_MS + 20; t++) {
      const r = run(s, t, false, 4);
      actions.push(r.action);
      s = r.state;
    }
    expect(actions.slice(0, 4)).toEqual([
      'bake-accumulate',
      'bake-accumulate',
      'bake-accumulate',
      'bake-final',
    ]);
    expect(actions.slice(4).every((a) => a === 'composite')).toBe(true);
    expect(s.phase).toBe('baked');
    expect(wantsFrames(s)).toBe(false);
    const rendersAtBake = s.sceneRenders;
    for (let t = 0; t < 100; t++) s = run(s, 1000 + t).state;
    expect(s.sceneRenders).toBe(rendersAtBake);
    expect(s.composites).toBe(16 + 100);
  });

  it('tier 0 still bakes one frame', () => {
    const r = run(initialStill(0), REST_MS, false, 0);
    expect(r.action).toBe('bake-final');
    expect(r.state.phase).toBe('baked');
  });

  it('a change drops back to live and restarts the rest timer', () => {
    let s = initialStill(0);
    for (let t = REST_MS; t < REST_MS + 10; t++) s = run(s, t).state;
    expect(s.phase).toBe('baked');
    s = run(s, 2000, true).state;
    expect(s.phase).toBe('live');
    expect(s.lastChange).toBe(2000);
    expect(run(s, 2000 + REST_MS - 1).action).toBe('live');
    expect(run(s, 2000 + REST_MS).action).not.toBe('live');
  });

  it('allowBake false forces live without moving the rest timer', () => {
    const s = initialStill(0);
    const r = run(s, 5000, false, 4, false);
    expect(r.action).toBe('live');
    expect(r.state.lastChange).toBe(0);
  });
});
