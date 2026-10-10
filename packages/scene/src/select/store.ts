/**
 * Shared selection between the scene and the `a11y-scene` outline (ARCH 10): DOM focus
 * highlights the mesh, a mesh click focuses the DOM item. Tiny external store, no library.
 * Owner: WP-07.
 */
import type { SceneHit } from '@ibasho/core';

export type SceneTarget =
  | { kind: 'element'; id: string }
  | { kind: 'junction'; id: string }
  | { kind: 'zone'; id: 'living' | 'rest' };

export interface SelectionState {
  /** Hovered or keyboard-focused target (highlight only). */
  focus: SceneTarget | null;
  /** Chosen target (opens the element sheet in the app). */
  selected: SceneTarget | null;
  /** Bumped when the scene asks the outline to move DOM focus. */
  focusRequest: number;
}

export interface SelectionStore {
  get(): SelectionState;
  subscribe(fn: () => void): () => void;
  setFocus(t: SceneTarget | null): void;
  select(t: SceneTarget | null, from: 'scene' | 'outline'): void;
}

export function createSelectionStore(): SelectionStore {
  let state: SelectionState = { focus: null, selected: null, focusRequest: 0 };
  const subs = new Set<() => void>();
  const emit = (): void => {
    for (const f of subs) f();
  };
  return {
    get: () => state,
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    setFocus(t) {
      if (sameTarget(state.focus, t)) return;
      state = { ...state, focus: t };
      emit();
    },
    select(t, from) {
      state = {
        ...state,
        selected: t,
        focus: t,
        focusRequest: from === 'scene' ? state.focusRequest + 1 : state.focusRequest,
      };
      emit();
    },
  };
}

export function sameTarget(a: SceneTarget | null, b: SceneTarget | null): boolean {
  return a === b || (!!a && !!b && a.kind === b.kind && a.id === b.id);
}

/** Picking: a raycast hit to the element or junction it draws (`userData`). */
export function targetOfHit(hit: Pick<SceneHit, 'object'>): SceneTarget | null {
  const u = hit.object.userData;
  if (typeof u.junctionId === 'string') return { kind: 'junction', id: u.junctionId };
  if (typeof u.elementId === 'string') return { kind: 'element', id: u.elementId };
  if (u.zone === 'living' || u.zone === 'rest') return { kind: 'zone', id: u.zone };
  return null;
}

export function targetKey(t: SceneTarget): string {
  return `${t.kind}:${t.id}`;
}
