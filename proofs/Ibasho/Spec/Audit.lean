/-
Ibasho spec: axiom audit at build time (SPEC R12, BUILD_PLAN D2). Owner: WP-04.

`lake build` fails if any listed theorem depends on an axiom other than `propext`,
`Classical.choice` and `Quot.sound`, so `sorry` (`sorryAx`) and `native_decide`
(`Lean.ofReduceBool`) cannot slip in. This module imports `Lean` for the meta command; the spec
modules themselves stay Init-only and never import it. The seal manifest audit of
`ibasho-gen --audit` (M-0 WP-04) is separate and reads the same environment.
-/
import Lean
import Ibasho.Spec.V2

open Lean Elab Command

namespace Ibasho.Spec.Audit

/-- The three standard axioms. -/
def standardAxioms : List Name := [``propext, ``Classical.choice, ``Quot.sound]

/-- `#audit_axioms n₁ n₂ ...` fails unless every listed constant uses only standard axioms. -/
elab "#audit_axioms " ids:ident* : command => do
  let mut bad : Array String := #[]
  for id in ids do
    let n ← liftCoreM <| realizeGlobalConstNoOverloadWithInfo id
    let axs ← liftCoreM <| collectAxioms n
    for a in axs do
      unless standardAxioms.contains a do
        bad := bad.push s!"{n} uses {a}"
  unless bad.isEmpty do
    throwError "non-standard axioms: {bad.toList}"
  logInfo m!"axiom audit passed for {ids.size} theorems"

/-- `#audit_modules P` fails unless every declaration imported from a module under `P`
(theorems, definitions, instances, private helpers and auxiliary constants alike) uses only
standard axioms. This is the exhaustive sweep: a `sorry` or `native_decide` in a helper or in a
definition that no listed theorem reaches is still caught. -/
elab "#audit_modules " pfx:ident : command => do
  let env ← getEnv
  let pfx := pfx.getId
  let mut bad : Array String := #[]
  let mut count : Nat := 0
  let mut mods : NameSet := {}
  for (n, _) in env.constants.map₁.toList do
    let some idx := env.getModuleIdxFor? n | continue
    let some mod := env.header.moduleNames[idx.toNat]? | continue
    unless pfx.isPrefixOf mod do continue
    mods := mods.insert mod
    count := count + 1
    let axs ← liftCoreM <| collectAxioms n
    for a in axs do
      unless standardAxioms.contains a do
        bad := bad.push s!"{n} uses {a}"
  if count == 0 then
    throwError "no declarations found under {pfx}"
  unless bad.isEmpty do
    throwError "non-standard axioms: {bad.toList}"
  logInfo m!"axiom audit passed for all {count} declarations in {mods.toList.length} modules under {pfx}"

end Ibasho.Spec.Audit

open Ibasho.Spec.V2 in
#audit_axioms
  -- Fixed point (SPEC 7.4)
  roundHalfEven_spec IsHalfEven.unique roundHalfEven_eq_iff roundHalfEven_mono roundHalfEven_neg
  roundHalfEven_error roundHalfEven_mul discountStep_le discountStep_nonneg discountStep_mono
  growthStep_ge growthStep_le discountFactors_sorted discountFactors_length
  -- Score (SPEC 7.3 score bookkeeping)
  weights_sum_one weight_nonneg groupWeights_sum_one group_partition score_bounds score_nonneg
  score_le_100 subscore_bounds groupScore_bounds score_eq_groups score_monotone
  groupScore_monotone subscore_antitone anchors_valid band_monotone rComposite_mono tComposite_mono
  -- Accounting (R6)
  carbonSaving_eq saving_total saving_neg_iff saving_add carbonSaving_add carbonSaving_nonneg
  carbonSavingG_error carbonSavingG_nonneg saving_annual lifetimeCarbon_eq
  -- Kleene rules (every option shown passes every rule we encoded)
  eval_refines kleene_sound feasibleB_sound feasibleB_complete unknown_never_feasible
  feasible_stable blocked_stable adf_category_monotone
  -- Noise (decided only when rounding cannot change it)
  Noise.noise_enclosure_sound Noise.noise_sum_ge_max Noise.noise_add_unit_fails
  Noise.mcs020a_fails_of_position Noise.pow10Table_correct Noise.thr_correct Noise.root_enclosed
  Noise.Valuation.admissible_nonempty
  -- Enumeration and Pareto (nothing better is hidden; picks are what their names say)
  enum_complete_sound mem_product checkFront_sound checkFront_complete witness_sound
  checkFrontWitnessed_sound front_dominates_rest dominates_trans not_dominates_self
  lexMin_nondominated checkPick_sound checkPicks_sound pick_unique pick_on_front
  -- Memory (what you ruled out never came back)
  rejected_never_offered rejection_antitone rejection_monotone restore_monotone
  rejection_persists rejected_never_returns snooze_expiry_monotone pareto_subset_feasible
  picks_subset_feasible
  -- Interval surrogate (DEC SC-7, /app/proofs only)
  Ival.mulNN_sound Ival.add_sound fabricLoss_enclosed

-- Exhaustive sweep over every spec module (helpers and definitions included).
#audit_modules Ibasho.Spec.V2
