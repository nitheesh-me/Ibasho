# @ibasho/landing

The landing page at `/`: "Ibasho no kōjō". It introduces the v3 studio (a building in its real city) to homeowners, architects, campus estates teams, developers and businesses, and leads into `/app/`.

- **Owner:** WP-09 (Content and landing).
- **Layer:** L4 (may import anything).
- `pnpm --filter @ibasho/landing dev`, `build`, `preview` (port 4174), `test`, `typecheck`.

## How it works

- **Static first paint (AC-L1, AC-L2).** `vite.config.ts` prerenders `src/Landing.tsx` with `react-dom/server` into `index.html` at build time. The page reads completely with JavaScript off. The only script adds the day and night switch, the ink-in on scroll and opening "Words we use" from a glossary link.
- **Sections.** Hero (follows the theme: ink on paper by day, lantern by night; on phones the drawing sits under the headline and the gold action stays above the fold), "Who it is for", "Vindhya Bhavan, in one page", the feature chapters (title, one line, one short paragraph, a "More detail" disclosure, and a still), the invitation, and a folded "Words we use".
- **Worked example (`src/example.ts`).** At build time it reads the studio's own results for GB1 (`packages/fixtures/src/preview/gb1/{energy,codes,optimise}.json` and `places.json`): EUI range against the ECSBC reference design, the yearly bill, the likely GHMC star level, and the three futures (least upfront, best return, lowest running cost) with upfront cost, bill and saving. Nothing is hard-coded; while the results are Preview the strip carries the Preview mark and dashed numbers. Missing files leave the strip out.
- **Stills (`src/posters.ts`).** The scene renders stills into `packages/scene/dev/posters/` with a `manifest.json`. Each build copies the stills that exist into `public/posters/` and sets them on their chapter by `posterId` (city-day, sun-sweep, daylight-drawer, lanterns, compare; radiation on the example; city-dusk behind the invitation; city-day and lanterns as the day and night hero). A still not rendered yet keeps a drawn panel in the same 16:10 slot.
- **Chapters from content (AC-L3), shown only when their feature exists (I4).** v3 chapters require studio stages (`stage:sun`, ...). `src/discover.ts` reads `STAGE_PROVIDERS` and the modules from `apps/web/src/manifest.ts`. A chapter on a Preview stage shows the Preview mark on its still, and the hero says once, under the actions, that some results are examples.
- `IBASHO_LANDING_ALL=1 pnpm --filter @ibasho/landing build` renders every chapter, marked Preview, for design work.
- **One product with the studio.** Buttons, Preview marks and data numbers restate the studio's `.ib-btn`, `.ib-btn--hero`, `.ib-preview` and Preview `Num` (dashed underline) on the same Andon tokens; data uses the code face. Gold only on the one hero action. The washi grain is one fixed, viewport sized layer with no blend mode.
- **Responsive.** 360, 768, 1280 and 1600 px, day and night: no horizontal scroll, 44 px targets, about 6,700 px tall at 1280, gold action bottom at 623 px on a 1280 by 800 screen and 659 px on 360 by 740.

## Status

- Done: v3 copy, review round 2 (grain, theme, fold, length, worked example, still slots, studio-matched controls), tests (34).
- Waiting on the scene: the stills themselves. They drop in on the next build once rendered.
- Not yet: a Latin only font subset for the landing (the shared font stylesheet is large).
