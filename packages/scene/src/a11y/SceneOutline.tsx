/**
 * `a11y-scene`: the DOM outline of the house (ARCH 10). DOM focus highlights the mesh; a mesh
 * click moves DOM focus here (AC-H1). Owner: WP-07.
 */
import { type CSSProperties, useEffect, useRef, useSyncExternalStore } from 'react';
import type { SelectionStore } from '../select/store.ts';
import { sameTarget, targetKey } from '../select/store.ts';
import type { OutlineGroup, OutlineItem } from './model.ts';

export interface SceneOutlineProps {
  groups: readonly OutlineGroup[];
  store: SelectionStore;
  /** Visually hidden by default; the app may show it as a list. */
  visible?: boolean;
  label?: string;
}

const HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

export function SceneOutline({ groups, store, visible = false, label = 'House outline' }: SceneOutlineProps) {
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const lastReq = useRef(state.focusRequest);

  useEffect(() => {
    if (state.focusRequest === lastReq.current) return;
    lastReq.current = state.focusRequest;
    const t = state.selected;
    if (!t) return;
    refs.current.get(targetKey(t))?.focus({ preventScroll: true });
  }, [state.focusRequest, state.selected]);

  const render = (it: OutlineItem) => {
    const key = targetKey(it.target);
    const selected = sameTarget(state.selected, it.target);
    const descId = `ib-outline-${key.replace(/[^a-z0-9-]/gi, '-')}`;
    return (
      <li key={key}>
        <button
          type="button"
          ref={(el) => {
            if (el) refs.current.set(key, el);
            else refs.current.delete(key);
          }}
          data-target={key}
          aria-pressed={selected}
          aria-describedby={descId}
          onFocus={() => store.setFocus(it.target)}
          onBlur={() => store.setFocus(null)}
          onMouseEnter={() => store.setFocus(it.target)}
          onMouseLeave={() => store.setFocus(null)}
          onClick={() => store.select(it.target, 'outline')}
        >
          {it.label}
        </button>
        <span id={descId} className="ib-outline-desc">
          {' '}
          {it.description}
        </span>
        {it.children.length > 0 ? <ul>{it.children.map(render)}</ul> : null}
      </li>
    );
  };

  return (
    <nav aria-label={label} className="ib-scene-outline" style={visible ? undefined : HIDDEN}>
      {groups.map((g) => (
        <section key={g.id} aria-label={g.label}>
          <h3>{g.label}</h3>
          <ul>{g.items.map(render)}</ul>
        </section>
      ))}
    </nav>
  );
}
