# @ibasho/verify

Certificate emitter, TS mirror checker (worker safe), seal and claim resolver, checker-rung plugins and the companion `POST /verify` handler.

- **Owner:** WP-04 (Lean and verify). Skeleton created by WP-00 at G0.
- **Layer:** L1 (imports L0 only). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`emit(result)`, `mirrorCheck(cert, scope)`, `resolveSeals(...)` (ARCH 8.4).

## Status

Everything.

Commands: `pnpm --filter @ibasho/verify typecheck`, `pnpm --filter @ibasho/verify test`.
