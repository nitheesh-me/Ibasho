/**
 * App shell (SPEC 4 layout, DS 1, 11). Owner: WP-08.
 *
 * The top bar (name, the home, the day and night lantern) and the theme. Hiru by default; the
 * choice is a per-viewer convenience kept in `localStorage` when the browser allows it. Reduced
 * motion follows the system setting and is written to `<html data-motion>` for `@ibasho/ui`.
 */
import { Glyph } from '@ibasho/ui';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Outlet } from 'react-router';

export type Theme = 'hiru' | 'yoru';

interface ShellState {
  theme: Theme;
  reducedMotion: boolean;
}

const Ctx = createContext<ShellState>({ theme: 'hiru', reducedMotion: false });
export const useShell = (): ShellState => useContext(Ctx);

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
      <div className="ib-app" data-andon="app">
        <a className="ib-skip" href="#main">
          Skip to the page
        </a>
        <header className="ib-top">
          <Link to="/home/gh1" className="ib-brand" aria-label="Ibasho, home">
            <Glyph char="居" className="ib-brand__mark" pad={60} />
            <span className="ib-brand__name">Ibasho</span>
          </Link>
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
      </div>
    </Ctx.Provider>
  );
}
