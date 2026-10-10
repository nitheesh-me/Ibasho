# @ibasho/dmath

Deterministic exp, log, log10, pow, sin, cos, atan2, acos and sqrt ported from fdlibm, with test vectors that run in Node, Chromium and Firefox (AC-D1).

- **Owner:** WP-01 (Physics). Skeleton created by WP-00 at G0.
- **Layer:** L0 (imports nothing in the repo). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`exp`, `log`, `log10`, `pow`, `sin`, `cos`, `atan2`, `acos`, `sqrt` (ARCH 4.3).

## Status

Everything. No function is exported yet.

Commands: `pnpm --filter @ibasho/dmath typecheck`, `pnpm --filter @ibasho/dmath test`.
