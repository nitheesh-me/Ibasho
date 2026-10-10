# @ibasho/tools-verify

`pnpm verify [cert]`: runs the Lean checker on a certificate or the golden set.

- **Owner:** WP-04 (Lean and verify). Skeleton created by WP-00 at G0.
- **Layer:** Tool. See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

CLI only.

## Status

`verify` exits 1 with a message until WP-04 implements it.

Commands: `pnpm --filter @ibasho/tools-verify typecheck`, `pnpm --filter @ibasho/tools-verify test`.
