# @ibasho/engine

Worker API, pipeline runner, physics stages, 5R1C, calibration, rules evaluator, search, finance, score, uncertainty and evidence.

- **Owner:** WP-02 (package files, `src/{index,api,worker}.ts`, search, finance, score, uncertainty, flips, evidence, street); WP-01 (`src/{pipeline,physics,thermal,calibration,validation}/**`); WP-03 (`src/rules/**`). Skeleton created by WP-00 at G0.
- **Layer:** L1 (imports L0 only; no react, three or DOM; `Math.*` banned by `tools/lint/no-math`). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`EngineApi` implementation (contract in `@ibasho/core` `api.ts`), exposed from `src/worker.ts` through Comlink.

## Status

Everything.

Commands: `pnpm --filter @ibasho/engine typecheck`, `pnpm --filter @ibasho/engine test`.
