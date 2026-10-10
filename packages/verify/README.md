# @ibasho/verify

Certificate emitter, the TS mirror of the Lean checker (worker safe) and the certificate wire codec.

- **Owner:** WP-04 (Lean and verify).
- **Layer:** L1 (imports `@ibasho/core` and `@ibasho/spec-gen` only). See ARCHITECTURE 3.

## Public API

| Export | What |
|---|---|
| `emit(result, { optionMeta, home })` | The `ibasho.cert/2` certificate of a search result, completed with `groups[].optionMeta`, `context.home`, `claimed.saving`, `claimed.carbonAnnual`. Fields the engine already emits are kept. |
| `mirrorCheck(cert)` | The same checks, ids, paths and report (`ibasho.verdicts/1`) as `ibasho-check`. Pure, no I/O. Never throws; malformed input gives `error`. |
| `exitCode(report)` | 0 passed, 1 a check failed, 2 malformed (the `ibasho-check` codes). |
| `decodeCert`, `derive`, `deriveRow`, `checkDecoded` | Lower-level mirror steps. |
| `encodeI64`, `encodeU32`, `encodeU8`, `decodeI64`, `decodeU32`, `decodeU8`, `encodeB64`, `decodeB64` | Wire codec, strict like Lean `Ibasho.Check.Wire`. |

Checks run: `spec.known`, `packs.wellformed`, `enum.complete`, `acct.saving`, `acct.carbon`, `fin.recompute`, `feas.recompute`, `target.recompute`, `pareto.front`, `pareto.witness`, `pareto.picks`. Skipped with a reason: `money.bills` (bills are re-derived inside `fin.recompute`), `score.recompute` (no claimed score until M-B).

## Fixtures

`pnpm --filter @ibasho/verify gen:certs` writes `packages/fixtures/src/certs/`: the GH1 M-0 golden (a real engine search plus `emit`) and the three M-0 mutants with `manifest.json` (M0-2 saving sign flipped: `acct.saving` row/1; M0-3 rejected loft kept in the front: `feas.recompute` row/1; M0-4 heat pump with an unknown looped supply marked feasible: `feas.recompute` row/3). `test/certs.test.ts` checks the mirror, drift against a fresh search, and Lean parity when `proofs/.lake/build/bin/ibasho-check` is built. `test/parity.test.ts` perturbs one field of the golden at a time (31 cases: every claimed column, front, picks, witnesses, statuses, rule ids, context, packs, malformed shapes); each case states its exit code and, when Lean is built, both checkers must give the same report. Gap: `context.memory.completed` (SPEC AC-P1) is read by neither the engine nor the checkers yet.

## Status

- Done (M-0): emitter, mirror, wire codec, golden and mutants, Lean parity tests.
- PLACEHOLDER: `emit` fills `claimed.saving` and `claimed.carbonAnnual` from the certificate physics until the engine (WP-02) claims them; the caller supplies `optionMeta` and `home` until the engine emits them.
- SKELETON (M-C): seal and claim resolver, checker-rung plugins, coverage modes, `POST /verify`.

Commands: `pnpm --filter @ibasho/verify typecheck`, `pnpm --filter @ibasho/verify test`.
