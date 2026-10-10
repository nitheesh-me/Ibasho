# @ibasho/spec-gen

**PLACEHOLDER: replaced by ibasho-gen.**

Owner: WP-00 created the placeholder at G0. From G0, WP-04 (Lean and verify) owns `packages/spec-gen/**` and replaces `src/generated/**` with the output of `lake exe ibasho-gen` (ARCH 8.2).

Layer L0. Imports nothing in the repo.

## Public API (shape is final, values are placeholders)

| Export | From | Consumer |
|---|---|---|
| `Certificate`, `CertGroup`, `CertCheckId`, `CERT_CHECK_IDS` | `generated/cert.ts` | engine emitter, verify, store, core (type re-export) |
| `NamedFn`, `NAMED_FNS` | `generated/rules.ts` | core registry, rule packs |
| `SCORE_WEIGHTS`, `SCORE_GROUPS`, `BAND_THRESHOLDS`, `FIXED`, `SEARCH_LIMITS` | `generated/spec.ts` | engine, verify |
| `SPEC_HASH`, `HISTORICAL_SPEC_HASHES`, `SPEC_GEN_IS_PLACEHOLDER` | `generated/specHash.ts` | verify |
| `@ibasho/spec-gen/cert.schema.json`, `@ibasho/spec-gen/seals.json` | JSON | verify, ui, `/app/proofs` |

## What is stubbed

- `SPEC_HASH` is `placeholder-spec-hash`; `SPEC_GEN_IS_PLACEHOLDER` is `true`. Verify must refuse to show a Checked seal while it is `true`.
- Anchors and reference prices are absent (they exist only in Lean).
- `cert.schema.json` checks the top-level shape only.
- `seals.json` has claim sentences and theorem names from SPEC 7.3 but no Lean statements or axiom lists.
