# @ibasho/tools-lint

Repository lints run by `pnpm lint` (root script `lint:tools`).

- **Owner:** WP-00 until G0, then WP-10 (QA).

| File | Checks | Scope |
|---|---|---|
| `no-dash.ts` | No em dash or en dash anywhere | every tracked or untracked, non-ignored text file |
| `no-math.ts` | No non-exact `Math.*`, no `Math` aliasing, no `**` | `packages/engine/**`, `packs/*/src/engine/**` (tests exempt) |
| `legend.ts` | A `visual-layer` that encodes numbers declares `Legend` and `evidenceAt` (AC-15) | `packages/scene/src`, `packages/ui/src`, `packs/*/src/ui` |
| `ownership.ts` | BUILD_PLAN 2 as a path to WP map: every file has exactly one owner | every file |
| `run.ts` | Runs all of the above; exit 1 on any finding | |

Allowed `Math` members in the engine: `abs ceil floor trunc round sign min max imul fround clz32` and the constants. Suppress one line with `// lint-allow no-math: <reason>`.

Fixtures: `__fixtures__/` (G0-2 dependency-cruiser fixture, legend fixtures) and `packages/engine/__lint_fixtures__/math-exp.ts` (G0-3). Lints skip fixture folders in normal runs; the tests in `test/` run the lints on them directly.

`tests/contracts/ownership.test.ts` (WP-10) should import `checkOwnership` and `outsideOwnership` from here.
