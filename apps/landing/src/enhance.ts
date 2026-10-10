/**
 * Progressive enhancement for the static landing page. Owner: WP-09.
 * Everything here is optional: with JavaScript off the page is complete and readable (AC-L2).
 *
 * - The lantern button switches day (Hiru) and night (Yoru), remembered per browser.
 * - Chapters ink in as they scroll into view, unless the reader prefers reduced motion.
 */

export type Theme = 'hiru' | 'yoru';
const KEY = 'ibasho.landing.theme';

/** Read the remembered theme. Storage can throw or be empty (private windows): then undefined. */
export function readTheme(storage: Pick<Storage, 'getItem'> | undefined): Theme | undefined {
  try {
    const v = storage?.getItem(KEY);
    return v === 'hiru' || v === 'yoru' ? v : undefined;
  } catch {
    return undefined;
  }
}

export function writeTheme(storage: Pick<Storage, 'setItem'> | undefined, t: Theme): void {
  try {
    storage?.setItem(KEY, t);
  } catch {
    // A blocked store only means the choice is not remembered.
  }
}

/** The theme in force: the explicit one on `<html>`, else the system preference. */
export function currentTheme(root: HTMLElement, prefersDark: boolean): Theme {
  const t = root.dataset.theme;
  if (t === 'hiru' || t === 'yoru') return t;
  return prefersDark ? 'yoru' : 'hiru';
}

function safeStorage(win: Window): Storage | undefined {
  try {
    return win.localStorage;
  } catch {
    return undefined;
  }
}

function syncButton(button: HTMLButtonElement, t: Theme): void {
  // The button names the state it switches to, and aria-pressed says whether night is on.
  button.textContent = t === 'yoru' ? 'Day' : 'Night';
  button.setAttribute('aria-pressed', String(t === 'yoru'));
  button.setAttribute('aria-label', t === 'yoru' ? 'Switch to day colours' : 'Switch to night colours');
}

export function setupLantern(doc: Document, win: Window): void {
  const root = doc.documentElement;
  const store = safeStorage(win);
  const saved = readTheme(store);
  if (saved) root.dataset.theme = saved;
  const button = doc.querySelector<HTMLButtonElement>('[data-lantern]');
  if (!button) return;
  const dark = () => win.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  syncButton(button, currentTheme(root, dark()));
  button.hidden = false;
  button.addEventListener('click', () => {
    const next: Theme = currentTheme(root, dark()) === 'yoru' ? 'hiru' : 'yoru';
    root.dataset.theme = next;
    writeTheme(store, next);
    syncButton(button, next);
  });
}

export function setupReveal(doc: Document, win: Window & typeof globalThis): void {
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduced || typeof win.IntersectionObserver !== 'function') return;
  const sections = [...doc.querySelectorAll<HTMLElement>('.lp-ch')];
  const io = new win.IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.inked = 'true';
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );
  // Only sections below the fold wait to ink in; anything already visible stays as painted.
  const fold = win.innerHeight;
  for (const s of sections) {
    if (s.getBoundingClientRect().top < fold) continue;
    s.dataset.inked = 'false';
    io.observe(s);
  }
}
