# Ibasho checker (Lean, WP-04 checker half)

Re-derives every bookkeeping claim of an `ibasho.cert/2` certificate from its trusted inputs (physics, twin facts, pack data) with the spec definitions in `Ibasho.Spec.V2`, and proves the checks sound.

| Module | What |
|---|---|
| `Wire` | base64 int64, u32, u8 decoding (TS twin `packages/verify/src/wire.ts`) |
| `Sha256` | SHA-256 for `specHash` |
| `Schema` | the decoded certificate `Cert` |
| `Finance` | slab bills, net upfront cost, NPV, lifetime carbon |
| `Ids` | check ids, built-in rules, named functions, limits |
| `Manifest` | the spec manifest and `specHash` |
| `Check` | `derive`, every check, `check`, `checkAll` |
| `Sound` | `Valid c` and `check_sound : checkAll c = true → Valid c` |
| `Json` | JSON adapter for the native exe (trusted, LV 10) |
| `Audit` | build fails if any checker declaration uses an axiom beyond `propext`, `Classical.choice`, `Quot.sound` |

Executables (`proofs/Main`): `lake exe ibasho-check [--batch] [cert.json]` (exit 0 passed, 1 failed, 2 malformed) and `lake exe ibasho-gen [--check] [--audit]` (writes `packages/spec-gen/src/generated/**`).

Build: `lake build IbashoCheck ibasho-check ibasho-gen`.

Trusted, not proved: physics outputs, the JSON parser, the Lean compiler and runtime. PLACEHOLDER until M-B: fuel price escalation (growth 0), O and M, explicit replacement schedules, named rule functions (all unknown), `money.bills` and `score.recompute` (skipped with a reason).
