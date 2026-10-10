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

## Layout

`src/manifest.ts` (module manifest, Node importable; packs imported by package name, `ui` has `pack-home-uk/ui`), `src/worker/` (engine and mirror), `src/engine/client.ts` (main thread client), `src/home/` (homes lookup, view model, page, `HomeHouse` stage mount, SVG fallback), `src/start/` (onboarding), `src/shell/` (shell, zones, services), `src/routes.tsx`.

## Stubs

- PLACEHOLDER: `src/start/seed.ts` seeds every home from the GH1 survey twin (all values re-tagged as estimates) until WP-01 ships `ArchetypePlugin.seed()`; only the terrace tile (and "Not sure") can be picked, other tiles say "Not drawn yet".
- PLACEHOLDER: every place uses London's typical weather until the climate pack adds cities; the page says so.
- PLACEHOLDER: Tune questions use the typical UK order; ordering by value of information waits for `EngineApi.valueOfInformation`.
- PLACEHOLDER: the evidence note is a small sheet; the full `EvidenceDrawer` arrives at M-C.
- Other SPEC 4 routes arrive with their milestones.

Commands: `pnpm --filter @ibasho/web typecheck`, `pnpm --filter @ibasho/web test`.
