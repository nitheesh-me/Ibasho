# @ibasho/landing

The landing page at `/`: "Ibasho no kōjō", five chapters from `@ibasho/content`.

- **Owner:** WP-09 (Content and landing).
- **Layer:** L4 (may import anything).
- `pnpm --filter @ibasho/landing dev`, `build`, `preview` (port 4174), `test`, `typecheck`.

## How it works

- **Static first paint (AC-L1, AC-L2).** `vite.config.ts` prerenders `src/Landing.tsx` with `react-dom/server` into `index.html` at build time (through Vite's `runnerImport`, so workspace TSX transforms). The page reads completely with JavaScript off. The only script (about 2 kB gzip) adds the day and night lantern and the ink-in on scroll. Critical CSS is the Andon tokens plus `landing.css` (about 5 kB gzip); the three webfonts load after first paint as their own stylesheet.
- **Chapters from content (AC-L3).** The list is `LANDING_CHAPTERS`, filtered by `visibleChapters`.
- **Chapters hide when a required plugin is absent (I4).** `src/discover.ts` lists plugins at build time. It reads the app manifest (`apps/web/src/manifest.ts`) once that lists any module, so the page never advertises a plugin the app does not load. While the manifest is empty (M-0) it imports every `src/{engine,ui}/module.ts` under `packs/*` and `packages/*` (search strategies live in `packages/engine`, checker rungs in `packages/verify`). A module that fails to import is skipped with a warning. So the page grows by itself as features land. Today (M-0) the hero and "What if" show; "Your home, drawn" waits for an `archetype` plugin, "Three futures" for a `search-strategy`, "Proof and privacy" for a `checker-rung`.
- `IBASHO_LANDING_ALL=1 pnpm --filter @ibasho/landing build` renders every chapter, for design work.
- **Andon.** The hero is a lit lantern (Yoru); the rest is washi (Hiru). Gold only on the one hero action; the invitation repeats it in ink. No vermilion: nothing here is a seal. Kanji are baked glyphs from `@ibasho/ui`, `aria-hidden`, beside English. Glossary terms link to a "Words we use" list on the page.

## Status

- Done: static first paint, five chapters, requires filtering, lantern toggle, reduced motion, 360 to 1440 px with no horizontal scroll, tests (17).
- PLACEHOLDER: posters and the one live miniature (M-E, need WP-07 bakes). Lighthouse FCP and axe runs belong in WP-10's suites.
- The G0 smoke test still expects the blank skeleton (`main[data-andon="blank"]`); the page now renders `main[data-andon="landing"]`. See the WP-09 blackboard entry.
