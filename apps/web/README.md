# @ibasho/web

The app at /app/: routes, worker wiring, home stage, story, studio views, PWA.

- **Owner:** WP-08 (everything except `public/assets/**`, which is WP-11).
- **Layer:** L4 (may import anything).
- Served at `/app/`. `pnpm --filter @ibasho/web dev`, `build`, `preview` (port 4173).

## What works (M-0, M-A)

- `/app/` opens the person's last home, or onboarding when there is none. `/app/home/gh1` is the sample.
- `/app/start`: onboarding in five typed steps (Where, Shape, Tune, People, Reveal; `src/start/steps.ts` guards the two minute budget and refuses any money question, R24). Works offline: city list and postcode area read locally. Every unanswered value stays an estimate and is marked as one (AC-G2). Skip to the Reveal from step three; "Show me a sample home" opens GH1.
- Reveal: onboarding navigates to `/app/home/:id` with `state.reveal`; the home stage mounts WP-07's `HouseStage` (Washi by day, Yoru by night, pencil underdrawing while computing) and plays the roof lift once when the baseline is ready (skipped under reduced motion). Without WebGL, or if the 3D stage throws, the SVG house is drawn instead, pencil then ink.
- Layout zones (`src/shell/Zones.tsx`, DS 4.3): Niwa, Engawa, Zashiki with the Tokonoma card. Desktop Niwa about 62% wide; phone Niwa on top.
- The engine runs in a Web Worker (`src/worker/engine.worker.ts`, Comlink). The worker also runs the mirror checker on the certificate, so the main thread receives the result and the verdict together.
- The page shows the house, three futures with `Num` chips, one Checked seal (only when the mirror agrees and the spec is the generated one) and the proved claim "What you ruled out never came back".
- Results are kept in the local store (`@ibasho/store`) when IndexedDB is available.
- The home page stays plain: no theorem names, formula ids or raw errors. Those belong on `/app/proofs` and in the evidence drawer.

## The v3 studio (V-P prototype)

Routes (SPEC 17): `/app/` studio home (your places, Welcome back with what changed and a before and after, Start over, Branch), `/app/new` (New flow: find or place, type, start from a template, a trace or the sample, rooms and windows, place it among the neighbours, first results), `/app/p/:place` and `/app/p/:place/b/:building` (the studio: modes Make, Look, Choose, Prove, Tell; levels City to Room; `?level=&mode=&lens=&floor=&room=&focus=`), `/app/settings` (the ledger with impact preview before Apply). `/app/homes` keeps the v2 landing; `/app/home/:id` and `/app/start` are unchanged.

- Data: golden documents and places from `@ibasho/fixtures/buildings` (GB1 Vindhya and GB2 Himalaya on the IIIT campus, GB3 HITEC office), Hyderabad tiles from `@ibasho/pack-city-hyderabad` (`src/studio/data.ts`).
- Stages: agent A's Preview stages (`@ibasho/preview` compute functions) run by `src/studio/preview/runner.ts` with recorded timings, rough then refined then final, cancel and generations; `views.ts` maps the core outputs to panel views with Preview-sealed evidence. `manifest.ts` `STAGE_PROVIDERS` names the provider per stage.
- Scene: agent C's `CityStage` (`@ibasho/scene`) in `src/studio/niwa/Niwa.tsx`, driven by props with the studio's Andon chrome; SVG style without WebGL and in compare thumbnails.
- Make: `@ibasho/editor` plan, inspector, storeys, underlay and the film strip; commands are Immer patches with undo and redo.
- Find: header search and the Ctrl or Cmd K palette (search button on phones) over `@ibasho/plan` `searchPlaces`; a pick sets the building, the zoom level and the scene focus.
- State: `src/studio/state/studio.ts` (zustand), persisted through `@ibasho/store` v2 (`persist.ts`).

## Homes (Lloyds brief)

`/app/portfolio` ranks a home portfolio by improvement potential (100 x (baseline minus after) / baseline purchased energy, grid electricity plus gas), flags Poor and Very poor homes with their key issues, and reports electricity and gas changes separately, or "unavailable" without meter readings. `/app/portfolio/:id` shows the Green Home Score (seven brief weights, bands, each component's weight, sub-score and contribution), the prioritised feasible retrofits (suitability, reason, per-fuel saving net of the ones above it, increases negative), the package, carbon from per-fuel factors (DESNZ 2024), the value change as an indicative range, and a what-if that reruns everything; the narrator only reads computed values. Code: `src/portfolio/`. PLACEHOLDER: `model.ts` is a local documented model with a synthetic portfolio (P10001 to P10040) until Agent A's data and calculations land; then the page imports theirs.

## Layout

`src/manifest.ts` (module manifest, Node importable; packs imported by package name, `ui` has `pack-home-uk/ui`), `src/worker/` (engine and mirror), `src/engine/client.ts` (main thread client), `src/home/` (homes lookup, view model, page, `HomeHouse` stage mount, SVG fallback), `src/start/` (onboarding), `src/shell/` (shell, zones, services), `src/routes.tsx`.

## Stubs

- PLACEHOLDER (V-P): design levers other than windows, shading and the cooling system (glazing, roof finish, walls, lighting, daylight controls, set point, PV) are applied to the energy result by `src/studio/preview/levers.ts` until the Preview energy stage reads design parameters (asked of agent A). Studio jobs run on the main thread; moving them into the engine worker is open.

- PLACEHOLDER: `src/start/seed.ts` seeds every home from the GH1 survey twin (all values re-tagged as estimates) until WP-01 ships `ArchetypePlugin.seed()`; only the terrace tile (and "Not sure") can be picked, other tiles say "Not drawn yet".
- PLACEHOLDER: every place uses London's typical weather until the climate pack adds cities; the page says so.
- PLACEHOLDER: Tune questions use the typical UK order; ordering by value of information waits for `EngineApi.valueOfInformation`.
- PLACEHOLDER: the evidence note is a small sheet; the full `EvidenceDrawer` arrives at M-C.
- Other SPEC 4 routes arrive with their milestones.

Commands: `pnpm --filter @ibasho/web typecheck`, `pnpm --filter @ibasho/web test`.
