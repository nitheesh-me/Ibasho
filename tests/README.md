# @ibasho/tests

Cross-package tests. **Owner: WP-10 (QA).** `tests/smoke/**` was written by WP-00 for G0-6 and transfers to WP-10 at G0.

| Folder | Script | State |
|---|---|---|
| `smoke/` | `pnpm smoke` (root) | Real: G0-6, both apps boot to a blank Andon page in Chromium |
| `contracts/` | `pnpm contracts` (root) | SKELETON: runs Vitest over `contracts/`; WP-10 adds ownership, measures, layers, fingerprint and StageIO tests |
| `m0/` | `pnpm m0` (root) | PLACEHOLDER: prints a message and exits 0 until WP-10 writes the M-0 slice |
| `e2e/` | `pnpm e2e` (root) | PLACEHOLDER |

Ownership checks: `tools/lint/ownership.ts` holds the path to WP map from BUILD_PLAN 2 and checks disjointness and coverage. `tests/contracts/ownership.test.ts` (WP-10) should call it rather than read commit trailers, because agents do not commit.
