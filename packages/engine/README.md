# @ibasho/engine

Worker API, pipeline runner, physics stages, rules evaluator, search, finance, evidence and the certificate emitter input.

- **Owner:** WP-02 (package files, `src/{index,api,worker}.ts`, `src/{search,finance,score,uncertainty,flips,evidence,street}/**`, `test/`, `scripts/`); WP-01 (`src/{pipeline,physics,thermal,calibration,validation}/**`); WP-03 (`src/rules/**`). Skeleton created by WP-00 at G0.
- **Layer:** L1 (imports L0 only; no react, three or DOM; `Math.*` banned by `tools/lint/no-math`). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`EngineApi` (contract in `@ibasho/core` `api.ts`):

- `createEngine({ modules, plugins?, allowOptions?, sliceMs?, keepResults? })` gives an `Engine` (an `EngineApi` plus `registry` and `stateOf(hash)`). Node callers (tests, `pnpm m0`, the CI proxy) use it directly.
- `exposeEngine(endpoint, opts)` exposes the engine through Comlink. The app's worker file calls it with the engine half of its module manifest. On the main thread, wrap `onProgress` in `Comlink.proxy`; `search` returns a proxied `{ jobId, result }` (read with `await r.jobId`, `await r.result`).
- `M0_OPTION_IDS` restricts the search to the walking skeleton: loft 300, draught-proofing, ASHP, so 8 packages.
- Search, finance, Pareto and wire helpers are exported for the verify mirror and tests: `runSearch`, `planGroups`, `paretoFront`, `witnesses`, `picks`, `dominates`, `bills`, `cashFlows`, `applyGrants`, `carbonSavingG`, `lifetimeCarbonG`, `emitCertificate`, `decodeI64`, `decodeU32`, `decodeU8`.

## How a search runs (M-0)

1. Groups from the registered measures, `none` first; the full product in mixed radix, row 0 is the empty package.
2. Heavy runs per (heavy options, DHW class) and mode; light runs per package on the cached heavy run (WP-01 runner).
3. Bookkeeping on the your-home run, all integer: per (fuel, month) savings, monthly carbon (µg/Wh factors, one rounding to grams), lifetime carbon over the horizon with the trajectory, slab-exact bills, option costs, stacked grants, N0, B_t, NPV with replacements and residual value.
4. Rules (WP-03 Kleene evaluator, `p.capex` is the gross central cost), plus `BUILTIN.MEMORY` (a rejected option or measure blocks). Status: blocked, then needs-check, then target miss (`BUILTIN.TARGET`), else feasible. Default target: saves money in year 1 and cuts running carbon.
5. Front over feasible packages on (N0 down, lifetime carbon up, NPV up); a witness per dominated package; the three R7 picks (never the empty package); the needs-check lane.
6. Eager evidence for the baseline, front and picks (physics from a full rerun, checked bit for bit against the light path, plus bookkeeping nodes); `evidence()` builds any other package on demand.
7. `ibasho.cert/2` (encoding in `src/search/certificate.ts`) and the result hash (certificate, twin hash, plugin fingerprint).

The search runs in about 20 ms slices and checks for `cancel` between them.

## Status

Done at M-0: search over 8 packages (18 with every M-0 option), fixed-point savings, monthly carbon, N0, NPV, front, witnesses, picks, needs-check lane, certificate input, `api.ts`, `worker.ts` (Comlink), lazy evidence, `packages/fixtures/src/results/gh1-m0.search.json`.

PLACEHOLDER (marked in code), by milestone:

- M-B: score (exact Q from spec-gen) and groups, EPC band and the band target, uncertainty (LHS 200), flips, export income, paybacks, IRR, loan and cash-positive flag, the counterfactual boiler, value range in results, obligations re-keying heavy runs, branch and bound above the R9 limits, the real-scale `gh1.search.json`.
- `calibrate` and `valueOfInformation` (WP-01) and `noise` (WP-03) throw `NotImplementedYet`.

Commands: `pnpm --filter @ibasho/engine typecheck`, `pnpm --filter @ibasho/engine test`, `pnpm --filter @ibasho/engine gen:results` (rewrite the results fixture after a deliberate engine or pack change; a test fails on drift).
