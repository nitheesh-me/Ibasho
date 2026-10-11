/**
 * App shell (SPEC 4 layout, DS 1, 11). Owner: WP-08.
 *
 * The top bar (name, the way to a home, the day and night lantern) and the theme. The page body
 * below it is laid out in the DS 4.3 zones by `Zones.tsx`. Hiru by default; the
 * choice is a per-viewer convenience kept in `localStorage` when the browser allows it. Reduced
 * motion follows the system setting and is written to `<html data-motion>` for `@ibasho/ui`.
 */
import { Glyph } from '@ibasho/ui';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { CommandPalette, SearchBox, SearchButton } from '../studio/search/Search.tsx';

export type Theme = 'hiru' | 'yoru';

interface ShellState {
  theme: Theme;
  reducedMotion: boolean;
}

const Ctx = createContext<ShellState>({ theme: 'hiru', reducedMotion: false });
export const useShell = (): ShellState => useContext(Ctx);

/** Studio pages put their selectors and mode tabs into the one top bar (DS 13.7: 56 px). */
const SlotCtx = createContext<(node: ReactNode | null) => void>(() => undefined);
export function useTopBar(node: ReactNode | null, deps: readonly unknown[]): void {
  const set = useContext(SlotCtx);
  useEffect(
    () => {
      set(node);
      return () => set(null);
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: the caller names what the node depends on
    deps,
  );
}

const THEME_KEY = 'ibasho.theme';

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'yoru' ? 'yoru' : 'hiru';
  } catch {
    return 'hiru';
  }
}

function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(query);
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function Shell({ children }: { children?: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [slot, setSlot] = useState<ReactNode | null>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.motion = reducedMotion ? 'reduced' : 'full';
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage blocked: the theme still applies for this visit.
    }
  }, [theme, reducedMotion]);
  const state = useMemo(() => ({ theme, reducedMotion }), [theme, reducedMotion]);
  const next: Theme = theme === 'hiru' ? 'yoru' : 'hiru';

  return (
    <Ctx.Provider value={state}>
      <SlotCtx.Provider value={setSlot}>
        <div className="ib-app" data-andon="app" data-slot={slot ? '' : undefined}>
          <a className="ib-skip" href="#main">
            Skip to the page
          </a>
          <header className="ib-top">
            <Link to="/" className="ib-brand" aria-label="Ibasho studio, your places">
              <Glyph char="居" className="ib-brand__mark" pad={60} />
              <span className="ib-brand__name">Ibasho</span>
            </Link>
            {slot ? (
              <div className="ib-top__slot">{slot}</div>
            ) : (
              <nav className="ib-top__nav" aria-label="Studio">
                <NavLink to="/" end className="ib-top__link">
                  Places
                </NavLink>
                <NavLink to="/new" className="ib-top__link">
                  New
                </NavLink>
                <NavLink to="/design" className="ib-top__link">
                  Design
                </NavLink>
                <NavLink to="/settings" className="ib-top__link">
                  Settings
                </NavLink>
                <NavLink to="/home/gh1" className="ib-top__link ib-top__link--minor">
                  London home
                </NavLink>
              </nav>
            )}
            <div className="ib-top__search">
              <SearchBox compact />
            </div>
            <SearchButton />
            <button
              type="button"
              className="ib-lantern"
              aria-pressed={theme === 'yoru'}
              onClick={() => setTheme(next)}
              title={theme === 'hiru' ? 'Light the lantern (night view)' : 'Back to day view'}
            >
              <Glyph char={theme === 'hiru' ? '昼' : '夜'} className="ib-lantern__glyph" pad={80} />
              <span>{theme === 'hiru' ? 'Day' : 'Night'}</span>
            </button>
          </header>
          <main id="main" className="ib-main">
            {children ?? <Outlet />}
          </main>
          <CommandPalette />
        </div>
      </SlotCtx.Provider>
    </Ctx.Provider>
  );
}
