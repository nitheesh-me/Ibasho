# @ibasho/landing

The landing page at `/`: "Ibasho no kōjō". It introduces the v3 studio (a building in its real city) to homeowners, architects, campus estates teams, developers and businesses, and leads into `/app/`.

- **Owner:** WP-09 (Content and landing).
- **Layer:** L4 (may import anything).
- `pnpm --filter @ibasho/landing dev`, `build`, `preview` (port 4174), `test`, `typecheck`.

## How it works

- **Static first paint (AC-L1, AC-L2).** `vite.config.ts` prerenders `src/Landing.tsx` with `react-dom/server` into `index.html` at build time. The page reads completely with JavaScript off. The only script adds the day and night lantern and the ink-in on scroll. Webfonts load after first paint.
- **Sections.** Hero (lit, with `src/CityArt.tsx`, a static isometric paper city: your building in ink with lit windows, a low sun on its arc, and one tower of estimated height with a hatched penumbra), "Who it is for" (five audiences, each linking to a sample in the studio), the feature chapters, the invitation, and "Words we use" (glossary terms marked on the page).
- **Chapters from content (AC-L3), shown only when their feature exists (I4).** The list is `LANDING_CHAPTERS` filtered by `visibleChapters`. v3 chapters require studio stages (`stage:sun`, `stage:daylight`, ...). `src/discover.ts` reads `STAGE_PROVIDERS` and the module list from `apps/web/src/manifest.ts` at build time (falling back to a scan of `src/{engine,ui}/module.ts` for plugins). A chapter whose stage provider is still Preview renders with a Preview mark linking to its plain definition. "Hero" and "What you can trust" always render.
- `IBASHO_LANDING_ALL=1 pnpm --filter @ibasho/landing build` renders every chapter, marked Preview, for design work.
- **Andon.** The hero is a lit lantern (Yoru); the rest is washi (Hiru), or Yoru when the reader picks night. Gold only on the one hero action; the invitation repeats it in ink. No vermilion. Kanji are baked glyphs from `@ibasho/ui`, `aria-hidden`, beside English. Building types use their mons.
- **Responsive.** Checked at 360, 768, 1280 and 1600 px, day and night: no horizontal scroll, 44 px targets.

## Status

- Done: v3 copy and sections, stage-gated chapters with Preview marks, paper city hero, tests (27).
- Not yet: baked posters from the city scene (chapters carry `poster` when they exist). The smoke test in `tests/smoke/boot.spec.ts` still expects the old blank page and the title `Ibasho` (see the blackboard).
