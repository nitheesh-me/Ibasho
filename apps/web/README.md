# @ibasho/web

The app at /app/: routes, worker wiring, home stage, story, studio views, PWA.

- **Owner:** WP-08 (everything except `public/assets/**`, which is WP-11).
- **Layer:** L4 (may import anything).
- Served at `/app/`. `pnpm --filter @ibasho/web dev`, `build`, `preview` (port 4173).

## What works (M-0)

- `/app/` opens the sample home; `/app/home/gh1` is the home stage.
- The engine runs in a Web Worker (`src/worker/engine.worker.ts`, Comlink). The worker also runs the mirror checker on the certificate, so the main thread receives the result and the verdict together.
- The page shows WP-07's SVG house (pencil while computing, ink when done), three futures with `Num` chips, one Checked seal (only when the mirror agrees and the spec is the generated one) and the proved claim "What you ruled out never came back".
- Results are kept in the local store (`@ibasho/store`) when IndexedDB is available.
- The home page stays plain: no theorem names, formula ids or raw errors. Those belong on `/app/proofs` and in the evidence drawer.

## Layout

`src/manifest.ts` (module manifest, Node importable), `src/worker/` (engine and mirror), `src/engine/client.ts` (main thread client), `src/home/` (sample home, view model, page, house drawing), `src/shell/` (shell, services), `src/routes.tsx`.

## Stubs

- PLACEHOLDER: `manifest.ui` is empty until pack UI halves exist (M-A).
- PLACEHOLDER: the evidence note is a small sheet; the full `EvidenceDrawer` arrives at M-C.
- Packs and `spec-gen` are imported by relative path until `apps/web` can declare them (install window).
- Other SPEC 4 routes arrive with their milestones.

Commands: `pnpm --filter @ibasho/web typecheck`, `pnpm --filter @ibasho/web test`.
