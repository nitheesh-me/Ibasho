# @ibasho/verify

Certificate emitter, the TS mirror of the Lean checker (worker safe) and the certificate wire codec.

- **Owner:** WP-04 (Lean and verify).
- **Layer:** L1 (imports `@ibasho/core` and `@ibasho/spec-gen` only). See ARCHITECTURE 3.

## Public API

| Export | What |
|---|---|
| `emit(result, { optionMeta, home, score? })` | The `ibasho.cert/2` certificate of a search result, completed with `groups[].optionMeta`, `context.home`, `claimed.saving`, `claimed.carbonAnnual`, `claimed.bills` and, when indicators are given, `claimed.score`. Fields the engine already emits are kept. |
| `scoreClaim({ zone, mode, indicators })` | A `claimed.score` block: sub-scores, group scores and total of each row by the spec score (exact `Q`). |
| `mirrorCheck(cert)` | The same checks, ids, paths and report (`ibasho.verdicts/1`) as `ibasho-check`. Pure, no I/O. Never throws; malformed input gives `error`. |
| `exitCode(report)` | 0 passed, 1 a check failed, 2 malformed (the `ibasho-check` codes). |
| `decodeCert`, `derive`, `deriveRow`, `checkDecoded` | Lower-level mirror steps. |
| `encodeI64`, `encodeU32`, `encodeU8`, `decodeI64`, `decodeU32`, `decodeU8`, `encodeB64`, `decodeB64` | Wire codec, strict like Lean `Ibasho.Check.Wire`. |

Checks run: `spec.known`, `packs.wellformed`, `enum.complete`, `acct.saving`, `acct.carbon`, `money.bills` (slab-exact annual your-home bill per row and fuel), `fin.recompute`, `feas.recompute` (memory excludes both `rejected` and `completed`, SPEC AC-P1), `target.recompute`, `pareto.front`, `pareto.witness`, `pareto.picks`, and `score.recompute` when the certificate claims a score (exact rationals, `src/mirror/score.ts`; every front and pick row must be scored). Without a claimed score, `score.recompute` is listed under `skipped` with its reason.

## Fixtures

`pnpm --filter @ibasho/verify gen:certs` writes `packages/fixtures/src/certs/` with `manifest.json`:

- the GH1 M-0 golden (a real engine search plus `emit`), exit 0;
- the scored certificate `gh1-m0.scored.cert.json` (golden plus `claimed.score` of row 0, the front and the picks), exit 0. Its indicators are SYNTHETIC (chosen to exercise the clamps); WP-02 owns real indicators;
- six mutants: M0-2 saving sign flipped (`acct.saving` row/1); M0-3 rejected loft kept in the front (`feas.recompute` row/1); M0-4 heat pump with an unknown looped supply marked feasible (`feas.recompute` row/3); AC-P1 done loft kept in the front (`feas.recompute` row/1); R20 score total one point high (`score.recompute` row/1); R20 the bestReturn pick left unscored (`score.recompute`, no row).

`test/certs.test.ts` checks the mirror, drift against a fresh search, and Lean parity when `proofs/.lake/build/bin/ibasho-check` is built. `test/parity.test.ts` perturbs one field at a time (52 cases: every claimed column including bills and score, front, picks, witnesses, statuses, rule ids, context including done measures, packs, malformed shapes); each case states its exit code and, when Lean is built, both checkers must give the same report.

## Status

- Done (M-0): emitter, mirror, wire codec, golden and mutants, Lean parity tests.
- Done (M-0 gaps): `money.bills`, `score.recompute` and `memory.completed` in Lean (`check_sound` covers them) and the mirror.
- PLACEHOLDER: `emit` fills `claimed.saving`, `claimed.carbonAnnual` and `claimed.bills` from the certificate physics, and `claimed.score` from caller indicators, until the engine (WP-02) claims them; the caller supplies `optionMeta` and `home` until the engine emits them.
- SKELETON (M-C): seal and claim resolver, checker-rung plugins, coverage modes, `POST /verify`.

Commands: `pnpm --filter @ibasho/verify typecheck`, `pnpm --filter @ibasho/verify test`.
