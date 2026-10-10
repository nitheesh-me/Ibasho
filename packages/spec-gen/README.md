# @ibasho/spec-gen

Generated from Lean by `lake exe ibasho-gen` (ARCH 8.2). Do not edit `src/generated/**` by hand.

- **Owner:** WP-04 (Lean and verify).
- **Layer:** L0. Imports nothing in the repo.
- **Regenerate:** `pnpm --filter @ibasho/spec-gen gen` (builds `ibasho-gen` in `proofs/` and writes the files).
- **Drift gate (D6):** `pnpm --filter @ibasho/spec-gen gen:check` exits 1 if any file differs from the Lean output.

## Public API

| Export | File | Lean source | Consumer |
|---|---|---|---|
| `Certificate`, `CertGroup`, `CertHome`, `CertOptionMeta`, `CertCheckId`, `CERT_CHECK_IDS`, `CERT_SKIPPED_CHECKS`, `CERT_STATUS`, `CERT_NO_WITNESS` | `generated/cert.ts` | `Ibasho.Check.Ids`, `Check` | engine emitter, verify, store, core |
| `NamedFn`, `NAMED_FNS`, `NAMED_FN_IMPLEMENTED`, `BUILTIN_RULE_IDS` | `generated/rules.ts` | `Ibasho.Check.Ids` | core registry, rule packs |
| `SCORE_DIMS`, `SCORE_WEIGHTS`, `SCORE_GROUPS`, `ANCHORS`, `R_TARGET`, `T_CAPS`, `BAND_THRESHOLDS`, `FIXED`, `SEARCH_LIMITS`, `ClaimKey` | `generated/spec.ts` | `Ibasho.Spec.V2.Score`, `Fixed`, `Units` | engine, verify |
| `SPEC_VERSION`, `SPEC_HASH`, `HISTORICAL_SPEC_HASHES`, `SPEC_GEN_IS_PLACEHOLDER` (false), `SPEC_MANIFEST` | `generated/specHash.ts` | `Ibasho.Check.Manifest` | verify, engine |
| `@ibasho/spec-gen/cert.schema.json` | JSON | shape of `ibasho.cert/2` | verify, store |
| `@ibasho/spec-gen/seals.json` | JSON | SPEC 7.3 claims, each theorem's statement and axioms read from the compiled environment | verify, ui, `/app/proofs` |

`SPEC_HASH` is the SHA-256 of `SPEC_MANIFEST` joined with newlines plus a final newline: every normative constant the TS side consumes, check ids, built-in rule ids and `specVersion`.

## What is stubbed

- Reference price packs are not in the spec yet (they arrive with the M-B finance work).
- `NAMED_FN_IMPLEMENTED` is all false: no named rule function is wired into the checker yet, so a rule that uses one is unknown in both checkers.
- `cert.schema.json` checks the shape, not the values (the checks are the Lean checker's job).
