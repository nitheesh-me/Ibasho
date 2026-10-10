# @ibasho/fixtures

Golden homes, bills, results, certificates, rules goldens, injection corpus. Per-owner folders; no shared index (DEC TE-7).

- **Owner:** WP-10 (package files, `src/stranger/**`); folders under `src/` belong to the WP named in BUILD_PLAN 2. Skeleton created by WP-00 at G0.
- **Layer:** Test data only (never imported by production code). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

Import a file directly: `@ibasho/fixtures/homes/gh1.twin.json`.

## Status

No fixtures yet.

Commands: `pnpm --filter @ibasho/fixtures typecheck`, `pnpm --filter @ibasho/fixtures test`.
