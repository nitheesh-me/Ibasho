/**
 * Still-life controller (DEC TE-8, ARCH 10, BUILD_PLAN WP-07 G5). Owner: WP-07.
 *
 * While the camera moves, the cheap `Live` pass renders the scene. When it has rested for
 * 300 ms, the `Bake` pass accumulates one high-quality frame plus depth. After that the scene is
 * not rendered again: each frame only composites the baked image and draws the overlays
 * (motes, lens, tints), depth-tested against the baked depth. Pure state machine; the R3F
 * component in `three/StillLife.tsx` executes its actions.
 */

export type StillPhase = 'live' | 'baking' | 'baked';
export type StillAction = 'live' | 'bake-accumulate' | 'bake-final' | 'composite';

export interface StillState {
  phase: StillPhase;
  /** Time of the last camera move or scene change, ms. */
  lastChange: number;
  bakeFrame: number;
  /** Counters for tests and the `renderer.info` gate. */
  sceneRenders: number;
  composites: number;
}

export const REST_MS = 300;

export function initialStill(now = 0): StillState {
  return { phase: 'live', lastChange: now, bakeFrame: 0, sceneRenders: 0, composites: 0 };
}

export interface TickInput {
  now: number;
  /** Camera moved since the last tick, or the scene graph changed. */
  changed: boolean;
  bakeFrames: number;
  /** Bake disabled (tier 0 still bakes one frame; `false` here forces live, e.g. during a sequence). */
  allowBake: boolean;
}

export function tick(s: StillState, i: TickInput): { state: StillState; action: StillAction } {
  if (i.changed || !i.allowBake) {
    return {
      state: {
        ...s,
        phase: 'live',
        lastChange: i.changed ? i.now : s.lastChange,
        bakeFrame: 0,
        sceneRenders: s.sceneRenders + 1,
      },
      action: 'live',
    };
  }
  if (s.phase === 'live') {
    if (i.now - s.lastChange < REST_MS) {
      return { state: { ...s, sceneRenders: s.sceneRenders + 1 }, action: 'live' };
    }
    return startOrFinish({ ...s, phase: 'baking', bakeFrame: 0 }, i.bakeFrames);
  }
  if (s.phase === 'baking') return startOrFinish(s, i.bakeFrames);
  return { state: { ...s, composites: s.composites + 1 }, action: 'composite' };
}

function startOrFinish(s: StillState, frames: number): { state: StillState; action: StillAction } {
  const n = Math.max(1, frames);
  if (s.bakeFrame + 1 >= n) {
    return {
      state: { ...s, phase: 'baked', bakeFrame: n, sceneRenders: s.sceneRenders + 1 },
      action: 'bake-final',
    };
  }
  return {
    state: { ...s, bakeFrame: s.bakeFrame + 1, sceneRenders: s.sceneRenders + 1 },
    action: 'bake-accumulate',
  };
}

/** Does the controller still need frames without an overlay asking? */
export function wantsFrames(s: StillState): boolean {
  return s.phase !== 'baked';
}
