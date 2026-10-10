# `proofs/Ibasho/Spec`: the normative Lean spec

- **Owner:** WP-04 (spec half, early parallel wave). The checker half (`Ibasho/Check/**`, the exes, `packages/spec-gen`, `packages/verify`) belongs to the M-0 WP-04 agent and imports this library.
- **Layer:** proofs. Lean `v4.34.0`, core only, no Mathlib (SPEC R12). Every spec module is Init-only (no `import Lean`), so the checker core stays WASM-ready. Only `Audit.lean` imports `Lean`.
- **Public API:** `import Ibasho.Spec.V2` (everything) or one module. Namespace `Ibasho.Spec.V2`; the noise rule sits in `Ibasho.Spec.V2.Noise`.

## Build

```
cd proofs
lake build          # default target IbashoSpec: every Ibasho.Spec.* module, about 5 s clean
```

`lake build` fails on any proof error, any `#guard` spot check that does not hold, and any axiom other than `propext`, `Classical.choice` and `Quot.sound` (so no `sorry`, no `native_decide`). Three layers enforce this:

- `#audit_axioms` in `Audit.lean` checks the 83 named theorems (every SPEC 7.3 name that lives here), so a renamed or missing claim also fails the build.
- `#audit_modules Ibasho.Spec.V2` sweeps every declaration of every V2 module (helpers, definitions, instances and auxiliary constants included; 1752 at last build), so a hole in a lemma no named theorem reaches is still caught.
- The `IbashoSpec` library sets `warningAsError`, so even a stray `Ibasho.Spec.*` module that `Audit.lean` never imports cannot land with a `sorry`.

No `sorry` and no `axiom` appear anywhere.

## Modules and theorems

| Module | Normative content | Main theorems |
|---|---|---|
| `V2/Fixed.lean` | `roundHalfEven`, `divRound`, `mulDiv`, `applyFactor`, `discountStep`, `growthStep`, `discountFactors`, `growthFactors` (SPEC 7.4); mirrors `packages/core/src/fixed` | `roundHalfEven_spec`, `IsHalfEven.unique`, `roundHalfEven_eq_iff` (nearest, ties to even, unique), `roundHalfEven_mono`, `roundHalfEven_neg`, `roundHalfEven_error`, `discountStep_le`, `discountFactors_sorted`, `growthStep_ge`, `growthStep_le`; `#guard` against the G0-5 vectors |
| `V2/Units.lean` | `Fuel` (certificate order), `Month = Fin 12`, `FuelMonthVec`, finite sum lemmas | `Month.days_sum` |
| `V2/Accounting.lean` | `saving`, `emissionsUg`, `carbonSavingUg`, `carbonSavingG` (one rounding, µg to g), `lifetimeCarbonUg/G` (trajectory by year) | `carbonSaving_eq`, `saving_total`, `saving_neg_iff`, `saving_add`, `carbonSaving_add`, `carbonSaving_nonneg`, `carbonSavingG_error`, `lifetimeCarbon_eq` |
| `V2/Score.lean` | `Dim` F C E A H R T, `weight`, `Group`, `clamp01`, `Anchor.unit` normaliser, `rComposite`, `tComposite`, `subScore`, `groupScore`, `score`, UK and India anchors, `sapBand` | `weights_sum_one`, `groupWeights_sum_one`, `score_bounds`, `subscore_bounds`, `groupScore_bounds`, `score_eq_groups`, `score_monotone`, `groupScore_monotone`, `subscore_antitone`, `anchors_valid`, `band_monotone` |
| `V2/Rules/Kleene.lean` | `Tri`, `Expr` AST, `eval` (strong Kleene), `Effect`, `Rule`, `App`, `status`, `feasibleB`, `Feasible` | `eval_refines`, `kleene_sound` (completion soundness), `feasibleB_sound`, `feasibleB_complete`, `unknown_never_feasible`, `feasible_stable`, `blocked_stable` |
| `V2/Rules/Noise.lean` | MCS 020 a) `decidePosition`, `mcs020aLpLe` by rational enclosure | `noise_enclosure_sound`, `Valuation.admissible_nonempty` (the hypothesis is satisfiable), `noise_sum_ge_max`, `noise_add_unit_fails`, `pow10Table_correct`, `thr_correct`, `root_enclosed` |
| `V2/Rules/Adf.lean` | `adfCategory` (AD F Diagram 3.1) | `adf_category_monotone` |
| `V2/Enum.lean` | `product` of choice groups, `checkEnum` | `enum_complete_sound`, `mem_product`, `product_length` |
| `V2/Pareto.lean` | `Outcome` (R8 axes, fixed point), `Dominates`, `checkFront`, `checkWitness`, `checkFrontWitnessed`, `pickKey`, `checkPick`, `checkPicks` | `checkFront_sound`, `checkFront_complete`, `witness_sound`, `front_dominates_rest`, `lexMin_nondominated`, `checkPicks_sound`, `pick_unique`, `pick_on_front` |
| `V2/Memory.lean` | `offered`, `respectsMemory`, `MemEvent`, `replay`, snoozes | `rejected_never_offered`, `rejection_antitone`, `restore_monotone`, `rejection_persists`, `rejected_never_returns`, `snooze_expiry_monotone`, `pareto_subset_feasible`, `picks_subset_feasible` |
| `V2/Interval.lean` | `Ival`, `fabricLoss` surrogate (DEC SC-7, `/app/proofs` only) | `Ival.mulNN_sound`, `fabricLoss_enclosed` |
| `Audit.lean` | `#audit_axioms` over 83 named theorems, `#audit_modules` over every V2 declaration | (fails the build on a non-standard axiom) |

## SPEC 7.3 claims to theorems

| Claim | Theorems here | Still to come (M-0 WP-04, `Check/`) |
|---|---|---|
| Nothing better is hidden | `checkFront_sound`, `checkFront_complete`, `witness_sound`, `front_dominates_rest`, `enum_complete_sound` | `check_sound`, `checkFront` wiring |
| What you ruled out never came back | `rejected_never_offered`, `rejection_antitone`, `restore_monotone`, `rejected_never_returns` | |
| Every option shown passes every rule we encoded | `kleene_sound`, `unknown_never_feasible`, `feasibleB_sound`, `feasible_stable` | |
| The three picks are what their names say | `lexMin_nondominated`, `checkPicks_sound`, `pick_unique` | |
| The noise test is decided only when rounding cannot change it | `noise_enclosure_sound`, `noise_sum_ge_max` | |
| Score bookkeeping | `weights_sum_one`, `score_bounds`, `score_monotone` | |

## What is not proved (the honest boundary)

- Physics outputs (delivered Wh per fuel and month) are trusted inputs.
- `1/π` bounds come from `333/106 < π < 355/113`, a classical fact stated as the `Valuation.Admissible` hypothesis, not as an axiom; `Valuation.admissible_nonempty` shows the hypothesis is satisfiable, so the soundness theorem is not vacuous. Over the reals the intended valuation is admissible by `pow10Table_correct`, `thr_correct` and `root_enclosed`; the last step (real `10^x` is the positive root) is outside core Lean.
- Kleene `compare` reads a malformed comparison (ordering a string) as unknown; TS throws `RuleError`. Unknown can only make a status more cautious.
- Anchors, weights and band thresholds are the SF 2.3 v1 defaults; the proofs re-run on any edit.

## Stated choices other WPs must mirror

- Picks: the final tie-break after the R7 tie-breaks is the lower package index (row). WP-02 already emits this.
- Noise inputs are integers: `LwA` and `A_B` in deci-decibels, distance in decimetres, `Q` from the count of reflecting surfaces (1, 2, 3; more fails). Pass iff `Σ 10^(Lp_i/10) < 10^3.705` (rounded total at most 37.0 dB). Unknown when the enclosure straddles the threshold.
- Carbon: exact in µg, rounded once, half even, to g (`carbonSavingG`, `lifetimeCarbonG`).
