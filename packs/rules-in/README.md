# @ibasho/pack-rules-in

ENS, Telangana, RWA, DT, applicability rules (stub until T3).

- **Owner:** WP-03. Skeleton created by WP-00 at G0.
- **Layer:** engine half L1 (L0 only, no react/three/DOM, no `Math.*`). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`./engine` exports an `IbashoModule` (default export allowed only there).

## Status

PLACEHOLDER until T3 (gate M-G): no rules yet. The named functions it will use, `ens_retv` and `dt_hosting`, already exist in `@ibasho/engine` (WP-03 M-B).

Commands: `pnpm --filter @ibasho/pack-rules-in typecheck`, `pnpm --filter @ibasho/pack-rules-in test`.
