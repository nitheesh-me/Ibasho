# @ibasho/pack-home-in

India home pack (stub until T3).

- **Owner:** WP-01 (package files, `src/ids.ts`, `src/engine/**`); WP-07 (`src/ui/**`). Skeleton created by WP-00 at G0.
- **Layer:** engine half L1 (L0 only, no react/three/DOM, no `Math.*`); ui half L3 (L0, ui, engine result types). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`./engine` exports an `IbashoModule` (default export allowed only there), `./ui` likewise; `./ids` exports the frozen measure and option ids.

## Status

Everything except ids.

Commands: `pnpm --filter @ibasho/pack-home-in typecheck`, `pnpm --filter @ibasho/pack-home-in test`.
