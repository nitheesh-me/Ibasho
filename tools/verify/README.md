# @ibasho/tools-verify

`pnpm verify [cert ...]`: runs the Lean checker (`proofs/.lake/build/bin/ibasho-check`) and the TS mirror (`@ibasho/verify`) on each certificate and requires them to agree on every verdict and on the exit code. With no argument it runs the committed set in `packages/fixtures/src/certs/`: the golden must pass and each mutant must fail its named check.

- **Owner:** WP-04 (Lean and verify).
- **Layer:** Tool. Imports `packages/verify/src` by relative path.

## Public API

CLI (`src/cli.ts`); `main`, `runOne`, `runCommitted` from `src/run.ts` for tests.

## Status

Done for M-0. Build the Lean checker first: `cd proofs && lake build ibasho-check` (without it the tool runs the mirror only and says so).

Commands: `pnpm verify`, `pnpm --filter @ibasho/tools-verify typecheck`, `pnpm --filter @ibasho/tools-verify test`.
