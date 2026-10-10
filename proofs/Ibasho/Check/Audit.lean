/-
Ibasho checker: axiom audit at build time (SPEC R12, BUILD_PLAN D2, D5). Owner: WP-04 (checker
half).

`lake build IbashoCheck` fails if `check_sound` or any checker declaration depends on an axiom
other than `propext`, `Classical.choice` and `Quot.sound`, so `sorry` and `native_decide` cannot
slip into the checker. The commands come from `Ibasho.Spec.Audit`; `ibasho-gen --audit` runs the
same sweep again from the executable and records each seal theorem's axioms in `seals.json`.
-/
import Ibasho.Spec.Audit
import Ibasho.Check

open Ibasho.Check in
#audit_axioms
  check_sound checkAll_iff chkSpecKnown_sound chkEnum_sound chkAcctSaving_sound
  chkAcctCarbon_sound chkFin_sound chkFeas_class expected_passed chkTarget_feasible
  meets_of_expected feasible_row rules_feasible_sound memory_sound chkTarget_lane
  chkWitness_witnessed chkBills_sound chkScore_sound claimed_score_bounds
  valid_score_bounds scoreVerdicts_all net_cost_nonneg netUpfront_le slabCharge_flat lifetimeCarbonG_zero

-- Exhaustive sweep over every checker module (helpers and definitions included).
#audit_modules Ibasho.Check
