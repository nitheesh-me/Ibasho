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

Trusted, not proved: physics outputs, the JSON parser, the Lean compiler and runtime. PLACEHOLDER until M-B: fuel price escalation (growth 0), O and M, explicit replacement schedules, named rule functions (all unknown).

Checks: `money.bills` ties every claimed annual bill to the slab-exact bill of the row's delivered energy; `score.recompute` recomputes every claimed sub-score, group score and total in exact rationals (`Ibasho.Spec.V2.Score`) and requires the front and picks to be scored (it is skipped, with its reason, only when the certificate claims no score); the memory built-in excludes both `rejected` and `completed` measures (SPEC AC-P1). `check_sound` covers all three (`chkBills_sound`, `chkScore_sound`, `memory_sound`); the axiom audit lists 25 theorems. Trust boundary of the score: the seven indicators and the anchor choice (`zone`, `mode`) are taken from the certificate, like other physics outputs; the check proves the arithmetic from them, not the indicators themselves, and does not yet tie `zone` to `context.home.region`.
